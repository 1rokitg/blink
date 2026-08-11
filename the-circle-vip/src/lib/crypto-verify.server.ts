import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  CRYPTO_CHAINS,
  type CryptoChainId,
  usdcToAtomic,
} from "@/lib/crypto-payments";

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export type StoredPayment = {
  txHash: string;
  chainId: CryptoChainId;
  planId: string;
  amountUsdc: number;
  telegramUserId: string;
  telegramUsername: string;
  inviteLink: string | null;
  createdAt: string;
  fromAddress?: string | null;
  walletBrand?: string | null;
  channel?: string | null;
  utmSource?: string | null;
  utmCampaign?: string | null;
  email?: string | null;
  name?: string | null;
  discordUsername?: string | null;
  preferredPaymentMethod?: "crypto" | "card" | string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeInvoiceId?: string | null;
  accessEndsAt?: string | null;
  explorerUrl?: string | null;
};

function txKey(txHash: string) {
  return `tx:${txHash.toLowerCase()}`;
}

function ledgerPath() {
  return path.join(process.cwd(), ".data", "crypto-payments.json");
}

async function getKv(): Promise<KVNamespace | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    const binding = (env as CloudflareEnv | undefined)?.CRYPTO_PAYMENTS;
    return binding ?? null;
  } catch {
    return null;
  }
}

async function readFileLedger(): Promise<StoredPayment[]> {
  try {
    const raw = await readFile(ledgerPath(), "utf8");
    return JSON.parse(raw) as StoredPayment[];
  } catch {
    return [];
  }
}

async function writeFileLedger(rows: StoredPayment[]) {
  const file = ledgerPath();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(rows, null, 2), "utf8");
}

const RECENT_PAYMENTS_KEY = "crypto:payments:recent";
const RECENT_PAYMENTS_CAP = 200;

export async function findPaymentByTx(txHash: string) {
  const kv = await getKv();
  if (kv) {
    return kv.get<StoredPayment>(txKey(txHash), "json");
  }

  const rows = await readFileLedger();
  return (
    rows.find((row) => row.txHash.toLowerCase() === txHash.toLowerCase()) ??
    null
  );
}

/** Keep a durable, queryable list for Monetise (no TTL — this is a ledger). */
export async function indexRecentCryptoPayment(payment: StoredPayment) {
  const kv = await getKv();
  if (kv) {
    const recent =
      (await kv.get<{ payments: StoredPayment[] }>(RECENT_PAYMENTS_KEY, "json")) ?? {
        payments: [],
      };
    const hash = payment.txHash.toLowerCase();
    const next = [
      payment,
      ...recent.payments.filter((row) => row.txHash.toLowerCase() !== hash),
    ].slice(0, RECENT_PAYMENTS_CAP);
    await kv.put(RECENT_PAYMENTS_KEY, JSON.stringify({ payments: next }));
    return;
  }

  // Local/dev: file ledger already holds rows; nothing else to index.
}

export async function listRecentCryptoPayments(
  limit = RECENT_PAYMENTS_CAP,
): Promise<StoredPayment[]> {
  const kv = await getKv();
  if (kv) {
    const recent =
      (await kv.get<{ payments: StoredPayment[] }>(RECENT_PAYMENTS_KEY, "json")) ?? {
        payments: [],
      };
    return [...recent.payments]
      .sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || 0,
      )
      .slice(0, limit);
  }

  const rows = await readFileLedger();
  return [...rows]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || 0)
    .slice(0, limit);
}

export async function recordPayment(payment: StoredPayment) {
  const kv = await getKv();
  if (kv) {
    const key = txKey(payment.txHash);
    const existing = await kv.get(key);
    if (!existing) {
      await kv.put(key, JSON.stringify(payment));
    }
    await indexRecentCryptoPayment(payment);
    return;
  }

  const rows = await readFileLedger();
  if (
    !rows.some(
      (row) => row.txHash.toLowerCase() === payment.txHash.toLowerCase(),
    )
  ) {
    rows.push(payment);
    await writeFileLedger(rows);
  }
  await indexRecentCryptoPayment(payment);
}

async function rpcCall(rpcUrl: string, method: string, params: unknown[]) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
    cache: "no-store",
  });

  const json = (await response.json()) as {
    result?: unknown;
    error?: { message?: string };
  };

  if (json.error) {
    throw new Error(json.error.message ?? "RPC error");
  }

  return json.result;
}

function normalizeHexAddress(value: string) {
  return value.toLowerCase().replace(/^0x/, "").padStart(40, "0");
}

function topicAddress(topic: string) {
  return `0x${topic.slice(-40)}`.toLowerCase();
}

