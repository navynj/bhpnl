# SMTP Email Configuration Guide

This guide explains how to set up SMTP email for sending notifications (e.g., QuickBooks access requests).

## Required Environment Variables

Add these to your `.env.local` file:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=your_email@gmail.com
```

## Getting SMTP Credentials

### Option 1: Gmail (Recommended for Development)

1. **Enable 2-Factor Authentication** on your Google account
2. **Generate an App Password**:

   - Go to [Google Account Settings](https://myaccount.google.com/)
   - Navigate to **Security** → **2-Step Verification**
   - Scroll down to **App passwords**
   - Generate a new app password for "Mail"
   - Copy the 16-character password

3. **Use these settings**:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your_email@gmail.com
   SMTP_PASS=your_16_char_app_password
   SMTP_FROM=your_email@gmail.com
   ```

### Option 2: Outlook/Hotmail

1. **Enable 2-Factor Authentication** on your Microsoft account
2. **Generate an App Password**:

   - Go to [Microsoft Account Security](https://account.microsoft.com/security)
   - Navigate to **Security** → **Advanced security options**
   - Under **App passwords**, create a new app password
   - Copy the generated password

3. **Use these settings**:
   ```env
   SMTP_HOST=smtp-mail.outlook.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your_email@outlook.com
   SMTP_PASS=your_app_password
   SMTP_FROM=your_email@outlook.com
   ```

### Option 3: SendGrid (Recommended for Production)

1. **Sign up** at [SendGrid](https://sendgrid.com/)
2. **Create an API Key**:

   - Go to Settings → API Keys
   - Create a new API key with "Mail Send" permissions
   - Copy the API key

3. **Use these settings**:
   ```env
   SMTP_HOST=smtp.sendgrid.net
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=apikey
   SMTP_PASS=your_sendgrid_api_key
   SMTP_FROM=your_verified_sender_email@yourdomain.com
   ```

### Option 4: Mailgun

1. **Sign up** at [Mailgun](https://www.mailgun.com/)
2. **Get SMTP credentials**:

   - Go to Sending → Domain Settings
   - Copy your SMTP credentials

3. **Use these settings**:
   ```env
   SMTP_HOST=smtp.mailgun.org
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your_mailgun_username
   SMTP_PASS=your_mailgun_password
   SMTP_FROM=your_verified_email@yourdomain.com
   ```

### Option 5: AWS SES (Amazon Simple Email Service)

1. **Set up AWS SES**:

   - Verify your email address or domain
   - Create SMTP credentials in AWS SES console

2. **Use these settings**:
   ```env
   SMTP_HOST=email-smtp.us-east-1.amazonaws.com  # Use your region
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your_ses_smtp_username
   SMTP_PASS=your_ses_smtp_password
   SMTP_FROM=your_verified_email@yourdomain.com
   ```

## Testing Your SMTP Configuration

After setting up your SMTP variables, test by:

1. Making a QuickBooks access request
2. Checking your server logs for email sending status
3. Verifying the email arrives in the admin's inbox

## Troubleshooting

### Email not sending?

1. **Check environment variables**:

   ```bash
   # In your terminal, verify variables are loaded
   echo $SMTP_HOST
   echo $SMTP_USER
   ```

2. **Check server logs**:

   - Look for warnings about missing SMTP configuration
   - Check for email sending errors

3. **Common issues**:
   - **Gmail**: Make sure you're using an App Password, not your regular password
   - **Port 587 blocked**: Try port 465 with `SMTP_SECURE=true`
   - **Firewall**: Ensure your server can connect to SMTP servers
   - **Credentials**: Double-check username and password

### Gmail-specific Issues

- **"Less secure app access"**: Gmail no longer supports this. You MUST use App Passwords.
- **Rate limits**: Gmail has daily sending limits (500 emails/day for free accounts)
- **Spam folder**: Check spam folder if emails aren't arriving

## Security Best Practices

1. **Never commit `.env.local`** to version control (already in `.gitignore`)
2. **Use App Passwords** instead of your main account password
3. **Rotate credentials** regularly
4. **Use environment-specific accounts** (separate email for dev/staging/prod)
5. **For production**, use a dedicated email service (SendGrid, Mailgun, AWS SES)

## Production Recommendations

For production environments, consider:

- **SendGrid** or **Mailgun**: Reliable, scalable, good deliverability
- **AWS SES**: Cost-effective for high volume
- **Postmark**: Great for transactional emails
- **Resend**: Modern alternative with great developer experience

These services provide:

- Better deliverability
- Analytics and tracking
- Higher sending limits
- Better support
