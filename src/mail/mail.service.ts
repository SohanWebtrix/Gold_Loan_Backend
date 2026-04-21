import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private transporter;

  constructor(private config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: config.get('EMAIL_HOST'),
      port: config.get<number>('EMAIL_PORT'),
      secure: false,
      auth: {
        user: config.get('EMAIL_USER'),
        pass: config.get('EMAIL_PASS'),
      },
    });
  }

  async sendOTP(email: string, otp: string) {
    await this.transporter.sendMail({
      from: `"Support" <${this.config.get('EMAIL_USER')}>`,
      to: email,
      subject: 'Password Reset OTP',
      html: `
        <h2>Password Reset</h2>
        <p>Your OTP is:</p>
        <h1>${otp}</h1>
        <p>Valid for 30 minutes</p>
      `,
    });
  }
}
