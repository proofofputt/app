import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';

dotenv.config();

class EmailService {
  constructor() {
    if (!process.env.SENDGRID_API_KEY) {
      console.error('⚠️  SENDGRID_API_KEY not found in environment variables');
      this.enabled = false;
    } else {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      this.enabled = true;
      console.log('✅ SendGrid email service initialized');
    }
    
    this.fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@proofofputt.com';
    this.fromName = process.env.SENDGRID_FROM_NAME || 'Proof of Putt';
  }

  async sendEmail({ to, subject, text, html, templateData = {} }) {
    if (!this.enabled) {
      console.log('📧 Email service disabled - would have sent:', { to, subject });
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const msg = {
        to,
        from: {
          email: this.fromEmail,
          name: this.fromName
        },
        subject,
        text,
        html
      };

      await sgMail.send(msg);
      console.log(`✅ Email sent successfully to ${to}: ${subject}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to send email:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Duel invitation email
  async sendDuelInvitation({ toEmail, toUsername, fromUsername, duelId, expiresAt }) {
    const subject = `${fromUsername} challenges you to a duel!`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1B4332 0%, #40916C 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🏌️ Duel Challenge!</h1>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <p style="font-size: 18px; color: #1B4332; margin-bottom: 20px;">
            Hello <strong>${toUsername}</strong>!
          </p>
          
          <p style="font-size: 16px; color: #333; line-height: 1.6;">
            <strong>${fromUsername}</strong> has challenged you to a putting duel on Proof of Putt!
          </p>
          
          <div style="background: #40916C20; padding: 20px; border-radius: 6px; margin: 25px 0; text-align: center;">
            <p style="margin: 0; color: #1B4332; font-weight: bold;">
              ⏰ This invitation expires: ${new Date(expiresAt).toLocaleString()}
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.WEBAPP_URL || 'http://localhost:5173'}/duels/${duelId}" 
               style="background: linear-gradient(135deg, #1B4332 0%, #40916C 100%); 
                      color: white; 
                      padding: 15px 30px; 
                      text-decoration: none; 
                      border-radius: 6px; 
                      font-weight: bold;
                      font-size: 16px;
                      display: inline-block;">
              Accept Challenge
            </a>
          </div>
          
          <p style="font-size: 14px; color: #666; margin-top: 30px; text-align: center;">
            Good luck on the green!<br>
            <em>- The Proof of Putt Team</em>
          </p>
        </div>
      </div>
    `;

    const text = `
${fromUsername} challenges you to a duel!

Hello ${toUsername}!

${fromUsername} has challenged you to a putting duel on Proof of Putt!

This invitation expires: ${new Date(expiresAt).toLocaleString()}

Accept the challenge: ${process.env.WEBAPP_URL || 'http://localhost:5173'}/duels/${duelId}

Good luck on the green!
- The Proof of Putt Team
    `;

    return await this.sendEmail({
      to: toEmail,
      subject,
      html,
      text
    });
  }

  // Friend request email
  async sendFriendRequest({ toEmail, toUsername, fromUsername, requestId }) {
    const subject = `${fromUsername} wants to be your friend on Proof of Putt`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1B4332 0%, #40916C 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🤝 Friend Request</h1>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <p style="font-size: 18px; color: #1B4332; margin-bottom: 20px;">
            Hello <strong>${toUsername}</strong>!
          </p>
          
          <p style="font-size: 16px; color: #333; line-height: 1.6;">
            <strong>${fromUsername}</strong> wants to connect with you on Proof of Putt!
          </p>
          
          <p style="font-size: 14px; color: #666; line-height: 1.6;">
            Add them as a friend to see their putting progress, compete in friendly duels, and join leagues together.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.WEBAPP_URL || 'http://localhost:5173'}/friends?request=${requestId}" 
               style="background: linear-gradient(135deg, #1B4332 0%, #40916C 100%); 
                      color: white; 
                      padding: 15px 30px; 
                      text-decoration: none; 
                      border-radius: 6px; 
                      font-weight: bold;
                      font-size: 16px;
                      display: inline-block;
                      margin-right: 10px;">
              Accept Request
            </a>
          </div>
          
          <p style="font-size: 14px; color: #666; margin-top: 30px; text-align: center;">
            Happy putting!<br>
            <em>- The Proof of Putt Team</em>
          </p>
        </div>
      </div>
    `;

    const text = `
${fromUsername} wants to be your friend on Proof of Putt

Hello ${toUsername}!

${fromUsername} wants to connect with you on Proof of Putt!

Add them as a friend to see their putting progress, compete in friendly duels, and join leagues together.

Accept the request: ${process.env.WEBAPP_URL || 'http://localhost:5173'}/friends?request=${requestId}

Happy putting!
- The Proof of Putt Team
    `;

    return await this.sendEmail({
      to: toEmail,
      subject,
      html,
      text
    });
  }

  // League invitation email
  async sendLeagueInvitation({ toEmail, toUsername, fromUsername, leagueName, leagueId, roundStartDate }) {
    const subject = `Join "${leagueName}" league - invited by ${fromUsername}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1B4332 0%, #40916C 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🏆 League Invitation</h1>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <p style="font-size: 18px; color: #1B4332; margin-bottom: 20px;">
            Hello <strong>${toUsername}</strong>!
          </p>
          
          <p style="font-size: 16px; color: #333; line-height: 1.6;">
            <strong>${fromUsername}</strong> has invited you to join the <strong>"${leagueName}"</strong> league!
          </p>
          
          <div style="background: #40916C20; padding: 20px; border-radius: 6px; margin: 25px 0;">
            <p style="margin: 0 0 10px 0; color: #1B4332; font-weight: bold;">
              🎯 League: ${leagueName}
            </p>
            <p style="margin: 0; color: #1B4332;">
              📅 Next Round: ${new Date(roundStartDate).toLocaleDateString()}
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.WEBAPP_URL || 'http://localhost:5173'}/leagues/${leagueId}" 
               style="background: linear-gradient(135deg, #1B4332 0%, #40916C 100%); 
                      color: white; 
                      padding: 15px 30px; 
                      text-decoration: none; 
                      border-radius: 6px; 
                      font-weight: bold;
                      font-size: 16px;
                      display: inline-block;">
              Join League
            </a>
          </div>
          
          <p style="font-size: 14px; color: #666; margin-top: 30px; text-align: center;">
            Compete with friends and climb the leaderboard!<br>
            <em>- The Proof of Putt Team</em>
          </p>
        </div>
      </div>
    `;

    const text = `
Join "${leagueName}" league - invited by ${fromUsername}

Hello ${toUsername}!

${fromUsername} has invited you to join the "${leagueName}" league!

League: ${leagueName}
Next Round: ${new Date(roundStartDate).toLocaleDateString()}

Join the league: ${process.env.WEBAPP_URL || 'http://localhost:5173'}/leagues/${leagueId}

Compete with friends and climb the leaderboard!
- The Proof of Putt Team
    `;

    return await this.sendEmail({
      to: toEmail,
      subject,
      html,
      text
    });
  }

  // Session reminder email
  async sendSessionReminder({ toEmail, toUsername, activityType, dueDate, activityId }) {
    const subject = `⏰ Reminder: Your ${activityType} session is due soon`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1B4332 0%, #40916C 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">⏰ Session Reminder</h1>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <p style="font-size: 18px; color: #1B4332; margin-bottom: 20px;">
            Hello <strong>${toUsername}</strong>!
          </p>
          
          <p style="font-size: 16px; color: #333; line-height: 1.6;">
            Don't forget about your ${activityType} session!
          </p>
          
          <div style="background: #FFB84D20; padding: 20px; border-radius: 6px; margin: 25px 0; text-align: center;">
            <p style="margin: 0; color: #1B4332; font-weight: bold;">
              📅 Due: ${new Date(dueDate).toLocaleString()}
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.WEBAPP_URL || 'http://localhost:5173'}/sessions/${activityId}" 
               style="background: linear-gradient(135deg, #1B4332 0%, #40916C 100%); 
                      color: white; 
                      padding: 15px 30px; 
                      text-decoration: none; 
                      border-radius: 6px; 
                      font-weight: bold;
                      font-size: 16px;
                      display: inline-block;">
              Complete Session
            </a>
          </div>
          
          <p style="font-size: 14px; color: #666; margin-top: 30px; text-align: center;">
            Keep up the great work!<br>
            <em>- The Proof of Putt Team</em>
          </p>
        </div>
      </div>
    `;

    const text = `
Reminder: Your ${activityType} session is due soon

Hello ${toUsername}!

Don't forget about your ${activityType} session!

Due: ${new Date(dueDate).toLocaleString()}

Complete your session: ${process.env.WEBAPP_URL || 'http://localhost:5173'}/sessions/${activityId}

Keep up the great work!
- The Proof of Putt Team
    `;

    return await this.sendEmail({
      to: toEmail,
      subject,
      html,
      text
    });
  }
}

export default new EmailService();