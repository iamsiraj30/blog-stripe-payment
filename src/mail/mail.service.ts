import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  async sendVerificationOtp(email: string, otp: number) {
    const mailOptions = {
      from: `"Rom Auth" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Email Verification OTP',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #333333; text-align: center;">Verify Your Email</h2>
          <p>Hello,</p>
          <p>Thank you for registering. Please use the following One-Time Password (OTP) to complete your registration. This OTP is valid for 10 minutes.</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px; background-color: #f5f5f5; padding: 10px 20px; border-radius: 4px; border: 1px dashed #cccccc;">${otp}</span>
          </div>
          <p>If you did not request this, please ignore this email.</p>
          <br>
          <p>Best regards,</p>
          <p><strong>Rom Auth Team</strong></p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send verification OTP email:', error);
      throw new Error('Could not send verification email. Please try again.');
    }
  }

  async sendPasswordResetOtp(email: string, otp: number) {
    const mailOptions = {
      from: `"Rom Auth" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Password Reset OTP',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #333333; text-align: center;">Reset Your Password</h2>
          <p>Hello,</p>
          <p>You requested to reset your password. Please use the following One-Time Password (OTP) to reset your password. This OTP is valid for 10 minutes.</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px; background-color: #f5f5f5; padding: 10px 20px; border-radius: 4px; border: 1px dashed #cccccc;">${otp}</span>
          </div>
          <p>If you did not request this, please ignore this email.</p>
          <br>
          <p>Best regards,</p>
          <p><strong>Rom Auth Team</strong></p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send password reset OTP email:', error);
      throw new Error('Could not send password reset email. Please try again.');
    }
  }
}
