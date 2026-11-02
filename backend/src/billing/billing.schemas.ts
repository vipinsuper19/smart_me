import { z } from 'zod';

/** Pub/Sub push envelope. Extra attributes are tolerated for schema drift. */
export const pubSubPushSchema = z
  .object({
    message: z
      .object({
        messageId: z.string().min(1).max(200),
        data: z
          .string()
          .min(1)
          .max(64 * 1024),
        publishTime: z.string().optional(),
        attributes: z.record(z.string(), z.string()).optional(),
      })
      .passthrough(),
    subscription: z.string().optional(),
  })
  .passthrough();

/**
 * Google Play Real-time Developer Notifications payload, after the Pub/Sub
 * `message.data` field has been base64-decoded.
 */
export const googleNotificationSchema = z
  .object({
    version: z.string().optional(),
    packageName: z.string().optional(),
    eventTimeMillis: z.string().optional(),
    subscriptionNotification: z
      .object({
        version: z.string().optional(),
        notificationType: z.number().int(),
        purchaseToken: z.string().min(1).max(4096),
        subscriptionId: z.string().min(1).max(200),
      })
      .passthrough()
      .optional(),
    voidedPurchaseNotification: z
      .object({
        purchaseToken: z.string().min(1).max(4096),
        orderId: z.string().max(200).optional(),
        productType: z.number().int().optional(),
        refundType: z.number().int().optional(),
      })
      .passthrough()
      .optional(),
    testNotification: z
      .object({
        version: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type PubSubPush = z.infer<typeof pubSubPushSchema>;
export type GoogleNotification = z.infer<typeof googleNotificationSchema>;
