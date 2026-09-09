import {
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
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

import { GetMusicianResumeUseCase } from "../../core/performance/application/use-cases/get-musician-resume/get-musician-resume.use-case";
import { SuggestSetlistUseCase } from "../../core/performance/application/use-cases/suggest-setlist/suggest-setlist.use-case";
import {
  AuthGuard,
  CurrentUserContextGuard,
  MusicianOwnershipGuard,
  Roles,
  RolesGuard,
} from "../auth-module";
import { SuggestSetlistQueryDto } from "./dto/performance.dto";
import {
  MusicianResumePresenter,
  SetlistSuggestionsPresenter,
} from "./performance.presenter";

/**
 * Currículo verificado (F4) e setlist inteligente (F5), pendurados no músico.
 *
 * Aqui `:id` **é o próprio músico**, então o `MusicianOwnershipGuard` funciona
 * direto — diferente de `PerformanceController`, onde o path identifica um
 * sub-recurso e a posse tem de ser checada no use-case.
 *
 * As duas rotas têm audiências distintas de propósito:
 * - o **currículo** é vitrine e sai também para o fã;
 * - as **sugestões de setlist** são inteligência competitiva do músico sobre um
 *   local e saem só para ele.
 */
@ApiTags("Musicians")
@ApiBearerAuth("JWT-auth")
@UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
@Controller("musicians")
export class MusicianPerformanceController {
  @Inject(GetMusicianResumeUseCase)
  private resumeUseCase: GetMusicianResumeUseCase;

  @Inject(SuggestSetlistUseCase)
  private suggestSetlistUseCase: SuggestSetlistUseCase;

  @Get(":id/resume")
  @Roles("audience", "musician", "establishment", "admin")
  @ApiOperation({
    summary: "Currículo verificado do músico",
    description:
      "Derivado, nunca declarado: shows concluídos, check-ins, locais, público alcançado, avaliações e músicas executadas — cada número com prova no banco. O músico não escreve nada aqui; é isso que o separa da bio. Nenhum valor de cachê é exposto: é dado comercial entre as partes e o currículo é lido pelo público.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: MusicianResumePresenter })
  @ApiResponse({ status: 404, description: "Músico não encontrado." })
  async resume(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    return new MusicianResumePresenter(
      await this.resumeUseCase.execute({ musician_id: id }),
    );
  }

  @Get(":id/setlist-suggestions")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({
    summary: "Sugestões de setlist para um local",
    description:
      "Ranqueia por evidência DAQUELE estabelecimento — pedidos do público ali, o que já funcionou ali, e o que está no repertório e nunca foi tocado ali. Cada sugestão vem com a origem do sinal: sugestão sem evidência exibível é palpite, e o músico precisa poder discordar do motivo.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: SetlistSuggestionsPresenter })
  async setlistSuggestions(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Query() query: SuggestSetlistQueryDto,
  ) {
    return new SetlistSuggestionsPresenter(
      await this.suggestSetlistUseCase.execute({
        musician_id: id,
        establishment_id: query.establishment_id,
        limit: query.limit,
      }),
    );
  }
}
