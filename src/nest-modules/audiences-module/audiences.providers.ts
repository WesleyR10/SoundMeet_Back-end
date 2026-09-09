import { randomBytes } from "node:crypto";

import { MusicianPrismaRepository } from "@core/musician/infra/db/prisma/musician-prisma.repository";
import { PrismaUnitOfWork } from "@core/shared/infra/db/prisma/prisma-unit-of-work";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";

import { SpotifyAccessService } from "../../core/audience/application/services/spotify-access.service";
import { AttendEventUseCase } from "../../core/audience/application/use-cases/attend-event/attend-event.use-case";
import { CompleteProfileUseCase } from "../../core/audience/application/use-cases/complete-profile/complete-profile.use-case";
import { CompleteSpotifyConnectionUseCase } from "../../core/audience/application/use-cases/connect-spotify/complete-spotify-connection.use-case";
import { ConnectSpotifyUseCase } from "../../core/audience/application/use-cases/connect-spotify/connect-spotify.use-case";
import { DisconnectSpotifyUseCase } from "../../core/audience/application/use-cases/connect-spotify/disconnect-spotify.use-case";
import { GetSpotifyLinkStatusUseCase } from "../../core/audience/application/use-cases/connect-spotify/get-spotify-link-status.use-case";
import { DeleteAudienceUseCase } from "../../core/audience/application/use-cases/delete-audience/delete-audience.use-case";
import { GetAudienceUseCase } from "../../core/audience/application/use-cases/get-audience/get-audience.use-case";
import { IndicateMusicianUseCase } from "../../core/audience/application/use-cases/indicate-musician/indicate-musician.use-case";
import { ListAudiencesUseCase } from "../../core/audience/application/use-cases/list-audiences/list-audiences.use-case";
import { MakeMusicRequestUseCase } from "../../core/audience/application/use-cases/make-music-request/make-music-request.use-case";
import { RecommendMusiciansUseCase } from "../../core/audience/application/use-cases/recommend-musicians/recommend-musicians.use-case";
import { RefreshSpotifyTokensUseCase } from "../../core/audience/application/use-cases/refresh-spotify-tokens/refresh-spotify-tokens.use-case";
import { FindSpotifyTrackUseCase } from "../../core/audience/application/use-cases/save-track-to-spotify/find-spotify-track.use-case";
import { SaveTrackToSpotifyUseCase } from "../../core/audience/application/use-cases/save-track-to-spotify/save-track-to-spotify.use-case";
import { ScanQRUseCase } from "../../core/audience/application/use-cases/scan-qr/scan-qr.use-case";
import { SendTipUseCase } from "../../core/audience/application/use-cases/send-tip/send-tip.use-case";
import { ShareSocialMediaUseCase } from "../../core/audience/application/use-cases/share-social-media/share-social-media.use-case";
import { UpdateAudienceUseCase } from "../../core/audience/application/use-cases/update-audience/update-audience.use-case";
import { VoteSongUseCase } from "../../core/audience/application/use-cases/vote-song/vote-song.use-case";
import { IAudienceRepository } from "../../core/audience/domain/audience.repository";
import { IAudienceSpotifyLinkRepository } from "../../core/audience/domain/audience-spotify-link.repository";
import { AudiencePrismaRepository } from "../../core/audience/infra/db/prisma/audience-prisma.repository";
import { AudienceSpotifyLinkPrismaRepository } from "../../core/audience/infra/db/prisma/audience-spotify-link-prisma.repository";
import { SpotifyAdapter } from "../../core/audience/infra/gateways/spotify.adapter";
import { AddEventAttendeeUseCase } from "../../core/events/application/use-cases/add-event-attendee/add-event-attendee.use-case";
import { AddPointsUseCase } from "../../core/gamification/application/use-cases/add-points/add-points.use-case";
import { IUserInteractionRepository } from "../../core/gamification/domain/user-interaction.repository";
import { UserInteractionPrismaRepository } from "../../core/gamification/infra/db/prisma/user-interaction-prisma.repository";
import { IMusicianRepository } from "../../core/musician/domain/musician.repository";
import { SendTipUseCase as PaymentSendTipUseCase } from "../../core/payment/application/use-cases/send-tip/send-tip.use-case";
import { CreateRequestUseCase } from "../../core/request/application/use-cases/create-request/create-request.use-case";
import { VoteRequestUseCase } from "../../core/request/application/use-cases/vote-request/vote-request.use-case";
import { IEncryptionService } from "../../core/shared/domain/encryption.service";
import { DomainEventMediator } from "../../core/shared/domain/events/domain-event-mediator";
import { AesGcmEncryptionService } from "../../core/shared/infra/crypto/aes-gcm-encryption.service";
import { OAuthStateService } from "../../core/shared/infra/crypto/oauth-state.service";
import { EnvConfig } from "../config-module/config.schema";
import { PrismaService } from "../database-module/prisma/prisma.service";

