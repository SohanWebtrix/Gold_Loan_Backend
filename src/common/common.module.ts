/* eslint-disable prettier/prettier */
import { Module } from "@nestjs/common";
import { EntityCreateService } from "./entity-create.service";

@Module({
  providers: [EntityCreateService],
  exports: [EntityCreateService],
})
export class CommonModule {}