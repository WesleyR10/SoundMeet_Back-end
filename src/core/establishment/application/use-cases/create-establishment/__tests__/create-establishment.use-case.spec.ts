import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import { PlanLimitExceededError } from "../../../../../plans/domain/errors/plan-limit-exceeded.error";
import { EstablishmentPlanTier } from "../../../../../plans/domain/plan-tier.enum";
import {
  Subscription,
  SubscriptionStatus,
} from "../../../../../plans/domain/subscription.aggregate";
import { PlanCheckService } from "../../../../../plans/domain/plan-check.service";
import { SubscriptionInMemoryRepository } from "../../../../../plans/infra/db/in-memory/subscription-in-memory.repository";
import { EstablishmentId } from "../../../../domain/establishment.aggregate";
import { EstablishmentInMemoryRepository } from "../../../../infra/db/in-memory/establishment-in-memory.repository";
import { CreateEstablishmentInput } from "../create-establishment.input";
import { CreateEstablishmentUseCase } from "../create-establishment.use-case";

describe("CreateEstablishmentUseCase Unit Tests", () => {
  let useCase: CreateEstablishmentUseCase;
  let repository: EstablishmentInMemoryRepository;

  beforeEach(() => {
    repository = new EstablishmentInMemoryRepository();
    useCase = new CreateEstablishmentUseCase(repository);
  });

  it("should throw an error when aggregate is not valid", async () => {
    const input: CreateEstablishmentInput = {
      name: "t".repeat(256),
      email: "invalid-email",
      cnpj: "12.345.678/0001-90",
      phone: "+5500000000000",
      establishment_type: "bar",
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      EntityValidationError,
    );
  });

  describe("should create an establishment", () => {
    const arrange: Array<{
      input: CreateEstablishmentInput;
      expected: {
        name: string;
        email: string;
        cnpj: { formatted: string; value: string };
        description: string | null;
        avatar: string | null;
        phone: string;
        establishment_type: string;
        website: string | null;
        rating: number;
        is_active: boolean;
        is_verified: boolean;
      };
    }> = [
      {
        input: {
          name: "Test Bar",
          email: "test@bar.com",
          phone: "+5511999999999",
          establishment_type: "bar",
          cnpj: "11.222.333/0001-81",
        },
        expected: {
          name: "Test Bar",
          email: "test@bar.com",
          cnpj: {
            formatted: "11.222.333/0001-81",
            value: "11222333000181",
          },
          description: null,
          avatar: null,
          phone: "+5511999999999",
          establishment_type: "bar",
          website: null,
          rating: 0,
          is_active: true,
          is_verified: false,
        },
      },
      {
        input: {
          name: "Rock Club",
          email: "contact@rockclub.com",
          cnpj: "12.345.678/0001-95",
          description: "The best rock club in town",
          avatar: "https://example.com/avatar.jpg",
          phone: "+5511999999999",
          establishment_type: "club",
          website: "https://rockclub.com",
          is_active: false,
        },
        expected: {
          name: "Rock Club",
          email: "contact@rockclub.com",
          cnpj: {
            formatted: "12.345.678/0001-95",
            value: "12345678000195",
          },
          description: "The best rock club in town",
          avatar: "https://example.com/avatar.jpg",
          phone: "+5511999999999",
          establishment_type: "club",
          website: "https://rockclub.com",
          rating: 0,
          is_active: false,
          is_verified: false,
        },
      },
    ];

    test.each(arrange)("when input is $input", async ({ input, expected }) => {
      const output = await useCase.execute(input);
      expect(output).toMatchObject({
        id: expect.any(String),
        name: expected.name,
        email: expected.email,
        cnpj: expected.cnpj,
        description: expected.description,
        avatar: expected.avatar,
        phone: expected.phone,
        establishment_type: expected.establishment_type,
        website: expected.website,
        rating: expected.rating,
        is_active: expected.is_active,
        is_verified: expected.is_verified,
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      });
    });
  });

  it("should create an establishment successfully", async () => {
    const input: CreateEstablishmentInput = {
      name: "QR Bar",
      email: "qr@bar.com",
      phone: "+5511999999999",
      establishment_type: "bar",
      cnpj: "11.111.111/0001-91",
    };

    const output = await useCase.execute(input);

    expect(output.id).toBeDefined();
    expect(output.name).toBe(input.name);
    expect(output.email).toBe(input.email);
  });

  it("should save the establishment in the repository", async () => {
    const input: CreateEstablishmentInput = {
      name: "Save Test Bar",
      email: "save@test.com",
      phone: "+5511888888888",
      establishment_type: "restaurant",
      cnpj: "11.222.333/0001-81",
    };

    const output = await useCase.execute(input);
    const savedEstablishment = await repository.findById(
      new EstablishmentId(output.id),
    );

    expect(savedEstablishment).toBeDefined();
    expect(savedEstablishment!.name).toBe(input.name);
    expect(savedEstablishment!.email.value).toBe(input.email);
    expect(savedEstablishment!.cnpj?.value).toBe("11222333000181");
  });

  it("should handle validation errors properly", async () => {
    const input: CreateEstablishmentInput = {
      name: "",
      email: "invalid-email",
      cnpj: "",
      phone: "+5500000000000",
      establishment_type: "bar",
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      EntityValidationError,
    );
  });
});

