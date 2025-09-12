# Proof of Putt - Web Application

**AI-Powered Golf Training & Competition Platform**

## Recent Updates (September 12, 2025)

### Latest UI/UX Improvements
- **✅ Modal Text Styling**: Fixed CSS specificity issues in CreateDuelModal for proper white text display
- **✅ League Table Headers**: Enhanced My Leagues and Public Leagues tables with yellow header backgrounds
- **✅ Contacts Page Consistency**: Updated navigation text from "Friends & Contacts" to "Contacts"
- **✅ Duel Logic Enhancement**: Fixed declined duels to delete completely instead of appearing as draws

### Core Features
- **Web-based Analytics**: Comprehensive putting performance tracking and visualization
- **Competition System**: Duels, leagues, and tournament management with real-time scoring
- **Social Integration**: Friend connections, leaderboards, and community features  
- **Cross-platform Sync**: Seamless integration with desktop computer vision tracking

## Technology Stack
- **Frontend**: React 19.1.1 + Vite 7.1.2 + React Router
- **Backend**: Node.js Serverless Functions (Vercel)
- **Database**: PostgreSQL (NeonDB)
- **Styling**: CSS Modules with Masters-inspired theme
- **State Management**: React Context API + Redux Toolkit

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## API Endpoints

The application includes 45+ API endpoints handling:
- User authentication and management
- Session tracking and analytics
- Competition management (duels, leagues)
- Social features and notifications
- Payment processing and subscriptions

## Deployment

- **Production**: https://app.proofofputt.com
- **API**: https://app.proofofputt.com/api
- **Platform**: Vercel with automatic deployments

---

*For complete technical documentation, see [CLAUDE.md](../claude.md)*
