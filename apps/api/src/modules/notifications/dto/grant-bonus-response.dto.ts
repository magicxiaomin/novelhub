import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GrantBonusResponseDto {
  @ApiProperty()
  granted!: boolean;

  @ApiPropertyOptional()
  balance?: number;

  @ApiPropertyOptional({ enum: ['already_granted', 'no_subscription'] })
  reason?: 'already_granted' | 'no_subscription';
}
