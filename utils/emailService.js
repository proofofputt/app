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

/**
 * Send feedback confirmation email when user submits new feedback
 */
export const sendFeedbackConfirmationEmail = async (email, name, feedbackDetails) => {
  const feedbackLink = `${APP_URL}/comments`;

  const msg = {
    to: email,
    from: {
      email: FROM_EMAIL,
      name: APP_NAME
    },
    subject: `Thanks for your feedback! - ${APP_NAME}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Feedback Received</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #2d3748; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0a5d1a 0%, #2d5016 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 600;">💬 Feedback Received!</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">We appreciate your input</p>
        </div>

        <div style="background: #f7fafc; padding: 30px 20px; border-radius: 0 0 8px 8px;">
          <h2 style="color: #2d5016; margin-top: 0;">Hi ${name},</h2>

          <p>Thank you for taking the time to share your feedback with us! We've received your submission and our team will review it shortly.</p>

          <div style="background: white; border: 2px solid #2d5016; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #2d5016; margin-top: 0;">📝 Your Feedback</h3>
            <p><strong>Subject:</strong> ${feedbackDetails.subject}</p>
            <p><strong>Category:</strong> ${feedbackDetails.category_label}</p>
            <p><strong>Reference #:</strong> ${feedbackDetails.thread_id}</p>
          </div>

          <div style="background: #e6fffa; border: 1px solid #4fd1c7; border-radius: 4px; padding: 15px; margin: 20px 0;">
            <strong style="color: #234e52;">⏱️ What's Next?</strong>
            <p style="margin: 5px 0 0 0;">Our support team typically responds within 24-48 hours. You'll receive an email when we reply to your feedback.</p>
          </div>

          <p>You can view the conversation and add additional details anytime by visiting your Comments & Feedback page:</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${feedbackLink}" style="background: linear-gradient(135deg, #0a5d1a 0%, #2d5016 100%); color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600; display: inline-block;">View Conversation</a>
          </div>

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

      Thank you for taking the time to share your feedback with us! We've received your submission and our team will review it shortly.

      Your Feedback:
      - Subject: ${feedbackDetails.subject}
      - Category: ${feedbackDetails.category_label}
      - Reference #: ${feedbackDetails.thread_id}

      What's Next?
      Our support team typically responds within 24-48 hours. You'll receive an email when we reply to your feedback.

      View the conversation: ${feedbackLink}

      Best regards,
      The ${APP_NAME} Team
    `
  };

  try {
    await sgMail.send(msg);
    console.log(`Feedback confirmation email sent to ${email}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending feedback confirmation email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send notification email when admin responds to feedback
 */
export const sendFeedbackResponseEmail = async (email, name, threadDetails, responsePreview) => {
  const threadLink = `${APP_URL}/comments`;

  const msg = {
    to: email,
    from: {
      email: FROM_EMAIL,
      name: APP_NAME
    },
    subject: `We replied to your feedback: ${threadDetails.subject}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>New Response to Your Feedback</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #2d3748; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0a5d1a 0%, #2d5016 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 600;">💬 New Response!</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">We've replied to your feedback</p>
        </div>

        <div style="background: #f7fafc; padding: 30px 20px; border-radius: 0 0 8px 8px;">
          <h2 style="color: #2d5016; margin-top: 0;">Hi ${name},</h2>

          <p>Good news! Our team has responded to your feedback about "${threadDetails.subject}".</p>

          <div style="background: white; border: 2px solid #2d5016; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #2d5016; margin-top: 0;">💬 Response Preview</h3>
            <p style="font-style: italic; color: #4a5568;">"${responsePreview}"</p>
            <p style="font-size: 12px; color: #718096; margin: 10px 0 0 0;">View the full conversation for complete details.</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${threadLink}" style="background: linear-gradient(135deg, #0a5d1a 0%, #2d5016 100%); color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600; display: inline-block;">View Full Conversation</a>
          </div>

          <p>Feel free to reply with any additional questions or information!</p>

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

      Good news! Our team has responded to your feedback about "${threadDetails.subject}".

      Response Preview:
      "${responsePreview}"

      View the full conversation: ${threadLink}

      Feel free to reply with any additional questions or information!

      Best regards,
      The ${APP_NAME} Team
    `
  };

  try {
    await sgMail.send(msg);
    console.log(`Feedback response email sent to ${email}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending feedback response email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send notification when feedback status changes
 */
export const sendFeedbackStatusUpdateEmail = async (email, name, threadDetails, oldStatus, newStatus) => {
  const threadLink = `${APP_URL}/comments`;

  const statusMessages = {
    in_progress: 'Our team is actively working on your feedback',
    resolved: 'Your feedback has been resolved',
    closed: 'This conversation has been closed'
  };

  const msg = {
    to: email,
    from: {
      email: FROM_EMAIL,
      name: APP_NAME
    },
    subject: `Feedback update: ${threadDetails.subject}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Feedback Status Update</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #2d3748; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0a5d1a 0%, #2d5016 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 600;">🔄 Status Update</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Your feedback status changed</p>
        </div>

        <div style="background: #f7fafc; padding: 30px 20px; border-radius: 0 0 8px 8px;">
          <h2 style="color: #2d5016; margin-top: 0;">Hi ${name},</h2>

          <p>We have an update regarding your feedback: "${threadDetails.subject}".</p>

          <div style="background: white; border: 2px solid #2d5016; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #2d5016; margin-top: 0;">📊 Status Change</h3>
            <p><strong>Previous Status:</strong> <span style="text-transform: capitalize;">${oldStatus.replace('_', ' ')}</span></p>
            <p><strong>New Status:</strong> <span style="text-transform: capitalize; color: #0a5d1a; font-weight: 600;">${newStatus.replace('_', ' ')}</span></p>
            <p style="margin-top: 15px;">${statusMessages[newStatus] || 'Status has been updated'}</p>
          </div>

          ${threadDetails.admin_notes ? `
          <div style="background: #e3f2fd; border-left: 4px solid #1976d2; border-radius: 4px; padding: 15px; margin: 20px 0;">
            <strong style="color: #1976d2;">📝 Resolution Notes:</strong>
            <p style="margin: 5px 0 0 0; color: #2d3748;">${threadDetails.admin_notes}</p>
          </div>
          ` : ''}

          <div style="text-align: center; margin: 30px 0;">
            <a href="${threadLink}" style="background: linear-gradient(135deg, #0a5d1a 0%, #2d5016 100%); color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600; display: inline-block;">View Conversation</a>
          </div>

          ${newStatus === 'closed' ? `
          <p style="color: #718096; font-size: 14px;">
            This conversation is now closed. If you have additional feedback, feel free to start a new conversation from your Comments & Feedback page.
          </p>
          ` : `
          <p>If you have questions or additional information, feel free to reply in the conversation!</p>
          `}

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

      We have an update regarding your feedback: "${threadDetails.subject}".

      Status Change:
      - Previous Status: ${oldStatus.replace('_', ' ')}
      - New Status: ${newStatus.replace('_', ' ')}

      ${statusMessages[newStatus] || 'Status has been updated'}

      ${threadDetails.admin_notes ? `\nResolution Notes:\n${threadDetails.admin_notes}\n` : ''}

      View conversation: ${threadLink}

      ${newStatus === 'closed'
        ? 'This conversation is now closed. If you have additional feedback, feel free to start a new conversation.'
        : 'If you have questions or additional information, feel free to reply in the conversation!'}

      Best regards,
      The ${APP_NAME} Team
    `
  };

  try {
    await sgMail.send(msg);
    console.log(`Feedback status update email sent to ${email}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending feedback status update email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send alert to admin team when a club claim request is submitted
 */
export const sendClubClaimAlertEmail = async (adminEmail, claimDetails, playerInfo, clubInfo) => {
  const adminLink = `${APP_URL}/admin/clubs/claims`;

  const msg = {
    to: adminEmail,
    from: {
      email: FROM_EMAIL,
      name: APP_NAME
    },
    subject: `New Club Claim Request: ${clubInfo.name}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>New Club Claim Request</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #2d3748; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0a5d1a 0%, #2d5016 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 600;">🏌️ New Club Claim Request</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Awaiting Admin Review</p>
        </div>

        <div style="background: #f7fafc; padding: 30px 20px; border-radius: 0 0 8px 8px;">
          <h2 style="color: #2d5016; margin-top: 0;">Club Representative Request</h2>

          <div style="background: white; border: 2px solid #2d5016; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #2d5016; margin-top: 0;">🏌️ Club Details</h3>
            <p><strong>Club Name:</strong> ${clubInfo.name}</p>
            <p><strong>Location:</strong> ${clubInfo.address_city || 'N/A'}, ${clubInfo.address_state || 'N/A'}</p>
            ${clubInfo.website ? `<p><strong>Website:</strong> <a href="${clubInfo.website}">${clubInfo.website}</a></p>` : ''}
            <p><strong>Club ID:</strong> #${clubInfo.club_id}</p>
          </div>

          <div style="background: #f0f8f0; border: 1px solid #4a6741; border-radius: 6px; padding: 15px; margin: 20px 0;">
            <h4 style="color: #2d5016; margin-top: 0; margin-bottom: 10px;">👤 Requester Information</h4>
            <p style="margin: 5px 0;"><strong>Name:</strong> ${playerInfo.name}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${playerInfo.email}</p>
            <p style="margin: 5px 0;"><strong>Player ID:</strong> ${playerInfo.player_id}</p>
          </div>

          <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 15px; margin: 20px 0;">
            <h4 style="color: #856404; margin-top: 0; margin-bottom: 10px;">✅ Verification Details</h4>
            <p style="margin: 5px 0;"><strong>Position:</strong> ${claimDetails.position}</p>
            <p style="margin: 5px 0;"><strong>Work Email:</strong> ${claimDetails.work_email}</p>
            ${claimDetails.work_phone ? `<p style="margin: 5px 0;"><strong>Work Phone:</strong> ${claimDetails.work_phone}</p>` : ''}
            ${claimDetails.verification_notes ? `<p style="margin: 10px 0 0 0;"><strong>Notes:</strong> ${claimDetails.verification_notes}</p>` : ''}
          </div>

          ${claimDetails.message ? `
          <div style="background: #e3f2fd; border-left: 4px solid #1976d2; border-radius: 4px; padding: 15px; margin: 20px 0;">
            <strong style="color: #1976d2;">💬 Message from Requester:</strong>
            <p style="margin: 10px 0 0 0; color: #2d3748;">${claimDetails.message}</p>
          </div>
          ` : ''}

          <div style="text-align: center; margin: 30px 0;">
            <a href="${adminLink}" style="background: linear-gradient(135deg, #0a5d1a 0%, #2d5016 100%); color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600; display: inline-block;">Review Claim Request</a>
          </div>

          <p style="color: #718096; font-size: 14px;">
            Please review the verification details above and approve or deny this request from the admin dashboard.
          </p>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">

          <p style="color: #718096; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} ${APP_NAME} Admin System<br>
            This is an automated alert for admin team members
          </p>
        </div>
      </body>
      </html>
    `,
    text: `
      NEW CLUB CLAIM REQUEST

      Club Details:
      - Club Name: ${clubInfo.name}
      - Location: ${clubInfo.address_city || 'N/A'}, ${clubInfo.address_state || 'N/A'}
      ${clubInfo.website ? `- Website: ${clubInfo.website}` : ''}
      - Club ID: #${clubInfo.club_id}

      Requester Information:
      - Name: ${playerInfo.name}
      - Email: ${playerInfo.email}
      - Player ID: ${playerInfo.player_id}

      Verification Details:
      - Position: ${claimDetails.position}
      - Work Email: ${claimDetails.work_email}
      ${claimDetails.work_phone ? `- Work Phone: ${claimDetails.work_phone}` : ''}
      ${claimDetails.verification_notes ? `- Notes: ${claimDetails.verification_notes}` : ''}

      ${claimDetails.message ? `Message from Requester:\n${claimDetails.message}\n` : ''}

      Review and approve/deny this request: ${adminLink}

      This is an automated alert for admin team members.
    `
  };

  try {
    await sgMail.send(msg);
    console.log(`Club claim alert email sent to admin ${adminEmail}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending club claim alert email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send alert to admin team when new high-priority feedback is submitted
 */
export const sendNewFeedbackAlertEmail = async (adminEmail, feedbackDetails, playerInfo) => {
  const adminLink = `${APP_URL}/admin/feedback`;

  const msg = {
    to: adminEmail,
    from: {
      email: FROM_EMAIL,
      name: APP_NAME
    },
    subject: `[${feedbackDetails.priority.toUpperCase()}] New Feedback: ${feedbackDetails.subject}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>New Feedback Alert</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #2d3748; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 600;">🚨 New Feedback Alert</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Priority: ${feedbackDetails.priority.toUpperCase()}</p>
        </div>

        <div style="background: #f7fafc; padding: 30px 20px; border-radius: 0 0 8px 8px;">
          <h2 style="color: #2d5016; margin-top: 0;">New ${feedbackDetails.category_label}</h2>

          <div style="background: white; border: 2px solid #b91c1c; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #b91c1c; margin-top: 0;">📝 Feedback Details</h3>
            <p><strong>Subject:</strong> ${feedbackDetails.subject}</p>
            <p><strong>Category:</strong> ${feedbackDetails.category_label}</p>
            <p><strong>Priority:</strong> <span style="text-transform: uppercase; color: #b91c1c; font-weight: 600;">${feedbackDetails.priority}</span></p>
            ${feedbackDetails.page_location ? `<p><strong>Page:</strong> ${feedbackDetails.page_location}</p>` : ''}
            ${feedbackDetails.feature_area ? `<p><strong>Feature:</strong> ${feedbackDetails.feature_area}</p>` : ''}
            <p><strong>Thread ID:</strong> #${feedbackDetails.thread_id}</p>
          </div>

          <div style="background: #f0f8f0; border: 1px solid #4a6741; border-radius: 6px; padding: 15px; margin: 20px 0;">
            <h4 style="color: #2d5016; margin-top: 0; margin-bottom: 10px;">👤 Submitted By</h4>
            <p style="margin: 5px 0;"><strong>Name:</strong> ${playerInfo.name}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${playerInfo.email}</p>
            <p style="margin: 5px 0;"><strong>Player ID:</strong> ${playerInfo.player_id}</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${adminLink}" style="background: linear-gradient(135deg, #0a5d1a 0%, #2d5016 100%); color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600; display: inline-block;">View in Admin Dashboard</a>
          </div>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">

          <p style="color: #718096; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} ${APP_NAME} Admin System<br>
            This is an automated alert for admin team members
          </p>
        </div>
      </body>
      </html>
    `,
    text: `
      NEW FEEDBACK ALERT
      Priority: ${feedbackDetails.priority.toUpperCase()}

      Feedback Details:
      - Subject: ${feedbackDetails.subject}
      - Category: ${feedbackDetails.category_label}
      - Priority: ${feedbackDetails.priority.toUpperCase()}
      ${feedbackDetails.page_location ? `- Page: ${feedbackDetails.page_location}` : ''}
      ${feedbackDetails.feature_area ? `- Feature: ${feedbackDetails.feature_area}` : ''}
      - Thread ID: #${feedbackDetails.thread_id}

      Submitted By:
      - Name: ${playerInfo.name}
      - Email: ${playerInfo.email}
      - Player ID: ${playerInfo.player_id}

      View in Admin Dashboard: ${adminLink}

      This is an automated alert for admin team members.
    `
  };

  try {
    await sgMail.send(msg);
    console.log(`New feedback alert email sent to admin ${adminEmail}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending new feedback alert email:', error);
    return { success: false, error: error.message };
  }
};