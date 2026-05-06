import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UnauthorizedException,
  UseGuards,
  Body,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { CheckoutCoinsDto, CheckoutSubscriptionDto } from './dto/checkout.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@ApiCookieAuth()
@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('checkout/coins')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a Stripe Checkout session for a coin pack' })
  @ApiOkResponse({ description: 'Returns the Stripe Checkout URL' })
  checkoutCoins(
    @CurrentUser() user: { id: string } | null,
    @Body() dto: CheckoutCoinsDto,
  ): Promise<{ url: string; sessionId: string }> {
    if (!user) throw new UnauthorizedException();
    return this.payments.createCoinCheckout(user.id, dto.packageId);
  }

  @Post('checkout/subscription')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a Stripe Checkout session for a subscription' })
  @ApiOkResponse({ description: 'Returns the Stripe Checkout URL' })
  checkoutSubscription(
    @CurrentUser() user: { id: string } | null,
    @Body() dto: CheckoutSubscriptionDto,
  ): Promise<{ url: string; sessionId: string }> {
    if (!user) throw new UnauthorizedException();
    return this.payments.createSubscriptionCheckout(user.id, dto.plan);
  }

  @Get('portal')
  @ApiOperation({ summary: 'Create a Stripe Customer Portal session URL' })
  portal(@CurrentUser() user: { id: string } | null): Promise<{ url: string }> {
    if (!user) throw new UnauthorizedException();
    return this.payments.createPortalSession(user.id);
  }

  @Get('orders/:sessionId')
  @ApiOperation({ summary: 'Poll order status by Stripe session id' })
  orderStatus(
    @CurrentUser() user: { id: string } | null,
    @Param('sessionId') sessionId: string,
  ): Promise<{
    status: string;
    type: string;
    coinsGranted: number | null;
    completedAt: Date | null;
  }> {
    if (!user) throw new UnauthorizedException();
    return this.payments.getOrderStatus(user.id, sessionId);
  }
}
