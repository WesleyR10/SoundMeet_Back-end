import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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

import { EndPerformanceUseCase } from "../../core/performance/application/use-cases/end-performance/end-performance.use-case";
import { GetPerformanceUseCase } from "../../core/performance/application/use-cases/get-performance/get-performance.use-case";
import { GetPerformanceReportUseCase } from "../../core/performance/application/use-cases/get-performance-report/get-performance-report.use-case";
import { ListOpenableEventsUseCase } from "../../core/performance/application/use-cases/list-openable-events/list-openable-events.use-case";
import { ListPerformancesUseCase } from "../../core/performance/application/use-cases/list-performances/list-performances.use-case";
import { StartPerformanceUseCase } from "../../core/performance/application/use-cases/start-performance/start-performance.use-case";
import { StartSongUseCase } from "../../core/performance/application/use-cases/start-song/start-song.use-case";
import {
  AuthenticatedUser,
  AuthGuard,
  CurrentUser,
  CurrentUserContextGuard,
  Roles,
  RolesGuard,
} from "../auth-module";
import {
  ListPerformancesQueryDto,
  StartPerformanceDto,
  StartSongDto,
} from "./dto/performance.dto";
import {
  PerformancePresenter,
  PerformanceReportPresenter,
} from "./performance.presenter";

/**
 * Apresentação ao vivo — o lado do MÚSICO.
 *
 * Ver `Docs/performance/live-performance.md`.
 *
 * ## `:performance_id`, nunca `:id`
 *
 * `MusicianOwnershipGuard` resolve o dono por `["musician_id","musicianId",
 * "id"]` do path. Um `:id` de sub-recurso colidiria e daria 403 no dono
 * legítimo — armadilha já registrada a partir de `personal-chord-sheet`.
 *
 * ## A posse é checada no use-case, não por guard
 *
 * Não há `musician_id` na URL para o guard resolver. Cada use-case carrega a
 * `Performance` e compara `musician_id` com o `sub` do token — o padrão que a
 * auditoria de 21/ago apontou como mais robusto em `ai-audio.controller.ts`,
 * porque elimina a classe de bug em vez de desviar dela.
 *
 * ## A rota do fã mora em outro controller
 *
 * `LivePerformanceController` atende `audience`. Misturar os dois papéis numa
 * classe é como um `@Public()` solto entre rotas autenticadas: funciona até
 * alguém adicionar a próxima rota no lugar errado.
 */
@ApiTags("Performances")
@ApiBearerAuth("JWT-auth")
@UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
@Controller("performances")
export class PerformanceController {
  @Inject(StartPerformanceUseCase)
  private startPerformanceUseCase: StartPerformanceUseCase;

  @Inject(StartSongUseCase)
  private startSongUseCase: StartSongUseCase;

  @Inject(EndPerformanceUseCase)
  private endPerformanceUseCase: EndPerformanceUseCase;

  @Inject(GetPerformanceUseCase)
  private getPerformanceUseCase: GetPerformanceUseCase;

  @Inject(ListPerformancesUseCase)
  private listPerformancesUseCase: ListPerformancesUseCase;

  @Inject(GetPerformanceReportUseCase)
  private getReportUseCase: GetPerformanceReportUseCase;

  @Inject(ListOpenableEventsUseCase)
  private listOpenableEventsUseCase: ListOpenableEventsUseCase;

  @Post()
  @Roles("musician", "admin")
  @ApiOperation({
    summary: "Abrir o set — começar a transmitir o show",
    description:
      "É o interruptor: sem set aberto o Play Mode continua privado e nada do que o músico toca vira histórico ou chega ao público. Idempotente — reabrir devolve o set que já está no ar.",
  })
  @ApiResponse({ status: 201, type: PerformancePresenter })
  @ApiResponse({ status: 403, description: "Não escalado para este evento." })
  async start(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StartPerformanceDto,
  ) {
    return new PerformancePresenter(
      await this.startPerformanceUseCase.execute({
        event_id: dto.event_id,
        // Do token, nunca do corpo: aceitar `musician_id` do cliente deixaria
        // qualquer músico abrir set em nome de outro.
        musician_id: user.userId,
        band_id: dto.band_id ?? null,
      }),
    );
  }

