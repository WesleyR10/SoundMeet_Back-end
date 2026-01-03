import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { GetFreeBusyUseCase } from "../../core/scheduling/application/use-cases/get-free-busy/get-free-busy.use-case";
import { GetMonthSlotsUseCase } from "../../core/scheduling/application/use-cases/get-month-slots/get-month-slots.use-case";
import { GetFreeBusyDto } from "./dto/get-free-busy.dto";
import { GetMonthSlotsDto } from "./dto/get-month-slots.dto";

@ApiTags("Scheduling")
@Controller("scheduling/calendar")
export class CalendarController {
  @Inject(GetFreeBusyUseCase)
  private getFreeBusyUseCase: GetFreeBusyUseCase;

  @Inject(GetMonthSlotsUseCase)
  private getMonthSlotsUseCase: GetMonthSlotsUseCase;

  @Get("free-busy")
  @ApiOperation({
    summary: "Consultar free/busy",
    description:
      "Retorna os intervalos ocupados (unavailability + bookings confirmados).",
  })
  @ApiResponse({ status: 200 })
  async getFreeBusy(@Query() dto: GetFreeBusyDto) {
    return this.getFreeBusyUseCase.execute(dto);
  }

  @Get("month-slots")
  @ApiOperation({
    summary: "Consultar slots do mês",
    description:
      "Gera slots disponíveis do mês com base nas regras semanais e busy.",
  })
  @ApiResponse({ status: 200 })
  async getMonthSlots(@Query() dto: GetMonthSlotsDto) {
    return this.getMonthSlotsUseCase.execute(dto);
  }
}
