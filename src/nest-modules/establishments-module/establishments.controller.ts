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
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";

import {
  EstablishmentOutput,
  EstablishmentProfileOutput,
} from "../../core/establishment/application/use-cases/common/establishment-output";
import { CreateEstablishmentUseCase } from "../../core/establishment/application/use-cases/create-establishment/create-establishment.use-case";
import { CreateEstablishmentProfileUseCase } from "../../core/establishment/application/use-cases/create-establishment-profile/create-establishment-profile.use-case";
import { DeleteEstablishmentUseCase } from "../../core/establishment/application/use-cases/delete-establishment/delete-establishment.use-case";
import { DeleteEstablishmentProfileUseCase } from "../../core/establishment/application/use-cases/delete-establishment-profile/delete-establishment-profile.use-case";
import { GetEstablishmentUseCase } from "../../core/establishment/application/use-cases/get-establishment/get-establishment.use-case";
import { GetHiringDashboardUseCase } from "../../core/establishment/application/use-cases/get-hiring-dashboard/get-hiring-dashboard.use-case";
import { ListEstablishmentAnalyticsUseCase } from "../../core/establishment/application/use-cases/list-establishment-analytics/list-establishment-analytics.use-case";
import { ListEstablishmentsUseCase } from "../../core/establishment/application/use-cases/list-establishments/list-establishments.use-case";
import { UpdateEstablishmentUseCase } from "../../core/establishment/application/use-cases/update-establishment/update-establishment.use-case";
import { UpdateEstablishmentProfileUseCase } from "../../core/establishment/application/use-cases/update-establishment-profile/update-establishment-profile.use-case";
import { CreateEstablishmentDto } from "./dto/create-establishment.dto";
import { CreateEstablishmentProfileDto } from "./dto/create-establishment-profile.dto";
import { GetHiringDashboardDto } from "./dto/get-hiring-dashboard.dto";
import { SearchEstablishmentAnalyticsDto } from "./dto/search-establishment-analytics.dto";
import { SearchEstablishmentsDto } from "./dto/search-establishments.dto";
import { UpdateEstablishmentDto } from "./dto/update-establishment.dto";
import { UpdateEstablishmentProfileDto } from "./dto/update-establishment-profile.dto";
import {
  EstablishmentCollectionPresenter,
  EstablishmentPresenter,
  EstablishmentProfilePresenter,
} from "./establishment.presenter";
import { EstablishmentAnalyticsCollectionPresenter } from "./establishment-analytics.presenter";
import { HiringDashboardPresenter } from "./hiring-dashboard.presenter";

@ApiTags("Establishments")
@Controller("establishments")
export class EstablishmentsController {
  @Inject(CreateEstablishmentUseCase)
  private createUseCase: CreateEstablishmentUseCase;

  @Inject(UpdateEstablishmentUseCase)
  private updateUseCase: UpdateEstablishmentUseCase;

  @Inject(DeleteEstablishmentUseCase)
  private deleteUseCase: DeleteEstablishmentUseCase;

  @Inject(GetEstablishmentUseCase)
  private getUseCase: GetEstablishmentUseCase;

  @Inject(ListEstablishmentsUseCase)
  private listUseCase: ListEstablishmentsUseCase;

  @Inject(CreateEstablishmentProfileUseCase)
  private createProfileUseCase: CreateEstablishmentProfileUseCase;

  @Inject(UpdateEstablishmentProfileUseCase)
  private updateProfileUseCase: UpdateEstablishmentProfileUseCase;

  @Inject(DeleteEstablishmentProfileUseCase)
  private deleteProfileUseCase: DeleteEstablishmentProfileUseCase;

  @Inject(GetHiringDashboardUseCase)
  private getHiringDashboardUseCase: GetHiringDashboardUseCase;

  @Inject(ListEstablishmentAnalyticsUseCase)
  private listAnalyticsUseCase: ListEstablishmentAnalyticsUseCase;

  @Post()
  @ApiOperation({
    summary: "Criar estabelecimento",
    description: "Cria um estabelecimento e gera QR Code permanente.",
  })
  @ApiResponse({ status: 201, type: EstablishmentPresenter })
  async create(@Body() dto: CreateEstablishmentDto) {
    const output = await this.createUseCase.execute(dto);
    return EstablishmentsController.serialize(output);
  }

