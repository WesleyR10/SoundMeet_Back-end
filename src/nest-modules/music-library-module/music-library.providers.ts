import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { ISpotifyCatalogGateway } from "../../core/music-library/application/ports/spotify-catalog.interface";
import { SpotifyTrackMatcher } from "../../core/music-library/application/services/spotify-track-matcher";
import { BackfillSpotifyTracksUseCase } from "../../core/music-library/application/use-cases/backfill-spotify-tracks/backfill-spotify-tracks.use-case";
import { CreateMusicLibraryUseCase } from "../../core/music-library/application/use-cases/create-music-library/create-music-library.use-case";
import { DeleteMusicLibraryUseCase } from "../../core/music-library/application/use-cases/delete-music-library/delete-music-library.use-case";
import { GetMusicLibraryUseCase } from "../../core/music-library/application/use-cases/get-music-library/get-music-library.use-case";
import { ListMusicLibraryUseCase } from "../../core/music-library/application/use-cases/list-music-library/list-music-library.use-case";
import { ResolveSpotifyTrackUseCase } from "../../core/music-library/application/use-cases/resolve-spotify-track/resolve-spotify-track.use-case";
import { UpdateMusicLibraryUseCase } from "../../core/music-library/application/use-cases/update-music-library/update-music-library.use-case";
import { IMusicLibraryRepository } from "../../core/music-library/domain/music-library.repository";
import { MusicLibraryPrismaRepository } from "../../core/music-library/infra/db/prisma/music-library-prisma.repository";
import { SpotifyCatalogAdapter } from "../../core/music-library/infra/gateways/spotify-catalog.adapter";
import { EnvConfig } from "../config-module/config.schema";
import { PrismaService } from "../database-module/prisma/prisma.service";
import { MusicLibraryCatalogService } from "./music-library.service";

export const REPOSITORIES = {
  MUSIC_LIBRARY_REPOSITORY: {
    provide: "MusicLibraryRepository",
    useExisting: MusicLibraryPrismaRepository,
  },
  MUSIC_LIBRARY_PRISMA_REPOSITORY: {
    provide: MusicLibraryPrismaRepository,
    useFactory: (prismaService: PrismaService) => {
      return new MusicLibraryPrismaRepository(prismaService);
    },
    inject: [PrismaService],
  },
};

export const USE_CASES = {
  CREATE_MUSIC_LIBRARY_USE_CASE: {
    provide: CreateMusicLibraryUseCase,
    useFactory: (repo: IMusicLibraryRepository) => {
      return new CreateMusicLibraryUseCase(repo);
    },
    inject: [REPOSITORIES.MUSIC_LIBRARY_REPOSITORY.provide],
  },
  GET_MUSIC_LIBRARY_USE_CASE: {
    provide: GetMusicLibraryUseCase,
    useFactory: (repo: IMusicLibraryRepository) => {
      return new GetMusicLibraryUseCase(repo);
    },
    inject: [REPOSITORIES.MUSIC_LIBRARY_REPOSITORY.provide],
  },
  LIST_MUSIC_LIBRARY_USE_CASE: {
    provide: ListMusicLibraryUseCase,
    useFactory: (repo: IMusicLibraryRepository) => {
      return new ListMusicLibraryUseCase(repo);
    },
    inject: [REPOSITORIES.MUSIC_LIBRARY_REPOSITORY.provide],
  },
  UPDATE_MUSIC_LIBRARY_USE_CASE: {
    provide: UpdateMusicLibraryUseCase,
    useFactory: (repo: IMusicLibraryRepository) => {
      return new UpdateMusicLibraryUseCase(repo);
    },
    inject: [REPOSITORIES.MUSIC_LIBRARY_REPOSITORY.provide],
  },
  DELETE_MUSIC_LIBRARY_USE_CASE: {
    provide: DeleteMusicLibraryUseCase,
    useFactory: (repo: IMusicLibraryRepository) => {
      return new DeleteMusicLibraryUseCase(repo);
    },
    inject: [REPOSITORIES.MUSIC_LIBRARY_REPOSITORY.provide],
  },
};

