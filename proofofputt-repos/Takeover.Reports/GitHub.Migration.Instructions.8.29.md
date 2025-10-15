# 🚀 GITHUB MIGRATION INSTRUCTIONS

**Date:** August 29, 2025  
**Document Type:** Step-by-Step GitHub Setup & Deployment Guide  
**Status:** Ready for Manual Execution  

---

## 📋 **GITHUB REPOSITORY CREATION**

### **Step 1: Create Repository on GitHub**

1. **Go to GitHub.com and sign in**
2. **Click "New Repository" (green button)**
3. **Repository Settings:**
   ```
   Repository Name: proof-of-putt
   Description: AI-powered golf putting training and competition platform with blockchain-enabled wagering
   Visibility: Private (recommended for now)
   ✅ Add a README file: NO (we already have one)
   ✅ Add .gitignore: NO (we already have one)  
   ✅ Choose a license: NO (proprietary for now)
   ```
4. **Click "Create Repository"**

### **Step 2: Repository Settings Configuration**

Once repository is created, go to **Settings** tab:

#### **General Settings**
- ✅ **Repository name**: proof-of-putt
- ✅ **Description**: AI-powered golf putting training and competition platform
- ✅ **Website**: https://proofofputt.com (when live)
- ✅ **Topics**: `golf`, `ai`, `computer-vision`, `sports-tech`, `react`, `python`, `tauri`

#### **Features Configuration**
- ✅ **Wikis**: Disabled
- ✅ **Issues**: Enabled
- ✅ **Sponsorships**: Disabled
- ✅ **Discussions**: Disabled
- ✅ **Projects**: Enabled

#### **Pull Requests Settings**
- ✅ **Allow merge commits**: Enabled
- ✅ **Allow squash merging**: Enabled  
- ✅ **Allow rebase merging**: Enabled
- ✅ **Always suggest updating pull request branches**: Enabled
- ✅ **Automatically delete head branches**: Enabled

### **Step 3: Branch Protection (Recommended)**

Go to **Settings → Branches**:

1. **Add rule for `main` branch:**
   ```
   Branch name pattern: main
   ✅ Restrict pushes that create files larger than 100 MB
   ✅ Require a pull request before merging (for team development)
   ✅ Require status checks to pass before merging
   ```

---

## 🔗 **CONNECT LOCAL REPOSITORY TO GITHUB**

### **Commands to Execute in Terminal**

**Navigate to project directory:**
```bash
cd /Users/nw/proofofputt
```

**Check current git status:**
```bash
git status
```

**Add GitHub remote (replace [USERNAME] with your GitHub username):**
```bash
git remote add origin https://github.com/[USERNAME]/proof-of-putt.git
```

**Verify remote was added:**
```bash
git remote -v
```

**Stage all current files:**
```bash
git add .
```

**Commit the clean repository state:**
```bash
git commit -m "Initial commit: Complete Proof of Putt platform

✅ Core Features Implemented:
- Flask API backend with PostgreSQL integration
- React web application with responsive design  
- Tauri desktop application with computer vision
- Complete user management and authentication
- Duels and leagues competition system
- Fundraising platform with pledge system
- Password recovery and subscription management

🏗️ Architecture:
- Backend: Flask + SQLAlchemy + PostgreSQL
- Frontend: React + Vite + React Router
- Desktop: Tauri + Rust + React
- Deployment: Vercel + NeonDB ready

🎯 Ready for production deployment and user testing"
```

**Push to GitHub:**
```bash
git branch -M main
git push -u origin main
```

---

## ⚙️ **VERCEL DEPLOYMENT SETUP**

### **Step 1: Connect GitHub to Vercel**

1. **Go to vercel.com and sign in**
2. **Click "New Project"**
3. **Import Git Repository:**
   - Select your GitHub account
   - Choose `proof-of-putt` repository
   - Click "Import"

### **Step 2: Configure Vercel Build Settings**

```
Framework Preset: Vite
Root Directory: frontend/webapp
Build Command: npm run build  
Output Directory: dist
Install Command: npm install
```

### **Step 3: Environment Variables**

In Vercel dashboard, go to **Settings → Environment Variables** and add:

```bash
# Database Configuration
DATABASE_URL=postgresql://username:password@host:5432/database
DIRECT_URL=postgresql://username:password@host:5432/database

# API Configuration  
ALLOWED_ORIGINS=https://proof-of-putt.vercel.app,https://proofofputt.com

# Optional: AI Coach (if using)
GEMINI_API_KEY=your_gemini_api_key

# Application Settings
NODE_ENV=production
VITE_API_BASE_URL=https://proof-of-putt.vercel.app
```

---

## 🗄️ **NEONDB POSTGRESQL SETUP**

### **Step 1: Create NeonDB Account**

1. **Go to neon.tech and sign up**
2. **Create new project:**
   ```
   Project Name: proof-of-putt
   Database Name: proofofputt_production
   Region: US East (or closest to your users)
   ```

### **Step 2: Get Connection Details**

