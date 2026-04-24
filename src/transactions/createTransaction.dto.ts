/* eslint-disable prettier/prettier */

import { Transform, Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsEnum,
} from 'class-validator';

const emptyToUndefined = ({ value }) =>
  value === null ||
  value === undefined ||
  value === '' ||
  value === 'null' ||
  value === 'undefined'
    ? undefined
    : value;

export class CreateLoanTransactionDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  transaction_id?: number;

  @IsOptional()
  @IsString()
  receipt_no?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  loan_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  client_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  company_id?: number;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString()
  transaction_date?: string;

  @IsOptional()
  @IsEnum([
    'EMI',
    'LOAN_AMOUNT_ONLY',
    'INTEREST_ONLY',
    'LOAN_PLUS_INTEREST',
    'TOPUP',
  ])
  transaction_type?:
    | 'EMI'
    | 'LOAN_AMOUNT_ONLY'
    | 'INTEREST_ONLY'
    | 'LOAN_PLUS_INTEREST'
    | 'TOPUP';

  @IsOptional()
  @IsEnum([
    'CASH',
    'BANK',
    'ONLINE',
    'CHEQUE',
    'CREDIT',
  ])
  payment_method?:
    | 'CASH'
    | 'BANK'
    | 'ONLINE'
    | 'CHEQUE'
    | 'CREDIT';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  paid_amount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  principal_paid?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  interest_paid?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  overdue_paid?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  topup_amount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  principal_balance?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  interest_balance?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  overdue_balance?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  total_balance?: number;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  cheque_no?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  bank_account?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  transaction_ref_no?: string;

  @IsOptional()
  @IsEnum([
    'SUCCESS',
    'PENDING',
    'FAILED',
    'CANCELLED',
  ])
  status?: 'SUCCESS' | 'PENDING' | 'FAILED' | 'CANCELLED';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  created_by?: number;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString()
  created_at?: string;
}