import React, { useState } from 'react';
import { initiateGoogleOAuth, /* initiateLinkedInOAuth, */ openOAuthPopup, OAUTH_PROVIDERS } from '../utils/oauth';
// import { authenticateWithNostr, isNostrAvailable } from '../utils/nostr';
import './OAuthButton.css';

const OAuthButton = ({ provider, onSuccess, onError, disabled = false, mode = 'signin' }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleOAuthClick = async () => {
    if (disabled || isLoading) return;

    setIsLoading(true);

    try {
      let authData;
      
      // Get authorization URL from backend
      if (provider === 'google') {
        authData = await initiateGoogleOAuth();
      }
      // LinkedIn and Nostr authentication temporarily disabled
      // else if (provider === 'linkedin') {
      //   authData = await initiateLinkedInOAuth();
      // } else if (provider === 'nostr') {
      //   // Nostr authentication is handled directly (no popup needed)
      //   const nostrResult = await authenticateWithNostr();
      //
      //   if (nostrResult.success && nostrResult.token) {
      //     localStorage.setItem('authToken', nostrResult.token);
      //
      //     if (onSuccess) {
      //       onSuccess({
      //         token: nostrResult.token,
      //         provider: 'nostr'
      //       });
      //     }
      //   } else {
      //     throw new Error(nostrResult.error || 'Nostr authentication failed');
      //   }
      //
      //   setIsLoading(false);
      //   return;
      // }
      else {
        throw new Error(`Unsupported provider: ${provider}`);
      }

      // Open popup and wait for result
      const result = await openOAuthPopup(authData.authUrl, provider);

      if (result.success && result.token) {
        // Store token and call success callback
        localStorage.setItem('authToken', result.token);
        
        if (onSuccess) {
          onSuccess({
            token: result.token,
            provider: result.provider || provider
          });
        }
      } else {
        throw new Error(result.error || 'Authentication failed');
      }

    } catch (error) {
      console.error(`${provider} OAuth error:`, error);
      
      if (onError) {
        onError(error.message || `${provider} authentication failed`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const providerInfo = OAUTH_PROVIDERS[provider];
  if (!providerInfo) {
    return null;
  }

  const buttonText = isLoading 
    ? `Connecting...`
    : mode === 'link' 
      ? `Link ${providerInfo.name}`
      : providerInfo.displayName;

  return (
    <button
      type="button"
      className={`oauth-button oauth-button-${provider} ${isLoading ? 'loading' : ''}`}
      onClick={handleOAuthClick}
      disabled={disabled || isLoading}
      style={{ '--provider-color': providerInfo.color }}
    >
      <span className="oauth-icon" aria-hidden="true">
        {providerInfo.icon}
      </span>
      <span className="oauth-text">
        {buttonText}
      </span>
      {isLoading && (
        <span className="oauth-spinner" aria-hidden="true">
          ⏳
        </span>
      )}
    </button>
  );
};

export default OAuthButton;