After creating the database, you'll get:
```
Connection String: 
postgresql://username:password@host.neon.tech:5432/database?sslmode=require

Direct Connection:
postgresql://username:password@host.neon.tech:5432/database
```

### **Step 3: Database Schema Creation**

The database tables will be automatically created when the app first runs, thanks to this code in `data_manager.py`:
```python
def initialize_database():
    """Creates the database tables if they don't exist"""
```

Tables that will be created:
- `players` - User accounts and profiles
- `sessions` - Putting session data  
- `duels` - Competition challenges
- `leagues` - Tournament systems
- `password_reset_tokens` - Password recovery
- `fundraisers` - Charity campaigns
- `pledges` - Fundraising commitments

---

## 🔐 **SECURITY CONFIGURATION**

### **Environment Variables Security**

**Never commit these to Git:**
- Database passwords
- API keys  
- Secret tokens
- Production URLs

**Store in Vercel Environment Variables only**

### **Database Security**

**NeonDB automatically provides:**
- SSL/TLS encryption
- Connection pooling
- Automatic backups
- Point-in-time recovery

### **API Security**

**Already implemented in codebase:**
- bcrypt password hashing
- SQL injection protection (parameterized queries)
- CORS configuration
- Input validation

---

## 🚀 **DEPLOYMENT VERIFICATION**

### **Step 1: Verify Vercel Deployment**

After pushing to GitHub, Vercel should automatically:
1. Detect the push
2. Start building the frontend
3. Deploy to a URL like: `https://proof-of-putt.vercel.app`

### **Step 2: Test Database Connection**

Visit your deployed URL and check:
- ✅ Homepage loads
- ✅ Registration works
- ✅ Login functionality  
- ✅ Database tables are created
- ✅ API endpoints respond

### **Step 3: Monitor Deployment Logs**

In Vercel dashboard:
- **Functions → View Function Logs** (for API endpoints)
- **Deployments → View Build Logs** (for build issues)

---

## 🔧 **TROUBLESHOOTING COMMON ISSUES**

### **Build Failures**

**Issue**: Vite build fails
**Solution**: Check that `frontend/webapp` contains:
- `package.json`
- `vite.config.js`  
- `src/` directory
- All dependencies in package.json

### **Database Connection Issues**

**Issue**: "Connection refused" or "Database not found"
**Solution**:
1. Verify NeonDB connection string is correct
2. Check environment variables in Vercel
3. Ensure `psycopg2-binary` is in requirements.txt

### **API Endpoint 404 Errors**

**Issue**: `/api/*` routes return 404
**Solution**: Verify `vercel.json` is in repository root:
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

### **CORS Issues**

**Issue**: Frontend can't connect to API
**Solution**: Update `ALLOWED_ORIGINS` in Vercel environment variables to include your Vercel URL

---

## 📱 **CUSTOM DOMAIN SETUP (OPTIONAL)**

### **Step 1: Purchase Domain**

Register `proofofputt.com` or similar

### **Step 2: Configure in Vercel**

1. **Go to Vercel Project Settings**
2. **Domains section**
3. **Add domain: proofofputt.com**
4. **Follow DNS configuration instructions**

### **Step 3: Update Environment Variables**

Add your custom domain to `ALLOWED_ORIGINS`:
```
ALLOWED_ORIGINS=https://proofofputt.com,https://proof-of-putt.vercel.app
```

---

## 🎯 **POST-DEPLOYMENT CHECKLIST**

### **Immediate Testing**
- [ ] Homepage loads correctly
- [ ] User registration works
- [ ] User login functions
- [ ] Dashboard displays properly
- [ ] API endpoints respond
- [ ] Database queries execute

### **Feature Testing**
- [ ] Session tracking (if desktop app connected)
- [ ] Duel creation and management
- [ ] League functionality
- [ ] Password recovery system
- [ ] Subscription upgrade flow
- [ ] Fundraising features

### **Performance Testing**
- [ ] Page load times <3 seconds
- [ ] API response times <200ms
- [ ] Database query performance
- [ ] Mobile responsiveness

### **Security Testing**  
- [ ] HTTPS enforced
- [ ] Authentication required for protected routes
- [ ] SQL injection protection
- [ ] XSS protection
- [ ] CORS properly configured

---

## 📞 **SUPPORT CONTACTS**

### **Platform Support**
- **GitHub**: github.com/support
- **Vercel**: vercel.com/support  
- **NeonDB**: neon.tech/docs

### **Deployment Issues**
- Check Vercel function logs for API errors
- Review NeonDB monitoring for database issues
- Use browser developer tools for frontend debugging

---

## 🎉 **SUCCESS CRITERIA**

**Deployment Complete When:**
- ✅ GitHub repository accessible and organized
- ✅ Vercel deployment successful with green status
- ✅ NeonDB connection established and tables created
- ✅ All major user workflows functional
- ✅ API endpoints responding correctly
- ✅ Frontend-backend integration working
- ✅ Security measures active and tested

**You now have a production-ready Proof of Putt platform deployed on modern, scalable infrastructure!**

---

*GitHub Migration Instructions - Prepared August 29, 2025*  
*Ready for immediate execution and deployment*