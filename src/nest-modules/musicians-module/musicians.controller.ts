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
  async create(@Body() createMusicianDto: CreateMusicianDto) {
    const output = await this.createUseCase.execute(createMusicianDto as any);
    return MusiciansController.serialize(output);
  }

  @Get()
  async findAll(@Query() query: SearchMusiciansDto) {
    const output = await this.listUseCase.execute(query);
    return new MusicianCollectionPresenter(output);
  }

  @Get(":id")
  async findOne(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    const output = await this.getUseCase.execute({ id });
    return MusiciansController.serialize(output);
  }

  @Patch(":id")
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
  async remove(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    await this.deleteUseCase.execute({ id });
  }

  static serialize(output: MusicianOutput) {
    return new MusicianPresenter(output);
  }
}
