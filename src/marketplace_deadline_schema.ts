import { z } from 'zod';

const sellerAssetSchema = z.object({
  assetId: z.string().min(1),
  kind: z.enum(['product-sheet', 'compliance-packet', 'handoff-note']),
  status: z.enum(['ready', 'missing'])
});

const buyerUpdateSchema = z.object({
  buyerId: z.string().min(1),
  acknowledgedAt: z.string().datetime().nullable(),
  shippingWindowConfirmed: z.boolean()
});

const orderHandoffSchema = z.object({
  warehouseReady: z.boolean(),
  carrierBooked: z.boolean()
});

export const marketplaceDeadlineRequestSchema = z.object({
  orderId: z.string().min(1),
  sellerId: z.string().min(1),
  deadlineAt: z.string().datetime(),
  reminderTaskUrl: z.string().url(),
  sellerAssets: z.array(sellerAssetSchema).min(1),
  buyerUpdate: buyerUpdateSchema,
  orderHandoff: orderHandoffSchema
});

type ParsedMarketplaceDeadlineRequest = z.infer<typeof marketplaceDeadlineRequestSchema>;

export type MarketplaceDeadlineRequest = {
  [Key in keyof ParsedMarketplaceDeadlineRequest]: Key extends 'sellerAssets'
    ? Readonly<ParsedMarketplaceDeadlineRequest[Key]>
    : ParsedMarketplaceDeadlineRequest[Key];
};
