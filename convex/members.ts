import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

async function identityOrThrow(ctx: { auth: { getUserIdentity: () => Promise<{ subject: string; email?: string } | null> } }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("UNAUTHENTICATED");
  return identity;
}

export const current = query({
  args: {},
  handler: async (ctx) => {
    const identity = await identityOrThrow(ctx);
    return await ctx.db.query("members").withIndex("by_clerk_subject", (q) => q.eq("clerkSubject", identity.subject)).unique();
  },
});

export const acceptInvitation = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await identityOrThrow(ctx);
    const email = identity.email?.toLowerCase();
    if (!email) throw new Error("IDENTITY_EMAIL_REQUIRED");
    const existing = await ctx.db.query("members").withIndex("by_clerk_subject", (q) => q.eq("clerkSubject", identity.subject)).unique();
    if (existing) return existing._id;
    const invitation = await ctx.db.query("invitations").withIndex("by_email_status", (q) => q.eq("email", email).eq("status", "PENDING")).first();
    if (!invitation || invitation.expiresAt <= Date.now()) throw new Error("INVITATION_REQUIRED");
    const memberId = await ctx.db.insert("members", { clerkSubject: identity.subject, email, status: "ACTIVE", role: invitation.role, createdAt: Date.now() });
    await ctx.db.patch(invitation._id, { status: "ACCEPTED" });
    await ctx.db.insert("auditEvents", { actorSubject: identity.subject, action: "INVITATION_ACCEPTED", targetType: "INVITATION", outcome: "SUCCESS", createdAt: Date.now() });
    return memberId;
  },
});
