import test from 'node:test';
import assert from 'node:assert/strict';
import { decideReminder } from '../src/reminder_cutover_service';

test('schedules a reminder one hour before deadline when seller assets are missing', () => {
  const input = {
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
  } as const;

  const result = decideReminder(input, new Date('2026-03-15T12:00:00.000Z'));

  assert.equal(result.status, 'scheduled');
  assert.equal(result.reason, 'seller assets missing before deadline');
  assert.equal(result.reminderAt, '2026-03-15T17:00:00.000Z');
  assert.match(result.taskUrl ?? '', /orderId=ord_2048/);
});

test('skips the reminder when buyer update and handoff are complete', () => {
  const input = {
    orderId: 'ord_3001',
    sellerId: 'seller_99',
    deadlineAt: '2026-03-15T18:00:00.000Z',
    reminderTaskUrl: 'https://example.com/reminders/marketplace-deadline',
    sellerAssets: [
      { assetId: 'asset_sheet', kind: 'product-sheet', status: 'ready' }
    ],
    buyerUpdate: {
      buyerId: 'buyer_88',
      acknowledgedAt: '2026-03-14T10:00:00.000Z',
      shippingWindowConfirmed: true
    },
    orderHandoff: {
      warehouseReady: true,
      carrierBooked: true
    }
  } as const;

  const result = decideReminder(input, new Date('2026-03-15T12:00:00.000Z'));

  assert.equal(result.status, 'no-reminder');
  assert.equal(result.reason, 'order handoff is ready');
  assert.equal(result.reminderAt, null);
});
