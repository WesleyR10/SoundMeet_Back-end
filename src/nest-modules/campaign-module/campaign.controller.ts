import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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

import { CreateCampaignUseCase } from "../../core/campaign/application/use-cases/create-campaign/create-campaign.use-case";
import { GetCampaignUseCase } from "../../core/campaign/application/use-cases/get-campaign/get-campaign.use-case";
import { ListCampaignsUseCase } from "../../core/campaign/application/use-cases/list-campaigns/list-campaigns.use-case";
import { DeleteCampaignUseCase } from "../../core/campaign/application/use-cases/delete-campaign/delete-campaign.use-case";
import { CampaignOutput } from "../../core/campaign/application/use-cases/common/campaign-output";
import {
  AuthGuard,
  CurrentUser,
  CurrentUserContextGuard,
  EstablishmentOwnershipGuard,
  Roles,
  RolesGuard,
} from "../auth-module";
import { AuthenticatedUser } from "../auth-module";
import { CreateCampaignDto } from "./dto/create-campaign.dto";
import { SearchCampaignsDto } from "./dto/search-campaigns.dto";
import {
  CampaignCollectionPresenter,
  CampaignPresenter,
} from "./campaign.presenter";

@ApiTags("Campaigns")
@ApiBearerAuth("JWT-auth")
@UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
@Controller("campaigns")
export class CampaignController {
  @Inject(CreateCampaignUseCase)
  private createUseCase: CreateCampaignUseCase;

  @Inject(GetCampaignUseCase)
  private getUseCase: GetCampaignUseCase;

  @Inject(ListCampaignsUseCase)
  private listUseCase: ListCampaignsUseCase;

  @Inject(DeleteCampaignUseCase)
  private deleteUseCase: DeleteCampaignUseCase;

  @Post()
  @Roles("establishment", "admin")
  @UseGuards(EstablishmentOwnershipGuard)
  @ApiOperation({
    summary: "Criar campanha promocional (GROWTH/PRO)",
    description:
      "Cria uma campanha promocional para o estabelecimento. Requer plano GROWTH ou PRO.",
  })
  @ApiResponse({ status: 201, type: CampaignPresenter })
  async create(
    @Body() dto: CreateCampaignDto,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    const output = await this.createUseCase.execute({
      establishment_id: dto.establishment_id,
      title: dto.title,
      description: dto.description,
      start_date: new Date(dto.start_date),
      end_date: new Date(dto.end_date),
      target_genres: dto.target_genres,
    });
    return CampaignController.serialize(output);
  }

  @Get()
  @Roles("establishment", "admin")
  @ApiOperation({
    summary: "Listar campanhas",
    description: "Lista campanhas com paginação e filtros.",
  })
  @ApiResponse({ status: 200, type: CampaignCollectionPresenter })
  async findAll(
    @Query() query: SearchCampaignsDto,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    const output = await this.listUseCase.execute({
      ...query,
      requesting_establishment_id: currentUser?.establishmentIds?.[0],
      is_admin: currentUser?.roles.includes("admin"),
    });
    return new CampaignCollectionPresenter(output);
  }

  @Get(":id")
  @Roles("establishment", "admin")
  @ApiOperation({ summary: "Buscar campanha por ID" })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: CampaignPresenter })
  async findOne(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    const output = await this.getUseCase.execute({
      campaign_id: id,
      requesting_establishment_id: currentUser?.establishmentIds?.[0],
      is_admin: currentUser?.roles.includes("admin"),
    });
    return CampaignController.serialize(output);
  }

  @HttpCode(204)
  @Delete(":id")
  @Roles("establishment", "admin")
  @UseGuards(EstablishmentOwnershipGuard)
  @ApiOperation({ summary: "Remover campanha" })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 204 })
  async remove(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    const establishment_id =
      currentUser?.establishmentIds?.[0] ?? "";
    await this.deleteUseCase.execute({
      campaign_id: id,
      establishment_id,
    });
  }

  static serialize(output: CampaignOutput): CampaignPresenter {
    return new CampaignPresenter(output);
  }
}
