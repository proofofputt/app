# Desktop-Web Integration Workflow Design
**Date: August 30, 2025**  
**Status: Design Phase**  
**Priority: Critical for MVP Launch**

## 🎯 Current Challenge

The desktop app and web interface need seamless integration for the core putting session workflow. Currently experiencing Tauri command errors when web interface tries to directly call desktop functions.

## 📋 Proposed User Workflow

### **Phase 1: Setup & Connection**
```
1. User downloads/installs desktop app (.dmg/.exe)
2. User launches desktop application 
3. User opens web interface in browser
4. User clicks "Check Connection" button
5. System verifies desktop app is running
6. Connection status indicator shows green/connected
```

### **Phase 2: Calibration Management**
```
1. System checks for existing calibration JSON for player
2. IF no calibration exists:
   - "Calibrate Camera" button highlighted/required
   - "Start New Session" button disabled
3. IF calibration exists:
   - Both buttons enabled
   - Calibration date shown in UI
```

### **Phase 3: Session Workflow**
```
1. User clicks "Start New Session" (if calibrated)
2. Web interface calls API endpoint /api/start-session
3. Desktop app polls API for new session requests
4. Desktop app begins computer vision tracking
5. Real-time stats update in both interfaces
6. Session completion syncs back to web platform
```

## 🏗️ Technical Architecture

### **Communication Flow**
```
Web Interface → API Endpoints → Desktop App Polling
     ↓              ↓              ↓
  User Actions → Session Requests → CV Processing
     ↑              ↑              ↑
  Status Updates ← Progress Reports ← Real-time Data
```

### **Separation of Concerns**
- **Web Interface**: User management, social features, statistics, leaderboards
- **Desktop App**: Computer vision, session tracking, calibration, real-time processing
- **API Layer**: Communication bridge, session management, data persistence

## 🔧 Implementation Requirements

### **Web Interface Changes**
1. Remove Tauri direct command calls
2. Implement proper connection checking via API
3. Add calibration status checking
4. Enable/disable buttons based on desktop app status
5. Real-time session status updates

### **API Endpoints Needed**
- `GET /api/desktop/status` - Check if desktop app is connected
- `GET /api/player/{id}/calibration` - Check calibration status
- `POST /api/start-session` - Request new session (existing)
- `POST /api/start-calibration` - Request calibration (existing)
- `GET /api/session/{id}/status` - Get live session updates

### **Desktop App Changes**
1. API polling service for session requests
2. Calibration status reporting
3. Real-time progress updates to API
4. Session completion reporting

## 🎮 User Experience Flow

### **Connection Check Process**
```javascript
// When "Check Connection" clicked
1. Call GET /api/desktop/status
2. If connected:
   - Show green status indicator
   - Call GET /api/player/{id}/calibration
   - Enable buttons based on calibration status
3. If disconnected:
   - Show red status indicator
   - Display "Please open desktop app" message
   - Disable all session buttons
```

### **Smart Button States**
```javascript
// Button state logic
if (!desktopConnected) {
  // All buttons disabled, show connection message
} else if (!isCalibrated) {
  // Only "Calibrate Camera" enabled and highlighted
  // "Start New Session" disabled with tooltip
} else {
  // Both buttons enabled
  // Show last calibration date
}
```

## 📊 Benefits of This Approach

### **Technical Benefits**
- ✅ Eliminates Tauri command errors
- ✅ Clean separation of web/desktop concerns
- ✅ Scalable architecture for multiple users
- ✅ Real-time status updates
- ✅ Robust error handling

### **User Experience Benefits**
- ✅ Clear connection status visibility
- ✅ Guided workflow (calibrate first, then sessions)
- ✅ No confusing error messages
- ✅ Seamless cross-platform experience
- ✅ Real-time feedback during sessions

## 🚀 Implementation Priority

### **Phase 1 (Critical)**
1. Fix Tauri command errors in web interface
2. Implement desktop connection checking
3. Add calibration status checking
4. Update button states based on status

### **Phase 2 (Enhancement)**
1. Real-time session updates
2. Advanced calibration management
3. Multiple camera support
4. Session history integration

## 💡 Technical Notes

### **Polling vs WebSockets**
- **Current**: Simple API polling (every 2-3 seconds)
- **Future**: WebSocket connections for real-time updates
- **Rationale**: Start simple, upgrade as needed

### **Calibration Storage**
- **Format**: JSON files per player ID
- **Location**: Desktop app local storage
- **API Integration**: Calibration status exposed via API
- **Backup**: Optional cloud sync for calibration data

### **Error Handling**
- **Connection Lost**: Clear messaging, retry options
- **Calibration Invalid**: Automatic re-calibration prompts
- **Session Failures**: Graceful degradation, local data preservation

## 🎯 Success Metrics

- ✅ Zero Tauri command errors in web interface
- ✅ <2 second connection check response time
- ✅ 100% calibration status accuracy
- ✅ Seamless session start workflow
- ✅ Real-time session data updates

## 📝 Next Steps

1. **Document current Tauri error fixes**
2. **Implement connection checking API endpoints**
3. **Update web interface button logic**
4. **Test complete workflow with desktop app**
5. **Deploy and validate user experience**

---

**Status**: Ready for implementation  
**Assigned**: Claude Code Assistant  
**Review**: Pending user approval  
**Target**: MVP Launch Ready