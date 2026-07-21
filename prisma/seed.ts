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
 *   - Cria 2 usuários Keycloak de teste (musico1 e fa1) com senha Seed@123
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
import axios from "axios";

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
import { MusicLibraryPrismaRepository } from "../src/core/music-library/infra/db/prisma/music-library-prisma.repository";
import { EstablishmentProfile } from "../src/core/establishment/domain/establishment-profile.aggregate";
import { EstablishmentPrismaRepository } from "../src/core/establishment/infra/db/prisma/establishment-prisma.repository";
import { Event } from "../src/core/events/domain/event.aggregate";
import { EventPrismaRepository } from "../src/core/events/infra/db/prisma/event-prisma.repository";
import { Band } from "../src/core/musician/domain/band.aggregate";
import { Musician, MusicianId } from "../src/core/musician/domain/musician.aggregate";
import { BandPrismaRepository } from "../src/core/musician/infra/db/prisma/band-prisma.repository";
import { MusicianPrismaRepository } from "../src/core/musician/infra/db/prisma/musician-prisma.repository";
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
  role: "musician" | "audience";
};

// Cria os usuários e retorna o sub gerado por e-mail — o Keycloak (22+) ignora
// id explícito tanto no POST /users quanto no partialImport, então o fluxo é o
// mesmo do RegisterUseCase: cria no realm primeiro e o sub vira o id do
// aggregate. Usa o admin do master (mesmos defaults do scripts/keycloak-sync.mjs).
async function seedKeycloakUsers(
  users: KeycloakSeedUser[],
): Promise<Map<string, string>> {
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

  const admin = axios.create({
    baseURL: `${baseUrl}/admin/realms/${realm}`,
    headers: { Authorization: `Bearer ${token.access_token}` },
    timeout: 5000,
  });

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

  const musicianRepo = new MusicianPrismaRepository(prisma);
  const walletRepo = new MusicianWalletPrismaRepository(prisma);
  const subscriptionRepo = new SubscriptionPrismaRepository(prisma);
  const establishmentRepo = new EstablishmentPrismaRepository(prisma);
  const audienceRepo = new AudiencePrismaRepository(prisma);
  const eventRepo = new EventPrismaRepository(prisma);
  const availabilityRepo = new AvailabilityPrismaRepository(prisma);
  const bookingRepo = new BookingPrismaRepository(prisma);
  const inquiryRepo = new InquiryPrismaRepository(prisma);
  const requestRepo = new RequestPrismaRepository(prisma);
  const tipRepo = new TipPrismaRepository(prisma);
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

  // ── 0. Usuários Keycloak de teste (sub gerado vira o id do aggregate) ─────
  console.log("🔑 Usuários Keycloak de teste…");
  let keycloakSubs = new Map<string, string>();
  try {
    keycloakSubs = await seedKeycloakUsers([
      { email: "musico1@seed-soundmeet.com", name: "João Violão", role: "musician" },
      { email: "fa1@seed-soundmeet.com", name: "Ana Fã", role: "audience" },
    ]);
  } catch (error) {
    const message = axios.isAxiosError(error)
      ? `${error.response?.status ?? error.code}: ${JSON.stringify(error.response?.data ?? "")}`
      : (error as Error).message;
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
  }
  const [e1, e2] = establishments;

  // ── 3. Fãs (audience) ──────────────────────────────────────────────────────
  console.log("🙋 Fãs…");
  const fan1Builder = Audience.fake().aAudience()
    .withName("Ana Fã").withEmail("fa1@seed-soundmeet.com").withNickname("aninha");
  const fan1Sub = keycloakSubs.get("fa1@seed-soundmeet.com");
  if (fan1Sub) fan1Builder.withId(new AudienceId(fan1Sub));
  const fan1 = fan1Builder.build();
  const fan2 = Audience.fake().aTopFan()
    .withName("Bruno Superfã").withEmail("fa2@seed-soundmeet.com").withNickname("brunao").build();
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

  for (const booking of [bookingPending, bookingConfirmed, bookingCancelled, bookingCompleted]) {
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
  const tipSpecs = [
    { fan: fan1, status: "completed" as const, amount: 25 },
    { fan: fan2, status: "completed" as const, amount: 50 },
    { fan: fan1, status: "pending" as const, amount: 10 },
    { fan: fan2, status: "failed" as const, amount: 15 },
  ];
  for (const spec of tipSpecs) {
    const tip = Tip.fake().aTip()
      .withAudienceId(new Uuid(spec.fan.audience_id.id))
      .withMusicianId(new Uuid(m1.musician_id.id))
      .withEventId(new Uuid(evActive.event_id.id))
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
    { type: TransactionType.WITHDRAWAL, amount: 40, fee: 0, status: TransactionStatus.PENDING, fan: null },
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
  console.log("📚 Biblioteca e repertórios…");
  const librarySpecs = [
    { musician: m1, title: "Evidências", artist: "Chitãozinho & Xororó", genre: "Sertanejo", key: "G", bpm: 132 },
    { musician: m1, title: "Wonderwall", artist: "Oasis", genre: "Rock", key: "F#m", bpm: 87 },
    { musician: m1, title: "Garota de Ipanema", artist: "Tom Jobim", genre: "Bossa Nova", key: "F", bpm: 120 },
    { musician: m1, title: "Tempo Perdido", artist: "Legião Urbana", genre: "Rock", key: "D", bpm: 122 },
    { musician: musicians[2], title: "Fly Me to the Moon", artist: "Frank Sinatra", genre: "Jazz", key: "Am", bpm: 116 },
    { musician: musicians[2], title: "Águas de Março", artist: "Elis Regina", genre: "MPB", key: "Bb", bpm: 108 },
  ];
  const libraryItems: MusicLibrary[] = [];
  for (const spec of librarySpecs) {
    const item = MusicLibrary.fake().aMusicLibrary()
      .withMusicianId(new Uuid(spec.musician.musician_id.id))
      .withTitle(spec.title)
      .withArtist(spec.artist)
      .withGenre(spec.genre)
      .withKey(spec.key)
      .withBpm(spec.bpm)
      .withDifficulty(3)
      .build();
    await musicLibraryRepo.insert(item);
    libraryItems.push(item);
  }

  // m1 é FREE (máx. 1 repertório / 20 músicas) — 1 setlist dentro do limite;
  // m3 é PRO (ilimitado) — 1 setlist de jazz.
  const repertoireM1 = Repertoire.create({ musician_id: m1.musician_id.id, name: "Clássicos do Bar" });
  for (const item of libraryItems.slice(0, 3)) {
    repertoireM1.addSong(RepertoireSong.create({ music_library_id: item.music_library_id.id }));
  }
  await repertoireRepo.insert(repertoireM1);

  const repertoireM3 = Repertoire.create({ musician_id: musicians[2].musician_id.id, name: "Noite de Jazz" });
  for (const item of libraryItems.slice(4)) {
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

  console.log("\n✅ Seed concluído!");
  console.log(`   Músicos:          ${musicians.map((m) => `${m.stage_name} <${m.email.value}> (${m.musician_id.id})`).join("\n                     ")}`);
  console.log("   Opt-in de radar:  João=true, Maria=false, Carlos=null (ainda não decidiu)");
  console.log(`   Estabelecimentos: ${establishments.map((e) => e.name).join(", ")}`);
  console.log("   Bandas:           Carlão Trio (líder Carlos, open_to_gigs=true, com endereço) · Blues Duo (líder João, open_to_gigs=null, Maria pending / Carlos declined)");
  console.log(`   Fãs:              ${fan1.email.value}, ${fan2.email.value}`);
  if (keycloakSubs.size > 0) {
    console.log("   🔑 Logins de teste (POST /api/v1/auth/login):");
    console.log(`      músico: ${m1.email.value} / ${KEYCLOAK_SEED_PASSWORD}`);
    console.log(`      fã:     ${fan1.email.value} / ${KEYCLOAK_SEED_PASSWORD}`);
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
