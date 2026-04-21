/* eslint-disable prettier/prettier */
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
} from 'class-validator';

import { Type } from 'class-transformer';

export class CreateMortgagedItemDto {

  @IsNotEmpty()
  @IsString()
  category?: string;

    @IsOptional()
  @IsString()
  morgaged_note?: string;

  @IsNotEmpty()
  @IsString()
  purity?: string;

  @Type(() => Number)
  @IsNumber()
  gross_weight?: number;

  @Type(() => Number)
  @IsNumber()
  net_weight?: number;

  @Type(() => Number)
  @IsNumber()
  rate?: number;

  @Type(() => Number)
  @IsNumber()
  amount?: number;
}