export const INFRA_PROVIDERS = {
  /**
   * Cifra os tokens do Spotify em repouso (AES-256-GCM, infra de SM-016).
   *
   * Mesmo token `"EncryptionService"` e mesma `TOKEN_ENCRYPTION_KEY` de
   * `PaymentModule` e `GoogleCalendarModule` — declarado localmente, e não
   * importado de lá, pelo mesmo motivo registrado naquele arquivo: a chave é
   * infra genérica e importar o módulo de pagamento só por isso criaria
   * dependência cruzada entre domínios.
   */
  ENCRYPTION_SERVICE: {
    provide: "EncryptionService",
    useFactory: (
      configService: ConfigService<EnvConfig>,
    ): IEncryptionService => {
      const key = configService.get<string>("TOKEN_ENCRYPTION_KEY");
      if (key && key.trim()) {
        return new AesGcmEncryptionService(key);
      }
      new Logger("AudiencesModule").warn(
        "TOKEN_ENCRYPTION_KEY ausente — usando chave efêmera de desenvolvimento (vínculos Spotify não sobrevivem a restart)",
      );
      return new AesGcmEncryptionService(randomBytes(32).toString("base64"));
    },
    inject: [ConfigService],
  },

  /**
   * Spotify — `null` quando as credenciais não estão configuradas.
   *
   * Fail-safe explícito: subir com `clientId` vazio faria a feature falhar só
   * no toque do fã, com um erro do provedor que não diz nada sobre a causa. Os
   * use-cases recebem a porta e o controller responde "indisponível".
   */
  SPOTIFY_GATEWAY: {
    provide: "SpotifyGateway",
    useFactory: (configService: ConfigService<EnvConfig>) => {
      const clientId = configService.get<string>("SPOTIFY_CLIENT_ID");
      const clientSecret = configService.get<string>("SPOTIFY_CLIENT_SECRET");
      const redirectUri = configService.get<string>("SPOTIFY_REDIRECT_URI");

      if (!clientId?.trim() || !clientSecret?.trim() || !redirectUri?.trim()) {
        new Logger("AudiencesModule").warn(
          "SPOTIFY_CLIENT_ID/SECRET/REDIRECT_URI ausentes — ponte Spotify desligada",
        );
        return null;
      }

      return new SpotifyAdapter({
        accountsUrl:
          configService.get<string>("SPOTIFY_ACCOUNTS_URL") ??
          "https://accounts.spotify.com",
        apiUrl:
          configService.get<string>("SPOTIFY_API_URL") ??
          "https://api.spotify.com",
        clientId,
        clientSecret,
        redirectUri,
      });
    },
    inject: [ConfigService],
  },

  /**
   * `state` assinado do fluxo Spotify.
   *
   * 🔴 `purpose` PRÓPRIO: o mesmo segredo assina os fluxos do Mercado Pago e do
   * Google Calendar. Sem propósito distinto, um `state` emitido para vincular
   * conta de pagamento seria aceito aqui — e vice-versa.
   */
  SPOTIFY_OAUTH_STATE: {
    provide: "SpotifyOAuthStateService",
    useFactory: (configService: ConfigService<EnvConfig>) =>
      new OAuthStateService(
        configService.get<string>("JWT_SECRET") ?? "dev-secret",
        "spotify_connect",
      ),
    inject: [ConfigService],
  },
};

