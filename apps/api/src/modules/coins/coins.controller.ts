import { Controller, Get, Query, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import type { CoinTransactionRow } from './coins.constants';
import { CoinsService } from './coins.service';
import { ListTransactionsDto } from './dto/list-transactions.dto';

@ApiTags('coins')
@ApiCookieAuth()
@Controller('coins')
@UseGuards(JwtAuthGuard)
export class CoinsController {
  constructor(private readonly coins: CoinsService) {}

  @Get('balance')
  @ApiOperation({ summary: 'Get the current user’s coin balance' })
  @ApiOkResponse({ description: 'Returns coinBalance' })
  balance(@CurrentUser() user: { id: string } | null): Promise<{ coinBalance: number }> {
    if (!user) throw new UnauthorizedException();
    return this.coins.getBalance(user.id);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'List the current user’s coin transactions' })
  transactions(
    @CurrentUser() user: { id: string } | null,
    @Query() query: ListTransactionsDto,
  ): Promise<{
    items: CoinTransactionRow[];
    total: number;
    page: number;
    limit: number;
  }> {
    if (!user) throw new UnauthorizedException();
    return this.coins.listTransactions(user.id, query.page, query.limit);
  }
}
