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

import { CreateMusicLibraryUseCase } from "../../core/music-library/application/use-cases/create-music-library/create-music-library.use-case";
import { DeleteMusicLibraryUseCase } from "../../core/music-library/application/use-cases/delete-music-library/delete-music-library.use-case";
import { GetMusicLibraryUseCase } from "../../core/music-library/application/use-cases/get-music-library/get-music-library.use-case";
import { ListMusicLibraryUseCase } from "../../core/music-library/application/use-cases/list-music-library/list-music-library.use-case";
import { UpdateMusicLibraryUseCase } from "../../core/music-library/application/use-cases/update-music-library/update-music-library.use-case";
import { AuthGuard, Roles, RolesGuard } from "../auth-module";
import { CreateMusicLibraryDto } from "./dto/create-music-library.dto";
import { SearchMusicLibraryDto } from "./dto/search-music-library.dto";
import { UpdateMusicLibraryDto } from "./dto/update-music-library.dto";
import {
  MusicLibraryCollectionPresenter,
  MusicLibraryPresenter,
} from "./music-library.presenter";

@ApiTags("Music Library")
@ApiBearerAuth("JWT-auth")
@UseGuards(AuthGuard, RolesGuard)
@Roles("musician", "admin")
@Controller("music-library/items")
export class MusicLibraryController {
  @Inject(CreateMusicLibraryUseCase)
  private createUseCase: CreateMusicLibraryUseCase;

  @Inject(GetMusicLibraryUseCase)
  private getUseCase: GetMusicLibraryUseCase;

  @Inject(ListMusicLibraryUseCase)
  private listUseCase: ListMusicLibraryUseCase;

  @Inject(UpdateMusicLibraryUseCase)
  private updateUseCase: UpdateMusicLibraryUseCase;

  @Inject(DeleteMusicLibraryUseCase)
  private deleteUseCase: DeleteMusicLibraryUseCase;

  @Post()
  @ApiOperation({
    summary: "Criar item na biblioteca musical",
    description:
      "Cria um item canônico da MusicLibrary para o músico, usado por cifras, LRC e catálogo.",
  })
  @ApiResponse({ status: 201, type: MusicLibraryPresenter })
  async create(@Body() dto: CreateMusicLibraryDto) {
    const output = await this.createUseCase.execute(dto);
    return new MusicLibraryPresenter(output);
  }

  @Get()
  @ApiOperation({
    summary: "Listar biblioteca musical",
    description: "Lista itens da MusicLibrary com paginação e filtros.",
  })
  @ApiResponse({ status: 200, type: MusicLibraryCollectionPresenter })
  async findAll(@Query() query: SearchMusicLibraryDto) {
    const output = await this.listUseCase.execute({
      page: query.page,
      per_page: query.per_page,
      sort: query.sort,
      sort_dir: query.sort_dir,
      filter: {
        musician_id: query.musician_id,
        title: query.title,
        artist: query.artist,
        genre: query.genre,
        key: query.key,
        source: query.source,
        is_favorite: query.is_favorite,
      },
    });
    return new MusicLibraryCollectionPresenter(output);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Buscar item da biblioteca musical",
    description: "Retorna um item da MusicLibrary pelo ID.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: MusicLibraryPresenter })
  async findOne(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    const output = await this.getUseCase.execute({ id });
    return new MusicLibraryPresenter(output);
  }

  @Patch(":id")
  @ApiOperation({
    summary: "Atualizar item da biblioteca musical",
    description:
      "Atualiza metadados, fonte e artefatos de um item da MusicLibrary.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: MusicLibraryPresenter })
  async update(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: UpdateMusicLibraryDto,
  ) {
    const output = await this.updateUseCase.execute({ id, ...dto });
    return new MusicLibraryPresenter(output);
  }

  @HttpCode(204)
  @Delete(":id")
  @ApiOperation({
    summary: "Remover item da biblioteca musical",
    description: "Remove um item da MusicLibrary.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 204 })
  async remove(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    await this.deleteUseCase.execute({ id });
  }
}
