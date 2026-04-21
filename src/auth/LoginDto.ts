import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsNotEmpty()
  login_id: string;

  @IsString()
  @IsNotEmpty()
  validPass: string;

}