import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  systemConfiguration: defineTable({
    key: v.literal("global"),
    systemName: v.string(),
    registrationFeeKes: v.number(),
    maxActiveMembersPerGroup: v.number(),
    updatedAt: v.number(),
  }),
  members: defineTable({
    clerkSubject: v.string(),
    email: v.optional(v.string()),
    status: v.union(v.literal("INVITED"), v.literal("ACTIVE"), v.literal("SUSPENDED")),
    role: v.union(v.literal("OWNER"), v.literal("ADMIN"), v.literal("MEMBER")),
    createdAt: v.number(),
  }).index("by_clerk_subject", ["clerkSubject"]),
  invitations: defineTable({
    email: v.string(),
    role: v.union(v.literal("OWNER"), v.literal("ADMIN"), v.literal("MEMBER")),
    status: v.union(v.literal("PENDING"), v.literal("ACCEPTED"), v.literal("REVOKED"), v.literal("EXPIRED")),
    expiresAt: v.number(),
    createdAt: v.number(),
  }).index("by_email_status", ["email", "status"]),
  groups: defineTable({
    name: v.string(),
    status: v.union(v.literal("DRAFT"), v.literal("ACTIVE"), v.literal("SUSPENDED")),
    createdAt: v.number(),
  }),
  memberships: defineTable({
    groupId: v.id("groups"),
    memberId: v.id("members"),
    status: v.union(v.literal("ACTIVE"), v.literal("LEFT"), v.literal("SUSPENDED")),
  }).index("by_member_group", ["memberId", "groupId"]),
  savingsEntries: defineTable({
    groupId: v.id("groups"),
    memberId: v.id("members"),
    amountKes: v.number(),
    contributionWeek: v.number(),
    reference: v.string(),
    status: v.union(v.literal("POSTED"), v.literal("REVERSED")),
    createdAt: v.number(),
  }).index("by_member_group", ["memberId", "groupId"]),
  auditEvents: defineTable({
    actorSubject: v.optional(v.string()),
    action: v.string(),
    targetType: v.string(),
    outcome: v.union(v.literal("SUCCESS"), v.literal("FAILURE")),
    createdAt: v.number(),
  }).index("by_created_at", ["createdAt"]),
});
