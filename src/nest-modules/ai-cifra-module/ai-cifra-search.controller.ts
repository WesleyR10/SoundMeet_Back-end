import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UnprocessableEntityException,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import { SearchAiCifraCatalogUseCase } from "../../core/ai-cifra/application/use-cases/search-ai-cifra-catalog/search-ai-cifra-catalog.use-case";
import { MusifyPipedCatalogClient } from "../../core/ai-cifra/infra/audio-sources/musify-piped.catalog-client";
import { AuthGuard, Roles, RolesGuard } from "../auth-module";
import { SearchAiCifraCatalogResultPresenter } from "./ai-cifra.presenter";
import { SearchAiCifraCatalogDto } from "./dto/search-ai-cifra-catalog.dto";

// Mesmo padrão de construção ad-hoc do MusifyPipedCatalogClient já usado em
// AiCifraUploadsController.preloadFromMusifyCatalog — sem provider de DI para
// esse client, configurado só via env por request (não há estado a reter).
@ApiTags("AI Cifra")
@ApiBearerAuth("JWT-auth")
@UseGuards(AuthGuard, RolesGuard)
@Roles("musician", "admin")
@Controller("musicians/:musician_id/ai-cifra")
export class AiCifraSearchController {
  @Get("search")
  @Throttle({ default: { ttl: 10000, limit: 15 } })
  @ApiOperation({
    summary: "Buscar cifra por título/artista",
    description:
      "Busca candidatos (título, artista, youtube_video_id) via Piped/Musify a partir de texto livre. Não cria nada na MusicLibrary — é só descoberta, usado pra alimentar POST /music-library/items + POST .../ai-cifra/uploads/from-provider/analyses em seguida.",
  })
  @ApiParam({ name: "musician_id", required: true, format: "uuid" })
  @ApiQuery({ name: "query", required: true, type: String })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({ status: 200, type: [SearchAiCifraCatalogResultPresenter] })
  async search(
    @Param("musician_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    _musician_id: string,
    @Query() dto: SearchAiCifraCatalogDto,
  ) {
    const baseURL = process.env.AI_CIFRA_MUSIFY_PIPED_BASE_URL ?? null;
    if (!baseURL) {
      throw new UnprocessableEntityException(
        "AI_CIFRA_MUSIFY_PIPED_BASE_URL não configurado",
      );
    }
    const timeoutMs = Number(
      process.env.AI_CIFRA_MUSIFY_PIPED_TIMEOUT_MS ?? 10_000,
    );
    const client = MusifyPipedCatalogClient.create({
      baseURL,
      timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 10_000,
    });

    const useCase = new SearchAiCifraCatalogUseCase(client);
    const items = await useCase.execute({ query: dto.query, limit: dto.limit });
    return items.map((item) => new SearchAiCifraCatalogResultPresenter(item));
  }
}