  @Get()
  @Roles("musician", "admin")
  @ApiOperation({
    summary: "Histórico de shows do músico autenticado",
    description:
      "Escopado pelo token. Não existe listagem sem dono — seria um dump dos sets de todos os músicos.",
  })
  @ApiResponse({ status: 200 })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPerformancesQueryDto,
  ) {
    const output = await this.listPerformancesUseCase.execute({
      musician_id: user.userId,
      establishment_id: query.establishment_id ?? null,
      status: query.status ?? null,
      page: query.page,
      per_page: query.per_page,
    });

    return {
      ...output,
      items: output.items.map((item) => new PerformancePresenter(item)),
    };
  }

  // ⚠️ ROTA LITERAL — tem de vir ANTES de `@Get(":performance_id")`. Invertida,
  // `openable-events` casaria como id, o ParseUUIDPipe responderia 422 e o
  // músico nunca conseguiria escolher em qual show abrir o set.
  @Get("openable-events")
  @Roles("musician", "admin")
  @ApiOperation({
    summary: "Em quais shows posso abrir um set agora",
    description:
      "Eventos onde o músico (ou uma banda dele) está escalado, dentro de uma janela de 6h antes/depois. Já traz `live_performance_id` quando existe set aberto, para o app reabrir em vez de oferecer 'iniciar'. Cancelados e encerrados não aparecem: oferecer um botão que a escrita vai recusar é pior que não oferecer.",
  })
  @ApiResponse({ status: 200 })
  async openableEvents(@CurrentUser() user: AuthenticatedUser) {
    return this.listOpenableEventsUseCase.execute({
      musician_id: user.userId,
      band_ids: user.bandIds,
    });
  }

  // ⚠️ Esta rota vem DEPOIS de `@Get()` e ANTES de qualquer `@Post` aninhado.
  // A rota `live` do fã, que colidiria com `:performance_id`, mora no outro
  // controller — e lá está declarada antes de qualquer rota paramétrica.
  @Get(":performance_id")
  @Roles("musician", "admin")
  @ApiOperation({
    summary: "Ler o set completo (só o dono)",
  })
  @ApiParam({ name: "performance_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: PerformancePresenter })
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param("performance_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    performanceId: string,
  ) {
    return new PerformancePresenter(
      await this.getPerformanceUseCase.execute({
        performance_id: performanceId,
        requesting_musician_id: user.userId,
      }),
    );
  }

  @Get(":performance_id/report")
  @Roles("musician", "admin")
  @ApiOperation({
    summary: "Relatório pós-show",
    description:
      "Músicas tocadas, pedidos, gorjetas e público. Disponível só depois de encerrar o set — relatório de show em andamento é um número que muda enquanto se olha.",
  })
  @ApiParam({ name: "performance_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: PerformanceReportPresenter })
  @ApiResponse({ status: 403, description: "Set ainda aberto, ou não é seu." })
  async report(
    @CurrentUser() user: AuthenticatedUser,
    @Param("performance_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    performanceId: string,
  ) {
    return new PerformanceReportPresenter(
      await this.getReportUseCase.execute({
        performance_id: performanceId,
        requesting_musician_id: user.userId,
      }),
    );
  }

  @Post(":performance_id/songs")
  @Roles("musician", "admin")
  @ApiOperation({
    summary: "Começar uma música",
    description:
      "Fecha automaticamente a anterior — duas músicas 'agora' seriam duas respostas para o público. Aceita música da biblioteca, pedido do público ou título+artista livres, nessa ordem de precedência.",
  })
  @ApiParam({ name: "performance_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: PerformancePresenter })
  @HttpCode(HttpStatus.OK)
  async startSong(
    @CurrentUser() user: AuthenticatedUser,
    @Param("performance_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    performanceId: string,
    @Body() dto: StartSongDto,
  ) {
    return new PerformancePresenter(
      await this.startSongUseCase.execute({
        performance_id: performanceId,
        requesting_musician_id: user.userId,
        music_library_id: dto.music_library_id ?? null,
        request_id: dto.request_id ?? null,
        title: dto.title ?? null,
        artist: dto.artist ?? null,
      }),
    );
  }

  @Patch(":performance_id/end")
  @Roles("musician", "admin")
  @ApiOperation({
    summary: "Encerrar o set",
    description:
      "Fecha a última música e libera o relatório. Idempotente: encerrar duas vezes devolve o mesmo estado — é o caso normal de um botão tocado com rede ruim.",
  })
  @ApiParam({ name: "performance_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: PerformancePresenter })
  @HttpCode(HttpStatus.OK)
  async end(
    @CurrentUser() user: AuthenticatedUser,
    @Param("performance_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    performanceId: string,
  ) {
    return new PerformancePresenter(
      await this.endPerformanceUseCase.execute({
        performance_id: performanceId,
        requesting_musician_id: user.userId,
      }),
    );
  }
}
