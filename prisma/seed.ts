/**
 * Seed de desenvolvimento do SoundMeet — popula o banco com todos os cenários
 * de negócio para teste manual do app (item 12 do feedback jul/2026).
 *
 * Uso:
 *   npm run seed            → insere os dados (falha se já existirem e-mails seed)
 *   npm run seed -- --reset → LIMPA as tabelas de negócio e re-insere
 *
 * Princípios:
 *   - Reutiliza fake builders + agregados do core (validação de domínio de graça)
 *     e persiste pelos repositórios Prisma (mappers/VOs — consistência com a app).
 *   - Determinístico: e-mails/nomes fixos (musico1@seed-soundmeet.com, ...).
 *   - NUNCA roda em produção (guarda por NODE_ENV).
 *
 * Cobertura (14/set/2026, CONTADA num banco semeado, não estimada): 51 dos 57
 * modelos, e todos os estados de toda máquina de estado do schema (booking,
 * inquiry, evento, line-up, contrato, custódia, gorjeta, transação, pedido,
 * destaque, assinatura, jobs de IA, campanha, indicação, escopo de cifra).
 * ⚠️ A contagem anterior ("52 dos 57") estava errada: agenda de banda (3
 * tabelas) e `repertoire_invitees` nunca tinham linha. Para reconferir, conte
 * as tabelas vazias depois de um `--reset` — devem ser exatamente as seis abaixo.
 *
 * Os seis de fora são decisão, não esquecimento — não semear é mais correto
 * que semear:
 *   - `ProcessedEvent`: ledger de idempotência. Semeá-lo faria a app PULAR
 *     eventos que ela deveria processar. Ativamente nocivo.
 *   - `GoogleCalendarIntegration` / `GoogleCalendarSyncedEvent`: exigem token
 *     OAuth real do Google. Token falso produz uma integração que a UI mostra
 *     como conectada e que falha em toda chamada — pior que ausente.
 *   - `SyncedLyricsBulkJob`: controle do pré-carregamento de 10k letras, não é
 *     estado de usuário.
 *   - `RequestFeedback`: tem agregado e use-cases, mas NENHUMA rota HTTP os
 *     expõe. Semear seria dado que nenhuma tela alcança (mesmo caso do
 *     `MusicianAnalytics`, abaixo).
 *   - `MusicianAnalytics` é caso à parte: a tabela existe no schema e NENHUM
 *     arquivo de `src/` a lê ou escreve (o use-case calcula na leitura). Ver a
 *     nota na seção 25.
 *   - `Establishment.cover` / `cover_key` (11/set/2026) ficam NULL nos quatro
 *     estabelecimentos, e isto é o oposto da regra dos "dois lados". Ela vale
 *     para flag booleana, onde os dois estados são dado; aqui o outro lado é um
 *     OBJETO NO BUCKET. Gravar uma URL sem o arquivo por trás daria capa
 *     quebrada em todo espaço semeado — e `null` já exercita o caminho
 *     principal (a capa gerada pela marca), que é o que 100% dos donos veem
 *     antes do primeiro upload. Para exercitar o outro lado, suba uma imagem
 *     pela tela: é um clique, e é o fluxo real.
 *   - `Musician.presentation_audio_*` (16/set/2026) é a EXCEÇÃO a essa regra, e
 *     por um motivo que a capa não tem: aqui o seed **sobe o objeto de verdade**
 *     (WAV sintetizado em `synthesizePresentationWav`, pelo
 *     `UploadMusicianPresentationAudioUseCase` real), então não há URL sem
 *     arquivo por trás. Só TRÊS dos oito músicos recebem áudio — o estado vazio
 *     do cartão da grade é o caso mais comum em produção e precisa de alguém
 *     que o exercite. Escreve no MESMO storage do app (hoje R2) sob o prefixo
 *     `seed/`, e o `--reset` varre só esse prefixo — nada que o app gravou é
 *     tocado. Sem storage configurado o seed avisa e segue.
 *   - `Musician.avatar` (17/set/2026) segue a mesma exceção: CINCO dos oito
 *     sobem foto de verdade (fixtures em `prisma/seed-assets/avatars/`, pelo
 *     `UploadMusicianAvatarUseCase`), os outros três exercitam o fallback.
 *   - Cria 15 usuários Keycloak de teste (8 músicos, 2 fãs, 4 estabelecimentos
 *     e 1 admin) com senha Seed@123
 *     ANTES dos aggregates: o sub gerado vira o id do aggregate, como no
 *     RegisterUseCase (ownership guards comparam o sub do JWT com o id do
 *     recurso). Se o Keycloak estiver fora do ar, o seed conclui com aviso e
 *     ids aleatórios — rode com --reset depois de subir o Keycloak.
 */
// reflect-metadata primeiro: agregados puxam inputs com decorators de
// class-transformer/class-validator via barrels do core.
import "reflect-metadata";

import { readFileSync } from "node:fs";
import { unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  CreateBucketCommand,
  DeleteObjectsCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutBucketPolicyCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import axios, { type AxiosInstance } from "axios";

import { AudiencePrismaRepository } from "../src/core/audience/infra/db/prisma/audience-prisma.repository";
import { Audience, AudienceId } from "../src/core/audience/domain/audience.aggregate";
import { Conversation } from "../src/core/chat/domain/conversation.aggregate";
import { Message } from "../src/core/chat/domain/message.aggregate";
import { ConversationPrismaRepository } from "../src/core/chat/infra/db/prisma/conversation-prisma.repository";
import { MessagePrismaRepository } from "../src/core/chat/infra/db/prisma/message-prisma.repository";
import { Establishment } from "../src/core/establishment/domain/establishment.aggregate";
import { EventAttendee } from "../src/core/events/domain/event-attendee.aggregate";
import { EventMusician } from "../src/core/events/domain/event-musician.aggregate";
import { EventAttendeePrismaRepository } from "../src/core/events/infra/db/prisma/event-attendee-prisma.repository";
import { Follow } from "../src/core/follow/domain/follow.aggregate";
import { FollowPrismaRepository } from "../src/core/follow/infra/db/prisma/follow-prisma.repository";
import { EventMusicianPrismaRepository } from "../src/core/events/infra/db/prisma/event-musician-prisma.repository";
import { Badge } from "../src/core/gamification/domain/badge.aggregate";
import { UserInteraction } from "../src/core/gamification/domain/user-interaction.aggregate";
import { UserPoints } from "../src/core/gamification/domain/user-points.aggregate";
import { UserScore } from "../src/core/gamification/domain/user-score.aggregate";
import { SyncUserBadgesUseCase } from "../src/core/gamification/application/use-cases/sync-user-badges/sync-user-badges.use-case";
import { UserLevel } from "../src/core/gamification/domain/value-objects/user-level.vo";
import { ScoreTypeEnum } from "../src/core/gamification/domain/value-objects/score-type.vo";
import { BadgePrismaRepository } from "../src/core/gamification/infra/db/prisma/badge-prisma.repository";
import { UserBadgePrismaRepository } from "../src/core/gamification/infra/db/prisma/user-badge-prisma.repository";
import { UserInteractionPrismaRepository } from "../src/core/gamification/infra/db/prisma/user-interaction-prisma.repository";
import { UserPointsPrismaRepository } from "../src/core/gamification/infra/db/prisma/user-points-prisma.repository";
import { UserScorePrismaRepository } from "../src/core/gamification/infra/db/prisma/user-score-prisma.repository";
import { MusicLibrary } from "../src/core/music-library/domain/music-library.aggregate";
import { AiAudioSeparationJob } from "../src/core/ai-audio/domain/ai-audio-separation-job.aggregate";
import { AiAudioSeparationOutput } from "../src/core/ai-audio/domain/ai-audio-separation-output.child-entity";
import { AiAudioUpload } from "../src/core/ai-audio/domain/ai-audio-upload.aggregate";
import { AiAudioSeparationJobPrismaRepository } from "../src/core/ai-audio/infra/db/prisma/ai-audio-separation-job-prisma.repository";
import { AiAudioUploadPrismaRepository } from "../src/core/ai-audio/infra/db/prisma/ai-audio-upload-prisma.repository";
import {
  AiCifraAnalysisJob,
  AiCifraAnalysisResult,
} from "../src/core/ai-cifra/domain/ai-cifra-analysis-job.aggregate";
import { AiCifraUpload } from "../src/core/ai-cifra/domain/ai-cifra-upload.aggregate";
import { AiCifraAnalysisJobPrismaRepository } from "../src/core/ai-cifra/infra/db/prisma/ai-cifra-analysis-job-prisma.repository";
import { AiCifraUploadPrismaRepository } from "../src/core/ai-cifra/infra/db/prisma/ai-cifra-upload-prisma.repository";
import { AudienceSpotifyLink } from "../src/core/audience/domain/audience-spotify-link.aggregate";
import { AudienceSpotifyLinkPrismaRepository } from "../src/core/audience/infra/db/prisma/audience-spotify-link-prisma.repository";
import { Campaign } from "../src/core/campaign/domain/campaign.aggregate";
import { EstablishmentAnalytics } from "../src/core/establishment/domain/establishment-analytics.read-model";
import { EstablishmentAnalyticsPrismaRepository } from "../src/core/establishment/infra/db/prisma/establishment-analytics-prisma.repository";
import { Ranking } from "../src/core/gamification/domain/ranking.aggregate";
import {
  RankingPeriodEnum,
  RankingTypeEnum,
} from "../src/core/gamification/domain/value-objects/ranking-type.vo";
import { RankingPrismaRepository } from "../src/core/gamification/infra/db/prisma/ranking-prisma.repository";
import { CampaignPrismaRepository } from "../src/core/campaign/infra/db/prisma/campaign-prisma.repository";
import { IContractStorage } from "../src/core/contract/application/ports/contract-storage.interface";
import { IssueContractUseCase } from "../src/core/contract/application/use-cases/issue-contract/issue-contract.use-case";
import { ClauseCatalog } from "../src/core/contract/domain/catalog/clause-catalog";
import { ContractPrismaRepository } from "../src/core/contract/infra/db/prisma/contract-prisma.repository";
import { ReactPdfContractRenderer } from "../src/core/contract/infra/renderer/react-pdf-contract.renderer";
import { S3ContractStorage } from "../src/core/contract/infra/storage/s3-contract.storage";
import { BookingEscrow } from "../src/core/payment/domain/booking-escrow.aggregate";
import { BookingEscrowPrismaRepository } from "../src/core/payment/infra/db/prisma/booking-escrow-prisma.repository";
import { Performance } from "../src/core/performance/domain/performance.aggregate";
import { PerformancePrismaRepository } from "../src/core/performance/infra/db/prisma/performance-prisma.repository";
import { Review } from "../src/core/review/domain/review.aggregate";
import { Indication } from "../src/core/indication/domain/indication.aggregate";
import { IndicationPrismaRepository } from "../src/core/indication/infra/db/prisma/indication-prisma.repository";
import { ReviewPrismaRepository } from "../src/core/review/infra/db/prisma/review-prisma.repository";
import { MusicLibraryPrismaRepository } from "../src/core/music-library/infra/db/prisma/music-library-prisma.repository";
import { EstablishmentProfile } from "../src/core/establishment/domain/establishment-profile.aggregate";
import { EstablishmentPrismaRepository } from "../src/core/establishment/infra/db/prisma/establishment-prisma.repository";
import { Event } from "../src/core/events/domain/event.aggregate";
import { EventPrismaRepository } from "../src/core/events/infra/db/prisma/event-prisma.repository";
import { Band } from "../src/core/musician/domain/band.aggregate";
import { Musician, MusicianId } from "../src/core/musician/domain/musician.aggregate";
import { BandPrismaRepository } from "../src/core/musician/infra/db/prisma/band-prisma.repository";
import { MusicianPrismaRepository } from "../src/core/musician/infra/db/prisma/musician-prisma.repository";
import { IMusicianStorage } from "../src/core/musician/application/ports/musician-storage.interface";
import { S3MusicianStorage } from "../src/core/musician/infra/storage/s3-musician.storage";
import { UploadMusicianPresentationAudioUseCase } from "../src/core/musician/application/use-cases/upload-musician-presentation-audio/upload-musician-presentation-audio.use-case";
import { UploadEstablishmentMenuPdfUseCase } from "../src/core/establishment/application/use-cases/upload-establishment-menu-pdf/upload-establishment-menu-pdf.use-case";
import { UploadMusicianAvatarUseCase } from "../src/core/musician/application/use-cases/upload-musician-avatar/upload-musician-avatar.use-case";
import { detectFileMime } from "../src/nest-modules/shared-module/upload/detect-file-mime";
import { readAudioDurationSeconds } from "../src/nest-modules/shared-module/upload/read-audio-duration";
import {
  CHORD_SHEET_FINGERPRINT_VERSION,
  computeChordSheetBaseFingerprint,
} from "../src/core/personal-chord-sheet/application/services/chord-sheet-fingerprint";
import { PersonalChordSheet } from "../src/core/personal-chord-sheet/domain/personal-chord-sheet.aggregate";
import { ChordEdit } from "../src/core/personal-chord-sheet/domain/value-objects/chord-edit.vo";
import { ChordSheetViewSettings } from "../src/core/personal-chord-sheet/domain/value-objects/chord-sheet-view-settings.vo";
import { PersonalChordSheetPrismaRepository } from "../src/core/personal-chord-sheet/infra/db/prisma/personal-chord-sheet-prisma.repository";
import { MusicianWallet } from "../src/core/payment/domain/musician-wallet.aggregate";
import { PaymentMethod, Tip } from "../src/core/payment/domain/tip.aggregate";
import { Transaction } from "../src/core/payment/domain/transaction.aggregate";
import {
  TransactionStatus,
  TransactionType,
} from "../src/core/payment/domain/transaction-enums";
import { TransactionPrismaRepository } from "../src/core/payment/infra/db/prisma/transaction-prisma.repository";
import { MusicianWalletPrismaRepository } from "../src/core/payment/infra/db/prisma/musician-wallet-prisma.repository";
import { TipPrismaRepository } from "../src/core/payment/infra/db/prisma/tip-prisma.repository";
import {
  BillingCycle,
  EstablishmentPlanTier,
  MusicianPlanTier,
} from "../src/core/plans/domain/plan-tier.enum";
import { Subscription } from "../src/core/plans/domain/subscription.aggregate";
import { SubscriptionPrismaRepository } from "../src/core/plans/infra/db/prisma/subscription-prisma.repository";
import { Repertoire, RepertoireSong } from "../src/core/repertoire/domain/repertoire.aggregate";
import { RepertoirePrismaRepository } from "../src/core/repertoire/infra/db/prisma/repertoire-prisma.repository";
import { Request } from "../src/core/request/domain/request.aggregate";
import { RequestVote } from "../src/core/request/domain/request-vote.aggregate";
import { RequestBoost } from "../src/core/request/domain/value-objects/request-boost.vo";
import { RequestPrismaRepository } from "../src/core/request/infra/db/prisma/request-prisma.repository";
import { RequestVotePrismaRepository } from "../src/core/request/infra/db/prisma/request-vote-prisma.repository";
import { Availability } from "../src/core/scheduling/domain/availability.aggregate";
import { Booking } from "../src/core/scheduling/domain/booking.aggregate";
import { Inquiry } from "../src/core/scheduling/domain/inquiry.aggregate";
import { AvailabilityPrismaRepository } from "../src/core/scheduling/infra/db/prisma/availability-prisma.repository";
import { BookingPrismaRepository } from "../src/core/scheduling/infra/db/prisma/booking-prisma.repository";
import { InquiryPrismaRepository } from "../src/core/scheduling/infra/db/prisma/inquiry-prisma.repository";
import { Uuid } from "../src/core/shared/domain";
import { Address } from "../src/core/shared/domain/value-objects/address.vo";
import { Money } from "../src/core/shared/domain/value-objects/money.vo";
import { Location } from "../src/core/shared/domain/value-objects/location.vo";
import { PriceRange } from "../src/core/shared/domain/value-objects/price-range.vo";
import { StageTechSpec } from "../src/core/shared/domain/value-objects/stage-tech-spec.vo";
import { AesGcmEncryptionService } from "../src/core/shared/infra/crypto/aes-gcm-encryption.service";
import { GetChordSheetForMusicLibraryUseCase } from "../src/core/synced-lyrics/application/use-cases/get-chord-sheet-for-music-library/get-chord-sheet-for-music-library.use-case";
import { LrcParser } from "../src/core/synced-lyrics/domain/value-objects/lrc.vo";
import { ChordSheetPrismaReadModel } from "../src/core/synced-lyrics/infra/db/prisma/chord-sheet-prisma.read-model";

import { buildEstablishmentAnalyticsSeries } from "./seed-analytics-series";
import { CROWD_NAMES, CROWD_POOL, CROWD_SURNAMES, buildCarlosTour } from "./seed-night-series";

// ── bootstrap ────────────────────────────────────────────────────────────────

function loadEnvValue(name: string, fallback?: string): string {
  if (process.env[name]) return process.env[name]!;
  const env = readFileSync(resolve(__dirname, "../envs/.env"), "utf8");
  const line = env.split("\n").find((l) => l.startsWith(`${name}=`));
  if (line) return line.slice(name.length + 1).trim();
  if (fallback !== undefined) return fallback;
  throw new Error(`${name} não encontrada (env ou envs/.env)`);
}

if (process.env.NODE_ENV === "production") {
  console.error("❌ Seed bloqueado em produção (NODE_ENV=production).");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: loadEnvValue("DATABASE_URL") });
const prisma = new PrismaClient({ adapter });

// ── limpeza (--reset) — ordem respeita FKs (filhos antes dos pais) ──────────

async function reset() {
  console.log("🧹 Limpando tabelas de negócio…");
  // 🔴 FOLHAS PRIMEIRO. Estas tabelas apontam para booking, event, musician e
  // establishment — se qualquer uma sobrevive ao delete do pai, o Postgres
  // recusa com FK violation. Foi exatamente o que aconteceu ao semear escrow e
  // contrato pela primeira vez: `booking_escrows_bookingId_fkey` derrubou o
  // `--reset` inteiro.
  //
  // A ordem DENTRO do bloco também importa: output → job → upload em cada
  // subsistema de IA, e performed_songs → performances.
  await prisma.aiAudioSeparationOutput.deleteMany();
  await prisma.aiAudioSeparationJob.deleteMany();
  await prisma.aiAudioUpload.deleteMany();
  await prisma.aiCifraAnalysisJob.deleteMany();
  await prisma.aiCifraUpload.deleteMany();
  await prisma.audienceSpotifyLink.deleteMany();
  await prisma.bookingEscrow.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.musicianAnalytics.deleteMany();
  await prisma.establishmentAnalytics.deleteMany();
  await prisma.ranking.deleteMany();
  await prisma.performedSong.deleteMany();
  await prisma.performance.deleteMany();
  await prisma.review.deleteMany();
  // Folha: sem FK (alvos polimórficos, precedente de `reviews`/`user_scores`).
  await prisma.indication.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.requestVote.deleteMany();
  await prisma.requestFeedback.deleteMany();
  /*
   * 🔴 `musicRequest` ANTES de `tip`, e não por acaso: desde 27/ago/2026 o
   * pedido aponta para a gorjeta do destaque
   * (`music_requests.boostTipId -> tips.id`). Inverter derruba o `--reset`
   * inteiro com violação de FK — a mesma armadilha já registrada para
   * `booking_escrows`/`contracts`/`performances`.
   */
  await prisma.musicRequest.deleteMany();
  await prisma.tip.deleteMany();
  await prisma.transaction.deleteMany();
  // Bloco 19.B — folhas de `audiences`/`events` (cascade cobriria, mas a
  // ordem explícita é a convenção deste reset).
  await prisma.notificationDelivery.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.eventAttendee.deleteMany();
  await prisma.eventMusician.deleteMany();
  await prisma.inquiry.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.event.deleteMany();
  await prisma.musicianUnavailability.deleteMany();
  await prisma.musicianAvailabilityRule.deleteMany();
  await prisma.musicianCalendarSettings.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.userBadge.deleteMany();
  await prisma.userInteraction.deleteMany();
  await prisma.userPoints.deleteMany();
  await prisma.userScore.deleteMany();
  await prisma.repertoireInvitee.deleteMany();
  await prisma.repertoireSong.deleteMany();
  await prisma.repertoire.deleteMany();
  // Antes de music_library: a FK cascateia, mas apagar explicitamente mantém
  // a ordem legível e falha alto se o cascade mudar em alguma migration.
  await prisma.personalChordSheet.deleteMany();
  await prisma.musicLibrary.deleteMany();
  await prisma.badge.deleteMany();
  await prisma.bandMember.deleteMany();
  await prisma.bandAvailabilityRule.deleteMany();
  await prisma.bandUnavailability.deleteMany();
  await prisma.bandCalendarSettings.deleteMany();
  await prisma.band.deleteMany();
  await prisma.musicianWallet.deleteMany();
  await prisma.establishmentProfile.deleteMany();
  await prisma.establishment.deleteMany();
  await prisma.audience.deleteMany();
  await prisma.musicianProfile.deleteMany();
  await prisma.musician.deleteMany();

  await purgeSeedStorage();
}

/**
 * Apaga TUDO que o seed escreveu no bucket de mídia — e só isso.
 *
 * 🔴 **O `--reset` limpa o BANCO; sem isto o bucket vira lixão.** A chave de
 * cada envio é um uuid novo (o CDN cacheia por caminho), então cada rodada
 * deixaria mais um WAV de ~1,5 MB sem nada apontando para ele.
 *
 * 🔴 **Varre o prefixo `seed/`, NUNCA `musicians/`.** O bucket é o mesmo que o
 * app usa: em R2 ele já guarda avatares e cardápios enviados pelas telas, e um
 * áudio subido pelo app para teste tem chave idêntica à do seed. Apagar por
 * `musicians/*` levaria junto o que não é nosso; apagar por `seed/` é exato.
 *
 * Degrada em silêncio: storage fora do ar não pode impedir o reset do banco.
 */
