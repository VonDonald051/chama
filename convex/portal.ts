import { query } from "./_generated/server";

export const getConfiguration = query({
  args: {},
  handler: async (ctx) => {
    const configuration = await ctx.db.query("systemConfiguration").first();
    return { systemName: configuration?.systemName ?? "Secure Chama Portal" };
  },
});
