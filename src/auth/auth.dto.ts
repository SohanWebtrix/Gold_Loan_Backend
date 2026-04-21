/* eslint-disable prettier/prettier */

import { Type } from 'class-transformer';
import {
    IsString,
    IsOptional,
    IsNumber,
    IsEnum,
    IsEmail,
    MinLength,
    isString,
} from 'class-validator';

export class AuthDto {

    @IsOptional()
    @IsString()
    cust_name?: string;

    @IsOptional()
    @IsString()
    username?: string;

    @IsOptional()
    @IsEmail()
    cust_email?: string;

    @IsOptional()
    @IsString()
    @MinLength(6)
    cust_password?: string;
}