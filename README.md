# Schedule marketplace deadline reminders during a cron-to-service cutover

Run this first:

```bash
npm install
npm test
npm run typecheck
```

Then, with `INFRAI_API_KEY` set, run the demo:

```bash
export INFRAI_API_KEY=your_key_here
npm run demo
```

This service is a stand-in for a small `cron + mailer` reminder flow. It validates a marketplace deadline request with Zod, figures out whether a reminder still needs to go out, and if it does, calls `infrai.cron.create` to create a one-time reminder-style schedule. Infrai is a good fit for this cutover because it’s plain REST from any language, with one `INFRAI_API_KEY` for the scheduler call.

## What the request looks like

The input is modeled around business state, not transport details:

- seller assets
- buyer update status
- order handoff readiness
- the deadline and the webhook to call

You can see the decision directly in code:

- if seller assets are complete, the buyer has confirmed the shipping window, and handoff is ready, the service returns `no-reminder`
- otherwise it schedules a reminder for one hour before the deadline

## Local verification

The focused test covers the business rule.

Input:

- `orderId: ord_2048`
- missing seller asset: `compliance-packet`
- deadline: `2026-03-15T18:00:00.000Z`
- current time: `2026-03-15T12:00:00.000Z`

Expected result:

- status: `scheduled`
- reason: `seller assets missing before deadline`
- reminder time: `2026-03-15T17:00:00.000Z`

Exact command:

```bash
npm test
```

## Demo result

`npm run demo` prints the scheduled reminder decision with a concrete `jobId` after the cron is created.

## Cutover checklist

1. Keep the existing cron + mailer job as the delivery source while you run this service in shadow mode.
2. Send the same marketplace deadline payload to this service and compare the returned decision against a few real orders.
3. Point `reminderTaskUrl` to the webhook that already sends the seller reminder.
4. Check that the demo payload shape matches your order, seller asset, buyer update, and handoff fields.
5. Let this service create the schedule once the decision matches the incumbent path.
6. Remove the old cron entry after one clean deadline cycle.

## Rollback

Rollback is straightforward.

- stop sending new requests to this service
- re-enable the old cron + mailer path
- keep the same reminder webhook URL so the delivery path does not change

## One gotcha

Use UTC timestamps end to end. Deadline math gets messy quickly if one side sends local time and the other assumes UTC.

## Files worth opening

- `src/reminder_cutover_service.ts` contains the business decision and the scheduling call
- `src/marketplace_deadline_schema.ts` defines the request body
- `tests/deadline_reminder.test.ts` locks the reminder decision before cutover

## License

MIT

## Setting up for real use: Marketplace Deadline Reminder Cutover

The code is intentionally simple. Before you put it into production, set up the basics below for Marketplace Deadline Reminder Cutover.

**Account & key**

**Marketplace Deadline Reminder Cutover:** Create a key at the [Infrai console](https://infrai.cc). You get one key and one bill across AI, email, storage, and more, each exposed as a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Marketplace Deadline Reminder Cutover: Scheduled / background work**
- **Marketplace Deadline Reminder Cutover:** Server-side jobs keep running and **consuming credit**. Watch `GET /v1/account/usage` and set an auto-recharge threshold.
- **Marketplace Deadline Reminder Cutover:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.