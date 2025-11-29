import nodemailer from 'nodemailer';

/**
 * Email utility for sending notifications
 */

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Create email transporter
 * Uses SMTP configuration from environment variables
 */
function createTransporter() {
  // Check if email is configured
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('Email not configured: SMTP_HOST, SMTP_USER, and SMTP_PASS must be set');
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Send email notification
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const transporter = createTransporter();
  
  if (!transporter) {
    console.warn('Email transporter not available, skipping email send');
    return false;
  }

  try {
    const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@example.com';
    
    await transporter.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''),
    });

    console.log(`Email sent successfully to ${options.to}`);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

/**
 * Send token refresh alert email to admin
 */
export async function sendTokenRefreshAlert(
  adminEmail: string,
  connectionsNeedingRefresh: Array<{
    id: string;
    locationName: string | null;
    realmId: string;
    expiresAt: Date;
    refreshTokenExpiresAt: Date | null;
    status: {
      accessExpired: boolean;
      refreshExpired: boolean;
      accessExpiresSoon: boolean;
      needsRefresh: boolean;
    };
  }>
): Promise<boolean> {
  const expiredCount = connectionsNeedingRefresh.filter(
    (c) => c.status.accessExpired || c.status.refreshExpired
  ).length;
  const expiringSoonCount = connectionsNeedingRefresh.filter(
    (c) => c.status.accessExpiresSoon && !c.status.accessExpired
  ).length;

  const subject = `QuickBooks Token Refresh Alert - ${connectionsNeedingRefresh.length} Connection(s) Need Attention`;

  const connectionsList = connectionsNeedingRefresh
    .map((conn) => {
      const location = conn.locationName || conn.realmId;
      const statusBadge = conn.status.refreshExpired
        ? '<span style="color: red; font-weight: bold;">REFRESH TOKEN EXPIRED</span>'
        : conn.status.accessExpired
        ? '<span style="color: red; font-weight: bold;">ACCESS TOKEN EXPIRED</span>'
        : '<span style="color: orange; font-weight: bold;">EXPIRES SOON</span>';
      
      const expiresAt = new Date(conn.expiresAt).toLocaleString();
      const refreshExpiresAt = conn.refreshTokenExpiresAt
        ? new Date(conn.refreshTokenExpiresAt).toLocaleString()
        : 'Unknown';

      return `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${location}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${statusBadge}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${expiresAt}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${refreshExpiresAt}</td>
        </tr>
      `;
    })
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px;">
            QuickBooks Token Refresh Alert
          </h2>
          
          <p>Hello,</p>
          
          <p>
            This is an automated alert to notify you that <strong>${connectionsNeedingRefresh.length} QuickBooks connection(s)</strong> 
            ${expiredCount > 0 ? `have expired` : expiringSoonCount > 0 ? `will expire soon` : `need attention`}.
          </p>

          ${expiredCount > 0 ? `
            <div style="background-color: #ffebee; border-left: 4px solid #f44336; padding: 12px; margin: 20px 0;">
              <strong style="color: #c62828;">⚠️ ${expiredCount} connection(s) have expired tokens</strong>
              <p style="margin: 8px 0 0 0; color: #666;">These connections require immediate attention. Please refresh the tokens or reauthorize the connection.</p>
            </div>
          ` : ''}

          ${expiringSoonCount > 0 ? `
            <div style="background-color: #fff3e0; border-left: 4px solid #ff9800; padding: 12px; margin: 20px 0;">
              <strong style="color: #e65100;">⏰ ${expiringSoonCount} connection(s) will expire within 5 minutes</strong>
              <p style="margin: 8px 0 0 0; color: #666;">These connections should be refreshed soon to avoid service interruption.</p>
            </div>
          ` : ''}

          <h3 style="color: #333; margin-top: 30px;">Connection Details:</h3>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background-color: #f5f5f5;">
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Location/Realm ID</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Status</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Access Token Expires</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Refresh Token Expires</th>
              </tr>
            </thead>
            <tbody>
              ${connectionsList}
            </tbody>
          </table>

          <div style="background-color: #e3f2fd; border-left: 4px solid #2196F3; padding: 12px; margin: 20px 0;">
            <strong>What to do:</strong>
            <ul style="margin: 8px 0 0 0; padding-left: 20px;">
              <li>Log in to the admin panel</li>
              <li>Click the "Refresh Token" button to refresh all tokens that need attention</li>
              <li>For connections with expired refresh tokens, you may need to reauthorize the connection</li>
            </ul>
          </div>

          <p style="margin-top: 30px; color: #666; font-size: 12px;">
            This is an automated message. Please do not reply to this email.
          </p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: adminEmail,
    subject,
    html,
  });
}

