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
} from "@nestjs/common";
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";

import { AddBandMemberUseCase } from "../../core/musician/application/use-cases/add-band-member/add-band-member.use-case";
import { BandOutput } from "../../core/musician/application/use-cases/common/band-output";
import { CreateBandUseCase } from "../../core/musician/application/use-cases/create-band/create-band.use-case";
import { GetBandUseCase } from "../../core/musician/application/use-cases/get-band/get-band.use-case";
import { RemoveBandMemberUseCase } from "../../core/musician/application/use-cases/remove-band-member/remove-band-member.use-case";
import { BandPresenter } from "./band.presenter";
import { AddBandMemberDto } from "./dto/add-band-member.dto";
import { CreateBandDto } from "./dto/create-band.dto";
import { RemoveBandMemberDto } from "./dto/remove-band-member.dto";

@ApiTags("Bands")
@Controller("bands")
export class BandsController {
  @Inject(CreateBandUseCase)
  private createBandUseCase: CreateBandUseCase;

  @Inject(GetBandUseCase)
  private getBandUseCase: GetBandUseCase;

  @Inject(AddBandMemberUseCase)
  private addBandMemberUseCase: AddBandMemberUseCase;

  @Inject(RemoveBandMemberUseCase)
  private removeBandMemberUseCase: RemoveBandMemberUseCase;

  @Post()
  @ApiOperation({
    summary: "Criar banda",
    description: "Cria uma banda com gêneros e membros opcionais.",
  })
  @ApiResponse({ status: 201, type: BandPresenter })
  async create(@Body() dto: CreateBandDto) {
    const output = await this.createBandUseCase.execute(dto as any);
    return BandsController.serialize(output);
  }

  @Get(":id")
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

  @Post(":id/members")
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
    const input = {
      ...(dto as any),
      band_id,
    };
    const output = await this.addBandMemberUseCase.execute(input);
    return BandsController.serialize(output);
  }

  @HttpCode(204)
  @Delete(":id/members/:musicianId")
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
