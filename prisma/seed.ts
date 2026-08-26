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
 * Cobertura (22/ago/2026): 52 dos 56 modelos do schema. Os quatro de fora são
 * decisão, não esquecimento — não semear é mais correto que semear:
 *   - `ProcessedEvent`: ledger de idempotência. Semeá-lo faria a app PULAR
 *     eventos que ela deveria processar. Ativamente nocivo.
 *   - `GoogleCalendarIntegration` / `GoogleCalendarSyncedEvent`: exigem token
 *     OAuth real do Google. Token falso produz uma integração que a UI mostra
 *     como conectada e que falha em toda chamada — pior que ausente.
 *   - `SyncedLyricsBulkJob`: controle do pré-carregamento de 10k letras, não é
 *     estado de usuário.
 *   - `MusicianAnalytics` é caso à parte: a tabela existe no schema e NENHUM
 *     arquivo de `src/` a lê ou escreve (o use-case calcula na leitura). Ver a
 *     nota na seção 25.
 *   - Cria 14 usuários Keycloak de teste (8 músicos, 2 fãs, 4 estabelecimentos)
 *     com senha Seed@123
 *     ANTES dos aggregates: o sub gerado vira o id do aggregate, como no
 *     RegisterUseCase (ownership guards comparam o sub do JWT com o id do
 *     recurso). Se o Keycloak estiver fora do ar, o seed conclui com aviso e
 *     ids aleatórios — rode com --reset depois de subir o Keycloak.
 */
// reflect-metadata primeiro: agregados puxam inputs com decorators de
// class-transformer/class-validator via barrels do core.
import "reflect-metadata";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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
import { EventMusicianPrismaRepository } from "../src/core/events/infra/db/prisma/event-musician-prisma.repository";
import { Badge } from "../src/core/gamification/domain/badge.aggregate";
import { UserBadge } from "../src/core/gamification/domain/user-badge.aggregate";
import { UserInteraction } from "../src/core/gamification/domain/user-interaction.aggregate";
import { UserPoints } from "../src/core/gamification/domain/user-points.aggregate";
import { UserScore } from "../src/core/gamification/domain/user-score.aggregate";
import { BadgeTypeEnum } from "../src/core/gamification/domain/value-objects/badge-type.vo";
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
import { AiCifraAnalysisJob } from "../src/core/ai-cifra/domain/ai-cifra-analysis-job.aggregate";
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
import { Contract } from "../src/core/contract/domain/contract.aggregate";
import { ContractPrismaRepository } from "../src/core/contract/infra/db/prisma/contract-prisma.repository";
import { BookingEscrow } from "../src/core/payment/domain/booking-escrow.aggregate";
import { BookingEscrowPrismaRepository } from "../src/core/payment/infra/db/prisma/booking-escrow-prisma.repository";
import { Performance } from "../src/core/performance/domain/performance.aggregate";
import { PerformancePrismaRepository } from "../src/core/performance/infra/db/prisma/performance-prisma.repository";
import { Review } from "../src/core/review/domain/review.aggregate";
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
import {
  CHORD_SHEET_FINGERPRINT_VERSION,
  computeChordSheetBaseFingerprint,
} from "../src/core/personal-chord-sheet/application/services/chord-sheet-fingerprint";
import { PersonalChordSheet } from "../src/core/personal-chord-sheet/domain/personal-chord-sheet.aggregate";
import { ChordEdit } from "../src/core/personal-chord-sheet/domain/value-objects/chord-edit.vo";
import { ChordSheetViewSettings } from "../src/core/personal-chord-sheet/domain/value-objects/chord-sheet-view-settings.vo";
import { PersonalChordSheetPrismaRepository } from "../src/core/personal-chord-sheet/infra/db/prisma/personal-chord-sheet-prisma.repository";
import { MusicianWallet } from "../src/core/payment/domain/musician-wallet.aggregate";
import { Tip } from "../src/core/payment/domain/tip.aggregate";
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
import { AesGcmEncryptionService } from "../src/core/shared/infra/crypto/aes-gcm-encryption.service";
import { GetChordSheetForMusicLibraryUseCase } from "../src/core/synced-lyrics/application/use-cases/get-chord-sheet-for-music-library/get-chord-sheet-for-music-library.use-case";
import { LrcParser } from "../src/core/synced-lyrics/domain/value-objects/lrc.vo";
import { ChordSheetPrismaReadModel } from "../src/core/synced-lyrics/infra/db/prisma/chord-sheet-prisma.read-model";

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
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.requestVote.deleteMany();
  await prisma.requestFeedback.deleteMany();
  await prisma.musicRequest.deleteMany();
  await prisma.tip.deleteMany();
  await prisma.transaction.deleteMany();
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

