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
  Req,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FbCapiService } from '../fb-capi/fb-capi.service';

import { CheckoutCoinsDto, CheckoutSubscriptionDto } from './dto/checkout.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@ApiCookieAuth()
@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly fbCapi: FbCapiService,
  ) {}

  @Post('checkout/coins')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a Stripe Checkout session for a coin pack' })
  @ApiOkResponse({ description: 'Returns the Stripe Checkout URL' })
  checkoutCoins(
    @CurrentUser() user: { id: string } | null,
    @Body() dto: CheckoutCoinsDto,
    @Req() req: Request,
  ): Promise<{ url: string; sessionId: string }> {
    if (!user) throw new UnauthorizedException();
    const fbConsent = this.fbCapi.shouldSendForRequest(req);
    return this.payments.createCoinCheckout(
      user.id,
      dto.packageId,
      {
        fbConsent,
        fbUserData: fbConsent ? this.fbCapi.extractFbUserData(req) : null,
      },
      dto.returnUrl,
    );
  }

  @Post('checkout/subscription')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a Stripe Checkout session for a subscription' })
  @ApiOkResponse({ description: 'Returns the Stripe Checkout URL' })
  checkoutSubscription(
    @CurrentUser() user: { id: string } | null,
    @Body() dto: CheckoutSubscriptionDto,
    @Req() req: Request,
  ): Promise<{ url: string; sessionId: string }> {
    if (!user) throw new UnauthorizedException();
    const fbConsent = this.fbCapi.shouldSendForRequest(req);
    return this.payments.createSubscriptionCheckout(
      user.id,
      dto.plan,
      {
        fbConsent,
        fbUserData: fbConsent ? this.fbCapi.extractFbUserData(req) : null,
      },
      dto.returnUrl,
    );
  }

  @Get('portal')
  @ApiOperation({ summary: 'Create a Stripe Customer Portal session URL' })
  portal(@CurrentUser() user: { id: string } | null): Promise<{ url: string }> {
    if (!user) throw new UnauthorizedException();
    return this.payments.createPortalSession(user.id);
  }

  @Get('subscription')
  @ApiOperation({ summary: 'Return the active subscription summary' })
  @ApiOkResponse({
    description: 'The active subscription summary, or null when not subscribed',
  })
  subscription(
    @CurrentUser() user: { id: string } | null,
  ): ReturnType<PaymentsService['getActiveSubscription']> {
    if (!user) throw new UnauthorizedException();
    return this.payments.getActiveSubscription(user.id);
  }

  @Get('orders/:sessionId')
  @ApiOperation({ summary: 'Poll order status by Stripe session id' })
  orderStatus(
    @CurrentUser() user: { id: string } | null,
    @Param('sessionId') sessionId: string,
  ): Promise<{
    status: string;
    type: string;
    amount: number;
    currency: string;
    coinsGranted: number | null;
    completedAt: Date | null;
  }> {
    if (!user) throw new UnauthorizedException();
    return this.payments.getOrderStatus(user.id, sessionId);
  }
}
