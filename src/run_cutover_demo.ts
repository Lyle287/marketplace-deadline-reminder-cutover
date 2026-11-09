import { scheduleMarketplaceReminder } from './reminder_cutover_service';

const request = {
  orderId: 'ord_2048',
  sellerId: 'seller_14',
  deadlineAt: '2026-03-15T18:00:00.000Z',
  reminderTaskUrl: 'https://example.com/reminders/marketplace-deadline',
  sellerAssets: [
    { assetId: 'asset_sheet', kind: 'product-sheet', status: 'ready' },
    { assetId: 'asset_packet', kind: 'compliance-packet', status: 'missing' }
  ],
  buyerUpdate: {
    buyerId: 'buyer_77',
    acknowledgedAt: '2026-03-14T16:00:00.000Z',
    shippingWindowConfirmed: false
  },
  orderHandoff: {
    warehouseReady: true,
    carrierBooked: false
  }
};

scheduleMarketplaceReminder(request, new Date('2026-03-15T12:00:00.000Z'))
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
