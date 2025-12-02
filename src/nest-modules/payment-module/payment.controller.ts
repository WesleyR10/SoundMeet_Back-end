import { Controller, Post, Body, Inject, UseGuards, Get, Query } from "@nestjs/common";
import { AuthGuard } from "../auth-module/auth.guard";
import { SendTipUseCase } from "../../core/payment/application/use-cases/send-tip.use-case";
import { ConfirmTipPaymentUseCase } from "../../core/payment/application/use-cases/confirm-tip-payment.use-case";
import { WithdrawToPixUseCase } from "../../core/payment/application/use-cases/withdraw-to-pix.use-case";
import { GetMusicianTransactionsUseCase } from "../../core/payment/application/use-cases/get-musician-transactions.use-case";
import { SendTipDto } from "./dto/send-tip.dto";
import { ConfirmTipPaymentDto } from "./dto/confirm-tip-payment.dto";
import { WithdrawToPixDto } from "./dto/withdraw-to-pix.dto";

@UseGuards(AuthGuard)
@Controller("payments")
export class PaymentController {
  @Inject(SendTipUseCase)
  private sendTipUseCase: SendTipUseCase;

  @Inject(ConfirmTipPaymentUseCase)
  private confirmTipUseCase: ConfirmTipPaymentUseCase;

  @Inject(WithdrawToPixUseCase)
  private withdrawUseCase: WithdrawToPixUseCase;

  @Inject(GetMusicianTransactionsUseCase)
  private getTransactionsUseCase: GetMusicianTransactionsUseCase;

  @Post("tips")
  async sendTip(@Body() dto: SendTipDto) {
    return this.sendTipUseCase.execute(dto);
  }

  @Post("tips/confirm")
  async confirmTip(@Body() dto: ConfirmTipPaymentDto) {
    return this.confirmTipUseCase.execute(dto);
  }

  @Post("withdraw")
  async withdraw(@Body() dto: WithdrawToPixDto) {
    return this.withdrawUseCase.execute(dto);
  }

  @Get("transactions")
  async getTransactions(@Query() query: any) {
    // Basic mapping, assume query params match use case input
    return this.getTransactionsUseCase.execute({
      musician_id: query.musician_id,
      page: query.page ? parseInt(query.page) : 1,
      per_page: query.per_page ? parseInt(query.per_page) : 15,
      sort: query.sort,
      sort_dir: query.sort_dir,
      filter: query.filter,
    });
  }
}
