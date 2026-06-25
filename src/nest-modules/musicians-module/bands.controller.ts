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
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { AddBandMemberInput } from "../../core/musician/application/use-cases/add-band-member/add-band-member.input";
import { AddBandMemberUseCase } from "../../core/musician/application/use-cases/add-band-member/add-band-member.use-case";
import { BandOutput } from "../../core/musician/application/use-cases/common/band-output";
import { CreateBandInput } from "../../core/musician/application/use-cases/create-band/create-band.input";
import { CreateBandUseCase } from "../../core/musician/application/use-cases/create-band/create-band.use-case";
import { DeleteBandUseCase } from "../../core/musician/application/use-cases/delete-band/delete-band.use-case";
import { GetBandUseCase } from "../../core/musician/application/use-cases/get-band/get-band.use-case";
import { ListBandsUseCase } from "../../core/musician/application/use-cases/list-bands/list-bands.use-case";
import { RemoveBandMemberUseCase } from "../../core/musician/application/use-cases/remove-band-member/remove-band-member.use-case";
import { UpdateBandInput } from "../../core/musician/application/use-cases/update-band/update-band.input";
import { UpdateBandUseCase } from "../../core/musician/application/use-cases/update-band/update-band.use-case";
import {
  AuthGuard,
  AuthenticatedUser,
  BandOwnershipGuard,
  CurrentUser,
  CurrentUserContextGuard,
  Public,
  Roles,
  RolesGuard,
} from "../auth-module";
import { BandCollectionPresenter, BandPresenter } from "./band.presenter";
import { AddBandMemberDto } from "./dto/add-band-member.dto";
import { CreateBandDto } from "./dto/create-band.dto";
import { RemoveBandMemberDto } from "./dto/remove-band-member.dto";
import { SearchBandsDto } from "./dto/search-bands.dto";
import { UpdateBandDto } from "./dto/update-band.dto";

@ApiTags("Bands")
@ApiBearerAuth("JWT-auth")
@UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
@Controller("bands")
export class BandsController {
  @Inject(CreateBandUseCase)
  private createBandUseCase: CreateBandUseCase;

  @Inject(UpdateBandUseCase)
  private updateBandUseCase: UpdateBandUseCase;

  @Inject(DeleteBandUseCase)
  private deleteBandUseCase: DeleteBandUseCase;

  @Inject(GetBandUseCase)
  private getBandUseCase: GetBandUseCase;

  @Inject(ListBandsUseCase)
  private listBandsUseCase: ListBandsUseCase;

  @Inject(AddBandMemberUseCase)
  private addBandMemberUseCase: AddBandMemberUseCase;

  @Inject(RemoveBandMemberUseCase)
  private removeBandMemberUseCase: RemoveBandMemberUseCase;

  @Post()
  @Roles("musician", "admin")
  @ApiOperation({
    summary: "Criar banda",
    description:
      "Cria uma banda. O músico autenticado é automaticamente adicionado como líder.",
  })
  @ApiResponse({ status: 201, type: BandPresenter })
  async create(
    @Body() dto: CreateBandDto,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    const output = await this.createBandUseCase.execute(
      new CreateBandInput({
        ...dto,
        creator_musician_id: currentUser?.userId,
      }),
    );
    return BandsController.serialize(output);
  }

  @Get()
  @Public()
  @ApiOperation({
    summary: "Listar bandas",
    description: "Lista bandas com paginação, ordenação e filtros.",
  })
  @ApiResponse({ status: 200, type: BandCollectionPresenter })
  async findAll(@Query() query: SearchBandsDto) {
    const output = await this.listBandsUseCase.execute(query);
    return new BandCollectionPresenter(output);
  }

  @Get(":id")
  @Public()
  @ApiOperation({
    summary: "Buscar banda por ID",
    description: "Retorna os detalhes da banda, incluindo membros.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: BandPresenter })
  async findOne(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    const output = await this.getBandUseCase.execute({ id });
    return BandsController.serialize(output);
  }

  @Patch(":id")
  @Roles("musician", "admin")
  @UseGuards(BandOwnershipGuard)
  @ApiOperation({
    summary: "Atualizar banda",
    description: "Atualiza dados da banda.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: BandPresenter })
  async update(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: UpdateBandDto,
  ) {
    const output = await this.updateBandUseCase.execute(
      new UpdateBandInput({
        id,
        name: dto.name,
        description: dto.description,
        avatar: dto.avatar,
        genres: dto.genres,
        priceRange: dto.priceRange,
        is_active: dto.is_active,
      }),
    );
    return BandsController.serialize(output);
  }

  @HttpCode(204)
  @Delete(":id")
  @Roles("musician", "admin")
  @UseGuards(BandOwnershipGuard)
  @ApiOperation({
    summary: "Excluir banda",
    description: "Exclui uma banda pelo ID.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 204 })
  async remove(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    await this.deleteBandUseCase.execute({ id });
  }

  @Post(":id/members")
  @Roles("musician", "admin")
  @UseGuards(BandOwnershipGuard)
  @ApiOperation({
    summary: "Adicionar membro na banda",
    description: "Adiciona um músico como membro de uma banda.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 201, type: BandPresenter })
  async addMember(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    band_id: string,
    @Body() dto: AddBandMemberDto,
  ) {
    const input = new AddBandMemberInput({
      band_id,
      musician_id: dto.musician_id,
      role: dto.role,
      instrument: dto.instrument,
    });
    const output = await this.addBandMemberUseCase.execute(input);
    return BandsController.serialize(output);
  }

  @HttpCode(204)
  @Delete(":id/members/:musicianId")
  @Roles("musician", "admin")
  @UseGuards(BandOwnershipGuard)
  @ApiOperation({
    summary: "Remover membro da banda",
    description: "Remove um músico de uma banda.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiParam({ name: "musicianId", required: true, format: "uuid" })
  @ApiResponse({ status: 204 })
  async removeMember(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    band_id: string,
    @Param("musicianId", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    musician_id: string,
  ) {
    const input: RemoveBandMemberDto = {
      band_id,
      musician_id,
    } as RemoveBandMemberDto;
    await this.removeBandMemberUseCase.execute(input);
  }

  static serialize(output: BandOutput) {
    return new BandPresenter(output);
  }
}
