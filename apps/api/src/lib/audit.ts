import { createHash } from 'node:crypto';
import { Prisma, prisma } from '@chama/database';

export type AuditInput = {
  actorUserId?: string;
  actorRoleSnapshot?: string;
  action: string;
  targetType: string;
  targetId?: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'DENIED';
  requestId?: string;
  sourceIpHash?: string;
  beforeJson?: Record<string, unknown>;
  afterJson?: Record<string, unknown>;
  reason?: string;
};

/**
 * Append-only audit writer. Database permissions must deny UPDATE/DELETE to the
 * application role. A production implementation serializes the chain anchor in
 * a dedicated restricted table / WORM export transaction.
 */
export async function appendAudit(input: AuditInput): Promise<void> {
  const previous = await prisma.auditLog.findFirst({
    orderBy: { occurredAt: 'desc' },
    select: { entryHash: true },
  });
  const occurredAt = new Date();
  const canonical = JSON.stringify({
    previousHash: previous?.entryHash ?? null,
    actorUserId: input.actorUserId ?? null,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId ?? null,
    outcome: input.outcome,
    requestId: input.requestId ?? null,
    occurredAt: occurredAt.toISOString(),
  });
  const entryHash = createHash('sha256').update(canonical).digest('hex');
  const data: Prisma.AuditLogUncheckedCreateInput = {
    actorUserId: input.actorUserId,
    actorRoleSnapshot: input.actorRoleSnapshot,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    outcome: input.outcome,
    requestId: input.requestId,
    sourceIpHash: input.sourceIpHash,
    beforeJson: input.beforeJson as Prisma.InputJsonValue | undefined,
    afterJson: input.afterJson as Prisma.InputJsonValue | undefined,
    reason: input.reason,
    previousHash: previous?.entryHash,
    entryHash,
    occurredAt,
  };
  await prisma.auditLog.create({ data });
}