export const REPOSITORIES = {
  AUDIENCE_REPOSITORY: {
    provide: "AudienceRepository",
    useExisting: AudiencePrismaRepository,
  },
  AUDIENCE_PRISMA_REPOSITORY: {
    provide: AudiencePrismaRepository,
    useFactory: (prismaService: PrismaService) => {
      return new AudiencePrismaRepository(prismaService);
    },
    inject: [PrismaService],
  },
  AUDIENCE_SPOTIFY_LINK_REPOSITORY: {
    provide: "AudienceSpotifyLinkRepository",
    useExisting: AudienceSpotifyLinkPrismaRepository,
  },
  AUDIENCE_SPOTIFY_LINK_PRISMA_REPOSITORY: {
    provide: AudienceSpotifyLinkPrismaRepository,
    useFactory: (
      prismaService: PrismaService,
      encryption: IEncryptionService,
    ) => new AudienceSpotifyLinkPrismaRepository(prismaService, encryption),
    inject: [PrismaService, "EncryptionService"],
  },
  USER_INTERACTION_REPOSITORY: {
    provide: "UserInteractionRepository",
    useExisting: UserInteractionPrismaRepository,
  },
  USER_INTERACTION_PRISMA_REPOSITORY: {
    provide: UserInteractionPrismaRepository,
    useFactory: (prismaService: PrismaService) => {
      return new UserInteractionPrismaRepository(prismaService);
    },
    inject: [PrismaService],
  },
  MUSICIAN_REPOSITORY: {
    provide: "MusicianRepository",
    useExisting: MusicianPrismaRepository,
  },
  MUSICIAN_PRISMA_REPOSITORY: {
    provide: MusicianPrismaRepository,
    useFactory: (prismaService: PrismaService) => {
      return new MusicianPrismaRepository(prismaService);
    },
    inject: [PrismaService],
  },
};

