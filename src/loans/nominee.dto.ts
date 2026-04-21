/* eslint-disable prettier/prettier */
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CreateNomineeDto {

  @IsNotEmpty()
  @IsString()
  nominee_name?: string;

  @IsNotEmpty()
  @IsString()
  nominee_relation?: string;

  @IsNotEmpty()
  @IsString()
  nominee_address?: string;

  @IsNotEmpty()
  @IsString()
  @Length(10, 10)
  nominee_phone?: string;
}