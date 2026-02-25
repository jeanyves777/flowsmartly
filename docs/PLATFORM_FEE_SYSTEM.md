# FlowSmartly Platform Fee System

## ✅ IMPLEMENTATION COMPLETE

### What Was Added (NO DUPLICATES)

#### 1. Database Schema Updates

**Store Model - New Fields:**
```prisma
stripeConnectAccountId     String?   // Stripe Connect account ID
stripeOnboardingComplete   Boolean   @default(false)
platformFeePercent         Int       @default(5)  // Default 5%
platformFeesCollectedCents Int       @default(0) // Lifetime fees
```

**Order Model - New Fields:**
```prisma
platformFeeCents          Int  @default(0)  // FlowSmartly's cut
storeOwnerAmountCents     Int  @default(0)  // Store owner receives
```

**Note:** Events/Tickets already had platform fee tracking - we only added for e-commerce stores.

---

## 💰 HOW PLATFORM FEES WORK

### Money Flow

```
Customer pays: $113.00
    ↓
Stripe processes payment ($3.57 Stripe fee)
    ↓
Remaining: $109.43
    ↓
├─ FlowSmartly platform fee (5%): $5.65
└─ Store owner receives: $103.78 (auto-transferred to their Stripe account)
```

### Fee Calculation

```typescript
// Example Order
const order = {
  subtotal: $100.00,
  shipping: $5.00,
  tax: $8.00,
  total: $113.00
};

// Platform Fee (5% of total)
platformFee = $113.00 × 5% = $5.65

// Store Owner Receives
storeOwnerAmount = $113.00 - $5.65 = $107.35

// Stripe charges FlowSmartly
stripeFee = $113.00 × 2.9% + $0.30 = $3.57

// FlowSmartly Net Revenue
flowSmartlyProfit = $5.65 - $3.57 = $2.08 (1.84% of order)
```

---

## 🔧 IMPLEMENTATION DETAILS

### 1. Stripe Connect Onboarding

**API:** `POST /api/ecommerce/stripe-connect`

Store owners must connect their Stripe account to receive payments:

```typescript
// Create Connect account + onboarding link
const response = await fetch('/api/ecommerce/stripe-connect', {
  method: 'POST'
});

const { url } = await response.json();

// Redirect user to Stripe onboarding
window.location.href = url;
```

**User Flow:**
1. Store owner clicks "Connect Stripe" in settings
2. Redirected to Stripe onboarding (Express account)
3. Fills out: Business info, Bank account, Identity verification
4. Redirected back to FlowSmartly
5. `stripeOnboardingComplete` = true
6. Can now accept payments

---

### 2. Checkout with Platform Fee

**API:** `POST /api/ecommerce/checkout`

Creates Stripe checkout session with application fee:

```typescript
const response = await fetch('/api/ecommerce/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    storeSlug: 'my-store',
    customerEmail: 'customer@example.com',
    customerName: 'John Doe',
    items: [
      { productId: 'prod_123', quantity: 2 },
      { productId: 'prod_456', quantity: 1 }
    ]
  })
});

const { sessionUrl, orderId, platformFeeCents } = await response.json();

// Redirect to Stripe Checkout
window.location.href = sessionUrl;
```

**Behind the Scenes:**
```typescript
const session = await stripe.checkout.sessions.create({
  mode: 'payment',
  line_items: [...],
  payment_intent_data: {
    application_fee_amount: 565, // $5.65 (FlowSmartly's cut)
    transfer_data: {
      destination: 'acct_STORE_OWNER', // Store owner's Connect account
    },
  },
  success_url: '...', cancel_url: '...'
});
```

---

### 3. Webhook Processing

**Endpoint:** `POST /api/webhooks/stripe-ecommerce`

Handles payment events:

**Events Handled:**
1. `checkout.session.completed` - Payment successful
2. `payment_intent.succeeded` - Funds captured
3. `charge.refunded` - Order refunded

**On Payment Success:**
```typescript
// Update order
order.paymentStatus = "paid"
order.status = "CONFIRMED"

// Update store stats
store.orderCount += 1
store.totalRevenueCents += storeOwnerAmountCents
store.platformFeesCollectedCents += platformFeeCents
```

**On Refund:**
```typescript
// Update order
order.paymentStatus = "refunded"
order.status = "REFUNDED"

// Reverse fees
store.totalRevenueCents -= refundedAmount
store.platformFeesCollectedCents -= platformFeeCents
```

---

## 🎯 SETUP INSTRUCTIONS

### 1. Environment Variables

Add to `.env`:
```bash
# Stripe Keys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET_ECOMMERCE=whsec_...

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 2. Stripe Webhook Setup

1. Go to [dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks)
2. Click "Add endpoint"
3. Endpoint URL: `https://flowsmartly.com/api/webhooks/stripe-ecommerce`
4. Events to send:
   - ✅ `checkout.session.completed`
   - ✅ `payment_intent.succeeded`
   - ✅ `charge.refunded`
5. Copy webhook signing secret → `STRIPE_WEBHOOK_SECRET_ECOMMERCE`

### 3. Database Migration

```bash
npx prisma db push
```

This adds the new platform fee fields to Store and Order models.

### 4. Test the Flow

**Step 1: Connect Stripe (Store Owner)**
```bash
# Start dev server
npm run dev

# Go to http://localhost:3000/ecommerce/settings?tab=payments
# Click "Connect Stripe Account"
# Complete onboarding
# Should redirect back with "Stripe Connected ✓"
```

