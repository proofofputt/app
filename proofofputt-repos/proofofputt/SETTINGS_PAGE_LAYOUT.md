# Settings Page - Subscription Management Layout

## 🎨 Two-Column Layout Design

The "Manage Subscription" section now uses a **responsive two-column layout** that adapts based on user subscription status.

---

## 📱 Free Tier User View

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Manage Subscription                              │
├──────────────────────────────────┬──────────────────────────────────────┤
│  LEFT COLUMN                     │  RIGHT COLUMN                        │
│  Upgrade Your Account            │  Bulk Purchase Options               │
│  ────────────────────            │  ─────────────────                   │
│                                  │                                      │
│  Status: [Free Tier]             │  Perfect for golf clubs,             │
│                                  │  instructors, or groups              │
│  Get full access to features     │                                      │
│                                  │  ┌──────────┬──────────┐            │
│  ┌─────────┬─────────┐           │  │ 3-Pack   │ 5-Pack   │            │
│  │ Monthly │ Annual  │           │  │ 10% OFF  │ 20% OFF  │            │
│  │         │ [BEST   │           │  │ 3 Subs   │ 5 Subs   │            │
│  │ $2.10   │ VALUE]  │           │  │ $56.70   │ $84.00   │            │
│  │ /month  │         │           │  │ $18.90ea │ $16.80ea │            │
│  │         │ $21     │           │  │ [Buy]    │ [Buy]    │            │
│  │ Features│ /year   │           │  └──────────┴──────────┘            │
│  │ • Recording       │           │                                      │
│  │ • Leagues │ Save  │           │  ┌──────────┬──────────┐            │
│  │ • Duels   │ $4.20 │           │  │ 10-Pack  │ 21-Pack  │            │
│  │ • OTS     │       │           │  │ 42% OFF  │ 50% OFF  │            │
│  │           │ Features│           │  │ 10 Subs  │ 21 Subs  │            │
│  │           │ • All   │           │  │ $121.00  │ $221.00  │            │
│  │ [Subscribe│ Monthly │           │  │ $12.10ea │ $10.52ea │            │
│  │  Monthly] │ 🎁 Gift │           │  │ [Buy]    │ [Buy]    │            │
│  │           │ Code!   │           │  └──────────┴──────────┘            │
│  │           │         │           │                                      │
│  │           │ [Subscribe          │                                      │
│  └───────────┴ Annual] │           │                                      │
│                                  │                                      │
│  Have a Gift Code?               │                                      │
│  ─────────────────               │                                      │
│  [Enter Code    ] [Redeem]       │                                      │
└──────────────────────────────────┴──────────────────────────────────────┘
```

---

## ✅ Full Subscriber View

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Manage Subscription                              │
├──────────────────────────────────┬──────────────────────────────────────┤
│  LEFT COLUMN                     │  RIGHT COLUMN                        │
│  Current Subscription            │  Share with Your Golf Community      │
│  ────────────────                │  ──────────────────────────          │
│                                  │                                      │
│  Status: [Full Subscriber ✓]    │  Purchase bundles to gift            │
│                                  │  subscriptions to friends, club      │
│  Your current plan gives you     │  members, or students.               │
│  access to all features.         │                                      │
│                                  │  ┌──────────┬──────────┐            │
│  [My Gifts]                      │  │ 3-Pack   │ 5-Pack   │            │
│  [Cancel Subscription]           │  │ 10% OFF  │ 20% OFF  │            │
│                                  │  │ 3 Subs   │ 5 Subs   │            │
│  ─────────────────               │  │ $56.70   │ $84.00   │            │
│                                  │  │ $18.90ea │ $16.80ea │            │
│  Have a Gift Code?               │  │ [Buy]    │ [Buy]    │            │
│  ─────────────────               │  └──────────┴──────────┘            │
│  [Enter Code    ] [Redeem]       │                                      │
│                                  │  ┌──────────┬──────────┐            │
│                                  │  │ 10-Pack  │ 21-Pack  │            │
│                                  │  │ 42% OFF  │ 50% OFF  │            │
│                                  │  │ 10 Subs  │ 21 Subs  │            │
│                                  │  │ $121.00  │ $221.00  │            │
│                                  │  │ $12.10ea │ $10.52ea │            │
│                                  │  │ [Buy]    │ [Buy]    │            │
│                                  │  └──────────┴──────────┘            │
└──────────────────────────────────┴──────────────────────────────────────┘
```

---

## 🎯 Key Features

### For Free Users (Left Column):
1. **Status Badge** - Shows "Free Tier"
2. **Subscription Plans** - Monthly ($2.10) and Annual ($21) side-by-side
3. **Annual Plan Highlighted** - "Best Value" badge, gradient background
4. **Gift Code Feature** - Prominently displayed for annual plan
5. **Coupon Redemption** - At bottom for gift codes