// ----------------------------------------------------------------
// Gate 4C.7 — multi_establishment
// ----------------------------------------------------------------
describe("CreateEstablishmentUseCase — gate 4C.7 (multi_establishment)", () => {
  const EXISTING_ID = "00000000-0000-0000-0000-000000000055";

  const baseInput: CreateEstablishmentInput = {
    name: "Bar do Wesley",
    email: "bar2@soundmeet.app",
    establishment_type: "bar",
    existing_establishment_ids: [EXISTING_ID],
  };

  function makeSubscription(tier: EstablishmentPlanTier, status = SubscriptionStatus.ACTIVE) {
    return new Subscription({
      establishment_id: EXISTING_ID,
      plan_tier: tier,
      persona: "establishment",
      status,
    });
  }

  async function setupWithPlan(tier?: EstablishmentPlanTier, cancelled = false) {
    const establishmentRepo = new EstablishmentInMemoryRepository();
    const subRepo = new SubscriptionInMemoryRepository();

    if (tier) {
      await subRepo.insert(
        makeSubscription(
          tier,
          cancelled ? SubscriptionStatus.CANCELLED : SubscriptionStatus.ACTIVE,
        ),
      );
    }

    const planCheckService = new PlanCheckService(subRepo);
    return new CreateEstablishmentUseCase(establishmentRepo, planCheckService);
  }

  it("(a) FREE: lança PlanLimitExceededError ao tentar 2º estabelecimento", async () => {
    const useCase = await setupWithPlan();
    await expect(useCase.execute(baseInput)).rejects.toThrow(PlanLimitExceededError);
  });

  it("(b) PRO: cria 2º estabelecimento com sucesso", async () => {
    const useCase = await setupWithPlan(EstablishmentPlanTier.PRO);
    const output = await useCase.execute(baseInput);
    expect(output.id).toBeDefined();
  });

  it("(c) subscription cancelada comporta-se como FREE", async () => {
    const useCase = await setupWithPlan(EstablishmentPlanTier.PRO, true);
    await expect(useCase.execute(baseInput)).rejects.toThrow(PlanLimitExceededError);
  });

  it("hard-limit: 3 estabelecimentos existentes lança erro independente do plano", async () => {
    const establishmentRepo = new EstablishmentInMemoryRepository();
    const useCase = new CreateEstablishmentUseCase(establishmentRepo);
    const input: CreateEstablishmentInput = {
      ...baseInput,
      existing_establishment_ids: [
        "00000000-0000-0000-0000-000000000001",
        "00000000-0000-0000-0000-000000000002",
        "00000000-0000-0000-0000-000000000003",
      ],
    };
    await expect(useCase.execute(input)).rejects.toThrow(EntityValidationError);
  });
});
