/* eslint-disable prettier/prettier */


import { BadRequestException, HttpException, HttpStatus, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { AuthRepository } from './auth.repository/auth.repository';
import { AuthDto } from './auth.dto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { MailService } from 'src/mail/mail.service';


@Injectable()
export class AuthService {

    constructor(
        private jwtService: JwtService,
        private readonly authRepo: AuthRepository,
        private mailService: MailService,
    ) {

    }

    async generateTokens(user) {

        console.log("generatetoken called ")
        const accessToken = this.jwtService.sign(
            { sub: user.id, email: user.email },
            { expiresIn: '24h' },
        );

        const refreshToken = this.jwtService.sign(
            { sub: user.id, type: 'refresh' },
            { expiresIn: '7d' },
        );

        // await this.saveRefreshToken(user.id, refreshToken);

        return { accessToken, refreshToken };
    }



  // SERVICE
async CreateUser(dto: any, userId: number) {
    try {
        console.log("create user dto is", dto);

        // 1️⃣ Insert into company table
        const companyResult: any = await this.authRepo.insertCompany(dto, userId);

        const company_id = companyResult.insertId;

        // 2️⃣ Insert into customer table with company_id
        const customerResult: any = await this.authRepo.insertCustomer(
            dto,
            userId,
            company_id
        );

        // 3️⃣ Success check
        if (customerResult && customerResult.affectedRows === 1) {
            return {
                success: true,
                message: "Customer added successfully",
                customerId: customerResult.insertId,
                companyId: company_id,
            };
        }

        throw new InternalServerErrorException("Failed to add customer");
    } catch (error) {
        console.error("CreateCustomer error", error);
        throw error;
    }
}

       async CreateAdmin(dto: any) {

        try {
            const result: any = await this.authRepo.insertAdmin(dto);

            // 3️⃣ Check success
            if (result && result.affectedRows === 1) {
                return {
                    success: true,
                    message: 'admin added successfully',
                    userId: result.insertId,
                };
            }

            throw new InternalServerErrorException("Failed to add admin");
        }
        catch (error) {
            console.error("CreateAdmin error", error)
            throw error;
        }
    }

    async loginWithEmail(login_id: string, password: string) {

        const rows = await this.authRepo.loginemail(login_id);


        if (!rows) {
            throw new UnauthorizedException('Invalid username or mobile number');
        }

        const user = rows;

        // ✅ CHECK STATUS FIRST
        if (user.status !== 'active') {
            throw new UnauthorizedException('User is inactive');
        }


        const isMatch = await bcrypt.compare(password, user.cust_password);
        if (!isMatch) {
            throw new UnauthorizedException('Invalid username or password');
        }


        // ✅ Use generateTokens
        const { accessToken, refreshToken } =
            await this.generateTokens({
                id: user.customer_id,
                email: user.cust_email,
            });

        return {
            message: 'Login successful',
            accessToken,
            refreshToken,
            user: {
                id: user.customer_id,
                email: user.cust_email,
                name: user.cust_name,
                comp_id:user.comp_id,
                mobile_no:user.cust_phone,
            },
        };
    }

    async loginEmailAdmin(login_id: string, password: string) {

        const rows = await this.authRepo.loginemailadmin(login_id);


        if (!rows) {
            throw new UnauthorizedException('Invalid username or mobile number');
        }

        const user = rows;

        // ✅ CHECK STATUS FIRST
        if (user.status !== 'active') {
            throw new UnauthorizedException('admin is inactive');
        }


        const isMatch = await bcrypt.compare(password, user.admin_password);
        if (!isMatch) {
            throw new UnauthorizedException('Invalid username or password');
        }


        // ✅ Use generateTokens
        const { accessToken, refreshToken } =
            await this.generateTokens({
                id: user.admin_id,
                email: user.admin_email,
            });

        return {
            message: 'Login successful',
            accessToken,
            refreshToken,
            user: {
                id: user.admin_id,
                email: user.admin_email,
                name: user.admin_name,
                mobile_no:user.admin_phone,
            },
        };
    }




    async forgotPassword(email: string) {

        try {

            const useremail = await this.authRepo.findemail(email);

            console.log("user email is", useremail)
            if (!useremail) {
                throw new UnauthorizedException('Email not found');
            }

            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const hash = await bcrypt.hash(otp, 10);
            const expiry = new Date(Date.now() + 30 * 60 * 1000);

            console.log("expiry time is", expiry)
            const rows = await this.authRepo.insertOtp(email, hash, expiry);

            await this.mailService.sendOTP(email, otp);


            if (rows && rows.affectedRows === 1) {
                return {
                    success: true,
                    message: "otp sent successfully",
                }
            }

            throw new InternalServerErrorException("Fail to send otp");
        } catch (error) {


            if (error instanceof HttpException) {
                throw error;
            }

            throw new InternalServerErrorException(
                'Failed to send OTP email. Please try again.',
            );
        }
    }

    async verifyEmailOtp(email: string, otp: string) {
        // Compare OTP with hash

        try {
            if (!email || !otp) {
                throw new BadRequestException('Email & OTP required');
            }

            const rows = await this.authRepo.findValidOTPEmail(email);

            console.log("rows are", rows);

            if (!rows || rows.length === 0) {
                throw new BadRequestException('otp expried or invalid');
            }

            const record = rows[0];


            if (record.attempts >= 5) {
                throw new HttpException('Too many attempts', HttpStatus.TOO_MANY_REQUESTS);
            }

            const isMatch = await bcrypt.compare(otp, record.otp_hash);

            if (!isMatch) {
                await this.authRepo.incrementAttempts(record.id);
                throw new UnauthorizedException('Invalid OTP');
            }

            // 4️⃣ Mark OTP as verified
            await this.authRepo.markVerified(record.id);

            return {
                message: 'Email OTP verified',
            };
        }
        catch (error) {
            console.error("verifyOtp error is", error);
            throw error;
        }
    }



    async resetPassword(email: string, newPassword: string) {

        try {
            const rows = await this.authRepo.getPassword(email);


            if (!rows) {
                throw new BadRequestException('Email does not exists');
            }

         


            // 3️⃣ Hash password
            const hash = await bcrypt.hash(newPassword, 10);


            const updatePassword = await this.authRepo.updatePass(hash, email);

            if (!updatePassword || updatePassword.affectedRows === 0) {
                throw new BadRequestException("Email does not exists")
            }

            if (updatePassword.affectedRows === 1) {
                return {
                    message: "password updated succesfully",
                    status: true,
                }
            }

            return {
                message: 'Fail to reset password',
            };
        }
        catch (error) {
            console.error("reset passwrod error is", error);
            throw error;
        }
    }
}
