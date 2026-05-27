/* eslint-disable prettier/prettier */
import { BadRequestException, ConflictException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { CustomersRepository } from './customers.repository/customers.repository';
import { CUSTOMER_FILTER_SCHEMA } from './customer.fitler.schema';
import { CreateStaffDto } from './create-staff.dto';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import * as Sentry from '@sentry/node';


type MulterFile = {
  originalname: string;
  buffer: Buffer;
};

@Injectable()
export class CustomersService {

  constructor(private readonly customerRepo: CustomersRepository) {

  }



  async deleteCustomer(Cid: number) {
    try {

      if (!Cid) {
        throw new BadRequestException("Customer id is missing");
      }

      const result = await this.customerRepo.deleteCustomer(Cid);

      // If no rows were deleted
      if (!result || result.affectedRows === 0) {

        throw new BadRequestException("Customer not found or already deleted");

      }

      return { message: "Customer deleted successfully" };
    }
    catch (error) {
      Sentry.captureException(error);

      console.error("delete Customer error is", error);
      throw new InternalServerErrorException("Failed to Delete Customer");

    }
  }


  async getCountbyid(customerid: number) {
    try {

      const data = await this.customerRepo.getCountforCustomer(customerid);

      if (!data) {
        throw new Error("failed to fetch count ")
      }
      return {
        message: "count fetched succesfully",
        data,
      }
    }
    catch (error) {
      Sentry.captureException(error);

    }
  }

  async getClinetById(userId: number) {

    try {

      if (!userId) {
        throw new BadRequestException("customer id is missing");
      }

      const data = await this.customerRepo.getCompanyByid(userId);

      return {
        message: "data fetched succesfully"
        , data
      }
    }
    catch (error) {
      Sentry.captureException(error);

      console.error("get user by id error is", error)
    }
  }


  async getCustById(custid: number) {

    try {

      if (!custid) {
        throw new BadRequestException("customer id is missing");
      }

      const data = await this.customerRepo.getCustoemrdetails(custid);

      return {
        message: "customer fetched succesfully"
        , data
      }
    }
    catch (error) {
      Sentry.captureException(error);

      console.error("get customer by id error is", error)
    }
  }

  async getCustomerList(
    page: number,
    limit: number,
    filters: any[] = [],
    userid: number
  ) {

    // const customer = await this.customerRepo.findById(userId);
    // const companyId = customer.comp_id;

    try {

      if (page < 1) page = 1;
      if (limit < 1) limit = 10;

      // 🔑 MAP FILTERS HERE
      const validatedFilters = filters.map((f) => {
        const schema = CUSTOMER_FILTER_SCHEMA[f.field];

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
          ? await this.customerRepo.getFilteredCount(validatedFilters, userid)
          : await this.customerRepo.getTotalCount(userid);

      const totalPages = Math.ceil(totalRecords / limit);

      const data =
        validatedFilters.length > 0
          ? await this.customerRepo.findWithFilters(validatedFilters, page, limit, userid)
          : await this.customerRepo.findAll(page, limit, userid);

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

      console.error("getBeneficiarylist error", error)
      throw new InternalServerErrorException("Failed to fetch Client list");

    }
  }



  async getCustomerListByid(
    page: number,
    limit: number,
    filters: any[] = [],
    companyid: number
  ) {

    // const customer = await this.customerRepo.findById(userId);
    // const companyId = customer.comp_id;

    try {

      if (page < 1) page = 1;
      if (limit < 1) limit = 10;

      // 🔑 MAP FILTERS HERE
      const validatedFilters = filters.map((f) => {
        const schema = CUSTOMER_FILTER_SCHEMA[f.field];

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
          ? await this.customerRepo.getFilteredCountCustid(validatedFilters, companyid)
          : await this.customerRepo.getTotalCountByid(companyid);

      const totalPages = Math.ceil(totalRecords / limit);

      const data =
        validatedFilters.length > 0
          ? await this.customerRepo.findWithFiltersCustId(validatedFilters, page, limit, companyid)
          : await this.customerRepo.findAllCustid(page, limit, companyid);

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

      console.error("getBeneficiarylist error", error)
      throw new InternalServerErrorException("Failed to fetch Client list");

    }
  }



  async createStaff(
    dto: any,
    profileFile: MulterFile | undefined,
    companyId: number,
    userId: number,
  ): Promise<any> {
    let folderPath: string | null = null;
    let staffId: number | null = null;

    try {
      if (!companyId) {
        throw new BadRequestException('comp-id header is required');
      }

      if (!dto.first_name && !dto.last_name && !dto.cust_name) {
        throw new BadRequestException('Staff name is required');
      }

      const logincust=await this.customerRepo.getEndDate(userId);

      if (!logincust?.length) {
  throw new BadRequestException('Customer not found');
}


      dto.subscription_end_date=logincust?.[0].subscription_end_date;

      console.log("dto subscription date is",dto.subscription_end_date)

      const result = await this.customerRepo.insertStaff(dto, userId, companyId);
      console.log('result is ', result);
      staffId = result.insertId;

      if (!staffId) {
        throw new Error('Failed to create staff sohan');
      }

      if (profileFile) {
        folderPath = `uploads/staff/${staffId}`;
        await fs.promises.mkdir(folderPath, { recursive: true });

        const { dbPath } = await this.saveStaffFile(profileFile, staffId, 'profile', folderPath);

        if (dbPath) {
          const updateResult = await this.customerRepo.updateFilesPath(staffId, { profile_pic_path: dbPath });

          if (!updateResult || updateResult.affectedRows !== 1) {
            throw new Error('Staff file update failed');
          }
        }
      }

      return {
        message: 'Staff created successfully',
        staff_id: staffId,
      };
    } catch (error) {
      Sentry.captureException(error);

      console.error('createStaff error', error);

      if (folderPath && fs.existsSync(folderPath)) {
        await fs.promises.rm(folderPath, { recursive: true, force: true });
      }

      if (error.code === "ER_DUP_ENTRY") {

        const msg = error.sqlMessage;

        if (msg.includes("cust_email")) {
          throw new ConflictException("Email ID already exists");
        }


        throw new ConflictException("Duplicate value detected");
      }


      if (staffId) {
        try {
          await this.customerRepo.deleteStaff(staffId);
        } catch (cleanupError) {
          console.error('Failed to cleanup staff:', cleanupError);
        }
      }

      throw error;
    }
  }

  private async saveStaffFile(
    file: MulterFile | undefined,
    staffId: number,
    prefix: string,
    folderPath: string,
  ): Promise<{ dbPath: string | null; filePath: string | null }> {
    if (!file) {
      return { dbPath: null, filePath: null };
    }

    const allowedTypes = ['.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (!allowedTypes.includes(ext)) {
      throw new BadRequestException('Invalid file type');
    }

    const fileName = `${prefix}_${staffId}_${uuidv4()}${ext}`;
    const filePath = path.join(folderPath, fileName);
    const dbPath = `/${folderPath}/${fileName}`;

    await fs.promises.writeFile(filePath, file.buffer);

    return { dbPath, filePath };
  }

  async updateStaff(
    staffId: number,
    dto: any,
    profileFile: MulterFile | undefined,
    userId: number,
  ): Promise<any> {
    const uploadedFiles: string[] = [];
    const oldFilesToDelete: string[] = [];

    try {
      if (!Number.isInteger(staffId) || staffId <= 0) {
        throw new BadRequestException('Invalid staff id');
      }

      if (Object.keys(dto).length === 0 && !profileFile) {
        throw new BadRequestException('Update data is required');
      }

      const existingStaff = await this.customerRepo.getStaffById(staffId);
      if (!existingStaff) {
        throw new BadRequestException('Staff not found');
      }

      console.log("existing staff is",existingStaff);

      const folderPath = `uploads/staff/${staffId}`;
      await fs.promises.mkdir(folderPath, { recursive: true });

          console.log("dto in update staff is",dto)


      const profile = await this.replaceStaffFile(
        profileFile,
        staffId,
        'profile',
        folderPath,
        existingStaff.profile_pic_path,
          dto.remove_profile === 'true',
      );

      console.log("profile inside customer service is",profile);

      if (profile.filePath) {

        uploadedFiles.push(profile.filePath);

      }
      if (profile.oldFileToDelete) {
        oldFilesToDelete.push(profile.oldFileToDelete);
      }

      const fileUpdates: any = {};
      if (profile.dbPath !== undefined) {
        fileUpdates.profile_pic_path = profile.dbPath;
      }

      const payload = { ...dto, ...fileUpdates };

      delete payload.remove_profile;

payload.cust_email = payload.cust_email?.trim() || null;
payload.user_name = payload.user_name?.trim() || null;

console.log("user name is",payload.user_name);

      const result = await this.customerRepo.updateStaff(staffId, payload, userId);

      if (!result || result.affectedRows === 0) {
        throw new Error('Failed to update staff');
      }

      await Promise.all(
        oldFilesToDelete.map(async (oldPath) => {
          const cleanPath = path.resolve(oldPath.replace(/^\/+/, ''));
          if (fs.existsSync(cleanPath)) {
            await fs.promises.unlink(cleanPath);
          }
        }),
      );

      return {
        message: 'Staff updated successfully',
        data: result,
      };
    } catch (error) {

      Sentry.captureException(error);

      console.error('updateStaff error', error);

      await Promise.all(
        uploadedFiles.map(async (filePath) => {
          if (fs.existsSync(filePath)) {
            await fs.promises.unlink(filePath);
          }
        }),
      );

      throw new InternalServerErrorException('Failed to update staff');
    }
  }

  private async replaceStaffFile(
    file: MulterFile | undefined,
    staffId: number,
    prefix: string,
    folderPath: string,
    oldFilePath?: string,
    removeFile?: boolean,
  ): Promise<{ dbPath?: string | null; filePath?: string | null; oldFileToDelete?: string | null }> {

    console.log("rmeove file in replace staff file is",removeFile);

    if (removeFile) {
      console.log("inside remove file in replaceStaffFile");

      return { dbPath: null, oldFileToDelete: oldFilePath ?? null };
    }

    console.log("folder path inside replace staff file is",folderPath);

    if (!file) {
      return {};
    }

    const allowedTypes = ['.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (!allowedTypes.includes(ext)) {
      throw new BadRequestException('Invalid file type');
    }

    const fileName = `${prefix}_${staffId}_${uuidv4()}${ext}`;
    const filePath = path.join(folderPath, fileName);
    const dbPath = `/${folderPath}/${fileName}`;

    console.log("dbPath is in replaceStaff is",dbPath);
    console.log("file path is",filePath);

    await fs.promises.writeFile(filePath, file.buffer);

    return {
      dbPath,
      filePath,
      oldFileToDelete: oldFilePath ?? null,
    };
  }
}