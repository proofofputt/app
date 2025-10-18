# Referral & Commission Structure

## Overview
Proof of Putt uses a referral tracking system to reward users who help grow the platform. This document outlines how referrals are tracked and when commissions are earned.

## Referral Tracking

### How Referrals Are Created

1. **Gift Code Redemptions** (`referral_source: 'gift_code'`)
   - When a user redeems a gift code, a referral credit is automatically created
   - The gift code owner becomes the referrer
   - The person redeeming becomes the referred player
   - Entry created in `player_referrals` table

2. **Direct Link Signups** (`referral_source: 'direct_link'`)
   - When someone signs up using a referral link (e.g., `?ref=KIR0028`)
   - The referral code owner becomes the referrer
   - Tracked via `referral_sessions` table

3. **Duel Invitations** (`referral_source: 'duel_invitation'`)
   - When a player invites someone to a duel and they sign up
   - The inviter becomes the referrer

4. **League Invitations** (`referral_source: 'league_invitation'`)
   - When a player invites someone to a league and they sign up
   - The inviter becomes the referrer

## Commission Structure

### Initial Gift/Invite: **NO COMMISSION**
- Gift codes are free invites - no money changes hands
- The referrer does NOT earn commission on the initial free year subscription
- This encourages organic growth without financial incentive for the initial invite

### Renewals: **COMMISSION ELIGIBLE**
When a referred player:
1. Completes their free year subscription
2. Chooses to renew their subscription (monthly or annual)
3. Makes payment through Zaprite

**The original referrer earns a commission** on:
- The renewal payment
- All subsequent renewal payments
- Any subscription upgrades

### Commission Rates (To Be Defined)
```javascript
// Example commission structure (values TBD)
const commissionRates = {
  monthly_renewal: 0.10,    // 10% of monthly subscription
  annual_renewal: 0.15,     // 15% of annual subscription
  bundle_purchase: 0.08,    // 8% of bundle purchases
  lifetime: true            // Commission continues for lifetime of referred user
};
```

## Database Schema

### `player_referrals` Table
```sql
CREATE TABLE player_referrals (
  referral_id SERIAL PRIMARY KEY,
  referrer_id INTEGER REFERENCES players(player_id),    -- Who made the referral
  referred_player_id INTEGER REFERENCES players(player_id), -- Who was referred
  referral_source VARCHAR(50),  -- 'gift_code', 'direct_link', 'duel_invitation', 'league_invitation'
  reward_claimed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### `user_gift_subscriptions` Table
```sql
CREATE TABLE user_gift_subscriptions (
  id SERIAL PRIMARY KEY,
  owner_user_id INTEGER REFERENCES players(player_id),  -- Gift code owner (referrer)
  redeemed_by_user_id INTEGER REFERENCES players(player_id), -- Who redeemed (referred)
  gift_code VARCHAR(20) UNIQUE,
  is_redeemed BOOLEAN DEFAULT FALSE,
  redeemed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Referrals Dashboard

The Referrals Dashboard shows:
1. **Gift Code Sends** - Invitations sent via email/SMS
2. **Gift Code Redemptions** - Codes redeemed (even if not sent via Send button)
3. **Direct Link Signups** - People who signed up via referral link
4. **Subscription Status** - Whether referred users have active subscriptions

## Future Enhancements

### Planned Features:
1. **Commission Payouts** via Lightning Network
2. **Tiered Commissions** based on number of referrals
3. **Bonus Rewards** for high-performing referrers
4. **Referral Leaderboard** to gamify growth
5. **Affiliate Portal** with detailed analytics

### Technical Implementation:
- Zaprite webhook integration to track renewals
- Lightning Network wallet integration for payouts
- Commission calculation cron job
- Automated payout scheduler

## Notes

- **No commissions on free gifts** - This is intentional to encourage genuine recommendations
- **Commissions start on renewals** - Only when the referred user chooses to pay
- **Lifetime tracking** - Referral credit persists for the lifetime of the referred user's account
- **Privacy-first** - Referrers see aggregate stats, not detailed payment information

## Related Files

- `/api/subscriptions/gifts/redeem.js` - Creates referral credit on redemption
- `/api/referrals/stats.js` - Displays referral statistics
- `/api/webhooks/zaprite.js` - Tracks subscription payments (future commission calculation)
- `/database/add_player_referrals_table.sql` - Referral tracking schema
- `/database/enhanced_referral_tracking.sql` - Advanced referral matching

## Contact

For questions about the referral system or commission structure, contact the development team.

---

**Last Updated:** 2025-10-17
**Version:** 1.0