async function purgeSeedStorage(): Promise<void> {
  const media = await createSeedMusicianStorage();
  if (!media.available || !media.s3) return;

  try {
    let token: string | undefined;
    let removed = 0;

    do {
      const page = await media.s3.send(
        new ListObjectsV2Command({
          Bucket: media.bucket,
          Prefix: SEED_STORAGE_PREFIX,
          ContinuationToken: token,
        }),
      );

      const keys = (page.Contents ?? [])
        .map((object) => object.Key)
        .filter((key): key is string => !!key);

      if (keys.length > 0) {
        // `DeleteObjects` aceita até 1000 chaves por chamada — o mesmo teto da
        // página do `ListObjectsV2`, então uma página nunca estoura o limite.
        await media.s3.send(
          new DeleteObjectsCommand({
            Bucket: media.bucket,
            Delete: { Objects: keys.map((Key) => ({ Key })) },
          }),
        );
        removed += keys.length;
      }

      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);

    console.log(
      removed > 0
        ? `   🧹 ${removed} objeto(s) removido(s) de ${media.bucket}/${SEED_STORAGE_PREFIX}`
        : `   🧹 ${media.bucket}/${SEED_STORAGE_PREFIX} já estava vazio.`,
    );
  } catch (error) {
    console.warn(
      `   ⚠️ Não foi possível limpar ${SEED_STORAGE_PREFIX} (${(error as Error).message}).`,
    );
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

// CNPJ válido determinístico a partir de uma base de 12 dígitos (o fake
// builder usa um CNPJ fixo — colidiria no unique index com múltiplas casas).
function cnpjFromBase(base12: string): string {
  const digits = base12.split("").map(Number);
  const calc = (nums: number[]) => {
    const weights = nums.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = nums.reduce((acc, n, i) => acc + n * weights[i], 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const d1 = calc(digits);
  const d2 = calc([...digits, d1]);
  return `${base12}${d1}${d2}`;
}

// Timeline no MESMO espaço de coordenadas que o GET .../chord-sheet consome
// ({symbol, startMs, endMs}). Derivar do BPM em vez de cravar ms na mão mantém
// acorde e letra alinhados quando a progressão muda.
function buildChordTimeline(opts: {
  progression: string[];
  bpm: number;
  bars: number;
  beatsPerChord?: number;
  startMs?: number;
}): { symbol: string; startMs: number; endMs: number; confidence: number }[] {
  const msPerChord = Math.round(
    (60000 / opts.bpm) * (opts.beatsPerChord ?? 4),
  );
  const timeline: {
    symbol: string;
    startMs: number;
    endMs: number;
    confidence: number;
  }[] = [];
  let cursor = opts.startMs ?? 0;
  for (let bar = 0; bar < opts.bars; bar++) {
    timeline.push({
      symbol: opts.progression[bar % opts.progression.length],
      startMs: cursor,
      endMs: cursor + msPerChord,
      // Confiança alta e fixa: o seed simula uma análise já revisada, não a
      // incerteza do modelo (que oscila entre execuções).
      confidence: 0.93,
      });
    cursor += msPerChord;
  }
  return timeline;
}

// Seções (intro/verso/refrão) sobre a timeline — a UI usa para os badges de
// transição. Divide em 3 blocos de acordes; o último vai até o fim da música.
function buildSections(
  timeline: { startMs: number; endMs: number }[],
  durationMs: number,
): { label: string; startMs: number; endMs: number; confidence: number }[] {
  if (timeline.length === 0) return [];
  const labels = ["Intro", "Verso", "Refrão"];
  const perSection = Math.ceil(timeline.length / labels.length);
  return labels.map((label, index) => {
    const slice = timeline.slice(index * perSection, (index + 1) * perSection);
    const first = slice[0] ?? timeline[timeline.length - 1];
    const last = slice[slice.length - 1] ?? first;
    return {
      label,
      startMs: first.startMs,
      endMs: index === labels.length - 1 ? durationMs : last.endMs,
      confidence: 0.88,
    };
  });
}

// LRC cru no formato que o provedor real entrega — o LrcParser normaliza.
function buildLrc(lines: [number, string][]): string {
  return lines
    .map(([seconds, text]) => {
      const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
      const ss = String(Math.floor(seconds % 60)).padStart(2, "0");
      const cs = String(Math.round((seconds % 1) * 100)).padStart(2, "0");
      return `[${mm}:${ss}.${cs}]${text}`;
    })
    .join("\n");
}

// CPF válido determinístico (mesmo motivo do `cnpjFromBase`): a emissão do
// contrato exige documento, o VO confere os dígitos e a coluna é UNIQUE.
function cpfFromBase(base9: string): string {
  const digits = base9.split("").map(Number);
  const calc = (nums: number[]) => {
    const sum = nums.reduce((acc, n, i) => acc + n * (nums.length + 1 - i), 0);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  const d1 = calc(digits);
  const d2 = calc([...digits, d1]);
  return `${base9}${d1}${d2}`;
}

// 🔴 TODA data do seed é relativa ao instante em que ele roda — nunca uma data
// fixa. Rodar `npm run seed -- --reset` de novo recoloca tudo no futuro certo.
// (A única data fixa que existia vinha do `Contract.fake()`, que carimbava
// "12 de setembro de 2026" em todo contrato; ver seção 21.)
const daysFromNow = (days: number, hour = 20) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
};

// Para o que precisa estar "acontecendo agora" independentemente da hora em
// que o seed roda. `daysFromNow(0, 19)` deixava o evento ao vivo no FUTURO para
// quem semeava de manhã e já encerrado para quem semeava depois das 23h.
const hoursFromNow = (hours: number) =>
  new Date(Date.now() + hours * 60 * 60 * 1000);

// Primeiro `weekday` (0 = domingo) a partir de `minDays` dias. Para propostas
// que o app vai CONFIRMAR: `ConfirmBookingUseCase` revalida a agenda do alvo, e
// uma data fora das regras semanais faria o botão falhar com "indisponível".
const nextWeekday = (minDays: number, weekday: number, hour: number) => {
  const d = daysFromNow(minDays, hour);
  d.setDate(d.getDate() + ((weekday - d.getDay() + 7) % 7));
  return d;
};
const plusHours = (date: Date, hours: number) =>
  new Date(date.getTime() + hours * 60 * 60 * 1000);

// ── usuários Keycloak de teste ───────────────────────────────────────────────

const KEYCLOAK_SEED_PASSWORD = "Seed@123";

type KeycloakSeedUser = {
  email: string;
  name: string;
  // `establishment` é papel de realm igual aos outros (Docs/autenticacao/keycloak.md
  // §87). A diferença não está aqui: é que o `sub` NÃO vira o id do aggregate
  // do estabelecimento — ele tem UUID próprio, e quem autoriza é o claim
  // `establishment_ids`, escrito logo após a seção 2.
  //
  // `admin` é o único papel SEM aggregate correspondente: é papel de operação,
  // não persona de produto. `support` existe no realm e fica de fora até haver
  // rota que o exija — semear login sem rota é dado que ninguém consegue usar.
  role: "musician" | "audience" | "establishment" | "admin";
};

// Cliente admin do realm. Extraído de seedKeycloakUsers porque o vínculo de
// banda (band_ids, ver seedBandClaims) também precisa dele — sem esse claim o
// líder recebe 403 do BandOwnershipGuard na própria banda.
async function createKeycloakAdminClient(): Promise<AxiosInstance> {
  const baseUrl = loadEnvValue("KEYCLOAK_URL", "http://localhost:8080").replace(/\/$/, "");
  const realm = loadEnvValue("KEYCLOAK_REALM", "soundmeet");
  const adminRealm = loadEnvValue("KEYCLOAK_ADMIN_REALM", "master");

  const { data: token } = await axios.post(
    `${baseUrl}/realms/${adminRealm}/protocol/openid-connect/token`,
    new URLSearchParams({
      grant_type: "password",
      client_id: "admin-cli",
      username: loadEnvValue("KEYCLOAK_ADMIN_USERNAME", "admin"),
      password: loadEnvValue("KEYCLOAK_ADMIN_PASSWORD", "admin123"),
    }),
    { timeout: 5000 },
  );

  return axios.create({
    baseURL: `${baseUrl}/admin/realms/${realm}`,
    headers: { Authorization: `Bearer ${token.access_token}` },
    timeout: 5000,
  });
}

/**
 * Acrescenta um valor a um atributo multivalorado do usuário (read-modify-write
 * — o Keycloak não tem append), igual ao KeycloakAdminGateway.addClaimValue.
 *
 * Estabelecimento e banda têm UUID próprio, distinto do `sub` do JWT: é o claim
 * que liga a conta ao agregado. O seed insere as bandas pelo repositório, então
 * ninguém escreve esse claim por ele — sem esta chamada, o líder loga, vê a
 * banda na lista e não enxerga os shows nem os contratos dela.
 */
async function addKeycloakClaimValue(
  admin: AxiosInstance,
  userId: string,
  attribute: "establishment_ids" | "band_ids",
  value: string,
): Promise<void> {
  const { data: user } = await admin.get(`/users/${userId}`);
  const attributes: Record<string, unknown> = user.attributes ?? {};
  // O Keycloak devolve string[], mas um valor gravado à mão pela console vem
  // como string crua — os dois formatos são normalizados (igual ao gateway).
  const raw: unknown = attributes[attribute];
  const current = Array.isArray(raw)
    ? raw.filter((v): v is string => typeof v === "string")
    : typeof raw === "string" && raw.length > 0
      ? [raw]
      : [];
  if (current.includes(value)) return;

  await admin.put(`/users/${userId}`, {
    attributes: { ...attributes, [attribute]: [...current, value] },
  });
}

// Cria os usuários e retorna o sub gerado por e-mail — o Keycloak (22+) ignora
// id explícito tanto no POST /users quanto no partialImport, então o fluxo é o
// mesmo do RegisterUseCase: cria no realm primeiro e o sub vira o id do
// aggregate. Usa o admin do master (mesmos defaults do scripts/keycloak-sync.mjs).
async function seedKeycloakUsers(
  admin: AxiosInstance,
  users: KeycloakSeedUser[],
): Promise<Map<string, string>> {
  const subs = new Map<string, string>();
  for (const user of users) {
    // Remove usuário anterior com o mesmo e-mail — o seed regenera os aggregates
    // e o sub antigo deixaria de casar com os novos ids nos ownership guards.
    const { data: existing } = await admin.get<{ id: string }[]>("/users", {
      params: { email: user.email, exact: true },
    });
    for (const found of existing) {
      await admin.delete(`/users/${found.id}`);
    }

    // emailVerified/requiredActions espelham o registro real (Docs/autenticacao/login-e-cadastro.md).
    const created = await admin.post("/users", {
      username: user.email,
      email: user.email,
      firstName: user.name,
      enabled: true,
      emailVerified: true,
      requiredActions: [],
      credentials: [
        { type: "password", value: KEYCLOAK_SEED_PASSWORD, temporary: false },
      ],
    });

    const sub = (created.headers["location"] as string | undefined)
      ?.split("/")
      .pop();
    if (!sub) {
      throw new Error(`Keycloak não retornou o id criado para ${user.email}`);
    }

    const { data: role } = await admin.get(`/roles/${user.role}`);
    await admin.post(`/users/${sub}/role-mappings/realm`, [role]);

    subs.set(user.email, sub);
  }
  return subs;
}

/**
 * Um PDF de cardápio de verdade — pequeno, válido e legível.
 *
 * Escrito à mão (PDF 1.4, uma página, Helvetica com `WinAnsiEncoding`) em vez
 * de uma lib: o seed não precisa de dependência nova para produzir um arquivo
 * que o `detectFileMime` reconheça pelos magic bytes (`%PDF-`) e que o leitor do
 * celular abra. `WinAnsiEncoding` + `latin1` é o que faz "Feijoada" e "Caipirinha
 * de limão" saírem com acento.
 *
 * Os offsets da tabela `xref` são CALCULADOS sobre os bytes já montados —
 * xref errada abre em alguns leitores e em outros não, que é o pior tipo de
 * falha para quem está testando.
 */
function synthesizeMenuPdf(title: string, sections: { heading: string; items: [string, string][] }[]): Buffer {
  const esc = (t: string) => t.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const ops: string[] = ["BT", "/F1 22 Tf", "56 780 Td", `(${esc(title)}) Tj`, "/F1 10 Tf", "0 -18 Td", "(Cardapio de exemplo gerado pelo seed de desenvolvimento) Tj"];
  for (const section of sections) {
    ops.push("/F1 14 Tf", "0 -34 Td", `(${esc(section.heading)}) Tj`, "/F1 11 Tf");
    for (const [item, price] of section.items) {
      ops.push("0 -20 Td", `(${esc(`${item} ....... ${price}`)}) Tj`);
    }
  }
  ops.push("ET");
  const content = ops.join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];

  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(body, "latin1"));
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefAt = Buffer.byteLength(body, "latin1");
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}

/**
 * Gera um WAV PCM de ~35s — o áudio de apresentação dos músicos semeados.
 *
 * **Por que sintetizar em vez de commitar um arquivo:** um MP3 de verdade no
 * repositório é binário versionado, com dono e licença a resolver, para um dado
 * de desenvolvimento. O WAV nasce aqui, é determinístico e não entra no git.
 *
 * PCM 16-bit mono a 22,05 kHz dá ~1,5 MB em 35s — dentro do teto de 10 MB do
 * upload, e o `file-type` identifica o cabeçalho RIFF como `audio/wav`, que
 * está na allowlist. **É o mesmo caminho do upload de verdade**: o seed grava
 * este buffer num arquivo temporário, roda os MESMOS helpers do controller
 * (magic bytes + duração) e chama o use-case real.
 *
 * O conteúdo é um arpejo simples com harmônico e envelope por nota — não é
 * música, e não precisa ser: o que ele exercita é o player, a CSP, a política
 * do bucket e o cálculo de duração.
 */
function synthesizePresentationWav(seed: number): Buffer {
  const sampleRate = 22050;
  const durationSeconds = 35;
  const totalSamples = sampleRate * durationSeconds;

  // Três arpejos diferentes, escolhidos pelo índice do músico: dois cartões
  // tocando exatamente o mesmo áudio esconderiam justamente o bug de estar
  // tocando o áudio do vizinho.
  const scales = [
    [196.0, 246.94, 293.66, 392.0], // Sol maior
    [220.0, 261.63, 329.63, 440.0], // Lá menor
    [174.61, 220.0, 261.63, 349.23], // Fá maior
  ];
  const notes = scales[seed % scales.length]!;

  const header = Buffer.alloc(44);
  const dataBytes = totalSamples * 2;
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataBytes, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // tamanho do bloco fmt
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits por amostra
  header.write("data", 36);
  header.writeUInt32LE(dataBytes, 40);

  const pcm = Buffer.alloc(dataBytes);
  const noteSamples = Math.floor(sampleRate * 0.5);

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const noteIndex = Math.floor(i / noteSamples) % notes.length;
    const freq = notes[noteIndex]!;
    const inNote = (i % noteSamples) / noteSamples;
    // Envelope por nota (ataque curto, decaimento longo) + fade nos extremos do
    // arquivo: um corte seco vira estalo alto no fone de quem testar.
    const envelope = Math.min(1, inNote * 12) * Math.pow(1 - inNote, 1.4);
    const fade = Math.min(1, t / 0.4, (durationSeconds - t) / 1.2);
    const wave =
      Math.sin(2 * Math.PI * freq * t) * 0.6 +
      Math.sin(2 * Math.PI * freq * 2 * t) * 0.22 +
      Math.sin(2 * Math.PI * freq * 3 * t) * 0.08;
    const value = Math.max(-1, Math.min(1, wave * envelope * fade * 0.7));
    pcm.writeInt16LE(Math.round(value * 32767), i * 2);
  }

  return Buffer.concat([header, pcm]);
}

/**
 * Tudo que o seed escreve no bucket de mídia vive sob este prefixo.
 *
 * 🔴 **É o que torna a limpeza do `--reset` segura.** O bucket é COMPARTILHADO
 * com o que o app grava de verdade — hoje, no R2 deste projeto, ele já tem
 * avatares de músico e PDFs de cardápio enviados pelas telas. Varrer
 * `musicians/<id>/presentation-audio/` apagaria junto o áudio que alguém subiu
 * pelo app para testar, e pela chave o seed não tem como distinguir um do
 * outro. Com prefixo próprio, "apagar o que o seed criou" é operação exata.
 */
const SEED_STORAGE_PREFIX = "seed/";

/**
 * Envelopa um storage real prefixando TODA chave com `seed/`.
 *
 * Decorator, e não um parâmetro no use-case: o caminho do objeto
 * (`musicians/<id>/presentation-audio/<uuid>.<ext>`) é decisão de domínio e
 * continua igual para o app. Quem desloca é o chamador — assim o seed exercita
 * o use-case real, byte a byte, sem que o domínio saiba que existe seed.
 */
function withSeedPrefix(inner: IMusicianStorage): IMusicianStorage {
  return {
    putObject: (input) =>
      inner.putObject({
        ...input,
        object_key: `${SEED_STORAGE_PREFIX}${input.object_key}`,
      }),
    deleteObject: (input) =>
      inner.deleteObject({
        object_key: `${SEED_STORAGE_PREFIX}${input.object_key}`,
      }),
    getPublicUrl: (objectKey) =>
      inner.getPublicUrl(`${SEED_STORAGE_PREFIX}${objectKey}`),
  };
}

/**
 * Storage de mídia do músico para o seed.
 *
 * 🔴 **Segue o MESMO `ESTABLISHMENT_STORAGE_PROVIDER` que o app** — correção de
 * 17/set/2026. A primeira versão só escrevia em MinIO e descartava o resto,
 * copiando `createSeedContractStorage`. Lá a regra faz sentido: o PDF é
 * derivado, e o contrato continua íntegro sem ele. Aqui não — neste ambiente o
 * provider é **`cloudflare_r2`**, então o seed não gravava nada, nenhum músico
 * ficava com áudio, e a feature era intestável pelo app. Semear sem escrever é
 * o oposto do motivo de semear.
 *
 * O que torna aceitável gravar no bucket real é o `seed/` na frente de toda
 * chave: o que o seed cria fica isolado do que o app grava, e o `--reset` apaga
 * só o que criou.
 *
 * ⚠️ **Política de bucket é assunto de MinIO, não de R2.** O MinIO nasce
 * privado (`grep PutBucketPolicy` no repo não retornava nada) e o áudio é o
 * primeiro objeto que o BROWSER busca direto — sem liberar o prefixo, 403 e
 * player mudo. No R2 o acesso público vem do domínio `r2.dev`/custom já
 * configurado em `CLOUDFLARE_R2_PUBLIC_BASE_URL`; não há política a aplicar.
 */
async function createSeedMusicianStorage(): Promise<{
  storage: IMusicianStorage;
  s3: S3Client | null;
  bucket: string;
  available: boolean;
  label: string;
}> {
  const discard: IMusicianStorage = {
    putObject: async () => undefined,
    deleteObject: async () => undefined,
    getPublicUrl: () => null,
  };
  const unavailable = {
    storage: discard,
    s3: null,
    bucket: "",
    available: false,
    label: "indisponível",
  };

  const provider = loadEnvValue("ESTABLISHMENT_STORAGE_PROVIDER", "minio");
  const region = loadEnvValue("AWS_REGION", "us-east-1");

  if (provider === "cloudflare_r2") {
    const bucket = loadEnvValue("CLOUDFLARE_R2_BUCKET", "");
    const endpoint = loadEnvValue("CLOUDFLARE_R2_ENDPOINT", "");
    const accessKeyId = loadEnvValue("CLOUDFLARE_R2_ACCESS_KEY_ID", "");
    const secretAccessKey = loadEnvValue("CLOUDFLARE_R2_SECRET_ACCESS_KEY", "");
    const publicBaseUrl = loadEnvValue("CLOUDFLARE_R2_PUBLIC_BASE_URL", "");

    if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) {
      console.warn(
        "   ⚠️ R2 sem credenciais completas — músicos ficam sem áudio de apresentação.",
      );
      return unavailable;
    }

    /*
     * Sem URL pública não adianta subir: o use-case recusa
     * (`ExternalServiceError`) justamente para não gravar uma URL que o player
     * não toca. Avisar aqui é mais claro que ver três falhas em sequência.
     */
    if (!publicBaseUrl) {
      console.warn(
        "   ⚠️ CLOUDFLARE_R2_PUBLIC_BASE_URL ausente — o áudio subiria sem URL tocável.",
      );
      return unavailable;
    }

    const s3 = new S3Client({
      region,
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });

    return {
      storage: withSeedPrefix(new S3MusicianStorage(s3, bucket, publicBaseUrl)),
      s3,
      bucket,
      available: true,
      label: `Cloudflare R2 · ${bucket}/${SEED_STORAGE_PREFIX}`,
    };
  }

  const bucket = loadEnvValue("MINIO_BUCKET", "soundmeet-media");
  // Endpoint PÚBLICO nas duas pontas: o seed roda no host (onde o nome de
  // serviço `minio` não resolve) e a URL gravada é a que o BROWSER vai buscar.
  const publicEndpoint = loadEnvValue("MINIO_PUBLIC_ENDPOINT", "localhost");
  const publicPort = loadEnvValue("MINIO_PUBLIC_PORT", "9000");
  const endpoint = `http://${publicEndpoint}:${publicPort}`;

  const s3 = new S3Client({
    region,
    endpoint,
    credentials: {
      accessKeyId: loadEnvValue("MINIO_ACCESS_KEY", "soundmeet"),
      secretAccessKey: loadEnvValue("MINIO_SECRET_KEY", "soundmeet123"),
    },
    forcePathStyle: true,
    // Sem isto o fallback abaixo nunca chega: no WSL em modo mirrored, porta
    // sem ninguém escutando não devolve RST — o SYN fica sem resposta e cada
    // chamada espera o timeout do kernel (~2 min) × 3 tentativas do SDK. Com
    // o MinIO parado, o seed parecia travado.
    requestHandler: { connectionTimeout: 3_000 },
  });

  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    try {
      await s3.send(new CreateBucketCommand({ Bucket: bucket }));
      console.log(`   🪣 Bucket ${bucket} criado no MinIO.`);
    } catch (error) {
      console.warn(
        `   ⚠️ MinIO indisponível (${(error as Error).message}) — músicos ficam sem áudio de apresentação.`,
      );
      return unavailable;
    }
  }

  try {
    await s3.send(
      new PutBucketPolicyCommand({
        Bucket: bucket,
        Policy: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Sid: "PublicReadSeedPresentationAudio",
              Effect: "Allow",
              Principal: { AWS: ["*"] },
              Action: ["s3:GetObject"],
              Resource: [
                `arn:aws:s3:::${bucket}/${SEED_STORAGE_PREFIX}musicians/*/presentation-audio/*`,
                // Avatar é `<img>` direto do bucket no web — mesmo 403 sem isto.
                `arn:aws:s3:::${bucket}/${SEED_STORAGE_PREFIX}musicians/*/avatar/*`,
                // Cardápio: o app do fã abre a URL direto no navegador do celular.
                `arn:aws:s3:::${bucket}/${SEED_STORAGE_PREFIX}establishments/*/menu-pdf/*`,
              ],
            },
          ],
        }),
      }),
    );
  } catch (error) {
    console.warn(
      `   ⚠️ Não foi possível liberar a leitura do prefixo no MinIO (${(error as Error).message}) — o player vai receber 403.`,
    );
  }

  return {
    storage: withSeedPrefix(
      new S3MusicianStorage(s3, bucket, `${endpoint}/${bucket}`),
    ),
    s3,
    bucket,
    available: true,
    label: `MinIO · ${bucket}/${SEED_STORAGE_PREFIX}`,
  };
}

/**
 * Storage do PDF do contrato para a emissão semeada.
 *
 * O seed emite pelo `IssueContractUseCase` de verdade (seção 21), que grava o
 * PDF antes de persistir. Em desenvolvimento o provider é o MinIO, e o bucket
 * `soundmeet-contracts` NÃO é criado por ninguém — sem esta função nem a
 * emissão pelo próprio app funciona em dev (`NoSuchBucket` no `putObject`).
 *
 * Só toca MinIO local. Com R2/S3 configurado o seed NÃO escreve em bucket
 * remoto: descarta o PDF e avisa. O contrato continua íntegro (snapshot +
 * hash); só o download do documento responde 404.
 */
async function createSeedContractStorage(): Promise<{
  storage: IContractStorage;
  pdfAvailable: boolean;
}> {
  const discard: IContractStorage = {
    putObject: async () => undefined,
    getObject: async () => null,
    deleteObject: async () => undefined,
  };

  const provider = loadEnvValue("CONTRACT_STORAGE_PROVIDER", "minio");
  if (provider !== "minio") {
    console.warn(
      `   ⚠️ CONTRACT_STORAGE_PROVIDER=${provider}: o seed não grava em bucket remoto — PDFs descartados.`,
    );
    return { storage: discard, pdfAvailable: false };
  }

  // Endpoint PÚBLICO: o seed roda no host, onde `minio` (nome do serviço no
  // compose) não resolve. O app, dentro da rede do compose, lê o mesmo bucket.
  const bucket = loadEnvValue("CONTRACT_STORAGE_BUCKET", "soundmeet-contracts");
  const s3 = new S3Client({
    region: loadEnvValue("AWS_REGION", "us-east-1"),
    endpoint: `http://${loadEnvValue("MINIO_PUBLIC_ENDPOINT", "localhost")}:${loadEnvValue("MINIO_PUBLIC_PORT", "9000")}`,
    credentials: {
      accessKeyId: loadEnvValue("MINIO_ACCESS_KEY", "soundmeet"),
      secretAccessKey: loadEnvValue("MINIO_SECRET_KEY", "soundmeet123"),
    },
    forcePathStyle: true,
    // Mesmo motivo do cliente de mídia acima: sem timeout de conexão, MinIO
    // parado trava o seed em "Contratos…" em vez de cair no descarte.
    requestHandler: { connectionTimeout: 3_000 },
  });

  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    try {
      await s3.send(new CreateBucketCommand({ Bucket: bucket }));
      console.log(`   🪣 Bucket ${bucket} criado no MinIO.`);
    } catch (error) {
      console.warn(
        `   ⚠️ MinIO indisponível (${(error as Error).message}) — contratos emitidos sem PDF (download responde 404).`,
      );
      return { storage: discard, pdfAvailable: false };
    }
  }

  return { storage: new S3ContractStorage(s3, bucket), pdfAvailable: true };
}

// ── seed ─────────────────────────────────────────────────────────────────────

