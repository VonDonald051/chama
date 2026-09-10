import { prisma } from '@chama/database';

export const RoleCode = {
  OWNER: 'OWNER',
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  GROUP_ADMIN: 'GROUP_ADMIN',
  MEMBER: 'MEMBER',
} as const;

export type Principal = {
  userId: string;
  sessionId: string;
  roles: string[];
  mfaComplete: boolean;
};

export function hasRole(principal: Principal, role: string): boolean {
  return principal.roles.includes(role);
}

export function isPrivileged(principal: Principal): boolean {
  return principal.roles.some((role) => [RoleCode.OWNER, RoleCode.SUPER_ADMIN, RoleCode.ADMIN, RoleCode.GROUP_ADMIN].includes(role as never));
}

export function mayReadOwnOrGroupMember(principal: Principal, targetUserId: string, targetGroupId?: string): Promise<boolean> {
  if (principal.userId === targetUserId) return Promise.resolve(true);
  if (hasRole(principal, RoleCode.OWNER)) return Promise.resolve(true);
  if (!targetGroupId || hasRole(principal, RoleCode.MEMBER)) return Promise.resolve(false);

  return prisma.groupAdminAssignment
    .count({
      where: {
        userId: principal.userId,
        groupId: targetGroupId,
        active: true,
      },
    })
    .then((count) => count > 0);
}

export async function assertGroupAssignment(principal: Principal, groupId: string): Promise<void> {
  if (hasRole(principal, RoleCode.OWNER)) return;
  const authorized = await prisma.groupAdminAssignment.findFirst({
    where: { userId: principal.userId, groupId, active: true },
    select: { id: true },
  });
  if (!authorized) throw new Error('FORBIDDEN_SCOPE');
}

/** ADMIN is deliberately absent from all mutation policy helpers. */
export function assertCanMutateSavings(principal: Principal): void {
  if (hasRole(principal, RoleCode.ADMIN) || hasRole(principal, RoleCode.MEMBER)) {
    throw new Error('FORBIDDEN_ACTION');
  }
  if (!hasRole(principal, RoleCode.OWNER) && !hasRole(principal, RoleCode.GROUP_ADMIN)) {
    throw new Error('FORBIDDEN_ACTION');
  }
}
