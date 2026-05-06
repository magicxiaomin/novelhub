import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleAuthDto {
  @ApiProperty({ description: 'Google ID token (JWT) from the client SDK' })
  @IsString()
  @IsNotEmpty()
  idToken!: string;
}