const daysFromNow = (days: number, hour = 20) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
};

// ── usuários Keycloak de teste ───────────────────────────────────────────────

const KEYCLOAK_SEED_PASSWORD = "Seed@123";

type KeycloakSeedUser = {
  email: string;
  name: string;
  // `establishment` é papel de realm igual aos outros (Docs/auth/keycloak.md
  // §87). A diferença não está aqui: é que o `sub` NÃO vira o id do aggregate
  // do estabelecimento — ele tem UUID próprio, e quem autoriza é o claim
  // `establishment_ids`, escrito logo após a seção 2.
  role: "musician" | "audience" | "establishment";
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
 * ninguém escreve esse claim por ele — sem esta chamada, João loga, vê a banda
 * na lista e leva 403 em toda rota de líder.
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

    // emailVerified/requiredActions espelham o registro real (Docs/auth/keycloak.md).
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
      .withOpenToGigs(spec.openToGigs);
    const musicianSub = keycloakSubs.get(spec.email);
    if (musicianSub) {
      musicianBuilder.withMusicianId(new MusicianId(musicianSub));
    }
    const musician = musicianBuilder.build();

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

    await musicianRepo.insert(musician);
    musicians.push(musician);

    // Carteira com histórico
    const wallet = MusicianWallet.fake()
      .aMusicianWallet()
      .withMusicianId(musician.musician_id)
      .build();
    wallet.updatePixKey(spec.email, "email");
    // Só o João tem extrato no seed (gorjetas da seção 9 + transações da 14).
    // Carteira zerada com extrato cheio é o tipo de incoerência que faz perder
    // tempo achando que a tela de carteira está quebrada. Líquidos = bruto − 9%
    // (taxa do tier FREE): 25 → 22,75 e 50 → 45,50; saldo final R$ 8,25.
    if (spec.email === "musico1@seed-soundmeet.com") {
      wallet.receiveFunds(22.75);
      wallet.receiveFunds(45.5);
      wallet.withdrawFunds(60);
    }
    await walletRepo.insert(wallet);

    // Assinatura (só tiers pagos — FREE não tem linha de subscription)
    if (spec.tier !== MusicianPlanTier.FREE) {
      const subscription = Subscription.create({
        musician_id: musician.musician_id.id,
        plan_tier: spec.tier,
        persona: "musician",
        billing_cycle: BillingCycle.MONTHLY,
      });
      await subscriptionRepo.insert(subscription);
    }
  }
  const [m1, m2] = musicians;

  // ── 2. Estabelecimentos (com endereço + lat/lng p/ busca por raio) ────────
  console.log("🏢 Estabelecimentos…");
  const establishmentSpecs = [
    {
      name: "Bar do Zé", type: "bar" as const, email: "bar1@seed-soundmeet.com",
      street: "Rua Augusta", number: "1024", neighborhood: "Consolação",
      city: "São Paulo", state: "SP", cep: "01304001", lat: -23.5537, lng: -46.6524,
      genres: ["Blues", "Rock"],
    },
    {
      name: "Restaurante Maresia", type: "restaurant" as const, email: "rest1@seed-soundmeet.com",
      street: "Rua dos Pinheiros", number: "320", neighborhood: "Pinheiros",
      city: "São Paulo", state: "SP", cep: "05422001", lat: -23.5662, lng: -46.6825,
      genres: ["MPB", "Bossa Nova"],
    },
    {
      name: "Lapa Music Hall", type: "club" as const, email: "club1@seed-soundmeet.com",
      street: "Avenida Mem de Sá", number: "23", neighborhood: "Lapa",
      city: "Rio de Janeiro", state: "RJ", cep: "20230150", lat: -22.9133, lng: -43.1809,
      genres: ["Samba", "Pagode"],
    },
    {
      name: "Savassi Jazz Bar", type: "bar" as const, email: "bar2@seed-soundmeet.com",
      street: "Rua Pernambuco", number: "1000", neighborhood: "Savassi",
      city: "Belo Horizonte", state: "MG", cep: "30130151", lat: -19.9352, lng: -43.9345,
      genres: ["Jazz", "Blues"],
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
      .build();

    const establishment = Establishment.fake()
      .anEstablishment()
      .withName(spec.name)
      .withEmail(spec.email)
      .withCnpj(cnpjFromBase(`1122233300${String(establishments.length + 10)}`))
      .withEstablishmentType(spec.type)
      .withIsVerified(true)
      .withProfile(profile)
      .build();

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

  // ── 3. Fãs (audience) ──────────────────────────────────────────────────────
  console.log("🙋 Fãs…");
  const fan1Builder = Audience.fake().aAudience()
    .withName("Ana Fã").withEmail("fa1@seed-soundmeet.com").withNickname("aninha");
  const fan1Sub = keycloakSubs.get("fa1@seed-soundmeet.com");
  if (fan1Sub) fan1Builder.withId(new AudienceId(fan1Sub));
  const fan1 = fan1Builder.build();
  const fan2Builder = Audience.fake().aTopFan()
    .withName("Bruno Superfã").withEmail("fa2@seed-soundmeet.com").withNickname("brunao");
  const fan2Sub = keycloakSubs.get("fa2@seed-soundmeet.com");
  if (fan2Sub) fan2Builder.withId(new AudienceId(fan2Sub));
  const fan2 = fan2Builder.build();
  await audienceRepo.insert(fan1);
  await audienceRepo.insert(fan2);

  // ── 4. Eventos (todos os EventStatus) ─────────────────────────────────────
  console.log("🎤 Eventos…");
  const eventSpecs = [
    { est: e1, name: "Noite do Blues", start: daysFromNow(3), status: "scheduled" },
    { est: e1, name: "Sarau ao Vivo", start: daysFromNow(0, 19), status: "active" },
    { est: e2, name: "Jantar com Bossa", start: daysFromNow(-7), status: "completed" },
    { est: e2, name: "Feijoada com Samba", start: daysFromNow(5, 13), status: "cancelled" },
  ] as const;

  const events: Event[] = [];
  for (const spec of eventSpecs) {
    const end = new Date(spec.start.getTime() + 4 * 60 * 60 * 1000);
    const event = Event.fake()
      .anEvent()
      .withEstablishmentId(spec.est.establishment_id)
      .withName(spec.name)
      .withStartAt(spec.start)
      .withEndAt(end)
      .withStatus(spec.status)
      .build();
    await eventRepo.insert(event);
    events.push(event);
  }
  const [evScheduled, evActive, evCompleted] = events;

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

  // ── 6. Bookings (pending/confirmed/cancelled/completed) + inquiries ───────
  console.log("🗓️ Bookings e inquiries…");
  const now = new Date();

  const bookingPending = Booking.fake().aBooking()
    .withEstablishmentId(new Uuid(e1.establishment_id.id))
    .withMusicianId(new Uuid(m1.musician_id.id))
    .withStartAt(daysFromNow(11, 20)).withEndAt(daysFromNow(11, 23))
    .withExpiresAt(daysFromNow(2)).build();

  const bookingConfirmed = Booking.fake().aBooking()
    .withEstablishmentId(new Uuid(e1.establishment_id.id))
    .withMusicianId(new Uuid(m1.musician_id.id))
    .withEventId(new Uuid(evScheduled.event_id.id))
    .withStartAt(daysFromNow(4, 20)).withEndAt(daysFromNow(4, 23))
    .withExpiresAt(daysFromNow(2)).build();
  bookingConfirmed.confirm(now);

  const bookingCancelled = Booking.fake().aBooking()
    .withEstablishmentId(new Uuid(e2.establishment_id.id))
    .withMusicianId(new Uuid(m2.musician_id.id))
    .withStartAt(daysFromNow(9, 19)).withEndAt(daysFromNow(9, 22))
    .withExpiresAt(daysFromNow(2)).build();
  bookingCancelled.confirm(now);
  bookingCancelled.cancel(now, "establishment", "Reforma na casa");

  const bookingCompleted = Booking.fake().aBooking()
    .withEstablishmentId(new Uuid(e2.establishment_id.id))
    .withMusicianId(new Uuid(m2.musician_id.id))
    .withEventId(new Uuid(evCompleted.event_id.id))
    .withStartAt(daysFromNow(-7, 19)).withEndAt(daysFromNow(-7, 22))
    .withExpiresAt(daysFromNow(-9)).build();
  bookingCompleted.confirm(daysFromNow(-10));
  bookingCompleted.complete(daysFromNow(-6));

  // Booking concluído do João no mesmo evento passado. Sem ele o currículo
  // verificado (F4) mostra 0 shows para o João mesmo com a apresentação
  // registrada na seção 19: `shows_completed` conta BOOKING `completed`, não
  // performance. E é ele que dá contexto legítimo às avaliações da seção 20 —
  // `context_type: "booking"` exige um id de booking de verdade.
  const bookingCompletedJoao = Booking.fake().aBooking()
    .withEstablishmentId(new Uuid(e2.establishment_id.id))
    .withMusicianId(new Uuid(m1.musician_id.id))
    .withEventId(new Uuid(evCompleted.event_id.id))
    .withStartAt(daysFromNow(-7, 19)).withEndAt(daysFromNow(-7, 22))
    .withExpiresAt(daysFromNow(-9)).build();
  bookingCompletedJoao.confirm(daysFromNow(-10));
  bookingCompletedJoao.complete(daysFromNow(-6));

  for (const booking of [
    bookingPending,
    bookingConfirmed,
    bookingCancelled,
    bookingCompleted,
    bookingCompletedJoao,
  ]) {
    await bookingRepo.insert(booking);
  }

  const inquiryOpen = Inquiry.fake().anInquiry()
    .withEstablishmentId(new Uuid(e1.establishment_id.id))
    .withMusicianId(new Uuid(m1.musician_id.id))
    .build();
  await inquiryRepo.insert(inquiryOpen);

  // ── 7. Chat: conversa (inquiry aberto) + mensagens ────────────────────────
  console.log("💬 Conversas…");
  const conversation = Conversation.create({
    inquiry_id: inquiryOpen.inquiry_id.id,
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
  const tipSpecs = [
    { fan: fan1, status: "completed" as const, amount: 25, event: evActive },
    { fan: fan2, status: "completed" as const, amount: 50, event: evActive },
    { fan: fan1, status: "pending" as const, amount: 10, event: evActive },
    { fan: fan2, status: "failed" as const, amount: 15, event: evActive },
    { fan: fan1, status: "completed" as const, amount: 30, event: evCompleted },
    { fan: fan2, status: "completed" as const, amount: 20, event: evCompleted },
  ];
  for (const spec of tipSpecs) {
    const tip = Tip.fake().aTip()
      .withAudienceId(new Uuid(spec.fan.audience_id.id))
      .withMusicianId(new Uuid(m1.musician_id.id))
      .withEventId(new Uuid(spec.event.event_id.id))
      // amount explícito: o default do fake builder gera Money com >2 casas
      // decimais (chance.floating) e estoura a validação do VO
      .withAmount(new Money(spec.amount))
      .build();
    if (spec.status === "completed") tip.complete(`seed-tx-${Math.random().toString(36).slice(2, 10)}`);
    if (spec.status === "failed") tip.fail();
    await tipRepo.insert(tip);
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
      .withJoinedAt(daysFromNow(spec.left ? -7 : 0, 19))
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

  const userBadgeSpecs = [
    { fan: fan1, type: BadgeTypeEnum.INICIANTE_MUSICAL, progress: 100, unlocked: true },
    { fan: fan1, type: BadgeTypeEnum.APOIADOR, progress: 40, unlocked: false },
    { fan: fan2, type: BadgeTypeEnum.INICIANTE_MUSICAL, progress: 100, unlocked: true },
    { fan: fan2, type: BadgeTypeEnum.SUPER_FA, progress: 100, unlocked: true },
    { fan: fan2, type: BadgeTypeEnum.MECENAS, progress: 65, unlocked: false },
  ];
  for (const spec of userBadgeSpecs) {
    const userBadge = UserBadge.fake().aUserBadge()
      .withUserId(new Uuid(spec.fan.audience_id.id))
      .withBadgeType(spec.type)
      .withProgress(spec.progress)
      .withIsUnlocked(spec.unlocked)
      .withUnlockedAt(spec.unlocked ? daysFromNow(-3) : null)
      .build();
    await userBadgeRepo.insert(userBadge);
  }

  // Ledger (UserScore = fonte de verdade) + projeção (UserPoints = resumo) —
  // números coerentes entre si de propósito, pros dois lados do modelo
  // poderem ser validados no app (GamificationScreen + Leaderboard).
  const scoreSpecs = [
    { fan: fan1, type: ScoreTypeEnum.QR_SCAN, points: 10, description: "Scan no show do João" },
    { fan: fan1, type: ScoreTypeEnum.REQUEST_SENT, points: 5, description: "Pediu Evidências" },
    { fan: fan2, type: ScoreTypeEnum.QR_SCAN, points: 10, description: "Scan no show do João" },
    { fan: fan2, type: ScoreTypeEnum.TIP_GIVEN, points: 20, description: "Gorjeta de R$ 50" },
    { fan: fan2, type: ScoreTypeEnum.EVENT_ATTENDANCE, points: 15, description: "Presença no Jantar com Bossa" },
  ];
  for (const spec of scoreSpecs) {
    const score = UserScore.fake().aUserScore()
      .withUserId(new Uuid(spec.fan.audience_id.id))
      .withScoreType(spec.type)
      .withPoints(spec.points)
      .withDescription(spec.description)
      .build();
    await userScoreRepo.insert(score);
  }

  const pointsSpecs = [
    { fan: fan1, total: 15, scans: 1, requests: 1, tips: 0, level: 1 },
    { fan: fan2, total: 45, scans: 1, requests: 0, tips: 1, level: 2 },
  ];
  for (const spec of pointsSpecs) {
    const points = UserPoints.fake().aUserPoints()
      .withUserId(new Uuid(spec.fan.audience_id.id))
      .withTotalPoints(spec.total)
      .withTotalScans(spec.scans)
      .withTotalRequests(spec.requests)
      .withTotalTips(spec.tips)
      .withTotalSocialShares(0)
      .withCurrentLevel(spec.level)
      .build();
    await userPointsRepo.insert(points);
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
  const transactionSpecs = [
    { type: TransactionType.TIP, amount: 25, fee: 2.25, status: TransactionStatus.COMPLETED, fan: fan1 },
    { type: TransactionType.TIP, amount: 50, fee: 4.5, status: TransactionStatus.COMPLETED, fan: fan2 },
    { type: TransactionType.WITHDRAWAL, amount: 60, fee: 0, status: TransactionStatus.COMPLETED, fan: null },
    // 5 e não 40: o saldo do João depois do saque concluído é R$ 8,25 — um
    // saque pendente maior que o saldo não existiria na app.
    { type: TransactionType.WITHDRAWAL, amount: 5, fee: 0, status: TransactionStatus.PENDING, fan: null },
  ];
  for (const spec of transactionSpecs) {
    const transaction = Transaction.fake().aTransaction()
      .withMusicianId(new Uuid(m1.musician_id.id))
      .withUserId(spec.fan ? new Uuid(spec.fan.audience_id.id) : null)
      .withType(spec.type)
      .withAmount(new Money(spec.amount))
      .withFee(new Money(spec.fee))
      .withNetAmount(new Money(spec.amount - spec.fee))
      .withStatus(spec.status)
      .build();
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
  for (const item of libraryItems.slice(0, 3)) {
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

  // ── 17. Bandas (opt-in de radar + convite com estado, jul/2026) ───────────
  console.log("🥁 Bandas…");

  // Carlão Trio — líder é o Carlos (sem login Keycloak seedado, ver topo do
  // arquivo), então serve só pra QA do lado ESTABELECIMENTO (busca de banda,
  // hiring-dashboard compatible_bands): open_to_gigs=true + endereço próprio
  // preenchido pra aparecer de verdade nesses fluxos.
  const band = Band.fake().aBand()
    .withName("Carlão Trio")
    .withDescription("Trio de jazz e samba para eventos")
    .withGenres(["Jazz", "Samba"])
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

  // Blues Duo — líder é o João (ÚNICO músico com login Keycloak real), pra
  // dar pra testar de ponta a ponta as telas novas de líder no mobile
  // (convidar/remover membro, Disponibilidade/Endereço da banda) logando de
  // verdade. open_to_gigs fica null de propósito (não setado) — cobre o
  // estado "banda ainda não decidiu" na UI de líder, distinto da Carlão Trio.
  // Membros: Maria com convite "pending" (testa aceitar/recusar +
  // cancelar convite) e Carlos com "declined" (testa o botão "Convidar de
  // novo" na própria linha do membro).
  const bandJoao = Band.fake().aBand()
    .withName("Blues Duo")
    .withDescription("Duo de blues e rock para bares")
    .withGenres(["Blues", "Rock"])
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

  for (const spec of bandsBusca) {
    await bandRepo.insert(
      Band.fake().aBand()
        .withName(spec.name)
        .withDescription(spec.description)
        .withGenres(spec.genres)
        .withMembers(spec.members)
        .withOpenToGigs(true)
        .withAddress(spec.location)
        .build(),
    );
  }

  // Vínculo conta ↔ banda. O CreateBandUseCase escreve `band_ids` no Keycloak;
  // o seed insere pelo repositório, então precisa escrever por conta própria —
  // sem isto o João vê a banda na lista e leva 403 do BandOwnershipGuard em
  // toda rota de líder (convidar membro, agenda, split de gorjeta).
  if (keycloakAdmin) {
    const joaoSub = keycloakSubs.get(m1.email.value);
    if (joaoSub) {
      try {
        await addKeycloakClaimValue(
          keycloakAdmin,
          joaoSub,
          "band_ids",
          bandJoao.band_id.id,
        );
        console.log("   🔗 claim band_ids do João vinculado à Blues Duo.");
      } catch (error) {
        console.warn(
          `   ⚠️ Falha ao vincular band_ids do João (${(error as Error).message}). ` +
            "As rotas de líder da Blues Duo vão responder 403 até isso ser corrigido.",
        );
      }
    }
  }

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

  // ── 21. Contratos digitais (Bloco 10) — os três estados que a UI mostra ───
  //
  // Emitido → assinado por uma parte → assinado pelas duas. É o ciclo que as
  // duas telas (web B3 e mobile B4) filtram: "aguardando você" só aparece se
  // existir um contrato em que a SUA parte ainda não assinou.
  console.log("📄 Contratos…");
  const contractRepo = new ContractPrismaRepository(prisma);

  const contractsSpec = [
    { booking: bookingConfirmed, est: e1, musician: m1, sign: [] as ("contractor" | "contracted")[] },
    { booking: bookingCompletedJoao, est: e2, musician: m1, sign: ["contractor"] as ("contractor" | "contracted")[] },
    { booking: bookingCompleted, est: e2, musician: m2, sign: ["contractor", "contracted"] as ("contractor" | "contracted")[] },
  ];

  for (const [index, spec] of contractsSpec.entries()) {
    const contract = Contract.fake().aContract()
      .withBookingId(spec.booking.entity_id.id)
      .withEstablishmentId(spec.est.establishment_id.id)
      .withMusicianId(spec.musician.musician_id.id)
      .build();

    for (const role of spec.sign) {
      contract.sign({
        role,
        // `sub` de quem assinou: o estabelecimento assina pela conta que opera
        // a casa; o músico, pela dele. Não é o id do aggregate do
        // estabelecimento — é o usuário autenticado.
        signer_user_id:
          role === "contractor"
            ? (keycloakSubs.get(spec.est.email.value) ?? spec.est.establishment_id.id)
            : spec.musician.musician_id.id,
        signed_at: daysFromNow(-2 - index),
        ip: "203.0.113.10",
        ip_source: "direct",
        user_agent: "SoundMeetSeed/1.0",
      });
    }

    await contractRepo.insert(contract);
  }

  // ── 22. Custódia do cachê (F1.3a) — estados locais, sem gateway ───────────
  //
  // 🔴 `held_balance` é ESPELHO do que está retido na subconta do músico na
  // instituição de pagamento, nunca fonte. O seed escreve os dois lados juntos
  // (custódia + carteira) porque é assim que o fluxo real deixa o sistema;
  // escrever só a custódia daria uma tela de carteira mentindo sobre o retido.
  console.log("🔒 Custódia do cachê…");
  const escrowRepo = new BookingEscrowPrismaRepository(prisma);

  const escrowHeld = BookingEscrow.create({
    booking_id: bookingConfirmed.entity_id.id,
    musician_id: m1.musician_id.id,
    amount: 900,
    platform_fee_percentage: 10,
  });
  escrowHeld.markHeld({
    external_id: "seed-asaas-escrow-001",
    expires_at: daysFromNow(30),
  });
  await escrowRepo.insert(escrowHeld);

  const escrowPending = BookingEscrow.create({
    booking_id: bookingPending.entity_id.id,
    musician_id: m1.musician_id.id,
    amount: 1200,
    platform_fee_percentage: 10,
  });
  await escrowRepo.insert(escrowPending);

  // Espelha o retido na carteira do João. O valor é o LÍQUIDO (net_amount):
  // a comissão só vira receita da plataforma na liberação, então ela nunca
  // aparece como retido do músico.
  const joaoWallet = await walletRepo.findByMusicianId(m1.musician_id.id);
  if (joaoWallet) {
    joaoWallet.holdFunds(escrowHeld.net_amount.amount);
    await walletRepo.update(joaoWallet);
  }

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

  // ── 24. Campanhas do estabelecimento ──────────────────────────────────────
  console.log("📣 Campanhas…");
  const campaignRepo = new CampaignPrismaRepository(prisma);
  const campaignActive = Campaign.create({
    establishment_id: e1.establishment_id.id,
    title: "Quintas de Blues",
    description: "Procuramos trio de blues para as quintas de setembro.",
    start_date: daysFromNow(1),
    end_date: daysFromNow(30),
    target_genres: ["Blues", "Rock"],
  });
  campaignActive.activate();
  await campaignRepo.insert(campaignActive);

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
  for (let i = 1; i <= 3; i++) {
    await establishmentAnalyticsRepo.insert(
      new EstablishmentAnalytics({
        establishment_id: e1.establishment_id,
        date: daysFromNow(-i),
        events_hosted: 1,
        total_attendees: 60 + i * 15,
        musicians_hired: 1,
        total_spent: 800 + i * 100,
        avg_rating: 4.5,
      }),
    );
  }

  const rankingRepo = new RankingPrismaRepository(prisma);
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 0));
  const rankingSpecs = [
    { fan: fan2, position: 1, score: 320 },
    { fan: fan1, position: 2, score: 145 },
  ];
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
  console.log(`   Estabelecimentos: ${establishments.map((e) => e.name).join(", ")}`);
  console.log("   Bandas:           Carlão Trio (líder Carlos, open_to_gigs=true, com endereço) · Blues Duo (líder João, open_to_gigs=null, Maria pending / Carlos declined) · Elétrica Coletivo e Raízes do Sul (open_to_gigs=true, elenco da busca W3.1)");
  console.log("   Busca (W3.1):     6 dos 8 músicos e 3 das 4 bandas têm open_to_gigs=true. Raio a partir do Bar do Zé (-23.5537,-46.6524): 10 km pega SP; 50 km inclui Guarulhos; Campinas e Curitiba ficam sempre de fora.");
  console.log(`   Fãs:              ${fan1.email.value}, ${fan2.email.value}`);
  console.log("   Cifras (Play Mode): Evidências, Wonderwall e Garota de Ipanema com acordes + letra sincronizada; Tempo Perdido e Águas de Março sem análise (caso 'ainda não processada')");
  console.log("   Modo Ensaio:      as 5 músicas com cifra têm source=youtube + source_id fictício — a separação chega até o provider e falha limpa (422 da fonte), em vez de 422 por falta de dado");
  console.log("   Shows:            João encerrado no Maresia (6 músicas, com bis e 1 fora da biblioteca) + AO VIVO no Sarau de hoje (3ª música tocando) · Maria encerrada no Maresia");
  console.log("   Avaliações:       estabelecimento→músico (5), músico→estabelecimento (4) e fã→músico (5, sem comentário)");
  console.log("   Contratos:        3 estados — emitido (ninguém assinou) · parcial (só o estabelecimento) · assinado pelos dois");
  console.log("   Custódia:         R$900 retidos (held, líquido R$810 espelhado em held_balance) + R$1200 pendentes");
  console.log("   Jobs de IA:       ai-cifra analisando 'Tempo Perdido' (45%) · ai-audio concluído em 'Wonderwall' (4 stems) e EXPIRADO em 'Evidências'");
  console.log("   ⚠️ Os stems apontam para object_keys que NÃO existem no storage — a tela e a mesa funcionam, tocar não. Para ouvir, rode uma separação real pelo app.");
  console.log("   Campanhas:        1 ativa (Quintas de Blues) + 1 rascunho");
  console.log("   Extras:           analytics do Bar do Zé (3 dias), ranking mensal de fãs (Bruno 1º, Ana 2º), Spotify vinculado à Ana (token fictício)");
  console.log("   Cifras pessoais:  João 2/3 (Wonderwall privada c/ edições + base_updated · Evidências na comunidade) · Carlos: Garota de Ipanema na comunidade, pronta pro João importar");
  if (keycloakSubs.size > 0) {
    console.log(`   🔑 ${keycloakSubs.size} logins de teste (POST /api/v1/auth/login), senha ${KEYCLOAK_SEED_PASSWORD}:`);
    console.log("      músicos:          musico1..musico8@seed-soundmeet.com");
    console.log("      fãs:              fa1@ e fa2@seed-soundmeet.com");
    console.log("      estabelecimentos: bar1@ rest1@ club1@ bar2@seed-soundmeet.com (claim establishment_ids escrito — o painel web funciona)");
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
