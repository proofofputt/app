# Nigiri Local Testing Setup for ArkadeOS

This guide explains how to set up and use Nigiri for local testing of bitcoin payment features.

## What is Nigiri?

Nigiri is a local Bitcoin development environment that provides:
- Bitcoin regtest network (instant blocks, free coins)
- Electrs for blockchain indexing
- ArkadeOS server for offchain execution

Perfect for testing bitcoin features without spending real money or waiting for confirmations.

## Prerequisites

- Docker and Docker Compose installed
- Node.js v22+ (see `.nvmrc`)
- This repository checked out on `feature/bitcoin-payment-integration` branch

## Quick Start

### 1. Start Nigiri Environment

```bash
# From repository root
docker-compose -f docker-compose.nigiri.yml up -d
```

This starts:
- **ArkadeOS Server**: http://localhost:7070
- **Bitcoin Regtest RPC**: localhost:18443
- **Electrs**: localhost:50001

### 2. Verify Services

```bash
# Check if Arkade server is running
curl http://localhost:7070

# Check Docker logs
docker-compose -f docker-compose.nigiri.yml logs
```

### 3. Enable Bitcoin Features (Local Only)

Create `app/.env.development.local` (gitignored):

```bash
# Enable ArkadeOS integration for local testing
ARKADE_ENABLED=true
ARKADE_NETWORK=local
ARKADE_SERVER_URL=http://localhost:7070

# Generate a test secret (DO NOT use in production)
ARKADE_IDENTITY_SECRET=0000000000000000000000000000000000000000000000000000000000000001

# Platform fees
PLATFORM_FEE_DUELS=3
PLATFORM_FEE_LEAGUES=5
PLATFORM_FEE_FUNDRAISING=2
```

### 4. Temporarily Enable UI (Testing Only)

**IMPORTANT**: Never commit these changes!

Edit `app/src/config/bitcoin.js` temporarily:

```javascript
export const BITCOIN_CONFIG = {
  ENABLED: true,   // Changed for testing
  SHOW_UI: true,   // Changed for testing
  // ... rest of config
  FEATURES: {
    DUELS_WAGERS: true,
    LEAGUE_ENTRY_FEES: true,
    LEAGUE_PRIZE_POOLS: true,
    FUNDRAISER_PLEDGES: true,
  },
};
```

### 5. Start Development Server

```bash
cd app
npm install
npm run dev
```

Navigate to http://localhost:5173 and you should now see bitcoin payment options!

## Testing Workflow

### Test Bitcoin Wagers on Duels

1. Navigate to Duels page
2. Click "Create Duel"
3. You should see "⚡ Enable Bitcoin Wager" section
4. Enable wager and set amount (e.g., 10,000 sats)
5. Create duel (escrow address will be generated)

### Test League Prize Pools

1. Navigate to Leagues page
2. Click "Create League"
3. Scroll to "💰 Enable Bitcoin Prize Pool" section
4. Select prize pool type (entry fees, creator funded, or hybrid)
5. Configure amounts and distribution
6. Create league

### Check Backend Status

```bash
# Initialize ArkadeOS wallet
curl -X POST http://localhost:4000/api/bitcoin/initialize

# Check bitcoin features status
curl http://localhost:4000/api/bitcoin/status
```

## Stopping Nigiri

```bash
# Stop containers (keeps data)
docker-compose -f docker-compose.nigiri.yml stop

# Stop and remove containers + data
docker-compose -f docker-compose.nigiri.yml down -v
```

## Troubleshooting

### Arkade Server Won't Start

```bash
# Check Docker logs
docker-compose -f docker-compose.nigiri.yml logs nigiri

# Restart services
docker-compose -f docker-compose.nigiri.yml restart
```

### Can't See Bitcoin UI

Verify these settings:
1. `ARKADE_ENABLED=true` in `.env.development.local`
2. `ENABLED: true` in `src/config/bitcoin.js`
3. `SHOW_UI: true` in `src/config/bitcoin.js`
4. Development server restarted after changes

### Wallet Initialization Fails

Check:
1. Nigiri is running: `curl http://localhost:7070`
2. `ARKADE_IDENTITY_SECRET` is set in `.env.development.local`
3. Server logs for detailed error messages

## Important Reminders

⚠️ **NEVER commit local testing changes**

Before committing:
1. Revert `bitcoin.js` to `ENABLED: false` and `SHOW_UI: false`
2. Delete `.env.development.local` (it's gitignored)
3. Verify no real secrets in committed files

✅ **Safe to commit**:
- Docker Compose configuration
- Documentation updates
- Code with feature flags disabled

## Next Steps

After local testing:
1. Switch to testnet (Mutinynet or Signet)
2. Conduct end-to-end testing
3. Security audit
4. Production deployment (with all features disabled by default)

---

*For more information, see `Documentation/ARKADE_TESTING_GUIDE.md`*