async function main() {
  if (process.argv.includes("--reset")) await reset();

  // SM-016: pixKey de tip/wallet é gravado cifrado (AES-256-GCM) pelos mappers.
  // Precisa ser a MESMA chave que a app usa em runtime — cifrar o seed com
  // outra deixaria a chave PIX ilegível na tela da carteira.
  const encryption = new AesGcmEncryptionService(
    loadEnvValue("TOKEN_ENCRYPTION_KEY"),
  );

  const musicianRepo = new MusicianPrismaRepository(prisma);
  const walletRepo = new MusicianWalletPrismaRepository(
    prisma,
    undefined,
    encryption,
  );
  const subscriptionRepo = new SubscriptionPrismaRepository(prisma);
  const establishmentRepo = new EstablishmentPrismaRepository(prisma);
  const audienceRepo = new AudiencePrismaRepository(prisma);
  const eventRepo = new EventPrismaRepository(prisma);
  const availabilityRepo = new AvailabilityPrismaRepository(prisma);
  const bookingRepo = new BookingPrismaRepository(prisma);
  const inquiryRepo = new InquiryPrismaRepository(prisma);
  const requestRepo = new RequestPrismaRepository(prisma);
  const tipRepo = new TipPrismaRepository(prisma, undefined, encryption);
  const conversationRepo = new ConversationPrismaRepository(prisma);
  const messageRepo = new MessagePrismaRepository(prisma);
  const eventMusicianRepo = new EventMusicianPrismaRepository(prisma);
  const eventAttendeeRepo = new EventAttendeePrismaRepository(prisma);
  const requestVoteRepo = new RequestVotePrismaRepository(prisma);
  const transactionRepo = new TransactionPrismaRepository(prisma);
  const musicLibraryRepo = new MusicLibraryPrismaRepository(prisma);
  const repertoireRepo = new RepertoirePrismaRepository(prisma);
  const badgeRepo = new BadgePrismaRepository(prisma);
  const userBadgeRepo = new UserBadgePrismaRepository(prisma);
  const userScoreRepo = new UserScorePrismaRepository(prisma);
  const userPointsRepo = new UserPointsPrismaRepository(prisma);
  const userInteractionRepo = new UserInteractionPrismaRepository(prisma);
  const bandRepo = new BandPrismaRepository(prisma);
  const personalChordSheetRepo = new PersonalChordSheetPrismaRepository(prisma);
  // Mesmo caminho da app: a cifra que o Play Mode mostra sai daqui, e é dela
  // que o fingerprint do fork é calculado (nunca do Json cru de music_library).
  const getChordSheet = new GetChordSheetForMusicLibraryUseCase(
    new ChordSheetPrismaReadModel(prisma),
  );

  // ── 0. Usuários Keycloak de teste (sub gerado vira o id do aggregate) ─────
  console.log("🔑 Usuários Keycloak de teste…");
  let keycloakSubs = new Map<string, string>();
  let keycloakAdmin: AxiosInstance | null = null;
  try {
    keycloakAdmin = await createKeycloakAdminClient();
    // TODAS as personas ganham login. Até 22/ago só existiam dois usuários
    // (musico1 e fa1): os outros 10 perfis existiam no banco mas ninguém
    // conseguia entrar como eles — e, pior, NENHUM estabelecimento tinha conta,
    // o que deixava o `soundmeet-web` inteiro (que é a persona estabelecimento)
    // impossível de testar com os dados semeados.
    //
    // O papel `establishment` não define o id do aggregate: estabelecimento tem
    // UUID próprio e a autorização vem do claim `establishment_ids`, escrito
    // logo depois da seção 2. Músico e fã, sim, herdam o `sub` como id.
    keycloakSubs = await seedKeycloakUsers(keycloakAdmin, [
      { email: "musico1@seed-soundmeet.com", name: "João Violão", role: "musician" },
      { email: "musico2@seed-soundmeet.com", name: "Maria Voz", role: "musician" },
      { email: "musico3@seed-soundmeet.com", name: "Carlos Teclas", role: "musician" },
      { email: "musico4@seed-soundmeet.com", name: "Ana Percussão", role: "musician" },
      { email: "musico5@seed-soundmeet.com", name: "Rafael Sax", role: "musician" },
      { email: "musico6@seed-soundmeet.com", name: "Beatriz Cordas", role: "musician" },
      { email: "musico7@seed-soundmeet.com", name: "Diego Eletrônico", role: "musician" },
      { email: "musico8@seed-soundmeet.com", name: "Helena Clássica", role: "musician" },
      { email: "fa1@seed-soundmeet.com", name: "Ana Fã", role: "audience" },
      { email: "fa2@seed-soundmeet.com", name: "Bruno Superfã", role: "audience" },
      { email: "bar1@seed-soundmeet.com", name: "Bar do Zé", role: "establishment" },
      { email: "rest1@seed-soundmeet.com", name: "Restaurante Maresia", role: "establishment" },
      { email: "club1@seed-soundmeet.com", name: "Lapa Music Hall", role: "establishment" },
      { email: "bar2@seed-soundmeet.com", name: "Savassi Jazz Bar", role: "establishment" },
      // 🔴 Admin: 12 rotas `@Roles("admin")` não tinham como ser exercidas —
      // takedown de cifra da comunidade (o kill-switch de emergência do Bloco
      // 8), as 4 rotas de gestão de badges e a anulação de contrato, entre
      // outras. A role sempre existiu no realm; faltava alguém com ela.
      //
      // Não tem aggregate correspondente DE PROPÓSITO: admin é papel de
      // operação, não persona de produto. Nada em `src/` procura um
      // `Musician`/`Audience` pelo sub de um admin, então a ausência de linha
      // no banco é o estado correto, não uma lacuna.
      { email: "admin@seed-soundmeet.com", name: "Admin SoundMeet", role: "admin" },
    ]);
  } catch (error) {
    const message = axios.isAxiosError(error)
      ? `${error.response?.status ?? error.code}: ${JSON.stringify(error.response?.data ?? "")}`
      : (error as Error).message;
    keycloakAdmin = null;
    console.warn(`   ⚠️ Falha ao criar usuários no Keycloak (${message}).`);
    console.warn("   Suba o Keycloak e rode o seed de novo com --reset para criar os logins de teste.");
  }

  // ── 1. Músicos (3 tiers: free / essential / pro) ──────────────────────────
  console.log("🎸 Músicos…");
  const musicianSpecs = [
    {
      name: "João Violão", stage: "João do Blues", tier: MusicianPlanTier.FREE,
      email: "musico1@seed-soundmeet.com",
      genres: ["Blues", "Rock"], instruments: ["Violão", "Guitarra"],
      city: "São Paulo", state: "SP", cep: "01310100",
      street: "Avenida Paulista", number: "1578", neighborhood: "Bela Vista",
      lat: -23.5614, lng: -46.6559,
      ranges: [
        new PriceRange({ model: "per_hour", min: 120, max: 250, notes: "Inclui equipamento de som" }),
        new PriceRange({ model: "per_event", min: 600, max: 1200 }),
      ],
      // Opt-in de radar (jul/2026): variando os 3 estados entre os músicos
      // seed pra QA manual da busca de estabelecimento cobrir os três casos
      // sem precisar editar nada na mão. João é o único com login Keycloak
      // real — true de propósito, senão a busca/hiring-dashboard aparecem
      // vazios pra quem testar o app logo após rodar o seed.
      openToGigs: true as boolean | null,
      pushToken: { token: "ExponentPushToken[seed-joao-do-blues]", platform: "android" as const },
      // Documento + subconta de custódia: sem CPF a emissão do contrato volta
      // `missing: ["contratado.cpf"]`, e sem subconta `CreateBookingEscrowUseCase`
      // recusa com `no_subaccount`. Ver seções 21 e 22.
      cpf: cpfFromBase("390533447"),
      escrowSubaccount: true,
    },
    {
      name: "Maria Voz", stage: "Maria Bossa", tier: MusicianPlanTier.ESSENTIAL,
      email: "musico2@seed-soundmeet.com",
      genres: ["MPB", "Bossa Nova"], instruments: ["Voz", "Violão"],
      city: "Rio de Janeiro", state: "RJ", cep: "20021130",
      street: "Avenida Rio Branco", number: "156", neighborhood: "Centro",
      lat: -22.9035, lng: -43.1771,
      ranges: [new PriceRange({ model: "per_event", min: 800, max: 2000 })],
      // false explícito — opt-out consciente, pra QA validar que ela NÃO
      // aparece em nenhuma busca mesmo tendo perfil completo.
      openToGigs: false as boolean | null,
      pushToken: { token: "ExponentPushToken[seed-maria-bossa]", platform: "ios" as const },
      cpf: cpfFromBase("285471360"),
      escrowSubaccount: true,
      // Chave PIX trocada AGORA: o saque dela cai na carência antifraude
      // (`PIX_KEY_CHANGE_COOLDOWN_HOURS`, 24h) mesmo com saldo acima do mínimo
      // do ESSENTIAL. É o único jeito de ver o bloqueio sem trocar a chave na mão.
      pixKeyJustChanged: true,
    },
    {
      name: "Carlos Teclas", stage: "Carlão do Piano", tier: MusicianPlanTier.PRO,
      email: "musico3@seed-soundmeet.com",
      genres: ["Jazz", "Samba"], instruments: ["Teclado", "Piano"],
      city: "Belo Horizonte", state: "MG", cep: "30130010",
      street: "Praça Sete de Setembro", number: "1", neighborhood: "Centro",
      lat: -19.9191, lng: -43.9386,
      ranges: [new PriceRange({ model: "per_hour", min: 200, max: 400 })],
      // null — ainda não decidiu (estado tri-state default). Cobre o caso
      // "músico recém-criado, some da busca até decidir".
      openToGigs: null as boolean | null,
      pushToken: { token: "ExponentPushToken[seed-carlao-do-piano]", platform: "android" as const },
      // Único músico que RECUSA pedido fora do repertório (migration
      // 20260909120000). Ver a justificativa da escolha no laço abaixo.
      acceptsRequestsOutsideRepertoire: false,
      // MEI com CPF: o CPF é o que o qualifica como LÍDER no contrato da
      // Carlão Trio (banda contrata pelo líder pessoa física, mesmo com MEI).
      cpf: cpfFromBase("620384915"),
      cnpj: cnpjFromBase("334445550001"),
    },

    // ── Elenco de busca (W3.1, soundmeet-web) ────────────────────────────────
    //
    // Os três acima existem para cobrir o tri-state de `open_to_gigs` e NÃO
    // devem ser alterados — mexer neles apaga a cobertura de QA descrita acima.
    // O problema é que sobra UM único músico visível na busca, e com um
    // resultado só não dá para exercitar filtro de gênero, de instrumento,
    // faixa de preço, ordenação nem paginação: a tela "funciona" sem provar
    // nada.
    //
    // Estes existem para isso. Todos com `openToGigs: true` e variados de
    // propósito em gênero, instrumento, preço e DISTÂNCIA — a busca por raio
    // (filter[lat]/[lng]/[radius_km]) só é testável de verdade se houver quem
    // fique de fora. Referência de distância é o Bar do Zé (Rua Augusta, SP:
    // -23.5537, -46.6524), que é o estabelecimento seedado com login real.
    //
    // ⚠️ Gêneros e instrumentos SÓ da taxonomia que o app usa
    // (`soundmeet-mobile/src/features/musician/domain/musician.constants.ts`,
    // espelhada em `soundmeet-web/src/features/artist/domain/music-taxonomy.ts`).
    // O filtro do backend é `hasSome`, ou seja, igualdade exata de string: um
    // valor fora da lista existe no banco mas é INALCANÇÁVEL pelos filtros da
    // UI, e o sintoma é "o músico existe mas a busca não acha" — sem erro
    // nenhum. Não usar a `VALID_GENRES` de `audience-preferences.vo.ts`: ela é
    // privada, vale só para o público e está em inglês.
    {
      name: "Ana Percussão", stage: "Ana Batuque", tier: MusicianPlanTier.FREE,
      email: "musico4@seed-soundmeet.com",
      genres: ["Samba", "Pagode"], instruments: ["Percussão", "Cajón"],
      // ~2 km do Bar do Zé — entra em qualquer raio.
      city: "São Paulo", state: "SP", cep: "05435000",
      street: "Rua Harmonia", number: "500", neighborhood: "Vila Madalena",
      lat: -23.5545, lng: -46.6890,
      ranges: [new PriceRange({ model: "per_hour", min: 90, max: 180 })],
      openToGigs: true as boolean | null,
      ratingProjection: { average: 4.8, total: 27 },
    },
    {
      name: "Rafael Sax", stage: "Rafa Sax", tier: MusicianPlanTier.PRO,
      email: "musico5@seed-soundmeet.com",
      genres: ["Jazz", "Blues"], instruments: ["Saxofone", "Sopros"],
      // ~1 km — mesmo bairro do bar.
      city: "São Paulo", state: "SP", cep: "01310200",
      street: "Alameda Santos", number: "700", neighborhood: "Cerqueira César",
      lat: -23.5628, lng: -46.6540,
      ranges: [
        new PriceRange({ model: "per_hour", min: 250, max: 500 }),
        new PriceRange({ model: "per_event", min: 1500, max: 3000, notes: "Mínimo 3h" }),
      ],
      openToGigs: true as boolean | null,
      ratingProjection: { average: 4.2, total: 11 },
      // MEI SEM CPF cadastrado: exercita o ramo "CPF OU CNPJ" da emissão e a
      // variante de pessoa jurídica de `tributos` (sem retenção previdenciária).
      cnpj: cnpjFromBase("556667770001"),
      escrowSubaccount: true,
    },
    {
      name: "Beatriz Cordas", stage: "Bia Viola", tier: MusicianPlanTier.ESSENTIAL,
      email: "musico6@seed-soundmeet.com",
      genres: ["Sertanejo", "Forró"], instruments: ["Violão", "Voz"],
      // ~25 km — fica de FORA de um raio de 10 km e DENTRO de um de 50 km.
      // É o caso que prova que o filtro de raio realmente filtra.
      city: "Guarulhos", state: "SP", cep: "07010000",
      street: "Avenida Paulo Faccini", number: "1000", neighborhood: "Macedo",
      lat: -23.4538, lng: -46.5333,
      ranges: [new PriceRange({ model: "per_event", min: 400, max: 900 })],
      openToGigs: true as boolean | null,
      ratingProjection: { average: 3.6, total: 5 },
      // Modo turnê (7.13d): base em Guarulhos, de passagem pelo Rio. Aparece
      // na busca por raio a partir da Lapa sem perder a base de SP. Sem CPF de
      // propósito — é o show confirmado que NÃO gera contrato (seção 21).
      touring: {
        location: new Location({
          city: "Rio de Janeiro", state: "RJ",
          latitude: -22.9068, longitude: -43.1729,
          street: "Rua do Lavradio", number: "100",
          neighborhood: "Lapa", zip_code: "20230070",
        }),
        days: 10,
      },
    },
    {
      name: "Diego Eletrônico", stage: "DJ Diego", tier: MusicianPlanTier.FREE,
      email: "musico7@seed-soundmeet.com",
      genres: ["Funk", "Hip Hop"], instruments: ["DJ / Controladora"],
      // ~90 km — fora de qualquer raio plausível a partir de São Paulo, mas
      // ainda no estado. Cobre "nada perto de mim, mas existe no sistema".
      city: "Campinas", state: "SP", cep: "13015904",
      street: "Avenida Francisco Glicério", number: "935", neighborhood: "Centro",
      lat: -22.9056, lng: -47.0608,
      ranges: [new PriceRange({ model: "per_event", min: 700, max: 1800 })],
      openToGigs: true as boolean | null,
      // Sem projeção: cobre "ainda não avaliado" na ordenação por nota, que é
      // diferente de "avaliado com nota baixa".
    },
    {
      name: "Helena Clássica", stage: "Helena Cordas", tier: MusicianPlanTier.PRO,
      email: "musico8@seed-soundmeet.com",
      genres: ["Instrumental", "MPB"], instruments: ["Violino", "Sopros"],
      // Outro estado — some de qualquer busca por raio partindo de SP.
      city: "Curitiba", state: "PR", cep: "80020310",
      street: "Rua XV de Novembro", number: "300", neighborhood: "Centro",
      lat: -25.4290, lng: -49.2671,
      ranges: [new PriceRange({ model: "per_hour", min: 300, max: 600 })],
      openToGigs: true as boolean | null,
      ratingProjection: { average: 5.0, total: 3 },
      // PRO em TRIAL (e não `active`): único `SubscriptionStatus.TRIAL` do seed.
      trialDays: 14,
    },
  ];

  const musicians: Musician[] = [];
  for (const spec of musicianSpecs) {
    const musicianBuilder = Musician.fake()
      .aMusician()
      .withName(spec.name)
      .withStageName(spec.stage)
      .withEmail(spec.email)
      .withGenres(spec.genres)
      .withInstruments(spec.instruments)
      .withExperienceYears(8)
      .withOpenToGigs(spec.openToGigs)
      .withCpf("cpf" in spec && spec.cpf ? spec.cpf : null)
      .withCnpj("cnpj" in spec && spec.cnpj ? spec.cnpj : null);
    const musicianSub = keycloakSubs.get(spec.email);
    if (musicianSub) {
      musicianBuilder.withMusicianId(new MusicianId(musicianSub));
    }
    const musician = musicianBuilder.build();
    // CPF/CNPJ inválido NÃO lança: vira notificação e o campo fica null — e o
    // sintoma apareceria só lá na frente, como contrato que não é emitido.
    if (("cpf" in spec && spec.cpf && !musician.cpf) || ("cnpj" in spec && spec.cnpj && !musician.cnpj)) {
      throw new Error(`Documento inválido no seed (${spec.name}): ${JSON.stringify(musician.notification.toJSON())}`);
    }

    /*
     * Projeção de nota, para `sort=rating` na busca (W3.1) ter o que ordenar.
     *
     * `syncRatingProjection` e não `addRating` repetido: é o mesmo método que o
     * SubmitReviewUseCase usa, e escreve a média direto em vez de acumular.
     *
     * ⚠️ Sem linhas correspondentes na tabela `reviews` (o ledger do Bloco 9.3).
     * Semear o ledger de verdade exigiria bookings `completed` entre as partes
     * certas, e a elegibilidade é checada de verdade. Consequência conhecida e
     * aceitável em desenvolvimento: a PRIMEIRA avaliação real de um destes
     * músicos recalcula a média a partir do ledger — que está vazio — e a nota
     * do seed é substituída pela nota única recém-dada. Isso não é bug, é a
     * projeção funcionando; e o número aqui é fixo, não aleatório, justamente
     * para essa troca ser reconhecível quando acontecer.
     */
    if ("ratingProjection" in spec && spec.ratingProjection) {
      musician.syncRatingProjection(
        spec.ratingProjection.average,
        spec.ratingProjection.total,
      );
    }

    const profile = musician.ensureProfile();
    profile.changePriceRanges(spec.ranges);
    profile.changeLocation(
      new Location({
        city: spec.city, state: spec.state,
        latitude: spec.lat, longitude: spec.lng,
        street: spec.street, number: spec.number,
        neighborhood: spec.neighborhood, zip_code: spec.cep,
      }),
    );
    profile.changeSocialLinks({ instagram: `@${spec.stage.toLowerCase().replace(/\s/g, "")}` });
    if ("touring" in spec && spec.touring) {
      profile.setTouringLocation(spec.touring.location, daysFromNow(spec.touring.days, 23));
      if (profile.notification.hasErrors()) {
        throw new Error(`Turnê inválida no seed (${spec.name}): ${JSON.stringify(profile.notification.toJSON())}`);
      }
    }

    /*
     * Token de push nos três primeiros músicos.
     *
     * Sem token nenhum, TODO handler de `notifications-module` sai cedo
     * (`if (!musician?.push_token) return`) e a notificação de pedido, de
     * booking e de mensagem não tinha como ser exercitada — nem para falhar.
     * O formato é o que `RegisterPushTokenInput` valida
     * (`ExponentPushToken[...]`); o valor é fictício, então o envio chega ao
     * serviço de push e falha LÁ, que é o ponto observável — e é melhor que
     * não chegar.
     *
     * Os outros cinco ficam sem token de propósito: é o estado real de quem
     * criou a conta e ainda não abriu o app.
     */
    if ("pushToken" in spec && spec.pushToken) {
      musician.registerPushToken(spec.pushToken.token, spec.pushToken.platform);
    }

    /*
     * Escopo do pedido musical (migration 20260909120000).
     *
     * A coluna nasce `true` e os 8 músicos ficariam todos no default, deixando
     * o ramo restrito de `CreateRequestUseCase` — o `InvalidOperationError`
     * "só aceita pedidos do próprio repertório" — sem ninguém que o dispare.
     *
     * 🔴 Carlos é o escolhido porque é o único, além do João, com biblioteca
     * semeada (Fly Me to the Moon, Águas de Março, Garota de Ipanema).
     * Restringir um músico SEM repertório tornaria todo pedido a ele
     * impossível: testaria a mensagem de erro e nada do produto.
     *
     * João continua permissivo de propósito — é o alvo dos 10 pedidos da
     * seção 8 e o caminho principal de quem abre o app depois do seed.
     */
    if (
      "acceptsRequestsOutsideRepertoire" in spec &&
      spec.acceptsRequestsOutsideRepertoire === false
    ) {
      musician.setAcceptsRequestsOutsideRepertoire(false);
    }

    await musicianRepo.insert(musician);
    musicians.push(musician);

    // Carteira com histórico
    const wallet = MusicianWallet.fake()
      .aMusicianWallet()
      .withMusicianId(musician.musician_id)
      .build();
    wallet.updatePixKey(spec.email, "email");
    // A chave semeada não deve nascer em carência (A1 camada 2): sem isto, um
    // saque logo após o seed cairia no bloqueio de "chave recém-trocada". No
    // mundo real a carência conta da troca de verdade; aqui a chave já é antiga.
    // A Maria é a exceção deliberada — é o lado negativo da carência.
    if (!("pixKeyJustChanged" in spec && spec.pixKeyJustChanged)) {
      wallet.pix_key_changed_at = null;
    }

    // Subconta na instituição de pagamento + Conta Escrow ligada. É o
    // pré-requisito de toda custódia (seção 22). Credenciais obviamente falsas;
    // a `api_key` vai cifrada em repouso pelo mapper, como a real.
    if ("escrowSubaccount" in spec && spec.escrowSubaccount) {
      const slug = spec.email.split("@")[0];
      wallet.linkSubaccount({
        wallet_id: `seed-asaas-wallet-${slug}`,
        api_key: `seed-asaas-api-key-${slug}-nao-e-credencial-real`,
        account_status: "APPROVED",
      });
      wallet.enableEscrow();
    }

    // Só o João tem extrato de gorjeta no seed (seção 9 + transações da 14).
    //
    // 🔴 Gorjeta NÃO vira saldo sacável (corrigido 14/set/2026). O João tem
    // Mercado Pago vinculado, então a gorjeta dele liquida NA CONTA DELE
    // (`settlement: "beneficiary"`) e o domínio chama `recordExternalEarning`:
    // cresce `total_earned`, `balance` fica intacto. O seed anterior creditava
    // as gorjetas com `receiveFunds` para liberar o saque — produzindo o saldo
    // sacável que a regra existe para impedir (dinheiro que a plataforma nunca
    // recebeu saindo do caixa dela no saque).
    //
    // O saldo sacável legítimo é CACHÊ liberado da custódia, e é de lá que ele
    // vem agora (seção 22): R$720 liberados, menos os saques → R$510, acima do
    // mínimo de R$110 do FREE. Líquidos das gorjetas = bruto − 9% (tier FREE):
    //   25 → 22,75 · 50 → 45,50 · 30 → 27,30 · 20 → 18,20 · 120 → 109,20
    //   destaque pago 10 → 9,10 · anônima 15 → 13,65
    if (spec.email === "musico1@seed-soundmeet.com") {
      for (const net of [22.75, 45.5, 27.3, 18.2, 109.2, 9.1, 13.65]) {
        wallet.recordExternalEarning(net);
      }

      /*
       * 🔴 Vínculo de Mercado Pago semeado por causa do DRILL DE RESTAURAÇÃO,
       * não por causa da tela de carteira.
       *
       * O critério mais importante do §4.3 de `Docs/operacao/backup-e-restauracao.md` é
       * "um `MusicianWallet` com token de Mercado Pago DECIFRA" — é o único que
       * prova que a `TOKEN_ENCRYPTION_KEY` sobreviveu junto com o dado. Sem
       * nenhuma carteira vinculada no seed, `npm run drill:verify` não tinha o
       * que exercitar e reportava WARN: "não pôde ser exercido", que não é o
       * mesmo que passou.
       *
       * Token e refresh são obviamente falsos; o que o drill verifica é o
       * round-trip de AES-256-GCM contra as três colunas, não o valor.
       */
      wallet.linkMercadoPago({
        mp_user_id: "SEED-MP-USER-0001",
        access_token: "SEED-MP-ACCESS-TOKEN-nao-e-credencial-real",
        refresh_token: "SEED-MP-REFRESH-TOKEN-nao-e-credencial-real",
        // 180 dias é a validade real do token do MP; o job de renovação usa
        // 15 dias de folga, então esta data o mantém fora da janela.
        expires_at: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      });
    }

    /*
     * Ana também tem Mercado Pago vinculado (28/set/2026) — é ela que tem o
     * palco AO VIVO da Home do fã (Lapa), então é por ela que o fã chega ao
     * pedido COM o fader de destaque. Sem vínculo o fader nem aparece
     * (`accepts_tips`), e o João já nasce com a cota de pedidos do fã esgotada
     * pela seção 8.
     *
     * ⚠️ Token FALSO, como o do João: com `MERCADOPAGO_API_URL` apontando para o
     * sandbox, o PIX do destaque é RECUSADO pelo provedor ("Não foi possível
     * gerar o PIX"). O fader, o bilhete e o erro são testáveis; o QR real exige
     * vincular uma conta de teste do sandbox pelo app (Carteira → Mercado Pago),
     * logado como a Ana.
     */
    if (spec.email === "musico4@seed-soundmeet.com") {
      wallet.linkMercadoPago({
        mp_user_id: "SEED-MP-USER-0004",
        access_token: "SEED-MP-ACCESS-TOKEN-ana-nao-e-credencial-real",
        refresh_token: "SEED-MP-REFRESH-TOKEN-ana-nao-e-credencial-real",
        expires_at: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      });
    }
    await walletRepo.insert(wallet);

    // Assinatura (só tiers pagos — FREE não tem linha de subscription)
    if (spec.tier !== MusicianPlanTier.FREE) {
      const subscription = Subscription.create({
        musician_id: musician.musician_id.id,
        plan_tier: spec.tier,
        persona: "musician",
        billing_cycle: BillingCycle.MONTHLY,
        // Com `trial_ends_at` o agregado nasce `trial` e sem `expires_at`.
        trial_ends_at:
          "trialDays" in spec && spec.trialDays ? daysFromNow(spec.trialDays, 23) : undefined,
      });
      await subscriptionRepo.insert(subscription);
    }
  }

  // Histórico de assinatura encerrada — os dois estados terminais. Rafael
  // (PRO ativo hoje) veio de um ESSENTIAL que ELE cancelou; Diego (FREE) teve
  // um ESSENTIAL que venceu sem renovar. Nenhum dos dois muda o tier efetivo:
  // `findActiveMusicianSubscription` só lê `active`/`trial`.
  const pastMusicianSubs = [
    { musician: musicians[4], end: "cancel" as const },
    { musician: musicians[6], end: "expire" as const },
  ];
  for (const spec of pastMusicianSubs) {
    const past = Subscription.create({
      musician_id: spec.musician.musician_id.id,
      plan_tier: MusicianPlanTier.ESSENTIAL,
      persona: "musician",
      billing_cycle: BillingCycle.MONTHLY,
    });
    if (spec.end === "cancel") past.cancel();
    else past.expire();
    await subscriptionRepo.insert(past);
  }
  const [m1, m2] = musicians;

  // ── 1b. Áudio de apresentação (preview de contratação) ────────────────────
  /*
   * 🔴 Sobe pelo `UploadMusicianPresentationAudioUseCase` DE VERDADE, com os
   * mesmos helpers do controller (magic bytes + duração). Mesmo princípio dos
   * contratos, que desde 14/set são emitidos pelo use-case real em vez de
   * `Contract.fake()`: o que o seed grava passa pelas mesmas regras que um
   * upload do app, então um bug de allowlist, de duração ou de URL pública
   * aparece aqui, rodando o seed, e não na primeira vez que um músico envia.
   *
   * Só TRÊS dos oito recebem áudio, e isso é a regra dos "dois lados" deste
   * arquivo: sem músico sem áudio, o estado vazio do cartão da grade — que é o
   * caso mais comum em produção — nunca é exercitado.
   */
  console.log("🎧 Áudio de apresentação…");
  const musicianMedia = await createSeedMusicianStorage();
  const withPresentationAudio: string[] = [];

  if (musicianMedia.available) {
    const uploadPresentationAudio = new UploadMusicianPresentationAudioUseCase(
      musicianRepo,
      musicianMedia.storage,
    );

    // João (blues), Rafa (sax) e DJ Diego (eletrônica): personas distintas o
    // bastante para a grade mostrar o player em contextos diferentes. Os
    // índices seguem `musicianSpecs` — o mesmo cruzamento que o bloco 1c
    // (fotos) descreve.
    const alvos = [0, 4, 6];

    for (const [ordem, indice] of alvos.entries()) {
      const musician = musicians[indice];
      if (!musician) continue;

      const wav = synthesizePresentationWav(ordem);
      const tmpPath = join(
        tmpdir(),
        `seed-presentation-${musician.musician_id.id}.wav`,
      );

      try {
        await writeFile(tmpPath, wav);

        // Os MESMOS helpers do controller — é isso que faz o seed exercitar o
        // caminho real em vez de uma versão simplificada dele.
        const contentType = await detectFileMime(tmpPath);
        const durationSeconds = await readAudioDurationSeconds(tmpPath);

        await uploadPresentationAudio.execute({
          musician_id: musician.musician_id.id,
          data: wav,
          content_type: contentType ?? "",
          file_size: wav.byteLength,
          duration_seconds: durationSeconds,
        });

        withPresentationAudio.push(musician.stage_name ?? musician.name);
      } catch (error) {
        console.warn(
          `   ⚠️ ${musician.name} ficou sem áudio de apresentação (${(error as Error).message}).`,
        );
      } finally {
        await unlink(tmpPath).catch(() => undefined);
      }
    }

    console.log(
      `   🎵 ${withPresentationAudio.length} com áudio (${withPresentationAudio.join(", ")}) · ${musicians.length - withPresentationAudio.length} sem — os dois lados na grade do web.`,
    );
    console.log(`   📦 destino: ${musicianMedia.label}`);
  } else {
    // Sem isto a ausência de áudio parece decisão do seed, e não falta de
    // storage — quem abrir a grade do web veria cartões sem player sem nenhuma
    // pista do porquê.
    console.warn(
      "   ⚠️ Storage de mídia indisponível: nenhum músico recebeu áudio de apresentação.",
    );
  }

  // ── 1c. Foto de perfil ────────────────────────────────────────────────────
  /*
   * Mesmo caminho do áudio: `UploadMusicianAvatarUseCase` real, mesmo storage,
   * prefixo `seed/` (o `--reset` varre). URL externa gravada direto no campo
   * NÃO serviria: a CSP do web só libera o host do bucket no `img-src`, então
   * a foto sairia quebrada lá e inteira no mobile.
   *
   * CINCO dos oito têm foto, cruzados com o áudio de propósito para a grade
   * mostrar as quatro combinações: foto+áudio (João, Rafa), só foto (Maria,
   * Carlão, Bia), só áudio (DJ Diego) e nenhum dos dois (Ana, Helena) — o
   * fallback de iniciais é o que a maioria dos cadastros novos vai exibir.
   *
   * As imagens são FIXTURE versionada em `prisma/seed-assets/avatars/`, não
   * download a cada rodada: o seed é determinístico e roda offline. Origem:
   * geradas por IA (pollinations.ai, modelo flux, seeds fixos), sem pessoa real
   * retratada; recortadas para tirar a marca d'água e sem EXIF.
   */
  console.log("🖼️ Fotos de perfil…");
  const withAvatar: string[] = [];

  if (musicianMedia.available) {
    const uploadAvatar = new UploadMusicianAvatarUseCase(
      musicianRepo,
      musicianMedia.storage,
    );

    // índice em `musicians` → arquivo (nomeado pelo e-mail `musicoN@`).
    const fotos: Array<[number, string]> = [
      [0, "musico1.jpg"],
      [1, "musico2.jpg"],
      [2, "musico3.jpg"],
      [4, "musico5.jpg"],
      [5, "musico6.jpg"],
    ];

    for (const [indice, arquivo] of fotos) {
      const musician = musicians[indice];
      if (!musician) continue;

      const path = resolve(__dirname, "seed-assets/avatars", arquivo);
      try {
        const data = readFileSync(path);
        await uploadAvatar.execute({
          musician_id: musician.musician_id.id,
          data,
          // Pelos bytes, como o controller — não pela extensão do arquivo.
          content_type: (await detectFileMime(path)) ?? "",
          file_size: data.byteLength,
        });
        withAvatar.push(musician.stage_name ?? musician.name);
      } catch (error) {
        console.warn(
          `   ⚠️ ${musician.name} ficou sem foto (${(error as Error).message}).`,
        );
      }
    }

    console.log(
      `   📸 ${withAvatar.length} com foto (${withAvatar.join(", ")}) · ${musicians.length - withAvatar.length} com fallback de iniciais.`,
    );
  } else {
    console.warn(
      "   ⚠️ Storage de mídia indisponível: todos os músicos ficam com o fallback de iniciais.",
    );
  }

  // ── 2. Estabelecimentos (com endereço + lat/lng p/ busca por raio) ────────
  console.log("🏢 Estabelecimentos…");
  // 🔴 `operatingHours.timezone` NÃO é decoração: é de onde a emissão do
  // contrato tira o fuso (`?? "UTC"`). Sem ele, um show às 20h de Brasília sai
  // no contrato às 23h. As três casas com show semeado têm o fuso; a Lapa fica
  // sem horário cadastrado de propósito (estado de quem ainda não preencheu).
  // Abertas TODOS os dias: as datas dos shows são relativas ao dia do seed e
  // caem em qualquer dia da semana — com folga semanal, algum show apareceria
  // marcado num dia em que a própria casa está fechada.
  const nightlyHours = (open: string, close: string) => ({
    timezone: "America/Sao_Paulo",
    weekly: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, [{ start: open, end: close }]])),
  });
  const establishmentSpecs = [
    {
      name: "Bar do Zé", type: "bar" as const, email: "bar1@seed-soundmeet.com",
      street: "Rua Augusta", number: "1024", neighborhood: "Consolação",
      city: "São Paulo", state: "SP", cep: "01304001", lat: -23.5537, lng: -46.6524,
      genres: ["Blues", "Rock"],
      legalRepresentative: { name: "José Carvalho", cpf: cpfFromBase("418229637") },
      operatingHours: nightlyHours("18:00", "23:59"),
      // Única casa com ficha técnica: seleciona a variante de estrutura com
      // Anexo I no contrato. As outras cobrem a variante sem anexo.
      stageTechSpec: StageTechSpec.fromJSON({
        hasPa: true,
        mixerChannels: 16,
        monitors: 4,
        hasMicrophones: 6,
        backline: ["bateria", "amplificador de baixo", "cubo de guitarra"],
        dimensions: { widthM: 5, depthM: 3, heightM: 2.5 },
        power: { outlets: 8, voltage: "220V" },
        hasParking: false,
        hasSoundEngineer: true,
        soundcheckWindow: "18:00-19:00",
        notes: "Palco a 40 cm do chão; carga e descarga pela Rua Augusta.",
      }),
      verified: true,
    },
    {
      name: "Restaurante Maresia", type: "restaurant" as const, email: "rest1@seed-soundmeet.com",
      street: "Rua dos Pinheiros", number: "320", neighborhood: "Pinheiros",
      city: "São Paulo", state: "SP", cep: "05422001", lat: -23.5662, lng: -46.6825,
      genres: ["MPB", "Bossa Nova"],
      legalRepresentative: { name: "Marina Toledo", cpf: cpfFromBase("731594208") },
      operatingHours: nightlyHours("12:00", "23:59"),
      stageTechSpec: null,
      verified: true,
    },
    {
      name: "Lapa Music Hall", type: "club" as const, email: "club1@seed-soundmeet.com",
      street: "Avenida Mem de Sá", number: "23", neighborhood: "Lapa",
      city: "Rio de Janeiro", state: "RJ", cep: "20230150", lat: -22.9133, lng: -43.1809,
      genres: ["Samba", "Pagode"],
      legalRepresentative: null,
      operatingHours: null,
      stageTechSpec: null,
      // Único NÃO verificado: o selo é dado de tela nos dois lados.
      verified: false,
    },
    {
      name: "Savassi Jazz Bar", type: "bar" as const, email: "bar2@seed-soundmeet.com",
      street: "Rua Pernambuco", number: "1000", neighborhood: "Savassi",
      city: "Belo Horizonte", state: "MG", cep: "30130151", lat: -19.9352, lng: -43.9345,
      genres: ["Jazz", "Blues"],
      legalRepresentative: { name: "Otávio Figueiredo", cpf: cpfFromBase("856207314") },
      operatingHours: nightlyHours("19:00", "23:59"),
      stageTechSpec: null,
      verified: true,
    },
  ];

  const establishments: Establishment[] = [];
  for (const spec of establishmentSpecs) {
    const profile = EstablishmentProfile.fake()
      .aProfile()
      .withCapacity(120)
      .withLocation(
        new Address({
          street: spec.street, number: spec.number,
          neighborhood: spec.neighborhood, city: spec.city, state: spec.state,
          zipCode: spec.cep, latitude: spec.lat, longitude: spec.lng,
        }),
      )
      .withPreferredGenres(spec.genres)
      .withAmenities(["Palco", "Som próprio", "Estacionamento"])
      .withOperatingHours(spec.operatingHours)
      .withStageTechSpec(spec.stageTechSpec)
      .build();

    const establishment = Establishment.fake()
      .anEstablishment()
      .withName(spec.name)
      .withEmail(spec.email)
      .withCnpj(cnpjFromBase(`1122233300${String(establishments.length + 10)}`))
      // Nome E CPF: a emissão exige os dois (`contratante.representante_legal`).
      .withLegalRepresentative(spec.legalRepresentative?.name ?? null, spec.legalRepresentative?.cpf ?? null)
      .withEstablishmentType(spec.type)
      .withIsVerified(spec.verified)
      .withProfile(profile)
      .build();
    if (spec.legalRepresentative && !establishment.legal_representative_document) {
      throw new Error(`Representante legal inválido no seed (${spec.name}): ${JSON.stringify(establishment.notification.toJSON())}`);
    }

    await establishmentRepo.insert(establishment);
    establishments.push(establishment);

    // Vínculo conta ↔ estabelecimento. `RegisterEstablishmentUseCase` escreve
    // este claim; o seed insere pelo repositório, então precisa escrever por
    // conta própria — exatamente como já era feito para `band_ids` do João.
    //
    // 🔴 Sem isto o `soundmeet-web` fica inutilizável com os dados do seed: o
    // login até funciona (LoginUseCase resolve a persona por e-mail), mas toda
    // rota de escrita cai no EstablishmentOwnershipGuard com 403. Era o estado
    // até 22/ago — a persona inteira só podia ser testada registrando um
    // estabelecimento novo pela API, que nasce sem evento, booking ou conversa.
    if (keycloakAdmin) {
      const estSub = keycloakSubs.get(spec.email);
      if (estSub) {
        try {
          await addKeycloakClaimValue(
            keycloakAdmin,
            estSub,
            "establishment_ids",
            establishment.establishment_id.id,
          );
        } catch (error) {
          console.warn(
            `   ⚠️ Falha ao vincular establishment_ids de ${spec.name} ` +
              `(${(error as Error).message}). O painel web vai responder 403.`,
          );
        }
      }
    }
  }
  const [e1, e2] = establishments;

  // ── 2b. Cardápio em PDF (29/set/2026) ──────────────────────────────────────
  /*
   * Nenhuma casa semeada tinha cardápio, e o fã não tinha como ver o botão
   * "Ver cardápio (PDF)" do detalhe da casa — a tela existia, o dado não.
   *
   * Sobe pelo `UploadEstablishmentMenuPdfUseCase` DE VERDADE, no mesmo storage
   * (e sob o mesmo prefixo `seed/`) do áudio de apresentação: as duas portas de
   * storage têm a mesma forma, e o `--reset` já varre o prefixo inteiro.
   * Magic bytes pelo mesmo `detectFileMime` do controller.
   *
   * Os dois lados: Bar do Zé com UM cardápio, Maresia com DOIS (o máximo,
   * `MENU_PDF_MAX_COUNT`) — e Lapa e Savassi SEM, que é o estado mais comum em
   * produção e precisa continuar exercitável.
   */
  console.log("📄 Cardápios…");
  if (musicianMedia.available) {
    const uploadMenuPdf = new UploadEstablishmentMenuPdfUseCase(establishmentRepo, musicianMedia.storage);
    const menus: { est: Establishment; title: string; sections: { heading: string; items: [string, string][] }[] }[] = [
      {
        est: e1, title: "Bar do Zé - Cardápio",
        sections: [
          { heading: "Petiscos", items: [["Porção de fritas", "R$ 32"], ["Bolinho de mandioca com carne seca", "R$ 38"], ["Torresmo pururuca", "R$ 34"]] },
          { heading: "Bebidas", items: [["Chopp 300 ml", "R$ 14"], ["Caipirinha de limão", "R$ 24"], ["Água com gás", "R$ 7"]] },
        ],
      },
      {
        est: e2, title: "Restaurante Maresia - Cardápio",
        sections: [
          { heading: "Entradas", items: [["Ceviche de peixe branco", "R$ 46"], ["Pastéis de camarão", "R$ 42"]] },
          { heading: "Pratos", items: [["Moqueca capixaba (2 pessoas)", "R$ 148"], ["Risoto de frutos do mar", "R$ 92"]] },
        ],
      },
      {
        est: e2, title: "Restaurante Maresia - Carta de vinhos",
        sections: [
          { heading: "Tintos", items: [["Malbec argentino (taça)", "R$ 32"], ["Tannat uruguaio (garrafa)", "R$ 168"]] },
          { heading: "Brancos", items: [["Sauvignon Blanc chileno (taça)", "R$ 29"], ["Alvarinho português (garrafa)", "R$ 189"]] },
        ],
      },
    ];

    let uploaded = 0;
    for (const menu of menus) {
      const pdf = synthesizeMenuPdf(menu.title, menu.sections);
      const tmpPath = join(tmpdir(), `seed-menu-${menu.est.establishment_id.id}-${uploaded}.pdf`);
      try {
        await writeFile(tmpPath, pdf);
        const contentType = await detectFileMime(tmpPath);
        await uploadMenuPdf.execute({
          establishment_id: menu.est.establishment_id.id,
          data: pdf,
          content_type: contentType ?? "",
          file_size: pdf.byteLength,
        });
        uploaded += 1;
      } catch (error) {
        console.warn(`   ⚠️ ${menu.est.name} ficou sem "${menu.title}" (${(error as Error).message}).`);
      } finally {
        await unlink(tmpPath).catch(() => undefined);
      }
    }
    console.log(`   📄 ${uploaded} cardápio(s): Bar do Zé (1), Maresia (2) · Lapa e Savassi sem — os dois lados.`);
  } else {
    console.warn("   ⚠️ Storage de mídia indisponível: nenhuma casa recebeu cardápio.");
  }

  // ── 3. Fãs (audience) ──────────────────────────────────────────────────────
  console.log("🙋 Fãs…");
  // 🔴 Preferências da taxonomia REAL. O fake builder usa "Guitar"/"Piano" e
  // "Pop"/"Electronic" — nenhum músico do seed tem esses valores, e a busca é
  // `hasSome` exato em gênero E instrumento. O carrossel "Pra você"
  // (`GET /audiences/:id/recommendations/musicians`) nascia VAZIO para os dois
  // fãs, sem erro nenhum. Os valores abaixo casam com músicos `open_to_gigs`:
  //   Ana   → João (Blues/Violão) e Rafael (Blues/Saxofone)
  //   Bruno → Ana Batuque (Samba/Percussão) e Bia Viola (Sertanejo/Violão)
  // Gênero do fã é validado contra `VALID_GENRES` (422 fora dela) — todos
  // estes estão lá; instrumento é texto livre.
  const fan1Builder = Audience.fake().aAudience()
    .withName("Ana Fã").withEmail("fa1@seed-soundmeet.com").withNickname("aninha")
    .withFavoriteGenres(["Blues", "Rock", "MPB"])
    .withFavoriteInstruments(["Violão", "Saxofone"]);
  const fan1Sub = keycloakSubs.get("fa1@seed-soundmeet.com");
  if (fan1Sub) fan1Builder.withId(new AudienceId(fan1Sub));
  const fan1 = fan1Builder.build();
  const fan2Builder = Audience.fake().aTopFan()
    .withName("Bruno Superfã").withEmail("fa2@seed-soundmeet.com").withNickname("brunao")
    .withFavoriteGenres(["Samba", "Pagode", "Sertanejo"])
    .withFavoriteInstruments(["Percussão", "Violão"]);
  const fan2Sub = keycloakSubs.get("fa2@seed-soundmeet.com");
  if (fan2Sub) fan2Builder.withId(new AudienceId(fan2Sub));
  const fan2 = fan2Builder.build();
  await audienceRepo.insert(fan1);
  await audienceRepo.insert(fan2);

  // ── 3b. E-mail confirmado (coluna de INFRA, fora do agregado) ─────────────
  //
  // 🔴 Sem isto NENHUM músico saca. `WithdrawToPixUseCase` consulta
  // `IEmailVerificationChecker` ANTES da validação de valor e antes de
  // `reserve()`, e a porta é fail-closed: `email_verified_at` NULL vira 403
  // `EMAIL_NOT_VERIFIED` para todo mundo, com carteira cheia ou vazia.
  //
  // O seed já criava o usuário no Keycloak com `emailVerified: true`, o que
  // dava a impressão de e-mail confirmado — mas o gate lê a COLUNA DA APP, não
  // o Keycloak. Eram duas verdades diferentes sobre o mesmo fato.
  //
  // Vai direto no Prisma porque o campo não pertence ao agregado (o porquê
  // está em `shared/domain/email-verification.checker.ts`); é o mesmo caminho
  // que `verify-email.service.ts` usa ao confirmar de verdade.
  //
  // Helena (musico8) fica de FORA de propósito — é o único jeito de exercitar
  // o lado negativo do gate. Como a checagem roda antes de tudo, ela devolve
  // EMAIL_NOT_VERIFIED mesmo com saldo suficiente.
  //
  // ⚠️ Escopado ao domínio do seed: sem o `endsWith`, rodar sem `--reset` num
  // banco de desenvolvimento com dados próprios confirmaria o e-mail de linhas
  // que não são do seed — o seed não tem negócio escrevendo nelas.
  const UNVERIFIED_MUSICIAN_EMAIL = "musico8@seed-soundmeet.com";
  const seedEmail = { endsWith: "@seed-soundmeet.com" };
  await prisma.musician.updateMany({
    where: { AND: [{ email: seedEmail }, { email: { not: UNVERIFIED_MUSICIAN_EMAIL } }] },
    data: { email_verified_at: new Date() },
  });
  // Estabelecimento e fã não têm gate hoje (a porta só expõe
  // `isMusicianEmailVerified`), mas deixá-los NULL manteria a mesma divergência
  // com o Keycloak à espera do primeiro consumidor.
  await prisma.establishment.updateMany({
    where: { email: seedEmail },
    data: { email_verified_at: new Date() },
  });
  await prisma.audience.updateMany({
    where: { email: seedEmail },
    data: { email_verified_at: new Date() },
  });

  // ── 4. Eventos (todos os EventStatus) ─────────────────────────────────────
  console.log("🎤 Eventos…");
  const eventSpecs = [
    { est: e1, name: "Noite do Blues", start: daysFromNow(3), status: "scheduled" },
    // Janela centrada no AGORA, e não "hoje às 19h": o set ao vivo, os pedidos
    // e o check-in do fã dependem de o evento estar de fato em andamento.
    // ⚠️ `AutoFinishEventsJob` (a cada 10 min) encerra evento ativo cujo fim
    // passou — o cenário "ao vivo" dura ~6h após o seed.
    { est: e1, name: "Sarau ao Vivo", start: hoursFromNow(-1), end: hoursFromNow(5), status: "active", attendees: 34, cover: 20 },
    { est: e2, name: "Jantar com Bossa", start: daysFromNow(-7), status: "completed" },
    { est: e2, name: "Feijoada com Samba", start: daysFromNow(5, 13), status: "cancelled" },
    // Palco da Carlão Trio (seção 17b): evento com BANDA no line-up.
    { est: establishments[3], name: "Jazz na Savassi", start: daysFromNow(6, 21), status: "scheduled" },
    // ── Cartaz da Home do fã (`GET /events/live-now` e `/up-next`, 28/set/2026).
    // Com um palco só, a Home não teria como mostrar o que ela É: vários palcos
    // acesos ao mesmo tempo, um ainda sem ninguém no set, e a noite que vem.
    // Vão NO FIM do array — a desestruturação abaixo depende das posições.
    // Lapa: set aberto (Ana), com música tocando — o palco "cheio".
    { est: establishments[2], name: "Roda de Samba da Lapa", start: hoursFromNow(-2), end: hoursFromNow(3), status: "active", attendees: 86, cover: 30 },
    // Maresia: show EM ANDAMENTO pelo relógio, mas o Rafa ainda não abriu o
    // set — é o estado "no palco em instantes", que a Home precisa saber dizer.
    { est: e2, name: "Sax ao Pôr do Sol", start: hoursFromNow(-0.5), end: hoursFromNow(3.5), status: "active", attendees: 12 },
    // Próximos: hoje mais tarde, amanhã e depois de amanhã.
    { est: e2, name: "Viola ao Luar", start: hoursFromNow(3), end: hoursFromNow(6), status: "scheduled", cover: 15 },
    { est: e1, name: "Pista da Augusta", start: hoursFromNow(26), end: hoursFromNow(31), status: "scheduled", cover: 40 },
    { est: establishments[3], name: "Cordas & Jazz", start: daysFromNow(2, 20), status: "scheduled" },
  ] as const;

  const events: Event[] = [];
  for (const spec of eventSpecs) {
    const end = "end" in spec ? spec.end : new Date(spec.start.getTime() + 4 * 60 * 60 * 1000);
    const event = Event.fake()
      .anEvent()
      .withEstablishmentId(spec.est.establishment_id)
      .withName(spec.name)
      .withStartAt(spec.start)
      .withEndAt(end)
      .withStatus(spec.status)
      .withCurrentCapacity("attendees" in spec ? spec.attendees : 0)
      .withCoverCharge("cover" in spec ? spec.cover : null)
      .build();
    await eventRepo.insert(event);
    events.push(event);
  }
  const [
    evScheduled, evActive, evCompleted, , evSavassi,
    evLapaLive, evMaresiaLive, evTonight, evTomorrow, evCordas,
  ] = events;

  // ── 5. Agenda do músico 1: regras semanais + férias ───────────────────────
  console.log("📅 Disponibilidade…");
  const availability = Availability.fake()
    .aAvailability()
    .withMusicianId(new Uuid(m1.musician_id.id))
    .withBandId(null)
    .withTimezone("America/Sao_Paulo")
    .withDefaultBufferMinutes(30)
    .withMaxShowsPerDay(2)
    .withWeeklyRules([
      { weekday: 5, start_time: "18:00", end_time: "23:59" }, // sextas à noite
      { weekday: 6, start_time: "00:00", end_time: "23:59" }, // sábado o dia todo
      { weekday: 0, start_time: "00:00", end_time: "23:59" }, // domingo o dia todo
    ])
    .withUnavailabilities([
      { start_at: daysFromNow(30, 0), end_at: daysFromNow(37, 23), reason: "Férias" },
    ])
    .build();
  await availabilityRepo.insert(availability);

  // ── 6. Bookings (os 5 status + check-in, contestação, origem) + inquiries ─
  console.log("🗓️ Bookings e inquiries…");
  const now = new Date();

  const assertValid = (
    label: string,
    entity: { notification: { hasErrors(): boolean; toJSON(): unknown } },
  ) => {
    if (entity.notification.hasErrors()) {
      throw new Error(`${label} inválido no seed: ${JSON.stringify(entity.notification.toJSON())}`);
    }
  };

  /*
   * `new Booking` + `validate()`, e não o fake builder: o builder não expõe
   * `fee`, `proposed_by` nem `created_at`, e os três importam.
   *   - Sem `fee`, a emissão do contrato devolve `missing: ["booking.cache"]` e
   *     a custódia recusa com `no_fee` — todo booking do seed nascia sem cachê,
   *     enquanto o contrato semeado dizia R$1.500 e a custódia R$900.
   *   - `proposed_by` é o que o cliente usa para oferecer "confirmar" só à
   *     contraparte.
   *   - `created_at` no passado é o que permite `expires_at` no passado sem
   *     violar `expires_at > created_at`.
   * As TRANSIÇÕES continuam passando pelos métodos do agregado, com data
   * explícita — nenhum status é escrito à mão.
   */
  const seedBooking = (spec: {
    est: Establishment;
    musician?: Musician;
    band?: Band;
    event?: Event;
    start: Date;
    end: Date;
    fee: number;
    proposed_by: "establishment" | "musician" | "band";
    created_at: Date;
    expires_at: Date;
  }): Booking => {
    const booking = new Booking({
      establishment_id: spec.est.establishment_id.id,
      musician_id: spec.musician?.musician_id.id ?? null,
      band_id: spec.band?.band_id.id ?? null,
      event_id: spec.event?.event_id.id ?? null,
      start_at: spec.start,
      end_at: spec.end,
      fee: spec.fee,
      proposed_by: spec.proposed_by,
      expires_at: spec.expires_at,
      created_at: spec.created_at,
      updated_at: spec.created_at,
    });
    booking.validate();
    return booking;
  };

  // pending — proposta do Bar do Zé esperando o João. Num SÁBADO (a agenda dele
  // libera sábado inteiro) e antes das férias. ⚠️ `ExpirePendingBookingsJob`
  // (a cada minuto) expira a proposta em 7 dias.
  const pendingStart = nextWeekday(10, 6, 20);
  const bookingPending = seedBooking({
    est: e1, musician: m1,
    start: pendingStart, end: plusHours(pendingStart, 3), fee: 1200,
    proposed_by: "establishment", created_at: hoursFromNow(-20), expires_at: daysFromNow(7),
  });

  // pending no SENTIDO INVERSO — a Ana Batuque propôs; quem confirma é o Bar do
  // Zé, pelo web. Ela não tem CPF: ao confirmar, o contrato NÃO é emitido e o
  // painel mostra a pendência. É o fluxo inteiro ao vivo, a um clique.
  const bookingProposedByMusician = seedBooking({
    est: e1, musician: musicians[3],
    start: daysFromNow(14, 20), end: daysFromNow(14, 23), fee: 450,
    proposed_by: "musician", created_at: hoursFromNow(-3), expires_at: daysFromNow(5),
  });

  // confirmed — o show da Noite do Blues, na MESMA data do evento (antes o
  // booking caía um dia depois do evento a que estava ligado).
  const bookingConfirmed = seedBooking({
    est: e1, musician: m1, event: evScheduled,
    start: evScheduled.start_at, end: new Date(evScheduled.start_at.getTime() + 3 * 3600_000), fee: 900,
    proposed_by: "establishment", created_at: daysFromNow(-6), expires_at: daysFromNow(-3),
  });
  bookingConfirmed.confirm(daysFromNow(-5));

  // confirmed com custódia AGUARDANDO pagamento (seção 22) e nascido de um
  // inquiry convertido (abaixo).
  const bookingConfirmedLater = seedBooking({
    est: e1, musician: m1,
    start: daysFromNow(18, 20), end: daysFromNow(18, 23), fee: 700,
    proposed_by: "establishment", created_at: daysFromNow(-2), expires_at: daysFromNow(2),
  });
  bookingConfirmedLater.confirm(daysFromNow(-1));

  // confirmed SEM contrato — Bia Viola não tem CPF nem CNPJ. É o caso
  // `{ issued: false, missing: ["contratado.cpf"] }` que o painel do Maresia mostra.
  const bookingPendingQualification = seedBooking({
    est: e2, musician: musicians[5],
    start: daysFromNow(6, 13), end: daysFromNow(6, 16), fee: 600,
    proposed_by: "establishment", created_at: daysFromNow(-3), expires_at: daysFromNow(-1),
  });
  bookingPendingQualification.confirm(daysFromNow(-2));

  // cancelled — confirmado e depois cancelado pela casa, fora da janela de
  // multa. A custódia dele foi ESTORNADA e o contrato ANULADO (seções 21/22).
  const bookingCancelled = seedBooking({
    est: e2, musician: m2,
    start: daysFromNow(9, 19), end: daysFromNow(9, 22), fee: 700,
    proposed_by: "establishment", created_at: daysFromNow(-8), expires_at: daysFromNow(-5),
  });
  bookingCancelled.confirm(daysFromNow(-7));
  bookingCancelled.cancel(daysFromNow(-2), "establishment", "Reforma na casa");

  // expired — proposta que o Diego deixou vencer. `expire()` só age com
  // `expires_at` no passado, que é o que o job faria.
  const bookingExpired = seedBooking({
    est: e1, musician: musicians[6],
    start: daysFromNow(8, 21), end: daysFromNow(8, 23), fee: 600,
    proposed_by: "establishment", created_at: daysFromNow(-5), expires_at: daysFromNow(-2),
  });
  bookingExpired.expire(now);

  // completed — os dois shows do Jantar com Bossa. COM check-in: é a primeira
  // das duas condições que liberam a custódia (a outra é não haver contestação).
  const pastShowStart = evCompleted.start_at;
  const pastShowEnd = daysFromNow(-7, 22);
  const bookingCompleted = seedBooking({
    est: e2, musician: m2, event: evCompleted,
    start: pastShowStart, end: pastShowEnd, fee: 1200,
    proposed_by: "establishment", created_at: daysFromNow(-14), expires_at: daysFromNow(-11),
  });
  bookingCompleted.confirm(daysFromNow(-12));
  bookingCompleted.checkIn({ at: new Date(pastShowStart.getTime() + 10 * 60_000), by: "musician" });
  bookingCompleted.complete(daysFromNow(-6, 23));

  // Booking concluído do João no mesmo evento passado. Sem ele o currículo
  // verificado (F4) mostra 0 shows para o João mesmo com a apresentação
  // registrada na seção 19: `shows_completed` conta BOOKING `completed`, não
  // performance. E é ele que dá contexto legítimo às avaliações da seção 20 —
  // `context_type: "booking"` exige um id de booking de verdade.
  const bookingCompletedJoao = seedBooking({
    est: e2, musician: m1, event: evCompleted,
    start: pastShowStart, end: pastShowEnd, fee: 800,
    proposed_by: "establishment", created_at: daysFromNow(-14), expires_at: daysFromNow(-11),
  });
  bookingCompletedJoao.confirm(daysFromNow(-12));
  bookingCompletedJoao.checkIn({ at: new Date(pastShowStart.getTime() + 5 * 60_000), by: "musician" });
  bookingCompletedJoao.complete(daysFromNow(-6, 23));

  // completed + CONTESTADO, sem check-in — "o artista não apareceu". Congela a
  // custódia do Rafael (seção 22). Contestar não exige check-in de propósito.
  const bookingDisputed = seedBooking({
    est: e1, musician: musicians[4],
    start: daysFromNow(-3, 21), end: daysFromNow(-3, 23), fee: 1500,
    proposed_by: "establishment", created_at: daysFromNow(-15), expires_at: daysFromNow(-12),
  });
  bookingDisputed.confirm(daysFromNow(-13));
  bookingDisputed.complete(daysFromNow(-2, 23));
  bookingDisputed.dispute({
    reason: "O artista não compareceu no horário combinado e a casa ficou sem show.",
    at: daysFromNow(-1, 10),
  });

  const soloBookings = [
    bookingPending,
    bookingProposedByMusician,
    bookingConfirmed,
    bookingConfirmedLater,
    bookingPendingQualification,
    bookingCancelled,
    bookingExpired,
    bookingCompleted,
    bookingCompletedJoao,
    bookingDisputed,
  ];
  for (const booking of soloBookings) {
    assertValid("Booking", booking);
    await bookingRepo.insert(booking);
  }

  // Inquiries nos cinco status. `new Inquiry` pelo mesmo motivo do booking
  // (datas no passado); transições pelos métodos do agregado.
  const seedInquiry = (spec: {
    est: Establishment;
    musician: Musician;
    subject: string;
    message: string;
    created_at: Date;
    expires_at: Date;
  }): Inquiry =>
    new Inquiry({
      establishment_id: spec.est.establishment_id.id,
      musician_id: spec.musician.musician_id.id,
      subject: spec.subject,
      initial_message: spec.message,
      expires_at: spec.expires_at,
      created_at: spec.created_at,
      updated_at: spec.created_at,
    });

  const inquiryOpen = Inquiry.fake().anInquiry()
    .withEstablishmentId(new Uuid(e1.establishment_id.id))
    .withMusicianId(new Uuid(m1.musician_id.id))
    .build();

  const inquiryAccepted = seedInquiry({
    est: e2, musician: m2, subject: "Bossa aos domingos",
    message: "Queremos uma residência de bossa nova aos domingos no almoço.",
    created_at: daysFromNow(-4), expires_at: daysFromNow(3),
  });
  inquiryAccepted.accept(daysFromNow(-3));

  const inquiryRejected = seedInquiry({
    est: e1, musician: musicians[6], subject: "Festa de fim de ano",
    message: "Precisamos de DJ para a festa de fim de ano da casa.",
    created_at: daysFromNow(-6), expires_at: daysFromNow(1),
  });
  inquiryRejected.reject(daysFromNow(-5), "Agenda de dezembro já fechada");

  const inquiryExpired = seedInquiry({
    est: establishments[2], musician: musicians[3], subject: "Roda de samba",
    message: "Topa uma roda de samba numa sexta?",
    created_at: daysFromNow(-10), expires_at: daysFromNow(-3),
  });
  inquiryExpired.expire(now);

  const inquiryConverted = seedInquiry({
    est: e1, musician: m1, subject: "Mais uma data",
    message: "O público pediu bis: fecha mais uma noite com a gente?",
    created_at: daysFromNow(-4), expires_at: daysFromNow(3),
  });
  inquiryConverted.accept(daysFromNow(-3));
  inquiryConverted.convert(daysFromNow(-1), new Uuid(bookingConfirmedLater.booking_id.id));

  for (const inquiry of [inquiryOpen, inquiryAccepted, inquiryRejected, inquiryExpired, inquiryConverted]) {
    assertValid("Inquiry", inquiry);
    await inquiryRepo.insert(inquiry);
  }

  // ── 7. Chat: as DUAS portas da negociação + mensagens ─────────────────────
  console.log("💬 Conversas…");
  const conversation = Conversation.create({
    inquiry_id: inquiryOpen.inquiry_id.id,
    booking_id: null,
    establishment_id: e1.establishment_id.id,
    musician_id: m1.musician_id.id,
    band_id: null,
  });
  await conversationRepo.insert(conversation);

  const chatMessages = [
    { sender: e1.establishment_id.id, type: "establishment", text: "Olá! Curtimos seu perfil — topa tocar na Noite do Blues?" },
    { sender: m1.musician_id.id, type: "musician", text: "Opa, tenho interesse sim! Qual o horário e o cachê?" },
    { sender: e1.establishment_id.id, type: "establishment", text: "Das 20h às 23h. Podemos fechar em R$ 900?" },
  ] as const;
  for (const msg of chatMessages) {
    await messageRepo.insert(
      Message.create({
        conversation_id: conversation.conversation_id.id,
        sender_id: msg.sender,
        sender_type: msg.type,
        content: msg.text,
      }),
    );
  }

  /*
   * 🔴 A SEGUNDA porta: conversa nascida de uma PROPOSTA DE SHOW.
   *
   * Desde 17/set/2026 `BookingProposedEvent` também abre canal, e sem uma linha
   * assim o caminho inteiro fica intestável pelo app: nenhuma conversa teria
   * `booking_id`, o cartão de contexto do web nunca renderizaria o ramo de
   * booking, e a regressão só apareceria em produção. É a mesma lição que o
   * `CLAUDE.md` já registra — "o que o seed NÃO escreve vira feature
   * intestável, em silêncio".
   *
   * ⚠️ O booking escolhido é o `bookingPending` (Bar do Zé → João), porque é o
   * único estado em que a conversa tem razão de existir na tela: proposta
   * aberta, aguardando o artista, com cachê ainda negociável.
   */
  const bookingConversation = Conversation.create({
    inquiry_id: null,
    booking_id: bookingPending.booking_id.id,
    establishment_id: e1.establishment_id.id,
    musician_id: m1.musician_id.id,
    band_id: null,
  });
  await conversationRepo.insert(bookingConversation);

  const bookingChatMessages = [
    {
      sender: e1.establishment_id.id,
      type: "establishment",
      text: "Mandei a proposta pra sexta, das 20h às 23h. O cachê tá de acordo?",
    },
    {
      sender: m1.musician_id.id,
      type: "musician",
      text: "Show! Só consigo começar 20h30 por causa da passagem de som — fecha assim?",
    },
  ] as const;
  for (const msg of bookingChatMessages) {
    await messageRepo.insert(
      Message.create({
        conversation_id: bookingConversation.conversation_id.id,
        sender_id: msg.sender,
        sender_type: msg.type,
        content: msg.text,
      }),
    );
  }

  // ── 8. Pedidos de música (pending/accepted/rejected/played + top songs) ───
  console.log("🎵 Pedidos…");
  const songPool = [
    { title: "Evidências", artist: "Chitãozinho & Xororó", times: 4 },
    { title: "Wonderwall", artist: "Oasis", times: 3 },
    { title: "Garota de Ipanema", artist: "Tom Jobim", times: 2 },
    { title: "Tempo Perdido", artist: "Legião Urbana", times: 1 },
  ];
  let requestIndex = 0;
  const seededRequests: Request[] = [];
  for (const song of songPool) {
    for (let i = 0; i < song.times; i++) {
      const request = Request.fake().aRequest()
        .withEventId(new Uuid(evActive.event_id.id))
        .withAudienceId(new Uuid((requestIndex % 2 === 0 ? fan1 : fan2).audience_id.id))
        .withMusicianId(new Uuid(m1.musician_id.id))
        .withSongTitle(song.title)
        .withArtist(song.artist)
        .build();

      // varia o status: 0=pending, 1=accepted, 2=rejected, 3+=played
      const variant = requestIndex % 4;
      if (variant === 1) request.accept();
      if (variant === 2) request.reject("Não está no repertório");
      if (variant === 3) { request.accept(); request.markAsPlayed(); }

      await requestRepo.insert(request);
      seededRequests.push(request);
      requestIndex++;
    }
  }

  // ── 9. Gorjetas (todos os TipStatus) ──────────────────────────────────────
  console.log("💸 Gorjetas…");
  // `event` explícito por gorjeta: o relatório pós-show (F6) soma por evento +
  // destinatário. Com tudo no evento ao vivo, o relatório do show ENCERRADO
  // nasceria zerado — e um relatório sem dinheiro nenhum não exercita a parte
  // da tela que mais importa para o músico.
  // `at` = minutos desde o início do show. 🔴 As gorjetas do show ENCERRADO
  // precisam cair DENTRO dele: o relatório pós-show atribui gorjeta a música
  // por horário (`tips_during_song`), e com `created_at` = hora do seed nenhuma
  // casava com música nenhuma — a coluna saía zerada no relatório inteiro.
  const tipSpecs = [
    { fan: fan1, status: "completed" as const, amount: 25, event: evActive, at: 20 },
    { fan: fan2, status: "completed" as const, amount: 50, event: evActive, at: 35 },
    { fan: fan1, status: "pending" as const, amount: 10, event: evActive, at: 50 },
    { fan: fan2, status: "failed" as const, amount: 15, event: evActive, at: 52 },
    { fan: fan1, status: "completed" as const, amount: 30, event: evCompleted, at: 5 },
    { fan: fan2, status: "completed" as const, amount: 20, event: evCompleted, at: 28 },
    { fan: fan2, status: "completed" as const, amount: 120, event: evCompleted, at: 62 },
  ];
  for (const spec of tipSpecs) {
    const tip = Tip.fake().aTip()
      .withAudienceId(new Uuid(spec.fan.audience_id.id))
      .withMusicianId(new Uuid(m1.musician_id.id))
      .withEventId(new Uuid(spec.event.event_id.id))
      // amount explícito: o default do fake builder gera Money com >2 casas
      // decimais (chance.floating) e estoura a validação do VO
      .withAmount(new Money(spec.amount))
      .withCreatedAt(new Date(spec.event.start_at.getTime() + spec.at * 60_000))
      .build();
    if (spec.status === "completed") tip.complete(`seed-tx-${Math.random().toString(36).slice(2, 10)}`);
    if (spec.status === "failed") tip.fail();
    await tipRepo.insert(tip);
  }

  // Gorjeta ANÔNIMA com mensagem: `is_anonymous` esconde o nome na exibição,
  // mas a identidade continua gravada (a FK de `audience_id` é obrigatória).
  const anonymousTip = Tip.create({
    audience_id: fan2.audience_id.id,
    musician_id: m1.musician_id.id,
    event_id: evActive.event_id.id,
    amount: 15,
    message: "Toca Raul! 🤘",
    is_anonymous: true,
    payment_method: PaymentMethod.PIX,
  });
  anonymousTip.complete(`seed-tx-${anonymousTip.tip_id.id.slice(0, 8)}`);
  await tipRepo.insert(anonymousTip);

  // ── 9b. Pedidos com DESTAQUE pago (gorjeta acoplada ao pedido) ───────────
  //
  // 🔴 PAGA ANTES, destaca DEPOIS (28/set/2026): o PIX nasce no PEDIDO — é a
  // ordem que `CreateRequestUseCase` segue em produção. Gorjeta antes do
  // pedido por causa da FK `music_requests.boostTipId -> tips.id`.
  //
  // Os estados que o domínio GRAVA hoje:
  //   awaiting_payment → pedido feito, PIX não pago: banner "conclua o PIX";
  //                      NÃO sobe na fila
  //   paid             → selo "confirmado", topo da fila, dedicatória no palco
  //   expired          → PIX não pago na janela: pedido comum
  //   cancelled        → recusado ANTES de pagar
  //   refund_pending   → pagou e foi recusado: o dinheiro precisa voltar
  //                      (reembolso é tarefa aberta —
  //                      Docs/funcionalidades/reembolso-do-destaque-pago.md)
  // `promised` não é semeado: virou estado transitório (só dentro da
  // criação) e só existe em linha antiga.
  //
  // ⚠️ `awaiting_payment` VENCE SOZINHO: `ExpireRequestBoostsJob` roda a cada
  // 5 min e expira o que passou de `REQUEST_BOOST_PAYMENT_WINDOW_MINUTES`
  // (15 min) desde o pedido. Com o backend no ar, esse estado dura ~20 min
  // depois do seed — por isso o `expired` existe semeado, e não só "esperando".
  console.log("⚡ Pedidos com destaque…");
  type BoostSeedState = "paid" | "awaiting_payment" | "expired" | "cancelled" | "refund_pending";
  const boostSpecs: {
    fan: Audience;
    song: string;
    artist: string;
    amount: number;
    dedication: string | null;
    state: BoostSeedState;
    /** O músico já respondeu? `paid` aceito é o que aparece no Palco. */
    response: "pending" | "accept" | "reject";
  }[] = [
    { fan: fan1, song: "Trem-Bala", artist: "Ana Vilela", amount: 10, dedication: "Essa é pra minha esposa, Ana 💚", state: "paid", response: "accept" },
    { fan: fan2, song: "Sozinho", artist: "Caetano Veloso", amount: 5, dedication: "Pro meu pai, que me ensinou essa", state: "awaiting_payment", response: "pending" },
    { fan: fan1, song: "Como É Grande o Meu Amor Por Você", artist: "Roberto Carlos", amount: 20, dedication: null, state: "paid", response: "pending" },
    { fan: fan2, song: "Pais e Filhos", artist: "Legião Urbana", amount: 8, dedication: "Pra minha irmã que tá na plateia", state: "expired", response: "pending" },
    { fan: fan1, song: "Asa Branca", artist: "Luiz Gonzaga", amount: 12, dedication: null, state: "cancelled", response: "reject" },
    { fan: fan2, song: "Evidências", artist: "Chitãozinho & Xororó", amount: 15, dedication: "Pro meu amor", state: "refund_pending", response: "reject" },
  ];

  for (const spec of boostSpecs) {
    const request = Request.create({
      event_id: evActive.event_id.id,
      audience_id: spec.fan.audience_id.id,
      musician_id: m1.musician_id.id,
      song_title: spec.song,
      artist: spec.artist,
      boost: new RequestBoost({
        amount: new Money(spec.amount),
        dedication: spec.dedication,
      }),
    });

    // O PIX nasce COM o pedido — nunca no aceite.
    const moneyIn = spec.state === "paid" || spec.state === "refund_pending";
    const boostTip = Tip.create({
      audience_id: spec.fan.audience_id.id,
      musician_id: m1.musician_id.id,
      event_id: evActive.event_id.id,
      amount: spec.amount,
      message: spec.dedication,
      payment_method: PaymentMethod.PIX,
    });
    boostTip.attachPixCharge(
      "seed-qr-base64",
      `00020126seed${boostTip.tip_id.id.slice(0, 8)}`,
    );
    if (moneyIn) boostTip.complete(`seed-tx-${boostTip.tip_id.id.slice(0, 8)}`);
    await tipRepo.insert(boostTip);
    request.markBoostAwaitingPayment(boostTip.tip_id.id);

    if (moneyIn) request.markBoostPaid();
    // A cobrança fica `pending` para sempre — ninguém pagou. Mesmo rastro do job.
    if (spec.state === "expired") request.markBoostExpired();

    if (spec.response === "accept") request.accept();
    // Recusa: PIX não pago → `cancelled`; já pago → `refund_pending`
    // (é o próprio `reject()` que decide).
    if (spec.response === "reject") request.reject("Não toco essa no formato voz e violão");

    await requestRepo.insert(request);
    seededRequests.push(request);
  }

  // ── 10. Line-up dos eventos (EventMusician) — necessário pro fluxo do fã
  //        (EventPerformersScreen: evento → quem toca → pedido/gorjeta) ──────
  console.log("🎼 Line-up dos eventos…");
  const lineupSpecs = [
    { event: evScheduled, musician: m1, status: "confirmed" as const, fee: 900 },
    { event: evActive, musician: m1, status: "confirmed" as const, fee: 600 },
    { event: evActive, musician: m2, status: "pending" as const, fee: null },
    { event: evCompleted, musician: m2, status: "confirmed" as const, fee: 1200 },
    // João também tocou no evento passado: é o que dá histórico ao currículo
    // verificado (F4) e ao setlist inteligente (F5), que cruzam por LOCAL.
    { event: evCompleted, musician: m1, status: "confirmed" as const, fee: 800 },
    // Único `cancelled` do line-up: saiu da Noite do Blues. Continua listado
    // para a casa, mas NÃO passa em `MusicianMustBePerformerPolicy` (pedido) nem
    // na elegibilidade de abrir set.
    { event: evScheduled, musician: musicians[4], status: "cancelled" as const, fee: 500 },
    // Cartaz da Home do fã — ver os eventos acima.
    { event: evLapaLive, musician: musicians[3], status: "confirmed" as const, fee: 700 },
    { event: evMaresiaLive, musician: musicians[4], status: "confirmed" as const, fee: 650 },
    { event: evTonight, musician: musicians[5], status: "confirmed" as const, fee: 500 },
    { event: evTomorrow, musician: musicians[6], status: "confirmed" as const, fee: 800 },
    { event: evCordas, musician: musicians[7], status: "confirmed" as const, fee: 900 },
  ];
  for (const spec of lineupSpecs) {
    const eventMusician = EventMusician.fake().aEventMusician()
      .withEventId(new Uuid(spec.event.event_id.id))
      .withMusicianId(new Uuid(spec.musician.musician_id.id))
      .withBandId(null)
      .withStatus(spec.status)
      .withFee(spec.fee)
      .build();
    await eventMusicianRepo.insert(eventMusician);
  }

  // ── 11. Presenças + interações (EventAttendee, UserInteraction) ───────────
  console.log("🎟️ Presenças e interações…");
  const attendeeSpecs = [
    { fan: fan1, event: evActive, left: false },
    { fan: fan2, event: evActive, left: false },
    { fan: fan2, event: evCompleted, left: true },
    // Ana também esteve no show passado. Duas razões: o currículo verificado
    // conta público alcançado como pessoas DISTINTAS (com uma só, o número
    // nasce em 1 e não exercita a deduplicação), e a avaliação dela na seção 20
    // usa `context_type: "event"` — que exige presença registrada neste evento.
    { fan: fan1, event: evCompleted, left: true },
  ];
  for (const spec of attendeeSpecs) {
    const attendee = EventAttendee.fake().anEventAttendee()
      .withEventId(new Uuid(spec.event.event_id.id))
      .withAudienceId(new Uuid(spec.fan.audience_id.id))
      .withJoinedAt(new Date(spec.event.start_at.getTime() + 10 * 60_000))
      .withLeftAt(spec.left ? daysFromNow(-7, 23) : null)
      .withIsActive(!spec.left)
      .build();
    await eventAttendeeRepo.insert(attendee);
  }

  const interactionSpecs = [
    { fan: fan1, type: "qr_scan", target: m1.musician_id.id, points: 10 },
    { fan: fan1, type: "song_request", target: m1.musician_id.id, points: 5 },
    { fan: fan2, type: "qr_scan", target: m1.musician_id.id, points: 10 },
    { fan: fan2, type: "tip_given", target: m1.musician_id.id, points: 20 },
  ];
  for (const spec of interactionSpecs) {
    const interaction = UserInteraction.fake().aUserInteraction()
      .withUserId(spec.fan.audience_id.id)
      .withInteractionType(spec.type)
      .withTargetId(spec.target)
      .withPointsEarned(spec.points)
      .build();
    await userInteractionRepo.insert(interaction);
  }

  // ── 11b. Seguidores (Bloco 19.B) ─────────────────────────────────────────
  // Ana segue o João e o Bar do Zé — é o login para ver o botão "Seguindo" e a
  // tela "Quem você segue". Bruno segue o João com os avisos DESLIGADOS: sem
  // ele o sino da lista só existiria num estado. Nenhum push token é semeado —
  // um token falso só geraria erro de entrega; o aparelho real registra o seu
  // ao logar e dar permissão no primeiro "Seguir".
  console.log("🔔 Seguidores…");
  const followRepo = new FollowPrismaRepository(prisma);
  await followRepo.insert(Follow.create({ audience_id: fan1.audience_id.id, target_type: "musician", target_id: m1.musician_id.id }));
  await followRepo.insert(Follow.create({ audience_id: fan1.audience_id.id, target_type: "establishment", target_id: e1.establishment_id.id }));
  const brunoFollow = Follow.create({ audience_id: fan2.audience_id.id, target_type: "musician", target_id: m1.musician_id.id });
  brunoFollow.disableNotifications();
  await followRepo.insert(brunoFollow);

  // ── 12. Gamificação: catálogo de badges + conquistas + ledger + projeção ──
  console.log("🏅 Gamificação…");
  const badgeSpecs = [
    { name: "Iniciante Musical", icon: "🎵", category: "engagement" as const, rarity: "common" as const, points: 10 },
    { name: "Apoiador", icon: "💸", category: "support" as const, rarity: "common" as const, points: 25 },
    { name: "Mecenas", icon: "👑", category: "support" as const, rarity: "epic" as const, points: 100 },
    { name: "Super Fã", icon: "⭐", category: "engagement" as const, rarity: "legendary" as const, points: 200 },
  ];
  for (const spec of badgeSpecs) {
    const badge = Badge.fake().aBadge()
      .withName(spec.name)
      .withDescription(`Badge ${spec.name} do SoundMeet`)
      .withIcon(spec.icon)
      .withCategory(spec.category)
      .withRarity(spec.rarity)
      .withPoints(spec.points)
      .build();
    await badgeRepo.insert(badge);
  }


  // Ledger (UserScore = fonte de verdade) + projeção (UserPoints = resumo).
  //
  // 🔴 Pontos pelo mapa CANÔNICO (`gamification-points.ts`): scan 10, pedido
  // 25, pedido aceito 50, gorjeta 1/real, presença 20, indicação 15,
  // compartilhamento 10. O seed anterior dava 5 ao pedido e 15 à presença, e
  // gravava "nível 2" com 45 pontos — que é nível 1. Agora a projeção e o
  // ranking são CALCULADOS a partir do ledger abaixo, em vez de escritos à mão.
  //
  // `reference` só importa para os dois tipos com dedupe (Bloco 16): o crédito
  // é único por (usuário, tipo, referência). Os formatos são os do use-case —
  // `<musician_id>:<establishment_id>` na indicação e `<content_type>:<id>` no
  // compartilhamento — então repetir a MESMA indicação/compartilhamento no app
  // exercita o "já creditado", e uma nova credita.
  const scoreSpecs = [
    { fan: fan1, type: ScoreTypeEnum.QR_SCAN, points: 10, description: "Scan no show do João" },
    { fan: fan1, type: ScoreTypeEnum.REQUEST_SENT, points: 25, description: "Pediu Evidências" },
    { fan: fan1, type: ScoreTypeEnum.REQUEST_ACCEPTED, points: 50, description: "Trem-Bala foi aceito" },
    { fan: fan1, type: ScoreTypeEnum.TIP_GIVEN, points: 25, description: "Gorjeta de R$ 25" },
    { fan: fan1, type: ScoreTypeEnum.TIP_GIVEN, points: 30, description: "Gorjeta de R$ 30" },
    { fan: fan1, type: ScoreTypeEnum.EVENT_ATTENDANCE, points: 20, description: "Presença no Jantar com Bossa" },
    { fan: fan1, type: ScoreTypeEnum.INDICATION, points: 15, description: "Indicou João do Blues ao Maresia", reference: `${m1.musician_id.id}:${e2.establishment_id.id}` },
    { fan: fan1, type: ScoreTypeEnum.INDICATION, points: 15, description: "Indicou Maria Bossa ao Maresia", reference: `${m2.musician_id.id}:${e2.establishment_id.id}` },
    { fan: fan1, type: ScoreTypeEnum.INDICATION, points: 15, description: "Indicou Carlão do Piano ao Bar do Zé", reference: `${musicians[2].musician_id.id}:${e1.establishment_id.id}` },
    { fan: fan1, type: ScoreTypeEnum.INDICATION, points: 15, description: "Indicou Helena Cordas ao Bar do Zé", reference: `${musicians[7].musician_id.id}:${e1.establishment_id.id}` },
    { fan: fan2, type: ScoreTypeEnum.QR_SCAN, points: 10, description: "Scan no show do João" },
    { fan: fan2, type: ScoreTypeEnum.REQUEST_SENT, points: 25, description: "Pediu Wonderwall" },
    { fan: fan2, type: ScoreTypeEnum.REQUEST_ACCEPTED, points: 50, description: "Wonderwall foi aceito" },
    { fan: fan2, type: ScoreTypeEnum.TIP_GIVEN, points: 50, description: "Gorjeta de R$ 50" },
    { fan: fan2, type: ScoreTypeEnum.TIP_GIVEN, points: 20, description: "Gorjeta de R$ 20" },
    { fan: fan2, type: ScoreTypeEnum.TIP_GIVEN, points: 120, description: "Gorjeta de R$ 120" },
    { fan: fan2, type: ScoreTypeEnum.EVENT_ATTENDANCE, points: 20, description: "Presença no Jantar com Bossa" },
    { fan: fan2, type: ScoreTypeEnum.INDICATION, points: 15, description: "Indicou Maria Bossa ao Maresia", reference: `${m2.musician_id.id}:${e2.establishment_id.id}` },
    { fan: fan2, type: ScoreTypeEnum.INDICATION, points: 15, description: "Indicou Carlão do Piano ao Bar do Zé", reference: `${musicians[2].musician_id.id}:${e1.establishment_id.id}` },
    { fan: fan2, type: ScoreTypeEnum.INDICATION, points: 15, description: "Indicou Bia Viola ao Bar do Zé", reference: `${musicians[5].musician_id.id}:${e1.establishment_id.id}` },
    { fan: fan2, type: ScoreTypeEnum.SOCIAL_SHARE, points: 10, description: "Compartilhou o QR do João", reference: `qr_code:${m1.musician_id.id}` },
  ] as { fan: Audience; type: ScoreTypeEnum; points: number; description: string; reference?: string }[];
  for (const spec of scoreSpecs) {
    const builder = UserScore.fake().aUserScore()
      .withUserId(new Uuid(spec.fan.audience_id.id))
      .withScoreType(spec.type)
      .withPoints(spec.points)
      .withDescription(spec.description);
    if (spec.reference) builder.withReferenceId(spec.reference);
    await userScoreRepo.insert(builder.build());
  }

  const ledgerTotals = new Map<string, number>();
  for (const fan of [fan1, fan2]) {
    const mine = scoreSpecs.filter((s) => s.fan === fan);
    const count = (type: ScoreTypeEnum) => mine.filter((s) => s.type === type).length;
    const total = mine.reduce((acc, s) => acc + s.points, 0);
    ledgerTotals.set(fan.audience_id.id, total);
    const points = UserPoints.fake().aUserPoints()
      .withUserId(new Uuid(fan.audience_id.id))
      .withTotalPoints(total)
      .withTotalScans(count(ScoreTypeEnum.QR_SCAN))
      .withTotalRequests(count(ScoreTypeEnum.REQUEST_SENT))
      .withTotalTips(count(ScoreTypeEnum.TIP_GIVEN))
      .withTotalSocialShares(count(ScoreTypeEnum.SOCIAL_SHARE))
      .withCurrentLevel(UserLevel.getLevelByPoints(total).level)
      .build();
    await userPointsRepo.insert(points);
  }

  // Conquistas DERIVADAS do ledger acima, pelo mesmo use-case que o
  // `AddPointsUseCase` chama a cada crédito (29/set/2026). O seed escrevia as
  // linhas à mão, e mentia: "Super Fã" desbloqueado com 100 de progresso, num
  // limiar de 10.000 pontos. Hoje os dois fãs saem com "Iniciante Musical"
  // aberto e o resto a caminho — e o app desenha as argolas vazias pelo catálogo.
  const syncUserBadges = new SyncUserBadgesUseCase(userScoreRepo, userBadgeRepo);
  for (const fan of [fan1, fan2]) {
    await syncUserBadges.execute({ user_id: fan.audience_id.id });
  }

  // ── 13. Votos em pedidos (RequestVote) ─────────────────────────────────────
  console.log("🗳️ Votos…");
  const pendingRequest = seededRequests.find((r) => !r.isAccepted && !r.isPlayed);
  if (pendingRequest) {
    for (const fan of [fan1, fan2]) {
      const vote = RequestVote.fake().aVote()
        .withRequestId(pendingRequest.request_id.id)
        .withAudienceId(fan.audience_id.id)
        .build();
      await requestVoteRepo.insert(vote);
    }
  }

  // ── 14. Transações (histórico financeiro do músico 1) ─────────────────────
  console.log("🧾 Transações…");
  // Extrato espelha EXATAMENTE o que mexeu na carteira do João (seções 1 e 22):
  // as sete gorjetas pagas (liquidadas no Mercado Pago, só `total_earned`) e os
  // três saques. Os saques debitam a carteira de verdade na seção 22 — inclusive
  // o `pending`, porque o saque é RESERVA → PROVEDOR: o dinheiro sai do saldo
  // antes da transferência confirmar.
  const transactionSpecs = [
    { type: TransactionType.TIP, amount: 25, fee: 2.25, status: TransactionStatus.COMPLETED, fan: fan1, daysAgo: 0 },
    { type: TransactionType.TIP, amount: 50, fee: 4.5, status: TransactionStatus.COMPLETED, fan: fan2, daysAgo: 0 },
    { type: TransactionType.TIP, amount: 15, fee: 1.35, status: TransactionStatus.COMPLETED, fan: fan2, daysAgo: 0 },
    { type: TransactionType.TIP, amount: 10, fee: 0.9, status: TransactionStatus.COMPLETED, fan: fan1, daysAgo: 0 },
    { type: TransactionType.TIP, amount: 30, fee: 2.7, status: TransactionStatus.COMPLETED, fan: fan1, daysAgo: 7 },
    { type: TransactionType.TIP, amount: 20, fee: 1.8, status: TransactionStatus.COMPLETED, fan: fan2, daysAgo: 7 },
    { type: TransactionType.TIP, amount: 120, fee: 10.8, status: TransactionStatus.COMPLETED, fan: fan2, daysAgo: 7 },
    { type: TransactionType.WITHDRAWAL, amount: 60, fee: 0, status: TransactionStatus.COMPLETED, fan: null, daysAgo: 2 },
    // Aguardando o webhook do provedor — o saldo já saiu (reserva).
    { type: TransactionType.WITHDRAWAL, amount: 150, fee: 0, status: TransactionStatus.PENDING, fan: null, daysAgo: 1 },
    // Recusado pelo provedor e ESTORNADO: `refundWithdrawal` devolveu saldo e
    // `total_withdrawn`, e o motivo fica em `metadata.failure_reason`.
    { type: TransactionType.WITHDRAWAL, amount: 200, fee: 0, status: TransactionStatus.FAILED, fan: null, daysAgo: 1, failure: "Chave PIX de destino recusada pelo banco recebedor" },
  ] as {
    type: TransactionType; amount: number; fee: number; status: TransactionStatus;
    fan: Audience | null; daysAgo: number; failure?: string;
  }[];
  for (const spec of transactionSpecs) {
    const transaction = Transaction.fake().aTransaction()
      .withMusicianId(new Uuid(m1.musician_id.id))
      .withUserId(spec.fan ? new Uuid(spec.fan.audience_id.id) : null)
      .withType(spec.type)
      .withAmount(new Money(spec.amount))
      .withFee(new Money(spec.fee))
      .withNetAmount(new Money(spec.amount).subtract(new Money(spec.fee)))
      .withStatus(spec.status)
      .withCreatedAt(spec.daysAgo === 0 ? hoursFromNow(-1) : daysFromNow(-spec.daysAgo, 15))
      .build();
    if (spec.failure) transaction.fail(spec.failure);
    await transactionRepo.insert(transaction);
  }

  // ── 15. Biblioteca musical + repertórios (Play Mode / setlists) ────────────
  //
  // `sheet` preenche chords + LRC + seções: é o que o GET .../chord-sheet lê
  // (nunca a coluna chord_sheet, que é o blob materializado). Sem isso o Play
  // Mode abre a música com a cifra vazia — foi o estado do seed até aqui.
  // Duas músicas ficam SEM `sheet` de propósito ("Tempo Perdido", "Águas de
  // Março"): é o caso real de música na biblioteca ainda não analisada pela IA.
  console.log("📚 Biblioteca e repertórios…");
  const librarySpecs = [
    {
      musician: m1, title: "Evidências", artist: "Chitãozinho & Xororó",
      genre: "Sertanejo", key: "G", bpm: 132, youtubeId: "seedEvid001",
      sheet: {
        duration: 208,
        progression: ["G", "Em", "C", "D"],
        lyrics: [
          [8, "Quando a noite chega e o bar enche de gente"],
          [12.5, "Alguém pede a música de sempre"],
          [17, "E o violão começa a responder"],
          [22, "Refrão que todo mundo sabe cantar"],
          [27, "Mais alto, mais alto agora"],
          [32, "Até a última mesa acompanhar"],
        ] as [number, string][],
      },
    },
    {
      musician: m1, title: "Wonderwall", artist: "Oasis",
      genre: "Rock", key: "F#m", bpm: 87, youtubeId: "seedWonder1",
      sheet: {
        duration: 259,
        progression: ["F#m", "A", "E", "B"],
        lyrics: [
          [10, "A batida entra devagar"],
          [16, "E a casa inteira reconhece"],
          [22, "Todo mundo canta esse trecho"],
          [28, "Com a mão no ar e sem pressa"],
          [34, "Depois o refrão volta de novo"],
        ] as [number, string][],
      },
    },
    {
      musician: m1, title: "Garota de Ipanema", artist: "Tom Jobim",
      genre: "Bossa Nova", key: "F", bpm: 120, youtubeId: "seedIpanem1",
      sheet: {
        duration: 191,
        progression: ["F7M", "G7", "Gm7", "F7M"],
        lyrics: [
          [6, "A bossa entra leve na primeira mesa"],
          [11, "O baixo desenha o caminho"],
          [16, "E a melodia atravessa o salão"],
          [21, "Ninguém precisa levantar a voz"],
        ] as [number, string][],
      },
    },
    { musician: m1, title: "Tempo Perdido", artist: "Legião Urbana", genre: "Rock", key: "D", bpm: 122 },
    {
      musician: musicians[2], title: "Fly Me to the Moon", artist: "Frank Sinatra",
      genre: "Jazz", key: "Am", bpm: 116, youtubeId: "seedFlyMoon",
      sheet: {
        duration: 148,
        progression: ["Am7", "Dm7", "G7", "C7M"],
        lyrics: [
          [5, "O piano abre o standard sozinho"],
          [10, "A cozinha entra no segundo compasso"],
          [15, "E o tema se apresenta inteiro"],
          [20, "Antes de abrir espaço pro solo"],
        ] as [number, string][],
      },
    },
    { musician: musicians[2], title: "Águas de Março", artist: "Elis Regina", genre: "MPB", key: "Bb", bpm: 108 },
    // Mesma música do João, na biblioteca do Carlos e com UM acorde diferente
    // (Bb7 no lugar do Gm7). É o cenário de importação da comunidade: as duas
    // análises divergem, então o import reancora as edições e devolve conflito
    // de verdade para a ConflictsReviewSheet do app.
    {
      musician: musicians[2], title: "Garota de Ipanema", artist: "Tom Jobim",
      genre: "Bossa Nova", key: "F", bpm: 120, youtubeId: "seedIpanem2",
      sheet: {
        duration: 191,
        progression: ["F7M", "G7", "Bb7", "F7M"],
        lyrics: [
          [6, "A bossa entra leve na primeira mesa"],
          [11, "O baixo desenha o caminho"],
          [16, "E a melodia atravessa o salão"],
          [21, "Ninguém precisa levantar a voz"],
        ] as [number, string][],
      },
    },
    // Repertório de piano-bar do Carlos (30/set/2026): a turnê semeada na seção
    // 19b toca daqui, e com 3 músicas a setlist riscada do relatório não teria
    // o que riscar. Sem cifra de propósito — é a biblioteca real de quem ainda
    // não mandou a IA escrever tudo.
    ...([
      ["Take Five", "Dave Brubeck", "Jazz", "Ebm", 172],
      ["Autumn Leaves", "Bill Evans", "Jazz", "Gm", 120],
      ["So What", "Miles Davis", "Jazz", "Dm", 136],
      ["Blue Bossa", "Joe Henderson", "Jazz", "Cm", 140],
      ["Summertime", "Ella Fitzgerald", "Jazz", "Am", 90],
      ["Wave", "Tom Jobim", "Bossa Nova", "D", 118],
      ["Corcovado", "Tom Jobim", "Bossa Nova", "C", 104],
      ["Chega de Saudade", "João Gilberto", "Bossa Nova", "Dm", 126],
      ["Desafinado", "João Gilberto", "Bossa Nova", "F", 128],
    ] as const).map(([title, artist, genre, key, bpm]) => ({ musician: musicians[2], title, artist, genre, key, bpm })),
  ];
  const libraryItems: MusicLibrary[] = [];
  for (const spec of librarySpecs) {
    const builder = MusicLibrary.fake().aMusicLibrary()
      .withMusicianId(new Uuid(spec.musician.musician_id.id))
      .withTitle(spec.title)
      .withArtist(spec.artist)
      .withGenre(spec.genre)
      .withKey(spec.key)
      .withBpm(spec.bpm)
      .withDifficulty(3);

    // 🔴 `source`/`source_id` NÃO são decoração. O Modo Ensaio
    // (`PracticeSeparationController`) re-resolve o áudio pelo provider a partir
    // deste par, porque a gravação original é descartada assim que a análise da
    // cifra conclui. Sem eles a rota responde 422 "sem fonte de áudio
    // conhecida" — que era o estado de 100% das músicas do seed até 22/ago,
    // deixando a feature inteira impossível de testar.
    //
    // Os ids são fictícios de propósito: o seed não baixa áudio de lugar nenhum.
    // Servem para exercitar o caminho até a chamada ao provider, que falha de
    // forma limpa e observável (422 com a mensagem da fonte), em vez de falhar
    // antes por falta de dado.
    if (spec.youtubeId) {
      builder.withSource("youtube", spec.youtubeId);
    }

    const item = builder.build();

    if (spec.sheet) {
      // 🔴 Compassos DERIVADOS da duração, não cravados.
      //
      // Antes o seed fixava `bars` (24, 20, 16…), e o resultado era uma cifra
      // que cobria ~20% da música: "Evidências" tinha 24 acordes × 1818ms =
      // 43s de cifra numa faixa declarada com 208s. A folha abria bonita e
      // acabava no primeiro quinto — e o Modo Ensaio, que mapeia posição do
      // áudio → progresso da cifra, herdaria a distorção inteira.
      //
      // Agora a progressão dá a volta até cobrir a duração declarada. Continua
      // sintética (um loop de 4 acordes), mas coerente: acorde, seção e duração
      // contam a mesma história.
      const msPerChord = Math.round((60000 / spec.bpm) * 4);
      const timeline = buildChordTimeline({
        progression: spec.sheet.progression,
        bpm: spec.bpm,
        bars: Math.max(
          spec.sheet.progression.length,
          Math.round((spec.sheet.duration * 1000) / msPerChord),
        ),
      });
      item.updateChords({ timeline });
      item.updateStructureSegments(
        buildSections(timeline, spec.sheet.duration * 1000),
      );
      item.changeDurationSeconds(spec.sheet.duration);

      // Passa pelo LrcParser em vez de montar o normalized na mão: é o mesmo
      // caminho do provedor real, então o shape nunca diverge do que o
      // GET .../chord-sheet sabe consumir.
      const parsed = LrcParser.parse({
        raw: buildLrc(spec.sheet.lyrics),
        provider: "seed",
      });
      if (parsed.isFail()) {
        throw new Error(`LRC inválido no seed (${spec.title}): ${parsed.error.message}`);
      }
      item.updateLrc({
        lrc_raw: parsed.ok.raw,
        lrc_normalized: parsed.ok.normalized as unknown as Record<string, unknown>,
        lrc_provider: parsed.ok.provider,
        lrc_hash: parsed.ok.hash,
        lrc_quality_flags: parsed.ok.quality.flags,
        lrc_coverage_ms: parsed.ok.quality.coverage_ms,
        lrc_has_word_timestamps: parsed.ok.quality.has_word_timestamps,
        lrc_last_synced_at: new Date(),
      });
    }

    await musicLibraryRepo.insert(item);
    libraryItems.push(item);
  }

  const libraryOf = (musician: Musician, title: string) =>
    libraryItems.find(
      (i) => i.musician_id.id === musician.musician_id.id && i.title === title,
    )!;

  // m1 é FREE (máx. 1 repertório / 20 músicas) — 1 setlist dentro do limite;
  // m3 é PRO (ilimitado) — 1 setlist de jazz.
  const repertoireM1 = Repertoire.create({ musician_id: m1.musician_id.id, name: "Clássicos do Bar" });
  // As QUATRO do João (era slice(0, 3)): o set ao vivo semeado já tocou as três
  // primeiras, e com só elas a fila do Palco abria vazia ("setlist cumprida").
  // "Tempo Perdido" fica por tocar — e, sem cifra, exercita a estante "de ouvido".
  for (const item of libraryItems.filter((l) => l.musician_id.id === m1.musician_id.id)) {
    repertoireM1.addSong(RepertoireSong.create({ music_library_id: item.music_library_id.id }));
  }
  await repertoireRepo.insert(repertoireM1);

  // Filtro por dono em vez de slice por índice: a lista cresceu e um índice
  // cravado colocaria música do João no setlist de jazz do Carlos.
  const repertoireM3 = Repertoire.create({ musician_id: musicians[2].musician_id.id, name: "Noite de Jazz" });
  for (const item of libraryItems.filter(
    (i) => i.musician_id.id === musicians[2].musician_id.id,
  )) {
    repertoireM3.addSong(RepertoireSong.create({ music_library_id: item.music_library_id.id }));
  }
  // Compartilhamento (link com token) + convite nominal ao João — as duas
  // formas de `repertoire_sharing`, recurso do ESSENTIAL/PRO. Sem isto a tabela
  // `repertoire_invitees` nunca tinha linha e o "repertórios compartilhados
  // comigo" do João abria vazio. ⚠️ O token do link vence em 7 dias (`share()`).
  repertoireM3.share();
  repertoireM3.inviteMusician(m1.musician_id.id);
  await repertoireRepo.insert(repertoireM3);

  // ── 16. Assinaturas de estabelecimento (gates 4C.7 / campanhas / QRs) ─────
  console.log("💳 Assinaturas de estabelecimento…");
  const establishmentSubs = [
    { est: establishments[0], tier: EstablishmentPlanTier.GROWTH },
    { est: establishments[2], tier: EstablishmentPlanTier.PRO },
  ];
  for (const spec of establishmentSubs) {
    const subscription = Subscription.create({
      establishment_id: spec.est.establishment_id.id,
      plan_tier: spec.tier,
      persona: "establishment",
      billing_cycle: BillingCycle.MONTHLY,
    });
    await subscriptionRepo.insert(subscription);
  }
  // Estados terminais do lado estabelecimento — Savassi CANCELOU o GROWTH,
  // Maresia deixou VENCER. Os dois seguem FREE na prática (só `active`/`trial`
  // contam), então o 402 do analytics no Maresia continua exercitável.
  for (const spec of [
    { est: establishments[3], end: "cancel" as const },
    { est: establishments[1], end: "expire" as const },
  ]) {
    const past = Subscription.create({
      establishment_id: spec.est.establishment_id.id,
      plan_tier: EstablishmentPlanTier.GROWTH,
      persona: "establishment",
      billing_cycle: BillingCycle.MONTHLY,
    });
    if (spec.end === "cancel") past.cancel();
    else past.expire();
    await subscriptionRepo.insert(past);
  }

  // ── 17. Bandas (opt-in de radar + convite com estado, jul/2026) ───────────
  console.log("🥁 Bandas…");

  // Carlão Trio — líder é o Carlos (musico3, PRO). É a banda do lado
  // ESTABELECIMENTO (busca de banda, hiring-dashboard compatible_bands):
  // open_to_gigs=true + endereço próprio preenchido pra aparecer de verdade
  // nesses fluxos. E é o login para testar o CONVITE pelo app: convidar é do
  // plano PRO, e o líder da Blues Duo (João) é FREE.
  const band = Band.fake().aBand()
    .withName("Carlão Trio")
    .withDescription("Trio de jazz e samba para eventos")
    .withGenres(["Jazz", "Samba"])
    // Tempo de estrada longo — o caso em que o selo pesa na decisão da casa.
    .withFormedIn(2011)
    .withMembers([
      { musician_id: new Uuid(musicians[2].musician_id.id), role: "leader", instrument: "Piano", status: "accepted", joined_at: daysFromNow(-90), responded_at: daysFromNow(-90) },
      { musician_id: new Uuid(m1.musician_id.id), role: "member", instrument: "Guitarra", status: "accepted", joined_at: daysFromNow(-60), responded_at: daysFromNow(-60) },
    ])
    .withOpenToGigs(true)
    .withAddress(
      new Location({
        city: "Belo Horizonte", state: "MG",
        latitude: -19.9191, longitude: -43.9386,
        street: "Praça Sete de Setembro", number: "1",
        complement: null, neighborhood: "Centro", zip_code: "30130010",
      }),
    )
    .build();
  await bandRepo.insert(band);

  // Blues Duo — líder é o João (musico1, FREE), pra testar de ponta a ponta
  // as telas de líder no mobile (Disponibilidade/Endereço/Tempo de estrada,
  // cancelar convite, transferir, dissolver). open_to_gigs fica null de
  // propósito (não setado) — cobre o estado "banda ainda não decidiu" na UI
  // de líder, distinto da Carlão Trio.
  // Membros: Maria (musico2) com convite "pending" — logando como ela, o
  // convite aparece em "Minhas bandas" para aceitar ou recusar — e Carlos com
  // "declined" (o botão "Convidar de novo" na linha dele).
  // ⚠️ João é FREE e convidar é do PRO: nele, "Convidar" e "Convidar de novo"
  // mostram o aviso de plano. Quem exercita o convite é o Carlos, na Carlão
  // Trio. E a Blues Duo tem show pendente (seção 17b), então "Dissolver"
  // responde 409 nela — é o lado negativo; o positivo é criar uma banda nova.
  const bandJoao = Band.fake().aBand()
    .withName("Blues Duo")
    .withDescription("Duo de blues e rock para bares")
    .withGenres(["Blues", "Rock"])
    /*
     * 🔴 SEM `formed_in`, de propósito — e é a banda do João justamente porque
     * ele é quem tem login real: é o único jeito de exercitar, pelo app, o
     * caminho de DECLARAR o ano (e de apagá-lo depois).
     *
     * Do lado do estabelecimento cobre o outro lado do par: a ausência do selo
     * de tempo de estrada, que é diferente de "zero anos". Semear as quatro
     * bandas com ano deixaria o ramo "não informado" da UI sem ninguém para
     * exercitá-lo — o padrão que o seed já registrou em `accepts_requests_
     * outside_repertoire` e em `email_verified_at`.
     */
    .withMembers([
      { musician_id: new Uuid(m1.musician_id.id), role: "leader", instrument: "Violão", status: "accepted", joined_at: daysFromNow(-20), responded_at: daysFromNow(-20) },
      { musician_id: new Uuid(m2.musician_id.id), role: "member", instrument: "Voz", status: "pending", joined_at: daysFromNow(-1), responded_at: null },
      { musician_id: new Uuid(musicians[2].musician_id.id), role: "member", instrument: "Teclado", status: "declined", joined_at: daysFromNow(-15), responded_at: daysFromNow(-14) },
    ])
    .build();
  await bandRepo.insert(bandJoao);

  /*
   * Bandas do elenco de busca (W3.1, soundmeet-web).
   *
   * As duas acima cobrem o tri-state de `open_to_gigs` e os estados de convite
   * — não mexer nelas. Estas duas existem só para a aba "Bandas" da busca ter
   * mais de um resultado e permitir exercitar filtro de gênero e de raio.
   *
   * ⚠️ `BandFilter` não tem `instruments` nem `is_verified`, e o `sort` aceita
   * apenas `name` e `created_at` — não há ordenação por nota porque banda NÃO
   * tem `rating` (nem existe `POST /bands/:id/ratings`). Por isso não há
   * projeção de nota aqui, ao contrário dos músicos.
   */
  const bandsBusca = [
    {
      name: "Elétrica Coletivo",
      description: "Banda de rock e pop para casas noturnas",
      genres: ["Rock", "Pop"],
      formed_in: 2018,
      // 🔴 A ÚNICA banda com faixa de preço, e a outra fica sem de propósito.
      // Nenhuma tinha: o filtro de preço da aba Bandas era intestável pelo
      // painel, e foi por isso que dois defeitos passaram — o filtro não
      // filtrava (query string é texto) e uma banda com preço gravado nunca
      // mais carregava (Decimal do Postgres no mapper).
      price: { model: "per_event" as const, min: 800, max: 1500, notes: "Som incluso" },
      // ~3 km do Bar do Zé — entra em raio curto.
      location: new Location({
        city: "São Paulo", state: "SP",
        latitude: -23.5475, longitude: -46.6361,
        street: "Rua Barão de Itapetininga", number: "255",
        complement: null, neighborhood: "República", zip_code: "01042001",
      }),
      members: [
        { musician_id: new Uuid(musicians[3]!.musician_id.id), role: "leader" as const, instrument: "Percussão", status: "accepted" as const, joined_at: daysFromNow(-120), responded_at: daysFromNow(-120) },
        { musician_id: new Uuid(musicians[4]!.musician_id.id), role: "member" as const, instrument: "Saxofone", status: "accepted" as const, joined_at: daysFromNow(-100), responded_at: daysFromNow(-100) },
      ],
    },
    {
      name: "Raízes do Sul",
      description: "Sertanejo raiz e viola caipira",
      genres: ["Sertanejo", "Forró"],
      // Formada este ano: o extremo oposto do Carlão Trio, e o valor que
      // prova na tela que "1 ano" não sai escrito como "1 anos".
      formed_in: new Date().getFullYear(),
      price: null,
      // Guarulhos — fora de um raio de 10 km, dentro de 50 km. Espelha a
      // Beatriz, para o filtro de raio dar o mesmo resultado nas duas abas.
      location: new Location({
        city: "Guarulhos", state: "SP",
        latitude: -23.4538, longitude: -46.5333,
        street: "Avenida Paulo Faccini", number: "1000",
        complement: null, neighborhood: "Macedo", zip_code: "07010000",
      }),
      members: [
        { musician_id: new Uuid(musicians[5]!.musician_id.id), role: "leader" as const, instrument: "Violão", status: "accepted" as const, joined_at: daysFromNow(-45), responded_at: daysFromNow(-45) },
      ],
    },
  ];

  const seededBands: Band[] = [band, bandJoao];
  for (const spec of bandsBusca) {
    const searchBand = Band.fake().aBand()
      .withName(spec.name)
      .withDescription(spec.description)
      .withGenres(spec.genres)
      .withFormedIn(spec.formed_in)
      .withMembers(spec.members)
      .withOpenToGigs(true)
      .withAddress(spec.location)
      .build();
    if (spec.price) searchBand.changePriceRange(new PriceRange(spec.price));
    await bandRepo.insert(searchBand);
    seededBands.push(searchBand);
  }

  // Vínculo conta ↔ banda. O CreateBandUseCase escreve `band_ids` no Keycloak;
  // o seed insere pelo repositório, então precisa escrever por conta própria.
  //
  // O claim é ESCOPO, não autorização: quem pode alterar a banda é lido do
  // banco (líder atual). O que o claim faz é pôr os shows, os contratos e as
  // conversas DA BANDA nas listas do líder — e é exigido, junto com a
  // liderança, para confirmar um booking de banda.
  //
  // 🔴 De TODAS as bandas, não só da Blues Duo. Só o João tinha o claim, então
  // os outros líderes com login (Carlos, Ana, Bia) não enxergavam os shows da
  // própria banda — inclusive o booking confirmado da Carlão Trio.
  // `musician_id == sub`, então o id do líder já é o id do usuário no Keycloak.
  if (keycloakAdmin) {
    for (const seeded of seededBands) {
      const leaderSub = seeded.leader?.musician_id.id;
      if (!leaderSub) continue;
      try {
        await addKeycloakClaimValue(
          keycloakAdmin,
          leaderSub,
          "band_ids",
          seeded.band_id.id,
        );
        console.log(`   🔗 claim band_ids do líder vinculado à ${seeded.name}.`);
      } catch (error) {
        console.warn(
          `   ⚠️ Falha ao vincular band_ids do líder da ${seeded.name} (${(error as Error).message}). ` +
            "Os shows e contratos dessa banda não vão aparecer para o líder até isso ser corrigido.",
        );
      }
    }
  }

  // ── 17b. Agenda e shows das bandas ────────────────────────────────────────
  //
  // Depois das bandas por causa da FK `bookings.bandId -> bands.id`.
  console.log("🥁 Agenda e shows das bandas…");

  // Agenda da Blues Duo — a tela "Disponibilidade da banda" do líder abria
  // vazia: `band_calendar_settings`/`band_availability_rules`/`band_unavailability`
  // não tinham uma linha sequer. A agenda da banda é independente da dos
  // membros (a proposta de banda não consulta a agenda de ninguém).
  await availabilityRepo.insert(
    Availability.fake()
      .aAvailability()
      .withMusicianId(null)
      .withBandId(new Uuid(bandJoao.band_id.id))
      .withTimezone("America/Sao_Paulo")
      .withDefaultBufferMinutes(45)
      .withMaxShowsPerDay(1)
      .withWeeklyRules([
        { weekday: 4, start_time: "19:00", end_time: "23:59" }, // quintas
        { weekday: 5, start_time: "19:00", end_time: "23:59" }, // sextas
      ])
      .withUnavailabilities([
        { start_at: daysFromNow(12, 0), end_at: daysFromNow(13, 23), reason: "Gravação do EP" },
      ])
      .build(),
  );

  // pending de BANDA — só o LÍDER (João) confirma; claim `band_ids` não basta.
  // Numa SEXTA, dentro da agenda da banda acima.
  const bandPendingStart = nextWeekday(20, 5, 20);
  const bookingBandPending = seedBooking({
    est: e1, band: bandJoao,
    start: bandPendingStart, end: plusHours(bandPendingStart, 3), fee: 1500,
    proposed_by: "establishment", created_at: hoursFromNow(-6), expires_at: daysFromNow(6),
  });

  // confirmed de BANDA, com evento e contrato (seção 21). O contratado é o
  // líder pessoa física (Carlos, CPF), com os integrantes NOMEADOS no objeto.
  const bookingBandConfirmed = seedBooking({
    est: establishments[3], band, event: evSavassi,
    start: evSavassi.start_at, end: new Date(evSavassi.start_at.getTime() + 2.5 * 3600_000), fee: 2000,
    proposed_by: "establishment", created_at: daysFromNow(-4), expires_at: daysFromNow(-2),
  });
  bookingBandConfirmed.confirm(daysFromNow(-3));

  for (const booking of [bookingBandPending, bookingBandConfirmed]) {
    assertValid("Booking de banda", booking);
    await bookingRepo.insert(booking);
  }

  // Line-up com BANDA (e não músico): `band_id` preenchido, `musician_id` nulo.
  await eventMusicianRepo.insert(
    EventMusician.fake().aEventMusician()
      .withEventId(new Uuid(evSavassi.event_id.id))
      .withMusicianId(null)
      .withBandId(new Uuid(band.band_id.id))
      .withStatus("confirmed")
      .withFee(2000)
      .build(),
  );

  // ── 18. Cifras pessoais (Bloco 8) — overlay de edições, nunca cópia ────────
  //
  // João é FREE (máx. 3 forks): o seed deixa 2, então dá pra criar mais 1 no
  // app e a tentativa seguinte cai no paywall — os dois lados do gate testáveis
  // sem mexer no banco.
  console.log("🎼 Cifras pessoais…");

  // Fingerprint SEMPRE do timeline pós-buildChords, pelo mesmo use-case da app.
  const fingerprintOf = async (musician: Musician, item: MusicLibrary) => {
    const base = await getChordSheet.execute({
      musician_id: musician.musician_id.id,
      music_library_id: item.music_library_id.id,
    });
    return {
      timeline: base.chords?.timeline ?? [],
      fingerprint: computeChordSheetBaseFingerprint(base.chords?.timeline ?? []),
    };
  };

  // 1) Wonderwall — privada, com edições, e ancorada numa análise ANTIGA
  //    (fingerprint de um timeline sem o primeiro acorde) + reconcile_status
  //    "base_updated". É o cenário que acende o ReconcileBadge e abre a
  //    ConflictsReviewSheet: "você editou, a IA re-analisou, revise".
  const wonderwall = libraryOf(m1, "Wonderwall");
  const wonderwallBase = await fingerprintOf(m1, wonderwall);
  const wonderwallSheet = PersonalChordSheet.create({
    musician_id: m1.musician_id.id,
    music_library_id: wonderwall.music_library_id.id,
    base_fingerprint: computeChordSheetBaseFingerprint(
      wonderwallBase.timeline.slice(1),
    ),
    base_pipeline_version: CHORD_SHEET_FINGERPRINT_VERSION,
  });
  // Âncoras derivadas do timeline real — cravar ms na mão faria a edição
  // "não casar" com nenhum acorde e nascer conflitada por engano.
  if (wonderwallBase.timeline.length >= 4) {
    const target = wonderwallBase.timeline[2];
    wonderwallSheet.addEdits([
      ChordEdit.replaceChord({
        at_ms: target.startMs,
        from: target.symbol,
        to: "E/G#",
      }),
      ChordEdit.annotate({
        at_ms: wonderwallBase.timeline[0].startMs,
        text: "Entrar só com o violão, banda entra no refrão.",
      }),
    ]);
  }
  wonderwallSheet.changeView(
    ChordSheetViewSettings.create({
      capo_fret: 2,
      transpose_semitones: -1,
      chord_complexity: "simple",
      instrument: "guitar",
      scroll_speed: 1.25,
    }),
  );
  wonderwallSheet.changeNotes("Tom mais confortável com capotraste na 2ª casa.");
  wonderwallSheet.markBaseUpdated();
  await personalChordSheetRepo.insert(wonderwallSheet);

  // 2) Evidências — compartilhada na comunidade pelo próprio João: alimenta a
  //    aba "minhas cifras compartilhadas" e a listagem pública.
  const evidencias = libraryOf(m1, "Evidências");
  const evidenciasBase = await fingerprintOf(m1, evidencias);
  const evidenciasSheet = PersonalChordSheet.create({
    musician_id: m1.musician_id.id,
    music_library_id: evidencias.music_library_id.id,
    base_fingerprint: evidenciasBase.fingerprint,
    base_pipeline_version: CHORD_SHEET_FINGERPRINT_VERSION,
  });
  if (evidenciasBase.timeline.length >= 2) {
    evidenciasSheet.addEdit(
      ChordEdit.relabelSection({
        section_start_ms: evidenciasBase.timeline[0].startMs,
        label: "Intro (só voz)",
      }),
    );
  }
  evidenciasSheet.changeNotes("Versão que eu toco no Bar do Zé.");
  evidenciasSheet.share("community");
  await personalChordSheetRepo.insert(evidenciasSheet);

  // 3) Garota de Ipanema do CARLOS, compartilhada na comunidade. O João tem a
  //    própria linha da mesma música, com um acorde diferente na análise — é o
  //    fork que ele importa pra ver `base_differs` e conflito de verdade.
  const ipanemaCarlos = libraryOf(musicians[2], "Garota de Ipanema");
  const ipanemaBase = await fingerprintOf(musicians[2], ipanemaCarlos);
  const ipanemaSheet = PersonalChordSheet.create({
    musician_id: musicians[2].musician_id.id,
    music_library_id: ipanemaCarlos.music_library_id.id,
    base_fingerprint: ipanemaBase.fingerprint,
    base_pipeline_version: CHORD_SHEET_FINGERPRINT_VERSION,
  });
  if (ipanemaBase.timeline.length >= 3) {
    ipanemaSheet.addEdits([
      ChordEdit.replaceChord({
        at_ms: ipanemaBase.timeline[1].startMs,
        from: ipanemaBase.timeline[1].symbol,
        to: "G7(13)",
      }),
      ChordEdit.annotate({
        at_ms: ipanemaBase.timeline[2].startMs,
        text: "Aqui eu faço a substituição do Jobim.",
      }),
    ]);
  }
  ipanemaSheet.changeNotes("Harmonia de bossa mais próxima do original.");
  ipanemaSheet.share("community");
  await personalChordSheetRepo.insert(ipanemaSheet);

  // 4) Fly Me to the Moon do Carlos, compartilhada só com a BANDA — o terceiro
  //    escopo, que faltava. O João lê porque é membro `accepted` da Carlão Trio;
  //    a Maria (convite `pending` na Blues Duo, sem vínculo com o Carlos) não.
  //    As `notes` continuam redigidas para o João: não é o dono.
  const flyCarlos = libraryOf(musicians[2], "Fly Me to the Moon");
  const flyBase = await fingerprintOf(musicians[2], flyCarlos);
  const flySheet = PersonalChordSheet.create({
    musician_id: musicians[2].musician_id.id,
    music_library_id: flyCarlos.music_library_id.id,
    base_fingerprint: flyBase.fingerprint,
    base_pipeline_version: CHORD_SHEET_FINGERPRINT_VERSION,
  });
  if (flyBase.timeline.length >= 2) {
    flySheet.addEdit(
      ChordEdit.annotate({
        at_ms: flyBase.timeline[1].startMs,
        text: "Guitarra entra aqui com a levada de swing.",
      }),
    );
  }
  flySheet.changeNotes("Tom do ensaio de quinta — não mudar sem avisar a banda.");
  flySheet.share("band");
  await personalChordSheetRepo.insert(flySheet);

  // ── 19. Apresentações ao vivo (Bloco 11) ──────────────────────────────────
  //
  // 🔴 Esta seção destrava QUATRO features de uma vez: currículo verificado
  // (F4), setlist inteligente por local (F5), relatório pós-show (F6) e o
  // "tocando agora" do fã. Todas leem `performances`/`performed_songs`, e o
  // seed não escrevia nenhuma linha nessas tabelas até 22/ago — as quatro
  // telas abriam vazias e pareciam quebradas.
  console.log("🎤 Apresentações ao vivo…");
  const performanceRepo = new PerformancePrismaRepository(prisma);

  // (a) Show ENCERRADO do João no Restaurante Maresia, 7 dias atrás.
  // É a fonte do currículo, do histórico e do relatório pós-show — inclusive do
  // card compartilhável, que só aparece quando `songs_count > 0`.
  const pastStart = new Date(evCompleted.start_at.getTime());
  const pastSet = Performance.create({
    event_id: evCompleted.event_id.id,
    establishment_id: e2.establishment_id.id,
    musician_id: m1.musician_id.id,
    // Setlist programada: é o que faz o relatório dizer "tocou X de Y".
    repertoire_id: repertoireM1.repertoire_id.id,
    started_at: pastStart,
  });
  const pastSongs: { title: string; artist: string; libraryTitle?: string }[] = [
    { title: "Evidências", artist: "Chitãozinho & Xororó", libraryTitle: "Evidências" },
    { title: "Wonderwall", artist: "Oasis", libraryTitle: "Wonderwall" },
    { title: "Garota de Ipanema", artist: "Tom Jobim", libraryTitle: "Garota de Ipanema" },
    { title: "Tempo Perdido", artist: "Legião Urbana", libraryTitle: "Tempo Perdido" },
    // Fora da biblioteca de propósito: `music_library_id` nulo é o caso real de
    // "toquei algo que não está cadastrado", e o relatório precisa aguentá-lo.
    { title: "Sultans of Swing", artist: "Dire Straits" },
    // Bis: mesma música duas vezes no mesmo set. `unique_songs_count` tem que
    // contar uma; `songs_count`, duas.
    { title: "Evidências", artist: "Chitãozinho & Xororó", libraryTitle: "Evidências" },
  ];
  pastSongs.forEach((song, index) => {
    const libraryItem = song.libraryTitle
      ? libraryItems.find(
          (i) =>
            i.musician_id.id === m1.musician_id.id && i.title === song.libraryTitle,
        )
      : undefined;
    pastSet.startSong({
      title: song.title,
      artist: song.artist,
      music_library_id: libraryItem?.entity_id.id ?? null,
      started_at: new Date(pastStart.getTime() + index * 12 * 60 * 1000),
    });
  });
  pastSet.endPerformance(new Date(pastStart.getTime() + 3 * 60 * 60 * 1000));
  await performanceRepo.insert(pastSet);

  // (b) Show ENCERRADO da Maria no mesmo local — dá ao setlist inteligente mais
  // de um artista por casa, que é o que separa "meu histórico" de "o que
  // funciona NESTE lugar".
  const mariaSet = Performance.create({
    event_id: evCompleted.event_id.id,
    establishment_id: e2.establishment_id.id,
    musician_id: m2.musician_id.id,
    started_at: new Date(pastStart.getTime() + 30 * 60 * 1000),
  });
  ["Águas de Março", "Chega de Saudade", "Garota de Ipanema"].forEach((title, i) => {
    mariaSet.startSong({
      title,
      artist: "Tom Jobim",
      started_at: new Date(pastStart.getTime() + (30 + i * 10) * 60 * 1000),
    });
  });
  mariaSet.endPerformance(new Date(pastStart.getTime() + 2 * 60 * 60 * 1000));
  await performanceRepo.insert(mariaSet);

  // (c) Set AO VIVO do João no Sarau de hoje — é o que faz o fã ver "tocando
  // agora" no perfil público, com o botão de salvar no Spotify.
  //
  // ⚠️ Um set `live` por (evento, músico): existe índice parcial único
  // (`performances_one_live_per_event_musician`). Dois aqui derrubariam o seed.
  const liveSet = Performance.create({
    event_id: evActive.event_id.id,
    establishment_id: e1.establishment_id.id,
    musician_id: m1.musician_id.id,
    // Com setlist: sem ela, a "fila do palco" do app só teria pedidos, e o ramo
    // da setlist programada ficaria intestável pelo app.
    repertoire_id: repertoireM1.repertoire_id.id,
    started_at: new Date(Date.now() - 45 * 60 * 1000),
  });
  const liveSongs = [
    { title: "Wonderwall", artist: "Oasis" },
    { title: "Garota de Ipanema", artist: "Tom Jobim" },
    { title: "Evidências", artist: "Chitãozinho & Xororó" },
  ];
  liveSongs.forEach((song, i) => {
    const libraryItem = libraryItems.find(
      (l) => l.musician_id.id === m1.musician_id.id && l.title === song.title,
    );
    liveSet.startSong({
      title: song.title,
      artist: song.artist,
      music_library_id: libraryItem?.entity_id.id ?? null,
      started_at: new Date(Date.now() - (40 - i * 15) * 60 * 1000),
    });
  });
  // NÃO encerrar: a última música fica com `ended_at` nulo e `is_playing` true.
  await performanceRepo.insert(liveSet);

  // (d) Set AO VIVO da Ana na Lapa — o segundo palco aceso da Home do fã.
  // Músicas fora da biblioteca de propósito: é o caso comum de quem ainda não
  // cadastrou o repertório, e o cartão precisa mostrar o título mesmo assim.
  const lapaSet = Performance.create({
    event_id: evLapaLive.event_id.id,
    establishment_id: establishments[2].establishment_id.id,
    musician_id: musicians[3].musician_id.id,
    started_at: new Date(Date.now() - 80 * 60 * 1000),
  });
  [
    { title: "O Show Tem Que Continuar", artist: "Fundo de Quintal" },
    { title: "Deixa a Vida Me Levar", artist: "Zeca Pagodinho" },
    { title: "Trem das Onze", artist: "Adoniran Barbosa" },
  ].forEach((song, i) => {
    lapaSet.startSong({
      ...song,
      started_at: new Date(Date.now() - (75 - i * 30) * 60 * 1000),
    });
  });
  await performanceRepo.insert(lapaSet);

  // ── 19b. A turnê do Carlos — o master do Analytics (30/set/2026) ─────────
  //
  // 🔴 O Analytics do app (`GET /musicians/:id/analytics/nights`) era
  // intestável: uma noite encerrada no seed inteiro (Maria), e o João é FREE
  // (402). O Carlos (musico3, PRO) ganha ~6 meses de noites com set aberto,
  // gravadas pelos AGREGADOS — evento encerrado, escalação, set com músicas,
  // pedidos (tocados/recusados/aceitos), gorjetas confirmadas e presenças. O
  // master, o relatório de cada noite, a setlist riscada e a parada de pedidos
  // leem a mesma coisa. Roteiro determinístico em `seed-night-series.ts`.
  //
  // A plateia é SINTÉTICA e sem login (`plateiaNN@…`): as presenças precisam de
  // gente distinta para "pessoas alcançadas" ≠ "presenças". Pontos zerados e
  // sem `UserPoints` — não entram no ranking dos fãs de verdade.
  console.log("🎹 Turnê do Carlos (Analytics)…");
  const carlos = musicians[2];
  const crowd: Audience[] = [];
  for (let i = 0; i < CROWD_POOL; i++) {
    const fan = Audience.fake().aAudience()
      .withName(`${CROWD_NAMES[i % CROWD_NAMES.length]} ${CROWD_SURNAMES[Math.floor(i / CROWD_NAMES.length) % CROWD_SURNAMES.length]}`)
      .withEmail(`plateia${String(i + 1).padStart(2, "0")}@seed-soundmeet.com`)
      .withNickname(`plateia${i + 1}`)
      .withFavoriteGenres(["Jazz", "MPB"])
      .withTotalPoints(0).withCurrentLevel(1).withBadges([])
      .withTotalScans(0).withTotalRequests(0).withTotalTips(0).withTotalSocialShares(0)
      .build();
    await audienceRepo.insert(fan);
    crowd.push(fan);
  }

  const carlosSongs = libraryItems.filter((i) => i.musician_id.id === carlos.musician_id.id);
  const tour = buildCarlosTour(carlosSongs.length, new Date());
  const tourNames = ["Piano Bar", "Standards ao Vivo", "Bossa & Piano", "Noite de Jazz"];
  const tourVenues = [e1, e2, establishments[2], establishments[3]];
  const minute = 60_000;
  for (const [index, night] of tour.entries()) {
    const start = daysFromNow(-night.daysAgo, night.hour);
    const showMinutes = night.songs.length * 12 + 10;
    const venue = tourVenues[night.venue];
    const event = Event.fake().anEvent()
      .withEstablishmentId(venue.establishment_id)
      .withName(`${tourNames[index % tourNames.length]} com Carlão`)
      .withStartAt(start)
      .withEndAt(new Date(start.getTime() + 4 * 60 * minute))
      .withStatus("completed")
      .withCurrentCapacity(night.crowd)
      .withCoverCharge(null)
      .build();
    await eventRepo.insert(event);
    await eventMusicianRepo.insert(
      EventMusician.fake().aEventMusician()
        .withEventId(new Uuid(event.event_id.id))
        .withMusicianId(new Uuid(carlos.musician_id.id))
        .withBandId(null)
        .withStatus("confirmed")
        .withFee(700)
        .build(),
    );

    // Pedidos ANTES do set: o pedido tocado entra no set com o `request_id`,
    // que é o que acende "PEDIDO" na setlist riscada do relatório.
    const playedRequestBySong = new Map<number, string>();
    for (const [r, spec] of night.requests.entries()) {
      const song = carlosSongs[spec.song];
      const request = Request.create({
        event_id: event.event_id.id,
        audience_id: crowd[spec.fan].audience_id.id,
        musician_id: carlos.musician_id.id,
        library_id: song.music_library_id.id,
        song_title: song.title,
        artist: song.artist,
      });
      const at = new Date(start.getTime() + (5 + r * 7) * minute);
      (request as unknown as { created_at: Date }).created_at = at;
      if (spec.outcome === "rejected") request.reject("Fora da proposta da noite");
      else request.accept();
      if (spec.outcome === "played") {
        request.markAsPlayed(new Date(at.getTime() + 20 * minute));
        if (!playedRequestBySong.has(spec.song)) playedRequestBySong.set(spec.song, request.request_id.id);
      }
      await requestRepo.insert(request);
    }

    const set = Performance.create({
      event_id: event.event_id.id,
      establishment_id: venue.establishment_id.id,
      musician_id: carlos.musician_id.id,
      repertoire_id: night.withSetlist ? repertoireM3.repertoire_id.id : null,
      started_at: new Date(start.getTime() + 10 * minute),
    });
    for (const [position, songIndex] of night.songs.entries()) {
      const song = songIndex === null ? null : carlosSongs[songIndex];
      const requestId = songIndex === null ? undefined : playedRequestBySong.get(songIndex);
      if (requestId) playedRequestBySong.delete(songIndex!);
      set.startSong({
        title: song?.title ?? "Canja: Samba de Uma Nota Só",
        artist: song?.artist ?? "Tom Jobim",
        music_library_id: song?.music_library_id.id ?? null,
        request_id: requestId ?? null,
        started_at: new Date(start.getTime() + (10 + position * 12) * minute),
      });
    }
    set.endPerformance(new Date(start.getTime() + (10 + showMinutes) * minute));
    await performanceRepo.insert(set);

    for (const spec of night.tips) {
      const tip = Tip.fake().aTip()
        .withAudienceId(new Uuid(crowd[spec.fan].audience_id.id))
        .withMusicianId(new Uuid(carlos.musician_id.id))
        .withEventId(new Uuid(event.event_id.id))
        .withAmount(new Money(spec.amount))
        .withCreatedAt(new Date(start.getTime() + (10 + spec.minute) * minute))
        .build();
      tip.complete(`seed-tour-${tip.tip_id.id.slice(0, 8)}`);
      await tipRepo.insert(tip);
    }

    for (let a = 0; a < night.crowd; a++) {
      const fan = crowd[(night.crowdStart + a) % CROWD_POOL];
      await eventAttendeeRepo.insert(
        EventAttendee.fake().anEventAttendee()
          .withEventId(new Uuid(event.event_id.id))
          .withAudienceId(new Uuid(fan.audience_id.id))
          .withJoinedAt(new Date(start.getTime() + (15 + (a % 40)) * minute))
          .withLeftAt(new Date(start.getTime() + (10 + showMinutes) * minute))
          .withIsActive(false)
          .build(),
      );
    }
  }
  console.log(`   ${tour.length} noites · ${CROWD_POOL} pessoas na plateia sintética · login musico3@seed-soundmeet.com`);

  // ── 20. Avaliações (Bloco 9.3) — os dois sentidos ─────────────────────────
  //
  // Até aqui o seed escrevia só a PROJEÇÃO de nota (`syncRatingProjection`), sem
  // uma linha em `reviews`. Consequência registrada na seção 1: a primeira
  // avaliação real recalculava a média a partir de um ledger vazio e apagava a
  // nota do seed. Com o ledger semeado, a média passa a ter lastro.
  console.log("⭐ Avaliações…");
  const reviewRepo = new ReviewPrismaRepository(prisma);
  const seedReviews = [
    // Estabelecimento avalia o músico (web W3.7)
    Review.create({
      target_type: "musician", target_id: m1.musician_id.id,
      author_type: "establishment", author_id: e2.establishment_id.id,
      rating: 5, comment: "Casa cheia e público cantando junto. Volta sempre.",
      // 🔴 `context_id` de um contexto "booking" é id de BOOKING, não de evento
      // — é por ele que `ReviewEligibilityService` prova que as duas partes
      // realmente fecharam um show concluído.
      context_type: "booking", context_id: bookingCompletedJoao.entity_id.id,
    }),
    // Músico avalia o estabelecimento (mobile, 10B.2)
    Review.create({
      target_type: "establishment", target_id: e2.establishment_id.id,
      author_type: "musician", author_id: m1.musician_id.id,
      rating: 4, comment: "Som bom e cachê pago no dia. Retorno de palco fraco.",
      context_type: "booking", context_id: bookingCompletedJoao.entity_id.id,
    }),
    // Fã avalia o músico — sem comentário, para exercitar `has_comment: false`
    Review.create({
      target_type: "musician", target_id: m1.musician_id.id,
      author_type: "audience", author_id: fan1.audience_id.id,
      rating: 5,
      context_type: "event", context_id: evCompleted.event_id.id,
    }),
  ];
  for (const review of seedReviews) {
    await reviewRepo.insert(review);
  }

  /*
   * ── 20a. Ledger que sustenta a nota exibida ──────────────────────────────
   *
   * 🔴 DOIS defeitos de seed que este bloco fecha, e os dois eram invisíveis:
   *
   * 1. **Projeção sem lastro.** Ana, Rafa, Bia e Helena recebiam a nota por
   *    `syncRatingProjection` na seção 1, com ZERO linhas em `reviews`. O
   *    comentário de lá já avisava que a primeira avaliação real apagaria o
   *    número — a projeção é recalculada sobre o ledger inteiro. Ou seja: a
   *    nota do seed era uma afirmação que o banco não sustentava.
   * 2. **João tinha o inverso.** Ele ganhou duas avaliações de verdade no
   *    bloco acima (casa 5 + fã 5) e continuava com `rating = 0`, porque
   *    `reviewRepo.insert` NÃO recalcula projeção — só o `SubmitReviewUseCase`
   *    faz. O cartão dele dizia "Sem avaliações" enquanto
   *    `GET /musicians/:id/ratings` devolvia duas.
   *
   * A correção é a mesma para os dois: semear o LEDGER e derivar a projeção
   * dele, na mesma ordem que o use-case real usa. Depois deste bloco, nota
   * exibida e avaliações listadas contam a mesma história.
   *
   * ⚠️ As notas foram escolhidas para que a média CONTINUE caindo nos valores
   * já documentados (4.8 / 4.2 / 3.6 / 5.0) — o número do seed segue sendo
   * reconhecível, agora com lastro.
   *
   * ⚠️ E cada músico recebe avaliação de PÚBLICO **e** de ESTABELECIMENTO, de
   * propósito: é o que dá dado a `GET /musicians/:id/ratings/summary` (a
   * quebra por tipo de autor). Semear só um dos lados deixaria metade da tela
   * sem nada para mostrar — o padrão "o que o seed não escreve vira feature
   * intestável, em silêncio".
   *
   * ⚠️ `author_id` e `context_id` aqui são UUIDs sintéticos: nenhuma das duas
   * colunas tem FK, e a prova de vínculo (`ReviewEligibilityService`) só roda
   * na ESCRITA por HTTP. São avaliações históricas de gente que não precisa
   * existir como linha — o que não vale para as três acima, que referenciam
   * booking e evento reais de propósito.
   */
  const ratingLedgerSpecs = [
    // Ana Batuque — 4.8 (27): a melhor avaliada da busca, e FREE.
    { musician: musicians[3], establishment: [5, 5, 5, 5, 4, 5], audience: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 4, 4, 4, 4] },
    // Rafa Sax — 4.2 (11): PRO, e é o contraste que interessa na faixa
    // "Em destaque" (aparece destacado com nota MENOR que a da Ana).
    { musician: musicians[4], establishment: [5, 4, 4, 3], audience: [5, 5, 4, 4, 4, 4, 4] },
    // Bia Viola — 3.6 (5): o caso do print, e o que mais precisa da quebra —
    // 3,5 do público contra 3,5 das casas conta uma história diferente de
    // "3,6 de todo mundo".
    { musician: musicians[5], establishment: [4, 3], audience: [5, 4, 2] },
    // Helena Cordas — 5.0 (3): nota cheia com amostra pequena. É o caso que
    // justifica a quebra vir SEMPRE com o total ao lado.
    { musician: musicians[7], establishment: [5], audience: [5, 5] },
  ];

  for (const spec of ratingLedgerSpecs) {
    const targetId = spec.musician.musician_id.id;
    const rows = [
      ...spec.establishment.map((rating) => ({ rating, author_type: "establishment" as const, context_type: "booking" as const })),
      ...spec.audience.map((rating) => ({ rating, author_type: "audience" as const, context_type: "event" as const })),
    ];
    for (const row of rows) {
      await reviewRepo.insert(
        Review.create({
          target_type: "musician", target_id: targetId,
          author_type: row.author_type, author_id: new Uuid().id,
          rating: row.rating,
          context_type: row.context_type, context_id: new Uuid().id,
        }),
      );
    }
  }

  /*
   * Projeção derivada do ledger — a MESMA ordem do `SubmitReviewUseCase`:
   * agrega no banco, grava na projeção. Escrever a média à mão aqui
   * reintroduziria a divergência que este bloco existe para fechar.
   *
   * 🔴 RECARREGA o agregado antes de gravar — é o que o use-case real também
   * faz (`findById` → `syncRatingProjection` → `update`). As instâncias do
   * array `musicians` são de ANTES dos uploads de áudio e foto: os use-cases
   * de upload carregam uma cópia própria pelo repositório e salvam nela, então
   * o objeto do array continua com `avatar`/`presentation_audio` nulos. Gravar
   * aquela instância zerava a mídia de todo músico COM avaliação (João, Rafa,
   * Bia perdiam a foto; João e Rafa, o áudio), sem erro nenhum — e a grade de
   * `/dashboard/artistas` não mostrava foto nenhuma, porque os únicos que
   * sobravam com avatar (Maria e Carlão) não aparecem nela. Achado em
   * 18/set/2026 comparando o banco com a lista de fotos do bloco 1c.
   */
  for (const seeded of musicians) {
    const { average, total } = await reviewRepo.aggregateForTarget({
      target_type: "musician",
      target_id: seeded.musician_id.id,
    });
    if (total === 0) continue;
    const musician = await musicianRepo.findById(seeded.musician_id);
    if (!musician) continue;
    musician.syncRatingProjection(average, total);
    await musicianRepo.update(musician);
  }

  // O estabelecimento avaliado pelo músico também precisa da projeção — sem
  // isto a nota do Maresia fica 0 com uma avaliação no ledger, que é o mesmo
  // defeito do João, do outro lado.
  {
    const { average, total } = await reviewRepo.aggregateForTarget({
      target_type: "establishment",
      target_id: e2.establishment_id.id,
    });
    if (total > 0) {
      // Recarregado, não o `e2` do array: mesma armadilha do laço de músico
      // acima. Hoje nada escreve no Maresia entre a criação e aqui (capa fica
      // NULL nos quatro), mas o `update` grava o modelo INTEIRO — a primeira
      // capa semeada por use-case seria apagada em silêncio.
      const establishment = await establishmentRepo.findById(e2.establishment_id);
      if (establishment) {
        establishment.syncRatingProjection(average, total);
        await establishmentRepo.update(establishment);
      }
    }
  }

  // ── 20b. Indicações de talento (28/set/2026) — os três estados da caixa ───
  //
  // Antes desta tabela a indicação era DESCARTADA: `IndicateMusicianUseCase` só
  // dava pontos ao fã e emitia um evento que ninguém escutava. Sem linhas aqui,
  // a caixa de entrada do estabelecimento nasce vazia e não há o que exercitar
  // — mesmo motivo pelo qual o seed passou a criar carteira com Mercado Pago
  // vinculado (o critério de restore que "não pôde ser exercido" não é o mesmo
  // que passou).
  console.log("🤝 Indicações…");
  const indicationRepo = new IndicationPrismaRepository(prisma);
  const seenIndication = Indication.create({
    audience_id: fan2.audience_id.id,
    musician_id: m2.musician_id.id,
    establishment_id: e2.establishment_id.id,
    message: "Tocou aqui perto e lotou. Combina demais com a casa.",
  });
  seenIndication.markAsSeen();

  // Fã diferente do `seen` acima: a unique é (fã, músico, estabelecimento),
  // então o mesmo músico pode ser indicado por várias pessoas para a mesma casa
  // — é exatamente o sinal que a caixa de entrada existe para mostrar.
  const archivedIndication = Indication.create({
    audience_id: fan1.audience_id.id,
    musician_id: m2.musician_id.id,
    establishment_id: e2.establishment_id.id,
  });
  archivedIndication.archive();

  // Bar do Zé (`bar1@`) — a conta de estabelecimento usada por padrão no web.
  // Só o Maresia tinha linhas, e quem entrava como bar1 via a caixa vazia.
  // Artistas que NÃO tocam no Zé (o João, a Ana, o DJ Diego e o Rafa — este
  // com show contestado por não comparecer — já têm booking lá). O Carlão com
  // DUAS vozes NOVAS é o caso que o Maresia não cobre: lá as duas vozes da
  // Maria Bossa já foram vista/arquivada, então nada de "mais pedido" com recado
  // novo no letreiro. Cada linha tem o lançamento INDICATION casado no ledger
  // (seção 12) — indicação sem os 15 pontos seria dado que o app nunca produz.
  const barSeenIndication = Indication.create({
    audience_id: fan2.audience_id.id,
    musician_id: musicians[5].musician_id.id,
    establishment_id: e1.establishment_id.id,
    message: "A Bia faz um forró que levanta até quem veio só pra beber.",
  });
  barSeenIndication.markAsSeen();

  const barArchivedIndication = Indication.create({
    audience_id: fan1.audience_id.id,
    musician_id: musicians[7].musician_id.id,
    establishment_id: e1.establishment_id.id,
  });
  barArchivedIndication.archive();

  for (const indication of [
    // `new` é o que alimenta o badge da caixa.
    Indication.create({
      audience_id: fan1.audience_id.id,
      musician_id: m1.musician_id.id,
      establishment_id: e2.establishment_id.id,
      message: "Melhor voz que ouvi esse ano, precisa tocar aí.",
    }),
    seenIndication,
    archivedIndication,
    Indication.create({
      audience_id: fan1.audience_id.id,
      musician_id: musicians[2].musician_id.id,
      establishment_id: e1.establishment_id.id,
      message: "O Carlão toca um blues no piano que parece de outro tempo. Ia encaixar demais nas noites do Zé.",
    }),
    Indication.create({
      audience_id: fan2.audience_id.id,
      musician_id: musicians[2].musician_id.id,
      establishment_id: e1.establishment_id.id,
      message: "Vi num sarau e fiquei até o fim. Traz ele pra cá!",
    }),
    barSeenIndication,
    barArchivedIndication,
  ]) {
    await indicationRepo.insert(indication);
  }

  // ── 21. Contratos digitais (Bloco 10) — emitidos pelo use-case real ──────
  //
  // 🔴 Emitidos pelo `IssueContractUseCase`, e não pelo `Contract.fake()`.
  // O fake carimba variáveis FIXAS — show em "12 de setembro de 2026", emitido
  // em "1 de agosto de 2026", partes "Bar do Zé Ltda."/"Ana Ribeiro", cachê
  // R$1.500 — em TODO contrato. Era a data que "vencia" no fim de semana: rodar
  // o seed de novo não mudava nada, porque não vinha de `daysFromNow`. E o
  // contrato nem batia com o próprio booking (que não tinha cachê nenhum).
  //
  // Pelo use-case, data, horário (no fuso da casa), partes, cachê, variante de
  // cláusula e hash saem do booking real — o mesmo caminho do
  // `ContractIssuanceHandler`. `clock` = data da confirmação, que é quando o
  // evento real dispararia a emissão.
  //
  // Os quatro status (`issued`, `partially_signed` nos DOIS sentidos, `signed`,
  // `annulled`), as variantes que dependem do cadastro (ficha técnica com Anexo
  // I, banda com integrantes nomeados, MEI como pessoa jurídica) e a pendência
  // de qualificação (show confirmado que NÃO gera contrato).
  console.log("📄 Contratos…");
  const contractRepo = new ContractPrismaRepository(prisma);
  const contractStorage = await createSeedContractStorage();
  const contractRenderer = new ReactPdfContractRenderer();
  const clauseCatalog = new ClauseCatalog();

  type ContractRole = "contractor" | "contracted";
  const contractsSpec: {
    label: string;
    booking: Booking;
    est: Establishment;
    // Quem assina pelo contratado: o músico, ou o LÍDER em show de banda.
    contractedSigner: Musician;
    expect: "issued" | "missing";
    sign?: { role: ContractRole; at: Date }[];
    annul?: { reason: string; at: Date };
  }[] = [
    { label: "Noite do Blues — João × Bar do Zé (Anexo I)", booking: bookingConfirmed, est: e1, contractedSigner: m1, expect: "issued" },
    { label: "Data extra — João × Bar do Zé", booking: bookingConfirmedLater, est: e1, contractedSigner: m1, expect: "issued" },
    {
      label: "Jazz na Savassi — Carlão Trio (líder assinou, falta a casa)",
      booking: bookingBandConfirmed, est: establishments[3], contractedSigner: musicians[2], expect: "issued",
      sign: [{ role: "contracted", at: daysFromNow(-2, 11) }],
    },
    {
      label: "Jantar com Bossa — João × Maresia (casa assinou, falta o João)",
      booking: bookingCompletedJoao, est: e2, contractedSigner: m1, expect: "issued",
      sign: [{ role: "contractor", at: daysFromNow(-11, 10) }],
    },
    {
      label: "Jantar com Bossa — Maria × Maresia (assinado)",
      booking: bookingCompleted, est: e2, contractedSigner: m2, expect: "issued",
      sign: [
        { role: "contractor", at: daysFromNow(-11, 10) },
        { role: "contracted", at: daysFromNow(-11, 18) },
      ],
    },
    {
      label: "Show contestado — Rafa Sax (MEI) × Bar do Zé (assinado)",
      booking: bookingDisputed, est: e1, contractedSigner: musicians[4], expect: "issued",
      sign: [
        { role: "contractor", at: daysFromNow(-12, 10) },
        { role: "contracted", at: daysFromNow(-12, 14) },
      ],
    },
    {
      label: "Show cancelado — Maria × Maresia (anulado)",
      booking: bookingCancelled, est: e2, contractedSigner: m2, expect: "issued",
      annul: { reason: "Show cancelado pelo estabelecimento antes das assinaturas (reforma na casa).", at: daysFromNow(-2, 12) },
    },
    { label: "Bia Viola × Maresia", booking: bookingPendingQualification, est: e2, contractedSigner: musicians[5], expect: "missing" },
  ];

  const contractSummary: string[] = [];
  for (const spec of contractsSpec) {
    const issuedAt = spec.booking.confirmed_at ?? now;
    const issueContract = new IssueContractUseCase({
      contractRepo,
      bookingRepo,
      establishmentRepo,
      musicianRepo,
      bandRepo,
      catalog: clauseCatalog,
      renderer: contractRenderer,
      storage: contractStorage.storage,
      // Mesmas envs e defaults do `contract.providers.ts`.
      issuer: {
        legal_name: loadEnvValue("CONTRACT_ISSUER_LEGAL_NAME", "SoundMeet"),
        document: loadEnvValue("CONTRACT_ISSUER_DOCUMENT", "00000000000000"),
      },
      verificationBaseUrl: loadEnvValue("CONTRACT_VERIFICATION_BASE_URL", "https://soundmeet.com.br/contrato"),
      escrow: {
        enabled: loadEnvValue("ESCROW_ENABLED", "false") === "true",
        custodian_legal_name: loadEnvValue("ESCROW_CUSTODIAN_LEGAL_NAME", ""),
      },
      clock: { now: () => issuedAt },
    });

    // `null` = caminho do sistema (o handler do evento), sem ator HTTP.
    const result = await issueContract.execute({
      booking_id: spec.booking.booking_id.id,
      requesting_participant_ids: null,
    });

    if (!result.issued) {
      if (spec.expect !== "missing") {
        throw new Error(`Contrato "${spec.label}" não foi emitido: faltou ${result.missing.join(", ")}`);
      }
      contractSummary.push(`${spec.label}: SEM contrato — pendência ${result.missing.join(", ")}`);
      continue;
    }
    if (spec.expect === "missing") {
      throw new Error(`Contrato "${spec.label}" deveria ficar pendente e foi emitido — a pendência de qualificação perdeu cobertura.`);
    }

    const contract = (await contractRepo.findCurrentByBookingId(spec.booking.booking_id.id))!;
    for (const signature of spec.sign ?? []) {
      contract.sign({
        role: signature.role,
        // `sub` de quem assinou: o estabelecimento assina pela conta que opera
        // a casa; o contratado, pela dele (o líder, em banda). Não é o id do
        // aggregate do estabelecimento — é o usuário autenticado.
        signer_user_id:
          signature.role === "contractor"
            ? (keycloakSubs.get(spec.est.email.value) ?? spec.est.establishment_id.id)
            : spec.contractedSigner.musician_id.id,
        signed_at: signature.at,
        ip: "203.0.113.10",
        ip_source: "direct",
        user_agent: "SoundMeetSeed/1.0",
      });
    }
    if (spec.annul) contract.annul(spec.annul.reason, spec.annul.at);
    assertValid(`Contrato "${spec.label}"`, contract);
    if (spec.sign?.length || spec.annul) await contractRepo.update(contract);
    contractSummary.push(`${spec.label}: ${contract.status} · código ${contract.verification_code}`);
  }

  // ── 22. Custódia do cachê (F1.3a) — os cinco estados, sem gateway ─────────
  //
  // 🔴 `held_balance` é ESPELHO do que está retido na subconta do músico na
  // instituição de pagamento, nunca fonte. O seed escreve os dois lados juntos
  // (custódia + carteira) porque é assim que o fluxo real deixa o sistema;
  // escrever só a custódia daria uma tela de carteira mentindo sobre o retido.
  //
  // Toda custódia é de booking CONFIRMADO: ela nasce no `BookingConfirmedEvent`.
  // O seed anterior pendurava uma custódia `pending` num booking PENDENTE —
  // estado que o domínio nunca produz (`booking_not_confirmed`).
  //
  // Comissão de 10% (`booking_fee_percentage`, igual nos três tiers).
  console.log("🔒 Custódia do cachê…");
  const escrowRepo = new BookingEscrowPrismaRepository(prisma);
  const walletOf = async (musician: Musician) => {
    const wallet = await walletRepo.findByMusicianId(musician.musician_id.id);
    if (!wallet) throw new Error(`Carteira não encontrada no seed (${musician.name})`);
    return wallet;
  };

  const escrowSpecs: {
    booking: Booking;
    musician: Musician;
    flow: "pending" | "held" | "released" | "refunded" | "disputed";
    // Liberação pelo job: D+5 do fim do show no FREE, D+2 nos pagos.
    releaseAfterDays?: number;
  }[] = [
    // Cobrança gerada, casa ainda não pagou.
    { booking: bookingConfirmedLater, musician: m1, flow: "pending" },
    // Pago e retido; show ainda vai acontecer — sem check-in, o job não libera.
    { booking: bookingConfirmed, musician: m1, flow: "held" },
    // Show feito, check-in registrado, prazo cumprido → liberado. É daqui que
    // sai o saldo SACÁVEL do João e da Maria.
    { booking: bookingCompletedJoao, musician: m1, flow: "released", releaseAfterDays: 5 },
    { booking: bookingCompleted, musician: m2, flow: "released", releaseAfterDays: 2 },
    // Show cancelado pela casa → devolvido. Nunca passa pelo saldo do músico.
    { booking: bookingCancelled, musician: m2, flow: "refunded" },
    // Contestado pela casa → congelado para mediação humana. O Rafael fica com
    // valor retido, o que também torna testável a recusa de `disableEscrow`.
    { booking: bookingDisputed, musician: musicians[4], flow: "disputed" },
  ];

  for (const [index, spec] of escrowSpecs.entries()) {
    const booking = spec.booking;
    const escrow = BookingEscrow.create({
      booking_id: booking.booking_id.id,
      musician_id: spec.musician.musician_id.id,
      amount: booking.fee!,
      platform_fee_percentage: 10,
    });
    const reference = `seed-asaas-escrow-${String(index + 1).padStart(3, "0")}`;
    const confirmedAt = booking.confirmed_at!;
    escrow.attachCharge({ external_id: reference, expires_at: null, at: plusHours(confirmedAt, 1) });

    const wallet = await walletOf(spec.musician);
    const net = escrow.net_amount.amount;

    if (spec.flow !== "pending") {
      escrow.markHeld({
        external_id: reference,
        // Garantia ativa por 30 dias após o fim do show (`null` = garantia
        // inativa, que o job trata como erro).
        expires_at: new Date(booking.end_at.getTime() + 30 * 24 * 3600_000),
        at: plusHours(confirmedAt, 20),
      });
      wallet.holdFunds(net);
    }
    if (spec.flow === "released") {
      escrow.release({ at: new Date(booking.end_at.getTime() + spec.releaseAfterDays! * 24 * 3600_000) });
      wallet.releaseHeldFunds(net);
    }
    if (spec.flow === "refunded") {
      escrow.refund({ reason: "Show cancelado pelo estabelecimento (reforma na casa).", at: booking.cancelled_at! });
      wallet.refundHeldFunds(net);
    }
    if (spec.flow === "disputed") {
      escrow.dispute({ reason: booking.dispute_reason!, at: booking.disputed_at! });
    }

    assertValid("Custódia", escrow);
    assertValid("Carteira", wallet);
    await escrowRepo.insert(escrow);
    await walletRepo.update(wallet);
  }

  // Saques do João DEPOIS da liberação — é dela que vem o saldo sacável.
  // Espelham as três transações de saque da seção 14:
  //   720 liberados − 60 (concluído) − 150 (pendente, já reservado) = R$510
  //   200 recusados pelo provedor: debitados e ESTORNADOS (saldo e total_withdrawn)
  const joaoWallet = await walletOf(m1);
  joaoWallet.withdrawFunds(60);
  joaoWallet.withdrawFunds(150);
  joaoWallet.withdrawFunds(200);
  joaoWallet.refundWithdrawal(200);
  assertValid("Carteira do João", joaoWallet);
  await walletRepo.update(joaoWallet);

  // ── 23. Jobs de IA (ai-cifra e ai-audio) em todos os estados ──────────────
  //
  // Sem estas linhas as telas de progresso do app nunca podiam ser vistas: só
  // dava para observar o estado final, e só rodando o worker de GPU de verdade.
  console.log("🤖 Jobs de IA…");
  const aiCifraUploadRepo = new AiCifraUploadPrismaRepository(prisma);
  const aiCifraJobRepo = new AiCifraAnalysisJobPrismaRepository(prisma);
  const aiAudioUploadRepo = new AiAudioUploadPrismaRepository(prisma);
  const aiAudioJobRepo = new AiAudioSeparationJobPrismaRepository(prisma);

  const tempoPerdido = libraryOf(m1, "Tempo Perdido");
  const cifraUpload = AiCifraUpload.create({
    musician_id: m1.musician_id.id,
    music_library_id: tempoPerdido.entity_id.id,
    original_filename: "tempo-perdido.mp3",
    content_type: "audio/mpeg",
    file_size: 5_242_880,
    object_key: `ai-cifra/${m1.musician_id.id}/seed-tempo-perdido/original.mp3`,
    upload_method: "direct",
  });
  // O upload acompanha o job: antes ficava `uploaded` com o job a 45%, par que
  // o worker nunca produz.
  cifraUpload.markAnalysisQueued();
  cifraUpload.markAnalyzing();
  await aiCifraUploadRepo.insert(cifraUpload);

  // Em ANDAMENTO de propósito: é o estado que a tela de análise mostra e que
  // ninguém conseguia ver sem subir o worker. Casa com "Tempo Perdido" estar
  // sem cifra na seção 15 — a música está sendo analisada agora.
  const cifraJob = AiCifraAnalysisJob.create({
    ai_cifra_upload_id: cifraUpload.entity_id.id,
    musician_id: m1.musician_id.id,
    model_id: "chordformer-v24",
  });
  cifraJob.start();
  cifraJob.updateProgress({ progress_percent: 45, progress_stage: "separating" });
  await aiCifraJobRepo.insert(cifraJob);

  // CONCLUÍDA — o histórico de análises do João não pode ter só o "em
  // andamento". Aponta para "Evidências", que TEM cifra na seção 15 (é o que
  // uma análise concluída deixa materializado). O resultado casa com a
  // biblioteca: mesmo tom, mesmo andamento.
  const cifraUploadDone = AiCifraUpload.create({
    musician_id: m1.musician_id.id,
    music_library_id: libraryOf(m1, "Evidências").entity_id.id,
    original_filename: "evidencias.mp3",
    content_type: "audio/mpeg",
    file_size: 4_194_304,
    object_key: `ai-cifra/${m1.musician_id.id}/seed-evidencias/original.mp3`,
    upload_method: "direct",
  });
  cifraUploadDone.markAnalysisQueued();
  cifraUploadDone.markAnalyzing();
  cifraUploadDone.markAnalyzed();
  await aiCifraUploadRepo.insert(cifraUploadDone);
  const cifraJobDone = AiCifraAnalysisJob.create({
    ai_cifra_upload_id: cifraUploadDone.entity_id.id,
    musician_id: m1.musician_id.id,
    model_id: "chordformer-v24",
  });
  cifraJobDone.start();
  cifraJobDone.complete(
    new AiCifraAnalysisResult({
      bpm: 132,
      key: "G",
      time_signature: "4/4",
      chords: [
        { start_seconds: 0, end_seconds: 1.82, chord: "G:maj", confidence: 0.93 },
        { start_seconds: 1.82, end_seconds: 3.64, chord: "E:min", confidence: 0.91 },
        { start_seconds: 3.64, end_seconds: 5.45, chord: "C:maj", confidence: 0.9 },
        { start_seconds: 5.45, end_seconds: 7.27, chord: "D:maj", confidence: 0.92 },
      ],
      segments: [{ start_seconds: 0, end_seconds: 7.27, label: "Intro", confidence: 0.88 }],
    }),
  );
  await aiCifraJobRepo.insert(cifraJobDone);

  // FALHOU — o card de erro com motivo, na biblioteca do Carlos ("Águas de
  // Março", que segue sem cifra justamente por isso).
  const cifraUploadFailed = AiCifraUpload.create({
    musician_id: musicians[2].musician_id.id,
    music_library_id: libraryOf(musicians[2], "Águas de Março").entity_id.id,
    original_filename: "aguas-de-marco.m4a",
    content_type: "audio/mp4",
    file_size: 3_145_728,
    object_key: `ai-cifra/${musicians[2].musician_id.id}/seed-aguas-de-marco/original.m4a`,
    upload_method: "direct",
  });
  cifraUploadFailed.markAnalysisQueued();
  cifraUploadFailed.markAnalyzing();
  cifraUploadFailed.markAnalysisFailed("Não foi possível decodificar o áudio enviado.");
  await aiCifraUploadRepo.insert(cifraUploadFailed);
  const cifraJobFailed = AiCifraAnalysisJob.create({
    ai_cifra_upload_id: cifraUploadFailed.entity_id.id,
    musician_id: musicians[2].musician_id.id,
    model_id: "chordformer-v24",
  });
  cifraJobFailed.start();
  cifraJobFailed.fail("audio_decode_failed", "Não foi possível decodificar o áudio enviado.");
  await aiCifraJobRepo.insert(cifraJobFailed);

  // ai-audio: um job CONCLUÍDO (Modo Ensaio utilizável sem GPU) e um EXPIRADO
  // (prazo de retenção vencido — o estado que prova que `expired` != `failed`).
  const stemsSong = libraryOf(m1, "Wonderwall");
  const audioUploadDone = AiAudioUpload.create({
    musician_id: m1.musician_id.id,
    music_library_id: stemsSong.entity_id.id,
    original_filename: "wonderwall.mp3",
    content_type: "audio/mpeg",
    file_size: 7_340_032,
    object_key: `ai-audio/${m1.musician_id.id}/seed-wonderwall/original.mp3`,
    upload_method: "from_source",
  });
  audioUploadDone.markSeparated();
  await aiAudioUploadRepo.insert(audioUploadDone);

  const audioJobDone = AiAudioSeparationJob.create({
    ai_audio_upload_id: audioUploadDone.entity_id.id,
    musician_id: m1.musician_id.id,
    model_id: "htdemucs_4stems",
    output_prefix: `ai-audio/${m1.musician_id.id}/seed-wonderwall/stems`,
    output_format: "mp3",
  });
  // ⚠️ insert → complete → update, e NÃO insert do job já concluído.
  // `AiAudioSeparationJobPrismaRepository.insert()` grava só a linha do job;
  // quem persiste os stems é o `update()`. Semear já concluído deixava o job
  // `completed` com ZERO outputs — e a tela do Modo Ensaio ficava presa no
  // "separando", porque o player só fica pronto quando há stem. Este é o mesmo
  // caminho que o worker real percorre.
  await aiAudioJobRepo.insert(audioJobDone);
  audioJobDone.start();
  audioJobDone.complete(
    ["vocals", "drums", "bass", "other"].map(
      (stem_name) =>
        new AiAudioSeparationOutput({
          stem_name,
          object_key: `ai-audio/${m1.musician_id.id}/seed-wonderwall/stems/${stem_name}.mp3`,
          content_type: "audio/mpeg",
          file_size: 1_835_008,
        }),
    ),
    // Prazo ainda longe: este é o job que deixa o Modo Ensaio abrir.
    // ⚠️ Os object_keys NÃO existem no storage — o player vai falhar ao tocar.
    // É proposital: o seed exercita a tela, os estados e a mesa de stems sem
    // subir GPU nem guardar áudio protegido. Para ouvir de verdade, rode uma
    // separação real pelo app.
    daysFromNow(3),
  );
  await aiAudioJobRepo.update(audioJobDone);

  const audioUploadExpired = AiAudioUpload.create({
    musician_id: m1.musician_id.id,
    music_library_id: libraryOf(m1, "Evidências").entity_id.id,
    original_filename: "evidencias.mp3",
    content_type: "audio/mpeg",
    file_size: 6_291_456,
    object_key: `ai-audio/${m1.musician_id.id}/seed-evidencias/original.mp3`,
    upload_method: "from_source",
  });
  audioUploadExpired.markSeparated();
  await aiAudioUploadRepo.insert(audioUploadExpired);

  const audioJobExpired = AiAudioSeparationJob.create({
    ai_audio_upload_id: audioUploadExpired.entity_id.id,
    musician_id: m1.musician_id.id,
    model_id: "htdemucs_4stems",
    output_prefix: `ai-audio/${m1.musician_id.id}/seed-evidencias/stems`,
    output_format: "mp3",
  });
  await aiAudioJobRepo.insert(audioJobExpired);
  audioJobExpired.start();
  audioJobExpired.complete(
    [
      new AiAudioSeparationOutput({
        stem_name: "vocals",
        object_key: `ai-audio/${m1.musician_id.id}/seed-evidencias/stems/vocals.mp3`,
        content_type: "audio/mpeg",
        file_size: 1_572_864,
      }),
    ],
    daysFromNow(-1),
  );
  await aiAudioJobRepo.update(audioJobExpired);
  // Agora expira de verdade: o `expireStems()` LIMPA os outputs, então rodar
  // sobre um job que tinha stem é o que reproduz o estado real pós-varredura —
  // job preservado, áudio apagado.
  audioJobExpired.expireStems();
  await aiAudioJobRepo.update(audioJobExpired);

  // NA FILA — separação pedida, worker ainda não pegou. É o "aguardando" do
  // Modo Ensaio, distinto do "separando".
  const audioUploadQueued = AiAudioUpload.create({
    musician_id: m1.musician_id.id,
    music_library_id: libraryOf(m1, "Garota de Ipanema").entity_id.id,
    original_filename: "garota-de-ipanema.mp3",
    content_type: "audio/mpeg",
    file_size: 5_767_168,
    object_key: `ai-audio/${m1.musician_id.id}/seed-ipanema/original.mp3`,
    upload_method: "from_source",
  });
  audioUploadQueued.markSeparationQueued();
  await aiAudioUploadRepo.insert(audioUploadQueued);
  await aiAudioJobRepo.insert(
    AiAudioSeparationJob.create({
      ai_audio_upload_id: audioUploadQueued.entity_id.id,
      musician_id: m1.musician_id.id,
      model_id: "htdemucs_4stems",
      output_prefix: `ai-audio/${m1.musician_id.id}/seed-ipanema/stems`,
      output_format: "mp3",
    }),
  );

  // FALHOU — no Carlos, para o erro não se misturar com os três estados do João.
  const audioUploadFailed = AiAudioUpload.create({
    musician_id: musicians[2].musician_id.id,
    music_library_id: libraryOf(musicians[2], "Fly Me to the Moon").entity_id.id,
    original_filename: "fly-me-to-the-moon.mp3",
    content_type: "audio/mpeg",
    file_size: 4_718_592,
    object_key: `ai-audio/${musicians[2].musician_id.id}/seed-fly-me/original.mp3`,
    upload_method: "from_source",
  });
  audioUploadFailed.markSeparationQueued();
  audioUploadFailed.markSeparating();
  audioUploadFailed.markSeparationFailed("Tempo limite do worker de separação excedido.");
  await aiAudioUploadRepo.insert(audioUploadFailed);
  const audioJobFailed = AiAudioSeparationJob.create({
    ai_audio_upload_id: audioUploadFailed.entity_id.id,
    musician_id: musicians[2].musician_id.id,
    model_id: "htdemucs_4stems",
    output_prefix: `ai-audio/${musicians[2].musician_id.id}/seed-fly-me/stems`,
    output_format: "mp3",
  });
  await aiAudioJobRepo.insert(audioJobFailed);
  audioJobFailed.start();
  audioJobFailed.fail("worker_timeout", "Tempo limite do worker de separação excedido.");
  await aiAudioJobRepo.update(audioJobFailed);

  // ── 24. Campanhas do estabelecimento ──────────────────────────────────────
  console.log("📣 Campanhas…");
  const campaignRepo = new CampaignPrismaRepository(prisma);
  // Sem mês no texto: "as quintas de setembro" envelhecia junto com a data.
  const campaignActive = Campaign.create({
    establishment_id: e1.establishment_id.id,
    title: "Quintas de Blues",
    description: "Procuramos trio de blues para as quintas do próximo mês.",
    start_date: daysFromNow(-2),
    end_date: daysFromNow(30),
    target_genres: ["Blues", "Rock"],
  });
  campaignActive.activate();
  await campaignRepo.insert(campaignActive);

  // Os dois status terminais: enviada (já foi) e cancelada.
  const campaignSent = Campaign.create({
    establishment_id: e1.establishment_id.id,
    title: "Festival de Rock da Augusta",
    description: "Convocatória encerrada — obrigado a quem se inscreveu.",
    start_date: daysFromNow(-40),
    end_date: daysFromNow(-10),
    target_genres: ["Rock"],
  });
  campaignSent.activate();
  campaignSent.markSent();
  await campaignRepo.insert(campaignSent);

  const campaignCancelled = Campaign.create({
    establishment_id: e1.establishment_id.id,
    title: "Carnaval fora de época",
    description: "Cancelada: a casa entra em reforma no período.",
    start_date: daysFromNow(15),
    end_date: daysFromNow(20),
    target_genres: ["Samba", "Axé"],
  });
  campaignCancelled.cancel();
  await campaignRepo.insert(campaignCancelled);

  // Rascunho: a lista do painel filtra por status, e com um só a UI não mostra
  // a diferença.
  await campaignRepo.insert(
    Campaign.create({
      establishment_id: e1.establishment_id.id,
      title: "Samba de Domingo (rascunho)",
      description: null,
      start_date: daysFromNow(10),
      end_date: daysFromNow(40),
      target_genres: ["Samba", "MPB"],
    }),
  );

  // ── 25. Projeções, ranking e vínculo Spotify ──────────────────────────────
  //
  // ⚠️ `MusicianAnalytics` fica DE FORA de propósito. A varredura de 22/ago
  // mostrou que nenhum arquivo em `src/` lê ou escreve essa tabela — o
  // `GetMusicianAnalyticsUseCase` calcula tudo na leitura, a partir de requests
  // e tips. Semeá-la encheria de dado uma tabela que nada consulta, e daria a
  // impressão falsa de que a tela do músico depende dela.
  console.log("📈 Projeções, ranking e Spotify…");
  const establishmentAnalyticsRepo = new EstablishmentAnalyticsPrismaRepository(prisma);
  // 180 dias do Bar do Zé (`bar1@`, GROWTH): o maior período da tela é 90, e a
  // comparação "contra os 90 anteriores" precisa de outros 90 atrás dele. Eram
  // três linhas, e o painel não tinha como mostrar tendência, ritmo da semana
  // nem a diferença entre 7, 30 e 90 dias. ⚠️ É projeção sintética — ver o
  // cabeçalho de `seed-analytics-series.ts`. O Maresia (FREE) continua SEM
  // linhas: é ele que exercita o 402.
  await establishmentAnalyticsRepo.bulkInsert(
    buildEstablishmentAnalyticsSeries({ days: 180 }).map(
      (day) => new EstablishmentAnalytics({ establishment_id: e1.establishment_id, ...day }),
    ),
  );

  const rankingRepo = new RankingPrismaRepository(prisma);
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 0));
  // Score = total do ledger (seção 12), não número à parte: ranking, projeção e
  // leaderboard contam a mesma história.
  const rankingSpecs = [fan1, fan2]
    .map((fan) => ({ fan, score: ledgerTotals.get(fan.audience_id.id) ?? 0 }))
    .sort((a, b) => b.score - a.score)
    .map((entry, index) => ({ ...entry, position: index + 1 }));
  for (const spec of rankingSpecs) {
    await rankingRepo.insert(
      Ranking.create({
        user_id: new Uuid(spec.fan.audience_id.id),
        ranking_type: RankingTypeEnum.TOP_FAS,
        period: RankingPeriodEnum.MONTHLY,
        position: spec.position,
        score: spec.score,
        period_start: monthStart,
        period_end: monthEnd,
      }),
    );
  }

  // Vínculo Spotify da Ana. Tokens são FICTÍCIOS e vão cifrados em repouso pelo
  // mapper (mesma chave SM-016 do resto do seed) — servem para a UI mostrar
  // "conta vinculada" e o botão de desvincular; qualquer chamada real à API do
  // Spotify falha com 401, que é o comportamento honesto para um token falso.
  const spotifyLinkRepo = new AudienceSpotifyLinkPrismaRepository(prisma, encryption);
  await spotifyLinkRepo.insert(
    AudienceSpotifyLink.create({
      audience_id: fan1.audience_id.id,
      spotify_user_id: "seed-spotify-ana",
      access_token: "seed-fake-access-token",
      refresh_token: "seed-fake-refresh-token",
      expires_at: daysFromNow(1),
    }),
  );

  console.log("\n✅ Seed concluído!");
  console.log(`   Músicos:          ${musicians.map((m) => `${m.stage_name} <${m.email.value}> (${m.musician_id.id})`).join("\n                     ")}`);
  console.log("   Opt-in de radar:  João=true, Maria=false, Carlos=null (ainda não decidiu)");
  console.log("   Documentos:       João/Maria CPF · Carlos CPF+MEI · Rafael só MEI · demais sem documento (contrato não emite)");
  console.log(`   Estabelecimentos: ${establishments.map((e) => e.name).join(", ")} — Lapa NÃO verificada e sem horário; só o Bar do Zé tem ficha técnica`);
  console.log("   Bandas:           Carlão Trio (líder Carlos, open_to_gigs=true, com endereço) · Blues Duo (líder João FREE — convidar mostra o aviso de plano —, open_to_gigs=null, Maria pending / Carlos declined, COM agenda própria) · Elétrica Coletivo (ÚNICA com faixa de preço: R$800–1500) e Raízes do Sul (open_to_gigs=true, elenco da busca W3.1). Todo líder tem o claim band_ids.");
  console.log("   Busca (W3.1):     6 dos 8 músicos e 3 das 4 bandas têm open_to_gigs=true. Raio a partir do Bar do Zé (-23.5537,-46.6524): 10 km pega SP; 50 km inclui Guarulhos; Campinas e Curitiba ficam sempre de fora. Bia Viola em TURNÊ no Rio (aparece a partir da Lapa).");
  console.log(`   Fãs:              ${fan1.email.value}, ${fan2.email.value} — preferências da taxonomia real, "Pra você" com resultado para os dois`);
  console.log("   Bookings:         pending (João, e Ana→Bar do Zé proposto PELO MÚSICO) · confirmed (3 do João/banda, 1 da Bia sem contrato) · cancelled · expired (Diego) · completed com check-in (João, Maria) · completed CONTESTADO (Rafael) · banda pending (Blues Duo) e confirmed (Carlão Trio)");
  console.log("   Inquiries:        open (com chat) · accepted · rejected · expired · converted (virou booking)");
  console.log("   Cifras (Play Mode): Evidências, Wonderwall e Garota de Ipanema com acordes + letra sincronizada; Tempo Perdido e Águas de Março sem análise (caso 'ainda não processada')");
  console.log("   Modo Ensaio:      as 5 músicas com cifra têm source=youtube + source_id fictício — a separação chega até o provider e falha limpa (422 da fonte), em vez de 422 por falta de dado");
  console.log("   Shows:            João encerrado no Maresia (6 músicas, com bis e 1 fora da biblioteca, gorjetas DENTRO das músicas) + AO VIVO no Sarau (3ª música tocando) · Maria encerrada no Maresia");
  console.log("   Pedidos:          pending/accepted/rejected/played · destaque promised/awaiting_payment/paid/expired/cancelled");
  console.log("   Avaliações:       estabelecimento→músico (5), músico→estabelecimento (4) e fã→músico (5, sem comentário)");
  console.log("   Indicações:       3 para o Maresia e 4 para o Bar do Zé (Carlão com duas vozes) — nova, vista e arquivada; alimenta /dashboard/indicacoes no web");
  console.log(`   Contratos:        ${contractStorage.pdfAvailable ? "PDF no MinIO" : "⚠️ sem PDF (download 404)"}\n                     ${contractSummary.join("\n                     ")}`);
  console.log("   Custódia:         pending (João, cobrança aberta) · held R$900 (João, R$810 em held_balance) · released (João R$720, Maria R$1.080) · refunded (Maria) · disputed (Rafael, R$1.350 retidos)");
  console.log("   Carteira do João: saldo R$510 (cachê liberado − saques), retido R$810 — gorjetas só em total_earned (liquidadas no Mercado Pago). Saques: concluído, pendente e recusado+estornado");
  console.log("   Saque bloqueado:  Helena (musico8) → 403 EMAIL_NOT_VERIFIED · Maria (musico2) → carência de chave PIX recém-trocada");
  console.log("   Escopo do pedido: Carlos (musico3) RECUSA pedido fora do repertório; os outros 7 aceitam (default)");
  console.log("   Analytics (app):  Carlos (musico3, PRO) → ~6 meses de noites · João (musico1, FREE) → 402");
  console.log("   Push:             token Expo fictício em musico1/2/3; os outros 5 sem token, como quem ainda não abriu o app");
  console.log("   Assinaturas:      active (Maria, Carlos, Rafael, Bia, Bar do Zé, Lapa) · trial (Helena) · cancelled (Rafael antigo, Savassi) · expired (Diego antigo, Maresia)");
  console.log("   Jobs de IA:       ai-cifra analisando 'Tempo Perdido' (45%), concluído 'Evidências', falhou 'Águas de Março' · ai-audio concluído 'Wonderwall' (4 stems), na fila 'Garota de Ipanema', EXPIRADO 'Evidências', falhou 'Fly Me to the Moon'");
  console.log("   ⚠️ Os stems apontam para object_keys que NÃO existem no storage — a tela e a mesa funcionam, tocar não. Para ouvir, rode uma separação real pelo app.");
  console.log("   Campanhas:        active · draft · sent · cancelled (todas do Bar do Zé)");
  console.log(`   Gamificação:      ledger canônico com indicação e compartilhamento (dedupe por referência); ${[fan1, fan2].map((f) => `${f.nickname} ${ledgerTotals.get(f.audience_id.id)} pts`).join(", ")}`);
  console.log("   Extras:           analytics do Bar do Zé (3 dias), Spotify vinculado à Ana (token fictício), repertório do Carlos compartilhado por link + convite ao João");
  console.log("   Cifras pessoais:  João 2/3 (Wonderwall privada c/ edições + base_updated · Evidências na comunidade) · Carlos: Garota de Ipanema na comunidade (pronta pro João importar) e Fly Me to the Moon só para a BANDA");
  console.log("");
  console.log("   ⏳ O QUE VENCE SOZINHO (datas são relativas a agora; rode `npm run seed -- --reset` para renovar tudo):");
  console.log("      ~20 min  destaque awaiting_payment → expired (ExpireRequestBoostsJob, janela de 15 min)");
  console.log("      ~3 h     Roda de Samba da Lapa e Sax ao Pôr do Sol saem do cartaz 'ao vivo' da Home do fã; Viola ao Luar passa de 'próximo' a 'ao vivo'");
  console.log("      ~6 h     Sarau ao Vivo → completed (AutoFinishEventsJob); pedido/check-in de fã deixam de passar");
  console.log("      24 h     carência da chave PIX da Maria");
  console.log("      1 dia    token Spotify da Ana (o refresh falha com token falso; o vínculo continua)");
  console.log("      3 dias   stems de 'Wonderwall' → expired (PurgeExpiredAiAudioStemsJob); Noite do Blues acontece");
  console.log("      ~4 dias  booking da Noite do Blues → completed (CompleteConfirmedBookingsJob, 24h após o fim)");
  console.log("      5–7 dias propostas pendentes → expired (ExpirePendingBookingsJob); link do repertório do Carlos; inquiry aberto");
  console.log("      10 dias  turnê da Bia · 14 dias trial da Helena · 1 mês assinaturas mensais e ranking do mês");
  if (keycloakSubs.size > 0) {
    // AUTH-1 (31/ago/2026): `POST /auth/login` não existe mais. O login é
    // Authorization Code + PKCE contra o Keycloak — no app, pelo botão
    // "Entrar"; para teste manual, pelo próprio realm.
    console.log(`   🔑 ${keycloakSubs.size} logins de teste (Keycloak, PKCE), senha ${KEYCLOAK_SEED_PASSWORD}:`);
    console.log("      músicos:          musico1..musico8@seed-soundmeet.com");
    console.log("      fãs:              fa1@ e fa2@seed-soundmeet.com");
    console.log("      seguindo:         Ana → João + Bar do Zé (avisos ligados) · Bruno → João (avisos desligados)");
    console.log("      estabelecimentos: bar1@ rest1@ club1@ bar2@seed-soundmeet.com (claim establishment_ids escrito — o painel web funciona)");
    console.log("      admin:            admin@seed-soundmeet.com (12 rotas @Roles(\"admin\"): takedown de cifra, badges, anular contrato)");
  } else {
    console.log("   ⚠️ Lembre: crie/vincule os usuários Keycloak correspondentes para logar no app.");
  }
}

main()
  .catch((error) => {
    console.error("❌ Seed falhou:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
