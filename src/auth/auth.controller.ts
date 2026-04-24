/* eslint-disable prettier/prettier */

import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthDto } from './auth.dto';
import type { Response, Request } from 'express';
import { LoginDto } from './LoginDto';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {

  constructor(private readonly authService: AuthService) {

  }

  @Post('create_customer')
             @UseGuards(AuthGuard('jwt'))
  async CreateUser(@Body() dto: any,@Req() req:any) {
                     const userId = req.user.userId;


    return this.authService.CreateUser(dto,userId);
  }

   @Post('create_admin')
  async CreateAdmin(@Body() dto:any) {
    return this.authService.CreateAdmin(dto);
  }

  @Post('verifyUser')
  async LoginByEmail(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    
    const result = await this.authService.loginWithEmail(
      body.login_id,
      body.validPass,
    );

    const AccessTokenss = result.accessToken;

    return {
      message: result.message,
      user: result.user,
      AccessTokenss,
      RefreshToken: result.refreshToken,
    };
  }

    @Post('verifyAdmin')
  async LoginById(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    
    const result = await this.authService.loginEmailAdmin(
      body.login_id,
      body.validPass,
    );

    const AccessTokenss = result.accessToken;

    return {
      message: result.message,
      user: result.user,
      AccessTokenss,
      RefreshToken: result.refreshToken,
    };
  }


  @Post('forgot_password')
  forgotPassword(@Body('emailid') email: string) {
    return this.authService.forgotPassword(email);
  }

  @Post('verify_otp_email')
  async verifyOtpEmail(
    @Body() body,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyEmailOtp(body.email, body.otp);

    return {
      message: result.message,
    };
  }

  @Post('reset_password')
  async resetPassword(
    @Body() body,
  ) {

    return this.authService.resetPassword(body.email, body.password);
  }

}
