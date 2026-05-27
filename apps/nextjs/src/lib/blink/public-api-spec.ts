import { BUILDER_ADDRESS } from "./builder";

const addressPattern = "^0x[0-9a-fA-F]{40}$";

const addressSchema = {
  type: "string",
  pattern: addressPattern,
  example: BUILDER_ADDRESS,
};

const errorSchema = {
  type: "object",
  properties: {
    error: { type: "string" },
  },
  required: ["error"],
};

const healthCheckSchema = {
  type: "object",
  properties: {
    detail: { type: "string" },
    durationMs: { type: "number" },
    status: {
      type: "string",
      enum: ["ok", "error"],
    },
  },
  required: ["durationMs", "status"],
};

const isoDateTimeSchema = {
  type: "string",
  format: "date-time",
};

const addressParameter = {
  in: "query",
  name: "address",
  required: true,
  schema: addressSchema,
};

const walletParameter = {
  in: "query",
  name: "wallet",
  required: true,
  schema: addressSchema,
};

const marketParameter = {
  in: "query",
  name: "market",
  required: false,
  schema: {
    type: "string",
    minLength: 2,
    maxLength: 16,
    examples: ["BTC", "ETH"],
  },
};

function jsonResponse(schema: Record<string, unknown>, example?: unknown) {
  return {
    description: "Successful response",
    content: {
      "application/json": {
        schema,
        ...(example ? { examples: { default: { value: example } } } : {}),
      },
    },
  };
}

function errorResponse(
  description: string,
  example: string,
  statusCode?: number,
) {
  return {
    description,
    content: {
      "application/json": {
        schema: errorSchema,
        examples: {
          [statusCode ? `status${statusCode}` : "default"]: {
            value: { error: example },
          },
        },
      },
    },
  };
}

