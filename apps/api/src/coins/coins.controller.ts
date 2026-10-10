import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type AuthRequest } from '../auth/auth.guard';
import { CoinsService } from './coins.service';

@Controller('coins')
@UseGuards(AuthGuard)
export class CoinsController {
  constructor(private coins: CoinsService) {}

  @Get()
  wallet(@Req() request: AuthRequest) {
    return this.coins.wallet(request.userId);
  }
}
