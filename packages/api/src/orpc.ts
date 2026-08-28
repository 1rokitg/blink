import { os } from "@orpc/server";
import { z } from "zod";



export const rpc = os
  .$context<{  }>()
  .errors({
    // common errors
    UNAUTHORIZED: {},
    RATE_LIMITED: {
      data: z.object({
        retryAfter: z.number(),
      }),
    },
  });

export const protectedProcedure = rpc.use(({ context, next, errors }) => {
  return next({
    context: {
      ...context,
      session: "123",
    },
  });
});
