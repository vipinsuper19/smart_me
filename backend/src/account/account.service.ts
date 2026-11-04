import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AccountDeletionRequest, Prisma } from '../generated/prisma/client';
import {
  DeletionRequestStatus,
  SessionRevocationReason,
  UserStatus,
} from '../generated/prisma/enums';
import { ApiException } from '../common/errors/api-error';
import { isPrismaErrorWithCode } from '../common/prisma/prisma-errors';
import { addDays } from '../common/utils/duration';
import { PrismaService } from '../prisma/prisma.service';

export interface DeletionRequestView {
  id: string;
  status: DeletionRequestStatus;
  reason: string | null;
  requestedAt: Date;
  scheduledFor: Date;
  completedAt: Date | null;
  canceledAt: Date | null;
  retentionNotice: string;
}

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async requestDeletion(userId: string, reason?: string): Promise<DeletionRequestView> {
    const existing = await this.pendingRequest(userId);
    if (existing) {
      await this.revokeAllSessions(userId);
      return this.toView(existing);
    }

    const now = new Date();
    const graceDays = this.config.getOrThrow<number>('ACCOUNT_DELETION_GRACE_DAYS');
    const scheduledFor = addDays(now, graceDays);

    try {
      const request = await this.prisma.$transaction(async (tx) => {
        const created = await tx.accountDeletionRequest.create({
          data: {
            userId,
            reason: reason?.trim() || null,
            scheduledFor,
          },
        });

        // Sign the learner out everywhere immediately. Access tokens are also
        // rejected because the guard checks the session row.
        await tx.session.updateMany({
          where: { userId, revokedAt: null },
          data: {
            revokedAt: now,
            revokedReason: SessionRevocationReason.ACCOUNT_DELETED,
          },
        });

        return created;
      });

      return this.toView(request);
    } catch (error) {
      if (isPrismaErrorWithCode(error, 'P2002')) {
        const pending = await this.pendingRequest(userId);
        if (pending) {
          return this.toView(pending);
        }
      }
      throw error;
    }
  }

  /**
   * Executes every deletion request whose grace period has elapsed.
   *
   * Each request is claimed inside a transaction before any data is touched, so
   * overlapping scheduler ticks or multiple API instances cannot process the
   * same learner twice. The learner row is anonymised rather than hard-deleted:
   * billing and audit records that legally must be retained keep a stable
   * foreign key, while every direct identifier is removed.
   */
  async processDueDeletions(now = new Date()): Promise<number> {
    const due = await this.prisma.accountDeletionRequest.findMany({
      where: {
        status: DeletionRequestStatus.PENDING,
        scheduledFor: { lte: now },
      },
      orderBy: { scheduledFor: 'asc' },
      take: 100,
      select: { id: true, userId: true },
    });

    let completed = 0;

    for (const request of due) {
      const didComplete = await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.accountDeletionRequest.updateMany({
          where: { id: request.id, status: DeletionRequestStatus.PENDING },
          data: {
            status: DeletionRequestStatus.COMPLETED,
            completedAt: now,
          },
        });

        if (claimed.count !== 1) {
          return false;
        }

        await this.scrubUser(tx, request.userId, now);
        return true;
      });

      if (didComplete) {
        completed += 1;
      }
    }

    return completed;
  }

  async getStatus(userId: string): Promise<DeletionRequestView | null> {
    const request = await this.prisma.accountDeletionRequest.findFirst({
      where: { userId },
      orderBy: { requestedAt: 'desc' },
    });

    return request ? this.toView(request) : null;
  }

  async cancel(userId: string): Promise<DeletionRequestView> {
    const canceled = await this.prisma.accountDeletionRequest.updateMany({
      where: { userId, status: DeletionRequestStatus.PENDING },
      data: {
        status: DeletionRequestStatus.CANCELED,
        canceledAt: new Date(),
      },
    });

    if (canceled.count === 0) {
      throw new ApiException(
        'NO_PENDING_DELETION_REQUEST',
        'There is no pending account deletion request.',
        404,
      );
    }

    const request = await this.prisma.accountDeletionRequest.findFirst({
      where: { userId, status: DeletionRequestStatus.CANCELED },
      orderBy: { canceledAt: 'desc' },
    });

    if (!request) {
      throw new ApiException(
        'NO_PENDING_DELETION_REQUEST',
        'There is no pending account deletion request.',
        404,
      );
    }

    return this.toView(request);
  }

  private pendingRequest(userId: string): Promise<AccountDeletionRequest | null> {
    return this.prisma.accountDeletionRequest.findFirst({
      where: { userId, status: DeletionRequestStatus.PENDING },
      orderBy: { requestedAt: 'desc' },
    });
  }

  private async revokeAllSessions(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: {
        revokedAt: new Date(),
        revokedReason: SessionRevocationReason.ACCOUNT_DELETED,
      },
    });
  }

  /**
   * Removes direct identifiers while keeping the row and its legal/financial
   * relations intact. The unique email is replaced with a tombstone so the
   * original address can be registered again.
   */
  private async scrubUser(tx: Prisma.TransactionClient, userId: string, now: Date): Promise<void> {
    await tx.session.updateMany({
      where: { userId, revokedAt: null },
      data: {
        revokedAt: now,
        revokedReason: SessionRevocationReason.ACCOUNT_DELETED,
      },
    });

    await tx.deviceToken.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });

    await tx.userIdentity.deleteMany({ where: { userId } });

    await tx.userProfile.updateMany({
      where: { userId },
      data: {
        headline: null,
        occupation: null,
        city: null,
        bio: null,
        dateOfBirth: null,
      },
    });

    await tx.userPreference.updateMany({
      where: { userId },
      data: { interests: [] },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.DELETED,
        email: `deleted-${userId}@deleted.invalid`,
        emailVerifiedAt: null,
        passwordHash: null,
        name: null,
        avatarUrl: null,
        onboardingCompletedAt: null,
        lastActiveAt: null,
      },
    });
  }

  private toView(request: AccountDeletionRequest): DeletionRequestView {
    const deletionDate = request.scheduledFor.toISOString().slice(0, 10);

    return {
      id: request.id,
      status: request.status,
      reason: request.reason,
      requestedAt: request.requestedAt,
      scheduledFor: request.scheduledFor,
      completedAt: request.completedAt,
      canceledAt: request.canceledAt,
      retentionNotice:
        `Your account is scheduled for deletion on ${deletionDate}. ` +
        'Records required for legal, tax, fraud-prevention or security purposes may be retained after that date.',
    };
  }
}
