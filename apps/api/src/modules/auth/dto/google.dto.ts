import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class GoogleAuthDto {
  @ApiProperty({ description: 'Google ID token (JWT) from the client SDK' })
  @IsString()
  @IsNotEmpty()
  idToken!: string;

  @ApiProperty({
    description: 'Optional Meta event id used to deduplicate Pixel and CAPI registration events',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  fbEventId?: string;
}