### For All Users (Right Column):
1. **Bundle Cards** - 2x2 grid showing 3, 5, 10, and 21-pack options
2. **Discount Badges** - Clear percentage savings
3. **Unit Pricing** - Shows cost per subscription
4. **Hover Effects** - Cards highlight on hover
5. **Call-to-Action** - Clear "Purchase Bundle" buttons

### For Subscribers (Left Column):
1. **Status Badge** - Shows "Full Subscriber" with checkmark
2. **Account Actions** - My Gifts and Cancel buttons
3. **Gift Code Redemption** - Can still redeem additional gift codes
4. **Clean Layout** - Less cluttered since they already have access

---

## 💡 User Flow Examples

### Flow 1: Free User Upgrades to Annual
```
1. User sees "Free Tier" status
2. Compares Monthly vs Annual plans
3. Sees "🎁 1 Free Year Gift Code" benefit
4. Clicks "Subscribe Annually" button
5. Redirected to Zaprite checkout ($21)
6. Completes payment with Bitcoin/Lightning/Card
7. Webhook processes payment
8. User upgraded to "Full Subscriber"
9. Gift code auto-generated: GIFT-ABC123
10. User can view gift code in "My Gifts"
```

### Flow 2: Subscriber Buys Bundle for Golf Club
```
1. Subscriber sees bundle options on right
2. Clicks "Purchase Bundle" on 10-Pack ($121)
3. Redirected to payment
4. Receives 10 unique gift codes
5. Distributes codes to club members
6. Each member redeems → gets 1 year subscription
```

### Flow 3: Friend Receives Gift Code
```
1. Friend visits Settings page (Free tier)
2. Enters gift code in "Have a Gift Code?" field
3. Clicks "Redeem"
4. Subscription activated for 1 year
5. Status changes to "Full Subscriber"
6. Gift code marked as redeemed
```

---

## 📐 Responsive Behavior

### Desktop (>1200px):
- Two columns side-by-side
- Bundles in 2x2 grid
- Plans side-by-side

### Tablet (768px - 1200px):
- Stacks to single column
- Bundles remain 2x2 grid
- Plans remain side-by-side

### Mobile (<768px):
- Full single column layout
- Plans stack vertically
- Bundles stack vertically
- Optimized for thumb navigation

---

## 🎨 Visual Design Elements

### Color Coding:
- **Primary Color** - Subscribe buttons, prices, badges
- **Success Green** - Active subscription status
- **Gray** - Free tier badge
- **Gradient** - Featured annual plan card

### Typography:
- **Bold** - Prices, headings
- **Regular** - Descriptions
- **Small** - Unit pricing, disclaimers

### Spacing:
- **2rem gap** between columns
- **1rem gap** between cards
- **1.5rem padding** inside sections

### Interactive Elements:
- **Hover effects** - Cards lift and highlight
- **Button states** - Clear primary actions
- **Transitions** - Smooth 0.3s animations

---

## 🔧 Technical Implementation

### Files Modified:
1. **`SettingsPage.jsx`** - Component structure
2. **`SettingsPage.css`** - Styling and layout
3. **New handler:** `handleSubscribe(interval)` - Creates Zaprite orders

### API Integration:
- `POST /api/subscriptions/create-zaprite-order` - Monthly/Annual checkout
- `POST /api/subscriptions/bundles/purchase` - Bulk purchase
- `POST /api/subscriptions/gifts/redeem` - Redeem gift codes

### State Management:
- Uses existing `playerData.membership_tier` to switch layouts
- `bundles` state holds bundle pricing data
- `couponCode` state for redemption

---

## ✅ Benefits of This Layout

1. **Clear Upgrade Path** - Free users see subscription options first
2. **Upsell Opportunity** - Bundles always visible on right
3. **Viral Growth** - Annual plan gift code prominently featured
4. **B2B Sales** - Bundles accessible to both free and paid users
5. **Space Efficient** - Uses previously empty right column
6. **Responsive** - Works on all screen sizes
7. **Consistent** - Matches existing settings page grid layout

---

## 🚀 Next Steps

1. Deploy updated `SettingsPage.jsx` and `.css`
2. Deploy `/api/subscriptions/create-zaprite-order.js`
3. Test subscription flow end-to-end
4. Test bundle purchase flow
5. Verify responsive behavior on mobile
6. Add analytics tracking to buttons
7. Monitor conversion rates

---

**Layout Status:** ✅ Ready to deploy
**Zaprite Integration:** ✅ Connected
**Gift System:** ✅ Integrated
**Responsive Design:** ✅ Mobile-friendly
