import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class DeleteAccountDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  password?: string;
}
