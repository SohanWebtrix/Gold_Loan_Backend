/* eslint-disable prettier/prettier */
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
  ValidateNested,
  IsArray,
} from 'class-validator';

import { Type } from 'class-transformer';
import { CreateNomineeDto } from './nominee.dto';
import { CreateMortgagedItemDto } from './mortaged.dto';



export class CreateLoanDto {

  @Type(() => Number)
  @IsNumber()
  client_id?: number;

  @Type(() => Number)
  @IsNumber()
  customer_id?: number;

  @IsDateString()
  loan_start_date?: string;

  @IsNotEmpty()
  @IsString()
  loan_document_number?: string;

  @IsOptional()
  @IsString()
  adhar_card?: string;

  @IsOptional()
  @IsString()
  pan_card?: string;

  @Type(() => Number)
  @IsNumber()
  duration_months?: number;

  @IsDateString()
  due_date?: string;

  @Type(() => Number)
  @IsNumber()
  principal_amount?: number;

  @Type(() => Number)
  @IsNumber()
  interest_rate?: number;

  @Type(() => Number)
  @IsNumber()
  interest_amount?: number;

  @Type(() => Number)
  @IsNumber()
  total_amount?: number;

  @IsEnum([
    'Cash Payment',
    'Bank Transfer',
    'Online',
    'Credit',
  ])
  payment_type?: string;

  @IsOptional()
  @IsString()
  transaction_reference_no?: string;

  @IsOptional()
  @IsDateString()
  transaction_date?: string;

  @IsOptional()
  @IsString()
  note?: string;


    @IsOptional()
  @IsString()
  address?: string;

  // ==========================
  // nominees[]
  // ==========================
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateNomineeDto)
  nominees?: CreateNomineeDto[];

  // ==========================
  // mortgaged_items[]
  // ==========================
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMortgagedItemDto)
  mortgaged_items?: CreateMortgagedItemDto[];
}