/* eslint-disable prettier/prettier */

import { IsEmail, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateStaffDto {


  @IsOptional()
  @IsString()
  first_name?: string;

  @IsOptional()
  @IsString()
  last_name?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  address_line1?: string;

  @IsOptional()
  @IsString()
  address_line2?: string;

  @IsOptional()
  @IsNumber()
  state?: number;

  @IsOptional()
  @IsNumber()
  city?: number;

  @IsOptional()
  @IsString()
  pincode?: string;

  @IsOptional()
  @IsString()
  cust_phone?: string;

  @IsOptional()
  @IsEmail()
  cust_email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  cust_password?: string;

  @IsOptional()
  @IsString()
  role?: string;
}
