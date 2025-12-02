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
import { CreateEstablishmentDto } from "./dto/create-establishment.dto";
import { UpdateEstablishmentDto } from "./dto/update-establishment.dto";
import { CreateEstablishmentUseCase } from "../../core/establishment/application/use-cases/create-establishment/create-establishment.use-case";
import { UpdateEstablishmentUseCase } from "../../core/establishment/application/use-cases/update-establishment/update-establishment.use-case";
import { DeleteEstablishmentUseCase } from "../../core/establishment/application/use-cases/delete-establishment/delete-establishment.use-case";
import { GetEstablishmentUseCase } from "../../core/establishment/application/use-cases/get-establishment/get-establishment.use-case";
import { ListEstablishmentsUseCase } from "../../core/establishment/application/use-cases/list-establishments/list-establishments.use-case";
import {
  EstablishmentCollectionPresenter,
  EstablishmentPresenter,
} from "./establishment.presenter";
import { EstablishmentOutput } from "../../core/establishment/application/use-cases/common/establishment-output";
import { SearchEstablishmentsDto } from "./dto/search-establishments.dto";
import { AuthGuard } from "../auth-module/auth.guard";

@UseGuards(AuthGuard)
@Controller("establishments")
export class EstablishmentController {
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

  @Post()
  async create(@Body() createEstablishmentDto: CreateEstablishmentDto) {
    const output = await this.createUseCase.execute(createEstablishmentDto);
    return EstablishmentController.serialize(output);
  }

  @Get()
  async search(@Query() searchParamsDto: SearchEstablishmentsDto) {
    const output = await this.listUseCase.execute(searchParamsDto);
    return new EstablishmentCollectionPresenter(output);
  }

  @Get(":id")
  async findOne(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    const output = await this.getUseCase.execute({ id });
    return EstablishmentController.serialize(output);
  }

  @Patch(":id")
  async update(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() updateEstablishmentDto: UpdateEstablishmentDto,
  ) {
    const output = await this.updateUseCase.execute({
      ...updateEstablishmentDto,
      id,
    });
    return EstablishmentController.serialize(output);
  }

  @HttpCode(204)
  @Delete(":id")
  remove(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    return this.deleteUseCase.execute({ id });
  }

  static serialize(output: EstablishmentOutput) {
    return new EstablishmentPresenter(output);
  }

  static establishmentToResponse(output: EstablishmentOutput) {
    return new EstablishmentPresenter(output);
  }
}
