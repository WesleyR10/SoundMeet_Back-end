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
import { ConfirmBookingUseCase } from "../../core/scheduling/application/use-cases/confirm-booking/confirm-booking.use-case";
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
import { ProposeBookingDto } from "./dto/propose-booking.dto";
import { SearchBookingsDto } from "./dto/search-bookings.dto";

function deriveCancelledBy(
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
      cancelled_by: deriveCancelledBy(user),
      requesting_participant_ids: resolveParticipantIds(user),
      requesting_musician_id: user?.userId,
      is_admin: user.isAdmin,
      ...dto,
    });
    return new BookingPresenter(output);
  }
}
