# Bitcoin Payment Integration - ArkadeOS

## 🎯 Overview

This branch (`feature/bitcoin-payment-integration`) contains infrastructure for self-custodial bitcoin payments using **ArkadeOS**.

**Current Status**: ⚠️ **Development Infrastructure Only**
- All bitcoin features are **DISABLED** in production
- UI components exist but will **NOT render** to users
- Database migrations are **NOT applied** to production
- Backend APIs return 501 (Not Implemented)

## 🏗️ Architecture

### Self-Custodial Escrow Model

```
Player A ←→ 2-of-3 Multi-Sig VTXO ←→ Player B
                  ↓
         Platform Arbitration Key
         (Disputes only - no custody)
```

**Key Principles**:
- Proof of Putt **NEVER** takes custody of funds
- Users control their bitcoin via private keys
- Platform facilitates, does not hold
- Regulatory advantage: Not a money transmitter

### Use Cases

1. **Duels with Wagers**
   - Both players deposit to escrow
   - Winner receives pot minus 3% platform fee
   - Automatic payout on completion

2. **Leagues with Prize Pools**
   - Entry fees or creator-funded
   - Multi-party escrow
   - Automatic prize distribution
   - 5% platform fee

3. **Fundraiser Pledges**
   - Pledge per successful putt
   - Time-locked until campaign ends
   - Automatic invoicing
   - 2% platform fee

## 📁 File Structure

```
app/
├── src/
│   ├── config/
│   │   └── bitcoin.js                    # Feature flags (ENABLED=false)
│   └── components/
│       └── bitcoin/
│           ├── DuelWagerSection.jsx      # Hidden wager UI
│           ├── DuelWagerSection.css
│           ├── LeaguePrizePoolSection.jsx
│           └── LeaguePrizePoolSection.css
├── utils/
│   ├── arkade-service.js                 # ArkadeOS SDK wrapper
│   └── bitcoin-escrow.js                 # Escrow management
├── api/
│   ├── bitcoin/
│   │   ├── initialize.js                 # Wallet init (disabled)
│   │   └── status.js                     # Status check
│   └── webhooks/
│       └── arkade-os.js                  # Payment notifications
├── database/
│   ├── add_bitcoin_escrow_system.sql     # Schema (testing only)
│   └── rollback_bitcoin_escrow.sql       # Rollback script
└── .env.example                          # Config documentation

docker-compose.nigiri.yml                 # Local testing environment

Documentation/
├── NIGIRI_SETUP.md                       # Local testing guide
├── BITCOIN_INTEGRATION_CHECKLIST.md     # Implementation progress
└── BITCOIN_INTEGRATION_README.md         # This file
```

## 🚀 Quick Start (Local Testing)

### 1. Start Nigiri

```bash
docker-compose -f docker-compose.nigiri.yml up -d
```

### 2. Enable Features Locally

Create `app/.env.development.local`:

```bash
ARKADE_ENABLED=true
ARKADE_NETWORK=local
ARKADE_SERVER_URL=http://localhost:7070
ARKADE_IDENTITY_SECRET=0000000000000000000000000000000000000000000000000000000000000001
```

### 3. Temporarily Enable UI

Edit `app/src/config/bitcoin.js` (DO NOT COMMIT):

```javascript
export const BITCOIN_CONFIG = {
  ENABLED: true,   // Testing only
  SHOW_UI: true,   // Testing only
  // ...
};
```

### 4. Run Development Server

```bash
cd app && npm install && npm run dev
```

See `Documentation/NIGIRI_SETUP.md` for full details.

## 🔒 Production Safety Guarantees

### Feature Flags (MUST Remain False)

**`app/src/config/bitcoin.js`:**
```javascript
export const BITCOIN_CONFIG = {
  ENABLED: false,  // ← MUST BE FALSE
  SHOW_UI: false,  // ← MUST BE FALSE
  // ...
};
```

### Environment Variables

**`app/.env.example` (production default):**
```bash
ARKADE_ENABLED=false  # ← MUST BE FALSE
```

