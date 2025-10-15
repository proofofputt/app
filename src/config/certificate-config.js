/**
 * Certificate Configuration System
 *
 * Centralized configuration for all certificate templates, themes, colors,
 * text, and branding. Modify these values to customize certificate appearance.
 */

// ===========================================
// BRANDING CONFIGURATION
// ===========================================
export const BRANDING = {
  company_name: 'PROOF OF PUTT',
  company_tagline: 'Blockchain-Verified Golf Achievement',
  logo_url: '/POP.Proof_Of_Putt.Log.576.png', // Optional: path to logo image
  website: 'proofofputt.com',
  satoshi_sunday_text: 'Issued on Satoshi Sunday • OpenTimestamps Blockchain Certification'
};

// ===========================================
// COLOR THEMES BY RARITY - Using Official Proof of Putt Brand Colors
// ===========================================
export const RARITY_THEMES = {
  // RARE (Official Masters Green Theme - Proof of Putt Brand Colors)
  rare: {
    name: 'Masters Champion',
    primary: '#003d15',        // Masters Green Dark (official brand)
    secondary: '#FFD700',      // Highlighter Yellow (official brand)
    background: '#f0e6d6',     // Sand Color (official brand)
    border: '#188400',         // Masters Green Light (official brand)
    text: '#333333',           // Text Dark (official brand)
    accent: '#2e5c00',         // Masters Green Medium (official brand)
    gradient: 'linear-gradient(135deg, #003d15, #188400)' // Brand gradient
  },

  // EPIC (Enhanced Masters Theme - Premium Feel)
  epic: {
    name: 'Elite Masters',
    primary: '#003d15',        // Masters Green Dark (official)
    secondary: '#d58114',      // Highlighter Yellow Hover (official)
    background: '#ffffff',     // Pure white for premium feel
    border: '#2e5c00',         // Masters Green Medium (official)
    text: '#333333',           // Text Dark (official)
    accent: '#188400',         // Masters Green Light (official)
    gradient: 'linear-gradient(135deg, #003d15, #2e5c00)'
  },

  // LEGENDARY (Ultimate Masters Theme - Prestige)
  legendary: {
    name: 'Legendary Master',
    primary: '#003d15',        // Masters Green Dark (official)
    secondary: '#FFD700',      // Pure Highlighter Yellow (official)
    background: '#f0e6d6',     // Sand Color (official)
    border: '#FFD700',         // Gold border for prestige
    text: '#003d15',           // Masters green text for prestige
    accent: '#d58114',         // Highlighter Yellow Hover (official)
    gradient: 'linear-gradient(135deg, #003d15, #FFD700)'
  }
};

// ===========================================
// ACHIEVEMENT TYPE CONFIGURATIONS
// ===========================================
export const ACHIEVEMENT_CONFIG = {
  consecutive_makes: {
    title: 'Consecutive Excellence',
    subtitle: 'Precision & Consistency',
    icon: '🎯',
    description: 'consecutive putts made',
    category: 'Skill',
    verb_achieved: 'accomplished',
    motivation_text: 'Demonstrating unwavering focus and exceptional putting precision'
  },

  perfect_session: {
    title: 'Perfect Precision',
    subtitle: 'Flawless Performance',
    icon: '💯',
    description: 'perfect putting session',
    category: 'Mastery',
    verb_achieved: 'achieved',
    motivation_text: 'Showcasing complete mastery of putting fundamentals'
  },

  career_milestone: {
    title: 'Career Achievement',
    subtitle: 'Lifetime Excellence',
    icon: '🏆',
    description: 'career putts made',
    category: 'Dedication',
    verb_achieved: 'reached',
    motivation_text: 'Demonstrating long-term commitment to putting excellence'
  },

  accuracy_milestone: {
    title: 'Accuracy Mastery',
    subtitle: 'Consistent Precision',
    icon: '🎪',
    description: 'career accuracy achieved',
    category: 'Consistency',
    verb_achieved: 'maintained',
    motivation_text: 'Proving exceptional consistency over time'
  },

  competition_win: {
    title: 'Victory Champion',
    subtitle: 'Proven Under Pressure',
    icon: '👑',
    description: 'competitive victory',
    category: 'Competition',
    verb_achieved: 'earned',
    motivation_text: 'Rising to the occasion when it matters most'
  }
};

