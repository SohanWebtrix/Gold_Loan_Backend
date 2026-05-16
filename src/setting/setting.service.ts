/* eslint-disable prettier/prettier */
import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SettingRepository } from './setting.repository/setting.repository';
import { error } from 'console';
import { DateTime } from 'luxon';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import * as Sentry from '@sentry/node';


type MulterFile = {
  originalname: string;
  buffer: Buffer;
};

@Injectable()
export class SettingService {

    constructor(

        private readonly settingrepo: SettingRepository,
    ) {

    }

    async getPrefix(company_id)
    {
      try{
        const prefixes= await this.settingrepo.getPrefixesByCompany(company_id);

        if(!prefixes)
        {
            throw new NotFoundException("prefix dosent set");
        }

        return{
            success:true,
            data:prefixes,
        }
      }
      catch(error)
      {
        Sentry.captureException(error);
        console.error("get prefix error",error);
        throw error;

      }
    }

    async getCustomerDetails(customerid:number,companyId:any)
    {

        try{

        const data=await this.settingrepo.getProfile(customerid);

        if(!data)
        {
            throw new NotFoundException("Profile not found");
        }

        return {
        message: "profile fetched succesfully",

         data
      }

    }
    catch(error)
    {
                  Sentry.captureException(error);
      
        console.error("error is",error);
        throw error;
    }

    }

      async getCompanyDetails(companyId:any)
    {

        try{

        const data=await this.settingrepo.getCompanyDetail(companyId);

        if(!data)
        {
            throw new NotFoundException("Company details not found");
        }

        return {
        message: "Comapny details fetched succesfully"
        , data
      }

    }
    catch(error)
    {
                        Sentry.captureException(error);

        console.error("error is",error);
        throw error;
    }

    }

    async CreatePrefix(dto: any, comapnyid: number) {

        const insertPrefix = await this.settingrepo.insertprefixbulk(
            dto.prefix,
            comapnyid
        );

        if (insertPrefix && insertPrefix.affectedRows === 1) {
            return {
                success: true,
                message: "prefix added successfully",
            };
        }

        else {

            return {
                success: false,
                message: "fail to add prefix",
            }
        }
    }


    async UpdatePrefix(dto: any, companyid: number, userid: number) {

      try{
        for (const item of dto) {

            if (item.id && item.id != null) {
                await this.settingrepo
                    .updatePrefix(
                        item.id,
                        item,
                    );
            }
        }

        return{
          success:true,
          message:"prefix udpated succesfully"
        }
      }
      catch(error)
      {
        console.error("error while updating prefix")
        throw error;
      }
    }

async UpdateCompany(
  dto: any,
  companyId: number,
  userId: number,
  logoFile?: MulterFile,
) {
  const uploadedFiles: string[] = [];
  const oldFilesToDelete: string[] = [];

  try {
    if (!Number.isInteger(companyId) || companyId <= 0) {
      throw new BadRequestException('Invalid company id');
    }

    if (Object.keys(dto).length === 0 && !logoFile) {
      throw new BadRequestException('Update data is required');
    }

    const existingCompany =
      await this.settingrepo.getCompanyById(companyId);

    if (!existingCompany) {
      throw new BadRequestException('Company not found');
    }

    const folderPath = `uploads/company/${companyId}`;

    await fs.promises.mkdir(folderPath, { recursive: true });

    // upload / replace / remove logo
    const logo = await this.replaceCompanyFile(
      logoFile,
      companyId,
      'company_logo',
      folderPath,
      existingCompany.company_logo,
      dto.remove_logo,
    );

    if (logo.filePath) {
      uploadedFiles.push(logo.filePath);
    }

    if (logo.oldFileToDelete) {
      oldFilesToDelete.push(logo.oldFileToDelete);
    }

    const fileUpdates: any = {};

    if (logo.dbPath !== undefined) {
      fileUpdates.company_logo = logo.dbPath;
    }

    // modified date
    let modified_date: string;

    if (dto.modified_date) {
      const raw = dto.modified_date;

      modified_date = (
        typeof raw === 'string'
          ? DateTime.fromISO(raw)
          : DateTime.fromJSDate(raw as Date)
      )
        .toUTC()
        .toFormat('yyyy-MM-dd HH:mm:ss');
    } else {
      modified_date = DateTime.utc().toFormat(
        'yyyy-MM-dd HH:mm:ss',
      );
    }

    const payload = {
      ...dto,
      ...fileUpdates,
      modified_date,
    };

    delete payload.remove_logo;

    const result = await this.settingrepo.updateComapny(
      payload,
      companyId,
      userId,
    );

    if (!result || result.affectedRows !== 1) {
      throw new Error('Failed to update company');
    }

    // delete old files after successful DB update
    await Promise.all(
      oldFilesToDelete.map(async (oldPath) => {
        const cleanPath = path.resolve(
          oldPath.replace(/^\/+/, ''),
        );

        if (fs.existsSync(cleanPath)) {
          await fs.promises.unlink(cleanPath);
        }
      }),
    );

    return {
      success: true,
      message: 'Company updated successfully',
    };
  } catch (error) {
    console.error('UpdateCompany error', error);

    // rollback uploaded files
    await Promise.all(
      uploadedFiles.map(async (filePath) => {
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
        }
      }),
    );

    throw new InternalServerErrorException(
      'Failed to update company',
    );
  }
}


