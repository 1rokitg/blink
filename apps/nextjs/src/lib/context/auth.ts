/**
 * Sign-in Dialog State Machine using XState v5
 *
 * This state machine handles all possible navigation cases for the animated sign-in dialog,
 * including error states, loading states, and complex user flows.
 */

import { createBrowserInspector } from "@statelyai/inspect";
import { assign, setup, fromPromise, createActor } from "xstate";

// Types
export type SignInMethod = "email" | "phone" | "passkey" | "wallet";

export interface SignInContext {
  selectedMethod?: SignInMethod;
  email?: string;
  phone?: string;
  wallet?: string;
  error?: string;
  verificationCode?: string;
  isVerifying: boolean;
}

export type SignInEvent =
  | { type: "SELECT_METHOD"; method: SignInMethod }
  | { type: "GO_BACK" }
  | { type: "SUBMIT_EMAIL"; email: string }
  | { type: "SUBMIT_PHONE"; phone: string }
  | { type: "SUBMIT_PASSKEY" }
  | { type: "CONNECT_WALLET"; wallet: string }
  | { type: "VERIFY_EMAIL"; code: string }
  | { type: "VERIFY_PHONE"; code: string }
  | { type: "SUCCESS" }
  | { type: "ERROR"; error: string }
  | { type: "RETRY" }
  | { type: "CLOSE" }
  | { type: "RESET" };

