import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import { QRCustomization } from "../../../../../shared/domain/value-objects/qr-code.vo";
import { InvalidUuidError } from "../../../../../shared/domain/value-objects/uuid.vo";
import { generateValidCnpj } from "../../../../../shared/infra/testing/cnpj.fixture";
import { Musician, MusicianId } from "../../../../domain/musician.aggregate";
import { MusicianInMemoryRepository } from "../../../../infra/db/in-memory/musician-in-memory.repository";
import { UpdateMusicianUseCase } from "../update-musician.use-case";

describe("UpdateMusicianUseCase Unit Tests", () => {
  let useCase: UpdateMusicianUseCase;
  let repository: MusicianInMemoryRepository;

  beforeEach(() => {
    repository = new MusicianInMemoryRepository();
    useCase = new UpdateMusicianUseCase(repository);
  });

  it("should throws error when entity not found", async () => {
    await expect(() =>
      useCase.execute({ id: "fake id", name: "fake" }),
    ).rejects.toThrow(new InvalidUuidError());

    const musicianId = new MusicianId();

    await expect(() =>
      useCase.execute({ id: musicianId.id, name: "fake" }),
    ).rejects.toThrow(new NotFoundError(musicianId.id, Musician));
  });

  it("should throw an error when aggregate is not valid", async () => {
    const aggregate = Musician.fake().aMusician().build();
    repository.items = [aggregate];
    await expect(() =>
      useCase.execute({
        id: aggregate.musician_id.id,
        name: "t".repeat(256),
      }),
    ).rejects.toThrow(EntityValidationError);
  });

  describe("cnpj (MEI)", () => {
    it("should set the cnpj of a musician who opened a MEI", async () => {
      const entity = Musician.fake().aMusician().build();
      repository.items = [entity];
      const cnpj = generateValidCnpj("112223330001");

      const output = await useCase.execute({ id: entity.musician_id.id, cnpj });

      expect(output.cnpj).toBe(cnpj);
    });

    it("should clear the cnpj when null is passed", async () => {
      const entity = Musician.fake()
        .aMusician()
        .withCnpj(generateValidCnpj("112223330001"))
        .build();
      repository.items = [entity];

      const output = await useCase.execute({
        id: entity.musician_id.id,
        cnpj: null,
      });

      expect(output.cnpj).toBeNull();
    });

    /*
     * `Musician.cnpj` é `@unique`. Sem esta checagem o Prisma estoura P2002 e o
     * músico recebe 500 em vez de saber que aquele MEI já está em outra conta —
     * o mesmo motivo pelo qual o e-mail já era verificado aqui.
     */
    it("should reject a cnpj already used by another musician", async () => {
      const cnpj = generateValidCnpj("112223330001");
      const owner = Musician.fake().aMusician().withCnpj(cnpj).build();
      const other = Musician.fake().aMusician().build();
      repository.items = [owner, other];

      await expect(() =>
        useCase.execute({ id: other.musician_id.id, cnpj }),
      ).rejects.toThrow(EntityValidationError);
    });

    it("should allow re-sending the same cnpj the musician already owns", async () => {
      const cnpj = generateValidCnpj("112223330001");
      const entity = Musician.fake().aMusician().withCnpj(cnpj).build();
      repository.items = [entity];

      const output = await useCase.execute({ id: entity.musician_id.id, cnpj });

      expect(output.cnpj).toBe(cnpj);
    });
  });

  it("should update a musician", async () => {
    const spyUpdate = jest.spyOn(repository, "update");
    const entity = Musician.fake().aMusician().build();
    repository.items = [entity];

    let output = await useCase.execute({
      id: entity.musician_id.id,
      name: "Updated Name",
    });
    expect(spyUpdate).toHaveBeenCalledTimes(1);
    expect(output).toStrictEqual({
      id: entity.musician_id.id,
      name: "Updated Name",
      stage_name: entity.stage_name,
      email: entity.email.value,
      phone: entity.phone?.value || null,
      cnpj: entity.cnpj?.value || null,
      bio: entity.bio,
      avatar: entity.avatar,
      presentation_audio: null,
      genres: entity.genres,
      instruments: entity.instruments,
      experience_years: entity.experience_years,
      rating: entity.rating.value,
      total_ratings: entity.total_ratings,
      is_active: entity.is_active,
      is_verified: entity.is_verified,
      open_to_gigs: entity.open_to_gigs,
      accepts_requests_outside_repertoire:
        entity.accepts_requests_outside_repertoire,
      profile: entity.profile?.toJSON() ?? null,
      qr_code: entity.qr_code!.code,
      qr_customization: entity.qr_code!.customization ?? null,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
      display_name: entity.displayName,
      is_experienced: entity.isExperienced,
      is_highly_rated: entity.isHighlyRated,
    });

    type Arrange = {
      input: {
        name?: string;
        stage_name?: string;
        email?: string;
        phone?: string;
        bio?: string;
        genres?: string[];
        instruments?: string[];
        experience_years?: number;
        is_active?: boolean;
        is_verified?: boolean;
      };
      expected: {
        name: string;
        stage_name: string | null;
        email: string;
        phone: string | null;
        cnpj: string | null;
        bio: string | null;
        avatar: string | null;
        genres: string[];
        instruments: string[];
        experience_years: number;
        rating: number;
        total_ratings: number;
        is_active: boolean;
        is_verified: boolean;
        qr_code: string;
        qr_customization: QRCustomization | null;
        created_at: Date;
        display_name: string;
        is_experienced: boolean;
        is_highly_rated: boolean;
      };
    };

    const arrange: Arrange[] = [
      {
        input: {
          stage_name: "New Stage Name",
        },
        expected: {
          name: entity.name,
          stage_name: "New Stage Name",
          email: entity.email.value,
          phone: entity.phone?.value || null,
          cnpj: entity.cnpj?.value || null,
          bio: entity.bio,
          avatar: entity.avatar,
          genres: entity.genres,
          instruments: entity.instruments,
          experience_years: entity.experience_years,
          rating: entity.rating.value,
          total_ratings: entity.total_ratings,
          is_active: entity.is_active,
          is_verified: entity.is_verified,
          qr_code: entity.qr_code!.code,
          qr_customization: entity.qr_code!.customization ?? null,
          created_at: entity.created_at,
          display_name: "New Stage Name",
          is_experienced: entity.isExperienced,
          is_highly_rated: entity.isHighlyRated,
        },
      },
      {
        input: {
          bio: "Updated bio",
        },
        expected: {
          name: entity.name,
          stage_name: "New Stage Name",
          email: entity.email.value,
          phone: entity.phone?.value || null,
          cnpj: entity.cnpj?.value || null,
          bio: "Updated bio",
          avatar: entity.avatar,
          genres: entity.genres,
          instruments: ["Piano", "Violin"],
          experience_years: entity.experience_years,
          rating: entity.rating.value,
          total_ratings: entity.total_ratings,
          is_active: entity.is_active,
          is_verified: entity.is_verified,
          qr_code: entity.qr_code!.code,
          qr_customization: entity.qr_code!.customization ?? null,
          created_at: entity.created_at,
          display_name: "New Stage Name",
          is_experienced: entity.isExperienced,
          is_highly_rated: entity.isHighlyRated,
        },
      },
      {
        input: {
          genres: ["Rock", "Blues"],
        },
        expected: {
          name: entity.name,
          stage_name: "New Stage Name",
          email: entity.email.value,
          phone: entity.phone?.value || null,
          cnpj: entity.cnpj?.value || null,
          bio: "Updated bio",
          avatar: entity.avatar,
          genres: ["Jazz", "Blues"],
          instruments: ["Piano", "Violin"],
          experience_years: entity.experience_years,
          rating: entity.rating.value,
          total_ratings: entity.total_ratings,
          is_active: entity.is_active,
          is_verified: entity.is_verified,
          qr_code: entity.qr_code!.code,
          qr_customization: entity.qr_code!.customization ?? null,
          created_at: entity.created_at,
          display_name: "New Stage Name",
          is_experienced: entity.isExperienced,
          is_highly_rated: entity.isHighlyRated,
        },
      },
      {
        input: {
          instruments: ["Piano", "Violin"],
        },
        expected: {
          name: entity.name,
          stage_name: "New Stage Name",
          email: entity.email.value,
          phone: entity.phone?.value || null,
          cnpj: entity.cnpj?.value || null,
          bio: "Updated bio",
          avatar: entity.avatar,
          genres: ["Jazz", "Blues"],
          instruments: entity.instruments,
          experience_years: entity.experience_years,
          rating: entity.rating.value,
          total_ratings: entity.total_ratings,
          is_active: entity.is_active,
          is_verified: entity.is_verified,
          qr_code: entity.qr_code!.code,
          qr_customization: entity.qr_code!.customization ?? null,
          created_at: entity.created_at,
          display_name: "New Stage Name",
          is_experienced: entity.isExperienced,
          is_highly_rated: entity.isHighlyRated,
        },
      },
      {
        input: {
          experience_years: 15,
        },
        expected: {
          name: entity.name,
          stage_name: "New Stage Name",
          email: entity.email.value,
          phone: entity.phone?.value || null,
          cnpj: entity.cnpj?.value || null,
          bio: "Updated bio",
          avatar: entity.avatar,
          genres: ["Jazz", "Blues"],
          instruments: entity.instruments,
          experience_years: 15,
          rating: entity.rating.value,
          total_ratings: entity.total_ratings,
          is_active: entity.is_active,
          is_verified: entity.is_verified,
          qr_code: entity.qr_code!.code,
          qr_customization: entity.qr_code!.customization ?? null,
          created_at: entity.created_at,
          display_name: "New Stage Name",
          is_experienced: entity.isExperienced,
          is_highly_rated: entity.isHighlyRated,
        },
      },
      {
        input: {
          is_active: false,
        },
        expected: {
          name: entity.name,
          stage_name: "New Stage Name",
          email: entity.email.value,
          phone: entity.phone?.value || null,
          cnpj: entity.cnpj?.value || null,
          bio: "Updated bio",
          avatar: entity.avatar,
          genres: ["Jazz", "Blues"],
          instruments: ["Guitar", "Drums"],
          experience_years: 15,
          rating: entity.rating.value,
          total_ratings: entity.total_ratings,
          is_active: false,
          is_verified: entity.is_verified,
          qr_code: entity.qr_code!.code,
          qr_customization: entity.qr_code!.customization ?? null,
          created_at: entity.created_at,
          display_name: "New Stage Name",
          is_experienced: entity.isExperienced,
          is_highly_rated: entity.isHighlyRated,
        },
      },
    ];

    for (const i of arrange) {
      // Create a fresh entity for each test case
      const freshEntity = Musician.fake().aMusician().build();
      repository.items = [freshEntity];

      output = await useCase.execute({
        id: freshEntity.musician_id.id,
        ...("name" in i.input && { name: i.input.name }),
        ...("stage_name" in i.input && { stage_name: i.input.stage_name }),
        ...("email" in i.input && { email: i.input.email }),
        ...("phone" in i.input && { phone: i.input.phone }),
        ...("bio" in i.input && { bio: i.input.bio }),
        ...("genres" in i.input && { genres: i.input.genres }),
        ...("instruments" in i.input && { instruments: i.input.instruments }),
        ...("experience_years" in i.input && {
          experience_years: i.input.experience_years,
        }),
        ...("is_active" in i.input && { is_active: i.input.is_active }),
        ...("is_verified" in i.input && { is_verified: i.input.is_verified }),
      });
      expect(output).toStrictEqual({
        id: freshEntity.musician_id.id,
        name: "name" in i.input ? i.input.name : freshEntity.name,
        stage_name:
          "stage_name" in i.input ? i.input.stage_name : freshEntity.stage_name,
        email: "email" in i.input ? i.input.email : freshEntity.email.value,
        phone:
          "phone" in i.input ? i.input.phone : freshEntity.phone?.value || null,
        cnpj: freshEntity.cnpj?.value || null,
        bio: "bio" in i.input ? i.input.bio : freshEntity.bio,
        avatar: freshEntity.avatar,
        presentation_audio: null,
        genres: "genres" in i.input ? i.input.genres : freshEntity.genres,
        instruments:
          "instruments" in i.input
            ? i.input.instruments
            : freshEntity.instruments,
        experience_years:
          "experience_years" in i.input
            ? i.input.experience_years
            : freshEntity.experience_years,
        rating: freshEntity.rating.value,
        total_ratings: freshEntity.total_ratings,
        is_active:
          "is_active" in i.input ? i.input.is_active : freshEntity.is_active,
        is_verified:
          "is_verified" in i.input
            ? i.input.is_verified
            : freshEntity.is_verified,
        open_to_gigs: freshEntity.open_to_gigs,
        accepts_requests_outside_repertoire:
          freshEntity.accepts_requests_outside_repertoire,
        profile: freshEntity.profile?.toJSON() ?? null,
        qr_code: freshEntity.qr_code!.code,
        qr_customization: freshEntity.qr_code!.customization ?? null,
        created_at: freshEntity.created_at,
        updated_at: freshEntity.updated_at,
        display_name:
          "stage_name" in i.input
            ? i.input.stage_name
            : freshEntity.stage_name || freshEntity.name,
        is_experienced: freshEntity.isExperienced,
        is_highly_rated: freshEntity.isHighlyRated,
      });
    }
  });
});
