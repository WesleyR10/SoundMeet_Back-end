import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
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
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import { ConfirmTipPaymentUseCase } from "../../core/payment/application/use-cases/confirm-tip-payment/confirm-tip-payment.use-case";
import { ConnectMercadoPagoUseCase } from "../../core/payment/application/use-cases/connect-mercadopago/connect-mercadopago.use-case";
import { DisconnectMercadoPagoUseCase } from "../../core/payment/application/use-cases/connect-mercadopago/disconnect-mercadopago.use-case";
import { GetMusicianEscrowsUseCase } from "../../core/payment/application/use-cases/get-musician-escrows/get-musician-escrows.use-case";
import { GetMusicianTipsUseCase } from "../../core/payment/application/use-cases/get-musician-tips/get-musician-tips.use-case";
import { GetMusicianWalletUseCase } from "../../core/payment/application/use-cases/get-musician-wallet/get-musician-wallet.use-case";
import { GetTipUseCase } from "../../core/payment/application/use-cases/get-tip/get-tip.use-case";
import { SendTipUseCase } from "../../core/payment/application/use-cases/send-tip/send-tip.use-case";
import { UpdateMusicianPixKeyUseCase } from "../../core/payment/application/use-cases/update-musician-pix-key/update-musician-pix-key.use-case";
import { WithdrawToPixUseCase } from "../../core/payment/application/use-cases/withdraw-to-pix/withdraw-to-pix.use-case";
import {
  AuthenticatedUser,
  AuthGuard,
  CurrentUser,
  CurrentUserContextGuard,
  MusicianOwnershipGuard,
  Roles,
  RolesGuard,
} from "../auth-module";
import { ConfirmTipPaymentDto } from "./dto/confirm-tip-payment.dto";
import { ListMusicianEscrowsDto } from "./dto/list-musician-escrows.dto";
import { ListMusicianTipsDto } from "./dto/list-musician-tips.dto";
import { SendTipDto } from "./dto/send-tip.dto";
import { UpdatePixKeyDto } from "./dto/update-pix-key.dto";
import { WithdrawToPixDto } from "./dto/withdraw-to-pix.dto";
import {
  AudienceTipPresenter,
  ConfirmTipPaymentPresenter,
  EscrowsListPresenter,
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

  @Inject(ConnectMercadoPagoUseCase)
  private connectMercadoPagoUseCase: ConnectMercadoPagoUseCase;

  @Inject(DisconnectMercadoPagoUseCase)
  private disconnectMercadoPagoUseCase: DisconnectMercadoPagoUseCase;

  @Inject(ConfirmTipPaymentUseCase)
  private confirmTipPaymentUseCase: ConfirmTipPaymentUseCase;

  @Inject(GetMusicianWalletUseCase)
  private getMusicianWalletUseCase: GetMusicianWalletUseCase;

  @Inject(GetMusicianTipsUseCase)
  private getMusicianTipsUseCase: GetMusicianTipsUseCase;

  @Inject(GetMusicianEscrowsUseCase)
  private getMusicianEscrowsUseCase: GetMusicianEscrowsUseCase;

  @Inject(WithdrawToPixUseCase)
  private withdrawToPixUseCase: WithdrawToPixUseCase;

  @Inject(UpdateMusicianPixKeyUseCase)
  private updatePixKeyUseCase: UpdateMusicianPixKeyUseCase;

  @Inject(GetTipUseCase)
  private getTipUseCase: GetTipUseCase;

  @Post("tips")
  @Roles("audience", "admin")
  // Criar gorjeta gera cobrança no provedor: limite acima do fluxo humano
  // normal, para conter abuso. Ver Docs/audits/security-review-2026-08-28.md (A3).
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @ApiOperation({
    summary: "Criar gorjeta",
    description:
      "Cria uma gorjeta pendente e gera dados PIX quando aplicável. O audience_id é preenchido automaticamente do JWT.",
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

  /**
   * O fã relê a própria gorjeta.
   *
   * Declarada ANTES de `tips/:id/confirm` por disciplina de ordem — os
   * caminhos não colidem (um é GET, o outro POST com sufixo), mas rota de
   * leitura por id declarada depois de irmãs mais específicas é o defeito que
   * some numa refatoração sem produzir erro.
   */
  @Get("tips/:id")
  @Roles("audience", "admin")
  @ApiOperation({
    summary: "Consultar uma gorjeta própria",
    description:
      "Estado e código PIX de uma gorjeta. Existe porque o PIX é assíncrono: sem isto, o app mostra o QR e nunca fica sabendo que o pagamento foi confirmado. O socket cobre quem está com o app aberto; esta rota cobre quem voltou depois.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: AudienceTipPresenter })
  @ApiResponse({ status: 403, description: "Esta gorjeta não é sua." })
  async getTip(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const output = await this.getTipUseCase.execute({
      tip_id: id,
      requesting_user_id: currentUser.userId,
      is_admin: currentUser.roles.includes("admin"),
    });
    return new AudienceTipPresenter(output);
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
      /*
       * Confirmação manual/administrativa pressupõe que o valor entrou na conta
       * da plataforma — é o único caso em que faz sentido confirmar à mão. Uma
       * gorjeta do Mercado Pago é confirmada pelo webhook, com procedência
       * própria.
       */
      settlement: "platform",
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
    description:
      "Retorna saldo e dados de carteira financeira do músico. Músico só pode consultar a própria carteira.",
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

  /*
   * Somente leitura, e é a superfície HTTP INTEIRA da custódia.
   *
   * Não existe rota para reter, liberar ou estornar: quem retém é o webhook do
   * provedor (o único que sabe que o dinheiro entrou) e quem libera é o job
   * (depois de conferir check-in e prazo). Expor uma liberação por HTTP
   * transformaria as salvaguardas do `ReleaseBookingEscrowUseCase` em
   * formalidade — bastaria chamar a rota.
   */
  @Get("musicians/:id/wallet/escrow")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({
    summary: "Listar custódias de cachê do músico",
    description:
      "Extrato das custódias (F1.3a): valor bruto, comissão, líquido a receber e em que estágio cada uma está. Só o próprio músico consulta. A referência da cobrança no provedor NÃO é exposta.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: EscrowsListPresenter })
  @ApiResponse({ status: 403, description: "Acesso negado" })
  async getMusicianEscrows(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Query() query: ListMusicianEscrowsDto,
  ) {
    const output = await this.getMusicianEscrowsUseCase.execute({
      musician_id: id,
      page: query.page,
      per_page: query.per_page,
      sort: query.sort,
      sort_dir: query.sort_dir,
      filter: { status: query.status, booking_id: query.booking_id },
    });
    return new EscrowsListPresenter(output);
  }

  @Patch("musicians/:id/wallet/pix-key")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  // Troca de chave PIX é operação sensível (define para onde o dinheiro sai):
  // limite apertado, além do global. Ver Docs/audits/security-review-2026-08-28.md (A3).
  @Throttle({ default: { ttl: 60000, limit: 5 } })
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

  /**
   * O header `Idempotency-Key` é opcional, mas é a única barreira contra o
   * duplo clique.
   *
   * O lock da carteira serializa os pedidos concorrentes e o saldo barra o
   * segundo quando não há fundo para os dois — mas com saldo sobrando os dois
   * saques são legítimos vistos um de cada vez, e sairiam os dois. Só o cliente
   * sabe distinguir "pedi de novo porque a rede caiu" de "quero sacar de novo",
   * e é isso que a chave carrega.
   */
  @Post("musicians/:id/wallet/withdraw")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  // Saque é a rota que move dinheiro para fora: limite apertado, além do
  // global. Ver Docs/audits/security-review-2026-08-28.md (A3).
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({
    summary: "Solicitar saque PIX",
    description:
      "Debita a carteira do músico e cria transação de saque PIX. Envie `Idempotency-Key` para que um reenvio da mesma solicitação devolva o saque original em vez de criar um segundo.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiHeader({
    name: "Idempotency-Key",
    required: false,
    description:
      "Identificador único da solicitação, gerado pelo cliente. Um reenvio com a mesma chave devolve a transação original.",
  })
  @ApiResponse({ status: 201, type: WithdrawToPixPresenter })
  async withdrawToPix(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: WithdrawToPixDto,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    const output = await this.withdrawToPixUseCase.execute({
      musician_id: id,
      amount: dto.amount,
      idempotency_key: idempotencyKey?.trim() || null,
    });
    return new WithdrawToPixPresenter(output);
  }

  /**
   * Passo 1 do vínculo com o Mercado Pago — o gateway da GORJETA.
   *
   * Devolve a URL de autorização; quem manda o músico para lá é o cliente. O
   * `musician_id` vai **assinado** dentro do `state`, porque o callback volta
   * pelo navegador sem Bearer token e é essa assinatura que impede alguém de
   * vincular a própria conta de pagamento à conta de outro artista.
   *
   * 🔴 A gorjeta cai **direto na conta do músico**, com a comissão saindo por
   * `application_fee` — a plataforma nunca detém recurso dele. É por isso que
   * gorjeta não tem "saque pela SoundMeet": ele saca no próprio Mercado Pago.
   */
  @Post("musicians/:id/mercadopago/connect")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Conectar conta Mercado Pago (receber gorjetas)",
    description:
      "Devolve a URL de autorização OAuth. O vínculo é o que permite criar a cobrança na conta do próprio músico.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, description: "{ authorization_url }" })
  @ApiResponse({ status: 403, description: "Acesso negado" })
  async connectMercadoPago(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    return this.connectMercadoPagoUseCase.execute({ musician_id: id });
  }

  /**
   * Desvincula a conta.
   *
   * Sem checagem de saldo, ao contrário de `disableEscrow`: a gorjeta já caiu na
   * conta dele no momento do pagamento, então não há valor nosso a proteger —
   * desvincular só impede gorjetas novas.
   */
  @Delete("musicians/:id/mercadopago")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Desconectar conta Mercado Pago",
    description:
      "Remove o vínculo. Gorjetas já recebidas não são afetadas — elas nunca passaram pela plataforma.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200 })
  async disconnectMercadoPago(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    return this.disconnectMercadoPagoUseCase.execute({ musician_id: id });
  }
}
