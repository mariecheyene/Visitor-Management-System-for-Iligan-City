const nodemailer = require('nodemailer');
require('dotenv').config();

// Validate email configuration
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
  console.warn('⚠️  WARNING: Email credentials not configured in .env file');
  console.warn('   EMAIL_USER and EMAIL_PASSWORD are required for OTP emails');
}

// Create reusable transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Verify transporter on startup
transporter.verify(function(error, success) {
  if (error) {
    console.error('❌ Email configuration error:', error.message);
    console.error('   Please check your EMAIL_USER and EMAIL_PASSWORD in .env file');
    if (error.message.includes('Application-specific password')) {
      console.error('   ⚠️  You need to use a Gmail App Password, not your regular password!');
      console.error('   📖 Follow the guide: https://support.google.com/accounts/answer/185833');
    }
  } else {
    console.log('✅ Email service is ready to send OTP emails');
  }
});

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP email
const sendOTPEmail = async (email, otp, userName) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Prison Management System - OTP Verification',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
            <h2 style="color: #333; text-align: center; margin-bottom: 20px;">Welcome to Prison Management System</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">Hello ${userName},</p>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">Your account has been created. Please use the following OTP to complete your first-time login:</p>
            
            <div style="background-color: #f8f9fa; border: 2px dashed #007bff; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
              <h1 style="color: #007bff; font-size: 36px; letter-spacing: 8px; margin: 0;">${otp}</h1>
            </div>
            
            <p style="color: #666; font-size: 14px; line-height: 1.6;">This OTP will expire in <strong>10 minutes</strong>.</p>
            <p style="color: #666; font-size: 14px; line-height: 1.6;">If you didn't request this, please contact your administrator immediately.</p>
            
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
            
            <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('OTP email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending OTP email:', error);
    return { success: false, error: error.message };
  }
};

// Send Password Reset OTP email
const sendPasswordResetOTP = async (email, otp, userName) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Prison Management System - Password Reset OTP',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
            <h2 style="color: #333; text-align: center; margin-bottom: 20px;">Password Reset Request</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">Hello ${userName},</p>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">We received a request to reset your password. Please use the following OTP to complete the password reset process:</p>
            
            <div style="background-color: #f8f9fa; border: 2px dashed #dc3545; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
              <h1 style="color: #dc3545; font-size: 36px; letter-spacing: 8px; margin: 0;">${otp}</h1>
            </div>
            
            <p style="color: #666; font-size: 14px; line-height: 1.6;">This OTP will expire in <strong>10 minutes</strong>.</p>
            <p style="color: #dc3545; font-size: 14px; line-height: 1.6;"><strong>⚠️ If you didn't request this password reset, please ignore this email and contact your administrator immediately.</strong></p>
            
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
            
            <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset OTP email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending password reset OTP email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  generateOTP,
  sendOTPEmail,
  sendPasswordResetOTP
};