  @Get()
  @ApiOperation({
    summary: "Listar estabelecimentos",
    description: "Lista estabelecimentos com paginação, ordenação e filtros.",
  })
  @ApiResponse({ status: 200, type: EstablishmentCollectionPresenter })
  async findAll(@Query() query: SearchEstablishmentsDto) {
    const output = await this.listUseCase.execute(query);
    return new EstablishmentCollectionPresenter(output);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Buscar estabelecimento por ID",
    description: "Retorna os detalhes do estabelecimento.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: EstablishmentPresenter })
  async findOne(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    const output = await this.getUseCase.execute({ id });
    return EstablishmentsController.serialize(output);
  }

  @Patch(":id")
  @ApiOperation({
    summary: "Atualizar estabelecimento",
    description: "Atualiza dados do estabelecimento.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: EstablishmentPresenter })
  async update(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: UpdateEstablishmentDto,
  ) {
    const output = await this.updateUseCase.execute({ ...dto, id });
    return EstablishmentsController.serialize(output);
  }

  @Post(":id/profile")
  @ApiOperation({
    summary: "Criar perfil do estabelecimento",
    description:
      "Cria dados do EstablishmentProfile (capacidade, localização, preço, links sociais).",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 201, type: EstablishmentProfilePresenter })
  async createProfile(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: CreateEstablishmentProfileDto,
  ) {
    const output = await this.createProfileUseCase.execute({ ...dto, id });
    return EstablishmentsController.serializeProfile(output);
  }

  @Patch(":id/profile")
  @ApiOperation({
    summary: "Atualizar perfil do estabelecimento",
    description:
      "Atualiza dados do EstablishmentProfile (capacidade, localização, preço, links sociais).",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: EstablishmentProfilePresenter })
  async updateProfile(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: UpdateEstablishmentProfileDto,
  ) {
    const output = await this.updateProfileUseCase.execute({ ...dto, id });
    return EstablishmentsController.serializeProfile(output);
  }

  @HttpCode(204)
  @Delete(":id/profile")
  @ApiOperation({
    summary: "Remover perfil do estabelecimento",
    description: "Remove o EstablishmentProfile.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 204 })
  async removeProfile(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    await this.deleteProfileUseCase.execute({ id });
  }

  @HttpCode(204)
  @Delete(":id")
  @ApiOperation({
    summary: "Remover estabelecimento",
    description: "Remove o estabelecimento.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 204 })
  async remove(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    await this.deleteUseCase.execute({ id });
  }

  @Get(":id/hiring-dashboard")
  @ApiOperation({
    summary: "Dashboard de Contratação",
    description:
      "Retorna dados agregados para contratação de músicos e bandas.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: HiringDashboardPresenter })
  async getHiringDashboard(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Query() query: GetHiringDashboardDto,
  ) {
    const output = await this.getHiringDashboardUseCase.execute({
      establishment_id: id,
      ...(query as any),
    });
    return new HiringDashboardPresenter(output);
  }

  @Get(":id/analytics")
  @ApiOperation({
    summary: "Consultar analytics do estabelecimento",
    description:
      "Lista métricas diárias do estabelecimento em um período (pré-agregadas).",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: EstablishmentAnalyticsCollectionPresenter })
  async listAnalytics(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Query() query: SearchEstablishmentAnalyticsDto,
  ) {
    const output = await this.listAnalyticsUseCase.execute({
      page: query.page,
      per_page: query.per_page,
      sort: query.sort,
      sort_dir: query.sort_dir,
      filter: {
        establishment_id: id,
        ...(query.date_gte && { date_gte: query.date_gte }),
        ...(query.date_lte && { date_lte: query.date_lte }),
      },
    });

    return new EstablishmentAnalyticsCollectionPresenter(output);
  }

  static serialize(output: EstablishmentOutput) {
    return new EstablishmentPresenter(output);
  }

  static serializeProfile(output: EstablishmentProfileOutput) {
    return new EstablishmentProfilePresenter(output);
  }
}
