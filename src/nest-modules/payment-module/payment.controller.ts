import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { ConfirmTipPaymentUseCase } from "../../core/payment/application/use-cases/confirm-tip-payment/confirm-tip-payment.use-case";
import { GetMusicianTipsUseCase } from "../../core/payment/application/use-cases/get-musician-tips/get-musician-tips.use-case";
import { GetMusicianWalletUseCase } from "../../core/payment/application/use-cases/get-musician-wallet/get-musician-wallet.use-case";
import { SendTipUseCase } from "../../core/payment/application/use-cases/send-tip/send-tip.use-case";
import { UpdateMusicianPixKeyUseCase } from "../../core/payment/application/use-cases/update-musician-pix-key/update-musician-pix-key.use-case";
import { WithdrawToPixUseCase } from "../../core/payment/application/use-cases/withdraw-to-pix/withdraw-to-pix.use-case";
import {
  AuthGuard,
  AuthenticatedUser,
  CurrentUser,
  CurrentUserContextGuard,
  MusicianOwnershipGuard,
  Roles,
  RolesGuard,
} from "../auth-module";
import { ConfirmTipPaymentDto } from "./dto/confirm-tip-payment.dto";
import { ListMusicianTipsDto } from "./dto/list-musician-tips.dto";
import { SendTipDto } from "./dto/send-tip.dto";
import { UpdatePixKeyDto } from "./dto/update-pix-key.dto";
import { WithdrawToPixDto } from "./dto/withdraw-to-pix.dto";
import {
  ConfirmTipPaymentPresenter,
  MusicianWalletPresenter,
  SendTipPresenter,
  TipsListPresenter,
  WithdrawToPixPresenter,
} from "./payment.presenter";

@ApiTags("Payments")
@ApiBearerAuth("JWT-auth")
@UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
@Controller()
export class PaymentController {
  @Inject(SendTipUseCase)
  private sendTipUseCase: SendTipUseCase;

  @Inject(ConfirmTipPaymentUseCase)
  private confirmTipPaymentUseCase: ConfirmTipPaymentUseCase;

  @Inject(GetMusicianWalletUseCase)
  private getMusicianWalletUseCase: GetMusicianWalletUseCase;

  @Inject(GetMusicianTipsUseCase)
  private getMusicianTipsUseCase: GetMusicianTipsUseCase;

  @Inject(WithdrawToPixUseCase)
  private withdrawToPixUseCase: WithdrawToPixUseCase;

  @Inject(UpdateMusicianPixKeyUseCase)
  private updatePixKeyUseCase: UpdateMusicianPixKeyUseCase;

  @Post("tips")
  @Roles("audience", "admin")
  @ApiOperation({
    summary: "Criar gorjeta",
    description: "Cria uma gorjeta pendente e gera dados PIX quando aplicável. O audience_id é preenchido automaticamente do JWT.",
  })
  @ApiResponse({ status: 201, type: SendTipPresenter })
  async sendTip(
    @Body() dto: SendTipDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const output = await this.sendTipUseCase.execute({
      ...dto,
      audience_id: currentUser.userId,
    });
    return new SendTipPresenter(output);
  }

  @Post("tips/:id/confirm")
  @Roles("admin")
  @ApiOperation({
    summary: "Confirmar pagamento de gorjeta",
    description:
      "Confirma pagamento, cria transação e credita a carteira do músico/banda em uma transação Prisma.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 201, type: ConfirmTipPaymentPresenter })
  async confirmTipPayment(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: ConfirmTipPaymentDto,
  ) {
    const output = await this.confirmTipPaymentUseCase.execute({
      tip_id: id,
      payment: {
        amount: dto.amount,
        fee: dto.fee,
        payment_method: dto.payment_method,
        user_id: dto.user_id,
        metadata: dto.metadata,
      },
    });
    return new ConfirmTipPaymentPresenter(output);
  }

  @Get("musicians/:id/wallet")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({
    summary: "Consultar carteira do músico",
    description: "Retorna saldo e dados de carteira financeira do músico. Músico só pode consultar a própria carteira.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: MusicianWalletPresenter })
  @ApiResponse({ status: 403, description: "Acesso negado" })
  async getMusicianWallet(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    const output = await this.getMusicianWalletUseCase.execute({
      musician_id: id,
    });
    return new MusicianWalletPresenter(output);
  }

  @Get("musicians/:id/wallet/tips")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({
    summary: "Listar gorjetas recebidas pelo músico",
    description:
      "Lista as gorjetas recebidas pelo músico com paginação e filtro opcional por status. Músico só pode consultar as próprias gorjetas.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: TipsListPresenter })
  @ApiResponse({ status: 403, description: "Acesso negado" })
  async getMusicianTips(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Query() query: ListMusicianTipsDto,
  ) {
    const output = await this.getMusicianTipsUseCase.execute({
      musician_id: id,
      page: query.page,
      per_page: query.per_page,
      sort: query.sort,
      sort_dir: query.sort_dir,
      filter: { status: query.status },
    });
    return new TipsListPresenter(output);
  }

  @Patch("musicians/:id/wallet/pix-key")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({
    summary: "Atualizar chave PIX do músico",
    description:
      "Define ou atualiza a chave PIX de recebimento de gorjetas do músico. Cria a carteira automaticamente se ainda não existir.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: MusicianWalletPresenter })
  async updatePixKey(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: UpdatePixKeyDto,
  ) {
    const output = await this.updatePixKeyUseCase.execute({
      musician_id: id,
      pix_key: dto.pix_key,
      pix_key_type: dto.pix_key_type,
    });
    return new MusicianWalletPresenter(output);
  }

  @Post("musicians/:id/wallet/withdraw")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({
    summary: "Solicitar saque PIX",
    description: "Debita a carteira do músico e cria transação de saque PIX.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 201, type: WithdrawToPixPresenter })
  async withdrawToPix(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: WithdrawToPixDto,
  ) {
    const output = await this.withdrawToPixUseCase.execute({
      musician_id: id,
      amount: dto.amount,
      pix_key: dto.pix_key,
    });
    return new WithdrawToPixPresenter(output);
  }
}