export function buildPublicApiSpec(origin: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Blink Public API",
      version: "1.0.0",
      description:
        "Read-only Blink endpoints for public integrations, status checks, referral lookups, and builder fee discovery. Authenticated and internal app routes are intentionally excluded from this surface.",
    },
    servers: [
      {
        url: origin,
        description: "Current deployment",
      },
    ],
    tags: [
      {
        name: "System",
        description: "Deployment and uptime metadata.",
      },
      {
        name: "Trading",
        description: "Public trading-related configuration and fee discovery.",
      },
      {
        name: "Referrals",
        description: "Public referral-program lookup endpoints.",
      },
    ],
    paths: {
      "/api/health": {
        get: {
          tags: ["System"],
          summary: "Check Blink service health",
          operationId: "getHealth",
          description:
            "Returns the current public health state for Blink and its core dependencies.",
          responses: {
            200: jsonResponse(
              {
                type: "object",
                properties: {
                  checkedAt: isoDateTimeSchema,
                  status: {
                    type: "string",
                    enum: ["ok", "degraded", "outage"],
                  },
                  version: {
                    type: "object",
                    properties: {
                      sha: { type: "string", example: "b23f87b" },
                    },
                    required: ["sha"],
                  },
                  checks: {
                    type: "object",
                    properties: {
                      neonDatabase: healthCheckSchema,
                      hyperliquidRest: healthCheckSchema,
                      hyperliquidWebSocket: healthCheckSchema,
                      blinkApi: healthCheckSchema,
                    },
                    required: [
                      "neonDatabase",
                      "hyperliquidRest",
                      "hyperliquidWebSocket",
                      "blinkApi",
                    ],
                  },
                },
                required: ["checkedAt", "status", "version", "checks"],
              },
              {
                checkedAt: "2026-05-25T21:21:43.176Z",
                status: "ok",
                version: { sha: "b23f87b" },
                checks: {
                  neonDatabase: {
                    durationMs: 33,
                    status: "ok",
                    detail: "Neon reachable",
                  },
                  hyperliquidRest: {
                    durationMs: 48,
                    status: "ok",
                    detail: "REST ok · BTC 97234.5",
                  },
                  hyperliquidWebSocket: {
                    durationMs: 210,
                    status: "ok",
                    detail: "WebSocket stream ok",
                  },
                  blinkApi: {
                    durationMs: 19,
                    status: "ok",
                    detail: "builder-fee 10u · pro=no",
                  },
                },
              },
            ),
          },
        },
      },
      "/api/version": {
        get: {
          tags: ["System"],
          summary: "Get deployed version",
          operationId: "getVersion",
          description:
            "Returns the short commit SHA for the current deployment.",
          responses: {
            200: jsonResponse(
              {
                type: "object",
                properties: {
                  sha: { type: "string", example: "b23f87b" },
                },
                required: ["sha"],
              },
              { sha: "b23f87b" },
            ),
          },
        },
      },
      "/api/builder/fee": {
        get: {
          tags: ["Trading"],
          summary: "Resolve Blink builder fee units",
          operationId: "getBuilderFee",
          description:
            "Returns the effective builder fee units Blink applies for a wallet, optionally scoped to a market.",
          parameters: [walletParameter, marketParameter],
          responses: {
            200: jsonResponse(
              {
                type: "object",
                properties: {
                  wallet: addressSchema,
                  market: {
                    anyOf: [{ type: "string" }, { type: "null" }],
                  },
                  feeUnits: { type: "number" },
                  isPro: { type: "boolean" },
                },
                required: ["wallet", "market", "feeUnits", "isPro"],
              },
              {
                wallet: BUILDER_ADDRESS,
                market: "BTC",
                feeUnits: 10,
                isPro: true,
              },
            ),
            400: errorResponse(
              "Invalid request parameters",
              "Invalid wallet address",
              400,
            ),
          },
        },
      },
      "/api/referrals": {
        get: {
          tags: ["Referrals"],
          summary: "Get outbound referrals for a wallet",
          operationId: "getReferrals",
          description:
            "Returns a wallet's referral code and the wallets it has referred.",
          parameters: [addressParameter],
          responses: {
            200: jsonResponse(
              {
                type: "object",
                properties: {
                  code: {
                    anyOf: [{ type: "string" }, { type: "null" }],
                  },
                  referrals: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        address: addressSchema,
                        joinedAt: isoDateTimeSchema,
                      },
                      required: ["address", "joinedAt"],
                    },
                  },
                  count: { type: "number" },
                },
                required: ["code", "referrals", "count"],
              },
              {
                code: "rokitg",
                referrals: [
                  {
                    address: "0x1111111111111111111111111111111111111111",
                    joinedAt: "2026-05-25T20:08:11.084Z",
                  },
                ],
                count: 1,
              },
            ),
            400: errorResponse("Missing address query", "Missing address", 400),
          },
        },
      },
      "/api/referrals/lookup": {
        get: {
          tags: ["Referrals"],
          summary: "Inspect a wallet's referral relationships",
          operationId: "lookupReferralRecord",
          description:
            "Returns a wallet's inbound referrer, its own referral code, and the wallets it has referred.",
          parameters: [addressParameter],
          responses: {
            200: jsonResponse(
              {
                type: "object",
                properties: {
                  address: addressSchema,
                  referredBy: {
                    anyOf: [
                      {
                        type: "object",
                        properties: {
                          referrerAddress: addressSchema,
                          code: { type: "string" },
                          claimedAt: isoDateTimeSchema,
                        },
                        required: ["referrerAddress", "code", "claimedAt"],
                      },
                      { type: "null" },
                    ],
                  },
                  referralCode: {
                    anyOf: [{ type: "string" }, { type: "null" }],
                  },
                  referred: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        address: addressSchema,
                        code: { type: "string" },
                        joinedAt: isoDateTimeSchema,
                      },
                      required: ["address", "code", "joinedAt"],
                    },
                  },
                  referredCount: { type: "number" },
                },
                required: [
                  "address",
                  "referredBy",
                  "referralCode",
                  "referred",
                  "referredCount",
                ],
              },
              {
                address: BUILDER_ADDRESS,
                referredBy: null,
                referralCode: "rokitg",
                referred: [
                  {
                    address: "0x1111111111111111111111111111111111111111",
                    code: "rokitg",
                    joinedAt: "2026-05-25T20:08:11.084Z",
                  },
                ],
                referredCount: 1,
              },
            ),
            400: errorResponse("Missing address query", "Missing address", 400),
          },
        },
      },
    },
  };
}
