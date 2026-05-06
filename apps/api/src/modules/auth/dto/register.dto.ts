import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'luna@example.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ minLength: 8, example: 'a-strong-passphrase' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
