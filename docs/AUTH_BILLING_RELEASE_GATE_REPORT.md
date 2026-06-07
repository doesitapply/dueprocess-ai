# Auth & Billing Release Gate Report

Date: 2026-06-01

Scope: targeted execution of release checklist Section 8, Authentication & Access Control, and Section 9, Stripe & Billing.

## Summary

Section 8 is passing for the targeted local checks after hardening admin authorization and local auth.

Section 9 is partially blocked. Stripe webhook signature verification passes, but checkout cannot pass until the new Stripe price IDs are created and configured in `.env`.

## Fixes Applied During Gate

- Local auth is now loopback-only. Requests with a non-loopback host receive `403`.
- Admin procedures now require both:
  - `user.role === "admin"`
  - `user.openId === OWNER_OPEN_ID`
- Billing admin override now requires both:
  - `user.role === "admin"`
  - `user.openId === OWNER_OPEN_ID`
- `upsertUser` no longer honors a requested `admin` role for non-owner users.

## Section 8 - Authentication & Access Control

| Item | Status | Evidence |
|---|---|---|
| 8.1 Unauthenticated access | Pass | `documents.list` without cookie returned HTTP `401` with `UNAUTHORIZED`. |
| 8.2 Cross-user document read | Pass | User B could not read User A's document; route returned `Document not found`. |
| 8.2 Cross-user document delete | Pass | User B could not delete User A's document; route returned `Document not found`. |
| 8.4 Admin-only routes | Pass | Non-owner user created through `upsertUser` with requested admin role was stored as `user` and received `FORBIDDEN`. |
| 8.4 Forced admin row | Pass | A synthetic non-owner DB row with `role = admin` still received `FORBIDDEN` because admin access also requires `OWNER_OPEN_ID`. |
| Existing non-owner admin rows | Pass | Query returned no non-owner users with `role = admin` after test cleanup. |
| Owner/admin override | Pass | Configured owner with admin role receives active `firm` access with `adminOverride: true`. |
| Local auth public exposure | Pass | `/api/auth/login` succeeds on `localhost`; same route with non-loopback host returned `403`. |

## Section 9 - Stripe & Billing

| Item | Status | Evidence |
|---|---|---|
| 9.1 Checkout flow | Fail / Blocked | `STRIPE_PRICE_ADVOCATE`, `STRIPE_PRICE_ADVOCATE_FOUNDER`, `STRIPE_PRICE_LITIGATOR`, `STRIPE_PRICE_LITIGATOR_FOUNDER`, `STRIPE_PRICE_FIRM`, and `STRIPE_PRICE_FIRM_FOUNDER` are missing from `.env`. Checkout for Advocate/Litigator returns `Stripe Price ID not configured`. |
| 9.2 Webhook signature verification | Pass | POST to `/api/stripe/webhook` with invalid signature returned HTTP `400`; no processing occurred. |
| 9.3 Tier mapping consistency | Partial | Product catalog and webhook mapping use new plan IDs: `free`, `advocate`, `litigator`, `firm`. Cannot fully verify paid tier mapping until real Stripe prices exist and checkout/webhook can run. |
| 9.4 Cancellation | Not tested | Requires a real Stripe subscription for the new price IDs. |

## Required Before Public Release

Create Stripe prices and set these `.env` keys:

- `STRIPE_PRICE_ADVOCATE`
- `STRIPE_PRICE_ADVOCATE_FOUNDER`
- `STRIPE_PRICE_LITIGATOR`
- `STRIPE_PRICE_LITIGATOR_FOUNDER`
- `STRIPE_PRICE_FIRM`
- `STRIPE_PRICE_FIRM_FOUNDER`

Firm is usage-based, so the base subscription and metered billing items must be modeled explicitly in Stripe before public checkout can be enabled.

## Current Release Decision

Do not publish billing yet. Auth/access-control checks passed locally after hardening, but Stripe checkout and lifecycle testing remain blocked on real price IDs and metered Firm billing configuration.