// ===========================================
// CERTIFICATE SIZE CONFIGURATIONS
// ===========================================
export const CERTIFICATE_SIZES = {
  compact: {
    width: 600,
    height: 450,
    padding: 30,
    titleSize: 28,
    subtitleSize: 14,
    playerNameSize: 24,
    valueSize: 36,
    bodyTextSize: 16
  },

  standard: {
    width: 800,
    height: 600,
    padding: 40,
    titleSize: 36,
    subtitleSize: 18,
    playerNameSize: 32,
    valueSize: 48,
    bodyTextSize: 20
  },

  large: {
    width: 1000,
    height: 750,
    padding: 50,
    titleSize: 44,
    subtitleSize: 22,
    playerNameSize: 40,
    valueSize: 60,
    bodyTextSize: 24
  },

  // Special sizes for printing
  print_letter: {
    width: 816,    // 8.5" x 11" at 96 DPI
    height: 1056,
    padding: 60,
    titleSize: 38,
    subtitleSize: 20,
    playerNameSize: 34,
    valueSize: 52,
    bodyTextSize: 22
  },

  social_media: {
    width: 1200,   // Optimized for social sharing
    height: 630,
    padding: 45,
    titleSize: 32,
    subtitleSize: 16,
    playerNameSize: 28,
    valueSize: 44,
    bodyTextSize: 18
  }
};

// ===========================================
// TEXT CUSTOMIZATION
// ===========================================
export const CERTIFICATE_TEXT = {
  // Main recognition text (above player name)
  recognition_text: 'This certifies that',

  // Achievement text (above achievement value)
  achievement_text: 'has accomplished',

  // Footer labels
  footer_labels: {
    achieved: 'Achieved:',
    certified: 'Certified:',
    blockchain: 'BLOCKCHAIN VERIFIED',
    certificate_id: 'Certificate ID'
  },

  // Alternative recognition phrases (can be randomized)
  recognition_alternatives: [
    'This certifies that',
    'Be it known that',
    'This acknowledges that',
    'Let it be recorded that',
    'This validates that'
  ],

  // Alternative achievement phrases (can be randomized)
  achievement_alternatives: [
    'has accomplished',
    'has achieved',
    'has earned',
    'has demonstrated',
    'has mastered'
  ]
};

// ===========================================
// TYPOGRAPHY CONFIGURATION
// ===========================================
export const TYPOGRAPHY = {
  primary_font: "'Georgia', serif",      // Main certificate font
  secondary_font: "'Arial', sans-serif", // Secondary text
  monospace_font: "'Courier New', monospace", // Hash/ID display

  // Font weights
  weights: {
    normal: 400,
    semibold: 600,
    bold: 700,
    extrabold: 800
  },

  // Letter spacing
  spacing: {
    tight: '-0.5px',
    normal: '0px',
    wide: '1px',
    wider: '2px',
    widest: '3px'
  }
};

// ===========================================
// LAYOUT CUSTOMIZATION
// ===========================================
export const LAYOUT = {
  // Border radius for rounded corners
  border_radius: 12,

  // Border thickness
  border_width: 4,

  // Corner decoration size
  corner_decoration_size: 60,

  // Shadow configuration
  shadow: '0 8px 32px rgba(0,0,0,0.1)',

  // Spacing between elements
  element_spacing: {
    small: 10,
    medium: 20,
    large: 30,
    xlarge: 40
  }
};

// ===========================================
// CUSTOM THEME CREATOR
// ===========================================
export const createCustomTheme = (overrides = {}) => {
  const defaultTheme = RARITY_THEMES.rare;

  return {
    name: overrides.name || 'Custom Theme',
    primary: overrides.primary || defaultTheme.primary,
    secondary: overrides.secondary || defaultTheme.secondary,
    background: overrides.background || defaultTheme.background,
    border: overrides.border || defaultTheme.border,
    text: overrides.text || defaultTheme.text,
    accent: overrides.accent || defaultTheme.accent,
    gradient: overrides.gradient || defaultTheme.gradient
  };
};

// ===========================================
// PLAYER NAME FORMATTING
// ===========================================
export const PLAYER_NAME_CONFIG = {
  // How to display player names
  format: 'uppercase',  // 'uppercase', 'lowercase', 'title', 'original'

  // Max characters for player name display
  max_length: 24,

  // Fallback if no player name available
  fallback_name: 'ACCOMPLISHED PLAYER',

  // Fields to check for player name (in order of preference)
  name_fields: ['display_name', 'username', 'full_name', 'first_name'],

  // Whether to show player ID if no name available
  show_id_fallback: false
};

// ===========================================
// BLOCKCHAIN VERIFICATION CONFIG
// ===========================================
export const BLOCKCHAIN_CONFIG = {
  // Length of hash to display (from full 64-character hash)
  hash_display_length: 16,

  // Hash display format
  hash_format: 'truncated', // 'truncated', 'full', 'abbreviated'

  // Certificate ID display length
  cert_id_length: 8,

  // Show QR code for verification (future feature)
  show_qr_code: false,

  // Verification URL base (future feature)
  verification_url_base: 'https://app.proofofputt.com/verify/'
};

// ===========================================
// EXPORT ALL CONFIGURATIONS
// ===========================================
export default {
  BRANDING,
  RARITY_THEMES,
  ACHIEVEMENT_CONFIG,
  CERTIFICATE_SIZES,
  CERTIFICATE_TEXT,
  TYPOGRAPHY,
  LAYOUT,
  PLAYER_NAME_CONFIG,
  BLOCKCHAIN_CONFIG,
  createCustomTheme
};