export const USE_CASES = {
  UPDATE_AUDIENCE_USE_CASE: {
    provide: UpdateAudienceUseCase,
    useFactory: (
      audienceRepo: IAudienceRepository,
      domainEventMediator: DomainEventMediator,
    ) => {
      return new UpdateAudienceUseCase(audienceRepo, domainEventMediator);
    },
    inject: [REPOSITORIES.AUDIENCE_REPOSITORY.provide, DomainEventMediator],
  },
  DELETE_AUDIENCE_USE_CASE: {
    provide: DeleteAudienceUseCase,
    useFactory: (audienceRepo: IAudienceRepository) => {
      return new DeleteAudienceUseCase(audienceRepo);
    },
    inject: [REPOSITORIES.AUDIENCE_REPOSITORY.provide],
  },
  GET_AUDIENCE_USE_CASE: {
    provide: GetAudienceUseCase,
    useFactory: (audienceRepo: IAudienceRepository) => {
      return new GetAudienceUseCase(audienceRepo);
    },
    inject: [REPOSITORIES.AUDIENCE_REPOSITORY.provide],
  },
  LIST_AUDIENCES_USE_CASE: {
    provide: ListAudiencesUseCase,
    useFactory: (audienceRepo: IAudienceRepository) => {
      return new ListAudiencesUseCase(audienceRepo);
    },
    inject: [REPOSITORIES.AUDIENCE_REPOSITORY.provide],
  },
  COMPLETE_PROFILE_USE_CASE: {
    provide: CompleteProfileUseCase,
    useFactory: (audienceRepo: IAudienceRepository) => {
      return new CompleteProfileUseCase(audienceRepo);
    },
    inject: [REPOSITORIES.AUDIENCE_REPOSITORY.provide],
  },
  ATTEND_EVENT_USE_CASE: {
    provide: AttendEventUseCase,
    useFactory: (
      audienceRepo: IAudienceRepository,
      addEventAttendeeUseCase: AddEventAttendeeUseCase,
    ) => {
      return new AttendEventUseCase(audienceRepo, addEventAttendeeUseCase);
    },
    inject: [REPOSITORIES.AUDIENCE_REPOSITORY.provide, AddEventAttendeeUseCase],
  },
  SCAN_QR_USE_CASE: {
    provide: ScanQRUseCase,
    useFactory: (
      audienceRepo: IAudienceRepository,
      userInteractionRepo: IUserInteractionRepository,
      musicianRepo: IMusicianRepository,
      prismaService: PrismaService,
      configService: ConfigService<EnvConfig>,
    ) => {
      const uow = new PrismaUnitOfWork(prismaService);
      return new ScanQRUseCase(
        audienceRepo,
        userInteractionRepo,
        musicianRepo,
        uow,
        // Host aceito no QR https. Vem de `APP_URL` para que staging não aceite
        // (nem imprima) QR de produção.
        configService.get("APP_URL")!,
      );
    },
    inject: [
      REPOSITORIES.AUDIENCE_REPOSITORY.provide,
      REPOSITORIES.USER_INTERACTION_REPOSITORY.provide,
      REPOSITORIES.MUSICIAN_REPOSITORY.provide,
      PrismaService,
      ConfigService,
    ],
  },
  MAKE_MUSIC_REQUEST_USE_CASE: {
    provide: MakeMusicRequestUseCase,
    useFactory: (
      audienceRepo: IAudienceRepository,
      createRequestUseCase: CreateRequestUseCase,
      addPointsUseCase: AddPointsUseCase,
    ) => {
      return new MakeMusicRequestUseCase(
        audienceRepo,
        createRequestUseCase,
        addPointsUseCase,
      );
    },
    inject: [
      REPOSITORIES.AUDIENCE_REPOSITORY.provide,
      CreateRequestUseCase,
      AddPointsUseCase,
    ],
  },
  VOTE_SONG_USE_CASE: {
    provide: VoteSongUseCase,
    useFactory: (
      audienceRepo: IAudienceRepository,
      voteRequestUseCase: VoteRequestUseCase,
    ) => {
      return new VoteSongUseCase(audienceRepo, voteRequestUseCase);
    },
    inject: [REPOSITORIES.AUDIENCE_REPOSITORY.provide, VoteRequestUseCase],
  },
  SEND_TIP_USE_CASE: {
    provide: SendTipUseCase,
    useFactory: (
      audienceRepo: IAudienceRepository,
      sendTipUseCase: PaymentSendTipUseCase,
    ) => {
      return new SendTipUseCase(audienceRepo, sendTipUseCase);
    },
    inject: [REPOSITORIES.AUDIENCE_REPOSITORY.provide, PaymentSendTipUseCase],
  },
  SHARE_SOCIAL_MEDIA_USE_CASE: {
    provide: ShareSocialMediaUseCase,
    useFactory: (
      audienceRepo: IAudienceRepository,
      domainEventMediator: DomainEventMediator,
    ) => {
      return new ShareSocialMediaUseCase(audienceRepo, domainEventMediator);
    },
    inject: [REPOSITORIES.AUDIENCE_REPOSITORY.provide, DomainEventMediator],
  },
  INDICATE_MUSICIAN_USE_CASE: {
    provide: IndicateMusicianUseCase,
    useFactory: (
      audienceRepo: IAudienceRepository,
      domainEventMediator: DomainEventMediator,
    ) => {
      return new IndicateMusicianUseCase(audienceRepo, domainEventMediator);
    },
    inject: [REPOSITORIES.AUDIENCE_REPOSITORY.provide, DomainEventMediator],
  },
  RECOMMEND_MUSICIANS_USE_CASE: {
    provide: RecommendMusiciansUseCase,
    useFactory: (
      audienceRepo: IAudienceRepository,
      musicianRepo: IMusicianRepository,
    ) => {
      return new RecommendMusiciansUseCase(audienceRepo, musicianRepo);
    },
    inject: [REPOSITORIES.AUDIENCE_REPOSITORY.provide, "MusicianRepository"],
  },
};