### UI Components

All bitcoin UI components check `isBitcoinEnabled()`:
```javascript
if (!isBitcoinEnabled()) {
  return null;  // Never renders
}
```

### Backend APIs

All bitcoin endpoints return 501 when disabled:
```javascript
if (!ARKADE_FEATURES_ENABLED) {
  return res.status(501).json({ error: 'Not enabled' });
}
```

### Database Migrations

**⚠️ CRITICAL**: Do not apply to production
- Migrations include prominent warnings
- Rollback script provided
- Only for branch testing

## 📋 Implementation Checklist

See `Documentation/BITCOIN_INTEGRATION_CHECKLIST.md` for full status.

**Phase 1** (Complete ✅):
- Development infrastructure
- Feature flags
- Hidden UI components
- Backend API structure

**Phase 2** (TODO):
- Arkade Script smart contracts
- VTXO payment implementation
- Escrow release logic

**Phase 3** (TODO):
- Nigiri local testing
- Testnet deployment
- Security audit

**Phase 4** (TODO):
- Legal compliance
- State registrations
- Regulatory approval

**Phase 5** (TODO):
- Production deployment
- Gradual rollout
- Monitoring

## 🧪 Testing

### Local (Nigiri)
```bash
# Start environment
docker-compose -f docker-compose.nigiri.yml up -d

# Initialize wallet
curl -X POST http://localhost:4000/api/bitcoin/initialize

# Check status
curl http://localhost:4000/api/bitcoin/status
```

### Testnet (Future)
- Mutinynet: https://mutinynet.arkade.sh
- Signet: https://signet.arkade.sh

## 📚 Key Documentation

1. **ArkadeOS Docs**: https://docs.arkadeos.com/wallets/v0.3/setup
2. **Nigiri Setup**: `Documentation/NIGIRI_SETUP.md`
3. **Integration Checklist**: `Documentation/BITCOIN_INTEGRATION_CHECKLIST.md`
4. **Business Plan**: `app/proofofputt-repos/Takeover.Reports/Financial.Innovation.Regulatory.Compliance.8.29.md`

## ⚠️ Important Warnings

### DO NOT:
- ❌ Enable features in production
- ❌ Apply database migrations to production
- ❌ Commit local testing changes
- ❌ Use real private keys in testing
- ❌ Skip security audits
- ❌ Launch without legal approval

### DO:
- ✅ Test thoroughly on Nigiri
- ✅ Complete security audits
- ✅ Verify regulatory compliance
- ✅ Document all changes
- ✅ Monitor carefully post-launch

## 🤝 Contributing

### Before Committing

1. **Verify config disabled**:
   ```bash
   grep "ENABLED.*true" app/src/config/bitcoin.js
   # Should return nothing
   ```

2. **Check environment**:
   ```bash
   grep "ARKADE_ENABLED=true" app/.env*
   # Should only be in .gitignored files
   ```

3. **Remove test changes**:
   - Revert `bitcoin.js` to `ENABLED: false`
   - Delete `.env.development.local`
   - Clean up any test data

### Branch Strategy

- **Current**: `feature/bitcoin-payment-integration`
- **Merge to**: `main` (when ready for production)
- **Deploy**: With feature flags, gradual rollout

## 📞 Support & Questions

For questions about:
- **ArkadeOS Integration**: https://docs.arkadeos.com
- **Regulatory Compliance**: Consult legal counsel
- **Security Audit**: Trail of Bits, ConsenSys Diligence
- **Implementation**: See `BITCOIN_INTEGRATION_CHECKLIST.md`

---

## 🎯 Vision

Enable **self-custodial bitcoin payments** for golf competitions without Proof of Putt ever taking custody of user funds. Create a **regulatory-compliant**, **security-audited**, **user-friendly** platform that sets the standard for skill-based gaming with bitcoin.

---

*Last Updated: 2025-01-18*
*Branch: feature/bitcoin-payment-integration*
*Status: Phase 1 Complete - Development Infrastructure Ready*
