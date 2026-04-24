/* eslint-disable prettier/prettier */

import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ClientRepository } from './client.repository/client.repository';
import { UpdateClientDto } from './client.updatedto';
import { CreateClientDto } from './client.createdto';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { DateTime } from 'luxon';
import { error } from 'console';
import { randomBytes } from "crypto";
import { CLIENT_FILTER_SCHEMA } from './client.filter.schema';
import { CustomersRepository } from 'src/customers/customers.repository/customers.repository';


@Injectable()
export class ClientService {

  constructor(private readonly clientRepo: ClientRepository, private readonly customerRepo: CustomersRepository
  ) {

  }

  async searchClient(search: string, page: number,
    limit: number, userid: number) {
    try {


      const totalRecords = await this.clientRepo.getFilteredCountSearch(search, userid)

      console.log("total Records are", totalRecords)

      const totalPages = Math.ceil(totalRecords / limit);

      const data = await this.clientRepo.getSearchClient(page, limit, search, userid);


      const start = totalRecords === 0 ? 0 : (page - 1) * limit + 1;
      const end = Math.min(page * limit, totalRecords);


      console.log("total pages are ", totalPages)
      console.log("end is", end)


      if (!data || data.length === 0) {
        return {
          message: "no Client found",
          data: [],
        }
      }

      return {
        success: true,
        message: "Client fetched succesfully",
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
      console.error("Search Client error", error)
      throw new InternalServerErrorException("Failed to get updated data",);
    }
  }


  private generateClientCode(): string {
    const year = new Date().getFullYear();
    const randomPart = randomBytes(3).toString("hex").toUpperCase(); // 6 chars

    return `CUS-${year}-${randomPart}`;
  }


  async getClinetById(userId: number) {

    try {

      if (!userId) {
        throw new BadRequestException("client id is missing");
      }

      const data = await this.clientRepo.getUsersByid(userId);

      return {
        message: "client fetched succesfully"
        , data
      }
    }
    catch (error) {
      console.error("fail to fetch client", error)
    }
  }

  async getClinetLonsById(userId: number) {

    try {

      if (!userId) {
        throw new BadRequestException("client id is missing");
      }

      const data = await this.clientRepo.getUsersByidLoans(userId);

      return {
        message: "client loan fetched succesfully"
        , data
      }
    }
    catch (error) {
      console.error("get client for loan by id error is", error)
    }
  }

  async getAllClient(userid: number) {

    try {

      const data = await this.clientRepo.getallclients(userid);

      return {
        message: "all clients fetched succesfully"
        , data
      }
    }
    catch (error) {
      console.error("failed to fetch all clients", error)
    }
  }

  async getAllCities() {
    try {
      const data = await this.clientRepo.getallcities();
      return {
        message: "cities fetched succesfully",
        data,
      };
    } catch (error) {
      console.error("get cities error is", error);
    }
  }

  async searchCities(search?: string, stateId?:number) {
    try {

      const data = await this.clientRepo.searchCities(search,stateId);

      return {
        success: true,
        message: "cities fetched succesfully",
        data,
      };
    } catch (error) {
      console.error("search cities error is", error);
    }
  }

  async getCityById(stateId: number) {
    try {
      if (!stateId) {
        throw new BadRequestException("state id is missing");
      }

      const data = await this.clientRepo.getCityById(stateId);
      return {
        success: true,
        message: "Cities fetched succesfully",
        data,
      };
    } catch (error) {
      console.error("failed to get cities", error);
    }
  }

  async getAllStates() {
    try {
      const data = await this.clientRepo.getallstates();
      return {
        message: "states fetched succesfully",
        data,
      };
    } catch (error) {
      console.error("failed to fetch states", error);
    }
  }

  async searchStates(search?: string) {
    try {
      const data = await this.clientRepo.searchStates(search);
      return {
        success: true,
        message: "states fetched succesfully",
        data,
      };
    } catch (error) {
      console.error("search states error is", error);
    }
  }

  async updateUsers(customerId: number, dto: UpdateClientDto, userId: number) {

    console.log("dto in service is", dto);
    try {
      const result = await this.clientRepo.UpdateById(customerId, dto, userId);


      if (result && result.affectedRows === 1) {
        console.log("inside result block of if")
        return {
          success: true,
          message: 'Client Updated successfully',
        };
      }

      throw new InternalServerErrorException("Failed to update user");
    }
    catch (error) {
      console.error("CreateUser error", error)

      throw new InternalServerErrorException(
        'Failed to update user',
      )
    }
  }

  private async saveClientFile(
    file: Express.Multer.File | undefined,
    cid: number,
    prefix: string,
    folderPath: string
  ): Promise<{ dbPath: string | null; filePath: string | null }> {

    if (!file) {
      return { dbPath: null, filePath: null };
    }

    let allowedTypes = [".jpg", ".jpeg", ".png", ".pdf"];

    if (prefix === "photo") {
      allowedTypes = [".jpg", ".jpeg", ".png"];
    }
    const ext = path.extname(file.originalname).toLowerCase();

    if (!allowedTypes.includes(ext)) {
      throw new BadRequestException("Invalid file type");
    }


    const fileName = `${prefix}_${cid}_${uuidv4()}${path.extname(file.originalname)}`;
    const filePath = path.join(folderPath, fileName);
    const dbPath = `/${folderPath}/${fileName}`;

    await fs.promises.writeFile(filePath, file.buffer);

    return { dbPath, filePath };
  }


  private async replaceClientFile(
    file: Express.Multer.File | undefined,
    cid: number,
    prefix: string,
    folderPath: string,
    oldFilePath?: string,
    removeFile?: boolean
  ): Promise<{ dbPath?: string | null; filePath?: string | null; oldFileToDelete?: string | null }> {
    //                                                            ↑ return old path instead of deleting immediately

    // CASE 1: user removed image
    if (removeFile) {
      return {
        dbPath: null,
        filePath: null,
        oldFileToDelete: oldFilePath ?? null  // ✅ just return it, don't delete yet
      };
    }

    // CASE 2: new upload
    if (file) {
      const fileName = `${prefix}_${cid}_${uuidv4()}${path.extname(file.originalname)}`;
      const filePath = path.join(folderPath, fileName);
      const dbPath = `/${folderPath}/${fileName}`;

      await fs.promises.writeFile(filePath, file.buffer);  // write new file

      return {
        dbPath,
        filePath,
        oldFileToDelete: oldFilePath ?? null  // ✅ return old path, delete after DB succeeds
      };
    }

    // CASE 3: untouched
    return {};
  }

  async createClient(
    dto: CreateClientDto,
    adharFile: Express.Multer.File | undefined,
    panFile: Express.Multer.File | undefined,
    photoFile: Express.Multer.File | undefined,
    userId: number,
    companyIdNum: number,
  ) {
    let folderPath: string | null = null;
    let cid: number | null = null;

    try {

      // ✅ STEP 1: Insert client FIRST (without file paths)
      dto.client_code = this.generateClientCode();
      dto.compc_id = companyIdNum;

      const result = await this.clientRepo.insertClient(
        dto
        , userId);

      if (!result || result.affectedRows !== 1) {
        throw new Error("Client insert failed");
      }

      // ✅ STEP 2: Get client ID
      cid = result.insertId;

      if (!cid) {
        throw new Error("faild to get client id");
      }

      // ✅ STEP 3: Create folder using cid
      folderPath = `uploads/client/${cid}`;
      await fs.promises.mkdir(folderPath, { recursive: true });

      // ✅ STEP 4: Save files
      const [adhar, pan, photo] = await Promise.all([
        this.saveClientFile(adharFile, cid, "adhar", folderPath),
        this.saveClientFile(panFile, cid, "pan", folderPath),
        this.saveClientFile(photoFile, cid, "photo", folderPath),
      ]);

      // ✅ STEP 5: Update DB with file paths
      const updateResult = await this.clientRepo.updateFilesPath(cid, {
        aadhaar_id_path: adhar.dbPath,
        pan_card_path: pan.dbPath,
        profile_pic_path: photo.dbPath,
      });

      if (!updateResult || updateResult.affectedRows !== 1) {
        throw new Error("Client file update failed");
      }

      return {
        success: true,
        message: "Client created successfully",
        client_id: cid,
      };

    } catch (error) {

      // ❌ Cleanup files
      if (folderPath && fs.existsSync(folderPath)) {
        await fs.promises.rm(folderPath, { recursive: true, force: true });
      }

      // ❌ Cleanup DB (VERY IMPORTANT)
      if (cid) {
        try {
          console.log("inside catch block if fails to update files")
          const result = await this.clientRepo.deleteClient(cid);

          if (result?.affectedRows !== 1) {
            throw new Error("Fail to delete customer");
          }
        } catch (deleteError) {
          console.error("Failed to cleanup client:", deleteError);
        }
      }

      throw error;
    }
  }

  async updateClient(dto: UpdateClientDto,
    adharFile: Express.Multer.File | undefined,
    panFile: Express.Multer.File | undefined,
    photoFile: Express.Multer.File | undefined,
    cid: number,
    userId: number) {


    const uploadedFiles: string[] = [];
    const oldFilesToDelete: string[] = [];

    try {

      const exitingClient = await this.clientRepo.getClinetById(cid);

      if (!exitingClient) {
        throw new BadRequestException("Client not found");
      }

      const folderPath = `uploads/client/${cid}`
      await fs.promises.mkdir(folderPath, { recursive: true });

      const [adhar, pan, photo] = await Promise.all([
        this.replaceClientFile(adharFile, cid, "adhar", folderPath, exitingClient.photo_path_adhar, dto.remove_adhar),
        this.replaceClientFile(panFile, cid, "pan", folderPath, exitingClient.photo_path_pan, dto.remove_pan),
        this.replaceClientFile(photoFile, cid, "photo", folderPath, exitingClient.photo_path_client, dto.remove_photo),
      ]);

      // track new uploaded files for rollback if DB fails
      [adhar.filePath, pan.filePath, photo.filePath]
        .forEach(p => { if (p) uploadedFiles.push(p); });

      // track old files to delete after DB succeeds
      [adhar.oldFileToDelete, pan.oldFileToDelete, photo.oldFileToDelete]
        .forEach(p => { if (p) oldFilesToDelete.push(p); });

      const fileUpdates: any = {};

      if (adhar.dbPath !== undefined) {
        fileUpdates.aadhaar_id_path = adhar.dbPath;
      }

      if (pan.dbPath !== undefined) {
        fileUpdates.pan_card_path = pan.dbPath;
      }

      if (photo.dbPath !== undefined) {
        fileUpdates.profile_pic_path = photo.dbPath;
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



      const result = await this.clientRepo.updateClient(cid, { ...dto, modified_date }, fileUpdates, userId
      );


      if (!result || result.affectedRows === 0) {
        throw new error("fail to update client")
      }
      // ✅ STEP 5: DB succeeded — NOW safe to delete old files
      await Promise.all(
        oldFilesToDelete.map(async (oldPath) => {
          const cleanPath = path.resolve(oldPath.replace(/^\/+/, ''));  //“Take DB path → remove leading slash → convert to safe absolute path”
          if (fs.existsSync(cleanPath)) {
            await fs.promises.unlink(cleanPath);
          }
        })
      );


      return {
        success: true,
        message: "Client Updated successfully",
      };

    } catch (error) {
      console.error("updateClient error", error);

      // ✅ DB failed — delete newly uploaded files only
      await Promise.all(
        uploadedFiles.map(async (filePath) => {
          if (fs.existsSync(filePath)) {
            await fs.promises.unlink(filePath);
          }
        })
      );
      // old files are untouched ✅ — never deleted since DB didn't succeed

      throw error;
    }
  }


  async getClientList(
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
        const schema = CLIENT_FILTER_SCHEMA[f.field];

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
          ? await this.clientRepo.getFilteredCount(validatedFilters, userid)
          : await this.clientRepo.getTotalCount(userid);

      const totalPages = Math.ceil(totalRecords / limit);

      const data =
        validatedFilters.length > 0
          ? await this.clientRepo.findWithFilters(validatedFilters, page, limit, userid)
          : await this.clientRepo.findAll(page, limit, userid);

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

      console.error("getBeneficiarylist error", error)
      throw new InternalServerErrorException("Failed to fetch Client list");

    }
  }


  async deleteClient(Cid: number) {
    try {
      if (!Cid) {
        throw new BadRequestException("Client id is missing");
      }

      const result = await this.clientRepo.deletClientId(Cid);

      // If no rows were deleted
      if (!result || result.affectedRows === 0) {
        throw new BadRequestException("Client not found or already deleted");
      }

      return { message: "Client deleted successfully" };
    }
    catch (error) {

      console.error("delete Client error is", error);
      throw new InternalServerErrorException("Failed to Delete Client");

    }
  }

  async searchClientloan(search: string, comapanyid: number) {

    try {

      const data = await this.clientRepo.getSearchClients(search, comapanyid);



      if (!data || data.length === 0) {
        return {
          message: "no Client found",
          data: [],
        }
      }

      return {
        success: true,
        message: "Client fetched succesfully",
        data
      }
    } catch (error) {
      console.error("Search Client error", error)

      throw new InternalServerErrorException("Failed to get updated data",);
    }
  }
}
