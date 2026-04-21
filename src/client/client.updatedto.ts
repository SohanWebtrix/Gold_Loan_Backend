/* eslint-disable prettier/prettier */
import { PartialType } from '@nestjs/mapped-types';
import { CreateClientDto } from './client.createdto';

export class UpdateClientDto extends PartialType(
  CreateClientDto,
) {}