import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches } from 'class-validator';
import {
  COIN_PACKAGE_IDS,
  type CoinPackageId,
  SUBSCRIPTION_PLAN_IDS,
  type SubscriptionPlanId,
} from '@novelhub/shared';

export class CheckoutCoinsDto {
  @ApiProperty({ enum: COIN_PACKAGE_IDS })
  @IsString()
  @IsIn([...COIN_PACKAGE_IDS])
  packageId!: CoinPackageId;

  @ApiProperty({ required: false, example: '/read/book-id/4' })
  @IsOptional()
  @IsString()
  @Matches(/^\/read\//)
  returnUrl?: string;
}

export class CheckoutSubscriptionDto {
  @ApiProperty({ enum: SUBSCRIPTION_PLAN_IDS })
  @IsString()
  @IsIn([...SUBSCRIPTION_PLAN_IDS])
  plan!: SubscriptionPlanId;

  @ApiProperty({ required: false, example: '/read/book-id/4' })
  @IsOptional()
  @IsString()
  @Matches(/^\/read\//)
  returnUrl?: string;
}
