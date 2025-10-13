# Zaprite Payment Links - Proof of Putt

**Last Updated:** 2025-10-10
**Payment Processor:** Zaprite
**Dashboard:** https://app.zaprite.com

---

## Active Payment Links

### Individual Subscriptions

#### Annual Subscription (Early Adopter Lifetime)
- **URL:** https://pay.zaprite.com/pl_NC6B3oH3dJ
- **Price:** $21 USD (one-time payment)
- **Type:** Annual subscription (Early adopters get lifetime access)
- **Benefits:**
  - Full Session History
  - Create leagues and duels
  - Participate in all competitions
  - Computer vision tracking
  - OpenTimestamps certificates
  - Includes 1 free year gift code (surprise bonus)

---

### Subscription Bundles (Gift Codes)

All bundles provide 1-year Full Subscriber gift codes that can be shared with friends, club members, or students.

#### 3-Pack Bundle
- **URL:** https://pay.zaprite.com/pl_5GiV3AIMVc
- **Price:** $56.70 USD
- **Discount:** 10% off
- **Per Code:** $18.90
- **Quantity:** 3 one-year subscriptions

#### 5-Pack Bundle
- **URL:** https://pay.zaprite.com/pl_sLPDlcXmej
- **Price:** $84 USD
- **Discount:** 21% off
- **Per Code:** $16.80
- **Quantity:** 5 one-year subscriptions

#### 10-Pack Bundle
- **URL:** https://pay.zaprite.com/pl_qwz5BPb1Th
- **Price:** $121 USD
- **Discount:** 42% off
- **Per Code:** $12.10
- **Quantity:** 10 one-year subscriptions
- **Best for:** Golf instructors, small clubs

#### 21-Pack Bundle
- **URL:** https://pay.zaprite.com/pl_c5uK0HOPlu
- **Price:** $221 USD
- **Discount:** 50% off (Best Value!)
- **Per Code:** $10.52
- **Quantity:** 21 one-year subscriptions
- **Best for:** Golf clubs, associations, large groups

---

## Payment Methods Accepted

All payment links accept:
- ⚡ **Lightning Network** (Bitcoin) - Instant, low fees
- 🟠 **Bitcoin On-Chain** - Traditional Bitcoin
- 💳 **Credit/Debit Cards** (Square) - Visa, Mastercard, Amex

---

## Integration with App

### In-App Purchase Flow (Recommended)

Users can purchase subscriptions and bundles directly through the app:
- **Settings Page:** https://app.proofofputt.com/settings
- **Monthly Subscription:** $2.10/month (via API)
- **Annual Subscription:** $21/year (via API, includes 1 free gift code)
- **Bundles:** 3/5/10/21-Pack (via API)

The app creates Zaprite checkout sessions dynamically and handles:
- User authentication
- Webhook processing
- Automatic subscription activation
- Gift code generation

### Direct Payment Links (Alternative)

Use these links for:
- Email campaigns
- Landing pages
- Social media promotions
- Partnership agreements
- Event registrations

**Note:** Direct payment links require manual webhook processing or customer notification to activate subscriptions in the database.

---

## How to Use Payment Links

### For Marketing & Sales

**Email Campaign:**
```
🏌️ Special Offer: Get 50% off with our 21-Pack Bundle!

Perfect for golf clubs and instructors. Give your members access to
cutting-edge putting analytics.

[Purchase Now] → https://pay.zaprite.com/pl_c5uK0HOPlu
```

**Social Media Post:**
```
🎁 Share the love of putting!

Our 5-Pack Bundle gives you 5 year-long subscriptions to gift to friends.
Only $16.80 per subscription (21% off individual pricing).

Link in bio: https://pay.zaprite.com/pl_sLPDlcXmej
```

**Landing Page Button:**
```html
<a href="https://pay.zaprite.com/pl_NC6B3oH3dJ" class="btn btn-primary">
  Get Lifetime Access
</a>
```

### For Partnerships

**Golf Club Partnership:**
```
We're offering your members exclusive access to Proof of Putt.

21-Pack Bundle: $221 (21 one-year subscriptions)
→ https://pay.zaprite.com/pl_c5uK0HOPlu

After purchase, you'll receive 21 gift codes to distribute to members.
```

**Golf Instructor Outreach:**
```
Enhance your students' practice with AI-powered putting analytics.

10-Pack Bundle: $121 (10 one-year subscriptions)
→ https://pay.zaprite.com/pl_qwz5BPb1Th

Share gift codes with your students and track their progress together.
```

---

## Webhook Configuration

**Webhook URL:** `https://app.proofofputt.com/api/webhooks/zaprite-subscription`

**Required Events:**
- `payment.succeeded` - Activates subscription, generates gift codes
- `order.paid` - Confirms payment received
- `payment.failed` - Logs failed payment attempt

**Webhook Processing:**
1. Payment completed on Zaprite
2. Webhook sent to app
3. Subscription activated in database
4. Gift codes generated (for bundles)
5. User notified (if email configured)

---

## Testing Payment Links

### Test Checklist

Before sharing payment links publicly:

- [ ] Click each payment link to verify it loads Zaprite checkout
- [ ] Verify correct price displays
- [ ] Verify all payment methods available (Lightning, Bitcoin, Card)
- [ ] Complete test purchase (use test card or small Bitcoin amount)
- [ ] Verify webhook received (check Vercel logs)
- [ ] Verify subscription activated (check database)
- [ ] Verify gift codes generated (for bundles)
- [ ] Test gift code redemption

