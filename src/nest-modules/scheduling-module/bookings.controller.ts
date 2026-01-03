import {
  Body,
  Controller,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common";
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";

import { CancelBookingUseCase } from "../../core/scheduling/application/use-cases/cancel-booking/cancel-booking.use-case";
import { ConfirmBookingUseCase } from "../../core/scheduling/application/use-cases/confirm-booking/confirm-booking.use-case";
import { ProposeBookingUseCase } from "../../core/scheduling/application/use-cases/propose-booking/propose-booking.use-case";
import { BookingPresenter } from "./booking.presenter";
import { CancelBookingDto } from "./dto/cancel-booking.dto";
import { ProposeBookingDto } from "./dto/propose-booking.dto";

@ApiTags("Scheduling")
@Controller("scheduling/bookings")
export class BookingsController {
  @Inject(ProposeBookingUseCase)
  private proposeUseCase: ProposeBookingUseCase;

  @Inject(ConfirmBookingUseCase)
  private confirmUseCase: ConfirmBookingUseCase;

  @Inject(CancelBookingUseCase)
  private cancelUseCase: CancelBookingUseCase;

  @Post("propose")
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
  @ApiOperation({
    summary: "Confirmar booking",
    description: "Confirma um booking e bloqueia agenda no intervalo + buffer.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: BookingPresenter })
  async confirm(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    const output = await this.confirmUseCase.execute({ booking_id: id });
    return new BookingPresenter(output);
  }

  @Post(":id/cancel")
  @ApiOperation({
    summary: "Cancelar booking",
    description: "Cancela um booking com motivo opcional.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: BookingPresenter })
  async cancel(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: CancelBookingDto,
  ) {
    const output = await this.cancelUseCase.execute({
      booking_id: id,
      ...dto,
    });
    return new BookingPresenter(output);
  }
}
