import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Inject,
  ParseUUIDPipe,
  HttpCode,
  Query,
  UseGuards,
} from "@nestjs/common";
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
import { AuthGuard } from "../auth-module/auth.guard";

@UseGuards(AuthGuard)
@Controller("musicians")
export class MusicianController {
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
  async create(@Body() createMusicianDto: CreateMusicianDto) {
    const output = await this.createUseCase.execute(createMusicianDto);
    return MusicianController.serialize(output);
  }

  @Get()
  async search(@Query() searchParamsDto: SearchMusiciansDto) {
    const output = await this.listUseCase.execute(searchParamsDto);
    return new MusicianCollectionPresenter(output);
  }

  @Get(":id")
  async findOne(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    const output = await this.getUseCase.execute({ id });
    return MusicianController.serialize(output);
  }

  @Patch(":id")
  async update(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() updateMusicianDto: UpdateMusicianDto,
  ) {
    const output = await this.updateUseCase.execute({
      ...updateMusicianDto,
      id,
    });
    return MusicianController.serialize(output);
  }

  @HttpCode(204)
  @Delete(":id")
  remove(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    return this.deleteUseCase.execute({ id });
  }

  static serialize(output: MusicianOutput) {
    return new MusicianPresenter(output);
  }
}
