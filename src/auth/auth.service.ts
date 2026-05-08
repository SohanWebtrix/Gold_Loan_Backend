/* eslint-disable prettier/prettier */


import { BadRequestException, HttpException, HttpStatus, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { AuthRepository } from './auth.repository/auth.repository';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { MailService } from 'src/mail/mail.service';
import { DatabaseService } from 'src/database/database.service';


@Injectable()
export class AuthService {

    constructor(
        private jwtService: JwtService,
        private readonly authRepo: AuthRepository,
        private readonly db: DatabaseService,
        private mailService: MailService,
    ) {

    }

    async generateTokens(user: { id: number; email: string }) {

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
            await this.db.transaction(async (conn) => {

                const companyResult: any = await this.authRepo.insertCompany(dto, userId,conn);

                console.log("comapny result is",companyResult);

                const company_id = companyResult[0].insertId;

                console.log("company id is",company_id);

                // 2️⃣ Insert into customer table with company_id
                await this.authRepo.insertCustomer(
                    dto,
                    userId,
                    company_id,
                    conn
                );

                await this.authRepo.insertprefixbulk(
                    dto.prefix,
                    company_id,
                    conn
                );
            })

      return {
                success: true,
                message: 'prefix added successfully',
      
            };

        }

        catch (error) {
            console.error("create prefix error", error);
            throw error;
        }
    }

    async UpdateCustomer(dto: any, customerIdNumber: number, userId: number) {
        try {
            const companyId = Number(dto.company_id);

            if (!companyId || !customerIdNumber) {
                throw new BadRequestException('company_id is required');
            }

            if (!customerIdNumber) {
                throw new BadRequestException('customer_id are required');
            }

            await this.db.transaction(async (conn) => {
                // Update company fields when present
                await this.authRepo.updateCompany(companyId, dto, userId, conn);

                // Update customer fields when present
                await this.authRepo.updateCustomer(customerIdNumber, dto, userId, conn);

                // Sync prefix records if prefix array is provided
                if (Array.isArray(dto.prefix)) {
                    await this.authRepo.deletePrefixes(companyId, conn);
                    await this.authRepo.insertprefixbulku(dto.prefix, companyId, conn);
                }
            });

            return {
                success: true,
                message: 'Customer updated successfully',
                companyId,
                customerIdNumber,
            };
        } catch (error) {
            console.error('UpdateCustomer error', error);
            throw error;
        }
    }

    async getCustomerDetails(customerId: number, headerCompId?: number) {
        if (!customerId || Number.isNaN(customerId)) {
            throw new BadRequestException('customer_id is required');
        }

        const customer = await this.authRepo.findCustomerWithCompany(customerId);
        if (!customer) {
            throw new BadRequestException('Customer not found');
        }

        const prefixCompanyId = headerCompId || customer.comp_id;
        const prefixes = await this.authRepo.getPrefixesByCompany(prefixCompanyId);

        return {
            customer: {
                customer_id: customer.customer_id,
                comp_id: customer.comp_id,
                first_name: customer.first_name,
                last_name: customer.last_name,
                status: customer.status,
                address_line1: customer.address_line1,
                address_line2: customer.address_line2,
                state: customer.state,
                city: customer.city,
                pincode: customer.pincode,
                cust_phone: customer.cust_phone,
                cust_email: customer.cust_email,
                user_name: customer.user_name,
            },
            company: {
                company_id: customer.company_id,
                company_name: customer.company_name,
                company_email: customer.company_email,
                company_mobile: customer.company_mobile,
            },
            prefixes,
        };
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
                comp_id: user.comp_id,
                mobile_no: user.cust_phone,
                role: user.role,
                profile_path: user.profile_pic_path
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
                mobile_no: user.admin_phone,
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
