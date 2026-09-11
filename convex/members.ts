import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

async function getUserFromToken(ctx: any, token: string) {
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q: any) => q.eq("token", token))
    .first();
  if (!session || session.expiresAt <= Date.now()) throw new Error("UNAUTHENTICATED");
  const user = await ctx.db.get(session.userId);
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

export const current = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserFromToken(ctx, args.token);
    return await ctx.db.query("members").withIndex("by_user_id", (q) => q.eq("userId", user._id)).unique();
  },
});

export const acceptInvitation = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserFromToken(ctx, args.token);
    const email = user.email?.toLowerCase();
    if (!email) throw new Error("IDENTITY_EMAIL_REQUIRED");
    const existing = await ctx.db.query("members").withIndex("by_user_id", (q) => q.eq("userId", user._id)).first();
    if (existing) return existing._id;
    const invitation = await ctx.db.query("invitations").withIndex("by_email_status", (q) => q.eq("email", email).eq("status", "PENDING")).first();
    if (!invitation || invitation.expiresAt <= Date.now()) throw new Error("INVITATION_REQUIRED");
    const memberId = await ctx.db.insert("members", { userId: user._id, email, status: "ACTIVE", role: invitation.role, createdAt: Date.now() });
    await ctx.db.patch(invitation._id, { status: "ACCEPTED" });
    await ctx.db.insert("auditEvents", { actorUserId: user._id, action: "INVITATION_ACCEPTED", targetType: "INVITATION", outcome: "SUCCESS", createdAt: Date.now() });
    return memberId;
  },
});
