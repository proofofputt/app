# 🎯 SINGLE REPOSITORY DEPLOYMENT STRATEGY

**Date:** August 29, 2025  
**Document Type:** Minimal Code Change Deployment Guide  
**Recommendation:** Single Repository (Monorepo) Approach  

---

## ✅ **RECOMMENDED: SINGLE REPOSITORY APPROACH**

Based on your current coded dependencies and desire to avoid large code changes, **use a single GitHub repository** with the current directory structure intact.

### **Why Single Repository is Best for You:**

1. **Zero Code Changes Required** - Current relative imports work perfectly
2. **Existing Dependencies Preserved** - All `../` paths remain functional  
3. **Vercel Handles Multi-Directory** - Can deploy different parts from same repo
4. **Current Structure Already Works** - No refactoring needed

---

## 📁 **CURRENT STRUCTURE (KEEP AS-IS)**

```
proof-of-putt/                    # Single GitHub repository
├── backend/                      # Flask API → Vercel Functions
│   ├── api.py                   # Main API file
│   ├── data_manager.py          # Database operations
│   ├── requirements.txt         # Python dependencies
│   └── vercel.json             # Vercel deployment config
├── frontend/webapp/             # React App → Vercel Static
│   ├── src/
│   ├── package.json
│   └── vite.config.js
├── desktop/                     # Tauri App (separate build)
│   ├── src-tauri/
│   ├── src/
│   └── package.json
└── README.md
```

---

## 🚀 **VERCEL DEPLOYMENT CONFIGURATION**

### **Single Project, Multiple Deployments**

**Option 1: Backend + Frontend in Same Vercel Project (RECOMMENDED)**

```json
// vercel.json (in repository root)
{
  "functions": {
    "backend/api.py": {
      "runtime": "python3.12"
    }
  },
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/backend/api.py"
    },
    {
      "src": "/(.*)",
      "dest": "/frontend/webapp/dist/$1"
    }
  ],
  "builds": [
    {
      "src": "frontend/webapp/package.json",
      "use": "@vercel/node"
    }
  ]
}
```

**Vercel Project Settings:**
```
Framework Preset: Vite
Root Directory: frontend/webapp  
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

### **Environment Variables (Single Set)**
```bash
# Database
DATABASE_URL=your_neondb_connection_string

# CORS (include your Vercel domain)
ALLOWED_ORIGINS=https://your-project.vercel.app,https://proofofputt.com

# API Base (frontend will use same domain)
VITE_API_BASE_URL=https://your-project.vercel.app

# Optional
GEMINI_API_KEY=your_key_if_needed
```

---

## 📂 **CURRENT FILE STRUCTURE ADVANTAGES**

### **✅ Backend Dependencies Work**
Your current imports work perfectly:
```python
# These relative imports continue working
import data_manager
import notification_service  
from utils import get_camera_index_from_config
```

### **✅ Frontend API Calls Work**
Your current API configuration continues working:
```javascript
// frontend/webapp/src/api.js
const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:5001';
// In production: https://your-project.vercel.app/api
```

### **✅ Desktop App Independence**
Desktop app builds separately and calls the deployed API:
```javascript
// Desktop will call: https://your-project.vercel.app/api/*
```

---

## 🔄 **DEPLOYMENT WORKFLOW**

### **Step 1: Single Git Repository**
```bash
# One repository contains everything
git add .
git commit -m "Complete platform ready for deployment"
git push origin main
```

### **Step 2: Single Vercel Project**
- Import the GitHub repository
- Vercel automatically detects and builds frontend/webapp
- Backend functions deploy automatically via vercel.json
- One domain serves both frontend and API

### **Step 3: Desktop App (Separate Build)**
```bash
# Build desktop app locally or via separate CI
cd desktop
npm run tauri build
# Distribute .app/.exe files separately
```

---

## 🎯 **ZERO CODE CHANGES REQUIRED**

### **Backend (No Changes)**
- All imports continue working
- Database connections unchanged
- API endpoints remain identical
- File structure preserved

### **Frontend (No Changes)**  
- All component imports work
- API client unchanged
- Build process identical
- Environment variables same pattern

### **Desktop (No Changes)**
- Tauri configuration unchanged
- React components reused
- API calls to production URL
- Build process preserved

---

## 🌐 **HOW IT WORKS IN PRODUCTION**

### **Single Domain Architecture**
```
https://your-project.vercel.app/
├── /                    → Frontend (React app)
├── /login              → Frontend routes
├── /dashboard          → Frontend routes
├── /api/login          → Backend API
├── /api/sessions       → Backend API
└── /api/*              → All backend endpoints
```

### **Request Flow**
1. **User visits** `https://your-project.vercel.app`
2. **Vercel serves** React app from `frontend/webapp/dist`
3. **React makes API calls** to `/api/*` (same domain)
4. **Vercel routes** `/api/*` to `backend/api.py` functions
5. **Desktop app calls** same API endpoints

---

## 🔧 **MINIMAL CONFIGURATION UPDATES**

### **Only Update These Files:**

**1. Update `frontend/webapp/src/api.js`:**
```javascript
// Change this line to use relative paths in production
const API_BASE_URL = process.env.VITE_API_BASE_URL || 
  (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:5001');
```

**2. Ensure `vercel.json` exists in root:**
```json
{
  "functions": {
    "backend/api.py": {
      "runtime": "python3.12"
    }
  },
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/backend/api.py"
    },
    {
      "src": "/(.*)",
      "dest": "/frontend/webapp/dist/$1"
    }
  ]
}
```

**That's it! No other code changes needed.**

---

## ✅ **ADVANTAGES OF THIS APPROACH**

### **Development Benefits**
- **No refactoring required** - current structure preserved
- **Familiar workflow** - same development process
- **Easy debugging** - all code in one place
- **Consistent dependencies** - no version conflicts

### **Deployment Benefits**  
- **Single deployment** - one Vercel project handles everything
- **Shared environment variables** - configure once, use everywhere
- **Same domain** - no CORS complexity in production
- **Cost effective** - one Vercel project vs. multiple

### **Maintenance Benefits**
- **Unified versioning** - single repository tags/releases
- **Simplified CI/CD** - one deployment pipeline
- **Easier backup** - single repository to backup
- **Team collaboration** - everyone works in same repository

---

## 🚨 **WHAT NOT TO DO**

### **❌ Avoid These Approaches (Too Complex):**
- Splitting into multiple repositories (requires import refactoring)
- Separate Vercel projects (adds CORS complexity)  
- Restructuring file organization (breaks existing imports)
- Changing API base URLs (requires frontend updates)

### **✅ Keep It Simple:**
- Single repository with current structure
- Single Vercel project with routing
- Current imports and dependencies unchanged
- Minimal configuration updates only

---

## 🎯 **FINAL RECOMMENDATION**

**Use the single repository approach with your current directory structure.** This requires minimal changes, preserves all your current code dependencies, and leverages Vercel's ability to handle multi-component projects from a single repository.

Your current codebase is already perfectly structured for this approach - don't fix what isn't broken!

---

*Single Repository Deployment Strategy - August 29, 2025*  
*Minimal Code Changes, Maximum Compatibility*