import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@chama/database';
import type { AppConfig } from '../config.js';
import { appendAudit } from '../lib/audit.js';
import { assertGroupAssignment, mayReadOwnOrGroupMember, type Principal } from '../lib/policy.js';
import { privacyHash } from '../lib/security.js';
import { requireSession } from '../plugins/auth.js';

const uuid = z.string().uuid();
const groupQuery = z.object({ groupId: uuid });

function amount(value: bigint | null | undefined): string { return (value ?? 0n).toString(); }

export async function memberFinanceRoutes(app: FastifyInstance, config: AppConfig): Promise<void> {
  app.get('/api/v1/members/me/savings', async (request, reply) => {
    await requireSession(request, reply, config);
    if (!request.principal) return;
    const parsed = groupQuery.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_REQUEST', requestId: request.id });

    const profile = await prisma.memberProfile.findUnique({ where: { userId: request.principal.userId }, select: { id: true } });
    if (!profile) return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', requestId: request.id });
    return savingsFor(profile.id, parsed.data.groupId, request.principal, request, reply, config);
  });

  app.get('/api/v1/members/:memberId/savings', async (request, reply) => {
    await requireSession(request, reply, config);
    if (!request.principal) return;
    const params = z.object({ memberId: uuid }).safeParse(request.params);
    const query = groupQuery.safeParse(request.query);
    if (!params.success || !query.success) return reply.code(400).send({ error: 'INVALID_REQUEST', requestId: request.id });
    return savingsFor(params.data.memberId, query.data.groupId, request.principal, request, reply, config);
  });

  app.get('/api/v1/groups/:groupId/summary', async (request, reply) => {
    await requireSession(request, reply, config);
    if (!request.principal) return;
    const parsed = z.object({ groupId: uuid }).safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_REQUEST', requestId: request.id });
    try {
      await assertGroupAssignment(request.principal, parsed.data.groupId);
    } catch {
      return reply.code(403).send({ error: 'FORBIDDEN', requestId: request.id });
    }
    const group = await prisma.group.findUnique({
      where: { id: parsed.data.groupId },
      include: {
        _count: { select: { memberships: { where: { status: 'ACTIVE' } } } },
        savingsAccounts: { select: { transactions: { where: { status: 'POSTED' }, select: { amountKes: true } } } },
      },
    });
    if (!group) return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', requestId: request.id });
    const policy = await prisma.systemConfiguration.findUnique({ where: { id: 'global' }, select: { maxActiveMembersPerGroup: true } });
    if (!policy) return reply.code(503).send({ error: 'SYSTEM_CONFIGURATION_UNAVAILABLE', requestId: request.id });
    const totalSavings = group.savingsAccounts.reduce((total, account) => total + account.transactions.reduce((subtotal, transaction) => subtotal + transaction.amountKes, 0n), 0n);
    return reply.send({ id: group.id, name: group.name, status: group.status, activeMemberCount: group._count.memberships, memberCapacity: policy.maxActiveMembersPerGroup, totalSavingsKes: amount(totalSavings) });
  });
}

async function savingsFor(
  memberProfileId: string,
  groupId: string,
  principal: Principal,
  request: { id: string; ip: string },
  reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown }; send: (payload: unknown) => unknown },
  config: AppConfig,
) {
  const account = await prisma.savingsAccount.findUnique({
    where: { groupId_memberProfileId: { groupId, memberProfileId } },
    include: { member: { select: { userId: true } }, transactions: { where: { status: 'POSTED' }, orderBy: { contributionWeek: 'desc' }, take: 52 } },
  });
  if (!account) return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', requestId: request.id });
  if (!await mayReadOwnOrGroupMember(principal, account.member.userId, groupId)) {
    return reply.code(403).send({ error: 'FORBIDDEN', requestId: request.id });
  }
  const total = account.transactions.reduce((sum, transaction) => sum + transaction.amountKes, 0n);
  await appendAudit({ actorUserId: principal.userId, actorRoleSnapshot: principal.roles.join(','), action: 'SAVINGS_READ', targetType: 'SAVINGS_ACCOUNT', targetId: account.id, outcome: 'SUCCESS', requestId: request.id, sourceIpHash: privacyHash(request.ip, config) });
  return reply.send({ accountId: account.id, groupId, totalSavingsKes: amount(total), entries: account.transactions.map((entry) => ({ contributionWeek: entry.contributionWeek.toISOString().slice(0, 10), amountKes: amount(entry.amountKes), reference: entry.reference })) });
}
