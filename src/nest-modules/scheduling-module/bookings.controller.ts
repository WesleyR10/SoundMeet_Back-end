import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
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

import { CancelBookingUseCase } from "../../core/scheduling/application/use-cases/cancel-booking/cancel-booking.use-case";
import { CheckInBookingUseCase } from "../../core/scheduling/application/use-cases/check-in-booking/check-in-booking.use-case";
import { ConfirmBookingUseCase } from "../../core/scheduling/application/use-cases/confirm-booking/confirm-booking.use-case";
import { DisputeBookingUseCase } from "../../core/scheduling/application/use-cases/dispute-booking/dispute-booking.use-case";
import { GetBookingUseCase } from "../../core/scheduling/application/use-cases/get-booking/get-booking.use-case";
import { ListBookingsUseCase } from "../../core/scheduling/application/use-cases/list-bookings/list-bookings.use-case";
import { ProposeBookingInput } from "../../core/scheduling/application/use-cases/propose-booking/propose-booking.input";
import { ProposeBookingUseCase } from "../../core/scheduling/application/use-cases/propose-booking/propose-booking.use-case";
import {
  AuthGuard,
  CurrentUser,
  CurrentUserContextGuard,
  resolveParticipantIds,
  Roles,
  RolesGuard,
} from "../auth-module";
import { AuthenticatedUser } from "../auth-module/interfaces/authenticated-user.interface";
import {
  BookingCollectionPresenter,
  BookingPresenter,
} from "./booking.presenter";
import { CancelBookingDto } from "./dto/cancel-booking.dto";
import { DisputeBookingDto } from "./dto/dispute-booking.dto";
import { ProposeBookingDto } from "./dto/propose-booking.dto";
import { SearchBookingsDto } from "./dto/search-bookings.dto";

/**
 * Lado da negociação em que o autenticado está agindo.
 *
 * Serve a `cancelled_by` (quem cancelou) e a `proposed_by` (quem propôs) — é a
 * mesma pergunta feita em dois momentos, então é uma função só. Sempre derivada
 * do JWT, nunca do corpo: os dois campos descrevem autoria, e autoria vinda de
 * input do cliente é forjável.
 */
function deriveActorSide(
  user: AuthenticatedUser,
): "establishment" | "musician" | "band" {
  if (user.roles.includes("musician")) return "musician";
  if (user.roles.includes("band")) return "band";
  return "establishment";
}

@ApiTags("Scheduling")
@ApiBearerAuth("JWT-auth")
@UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
@Controller("scheduling/bookings")
export class BookingsController {
  @Inject(ProposeBookingUseCase)
  private proposeUseCase: ProposeBookingUseCase;

  @Inject(ConfirmBookingUseCase)
  private confirmUseCase: ConfirmBookingUseCase;

  @Inject(CancelBookingUseCase)
  private cancelUseCase: CancelBookingUseCase;

  @Inject(CheckInBookingUseCase)
  private checkInUseCase: CheckInBookingUseCase;

  @Inject(DisputeBookingUseCase)
  private disputeUseCase: DisputeBookingUseCase;

  @Inject(ListBookingsUseCase)
  private listUseCase: ListBookingsUseCase;

  @Inject(GetBookingUseCase)
  private getUseCase: GetBookingUseCase;

  @Get()
  @Roles("establishment", "musician", "admin")
  @ApiOperation({
    summary: "Listar reservas do usuário autenticado",
    description:
      "Devolve as reservas em que o autenticado é parte — como estabelecimento, como músico ou por uma banda que ele integra. O escopo vem SEMPRE do token (sub + claims establishment_ids/band_ids); os filtros de query apenas refinam dentro dele e nunca o ampliam. Admin vê tudo.",
  })
  @ApiResponse({ status: 200, type: BookingCollectionPresenter })
  async search(
    @Query() query: SearchBookingsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const output = await this.listUseCase.execute({
      ...query,
      requesting_participant_ids: resolveParticipantIds(user),
      is_admin: user?.isAdmin,
    });
    return new BookingCollectionPresenter(output);
  }

