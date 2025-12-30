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
import { CreateMusicianDto } from "./dto/create-musician.dto";
import { UpdateMusicianDto } from "./dto/update-musician.dto";
import { CreateMusicianUseCase } from "../../core/musician/application/use-cases/create-musician/create-musician.use-case";
import { UpdateMusicianUseCase } from "../../core/musician/application/use-cases/update-musician/update-musician.use-case";
import { DeleteMusicianUseCase } from "../../core/musician/application/use-cases/delete-musician/delete-musician.use-case";
import { GetMusicianUseCase } from "../../core/musician/application/use-cases/get-musician/get-musician.use-case";
import { ListMusiciansUseCase } from "../../core/musician/application/use-cases/list-musicians/list-musicians.use-case";
import {
  MusicianCollectionPresenter,
  MusicianPresenter,
} from "./musician.presenter";
import { MusicianOutput } from "../../core/musician/application/use-cases/common/musician-output";
import { SearchMusiciansDto } from "./dto/search-musicians.dto";

@ApiTags("Musicians")
@Controller("musicians")
export class MusiciansController {
  @Inject(CreateMusicianUseCase)
  private createUseCase: CreateMusicianUseCase;

  @Inject(UpdateMusicianUseCase)
  private updateUseCase: UpdateMusicianUseCase;

  @Inject(DeleteMusicianUseCase)
  private deleteUseCase: DeleteMusicianUseCase;

  @Inject(GetMusicianUseCase)
  private getUseCase: GetMusicianUseCase;

  @Inject(ListMusiciansUseCase)
  private listUseCase: ListMusiciansUseCase;

  @Post()
  @ApiOperation({
    summary: "Criar músico",
    description: "Cria um perfil de músico e gera QR Code permanente.",
  })
  @ApiResponse({ status: 201, type: MusicianPresenter })
  async create(@Body() createMusicianDto: CreateMusicianDto) {
    const output = await this.createUseCase.execute(createMusicianDto as any);
    return MusiciansController.serialize(output);
  }

  @Get()
  @ApiOperation({
    summary: "Listar músicos",
    description: "Lista músicos com paginação, ordenação e filtros.",
  })
  @ApiResponse({ status: 200, type: MusicianCollectionPresenter })
  async findAll(@Query() query: SearchMusiciansDto) {
    const output = await this.listUseCase.execute(query);
    return new MusicianCollectionPresenter(output);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Buscar músico por ID",
    description: "Retorna os detalhes do perfil do músico.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: MusicianPresenter })
  async findOne(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    const output = await this.getUseCase.execute({ id });
    return MusiciansController.serialize(output);
  }

  @Patch(":id")
  @ApiOperation({
    summary: "Atualizar músico",
    description: "Atualiza dados do perfil do músico.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: MusicianPresenter })
  async update(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() updateMusicianDto: UpdateMusicianDto,
  ) {
    const output = await this.updateUseCase.execute({
      ...(updateMusicianDto as any),
      id,
    });
    return MusiciansController.serialize(output);
  }

  @HttpCode(204)
  @Delete(":id")
  @ApiOperation({
    summary: "Remover músico",
    description: "Remove o perfil do músico.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 204 })
  async remove(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    await this.deleteUseCase.execute({ id });
  }

  static serialize(output: MusicianOutput) {
    return new MusicianPresenter(output);
  }
}
