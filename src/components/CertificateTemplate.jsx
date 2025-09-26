import React from 'react';
import { format } from 'date-fns';

/**
 * Achievement Certificate Template System
 *
 * Generates blockchain-verified achievement certificates with customizable
 * themes, colors, and layouts for different achievement types and rarities.
 */

// Certificate color themes by rarity
const RARITY_THEMES = {
  rare: {
    primary: '#2D5A27',      // Dark green (Proof of Putt brand)
    secondary: '#D4AF37',    // Gold accent
    background: '#F8F9FA',   // Light gray
    border: '#2D5A27',       // Dark green border
    text: '#1A1A1A',         // Dark text
    accent: '#4A7C59'        // Medium green
  },
  epic: {
    primary: '#4A0E4E',      // Deep purple
    secondary: '#FF6B35',    // Orange accent
    background: '#FFF8F0',   // Warm white
    border: '#4A0E4E',       // Purple border
    text: '#2C2C2C',         // Dark gray text
    accent: '#7B2D8E'        // Medium purple
  },
  legendary: {
    primary: '#8B0000',      // Dark red
    secondary: '#FFD700',    // Pure gold
    background: '#FFF5E6',   // Cream background
    border: '#8B0000',       // Red border
    text: '#000000',         // Black text
    accent: '#CD853F'        // Sandy brown
  }
};

// Achievement type configurations
const ACHIEVEMENT_CONFIG = {
  consecutive_makes: {
    title: 'Consecutive Excellence',
    icon: '🎯',
    description: 'consecutive putts made',
    subtitle: 'Precision & Consistency'
  },
  perfect_session: {
    title: 'Perfect Precision',
    icon: '💯',
    description: 'perfect putting session',
    subtitle: 'Flawless Performance'
  },
  career_milestone: {
    title: 'Career Achievement',
    icon: '🏆',
    description: 'career putts made',
    subtitle: 'Lifetime Excellence'
  },
  accuracy_milestone: {
    title: 'Accuracy Mastery',
    icon: '🎪',
    description: 'career accuracy achieved',
    subtitle: 'Consistent Precision'
  },
  competition_win: {
    title: 'Victory Champion',
    icon: '👑',
    description: 'competitive victory',
    subtitle: 'Proven Under Pressure'
  }
};

/**
 * Main Certificate Component
 */
