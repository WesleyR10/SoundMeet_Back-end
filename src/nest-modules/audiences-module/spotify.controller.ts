import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { ConnectSpotifyUseCase } from "../../core/audience/application/use-cases/connect-spotify/connect-spotify.use-case";
import { DisconnectSpotifyUseCase } from "../../core/audience/application/use-cases/connect-spotify/disconnect-spotify.use-case";
import { GetSpotifyLinkStatusUseCase } from "../../core/audience/application/use-cases/connect-spotify/get-spotify-link-status.use-case";
import { FindSpotifyTrackUseCase } from "../../core/audience/application/use-cases/save-track-to-spotify/find-spotify-track.use-case";
import { SaveTrackToSpotifyUseCase } from "../../core/audience/application/use-cases/save-track-to-spotify/save-track-to-spotify.use-case";
import {
  AudienceOwnershipGuard,
  AuthGuard,
  CurrentUserContextGuard,
  Roles,
  RolesGuard,
} from "../auth-module";
import { FindSpotifyTrackDto, SaveSpotifyTrackDto } from "./dto/spotify.dto";
import {
  SpotifyAuthorizationPresenter,
  SpotifyLinkStatusPresenter,
  SpotifySaveResultPresenter,
  SpotifyTrackCandidatePresenter,
} from "./spotify.presenter";
import { SpotifyEnabledGuard } from "./spotify-enabled.guard";

/**
 * Ponte Spotify do FÃ — "gostei ao vivo, salva pra mim".
 *
 * ## Controller próprio
 *
 * `AudiencesController` já passa de 400 linhas e trata do perfil, pedidos,
 * votos e gorjetas. Vínculo com provedor externo é outro assunto, com outro
 * ciclo de vida — misturar ali só faria o arquivo crescer.
 *
 * ## `:id` é sempre o FÃ, nunca sub-recurso
 *
 * `AudienceOwnershipGuard` resolve o dono pelo param da rota; um `:id` que
 * pertencesse a outra coisa (uma faixa, um vínculo) colidiria e autorizaria
 * errado. Aqui todos os `:id` são o próprio fã, e a faixa viaja no CORPO —
 * armadilha já registrada no `CLAUDE.md` a partir de `personal-chord-sheet`.
 *
 * ## O callback mora em outro controller
 *
 * `SpotifyCallbackController` é `@Public()` e separado: um `@Public()` solto
 * numa classe com `@UseGuards` expõe rota autenticada sem querer.
 */
@ApiTags("Audiences")
@ApiBearerAuth("JWT-auth")
@UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard, SpotifyEnabledGuard)
@Controller("audiences")
export class SpotifyController {
  @Inject(ConnectSpotifyUseCase)
  private connectUseCase: ConnectSpotifyUseCase;

  @Inject(DisconnectSpotifyUseCase)
  private disconnectUseCase: DisconnectSpotifyUseCase;

  @Inject(GetSpotifyLinkStatusUseCase)
  private statusUseCase: GetSpotifyLinkStatusUseCase;

  @Inject(FindSpotifyTrackUseCase)
  private findTrackUseCase: FindSpotifyTrackUseCase;

  @Inject(SaveTrackToSpotifyUseCase)
  private saveTrackUseCase: SaveTrackToSpotifyUseCase;

  @Get(":id/spotify")
  @Roles("audience", "admin")
  @UseGuards(AudienceOwnershipGuard)
  @ApiOperation({
    summary: "Status do vínculo com o Spotify",
    description:
      "Diz apenas se existe vínculo e com qual conta. Nenhum token é exposto.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: SpotifyLinkStatusPresenter })
  async status(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    return new SpotifyLinkStatusPresenter(
      await this.statusUseCase.execute({ audience_id: id }),
    );
  }

  @Post(":id/spotify/connect")
  @Roles("audience", "admin")
  @UseGuards(AudienceOwnershipGuard)
  @ApiOperation({
    summary: "Iniciar vínculo com o Spotify",
    description:
      "Devolve a URL de consentimento. Quem a abre é o app, num navegador; o `state` assinado amarra a autorização a este fã.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: SpotifyAuthorizationPresenter })
  @HttpCode(HttpStatus.OK)
  async connect(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    return new SpotifyAuthorizationPresenter(
      await this.connectUseCase.execute({ audience_id: id }),
    );
  }

  @Post(":id/spotify/tracks/search")
  @Roles("audience", "admin")
  @UseGuards(AudienceOwnershipGuard)
  @ApiOperation({
    summary: "Procurar no Spotify a música ouvida ao vivo",
    description:
      "Devolve UM candidato para o fã confirmar — não salva nada. Casar título+artista com o catálogo é ambíguo (cover, remaster, homônimo), e salvar direto poria silenciosamente a faixa errada na biblioteca de alguém.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: SpotifyTrackCandidatePresenter })
  @HttpCode(HttpStatus.OK)
  async findTrack(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: FindSpotifyTrackDto,
  ) {
    return new SpotifyTrackCandidatePresenter(
      await this.findTrackUseCase.execute({
        audience_id: id,
        title: dto.title,
        artist: dto.artist,
      }),
    );
  }

  @Post(":id/spotify/tracks")
  @Roles("audience", "admin")
  @UseGuards(AudienceOwnershipGuard)
  @ApiOperation({
    summary: "Salvar na biblioteca do fã a faixa confirmada",
    description:
      "Recebe o `track_id` devolvido pela busca — nunca título e artista, para não recriar a adivinhação no ponto em que ela vira escrita na conta de outra pessoa.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: SpotifySaveResultPresenter })
  @HttpCode(HttpStatus.OK)
  async saveTrack(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: SaveSpotifyTrackDto,
  ) {
    const output = await this.saveTrackUseCase.execute({
      audience_id: id,
      track_id: dto.track_id,
    });

    return new SpotifySaveResultPresenter(output);
  }

  @Delete(":id/spotify")
  @Roles("audience", "admin")
  @UseGuards(AudienceOwnershipGuard)
  @ApiOperation({
    summary: "Desvincular a conta Spotify",
    description:
      "Apaga os tokens. Idempotente: desconectar quem já está desconectado devolve o mesmo estado, em vez de erro numa ação que deu certo.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: SpotifyLinkStatusPresenter })
  @HttpCode(HttpStatus.OK)
  async disconnect(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    await this.disconnectUseCase.execute({ audience_id: id });

    return new SpotifyLinkStatusPresenter({
      linked: false,
      spotify_user_id: null,
      linked_at: null,
    });
  }
}
