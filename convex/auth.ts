import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "chama-salt");
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getUserFromToken(ctx: any, token: string) {
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q: any) => q.eq("token", token))
    .first();
  if (!session || session.expiresAt <= Date.now()) return null;
  const user = await ctx.db.get(session.userId);
  if (!user) return null;
  return { ...user, _id: user._id };
}

export const signup = mutation({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();
    if (existing) throw new Error("EMAIL_EXISTS");

    const passwordHash = await hashPassword(args.password);
    const userId = await ctx.db.insert("users", {
      email: args.email.toLowerCase(),
      passwordHash,
      emailVerified: false,
      role: "MEMBER",
      status: "ACTIVE",
      createdAt: Date.now(),
    });

    await ctx.db.insert("members", {
      userId,
      email: args.email.toLowerCase(),
      status: "ACTIVE",
      role: "MEMBER",
      createdAt: Date.now(),
    });

    const token = generateToken();
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    await ctx.db.insert("sessions", { token, userId, expiresAt });

    return { token, user: { userId, email: args.email.toLowerCase(), role: "MEMBER" } };
  },
});

export const login = mutation({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();
    if (!user) throw new Error("INVALID_CREDENTIALS");

    const passwordHash = await hashPassword(args.password);
    if (user.passwordHash !== passwordHash) throw new Error("INVALID_CREDENTIALS");
    if (user.status !== "ACTIVE") throw new Error("ACCOUNT_SUSPENDED");

    const token = generateToken();
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    await ctx.db.insert("sessions", { token, userId: user._id, expiresAt });

    return { token, user: { userId: user._id, email: user.email, role: user.role } };
  },
});

export const logout = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db.query("sessions").withIndex("by_token", (q) => q.eq("token", args.token)).first();
    if (session) await ctx.db.delete(session._id);
    return null;
  },
});

export const me = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserFromToken(ctx, args.token);
    if (!user) return null;
    return { userId: user._id, email: user.email, role: user.role, status: user.status };
  },
});
