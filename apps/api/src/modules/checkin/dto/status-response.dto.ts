import { ApiProperty } from '@nestjs/swagger';

export class CheckinStatusResponseDto {
  @ApiProperty({ example: '2026-05-06' })
  today!: string;

  @ApiProperty()
  claimedToday!: boolean;

  @ApiProperty()
  streakCount!: number;

  @ApiProperty()
  nextReward!: number;

  @ApiProperty()
  todayReward!: number;
}
