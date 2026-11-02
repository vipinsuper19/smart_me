import { AccessTier } from '../generated/prisma/enums';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Premium access is authoritative from `Entitlement`: an active PREMIUM tier
 * that has not expired. Content and quiz reads share this check so a learner
 * cannot be gated differently by two endpoints.
 */
export async function hasPremiumAccess(prisma: PrismaService, userId: string): Promise<boolean> {
  const entitlement = await prisma.entitlement.findUnique({
    where: { userId },
    select: { tier: true, isActive: true, validUntil: true },
  });

  return Boolean(
    entitlement?.tier === AccessTier.PREMIUM &&
    entitlement.isActive &&
    (entitlement.validUntil === null || entitlement.validUntil > new Date()),
  );
}