/**
 * Ponte Spotify (feature 3).
 *
 * Todos recebem o gateway por token `"SpotifyGateway"`, que pode ser `null`
 * quando as credenciais não estão configuradas — o controller responde
 * "indisponível" em vez de o app falhar no toque do fã.
 */
export const SPOTIFY_USE_CASES = {
  SPOTIFY_ACCESS_SERVICE: {
    provide: SpotifyAccessService,
    useFactory: (
      linkRepo: IAudienceSpotifyLinkRepository,
      gateway: SpotifyAdapter | null,
    ) => new SpotifyAccessService(linkRepo, gateway as SpotifyAdapter),
    inject: ["AudienceSpotifyLinkRepository", "SpotifyGateway"],
  },
  CONNECT_SPOTIFY_USE_CASE: {
    provide: ConnectSpotifyUseCase,
    useFactory: (gateway: SpotifyAdapter | null, state: OAuthStateService) =>
      new ConnectSpotifyUseCase(gateway as SpotifyAdapter, state),
    inject: ["SpotifyGateway", "SpotifyOAuthStateService"],
  },
  COMPLETE_SPOTIFY_CONNECTION_USE_CASE: {
    provide: CompleteSpotifyConnectionUseCase,
    useFactory: (
      linkRepo: IAudienceSpotifyLinkRepository,
      gateway: SpotifyAdapter | null,
      state: OAuthStateService,
    ) =>
      new CompleteSpotifyConnectionUseCase(
        linkRepo,
        gateway as SpotifyAdapter,
        state,
      ),
    inject: [
      "AudienceSpotifyLinkRepository",
      "SpotifyGateway",
      "SpotifyOAuthStateService",
    ],
  },
  DISCONNECT_SPOTIFY_USE_CASE: {
    provide: DisconnectSpotifyUseCase,
    useFactory: (linkRepo: IAudienceSpotifyLinkRepository) =>
      new DisconnectSpotifyUseCase(linkRepo),
    inject: ["AudienceSpotifyLinkRepository"],
  },
  GET_SPOTIFY_LINK_STATUS_USE_CASE: {
    provide: GetSpotifyLinkStatusUseCase,
    useFactory: (linkRepo: IAudienceSpotifyLinkRepository) =>
      new GetSpotifyLinkStatusUseCase(linkRepo),
    inject: ["AudienceSpotifyLinkRepository"],
  },
  FIND_SPOTIFY_TRACK_USE_CASE: {
    provide: FindSpotifyTrackUseCase,
    useFactory: (
      access: SpotifyAccessService,
      gateway: SpotifyAdapter | null,
    ) => new FindSpotifyTrackUseCase(access, gateway as SpotifyAdapter),
    inject: [SpotifyAccessService, "SpotifyGateway"],
  },
  SAVE_TRACK_TO_SPOTIFY_USE_CASE: {
    provide: SaveTrackToSpotifyUseCase,
    useFactory: (
      access: SpotifyAccessService,
      gateway: SpotifyAdapter | null,
    ) => new SaveTrackToSpotifyUseCase(access, gateway as SpotifyAdapter),
    inject: [SpotifyAccessService, "SpotifyGateway"],
  },
  REFRESH_SPOTIFY_TOKENS_USE_CASE: {
    provide: RefreshSpotifyTokensUseCase,
    useFactory: (
      linkRepo: IAudienceSpotifyLinkRepository,
      gateway: SpotifyAdapter | null,
    ) =>
      new RefreshSpotifyTokensUseCase({
        linkRepo,
        oauth: gateway as SpotifyAdapter,
      }),
    inject: ["AudienceSpotifyLinkRepository", "SpotifyGateway"],
  },
};

export const EVENTS = {
  DOMAIN_EVENT_MEDIATOR: {
    provide: DomainEventMediator,
    useFactory: (eventEmitter: EventEmitter2) => {
      return new DomainEventMediator(eventEmitter);
    },
    inject: [EventEmitter2],
  },
};

export const AUDIENCES_PROVIDERS = {
  INFRA_PROVIDERS,
  REPOSITORIES,
  USE_CASES,
  SPOTIFY_USE_CASES,
  EVENTS,
};
