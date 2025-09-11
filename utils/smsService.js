import twilio from 'twilio';

// Initialize Twilio (only if credentials available)
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
} else {
  console.warn('Twilio credentials not configured - SMS invitations disabled');
}

const FROM_PHONE = process.env.TWILIO_PHONE_NUMBER || '+1234567890';
const APP_NAME = 'Proof of Putt';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.proofofputt.com';

/**
 * Validate US phone number format
 */
export const validateUSPhoneNumber = (phone) => {
  if (!phone) return null;
  
  // Clean input: remove spaces, dashes, parentheses, dots, plus
  const cleaned = phone.replace(/[\s\-\(\)\+\.]/g, '');
  
  // US phone patterns (must start with valid area code 2-9)
  if (cleaned.length === 10 && /^[2-9]\d{9}$/.test(cleaned)) {
    return `+1${cleaned}`;
  } else if (cleaned.length === 11 && cleaned.startsWith('1') && /^1[2-9]\d{9}$/.test(cleaned)) {
    return `+${cleaned}`;
  }
  
  return null; // Invalid US number
};

/**
 * Send duel invitation SMS
 */
export const sendDuelInviteSMS = async (phone, inviterName, duelDetails) => {
  if (!twilioClient) {
    return { success: false, error: 'SMS service not configured' };
  }
  
  const validatedPhone = validateUSPhoneNumber(phone);
  if (!validatedPhone) {
    return { success: false, error: 'Invalid US phone number format' };
  }
  
  const signupLink = `${APP_URL}/register?invite=duel&phone=${encodeURIComponent(validatedPhone)}`;
  
  // SMS character limit: 160 chars for single message, 1600 for concatenated
  // Include putting distance and creator contact info
  const contactInfo = duelDetails.creatorInfo ? `\n📧 ${duelDetails.creatorInfo.email || duelDetails.creatorInfo.name}` : '';
  
  const message = `🏌️ ${inviterName} challenged you to a putting duel on ${APP_NAME}!

📏 ${duelDetails.puttingDistance ? `${duelDetails.puttingDistance}ft` : '7.0ft'} • ⏱️ ${duelDetails.timeLimit ? `${duelDetails.timeLimit}min` : 'Timed'} • 🎯 ${duelDetails.scoring === 'total_makes' ? 'Total Makes' : 'Best Streak'}${contactInfo}

Join: ${signupLink}

Reply STOP to opt out`;

  try {
    const result = await twilioClient.messages.create({
      body: message,
      from: FROM_PHONE,
      to: validatedPhone
    });
    
    console.log(`Duel invite SMS sent to ${validatedPhone}, SID: ${result.sid}`);
    return { 
      success: true, 
      messageId: result.sid,
      cost: result.price || '~$0.01'
    };
  } catch (error) {
    console.error('Error sending duel invite SMS:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send league invitation SMS
 */
export const sendLeagueInviteSMS = async (phone, inviterName, leagueDetails) => {
  if (!twilioClient) {
    return { success: false, error: 'SMS service not configured' };
  }
  
  const validatedPhone = validateUSPhoneNumber(phone);
  if (!validatedPhone) {
    return { success: false, error: 'Invalid US phone number format' };
  }
  
  const signupLink = `${APP_URL}/register?invite=league&phone=${encodeURIComponent(validatedPhone)}&league=${encodeURIComponent(leagueDetails.name)}`;
  
  const message = `🏌️ ${inviterName} invited you to join "${leagueDetails.name}" league on ${APP_NAME}!

🏆 ${leagueDetails.memberCount || 'Multiple'} players • Group competition

Join: ${signupLink}

Reply STOP to opt out`;

  try {
    const result = await twilioClient.messages.create({
      body: message,
      from: FROM_PHONE,
      to: validatedPhone
    });
    
    console.log(`League invite SMS sent to ${validatedPhone}, SID: ${result.sid}`);
    return { 
      success: true, 
      messageId: result.sid,
      cost: result.price || '~$0.01'
    };
  } catch (error) {
    console.error('Error sending league invite SMS:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Check SMS service availability
 */
export const isSMSServiceAvailable = () => {
  return twilioClient !== null;
};