**Step 2: Make Test Purchase**
```bash
# Go to http://localhost:3000/store/YOUR_STORE_SLUG
# Add product to cart
# Checkout
# Use Stripe test card: 4242 4242 4242 4242
# Complete payment
```

**Step 3: Verify in Database**
```sql
-- Check order
SELECT orderNumber, totalCents, platformFeeCents, storeOwnerAmountCents, paymentStatus
FROM Order
ORDER BY createdAt DESC
LIMIT 1;

-- Check store stats
SELECT
  name,
  orderCount,
  totalRevenueCents,
  platformFeesCollectedCents
FROM Store
WHERE slug = 'YOUR_STORE_SLUG';
```

**Expected Results:**
```
Order:
  totalCents: 11300 ($113)
  platformFeeCents: 565 ($5.65)
  storeOwnerAmountCents: 10735 ($107.35)
  paymentStatus: "paid"

Store:
  orderCount: 1
  totalRevenueCents: 10735 ($107.35)
  platformFeesCollectedCents: 565 ($5.65)
```

---

## 📊 MONITORING PLATFORM FEES

### Admin Dashboard Queries

**Total Platform Fees Collected:**
```sql
SELECT
  SUM(platformFeesCollectedCents) / 100 AS total_fees_usd,
  COUNT(DISTINCT id) AS store_count
FROM Store
WHERE platformFeesCollectedCents > 0;
```

**Top Earning Stores:**
```sql
SELECT
  s.name,
  s.slug,
  s.orderCount,
  s.totalRevenueCents / 100 AS revenue_usd,
  s.platformFeesCollectedCents / 100 AS fees_collected_usd
FROM Store s
ORDER BY s.platformFeesCollectedCents DESC
LIMIT 10;
```

**Monthly Platform Revenue:**
```sql
SELECT
  strftime('%Y-%m', o.createdAt) AS month,
  SUM(o.platformFeeCents) / 100 AS monthly_platform_fees_usd,
  COUNT(*) AS order_count
FROM "Order" o
WHERE o.paymentStatus = 'paid'
GROUP BY month
ORDER BY month DESC;
```

---

## 🔐 SECURITY CONSIDERATIONS

### 1. Webhook Verification
✅ All webhooks verify Stripe signature before processing

### 2. Connect Account Validation
✅ Checkout checks `stripeOnboardingComplete` before creating session

### 3. Amount Validation
✅ Platform fee calculated server-side (never trust client)

### 4. Refund Protection
✅ Platform fees automatically reversed on refund

---

## 💡 ADJUSTABLE PLATFORM FEE

The platform fee percentage can be customized per store:

```typescript
// Set custom fee for a store (e.g., 3% for premium sellers)
await prisma.store.update({
  where: { id: storeId },
  data: { platformFeePercent: 3 }
});
```

**Use Cases:**
- Premium stores: Lower fee (3%)
- New stores: Higher fee (7%)
- Promotional period: Temporary 0% fee
- Volume-based: Lower fee for high-volume stores

---

## 🚀 PRODUCTION DEPLOYMENT

### Pre-Launch Checklist

- [ ] Set production Stripe keys in `.env`
- [ ] Configure production webhook endpoint
- [ ] Test full payment flow on staging
- [ ] Verify webhook signature validation
- [ ] Set up monitoring for failed payments
- [ ] Create admin dashboard for fee tracking
- [ ] Document payout schedule for store owners
- [ ] Add terms of service mentioning platform fee
- [ ] Test refund flow thoroughly
- [ ] Set up alerts for high refund rates

### Payout Schedule

Store owners receive payouts based on Stripe Connect settings:
- **Daily** (default): Available next business day
- **Weekly**: Every Friday
- **Monthly**: 1st of each month

FlowSmartly's platform fee is deducted automatically before payout.

---

## 📞 TROUBLESHOOTING

### Issue: "Store payment setup incomplete"
**Solution:** Store owner hasn't completed Stripe onboarding. Send them to Settings → Payments.

### Issue: Platform fee not showing in order
**Solution:** Check `platformFeePercent` on Store model. Should default to 5.

### Issue: Webhook not firing
**Solution:**
1. Check webhook secret matches
2. Verify endpoint URL is correct
3. Check Stripe dashboard → Webhooks → Event logs

### Issue: Store owner not receiving payout
**Solution:**
1. Check `stripeOnboardingComplete = true`
2. Verify bank account connected in Stripe Dashboard
3. Check Stripe Connect account status

---

## ✅ SUMMARY

### What You Get:

1. **5% platform fee** on all e-commerce orders (customizable per store)
2. **Automatic fee collection** via Stripe Connect application fees
3. **Instant tracking** - fees recorded in database on payment success
4. **Automatic payouts** - store owners receive their share directly
5. **Refund handling** - platform fees reversed on refund
6. **No duplicate code** - reuses existing Stripe infrastructure

### Revenue Example (1000 orders/month):

```
Average order: $50
Total GMV: $50,000/month
Platform fee (5%): $2,500/month
Stripe fees (~3%): -$1,500/month
Net platform revenue: $1,000/month

Plus:
- E-commerce subscriptions: 1000 stores × $5 = $5,000/month
- Total monthly revenue: $6,000
```

---

**🎉 Platform Fee System Complete!**

Now FlowSmartly earns revenue from:
1. ✅ E-commerce subscriptions ($5/mo per store)
2. ✅ Platform fees (5% of every sale)
3. ✅ Ad credit markup (existing)
4. ✅ Premium plans (existing)
