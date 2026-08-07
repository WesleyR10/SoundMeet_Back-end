import { ForbiddenException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";

import { ReviewEligibilityService } from "../../../core/review/application/services/review-eligibility.service";
import { ListReviewsUseCase } from "../../../core/review/application/use-cases/list-reviews/list-reviews.use-case";
import { SubmitReviewUseCase } from "../../../core/review/application/use-cases/submit-review/submit-review.use-case";
import { AuthenticatedUser } from "../../auth-module/interfaces/authenticated-user.interface";
import { PrismaService } from "../../database-module/prisma/prisma.service";
import { applyAuthGuardMocks } from "../../shared-module/testing/auth-guard-mock";
import { EstablishmentRatingsController } from "../establishment-ratings.controller";
import { MusicianRatingsController } from "../musician-ratings.controller";
import { resolveReviewAuthor } from "../review-author.resolver";
import { REVIEWS_PROVIDERS } from "../reviews.providers";

const FAN: AuthenticatedUser = {
  userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  roles: ["audience"],
  establishmentIds: [],
  bandIds: [],
  isAdmin: false,
};

const MUSICIAN: AuthenticatedUser = {
  userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  roles: ["musician"],
  establishmentIds: [],
  bandIds: [],
  isAdmin: false,
};

const OWNER_ONE: AuthenticatedUser = {
  userId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  roles: ["establishment"],
  establishmentIds: ["11111111-1111-4111-8111-111111111111"],
  bandIds: [],
  isAdmin: false,
};

const OWNER_MANY: AuthenticatedUser = {
  ...OWNER_ONE,
  establishmentIds: [
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
  ],
};

describe("resolveReviewAuthor — autor vem do token, nunca do corpo", () => {
  it("contexto de evento resolve o fã pelo sub", () => {
    expect(
      resolveReviewAuthor({
        user: FAN,
        context_type: "event",
        bookingAuthorType: "establishment",
      }),
    ).toEqual({ author_type: "audience", author_id: FAN.userId });
  });

  it("recusa avaliar por evento sem conta de fã", () => {
    expect(() =>
      resolveReviewAuthor({
        user: OWNER_ONE,
        context_type: "event",
        bookingAuthorType: "establishment",
      }),
    ).toThrow(ForbiddenException);
  });

  // Musician.id === sub (invariante do Bloco 4E) — por isso o sub serve aqui.
  it("contexto de reserva resolve o músico pelo sub", () => {
    expect(
      resolveReviewAuthor({
        user: MUSICIAN,
        context_type: "booking",
        bookingAuthorType: "musician",
      }),
    ).toEqual({ author_type: "musician", author_id: MUSICIAN.userId });
  });

  // A assimetria que mais confunde: o estabelecimento NÃO é o sub.
  it("estabelecimento usa o claim establishment_ids, não o sub", () => {
    const resolved = resolveReviewAuthor({
      user: OWNER_ONE,
      context_type: "booking",
      bookingAuthorType: "establishment",
    });

    expect(resolved.author_id).toBe(OWNER_ONE.establishmentIds[0]);
    expect(resolved.author_id).not.toBe(OWNER_ONE.userId);
  });

  it("recusa assinar por estabelecimento que a conta não opera", () => {
    expect(() =>
      resolveReviewAuthor({
        user: OWNER_ONE,
        context_type: "booking",
        bookingAuthorType: "establishment",
        author_establishment_id: "99999999-9999-4999-8999-999999999999",
      }),
    ).toThrow(/não opera/);
  });

  // Adivinhar qual unidade assina seria escolher errado em silêncio.
  it("exige author_establishment_id quando a conta opera mais de um", () => {
    expect(() =>
      resolveReviewAuthor({
        user: OWNER_MANY,
        context_type: "booking",
        bookingAuthorType: "establishment",
      }),
    ).toThrow(/mais de um estabelecimento/);
  });

  it("aceita o id informado quando o token comprova a posse", () => {
    const resolved = resolveReviewAuthor({
      user: OWNER_MANY,
      context_type: "booking",
      bookingAuthorType: "establishment",
      author_establishment_id: OWNER_MANY.establishmentIds[1],
    });

    expect(resolved.author_id).toBe(OWNER_MANY.establishmentIds[1]);
  });

  it("orienta a atualizar o token quando o claim ainda não chegou", () => {
    expect(() =>
      resolveReviewAuthor({
        user: { ...OWNER_ONE, establishmentIds: [] },
        context_type: "booking",
        bookingAuthorType: "establishment",
      }),
    ).toThrow(/atualize o token/);
  });
});

describe("ReviewsModule — Smoke Test (DI wiring)", () => {
  let module: TestingModule;

  beforeAll(async () => {
    const builder = Test.createTestingModule({
      controllers: [MusicianRatingsController, EstablishmentRatingsController],
      providers: [
        ...Object.values(REVIEWS_PROVIDERS.REPOSITORIES),
        ...Object.values(REVIEWS_PROVIDERS.SERVICES),
        ...Object.values(REVIEWS_PROVIDERS.USE_CASES),
        { provide: PrismaService, useValue: {} },
        { provide: "BookingRepository", useValue: {} },
        { provide: "EventAttendeeRepository", useValue: {} },
        { provide: "EventRepository", useValue: {} },
        { provide: "EventMusicianRepository", useValue: {} },
        { provide: "MusicianRepository", useValue: {} },
        { provide: "EstablishmentRepository", useValue: {} },
      ],
    });

    module = await applyAuthGuardMocks(builder).compile();
  });

  afterAll(async () => {
    await module?.close();
  });

  it("resolve os dois controllers", () => {
    expect(module.get(MusicianRatingsController)).toBeDefined();
    expect(module.get(EstablishmentRatingsController)).toBeDefined();
  });

  it("resolve use cases e o serviço de elegibilidade", () => {
    expect(module.get(SubmitReviewUseCase)).toBeInstanceOf(SubmitReviewUseCase);
    expect(module.get(ListReviewsUseCase)).toBeInstanceOf(ListReviewsUseCase);
    expect(module.get(ReviewEligibilityService)).toBeInstanceOf(
      ReviewEligibilityService,
    );
  });
});
