import { z } from "zod";

const EVM_ADDRESS = /^0x[0-9a-f]{40}$/;

function normalizeActingWallet(value: unknown): string {
  if (typeof value !== "string") return "";
  const wallet = value.trim().toLowerCase();
  return EVM_ADDRESS.test(wallet) ? wallet : "";
}

function normalizeIdentityEmails(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const emails = value
    .filter((item): item is string => typeof item === "string")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0 && z.string().email().safeParse(email).success);

  return emails.length > 0 ? emails : undefined;
}

/** Shared server-action input for internal read tools (wallet and/or Privy email). */
export const internalReadActionInputSchema = z
  .object({
    actingWalletAddress: z.preprocess(normalizeActingWallet, z.string()),
    emailAddresses: z.preprocess(
      normalizeIdentityEmails,
      z.array(z.string().email()).optional(),
    ),
  })
  .refine(
    (data) =>
      data.actingWalletAddress.length > 0 ||
      (data.emailAddresses?.length ?? 0) > 0,
    { message: "Connect a wallet or sign in with an approved team email." },
  );

export type InternalReadActionInput = z.infer<
  typeof internalReadActionInputSchema
>;
