/* eslint-disable prettier/prettier */
import { BadRequestException, Injectable } from "@nestjs/common";
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class EntityCreateService {
  async createWithFiles({
    createRecord,
    deleteRecord,
    updatePaths,
    files,
    folderBase,
    idField = "insertId",
  }) {
    let folderPath: string | null = null;
    let entityId: number | null = null;


    try {
      // Step 1 Create DB record
      const result = await createRecord();

      entityId = result[idField];

      if (!entityId) {
        throw new Error("ID not generated");
      }

      // Step 2 Create folder
      folderPath = `uploads/${folderBase}/${entityId}`;

      await fs.promises.mkdir(folderPath, { recursive: true });

      // Step 3 Save all files
      const savedFiles = {};


      const uploadResults = await Promise.all(
        files.map(fileConfig =>
          this.saveFile(
            fileConfig.file,
            entityId,
            fileConfig.prefix,
            folderPath
          )
        )
      );

      uploadResults.forEach((res, index) => {
        savedFiles[files[index].dbField] = res.dbPath;
      });

      // Step 4 Update DB paths
      await updatePaths(entityId, savedFiles);

      return {
        success: true,
        message: "loan created succesfully",
        id: entityId,
      };

    } catch (error) {

      // Remove folder
      if (folderPath && fs.existsSync(folderPath)) {
        await fs.promises.rm(folderPath, {
          recursive: true,
          force: true,
        });
      }

      // Delete DB row
      if (entityId) {
        await deleteRecord(entityId);
      }

      throw error;
    }
  }

  async saveFile(file, id, prefix, folderPath) {
    if (!file) return { dbPath: null };

    const ext = path.extname(file.originalname).toLowerCase();

    const allowed = [".jpg", ".jpeg", ".png"];

    if (!allowed.includes(ext)) {
      throw new BadRequestException("Invalid file type");
    }

    const fileName =
      `${prefix}_${id}_${uuidv4()}${ext}`;

    const filePath = path.join(folderPath, fileName);

    await fs.promises.writeFile(filePath, file.buffer);

    return {
      dbPath: `/${folderPath}/${fileName}`,
    };
  }
}