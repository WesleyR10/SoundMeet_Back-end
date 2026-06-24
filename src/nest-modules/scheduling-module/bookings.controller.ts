import {
  Body,
  Controller,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
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
import { ProposeBookingUseCase } from "../../core/scheduling/application/use-cases/propose-booking/propose-booking.use-case";
import {
  AuthGuard,
  CurrentUser,
  CurrentUserContextGuard,
  Roles,
  RolesGuard,
} from "../auth-module";
import { AuthenticatedUser } from "../auth-module/interfaces/authenticated-user.interface";
import { BookingPresenter } from "./booking.presenter";
import { CancelBookingDto } from "./dto/cancel-booking.dto";
import { ProposeBookingDto } from "./dto/propose-booking.dto";

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

  @Post("propose")
  @Roles("establishment", "musician", "admin")
  @ApiOperation({
    summary: "Propor booking",
    description:
      "Cria uma proposta (pending) para músico ou banda. Não bloqueia agenda.",
  })
  @ApiResponse({ status: 201, type: BookingPresenter })
  async propose(@Body() dto: ProposeBookingDto) {
    const output = await this.proposeUseCase.execute(dto);
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
      requesting_user_id: user.userId,
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
      requesting_user_id: user.userId,
      is_admin: user.isAdmin,
      ...dto,
    });
    return new BookingPresenter(output);
  }
}