// State Machine using XState v5 setup syntax
export const authModalMachine = setup({
  types: {
    context: {} as SignInContext,
    events: {} as SignInEvent,
  },
  guards: {
    isEmailMethod: ({ event }) =>
      event.type === "SELECT_METHOD" && event.method === "email",
    isPhoneMethod: ({ event }) =>
      event.type === "SELECT_METHOD" && event.method === "phone",
    isPasskeyMethod: ({ event }) =>
      event.type === "SELECT_METHOD" && event.method === "passkey",
    isWalletMethod: ({ event }) =>
      event.type === "SELECT_METHOD" && event.method === "wallet",
  },
  actors: {
    processEmailAuth: fromPromise(
      async ({ input }: { input: { email: string } }) => {
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return { type: "VERIFY_EMAIL", code: "123456" };
      },
    ),

    processPhoneAuth: fromPromise(
      async ({ input }: { input: { phone: string } }) => {
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return { type: "VERIFY_PHONE", code: "123456" };
      },
    ),

    processPasskeyAuth: fromPromise(async () => {
      // Simulate passkey authentication
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return { type: "SUCCESS" };
    }),

    processWalletAuth: fromPromise(
      async ({ input }: { input: { wallet: string } }) => {
        // Simulate wallet connection
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return { type: "SUCCESS" };
      },
    ),

    verifyEmailCode: fromPromise(
      async ({ input }: { input: { code: string } }) => {
        // Simulate verification
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return { type: "SUCCESS" };
      },
    ),

    verifyPhoneCode: fromPromise(
      async ({ input }: { input: { code: string } }) => {
        // Simulate verification
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return { type: "SUCCESS" };
      },
    ),
  },
}).createMachine({
  id: "signInDialog",
  initial: "default",
  context: {
    selectedMethod: undefined,
    email: undefined,
    phone: undefined,
    wallet: undefined,
    error: undefined,
    verificationCode: undefined,
    isVerifying: false,
  },

  states: {
    default: {
      on: {
        SELECT_METHOD: [
          {
            target: "emailInput",
            guard: "isEmailMethod",
            actions: assign({
              selectedMethod: ({ event }) => {
                if (event.type === "SELECT_METHOD") {
                  return event.method;
                }
                return undefined;
              },
            }),
          },
          {
            target: "phoneInput",
            guard: "isPhoneMethod",
            actions: assign({
              selectedMethod: ({ event }) => {
                if (event.type === "SELECT_METHOD") {
                  return event.method;
                }
                return undefined;
              },
            }),
          },
          {
            target: "passkeyAuth",
            guard: "isPasskeyMethod",
            actions: assign({
              selectedMethod: ({ event }) => {
                if (event.type === "SELECT_METHOD") {
                  return event.method;
                }
                return undefined;
              },
            }),
          },
          {
            target: "walletConnection",
            guard: "isWalletMethod",
            actions: assign({
              selectedMethod: ({ event }) => {
                if (event.type === "SELECT_METHOD") {
                  return event.method;
                }
                return undefined;
              },
            }),
          },
        ],
        GO_BACK: "default",
        CLOSE: "default",
      },
    },

    emailInput: {
      on: {
        SUBMIT_EMAIL: {
          target: "processingEmail",
          actions: assign({
            email: ({ event }) => {
              if (event.type === "SUBMIT_EMAIL") {
                return event.email;
              }
              return undefined;
            },
          }),
        },
        GO_BACK: "default",
        CLOSE: "default",
      },
    },

    phoneInput: {
      on: {
        SUBMIT_PHONE: {
          target: "processingPhone",
          actions: assign({
            phone: ({ event }) => {
              if (event.type === "SUBMIT_PHONE") {
                return event.phone;
              }
              return undefined;
            },
          }),
        },
        GO_BACK: "default",
        CLOSE: "default",
      },
    },

    passkeyAuth: {
      on: {
        SUBMIT_PASSKEY: {
          target: "processingPasskey",
        },
        GO_BACK: "default",
        CLOSE: "default",
      },
    },

    walletConnection: {
      on: {
        CONNECT_WALLET: {
          target: "processingWallet",
          actions: assign({
            wallet: ({ event }) => {
              if (event.type === "CONNECT_WALLET") {
                return event.wallet;
              }
              return undefined;
            },
          }),
        },
        GO_BACK: "default",
        CLOSE: "default",
      },
    },

    processingEmail: {
      invoke: {
        id: "processEmailAuth",
        src: "processEmailAuth",
        input: ({ context }) => ({ email: context.email || "" }),
        onDone: {
          target: "emailVerification",
          actions: assign({
            verificationCode: ({ event }) => {
              if (event.output && "code" in event.output) {
                return event.output.code;
              }
              return undefined;
            },
          }),
        },
        onError: {
          target: "error",
          actions: assign({
            error: ({ event }) =>
              (event.error as Error)?.message || "Email processing failed",
          }),
        },
      },
    },

    processingPhone: {
      invoke: {
        id: "processPhoneAuth",
        src: "processPhoneAuth",
        input: ({ context }) => ({ phone: context.phone || "" }),
        onDone: {
          target: "phoneVerification",
          actions: assign({
            verificationCode: ({ event }) => {
              if (event.output && "code" in event.output) {
                return event.output.code;
              }
              return undefined;
            },
          }),
        },
        onError: {
          target: "error",
          actions: assign({
            error: ({ event }) =>
              (event.error as Error)?.message || "Phone processing failed",
          }),
        },
      },
    },

    processingPasskey: {
      invoke: {
        id: "processPasskeyAuth",
        src: "processPasskeyAuth",
        onDone: {
          target: "success",
        },
        onError: {
          target: "error",
          actions: assign({
            error: ({ event }) =>
              (event.error as Error)?.message ||
              "Passkey authentication failed",
          }),
        },
      },
    },

    processingWallet: {
      invoke: {
        id: "processWalletAuth",
        src: "processWalletAuth",
        input: ({ context }) => ({ wallet: context.wallet || "" }),
        onDone: {
          target: "success",
        },
        onError: {
          target: "error",
          actions: assign({
            error: ({ event }) =>
              (event.error as Error)?.message || "Wallet connection failed",
          }),
        },
      },
    },

    emailVerification: {
      on: {
        VERIFY_EMAIL: {
          target: "verifyingEmail",
          actions: assign({
            verificationCode: ({ event }) => {
              if (event.type === "VERIFY_EMAIL") {
                return event.code;
              }
              return undefined;
            },
          }),
        },
        GO_BACK: "emailInput",
        RETRY: "emailInput",
        CLOSE: "default",
      },
    },

    phoneVerification: {
      on: {
        VERIFY_PHONE: {
          target: "verifyingPhone",
          actions: assign({
            verificationCode: ({ event }) => {
              if (event.type === "VERIFY_PHONE") {
                return event.code;
              }
              return undefined;
            },
          }),
        },
        GO_BACK: "phoneInput",
        RETRY: "phoneInput",
        CLOSE: "default",
      },
    },

    verifyingEmail: {
      invoke: {
        id: "verifyEmailCode",
        src: "verifyEmailCode",
        input: ({ context }) => ({ code: context.verificationCode || "" }),
        onDone: {
          target: "success",
        },
        onError: {
          target: "error",
          actions: assign({
            error: ({ event }) =>
              (event.error as Error)?.message || "Email verification failed",
          }),
        },
      },
    },

    verifyingPhone: {
      invoke: {
        id: "verifyPhoneCode",
        src: "verifyPhoneCode",
        input: ({ context }) => ({ code: context.verificationCode || "" }),
        onDone: {
          target: "success",
        },
        onError: {
          target: "error",
          actions: assign({
            error: ({ event }) =>
              (event.error as Error)?.message || "Phone verification failed",
          }),
        },
      },
    },

    success: {
      on: {
        RESET: "default",
        CLOSE: "default",
      },
    },

    error: {
      on: {
        RETRY: [
          {
            target: "emailInput",
            guard: ({ context }) => context.selectedMethod === "email",
          },
          {
            target: "phoneInput",
            guard: ({ context }) => context.selectedMethod === "phone",
          },
          {
            target: "passkeyAuth",
            guard: ({ context }) => context.selectedMethod === "passkey",
          },
          {
            target: "walletConnection",
            guard: ({ context }) => context.selectedMethod === "wallet",
          },
        ],
        GO_BACK: "default",
        CLOSE: "default",
        RESET: {
          target: "default",
          actions: assign({
            selectedMethod: undefined,
            email: undefined,
            phone: undefined,
            wallet: undefined,
            error: undefined,
            verificationCode: undefined,
            isVerifying: false,
          }),
        },
      },
    },
  },
});

const { inspect } = createBrowserInspector();

export const authModalState = createActor(authModalMachine, {
  inspect,
});
authModalState.start();

export type AuthModalMachine = typeof authModalMachine;
