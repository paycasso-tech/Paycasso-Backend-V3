import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(EmailService.name);

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      this.logger.log(' SMTP Transporter initialized');
    } else {
      this.logger.warn(' SMTP credentials not found. Emails will be logged to console only.');
    }
  }

  async sendNotificationEmail(email: string, subject: string, message: string): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
        <h2>${subject}</h2>
        <p>${message}</p>
        <p>Log in to the platform to view details.</p>
      </div>
    `;
    await this.sendMail(email, subject, html, 'NOTIFICATION');
  }

  async sendVerificationEmail(email: string, otp: string): Promise<void> {
    const subject = 'Verify your Email - Escrow Platform';
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
        <h2>Welcome to Escrow Platform!</h2>
        <p>Please use the following OTP to verify your email address:</p>
        <h1 style="color: #4CAF50; letter-spacing: 5px;">${otp}</h1>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      </div>
    `;

    await this.sendMail(email, subject, html, otp);
  }

  async sendPasswordResetEmail(email: string, otp: string): Promise<void> {
    const subject = 'Reset your Password - Escrow Platform';
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
        <h2>Password Reset Request</h2>
        <p>Use the code below to reset your password:</p>
        <h1 style="color: #E53935; letter-spacing: 5px;">${otp}</h1>
        <p>This code will expire in 10 minutes.</p>
      </div>
    `;

    await this.sendMail(email, subject, html, otp);
  }

  private async sendMail(to: string, subject: string, html: string, otpForLog: string) {
    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: process.env.EMAIL_FROM,
          to,
          subject,
          html,
        });
        this.logger.log(` Email sent to ${to}`);
      } catch (error) {
        this.logger.error(` Failed to send email to ${to}:`, error);
        throw error;
      }
    } else {
      // Fallback for development without SMTP
      this.logger.log(`[DEV MODE]  Sending Email to ${to}:`);
      this.logger.log(`Subject: ${subject}`);
      this.logger.log(`OTP Content: ${otpForLog}`);
    }
  }
}
