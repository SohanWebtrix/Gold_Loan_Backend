/* eslint-disable prettier/prettier */

import { Transform, Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
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

export class CreateClientDto {

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cl_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  compc_id?: number;

  @IsOptional()
  @IsString()
  client_code?: string;

  @IsOptional()
  @IsString()
  caste?: string;

  @IsOptional()
  @IsString()
  occupation?: string;


  @IsOptional()
  @IsString()
  first_name?: string;

  @IsOptional()
  @IsString()
  last_name?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  mobile_no?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === null ||
      value === '' ||
      value === 'null' ||
      value === 'undefined'
      ? undefined
      : value
  )
  @IsDateString()
  dob?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === null ||
      value === '' ||
      value === 'null' ||
      value === 'undefined'
      ? undefined
      : value
  )
  @IsEnum(['male', 'female', 'other'])
  gender?: 'male' | 'female' | 'other';

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  aadhaar_card_no?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  pan_card_no?: string;


  @IsOptional()
  @IsString()
  street_add1?: string;

  @IsOptional()
  @IsString()
  street_add2?: string;

  @IsOptional()
  @IsString()
  landmark?: string;

  @IsOptional()
  @IsString()
  pincode?: string;

  @IsOptional()
  @Type(() => Number)

  @IsNumber()
  state?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  city?: number;


  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: 'active' | 'inactive';

  @IsOptional()
  @Type(() => Date)
  created_date?: Date;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  created_by?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  modified_by?: number;

  @IsOptional()
  @Type(() => Date)
  modified_date?: Date;

  @IsOptional()
  @IsString()
  profile_pic_path?: string;

  @IsOptional()
  @IsString()
  aadhaar_id_path?: string;

  @IsOptional()
  @IsString()
  pan_card_path?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  remove_adhar?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  remove_pan?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  remove_photo?: boolean;

}