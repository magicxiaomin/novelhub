import { ApiProperty } from '@nestjs/swagger';

export class CheckinClaimResponseDto {
  @ApiProperty()
  streakCount!: number;

  @ApiProperty()
  coinsAwarded!: number;

  @ApiProperty()
  newBalance!: number;
}
