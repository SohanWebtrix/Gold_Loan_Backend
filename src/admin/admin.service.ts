/* eslint-disable prettier/prettier */
import { BadRequestException, ConflictException, HttpException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { AdminRepository } from './admin.repository/admin.repository';
import { DateTime } from 'luxon';
import { ADMIN_FILTER_SCHEMA } from './admin.filter.schema';
import * as Sentry from '@sentry/node';
import { BANK_FILTER_SCHEMA } from './bank.filter.schema';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from 'src/database/database.service';
import { MailService } from 'src/mail/mail.service';




@Injectable()
export class AdminService {

  constructor(
    private readonly adminRepo: AdminRepository, private readonly db: DatabaseService,
    private mailService: MailService,

  ) {

  }


  async deleteAdmin(Aid: number) {

    try {

      if (!Aid) {
        throw new BadRequestException("Admin id is missing");
      }

      const result = await this.adminRepo.deleteAdmin(Aid);

      // If no rows were deleted
      if (!result || result.affectedRows === 0) {

        throw new BadRequestException("Admin not found or already deleted");

      }

      return {
        success: true,
        message: "Admin Inactivated Successfully"
      };

    }

    catch (error) {
      Sentry.captureException(error);

      console.error("delete Customer error is", error);
      throw new InternalServerErrorException("Failed to Delete Customer");

    }

  }


  async resetPassword(email: string, newPassword: string) {

    try {
      const rows = await this.adminRepo.getPassword(email);


      if (!rows) {
        throw new BadRequestException('Email does not exists');
      }


      // 3️⃣ Hash password
      const hash = await bcrypt.hash(newPassword, 10);


      const updatePassword = await this.adminRepo.updatePass(hash, email);

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
      Sentry.captureException(error);

      throw error;
    }
  }

  async forgotPassword(email: string) {
    try {

      const useremail = await this.adminRepo.findemail(email);

      if (!useremail) {
        throw new UnauthorizedException('Email not found');
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      const hash = await bcrypt.hash(otp, 10);

      const expiry = new Date(Date.now() + 5 * 60 * 1000);

      // DB transaction only
      const rows = await this.db.transaction(async (conn) => {
        return await this.adminRepo.insertOtp(
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



  async getBankList(
    page: number,
    limit: number,
    filters: any[] = [],
    comapanyid: number
  ) {

    // const customer = await this.customerRepo.findById(userId);
    // const companyId = customer.comp_id;

    try {

      if (page < 1) page = 1;
      if (limit < 1) limit = 10;

      // 🔑 MAP FILTERS HERE
      const validatedFilters = filters.map((f) => {
        const schema = BANK_FILTER_SCHEMA[f.field];

        if (!schema) {
          throw new Error(`Invalid filter field: ${f.field}`);
        }

        if (!schema.operators.includes(f.operator)) {
          throw new Error(`Invalid operator for field: ${f.field}`);
        }

        return {
          column: schema.column,
          type: schema.type,
          operator: f.operator,
          value: f.value,
          valueTo: f.valueTo
        };
      });


      const totalRecords =
        validatedFilters.length > 0
          ? await this.adminRepo.getFilteredCountbank(validatedFilters, comapanyid)
          : await this.adminRepo.getTotalCountbank(comapanyid);

      const totalPages = Math.ceil(totalRecords / limit);

      const data =
        validatedFilters.length > 0
          ? await this.adminRepo.findWithFiltersbank(validatedFilters, page, limit, comapanyid)
          : await this.adminRepo.findAllbank(page, limit, comapanyid);

      const start = totalRecords === 0 ? 0 : (page - 1) * limit + 1;
      const end = Math.min(page * limit, totalRecords);

      return {
        currentPage: page,
        limit,
        start,
        end,
        totalRecords,
        totalPages,
        nextPage: page < totalPages ? page + 1 : null,
        previousPage: page > 1 ? page - 1 : null,
        data,
      };
    }
    catch (error) {

      Sentry.captureException(error);

      console.error("getbanklist error", error)
      throw new InternalServerErrorException("Failed to fetch Client list");

    }
  }


  async searchComapany(search: string, page: number,
    limit: number, userid: number) {
    try {


      const totalRecords = await this.adminRepo.getFilteredCountSearch(search, userid)


      const totalPages = Math.ceil(totalRecords / limit);

      const data = await this.adminRepo.getSearchCompany(page, limit, search, userid);


      const start = totalRecords === 0 ? 0 : (page - 1) * limit + 1;
      const end = Math.min(page * limit, totalRecords);


    


      if (!data || data.length === 0) {
        return {
          message: "no banks found",
          data: [],
        }
      }

      return {
        success: true,
        message: "bank fetched succesfully",
        currentPage: page,
        limit,
        start,
        end: end,
        totalRecords: totalRecords,
        totalPages: totalPages,
        nextPage: page < totalPages ? page + 1 : null,
        previousPage: page > 1 ? page - 1 : null,
        data
      }
    } catch (error) {

      Sentry.captureException(error);

      console.error("Search loans error", error)

      throw new InternalServerErrorException("Failed to get updated data",);
    }
  }


  async CreateBank(dto: any, userid: number, companyId: number) {

    try {

      if (!companyId) {
        throw new Error("comapny id is required");
      }

      dto.remaining_balance =
        Number(dto.opening_balance || 0);

      const result: any = await this.adminRepo.insertBank(dto, companyId, userid);

      // 3️⃣ Check success
      if (result && result.affectedRows === 1) {
        return {
          success: true,
          message: 'bank added successfully',
          userId: result.insertId,
        };
      }

      throw new InternalServerErrorException("Failed to add bank");
    }
    catch (error) {
      Sentry.captureException(error);

      console.error("Create Bank error", error)
      throw error;
    }
  }


  async getAdminById(aid: number) {

    try {

      if (!aid) {
        throw new BadRequestException("client id is missing");
      }

      const data = await this.adminRepo.getAdminByid(aid);

      return {
        success: true,
        message: "admin fetched succesfully"
        , data
      }
    }
    catch (error) {
      Sentry.captureException(error);

      console.error("fail to fetch client", error)
    }

  }


  async getBankById(bid: number) {

    try {

      if (!bid) {
        throw new BadRequestException("bank id is missing");
      }

      const data = await this.adminRepo.getBankByid(bid);

      return {
        message: "bank fetched succesfully"
        , data
      }
    }
    catch (error) {

            Sentry.captureException(error);

      console.error("fail to fetch bank", error)

    }

  }

  async CreateAdmin(dto: any, userid: number) {

    try {
      const result: any = await this.adminRepo.insertAdmin(dto, userid);

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

      if (error.code === "ER_DUP_ENTRY") {

        const msg = error.sqlMessage;

        if (msg.includes("unique_admin_email")) {
          throw new ConflictException("Email ID already exists");
        }

        if (msg.includes("unique_user_name")) {
          throw new ConflictException("Username already exists");
        }


        throw new ConflictException("Duplicate value detected");
      }

      throw error;

    }
  }

  async updateAdmin(dto: any, adminid: number, userid: number) {

    try {
      if (!adminid) {
        throw new BadRequestException("admin id is not present");
      }

      let modified_date: string;

      if (dto.modified_date) {
        const raw = dto.modified_date;
        modified_date = (typeof raw === 'string'
          ? DateTime.fromISO(raw)
          : DateTime.fromJSDate(raw as Date)
        )
          .toUTC()
          .toFormat("yyyy-MM-dd HH:mm:ss");
      } else {
        modified_date = DateTime.utc().toFormat("yyyy-MM-dd HH:mm:ss");
      }


      const result = await this.adminRepo.updateAdmin(adminid, { ...dto, modified_date }, userid)

      if (!result || result.affectedRows === 0) {
        return {
          success: false,
          message: "fail to update system user"
        }
      }

      return {
        success: true,
        message: "Successfully updated the admin"
      }

    }


    catch (error) {
            Sentry.captureException(error);

      console.error("error inside update admin", error);
    }

  }

  async getAdminList(
    page: number,
    limit: number,
    filters: any[] = [],
  ) {
    try {

      if (page < 1) page = 1;
      if (limit < 1) limit = 10;

      // 🔑 MAP FILTERS HERE
      const validatedFilters = filters.map((f) => {
        const schema = ADMIN_FILTER_SCHEMA[f.field];

        if (!schema) {
          throw new Error(`Invalid filter field: ${f.field}`);
        }

        if (!schema.operators.includes(f.operator)) {
          throw new Error(`Invalid operator for field: ${f.field}`);
        }

        return {
          column: schema.column,
          type: schema.type,
          operator: f.operator,
          value: f.value,
          valueTo: f.valueTo
        };
      });

      const totalRecords =
        validatedFilters.length > 0
          ? await this.adminRepo.getFilteredCount(validatedFilters)
          : await this.adminRepo.getTotalCount();

      const totalPages = Math.ceil(totalRecords / limit);

      const data =
        validatedFilters.length > 0
          ? await this.adminRepo.findWithFilters(validatedFilters, page, limit)
          : await this.adminRepo.findAll(page, limit);

      const start = totalRecords === 0 ? 0 : (page - 1) * limit + 1;
      const end = Math.min(page * limit, totalRecords);

      return {
        success: true,
        currentPage: page,
        limit,
        start,
        end,
        totalRecords,
        totalPages,
        nextPage: page < totalPages ? page + 1 : null,
        previousPage: page > 1 ? page - 1 : null,
        data,
      };
    }
    catch (error) {

            Sentry.captureException(error);

      console.error("getAdminList error", error)
      throw new InternalServerErrorException("Failed to fetch Admin list");
    }
  }
}