private async replaceCompanyFile(
  file: MulterFile | undefined,
  companyId: number,
  prefix: string,
  folderPath: string,
  oldFilePath?: string,
  removeFile?: boolean,
): Promise<{
  dbPath?: string | null;
  filePath?: string | null;
  oldFileToDelete?: string | null;
}> {
  // remove existing logo
  if (removeFile) {
    return {
      dbPath: null,
      oldFileToDelete: oldFilePath ?? null,
    };
  }

  // no new file
  if (!file) {
    return {};
  }

  const allowedTypes = ['.jpg', '.jpeg', '.png'];

  const ext = path
    .extname(file.originalname)
    .toLowerCase();

  if (!allowedTypes.includes(ext)) {
    throw new BadRequestException(
      'Invalid logo file type',
    );
  }

  const fileName = `${prefix}_${companyId}_${uuidv4()}${ext}`;

  const filePath = path.join(folderPath, fileName);

  const dbPath = `/${folderPath}/${fileName}`;

  await fs.promises.writeFile(filePath, file.buffer);

  return {
    dbPath,
    filePath,
    oldFileToDelete: oldFilePath ?? null,
  };
}


     async updateProfile(
        staffId: number,
        dto: any,
        profileFile: MulterFile | undefined,
        userId: number,
      ): Promise<any> {
        const uploadedFiles: string[] = [];
        const oldFilesToDelete: string[] = [];
    
        try {
          
          if (!Number.isInteger(staffId) || staffId <= 0) {
            throw new BadRequestException('Invalid profile id');
          }
    
          if (Object.keys(dto).length === 0 && !profileFile) {
            throw new BadRequestException('Update data is required');
          }
    
          const existingStaff = await this.settingrepo.getProfile(staffId);
          if (!existingStaff) {
            throw new BadRequestException('user not found');
          }
    
          const folderPath = `uploads/staff/${staffId}`;
          await fs.promises.mkdir(folderPath, { recursive: true });
    
          const profile = await this.replaceStaffFile(
            profileFile,
            staffId,
            'profile',
            folderPath,
            existingStaff.profile_pic_path,
            dto.remove_profile,
          );
    
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
    
          const result = await this.settingrepo.updateStaff(staffId, payload, userId);
    
          if (!result || result.affectedRows === 0) {
            throw new Error('Failed to update profile');
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
            message: 'Profile updated successfully',
            data: result,
          };
        } catch (error) {
          console.error('update Profile error', error);
    
          await Promise.all(
            uploadedFiles.map(async (filePath) => {
              if (fs.existsSync(filePath)) {
                await fs.promises.unlink(filePath);
              }
            }),
          );
    
          throw new InternalServerErrorException('Failed to update profile');
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
          if (removeFile) {
            return { dbPath: null, oldFileToDelete: oldFilePath ?? null };
          }
      
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
      
          await fs.promises.writeFile(filePath, file.buffer);
      
          return {
            dbPath,
            filePath,
            oldFileToDelete: oldFilePath ?? null,
          };
        }

}
