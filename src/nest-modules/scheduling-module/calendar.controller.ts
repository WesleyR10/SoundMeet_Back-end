import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { GetFreeBusyUseCase } from "../../core/scheduling/application/use-cases/get-free-busy/get-free-busy.use-case";
import { GetMonthSlotsUseCase } from "../../core/scheduling/application/use-cases/get-month-slots/get-month-slots.use-case";
import { Public } from "../auth-module";
import {
  GetFreeBusyPresenter,
  GetMonthSlotsPresenter,
} from "./calendar.presenter";
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
  @Public()
  @ApiOperation({
    summary: "Consultar free/busy",
    description:
      "Retorna os intervalos ocupados (unavailability + bookings confirmados). " +
      "Rota pública e intencional — não expõe PII; usada pelo app para exibir disponibilidade antes de autenticar.",
  })
  @ApiOkResponse({ type: GetFreeBusyPresenter })
  async getFreeBusy(@Query() dto: GetFreeBusyDto) {
    return this.getFreeBusyUseCase.execute(dto);
  }

  @Get("month-slots")
  @Public()
  @ApiOperation({
    summary: "Consultar slots do mês",
    description:
      "Gera slots disponíveis do mês com base nas regras semanais e busy. " +
      "Rota pública e intencional — não expõe PII; usada pelo app para exibir calendário antes de autenticar.",
  })
  @ApiOkResponse({ type: GetMonthSlotsPresenter })
  async getMonthSlots(@Query() dto: GetMonthSlotsDto) {
    return this.getMonthSlotsUseCase.execute(dto);
  }
}
