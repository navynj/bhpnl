import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-helpers';
import { prisma } from '@/prisma/client';
import { sendEmail } from '@/lib/email';

/**
 * POST /api/quickbook/connections/[id]/request
 * Request access to a QuickBooks connection
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Access request sent successfully"
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id: connectionId } = await params;

    // Verify connection exists and get admin info
    const connection = await prisma.qBConnection.findUnique({
      where: { id: connectionId },
      select: {
        id: true,
        locationName: true,
        realmId: true,
        admin: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      );
    }

    // Check if user already has access
    const existingAccess = await prisma.userConnection.findUnique({
      where: {
        userId_qbConnectionId: {
          userId: user.id,
          qbConnectionId: connectionId,
        },
      },
    });

    if (existingAccess) {
      return NextResponse.json(
        { error: 'You already have access to this connection' },
        { status: 400 }
      );
    }

    // Get all admin users to send email notifications
    const admins = await prisma.user.findMany({
      where: {
        role: 'admin',
        email: {
          not: null,
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    console.log(`Found ${admins.length} admin(s) to notify`);

    // Check if email is configured
    const isEmailConfigured =
      process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

    if (!isEmailConfigured) {
      console.warn(
        '⚠️ Email not configured: SMTP_HOST, SMTP_USER, and SMTP_PASS must be set in environment variables'
      );
    }

    // Send email to all admins
    const connectionName = connection.locationName || connection.realmId;
    const userName = user.name || user.email || 'A user';
    const userEmail = user.email || 'Unknown email';

    if (admins.length === 0) {
      console.warn(
        'No admins found with email addresses. Skipping email notification.'
      );
    } else if (!isEmailConfigured) {
      console.warn('Email configuration missing. Emails will not be sent.');
    } else {
      const emailPromises = admins
        .filter((admin: (typeof admins)[number]) => admin.email)
        .map(async (admin: (typeof admins)[number]) => {
          const adminUrl =
            process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
          const subject = `QuickBooks Access Request - ${connectionName}`;

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
                    QuickBooks Access Request
                  </h2>
                  
                  <p>Hello ${admin.name || 'Admin'},</p>
                  
                  <p>
                    <strong>${userName}</strong> (${userEmail}) has requested access to a QuickBooks connection.
                  </p>

                  <div style="background-color: #e3f2fd; border-left: 4px solid #2196F3; padding: 12px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #1976D2;">Connection Details:</h3>
                    <p style="margin: 8px 0;"><strong>Location/Name:</strong> ${connectionName}</p>
                    <p style="margin: 8px 0;"><strong>Realm ID:</strong> ${
                      connection.realmId
                    }</p>
                    <p style="margin: 8px 0;"><strong>Connection ID:</strong> ${connectionId}</p>
                  </div>

                  <div style="background-color: #fff3e0; border-left: 4px solid #ff9800; padding: 12px; margin: 20px 0;">
                    <strong>Requested By:</strong>
                    <ul style="margin: 8px 0 0 0; padding-left: 20px;">
                      <li><strong>Name:</strong> ${userName}</li>
                      <li><strong>Email:</strong> ${userEmail}</li>
                      <li><strong>User ID:</strong> ${user.id}</li>
                    </ul>
                  </div>

                  <div style="background-color: #e8f5e9; border-left: 4px solid #4CAF50; padding: 12px; margin: 20px 0;">
                    <strong>What to do:</strong>
                    <ul style="margin: 8px 0 0 0; padding-left: 20px;">
                      <li>Log in to the admin panel at <a href="${adminUrl}/admin" style="color: #1976D2;">${adminUrl}/admin</a></li>
                      <li>Review the access request</li>
                      <li>Grant access to the user if approved</li>
                    </ul>
                  </div>

                  <p style="margin-top: 30px;">
                    <a href="${adminUrl}/admin" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                      Go to Admin Panel
                    </a>
                  </p>

                  <p style="margin-top: 30px; color: #666; font-size: 12px;">
                    This is an automated message. Please do not reply to this email.
                  </p>
                </div>
              </body>
            </html>
          `;

          try {
            const emailSent = await sendEmail({
              to: admin.email!,
              subject,
              html,
            });

            if (emailSent) {
              console.log(`✅ Email sent successfully to ${admin.email}`);
            } else {
              console.warn(
                `⚠️ Failed to send email to ${admin.email} (email transporter not available or error occurred)`
              );
            }

            return emailSent;
          } catch (error) {
            console.error(`❌ Error sending email to ${admin.email}:`, error);
            return false;
          }
        });

      // Wait for all emails to be sent and log results
      try {
        const results = await Promise.all(emailPromises);
        const successCount = results.filter((r: boolean) => r === true).length;
        const failCount = results.filter((r: boolean) => r === false).length;
        console.log(
          `Email sending completed: ${successCount} succeeded, ${failCount} failed`
        );
      } catch (error) {
        console.error('Error sending access request emails:', error);
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json({
      success: true,
      message: `Access request sent for connection: ${connectionName}. An admin will review your request.`,
    });
  } catch (error: any) {
    console.error('Error requesting access:', error);
    return NextResponse.json(
      {
        error: 'Failed to send access request',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