### Test Payment Details

**Test Credit Card (Square):**
- Card: 4111 1111 1111 1111
- Expiry: Any future date
- CVV: Any 3 digits
- ZIP: Any valid ZIP code

**Test Bitcoin/Lightning:**
- Use testnet or small amount on mainnet
- Lightning recommended for instant confirmation

---

## Tracking & Analytics

### Monitor in Zaprite Dashboard

- Total revenue per product
- Payment method breakdown (BTC vs Card)
- Conversion rates
- Failed payment attempts
- Refund requests

### Monitor in App Database

```sql
-- Check recent subscriptions
SELECT player_id, email, subscription_tier, subscription_expires_at
FROM players
WHERE is_subscribed = TRUE
ORDER BY subscription_expires_at DESC
LIMIT 10;

-- Check gift codes generated
SELECT bundle_id, COUNT(*) as total_codes,
       SUM(CASE WHEN is_redeemed THEN 1 ELSE 0 END) as redeemed
FROM user_gift_subscriptions
GROUP BY bundle_id;
```

---

## QR Codes (Optional)

For print materials, events, or signage:

1. Go to https://www.qr-code-generator.com
2. Select "URL" type
3. Paste payment link
4. Customize design (add logo, colors)
5. Download high-res QR code

**Use Cases:**
- Event booth signage
- Golf course flyers
- Business cards
- Tournament programs

---

## Customization Options

To modify payment link settings, log into Zaprite dashboard:

1. Navigate to **Products** or **Payment Links**
2. Find the product (search by price or name)
3. Click **Edit**
4. Modify:
   - Price
   - Description
   - Success redirect URL
   - Custom fields
   - Email notifications
5. Save changes (link URL stays the same)

---

## Support & Troubleshooting

### Payment Link Not Working
- Verify link is active in Zaprite dashboard
- Check Zaprite status page: https://status.zaprite.com
- Try different browser/device

### Payment Completed But No Subscription
- Check webhook logs in Vercel: `vercel logs --filter="zaprite"`
- Verify webhook endpoint is accessible
- Manually activate subscription if needed

### Gift Codes Not Generated
- Check `user_gift_subscriptions` table in database
- Verify webhook processed bundle purchase correctly
- Check bundle metadata in Zaprite order

### Need to Refund a Payment
1. Log into Zaprite dashboard
2. Find the payment/order
3. Click "Refund"
4. Manually deactivate subscription in database if needed

---

## Marketing Copy Templates

### Short URLs (Recommended)

Consider using a URL shortener for cleaner links:
- Lifetime: `proofofputt.com/lifetime` → Zaprite link
- 21-Pack: `proofofputt.com/club-bundle` → Zaprite link
- 10-Pack: `proofofputt.com/instructor-bundle` → Zaprite link

Set up redirects in your domain DNS or using a service like Bitly.

### Copy Templates

**Email Subject Lines:**
- "Lifetime access to Proof of Putt - Special Offer"
- "Equip your golf club with AI-powered putting analytics"
- "21 subscriptions for the price of 10.5 - Bundle Deal Inside"

**Call-to-Action Buttons:**
- "Get Lifetime Access"
- "Buy Bundle for My Club"
- "Gift Subscriptions to My Students"
- "Claim 50% Discount"

**Landing Page Headlines:**
- "One Payment, Lifetime Access to Pro-Level Putting Analytics"
- "Bulk Pricing for Golf Clubs & Instructors"
- "Share the Love: Bundle Subscriptions for Your Community"

---

## Security & Best Practices

### Link Sharing
✅ **Do:**
- Share links via secure channels (HTTPS websites, encrypted email)
- Track link performance with UTM parameters
- Update links if products change significantly

❌ **Don't:**
- Share sensitive customer data via payment link URLs
- Create custom links that bypass webhook processing
- Share test/sandbox links in production marketing

### Webhook Security
- Webhook endpoint uses HTTPS
- Zaprite IP whitelisting (if available)
- Signature verification (if Zaprite provides signing secret)
- Idempotency checks to prevent duplicate processing

---

## Future Enhancements

### Potential Additions
- [ ] Monthly subscription payment link (currently API-only)
- [ ] Annual individual subscription payment link
- [ ] Custom enterprise pricing tiers
- [ ] Early bird discounts for new course launches
- [ ] Seasonal promotions (e.g., holiday bundles)

### Integration Ideas
- [ ] Add payment links to marketing website
- [ ] Create QR codes for print marketing
- [ ] Embed checkout buttons in blog posts
- [ ] Partner landing pages with pre-filled links
- [ ] Affiliate program with custom tracking links

---

## Quick Reference

| Product | Price | Link |
|---------|-------|------|
| Annual (Lifetime) | $21 | https://pay.zaprite.com/pl_NC6B3oH3dJ |
| 3-Pack | $56.70 | https://pay.zaprite.com/pl_5GiV3AIMVc |
| 5-Pack | $84 | https://pay.zaprite.com/pl_sLPDlcXmej |
| 10-Pack | $121 | https://pay.zaprite.com/pl_qwz5BPb1Th |
| 21-Pack | $221 | https://pay.zaprite.com/pl_c5uK0HOPlu |

---

**Document Status:** ✅ Active Payment Links
**Next Review:** When pricing changes or new products added
**Maintained By:** Development & Marketing Team
**Contact:** Use Zaprite dashboard for payment link management