export const SERVICES = {
  MUSIC_LIBRARY_CATALOG_SERVICE: {
    provide: MusicLibraryCatalogService,
    useFactory: (
      createUseCase: CreateMusicLibraryUseCase,
      getUseCase: GetMusicLibraryUseCase,
      listUseCase: ListMusicLibraryUseCase,
      updateUseCase: UpdateMusicLibraryUseCase,
    ) => {
      return new MusicLibraryCatalogService(
        createUseCase,
        getUseCase,
        listUseCase,
        updateUseCase,
      );
    },
    inject: [
      CreateMusicLibraryUseCase,
      GetMusicLibraryUseCase,
      ListMusicLibraryUseCase,
      UpdateMusicLibraryUseCase,
    ],
  },
};

export const GATEWAYS = {
  SPOTIFY_CATALOG_GATEWAY: {
    provide: "SpotifyCatalogGateway",
    useFactory: (configService: ConfigService<EnvConfig>) => {
      const clientId = configService.get<string>("SPOTIFY_CLIENT_ID");
      const clientSecret = configService.get<string>("SPOTIFY_CLIENT_SECRET");

      // Só CLIENT_ID/SECRET — este gateway não usa `redirect_uri`, porque não
      // há usuário autorizando: é Client Credentials. Exigir a URI aqui
      // desligaria o casamento de faixa em ambiente que nem quer o OAuth do fã.
      if (!clientId?.trim() || !clientSecret?.trim()) {
        new Logger("MusicLibraryModule").warn(
          "SPOTIFY_CLIENT_ID/SECRET ausentes — casamento de faixa desligado",
        );
        return null;
      }

      return new SpotifyCatalogAdapter({
        clientId,
        clientSecret,
        accountsUrl:
          configService.get<string>("SPOTIFY_ACCOUNTS_URL") ??
          "https://accounts.spotify.com",
        apiUrl:
          configService.get<string>("SPOTIFY_API_URL") ??
          "https://api.spotify.com",
        market: configService.get<string>("SPOTIFY_MARKET") ?? "BR",
      });
    },
    inject: [ConfigService],
  },
  SPOTIFY_TRACK_MATCHER: {
    provide: SpotifyTrackMatcher,
    useFactory: () => new SpotifyTrackMatcher(),
  },
};

export const SPOTIFY_USE_CASES = {
  RESOLVE_SPOTIFY_TRACK_USE_CASE: {
    provide: ResolveSpotifyTrackUseCase,
    useFactory: (
      repo: IMusicLibraryRepository,
      catalog: ISpotifyCatalogGateway | null,
      matcher: SpotifyTrackMatcher,
    ) =>
      // Sem gateway a busca nunca acontece e o use-case devolve "não resolvido"
      // sem gravar nada — ambiente sem credencial não fica com negative cache
      // que precisaria ser limpo depois.
      new ResolveSpotifyTrackUseCase(
        repo,
        catalog ?? { searchTracks: async () => [] },
        matcher,
      ),
    inject: [
      REPOSITORIES.MUSIC_LIBRARY_REPOSITORY.provide,
      GATEWAYS.SPOTIFY_CATALOG_GATEWAY.provide,
      SpotifyTrackMatcher,
    ],
  },
  BACKFILL_SPOTIFY_TRACKS_USE_CASE: {
    provide: BackfillSpotifyTracksUseCase,
    useFactory: (
      repo: IMusicLibraryRepository,
      resolveUseCase: ResolveSpotifyTrackUseCase,
    ) => new BackfillSpotifyTracksUseCase(repo, resolveUseCase),
    inject: [
      REPOSITORIES.MUSIC_LIBRARY_REPOSITORY.provide,
      ResolveSpotifyTrackUseCase,
    ],
  },
};

export const MUSIC_LIBRARY_PROVIDERS = {
  REPOSITORIES,
  USE_CASES,
  GATEWAYS,
  SPOTIFY_USE_CASES,
  SERVICES,
};