const CertificateTemplate = ({
  certificateData,
  playerData,
  customTheme = null,
  size = 'standard' // 'standard', 'compact', 'large'
}) => {
  const achievement = certificateData.achievement_data;
  const rarity = achievement.rarity_tier || 'rare';
  const achievementType = certificateData.achievement_type;

  // Use custom theme or default rarity theme
  const theme = customTheme || RARITY_THEMES[rarity] || RARITY_THEMES.rare;
  const config = ACHIEVEMENT_CONFIG[achievementType] || ACHIEVEMENT_CONFIG.consecutive_makes;

  // Certificate dimensions based on size
  const dimensions = {
    standard: { width: 800, height: 600 },
    compact: { width: 600, height: 450 },
    large: { width: 1000, height: 750 }
  };

  const { width, height } = dimensions[size];

  // Format achievement value for display
  const formatAchievementValue = () => {
    const value = certificateData.achievement_value;

    switch (achievementType) {
      case 'consecutive_makes':
        return `${value}`;
      case 'perfect_session':
        return `${value}/${value}`;
      case 'career_milestone':
        return value.toLocaleString();
      case 'accuracy_milestone':
        return `${value}%`;
      case 'competition_win':
        return achievement.achievement_subtype === 'first_duel_victory' ? '1st' : `#${value}`;
      default:
        return value.toString();
    }
  };

  // Format dates
  const achievedDate = format(new Date(certificateData.achieved_at), 'MMMM dd, yyyy');
  const issuedDate = format(new Date(certificateData.certificate_issued_at || certificateData.achieved_at), 'MMMM dd, yyyy');

  return (
    <div
      className="certificate-container"
      style={{
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor: theme.background,
        border: `4px solid ${theme.border}`,
        borderRadius: '12px',
        padding: '40px',
        fontFamily: "'Georgia', serif",
        position: 'relative',
        boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}
    >
      {/* Decorative corner elements */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        width: '60px',
        height: '60px',
        border: `3px solid ${theme.secondary}`,
        borderRight: 'none',
        borderBottom: 'none',
        borderRadius: '8px 0 0 0'
      }} />

      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        width: '60px',
        height: '60px',
        border: `3px solid ${theme.secondary}`,
        borderLeft: 'none',
        borderBottom: 'none',
        borderRadius: '0 8px 0 0'
      }} />

      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        width: '60px',
        height: '60px',
        border: `3px solid ${theme.secondary}`,
        borderRight: 'none',
        borderTop: 'none',
        borderRadius: '0 0 0 8px'
      }} />

      <div style={{
        position: 'absolute',
        bottom: '20px',
        right: '20px',
        width: '60px',
        height: '60px',
        border: `3px solid ${theme.secondary}`,
        borderLeft: 'none',
        borderTop: 'none',
        borderRadius: '0 0 8px 0'
      }} />

      {/* Header Section */}
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        {/* Proof of Putt Branding */}
        <div style={{
          fontSize: '24px',
          fontWeight: 'bold',
          color: theme.primary,
          marginBottom: '10px',
          letterSpacing: '2px'
        }}>
          PROOF OF PUTT
        </div>

        {/* Certificate Title */}
        <h1 style={{
          fontSize: '36px',
          fontWeight: 'bold',
          color: theme.primary,
          margin: '0 0 10px 0',
          textShadow: `1px 1px 2px ${theme.accent}30`
        }}>
          {config.title}
        </h1>

        {/* Subtitle */}
        <div style={{
          fontSize: '18px',
          color: theme.accent,
          fontStyle: 'italic',
          marginBottom: '20px'
        }}>
          {config.subtitle}
        </div>

        {/* Rarity Badge */}
        <div style={{
          display: 'inline-block',
          backgroundColor: theme.secondary,
          color: theme.background,
          padding: '6px 16px',
          borderRadius: '20px',
          fontSize: '14px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: '1px'
        }}>
          {rarity}
        </div>
      </div>

      {/* Main Content Section */}
      <div style={{ textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {/* Achievement Icon */}
        <div style={{
          fontSize: '64px',
          marginBottom: '20px'
        }}>
          {config.icon}
        </div>

        {/* Recognition Text */}
        <div style={{
          fontSize: '20px',
          color: theme.text,
          marginBottom: '15px',
          lineHeight: '1.4'
        }}>
          This certifies that
        </div>

        {/* Player Name - CUSTOMIZABLE INSERTION POINT */}
        <div style={{
          fontSize: '32px',
          fontWeight: 'bold',
          color: theme.primary,
          marginBottom: '20px',
          textTransform: 'uppercase',
          letterSpacing: '2px',
          borderBottom: `2px solid ${theme.secondary}`,
          paddingBottom: '10px',
          display: 'inline-block',
          minWidth: '300px'
        }}>
          {playerData?.username || playerData?.display_name || 'PLAYER NAME'}
        </div>

        {/* Achievement Description */}
        <div style={{
          fontSize: '20px',
          color: theme.text,
          marginBottom: '15px',
          lineHeight: '1.4'
        }}>
          has accomplished
        </div>

        {/* Achievement Value - CUSTOMIZABLE INSERTION POINT */}
        <div style={{
          fontSize: '48px',
          fontWeight: 'bold',
          color: theme.secondary,
          marginBottom: '10px',
          textShadow: `2px 2px 4px ${theme.primary}30`
        }}>
          {formatAchievementValue()}
        </div>

        {/* Achievement Type Description */}
        <div style={{
          fontSize: '18px',
          color: theme.accent,
          fontStyle: 'italic'
        }}>
          {config.description}
        </div>
      </div>

      {/* Footer Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end' }}>
        {/* Left Footer - Dates */}
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: '12px', color: theme.accent, marginBottom: '4px' }}>
            Achieved: {achievedDate}
          </div>
          <div style={{ fontSize: '12px', color: theme.accent }}>
            Certified: {issuedDate}
          </div>
        </div>

        {/* Center Footer - Blockchain Verification */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '10px',
            color: theme.accent,
            marginBottom: '4px'
          }}>
            BLOCKCHAIN VERIFIED
          </div>
          <div style={{
            fontSize: '8px',
            color: theme.text,
            fontFamily: 'monospace',
            backgroundColor: `${theme.accent}10`,
            padding: '2px 6px',
            borderRadius: '4px'
          }}>
            {certificateData.data_hash?.substring(0, 16) || 'VERIFICATION'}...
          </div>
        </div>

        {/* Right Footer - Certificate ID */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '10px', color: theme.accent, marginBottom: '4px' }}>
            Certificate ID
          </div>
          <div style={{
            fontSize: '8px',
            color: theme.text,
            fontFamily: 'monospace'
          }}>
            {certificateData.certificate_id?.substring(0, 8) || 'CERT-ID'}
          </div>
        </div>
      </div>

      {/* Satoshi Sunday Branding */}
      <div style={{
        position: 'absolute',
        bottom: '5px',
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: '8px',
        color: `${theme.accent}80`,
        textAlign: 'center'
      }}>
        Issued on Satoshi Sunday • OpenTimestamps Blockchain Certification
      </div>
    </div>
  );
};

/**
 * Certificate Configuration Helper
 * Use this to customize certificate appearance
 */
export const createCustomTheme = (options = {}) => {
  return {
    primary: options.primary || '#2D5A27',
    secondary: options.secondary || '#D4AF37',
    background: options.background || '#F8F9FA',
    border: options.border || '#2D5A27',
    text: options.text || '#1A1A1A',
    accent: options.accent || '#4A7C59'
  };
};

/**
 * Certificate Preview Component for Admin/Testing
 */
export const CertificatePreview = ({ achievementType = 'consecutive_makes', rarity = 'rare', value = 21 }) => {
  const sampleData = {
    certificate_id: 'sample-cert-123',
    achievement_type: achievementType,
    achievement_value: value,
    achieved_at: new Date().toISOString(),
    certificate_issued_at: new Date().toISOString(),
    data_hash: 'a1b2c3d4e5f6789012345678901234567890abcdef123456789012345678901234',
    achievement_data: {
      rarity_tier: rarity,
      description: `Sample ${achievementType} achievement`
    }
  };

  const samplePlayer = {
    username: 'SAMPLE_PLAYER',
    display_name: 'Sample Player'
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f0f0' }}>
      <h3>Certificate Preview - {achievementType} ({rarity})</h3>
      <CertificateTemplate
        certificateData={sampleData}
        playerData={samplePlayer}
        size="standard"
      />
    </div>
  );
};

export default CertificateTemplate;