const nodemailer = require('nodemailer');

const createTransporter = () => {
  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
};

const sendVerificationEmail = async (email, username, verificationCode) => {
  try {
    const transporter = createTransporter();
    const expiryMinutes = parseInt(process.env.VERIFICATION_CODE_EXPIRY);
    
    const mailOptions = {
      from: {
        name: 'Reschool final project',
        address: process.env.EMAIL_USER
      },
      to: email,
      subject: `Email Verification - Reschool final project API`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; text-align: center;">Welcome to Reschool final project API!</h2>
          <p>Hello <strong>${username}</strong>,</p>
          <p>Thank you for registering with Reschool final project API. To complete your registration and start publishing blogs, please verify your email address.</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <h3 style="color: #333; margin: 0;">Your Verification Code</h3>
            <div style="font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 4px; margin: 10px 0;">
              ${verificationCode}
            </div>
            <p style="color: #666; margin: 0;">This code will expire in ${expiryMinutes} minutes</p>
          </div>
          
          <p>If you didn't create an account with us, please ignore this email.</p>
          
          <hr style="border: 1px solid #eee; margin: 30px 0;">
          <p style="color: #666; font-size: 14px; text-align: center;">
            This is an automated email. Please do not reply to this message.
          </p>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Verification email sent successfully:', result.messageId);
    return true;
  } catch (error) {
    console.error('Error sending verification email:', error);
    return false;
  }
};

const sendLoginVerifyEmail = async (email, username, verificationCode) => {
  try {
    const transporter = createTransporter();
    const expiryMinutes = parseInt(process.env.VERIFICATION_CODE_EXPIRY);
    
    const mailOptions = {
      from: {
        name: 'Reschool final project',
        address: process.env.EMAIL_USER
      },
      to: email,
      subject: `Email Verification - Reschool final project API`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; text-align: center;">Welcome to Reschool final project API!</h2>
          <p>Hello <strong>${username}</strong>,</p>
          <p>You have been inactive for over a week. A verification code has been sent to your email.</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <h3 style="color: #333; margin: 0;">Your Verification Code</h3>
            <div style="font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 4px; margin: 10px 0;">
              ${verificationCode}
            </div>
            <p style="color: #666; margin: 0;">This code will expire in ${expiryMinutes} minutes</p>
          </div>
          
          <p>If you didn't create an account with us, please ignore this email.</p>
          
          <hr style="border: 1px solid #eee; margin: 30px 0;">
          <p style="color: #666; font-size: 14px; text-align: center;">
            This is an automated email. Please do not reply to this message.
          </p>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Verification email sent successfully:', result.messageId);
    return true;
  } catch (error) {
    console.error('Error sending verification email:', error);
    return false;
  }
};

const sendWelcomeEmail = async (email, username) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: {
        name: 'Reschool final project',
        address: process.env.EMAIL_USER
      },
      to: email,
      subject: `Welcome to Reschool final project API!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; text-align: center;">Welcome to Reschool final project API!</h2>
          <p>Hello <strong>${username}</strong>,</p>
          <p>Congratulations! Your email has been successfully verified and your account is now active.</p>
          
          <div style="background-color: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h4 style="color: #155724; margin: 0 0 10px 0;">🎉 You can now:</h4>
            <ul style="color: #155724; margin: 0;">
              <li>Create and publish blog posts</li>
              <li>Upload cover images for your blogs</li>
              <li>Comment on and like other blogs</li>
              <li>Bookmark your favorite posts</li>
            </ul>
          </div>
          
          
          <hr style="border: 1px solid #eee; margin: 30px 0;">
          <p style="color: #666; font-size: 14px; text-align: center;">
            Happy blogging!<br>
            The Reschool final project Team
          </p>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Welcome email sent successfully:', result.messageId);
    return true;
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return false;
  }
};

const sendPasswordResetEmail = async (email, username, resetToken) => {
  try {
    const transporter = createTransporter();
    const resetUrl = process.env.FRONTEND_URL 
      ? `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`
      : `${process.env.PRODUCTION_API_URL || 'http://localhost:' + process.env.PORT}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: {
        name: process.env.API_TITLE || 'Express Blog API',
        address: process.env.EMAIL_USER
      },
      to: email,
      subject: `Password Reset - Reschool final project`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; text-align: center;">Password Reset Request</h2>
          <p>Hello <strong>${username}</strong>,</p>
          <p>We received a request to reset your password for your Reschool final project account.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Reset Your Password
            </a>
          </div>
          
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p style="word-break: break-all; background-color: #f8f9fa; padding: 10px; border-radius: 4px;">
            ${resetUrl}
          </p>
          
          <p style="color: #dc3545;"><strong>This link will expire in 1 hour.</strong></p>
          
          <p>If you didn't request a password reset, please ignore this email. Your password will remain unchanged.</p>
          
          <hr style="border: 1px solid #eee; margin: 30px 0;">
          <p style="color: #666; font-size: 14px; text-align: center;">
            This is an automated email. Please do not reply to this message.
          </p>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent successfully:', result.messageId);
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return false;
  }
};

module.exports = {
  sendVerificationEmail,
  sendLoginVerifyEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail
};