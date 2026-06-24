import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { AddUnavailabilityUseCase } from "../../core/scheduling/application/use-cases/add-unavailability/add-unavailability.use-case";
import { GetAvailabilityUseCase } from "../../core/scheduling/application/use-cases/get-availability/get-availability.use-case";
import { RemoveUnavailabilityUseCase } from "../../core/scheduling/application/use-cases/remove-unavailability/remove-unavailability.use-case";
import { SetAvailabilitySettingsUseCase } from "../../core/scheduling/application/use-cases/set-availability-settings/set-availability-settings.use-case";
import { SetWeeklyRulesUseCase } from "../../core/scheduling/application/use-cases/set-weekly-rules/set-weekly-rules.use-case";
import {
  AuthGuard,
  CurrentUserContextGuard,
  Roles,
  RolesGuard,
} from "../auth-module";
import { MusicianOwnershipGuard } from "../auth-module/ownership/musician-ownership.guard";
import { AvailabilityPresenter } from "./availability.presenter";
import { AddUnavailabilityDto } from "./dto/add-unavailability.dto";
import { SetAvailabilitySettingsDto } from "./dto/set-availability-settings.dto";
import { SetWeeklyRulesDto } from "./dto/set-weekly-rules.dto";

@ApiTags("Scheduling")
@ApiBearerAuth("JWT-auth")
@UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
@Controller("scheduling/musicians/:musician_id/availability")
export class AvailabilityController {
  @Inject(GetAvailabilityUseCase)
  private getAvailabilityUseCase: GetAvailabilityUseCase;

  @Inject(SetAvailabilitySettingsUseCase)
  private setAvailabilitySettingsUseCase: SetAvailabilitySettingsUseCase;

  @Inject(SetWeeklyRulesUseCase)
  private setWeeklyRulesUseCase: SetWeeklyRulesUseCase;

  @Inject(AddUnavailabilityUseCase)
  private addUnavailabilityUseCase: AddUnavailabilityUseCase;

  @Inject(RemoveUnavailabilityUseCase)
  private removeUnavailabilityUseCase: RemoveUnavailabilityUseCase;

  @Get()
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({
    summary: "Obter configuração de disponibilidade",
    description:
      "Retorna a configuração completa de disponibilidade do músico: fuso horário, buffer, regras semanais e bloqueios.",
  })
  @ApiParam({ name: "musician_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: AvailabilityPresenter })
  async get(
    @Param("musician_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    musician_id: string,
  ) {
    const output = await this.getAvailabilityUseCase.execute({ musician_id });
    return new AvailabilityPresenter(output);
  }

  @Patch("settings")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({
    summary: "Atualizar configurações de disponibilidade",
    description:
      "Atualiza fuso horário, buffer padrão e limite de shows por dia. Cria o registro se não existir.",
  })
  @ApiParam({ name: "musician_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: AvailabilityPresenter })
  async updateSettings(
    @Param("musician_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    musician_id: string,
    @Body() dto: SetAvailabilitySettingsDto,
  ) {
    const output = await this.setAvailabilitySettingsUseCase.execute({
      musician_id,
      ...dto,
    });
    return new AvailabilityPresenter(output);
  }

  @Put("rules")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({
    summary: "Definir regras semanais",
    description:
      "Substitui todas as regras de disponibilidade semanal do músico. Cria o registro se não existir.",
  })
  @ApiParam({ name: "musician_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: AvailabilityPresenter })
  async setWeeklyRules(
    @Param("musician_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    musician_id: string,
    @Body() dto: SetWeeklyRulesDto,
  ) {
    const output = await this.setWeeklyRulesUseCase.execute({
      musician_id,
      rules: dto.rules ?? [],
    });
    return new AvailabilityPresenter(output);
  }

  @Post("blocks")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @HttpCode(201)
  @ApiOperation({
    summary: "Adicionar bloqueio de agenda",
    description:
      "Adiciona um período de indisponibilidade manual. Cria o registro se não existir.",
  })
  @ApiParam({ name: "musician_id", required: true, format: "uuid" })
  @ApiResponse({ status: 201, type: AvailabilityPresenter })
  async addBlock(
    @Param("musician_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    musician_id: string,
    @Body() dto: AddUnavailabilityDto,
  ) {
    const output = await this.addUnavailabilityUseCase.execute({
      musician_id,
      start_at: dto.start_at,
      end_at: dto.end_at,
      reason: dto.reason,
    });
    return new AvailabilityPresenter(output);
  }

  @Delete("blocks/:block_id")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @HttpCode(200)
  @ApiOperation({
    summary: "Remover bloqueio de agenda",
    description: "Remove um período de indisponibilidade pelo ID do bloco.",
  })
  @ApiParam({ name: "musician_id", required: true, format: "uuid" })
  @ApiParam({ name: "block_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: AvailabilityPresenter })
  async removeBlock(
    @Param("musician_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    musician_id: string,
    @Param("block_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    block_id: string,
  ) {
    const output = await this.removeUnavailabilityUseCase.execute({
      musician_id,
      block_id,
    });
    return new AvailabilityPresenter(output);
  }
}
