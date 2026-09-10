/*
 * Controlled bootstrap utility. Run once from a secure operator terminal after
 * migrations. It creates no usable password and prints a one-time activation
 * token only to stdout; deliver it using an approved secure channel.
 */
import { prisma } from '@chama/database';
import { randomToken, sha256 } from '../src/lib/security.js';

const [emailArg, systemNameArg] = process.argv.slice(2);
if (!emailArg) throw new Error('Usage: tsx scripts/create-owner-invitation.ts owner@example.com "System Name"');
const emailNormalized = emailArg.trim().toLowerCase();
const systemName = systemNameArg?.trim() || 'Chama Platform';
const token = randomToken(32);

const result = await prisma.$transaction(async (tx) => {
  const ownerRole = await tx.role.upsert({ where: { code: 'OWNER' }, update: {}, create: { code: 'OWNER', description: 'Highest-level system owner' } });
  const existingOwner = await tx.user.count({ where: { roles: { some: { roleId: ownerRole.id } }, status: { in: ['INVITED', 'ACTIVE', 'SUSPENDED', 'LOCKED'] } } });
  if (existingOwner !== 0) throw new Error('OWNER_ALREADY_EXISTS');
  await tx.systemConfiguration.upsert({ where: { id: 'global' }, update: {}, create: { id: 'global', systemName } });
  const owner = await tx.user.create({ data: { emailNormalized, status: 'INVITED', forcePasswordChange: true, roles: { create: { roleId: ownerRole.id } } } });
  const invitation = await tx.invitation.create({ data: { userId: owner.id, createdById: owner.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 24 * 60 * 60_000) } });
  return { ownerId: owner.id, invitationId: invitation.id };
});

console.log(JSON.stringify({ message: 'Deliver this activation token through an approved secure channel. It will not be displayed again.', ownerId: result.ownerId, invitationId: result.invitationId, activationToken: token }, null, 2));
await prisma.$disconnect();
