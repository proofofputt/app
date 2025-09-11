import sgMail from '@sendgrid/mail';

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.warn('SENDGRID_API_KEY environment variable not set');
}

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@proofofputt.com';
const APP_NAME = 'Proof of Putt';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.proofofputt.com';

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async (email, username, resetToken) => {
  const resetLink = `${APP_URL}/reset-password?token=${resetToken}`;
  
  const msg = {
    to: email,
    from: {
      email: FROM_EMAIL,
      name: APP_NAME
    },
    subject: 'Reset your Proof of Putt password',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Reset your password</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #2d3748; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0a5d1a 0%, #2d5016 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 600;">🏌️ ${APP_NAME}</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Password Reset Request</p>
        </div>
        
        <div style="background: #f7fafc; padding: 30px 20px; border-radius: 0 0 8px 8px;">
          <h2 style="color: #2d5016; margin-top: 0;">Hi ${username},</h2>
          
          <p>You requested to reset your password for your ${APP_NAME} account. Click the button below to create a new password:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background: linear-gradient(135deg, #0a5d1a 0%, #2d5016 100%); color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600; display: inline-block;">Reset My Password</a>
          </div>
          
          <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
          <p style="word-break: break-all; background: white; padding: 10px; border-radius: 4px; border: 1px solid #e2e8f0; font-family: monospace; font-size: 14px;">${resetLink}</p>
          
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 15px; margin: 20px 0;">
            <strong style="color: #856404;">⏰ This link expires in 1 hour</strong>
          </div>
          
          <p style="color: #718096; font-size: 14px; margin-top: 30px;">
            If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
          
          <p style="color: #718096; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.<br>
            This email was sent from ${FROM_EMAIL}
          </p>
        </div>
      </body>
      </html>
    `,
    text: `
      Hi ${username},

      You requested to reset your password for your ${APP_NAME} account.

      Please click the following link to reset your password:
      ${resetLink}

      This link will expire in 1 hour.

      If you didn't request this password reset, you can safely ignore this email.

      Best regards,
      The ${APP_NAME} Team
    `
  };

  try {
    await sgMail.send(msg);
    console.log(`Password reset email sent to ${email}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send welcome email for new registrations
 */
export const sendWelcomeEmail = async (email, name) => {
  const msg = {
    to: email,
    from: {
      email: FROM_EMAIL,
      name: APP_NAME
    },
    subject: `Welcome to ${APP_NAME}! 🏌️`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Welcome to ${APP_NAME}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #2d3748; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0a5d1a 0%, #2d5016 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 600;">🏌️ Welcome to ${APP_NAME}!</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Your putting journey starts now</p>
        </div>
        
        <div style="background: #f7fafc; padding: 30px 20px; border-radius: 0 0 8px 8px;">
          <h2 style="color: #2d5016; margin-top: 0;">Hi ${name},</h2>
          
          <p>Welcome to ${APP_NAME}! We're excited to have you join our community of golfers working to improve their putting skills.</p>
          
          <h3 style="color: #2d5016;">🚀 Get Started</h3>
          <ul>
            <li><strong>Download the Desktop App:</strong> Install our computer vision tracking app to record your practice sessions</li>
            <li><strong>Join Competitions:</strong> Challenge friends to duels or join leagues for group competitions</li>
            <li><strong>Track Your Progress:</strong> View detailed analytics and performance insights on your dashboard</li>
            <li><strong>Build Your Network:</strong> Connect with friends and fellow golfers in the community</li>
          </ul>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${APP_URL}" style="background: linear-gradient(135deg, #0a5d1a 0%, #2d5016 100%); color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600; display: inline-block;">Launch ${APP_NAME}</a>
          </div>
          
          <div style="background: #e6fffa; border: 1px solid #4fd1c7; border-radius: 4px; padding: 15px; margin: 20px 0;">
            <strong style="color: #234e52;">💡 Pro Tip:</strong> Start with a few practice sessions to establish your baseline, then challenge friends to see your improvement over time!
          </div>
          
          <p>If you have any questions or need help getting started, don't hesitate to reach out to our support team.</p>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
          
          <p style="color: #718096; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.<br>
            This email was sent from ${FROM_EMAIL}
          </p>
        </div>
      </body>
      </html>
    `,
    text: `
      Hi ${name},

      Welcome to ${APP_NAME}! We're excited to have you join our community of golfers.

      Get started by:
      - Downloading the Desktop App for computer vision tracking
      - Joining competitions and challenging friends
      - Tracking your progress with detailed analytics
      - Building your network in the golf community

      Visit ${APP_URL} to get started!

      Best regards,
      The ${APP_NAME} Team
    `
  };

  try {
    await sgMail.send(msg);
    console.log(`Welcome email sent to ${email}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send duel invitation email to new players
 */
export const sendDuelInviteEmail = async (email, inviterName, duelDetails) => {
  const signupLink = `${APP_URL}/register?invite=duel&email=${encodeURIComponent(email)}&referrer_id=${duelDetails.creatorInfo?.id || ''}`;
  
  const msg = {
    to: email,
    from: {
      email: FROM_EMAIL,
      name: APP_NAME
    },
    subject: `${inviterName} challenged you to a putting duel! 🏌️`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>You're invited to a putting duel!</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #2d3748; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0a5d1a 0%, #2d5016 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 600;">🏌️ You've been challenged!</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">A putting duel awaits</p>
        </div>
        
        <div style="background: #f7fafc; padding: 30px 20px; border-radius: 0 0 8px 8px;">
          <h2 style="color: #2d5016; margin-top: 0;">Hi there!</h2>
          
          <p><strong>${inviterName}</strong> has challenged you to a putting duel on ${APP_NAME}!</p>
          
          <div style="background: white; border: 2px solid #2d5016; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #2d5016; margin-top: 0;">🎯 Duel Details</h3>
            <p><strong>Putting Distance:</strong> ${duelDetails.puttingDistance ? `${duelDetails.puttingDistance} feet` : '7.0 feet'}</p>
            ${duelDetails.timeLimit ? `<p><strong>Time Limit:</strong> ${duelDetails.timeLimit} minutes</p>` : ''}
            <p><strong>Scoring:</strong> ${duelDetails.scoring === 'total_makes' ? 'Total Makes' : 'Best Streak'}</p>
            <p><strong>Challenge expires:</strong> ${duelDetails.expiresAt ? new Date(duelDetails.expiresAt).toLocaleDateString() : 'Soon'}</p>
          </div>
          
          ${duelDetails.creatorInfo ? `
          <div style="background: #f0f8f0; border: 1px solid #4a6741; border-radius: 6px; padding: 15px; margin: 20px 0;">
            <h4 style="color: #2d5016; margin-top: 0; margin-bottom: 10px;">📞 Connect with ${duelDetails.creatorInfo.name}</h4>
            <p style="margin: 5px 0; font-size: 14px; color: #4a6741;">
              ${duelDetails.creatorInfo.contactType === 'email' ? 
                `<strong>Email:</strong> ${duelDetails.creatorInfo.email}` : 
                `<strong>Contact:</strong> ${duelDetails.creatorInfo.email || duelDetails.creatorInfo.name}`
              }
            </p>
            <p style="margin: 5px 0 0 0; font-size: 12px; color: #718096; font-style: italic;">
              Feel free to reach out if you have questions about the challenge!
            </p>
          </div>
          ` : ''}
          
          <h3 style="color: #2d5016;">What is ${APP_NAME}?</h3>
          <p>${APP_NAME} is an AI-powered golf training platform that uses computer vision to track your putting performance. Compete with friends, join leagues, and improve your game with detailed analytics!</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${signupLink}" style="background: linear-gradient(135deg, #0a5d1a 0%, #2d5016 100%); color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600; display: inline-block;">Accept Challenge & Sign Up</a>
          </div>
          
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 15px; margin: 20px 0;">
            <strong style="color: #856404;">📱 Getting Started:</strong> After signing up, you'll need to download our desktop app to track your putting sessions with computer vision technology.
          </div>
          
          <p style="color: #718096; font-size: 14px; margin-top: 30px;">
            Don't want to compete? No worries! You can safely ignore this email.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
          
          <p style="color: #718096; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.<br>
            This email was sent from ${FROM_EMAIL}
          </p>
        </div>
      </body>
      </html>
    `,
    text: `
      Hi there!

      ${inviterName} has challenged you to a putting duel on ${APP_NAME}!

      Duel Details:
      - Putting Distance: ${duelDetails.puttingDistance ? `${duelDetails.puttingDistance} feet` : '7.0 feet'}
      ${duelDetails.timeLimit ? `- Time Limit: ${duelDetails.timeLimit} minutes` : ''}
      - Scoring: ${duelDetails.scoring === 'total_makes' ? 'Total Makes' : 'Best Streak'}
      - Challenge expires: ${duelDetails.expiresAt ? new Date(duelDetails.expiresAt).toLocaleDateString() : 'Soon'}

      ${duelDetails.creatorInfo ? `Connect with ${duelDetails.creatorInfo.name}:
      ${duelDetails.creatorInfo.contactType === 'email' ? 
        `Email: ${duelDetails.creatorInfo.email}` : 
        `Contact: ${duelDetails.creatorInfo.email || duelDetails.creatorInfo.name}`
      }` : ''}

      ${APP_NAME} is an AI-powered golf training platform that uses computer vision to track your putting performance.

      Sign up to accept the challenge: ${signupLink}

      Best regards,
      The ${APP_NAME} Team
    `
  };

  try {
    await sgMail.send(msg);
    console.log(`Duel invite email sent to ${email}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending duel invite email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send league invitation email to new players
 */
export const sendLeagueInviteEmail = async (email, inviterName, leagueDetails) => {
  const signupLink = `${APP_URL}/register?invite=league&email=${encodeURIComponent(email)}&league=${encodeURIComponent(leagueDetails.name)}`;
  
  const msg = {
    to: email,
    from: {
      email: FROM_EMAIL,
      name: APP_NAME
    },
    subject: `${inviterName} invited you to join "${leagueDetails.name}" league! 🏌️`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>You're invited to a putting league!</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #2d3748; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0a5d1a 0%, #2d5016 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 600;">🏌️ League Invitation!</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Join the competition</p>
        </div>
        
        <div style="background: #f7fafc; padding: 30px 20px; border-radius: 0 0 8px 8px;">
          <h2 style="color: #2d5016; margin-top: 0;">Hi there!</h2>
          
          <p><strong>${inviterName}</strong> has invited you to join the <strong>"${leagueDetails.name}"</strong> league on ${APP_NAME}!</p>
          
          <div style="background: white; border: 2px solid #2d5016; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #2d5016; margin-top: 0;">🏆 League Details</h3>
            <p><strong>League:</strong> ${leagueDetails.name}</p>
            ${leagueDetails.description ? `<p><strong>Description:</strong> ${leagueDetails.description}</p>` : ''}
            <p><strong>Members:</strong> ${leagueDetails.memberCount || 'Multiple'} players</p>
            <p><strong>Status:</strong> ${leagueDetails.status || 'Active'}</p>
          </div>
          
          <h3 style="color: #2d5016;">What is ${APP_NAME}?</h3>
          <p>${APP_NAME} is an AI-powered golf training platform that uses computer vision to track your putting performance. Join leagues for group competitions, challenge friends to duels, and improve your game with detailed analytics!</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${signupLink}" style="background: linear-gradient(135deg, #0a5d1a 0%, #2d5016 100%); color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600; display: inline-block;">Join League & Sign Up</a>
          </div>
          
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 15px; margin: 20px 0;">
            <strong style="color: #856404;">📱 Getting Started:</strong> After signing up, you'll need to download our desktop app to track your putting sessions and participate in league rounds.
          </div>
          
          <p style="color: #718096; font-size: 14px; margin-top: 30px;">
            Not interested in joining? No problem! You can safely ignore this email.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
          
          <p style="color: #718096; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.<br>
            This email was sent from ${FROM_EMAIL}
          </p>
        </div>
      </body>
      </html>
    `,
    text: `
      Hi there!

      ${inviterName} has invited you to join the "${leagueDetails.name}" league on ${APP_NAME}!

      League Details:
      - League: ${leagueDetails.name}
      ${leagueDetails.description ? `- Description: ${leagueDetails.description}` : ''}
      - Members: ${leagueDetails.memberCount || 'Multiple'} players
      - Status: ${leagueDetails.status || 'Active'}

      ${APP_NAME} is an AI-powered golf training platform that uses computer vision to track your putting performance.

      Join the league: ${signupLink}

      Best regards,
      The ${APP_NAME} Team
    `
  };

  try {
    await sgMail.send(msg);
    console.log(`League invite email sent to ${email}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending league invite email:', error);
    return { success: false, error: error.message };
  }
};