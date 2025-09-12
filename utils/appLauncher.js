/**
 * App Launcher Utility
 * Provides functionality to try opening the desktop app with fallback notification
 */

export const tryOpenApp = (showNotification = null) => {
    // Try to open the desktop app using the custom protocol
    const desktopAppUrl = 'proofofputt://open';
    
    try {
        // Create a temporary link element to trigger the protocol
        const link = document.createElement('a');
        link.href = desktopAppUrl;
        link.style.display = 'none';
        
        // Add to DOM temporarily
        document.body.appendChild(link);
        
        // Track if app was opened successfully
        let appOpened = false;
        
        // Create a timer to detect if the app didn't open
        const timeout = setTimeout(() => {
            if (!appOpened) {
                // App likely didn't open, show fallback notification
                if (showNotification) {
                    showNotification(
                        '📱 Desktop app not found. Please download and install the Proof of Putt desktop app to use this feature.',
                        false
                    );
                } else {
                    alert('Desktop app not found. Please download and install the Proof of Putt desktop app to use this feature.');
                }
            }
            document.body.removeChild(link);
        }, 1000); // 1 second timeout
        
        // Handle page visibility change (app opened successfully)
        const handleVisibilityChange = () => {
            if (document.hidden) {
                // Page became hidden, likely because app opened
                appOpened = true;
                clearTimeout(timeout);
                if (showNotification) {
                    showNotification('✅ Opening desktop app...', false);
                }
                document.removeEventListener('visibilitychange', handleVisibilityChange);
                document.body.removeChild(link);
            }
        };
        
        // Listen for visibility changes
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        // Attempt to open the app
        link.click();
        
    } catch (error) {
        console.error('Failed to open desktop app:', error);
        if (showNotification) {
            showNotification(
                '❌ Failed to open desktop app. Please ensure the desktop app is installed.',
                true
            );
        } else {
            alert('Failed to open desktop app. Please ensure the desktop app is installed.');
        }
    }
};

export const tryOpenAppWithParameters = (parameters, showNotification = null) => {
    // Try to open the desktop app with parameters
    const desktopAppUrl = `proofofputt://start-session?${parameters}`;
    
    try {
        // Create a temporary link element to trigger the protocol
        const link = document.createElement('a');
        link.href = desktopAppUrl;
        link.style.display = 'none';
        
        // Add to DOM temporarily
        document.body.appendChild(link);
        
        // Track if app was opened successfully
        let appOpened = false;
        
        // Create a timer to detect if the app didn't open
        const timeout = setTimeout(() => {
            if (!appOpened) {
                // App likely didn't open, show fallback notification
                if (showNotification) {
                    showNotification(
                        '📱 Desktop app not found. Please download and install the Proof of Putt desktop app, then use the "Copy Parameters" button to manually enter session details.',
                        false
                    );
                } else {
                    alert('Desktop app not found. Please download and install the Proof of Putt desktop app, then use the "Copy Parameters" button to manually enter session details.');
                }
            }
            document.body.removeChild(link);
        }, 1000); // 1 second timeout
        
        // Handle page visibility change (app opened successfully)
        const handleVisibilityChange = () => {
            if (document.hidden) {
                // Page became hidden, likely because app opened
                appOpened = true;
                clearTimeout(timeout);
                if (showNotification) {
                    showNotification('✅ Opening desktop app with session parameters...', false);
                }
                document.removeEventListener('visibilitychange', handleVisibilityChange);
                document.body.removeChild(link);
            }
        };
        
        // Listen for visibility changes
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        // Attempt to open the app with parameters
        link.click();
        
    } catch (error) {
        console.error('Failed to open desktop app with parameters:', error);
        if (showNotification) {
            showNotification(
                '❌ Failed to open desktop app. Please ensure the desktop app is installed, then use "Copy Parameters" to manually enter session details.',
                true
            );
        } else {
            alert('Failed to open desktop app. Please ensure the desktop app is installed, then use "Copy Parameters" to manually enter session details.');
        }
    }
};