export async function verifyEvmUsdcTransfer(options: {
  chainId: CryptoChainId;
  txHash: string;
  expectedAmountUsdc: number;
}) {
  const chain = CRYPTO_CHAINS[options.chainId];
  if (chain.kind !== "evm") {
    throw new Error("Not an EVM chain.");
  }

  const hash = options.txHash.startsWith("0x")
    ? options.txHash
    : `0x${options.txHash}`;

  const receipt = (await rpcCall(chain.rpcUrl, "eth_getTransactionReceipt", [
    hash,
  ])) as {
    status?: string;
    logs?: Array<{
      address: string;
      topics?: string[];
      data: string;
    }>;
  } | null;

  if (!receipt) {
    return { ok: false as const, error: "Transaction not found yet. Wait and retry." };
  }

  if (receipt.status && BigInt(receipt.status) !== BigInt(1)) {
    return { ok: false as const, error: "Transaction failed on-chain." };
  }

  const expected = usdcToAtomic(options.expectedAmountUsdc, chain.usdcDecimals);
  const usdc = chain.usdcAddress.toLowerCase();
  const recipient = normalizeHexAddress(chain.recipient);

  const transfer = (receipt.logs ?? []).find((log) => {
    if (log.address.toLowerCase() !== usdc) {
      return false;
    }
    if ((log.topics?.[0] ?? "").toLowerCase() !== TRANSFER_TOPIC) {
      return false;
    }
    if (!log.topics?.[2]) return false;
    return normalizeHexAddress(topicAddress(log.topics[2])) === recipient;
  });

  if (!transfer) {
    return {
      ok: false as const,
      error: `No USDC transfer to ${chain.recipient} found in this transaction.`,
    };
  }

  const amount = BigInt(transfer.data);
  if (amount < expected) {
    return {
      ok: false as const,
      error: `Amount too low. Expected ${options.expectedAmountUsdc} USDC.`,
    };
  }

  return {
    ok: true as const,
    amountUsdc: Number(amount) / 10 ** chain.usdcDecimals,
    txHash: hash,
    fromAddress: transfer.topics?.[1]
      ? topicAddress(transfer.topics[1])
      : null,
  };
}

export async function verifySolanaUsdcTransfer(options: {
  txHash: string;
  expectedAmountUsdc: number;
}) {
  const chain = CRYPTO_CHAINS.solana;
  const expected = usdcToAtomic(options.expectedAmountUsdc, chain.usdcDecimals);

  const result = (await rpcCall(chain.rpcUrl, "getTransaction", [
    options.txHash,
    {
      encoding: "jsonParsed",
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    },
  ])) as {
    meta?: {
      err?: unknown;
      preTokenBalances?: Array<{
        mint: string;
        owner?: string;
        uiTokenAmount: { amount: string };
      }>;
      postTokenBalances?: Array<{
        mint: string;
        owner?: string;
        uiTokenAmount: { amount: string };
      }>;
    };
  } | null;

  if (!result) {
    return { ok: false as const, error: "Transaction not found yet. Wait and retry." };
  }

  if (result.meta?.err) {
    return { ok: false as const, error: "Transaction failed on-chain." };
  }

  const pre = (result.meta?.preTokenBalances ?? []).filter(
    (row) =>
      row.mint === chain.usdcAddress && row.owner === chain.recipient,
  );
  const post = (result.meta?.postTokenBalances ?? []).filter(
    (row) =>
      row.mint === chain.usdcAddress && row.owner === chain.recipient,
  );

  const preAmount = pre.reduce(
    (sum, row) => sum + BigInt(row.uiTokenAmount.amount),
    BigInt(0),
  );
  const postAmount = post.reduce(
    (sum, row) => sum + BigInt(row.uiTokenAmount.amount),
    BigInt(0),
  );

  let delta = postAmount - preAmount;

  if (delta < expected) {
    // Fallback: scan parsed instructions for transferChecked to recipient
    const tx = (await rpcCall(chain.rpcUrl, "getTransaction", [
      options.txHash,
      {
        encoding: "jsonParsed",
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      },
    ])) as {
      transaction?: {
        message?: {
          instructions?: Array<{
            program?: string;
            parsed?: {
              type?: string;
              info?: {
                mint?: string;
                destination?: string;
                tokenAmount?: { amount?: string };
                amount?: string;
              };
            };
          }>;
        };
      };
      meta?: {
        innerInstructions?: Array<{
          instructions: Array<{
            program?: string;
            parsed?: {
              type?: string;
              info?: {
                mint?: string;
                destination?: string;
                tokenAmount?: { amount?: string };
                amount?: string;
              };
            };
          }>;
        }>;
      };
    } | null;

    const instructions = [
      ...(tx?.transaction?.message?.instructions ?? []),
      ...(tx?.meta?.innerInstructions ?? []).flatMap((row) => row.instructions),
    ];

    for (const ix of instructions) {
      const info = ix.parsed?.info;
      if (!info) continue;
      if (info.mint && info.mint !== chain.usdcAddress) continue;
      const amount = BigInt(
        info.tokenAmount?.amount ?? info.amount ?? "0",
      );
      if (amount >= expected) {
        delta = amount;
        break;
      }
    }

    if (delta < expected) {
      return {
        ok: false as const,
        error: `Amount too low or not sent to treasury. Expected ${options.expectedAmountUsdc} USDC.`,
      };
    }
  }

  return {
    ok: true as const,
    amountUsdc: options.expectedAmountUsdc,
    txHash: options.txHash,
  };
}

export async function verifyCryptoPayment(options: {
  chainId: CryptoChainId;
  txHash: string;
  expectedAmountUsdc: number;
}) {
  const existing = await findPaymentByTx(options.txHash);
  if (existing) {
    return {
      ok: true as const,
      alreadyProcessed: true as const,
      payment: existing,
    };
  }

  if (options.chainId === "solana") {
    const verified = await verifySolanaUsdcTransfer(options);
    if (!verified.ok) {
      return verified;
    }
    return { ...verified, alreadyProcessed: false as const, fromAddress: null };
  }

  const verified = await verifyEvmUsdcTransfer(options);
  if (!verified.ok) {
    return verified;
  }
  return {
    ...verified,
    alreadyProcessed: false as const,
    fromAddress: verified.fromAddress ?? null,
  };
}