  // Depois do @Get() sem parâmetro e sem colisão com as rotas @Post(":id/...").
  @Get(":id")
  @Roles("establishment", "musician", "admin")
  @ApiOperation({
    summary: "Detalhe de uma reserva",
    description:
      "Só participantes da reserva (estabelecimento, músico ou integrante da banda) e admin. Ao contrário de confirmar/cancelar, VER não exige liderança da banda.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: BookingPresenter })
  @ApiResponse({ status: 403, description: "Não é participante da reserva" })
  @ApiResponse({ status: 404, description: "Reserva não encontrada" })
  async findOne(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const output = await this.getUseCase.execute({
      booking_id: id,
      requesting_participant_ids: resolveParticipantIds(user),
      requesting_musician_id: user?.userId,
      is_admin: user?.isAdmin,
    });
    return new BookingPresenter(output);
  }

  @Post("propose")
  @Roles("establishment", "musician", "admin")
  @ApiOperation({
    summary: "Propor booking",
    description:
      "Cria uma proposta (pending) para músico ou banda. Não bloqueia agenda.",
  })
  @ApiResponse({ status: 201, type: BookingPresenter })
  async propose(
    @Body() dto: ProposeBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const output = await this.proposeUseCase.execute(
      new ProposeBookingInput({
        ...dto,
        requesting_participant_ids: resolveParticipantIds(user),
        requesting_musician_id: user?.userId,
        is_admin: user.isAdmin,
        // Depois do spread, como todo campo de autoria: registra qual lado
        // originou a proposta para o consumidor saber de quem é a vez de
        // responder. Ver `proposed_by` em booking.aggregate.ts.
        proposed_by: deriveActorSide(user),
      }),
    );
    return new BookingPresenter(output);
  }

  @Post(":id/confirm")
  @Roles("establishment", "musician", "admin")
  @ApiOperation({
    summary: "Confirmar booking",
    description: "Confirma um booking e bloqueia agenda no intervalo + buffer.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: BookingPresenter })
  async confirm(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const output = await this.confirmUseCase.execute({
      booking_id: id,
      requesting_participant_ids: resolveParticipantIds(user),
      requesting_musician_id: user?.userId,
      is_admin: user.isAdmin,
    });
    return new BookingPresenter(output);
  }

  @Post(":id/cancel")
  @Roles("establishment", "musician", "admin")
  @ApiOperation({
    summary: "Cancelar booking",
    description: "Cancela um booking com motivo opcional.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: BookingPresenter })
  async cancel(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: CancelBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const output = await this.cancelUseCase.execute({
      booking_id: id,
      cancelled_by: deriveActorSide(user),
      requesting_participant_ids: resolveParticipantIds(user),
      requesting_musician_id: user?.userId,
      is_admin: user.isAdmin,
      ...dto,
    });
    return new BookingPresenter(output);
  }

  /**
   * Registro da apresentação — a prova de que o show aconteceu.
   *
   * Vale por si contra chargeback (camada 3), e é a primeira das duas condições
   * que liberam a custódia do cachê. A hora é do SERVIDOR: o corpo é vazio de
   * propósito, porque aceitar `checked_in_at` do cliente permitiria registrar um
   * show de ontem como se fosse de hoje — e este registro existe para provar
   * *quando* algo aconteceu.
   *
   * As duas partes podem registrar. Em muita casa quem tem o app aberto no fim
   * da noite é o dono, e um check-in feito pela contraparte é prova ainda mais
   * forte a favor do artista.
   */
  @Post(":id/check-in")
  @Roles("establishment", "musician", "admin")
  @ApiOperation({
    summary: "Registrar a apresentação (check-in)",
    description:
      "Marca que o show aconteceu, com a hora do servidor. Só em booking confirmado e não antes do horário de início. Idempotente: o primeiro registro é o que vale.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 201, type: BookingPresenter })
  @ApiResponse({ status: 403, description: "Não é parte deste show." })
  @ApiResponse({
    status: 422,
    description: "Booking não confirmado, ou show ainda não começou.",
  })
  async checkIn(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const output = await this.checkInUseCase.execute({
      booking_id: id,
      requesting_participant_ids: resolveParticipantIds(user),
      requesting_musician_id: user?.userId,
      is_admin: user.isAdmin,
    });
    return new BookingPresenter(output);
  }

  /**
   * Contestação da apresentação pelo estabelecimento.
   *
   * 🔴 **Só o contratante.** Contestar é dizer "o serviço não foi entregue como
   * combinado"; deixar o artista fazer isso seria deixá-lo travar o próprio
   * pagamento. A checagem é feita dentro do use-case, que tem o booking em mãos.
   *
   * Congela a liberação automática da custódia e manda o caso para mediação.
   */
  @Post(":id/dispute")
  @Roles("establishment", "admin")
  @ApiOperation({
    summary: "Contestar a apresentação",
    description:
      "Abre contestação dentro da janela. Bloqueia a liberação automática do cachê em custódia até a mediação decidir. Idempotente: a primeira contestação é a que vale.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 201, type: BookingPresenter })
  @ApiResponse({
    status: 403,
    description: "Somente o estabelecimento contratante contesta.",
  })
  async dispute(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: DisputeBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const output = await this.disputeUseCase.execute({
      booking_id: id,
      reason: dto.reason,
      requesting_participant_ids: resolveParticipantIds(user),
      is_admin: user.isAdmin,
    });
    return new BookingPresenter(output);
  }
}
