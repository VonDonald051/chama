import { v } from "convex/values";
import { query, type QueryCtx } from "./_generated/server";

async function currentMember(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("UNAUTHENTICATED");
  const member = await ctx.db.query("members").withIndex("by_clerk_subject", (q) => q.eq("clerkSubject", identity.subject)).unique();
  if (!member || member.status !== "ACTIVE") throw new Error("FORBIDDEN");
  return member;
}

export const ownSavings = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const member = await currentMember(ctx);
    const membership = await ctx.db.query("memberships").withIndex("by_member_group", (q) => q.eq("memberId", member._id).eq("groupId", args.groupId)).unique();
    if (!membership || membership.status !== "ACTIVE") throw new Error("FORBIDDEN");
    const entries = await ctx.db.query("savingsEntries").withIndex("by_member_group", (q) => q.eq("memberId", member._id).eq("groupId", args.groupId)).collect();
    const posted = entries.filter((entry) => entry.status === "POSTED");
    return {
      totalSavingsKes: posted.reduce((sum, entry) => sum + entry.amountKes, 0),
      entries: posted.map((entry) => ({ contributionWeek: entry.contributionWeek, amountKes: entry.amountKes, reference: entry.reference })),
    };
  },
});
