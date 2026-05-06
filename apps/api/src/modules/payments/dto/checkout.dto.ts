import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';
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
}

export class CheckoutSubscriptionDto {
  @ApiProperty({ enum: SUBSCRIPTION_PLAN_IDS })
  @IsString()
  @IsIn([...SUBSCRIPTION_PLAN_IDS])
  plan!: SubscriptionPlanId;
}
