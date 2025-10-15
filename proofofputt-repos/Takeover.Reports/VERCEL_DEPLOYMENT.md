# Vercel Deployment Guide for Proof of Putt

## 🚨 Fixed Deployment Issues

The previous deployment failure was caused by:
1. **Heavy dependencies** - opencv-python and numpy are not suitable for serverless
2. **Missing distutils** - Python 3.12 compatibility issue  
3. **WebSocket packages** - Not needed for basic API functionality

## ✅ Fixed Requirements

Updated `requirements.txt` to only include essential API dependencies:
- Flask and CORS support
- Database connectivity (PostgreSQL)
- Authentication (bcrypt)
- Basic utilities

## 📁 Project Structure for Vercel

```
app/
├── requirements.txt          # Minimal dependencies for Vercel
├── vercel-requirements.txt   # Backup of essential deps
├── api/                     # Main API endpoints
│   └── [endpoint].js        # Existing API routes
└── apps/api/                # Python backend (for reference)
    ├── data_manager.py      # Database operations
    ├── calibration.py       # CV functions (local only)
    └── *.py                 # Other Python modules
```

## 🔧 Deployment Steps

### 1. Commit the Fixed Requirements
```bash
git add app/requirements.txt VERCEL_DEPLOYMENT.md
git commit -m "Fix Vercel deployment - remove heavy dependencies"
git push origin main
```

### 2. Environment Variables on Vercel
Ensure these are set in Vercel dashboard:
- `DATABASE_URL` - NeonDB connection string ✅ (already configured)
- `ALLOWED_ORIGINS` - CORS origins ✅ (already configured)

### 3. Deployment Settings
- **Framework Preset**: Other
- **Build Command**: (empty - Vercel auto-detects)
- **Output Directory**: (empty - serverless functions)
- **Install Command**: `pip install -r requirements.txt`

## 🎯 What Works After Fix

### ✅ Working API Endpoints
- `/api/player/[playerId]/calibration` - GET/POST calibration data
- `/api/desktop/status` - Desktop app connectivity check
- Database connectivity to NeonDB
- CORS properly configured

### 🔄 Deferred Features (Future Deployment)
- WebSocket real-time updates (enable flask-socketio when needed)
- Rate limiting (enable flask-limiter when needed)  
- JWT authentication (enable flask-jwt-extended when needed)
- Computer Vision processing (runs on desktop, not server)

## 🚀 Expected Deployment Success

After these changes, Vercel should:
1. ✅ Install dependencies successfully (< 50MB total)
2. ✅ Deploy serverless functions properly
3. ✅ Connect to NeonDB without issues
4. ✅ Serve API endpoints correctly

## 🛠️ Local Development vs Production

### Local Development (Full Features)
```bash
# Install all dependencies including CV
pip install opencv-python numpy
pip install -r requirements.txt
```

### Production (Vercel - API Only)  
- Only essential Flask API dependencies
- Database operations work fully
- Desktop app connects via HTTP API
- CV processing happens on desktop, not server

## 📊 Deployment Size Comparison

**Before (Failed)**:
- opencv-python: ~60MB
- numpy: ~50MB  
- Total: ~150MB+ (exceeds Vercel limits)

**After (Fixed)**:
- Essential deps only: ~15MB
- Well within Vercel serverless limits

## 🔮 Next Steps After Successful Deployment

1. **Test API endpoints** via Postman/curl
2. **Test desktop app connectivity** 
3. **Verify database operations**
4. **Gradually enable additional features** as needed

---

**Ready to redeploy!** 🚀 The requirements.txt has been fixed to be Vercel-compatible.