/* eslint-disable prettier/prettier */


import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { AuthRepository } from './auth.repository/auth.repository';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { MailService } from 'src/mail/mail.service';
import { DatabaseService } from 'src/database/database.service';
import * as Sentry from '@sentry/node';


@Injectable()
export class AuthService {

    constructor(
        private jwtService: JwtService,
        private readonly authRepo: AuthRepository,
        private readonly db: DatabaseService,
        private mailService: MailService,
    ) {

    }


    async logout(token: string) {

        const decoded: any = this.jwtService.decode(token);

        await this.authRepo.blacklistToken({
            token,
            expires_at: new Date(decoded.exp * 1000)
        });

        return { message: "Logged out successfully" };

    }


    async generateTokens(user: { id: number; email: string }) {

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


            // 1️⃣ Insert into company table
            await this.db.transaction(async (conn) => {

                const companyResult: any = await this.authRepo.insertCompany(dto, userId, conn);


                const company_id = companyResult[0].insertId;

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
                message: 'customer added successfully',

            };

        }

        catch (error) {
            console.error("create prefix error", error);

            Sentry.captureException(error);


            if (error.code === "ER_DUP_ENTRY") {

                const msg = error.sqlMessage;

                if (msg.includes("cust_email")) {

                    throw new ConflictException("Email ID already exists");

                }


                if (msg.includes("unique_user_name")) {

                    throw new ConflictException("username already exists");

                }

                throw new ConflictException("Duplicate value detected");
            }


            throw error;
        }
    }

    async UpdateCustomer(dto: any, customerIdNumber: number, userId: number) {

        try {
            const companyId = Number(dto.company_id);


            if (!companyId) {
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

            Sentry.captureException(error);


            if (error.code === "ER_DUP_ENTRY") {

                const msg = error.sqlMessage;

                if (msg.includes("cust_email")) {

                    throw new ConflictException("Email ID already exists");

                }


                if (msg.includes("unique_user_name")) {

                    throw new ConflictException("username already exists");

                }

                throw new ConflictException("Duplicate value detected");
            }

            throw error;



        }
    }


    async getCustomerDetails(customerId: number, headerCompId?: number) {

        try {

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
                    state_name: customer.state_name,
                    state: customer.state,
                    city: customer.city,
                    pincode: customer.pincode,
                    cust_phone: customer.cust_phone,
                    cust_email: customer.cust_email,
                    user_name: customer.user_name,
                    landmark: customer.landmark
                },

                company: {
                    company_id: customer.company_id,
                    company_name: customer.company_name,
                    company_email: customer.company_email,
                    company_mobile: customer.company_mobile,
                    comp_address_line1: customer.address,
                    interest: customer.default_interest,
                },
                prefixes,
            };
        }
        catch (error) {

            Sentry.captureException(error);

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
            Sentry.captureException(error);
            

            console.error("CreateAdmin error", error)
            throw error;
        }
    }

    async loginWithEmail(login_id: string, password: string) {
        try {

            const rows = await this.authRepo.loginemail(login_id);

            if (!rows) {
                throw new UnauthorizedException('Invalid username or mobile number');
            }

            const user = rows;

            const company = await this.authRepo.getCompanyname(user.comp_id);

            if (!company) {
                throw new Error("comapny not found")
            }
            const comapny_name = company.company_name;
            const subscription_end_date = company.subscription_end_date;



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
                    name: user.full_name,
                    comp_id: user.comp_id,
                    mobile_no: user.cust_phone,
                    role: user.role,
                    profile_path: user.profile_pic_path,
                    subscription_end_date: subscription_end_date
                        ? new Date(subscription_end_date).toISOString().split('T')[0]
                        : null,
                    comapny_name,
                },
            };
        }
        catch (error) {
            Sentry.captureException(error);
            throw error;

        }
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

            if (!useremail) {
                throw new UnauthorizedException('Email not found');
            }

            const otp = Math.floor(100000 + Math.random() * 900000).toString();

            const hash = await bcrypt.hash(otp, 10);

            const expiry = new Date(Date.now() + 5 * 60 * 1000);

            // DB transaction only
            const rows = await this.db.transaction(async (conn) => {
                return await this.authRepo.insertOtp(
                    conn,
                    email,
                    hash,
                    expiry,
                );
            });


            if (!rows || rows.affectedRows !== 1) {
                throw new InternalServerErrorException(
                    'Failed to save OTP',
                );
            }

            // Send mail AFTER commit
            await this.mailService.sendOTP(email, otp);

            return {
                success: true,
                message: 'OTP sent successfully',
            };

        } catch (error) {
            Sentry.captureException(error);

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
            Sentry.captureException(error);

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
            Sentry.captureException(error);

            console.error("reset passwrod error is", error);
            throw error;
        }
    }
}
