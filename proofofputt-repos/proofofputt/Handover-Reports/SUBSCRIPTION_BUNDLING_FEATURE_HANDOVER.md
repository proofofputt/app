# Handover Report: Subscription Bundling & Gifting Feature

**Date:** 2025-10-04

**Author:** Gemini AI

## 1. Overview

This report details the implementation of the new subscription bundling and gifting feature for the Proof of Putt platform. This feature allows users to purchase multiple subscriptions at a discount and gift them to others. It also includes functionality for admins to grant these bundles and a mechanism to support a "2 for 1" introductory offer.

## 2. Database Changes

Two new tables have been added to the NeonDB database, and one existing table has been modified. The following SQL migration scripts have been created:

*   `database/add_subscription_gifting_tables.sql`
*   `database/update_subscription_bundle_discount.sql`

### New Tables

**`subscription_bundles`**

This table defines the different gift packages available for purchase.

```sql
CREATE TABLE subscription_bundles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL,
    discount_percentage NUMERIC(5, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**`user_gift_subscriptions`**

This table tracks the giftable subscriptions owned by users.

```sql
CREATE TABLE user_gift_subscriptions (
    id SERIAL PRIMARY KEY,
    owner_user_id INT REFERENCES players(id) NOT NULL,
    bundle_id INT REFERENCES subscription_bundles(id), -- Can be null for single gifts like the intro offer
    gift_code VARCHAR(255) UNIQUE NOT NULL,
    is_redeemed BOOLEAN DEFAULT FALSE,
    redeemed_by_user_id INT REFERENCES players(id),
    redeemed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Table Modifications

**`players`**

Two columns were added to the `players` table to support subscription status.

```sql
ALTER TABLE players ADD COLUMN is_subscribed BOOLEAN DEFAULT FALSE;
ALTER TABLE players ADD COLUMN subscription_expires_at TIMESTAMP WITH TIME ZONE;
```

### Data Updates

The `subscription_bundles` table is populated with the following bundles:

```sql
INSERT INTO subscription_bundles (name, quantity, discount_percentage) VALUES
('3-Pack', 3, 10.00),
('5-Pack', 5, 20.00),
('10-Pack', 10, 42.00),
('21-Pack', 21, 50.00);
```

## 3. API Endpoints

The following new API endpoints have been created in the `app/api/` directory:

*   **`POST /api/subscriptions/bundles/purchase`**: Allows a user to purchase a subscription bundle. It calculates the price based on the bundle and processes the payment. Upon successful payment, it generates unique gift codes and adds them to the `user_gift_subscriptions` table.
*   **`GET /api/subscriptions/gifts`**: Retrieves all available (unredeemed) gift subscriptions for the authenticated user.
*   **`POST /api/subscriptions/gifts/redeem`**: Allows a user to redeem a gift subscription using a gift code. It marks the code as redeemed and updates the user's subscription status.
*   **`POST /api/admin/subscriptions/gifts/grant`**: An admin-only endpoint to grant a subscription bundle to a user free of charge.
*   **`POST /api/webhooks/zaprite/subscription`**: A webhook endpoint to handle the "2 for 1" introductory offer. It receives a payload from Zaprite upon a new subscription and grants a gift subscription to the purchaser.

## 4. Frontend Components

Two new React components have been created in `app/src/components/`:

*   **`SubscriptionBundles.jsx`**: This component displays the available subscription bundles and allows users to purchase them.
*   **`MyGifts.jsx`**: This component displays a list of the user's available gift subscriptions and their corresponding gift codes.

## 5. UI Changes

*   **`SettingsPage.jsx`**: This page has been modified to include buttons that link to the new subscription bundle and gift management pages.
    *   A "Subscription Bundles" button has been added to the upgrade section for free-tier users.
    *   A "My Gifts" button has been added for both free and subscribed users.
*   **`App.jsx`**: The main application router has been updated to include routes for the new `/bundles` and `/gifts` pages.

## 6. Configuration

### Zaprite Webhook for 2-for-1 Offer

To enable the automatic granting of a gift subscription for the "2 for 1" introductory offer, a webhook needs to be configured in your Zaprite account.

1.  **Endpoint URL:** In your Zaprite settings, create a new webhook that points to the following URL: `https://app.proofofputt.com/api/webhooks/zaprite/subscription`
2.  **Event:** The webhook should be triggered on the `subscription.created` event (or the equivalent event in Zaprite for a new subscription).
3.  **Security:** It is critical to secure your webhook. The `subscription.js` endpoint includes a placeholder for a verification function (`verifyZapriteWebhook`). You should implement this function to verify that the webhook requests are coming from Zaprite, for example by using a secret token.

## 7. Future Considerations

*   **Email Notifications:** Consider adding email notifications to inform users when they receive a gift subscription.
*   **UI/UX Refinements:** The new components have been created with a basic structure. Further styling and UX improvements can be made to enhance the user experience.
*   **Zaprite Payload:** The Zaprite webhook endpoint (`subscription.js`) makes assumptions about the payload structure. You will need to inspect the actual payload from Zaprite and adjust the code accordingly to correctly identify the user.
