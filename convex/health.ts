import { query } from "./_generated/server";

/**
 * Minimal authenticated-deployment check. This exposes no business or member
 * data, and gives clients a safe way to verify that Convex is reachable.
 */
export const status = query({
  args: {},
  handler: () => ({ status: "ok" as const }),
});
