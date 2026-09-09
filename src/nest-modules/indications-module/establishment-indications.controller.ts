import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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

import { ListEstablishmentIndicationsUseCase } from "../../core/indication/application/use-cases/list-establishment-indications/list-establishment-indications.use-case";
import { UpdateIndicationStatusUseCase } from "../../core/indication/application/use-cases/update-indication-status/update-indication-status.use-case";
import {
  AuthGuard,
  CurrentUserContextGuard,
  EstablishmentOwnershipGuard,
  OwnershipParam,
  Roles,
  RolesGuard,
} from "../auth-module";
import { ListIndicationsDto } from "./dto/list-indications.dto";
import { UpdateIndicationStatusDto } from "./dto/update-indication-status.dto";
import {
  IndicationCollectionPresenter,
  IndicationPresenter,
} from "./indications.presenter";

/**
 * Caixa de indicações do estabelecimento — a metade B2B que nunca existiu.
 *
 * O lado do público (`POST /audiences/:id/indications`) existe desde sempre,
 * mas até 28/set/2026 a indicação era DESCARTADA: só virava pontos para o fã.
 * Sem dado gravado, não havia o que listar aqui.
 *
 * 🔴 **`:indication_id`, nunca `:id`.** Um `:id` de sub-recurso colide com o
 * fallback do ownership guard e daria 403 no dono legítimo — armadilha já paga
 * em `personal-chord-sheet`. O `@OwnershipParam({ param: "establishment_id" })`
 * torna a fonte explícita, que é a resolução que sempre vence.
 */
@ApiTags("Indications")
@ApiBearerAuth("JWT-auth")
@UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
@Controller("establishments")
export class EstablishmentIndicationsController {
  constructor(
    private readonly listUseCase: ListEstablishmentIndicationsUseCase,
    private readonly updateStatusUseCase: UpdateIndicationStatusUseCase,
  ) {}

  @Get(":establishment_id/indications")
  @Roles("establishment", "admin")
  @UseGuards(EstablishmentOwnershipGuard)
  @OwnershipParam({ param: "establishment_id" })
  @ApiOperation({
    summary: "Indicações recebidas do público",
    description:
      "Músicos que o público indicou para este estabelecimento. `meta.new_count` é o badge da caixa.",
  })
  @ApiParam({ name: "establishment_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: IndicationCollectionPresenter })
  async list(
    @Param("establishment_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    establishmentId: string,
    @Query() query: ListIndicationsDto,
  ) {
    const output = await this.listUseCase.execute({
      ...query,
      // 🔴 Depois do spread, sempre. O escopo do dono não pode ser
      // sobrescrito por nada que venha da query.
      establishment_id: establishmentId,
    });
    return new IndicationCollectionPresenter(output);
  }

  @Patch(":establishment_id/indications/:indication_id")
  @Roles("establishment", "admin")
  @UseGuards(EstablishmentOwnershipGuard)
  @OwnershipParam({ param: "establishment_id" })
  @ApiOperation({
    summary: "Marcar indicação como vista ou arquivá-la",
    description:
      "Estado da caixa de entrada. O fã não o altera — ele indica e sai de cena.",
  })
  @ApiParam({ name: "establishment_id", required: true, format: "uuid" })
  @ApiParam({ name: "indication_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: IndicationPresenter })
  @ApiResponse({
    status: 404,
    description:
      "Indicação inexistente OU de outro estabelecimento — 404, não 403: dizer 'existe mas não é sua' já confirma a existência.",
  })
  async updateStatus(
    @Param("establishment_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    establishmentId: string,
    @Param("indication_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    indicationId: string,
    @Body() dto: UpdateIndicationStatusDto,
  ) {
    const output = await this.updateStatusUseCase.execute({
      indication_id: indicationId,
      establishment_id: establishmentId,
      status: dto.status,
    });
    return new IndicationPresenter(output);
  }
}
