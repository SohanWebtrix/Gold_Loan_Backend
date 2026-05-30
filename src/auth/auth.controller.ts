/* eslint-disable prettier/prettier */

import { BadRequestException, Body, Controller, Get, Headers, Param, ParseIntPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './LoginDto';
import type { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';

type JwtRequest = Request & { user: { userId: number } };

@Controller('auth')

export class AuthController {

  constructor(private readonly authService: AuthService) {

  }

  @Post('create_customer')
  @UseGuards(AuthGuard('jwt'))
  async CreateUser(@Body() dto: any, @Req() req: JwtRequest) {

    const userId = req.user.userId;

    return this.authService.CreateUser(dto, userId);

  }

  @Put('update_customer/:customer_id')
  @UseGuards(AuthGuard('jwt'))
  async UpdateUser(@Body() dto: any, @Req() req: JwtRequest, @Param('customer_id') customerId: string

  ) {

    const customerIdNumber = Number(customerId);
    const userId = req.user.userId;
    return this.authService.UpdateCustomer(dto, customerIdNumber, userId);

  }

  @Get('customer/:customer_id')
  @UseGuards(AuthGuard('jwt'))
  async getCustomerDetails(
    @Param('customer_id') customerId: string,
    @Headers('comp-id') compIdHeader: string,
  ) {

    const customerIdNumber = Number(customerId);

    const compIdNumber = compIdHeader ? Number(compIdHeader) : undefined;

    return this.authService.getCustomerDetails(customerIdNumber, compIdNumber);

  }

  @Post('create_admin')
  async CreateAdmin(@Body() dto: any) {
    return this.authService.CreateAdmin(dto);
  }

  @Post('verifyUser')
  async LoginByEmail(
    @Body() body: LoginDto,
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
    @Body() body: { email: string; otp: string },
  ) {

    const result = await this.authService.verifyEmailOtp(body.email, body.otp);

    return {
      message: result.message,
    };
  }

  @Post('reset_password')
  async resetPassword(
    @Body() body: { email: string; password: string },
  ) {

    return this.authService.resetPassword(body.email, body.password);

  }

  @Post('logout')
  logout(@Req() req) {

    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      throw new BadRequestException("Token missing");
    }

    return this.authService.logout(token);

  }


}