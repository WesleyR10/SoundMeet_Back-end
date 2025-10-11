import { InvalidUuidError } from "../../../../../shared/domain/value-objects/uuid.vo";
import { UserPointsInMemoryRepository } from "../../../../infra/db/in-memory/user-points-in-memory.repository";
import { CreateUserPointsUseCase } from "../create-user-points.use-case";

describe("CreateUserPointsUseCase Unit Tests", () => {
  let useCase: CreateUserPointsUseCase;
  let repository: UserPointsInMemoryRepository;

  beforeEach(() => {
    repository = new UserPointsInMemoryRepository();
    useCase = new CreateUserPointsUseCase(repository);
  });

  it("should throw an error when aggregate is not valid", async () => {
    const input = {
      user_id: "invalid-uuid",
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      InvalidUuidError,
    );
  });

  it("should create a user points with minimal data", async () => {
    const spyInsert = jest.spyOn(repository, "insert");
    const input = {
      user_id: "550e8400-e29b-41d4-a716-446655440000",
    };

    const output = await useCase.execute(input);

    expect(spyInsert).toHaveBeenCalledTimes(1);
    expect(output).toStrictEqual({
      id: repository.items[0].user_points_id.id,
      user_id: input.user_id,
      total_points: 0,
      total_scans: 0,
      total_requests: 0,
      total_tips: 0,
      total_social_shares: 0,
      current_level: 1,
      level_info: {
        level: 1,
        name: "Novato",
        min_points: 0,
        max_points: 99,
        benefits: ["Acesso básico ao app"],
      },
      progress_to_next_level: 0,
      is_top_fan: false,
      is_active_supporter: false,
      created_at: repository.items[0].created_at,
      updated_at: repository.items[0].updated_at,
    });
  });

  it("should create a user points with complete data", async () => {
    const spyInsert = jest.spyOn(repository, "insert");
    const input = {
      user_id: "550e8400-e29b-41d4-a716-446655440000",
      total_points: 150,
      total_scans: 10,
      total_requests: 5,
      total_tips: 3,
      total_social_shares: 2,
      current_level: 2,
      is_active: true,
    };

    const output = await useCase.execute(input);

    expect(spyInsert).toHaveBeenCalledTimes(1);
    expect(output).toStrictEqual({
      id: repository.items[0].user_points_id.id,
      user_id: input.user_id,
      total_points: 150,
      total_scans: 10,
      total_requests: 5,
      total_tips: 3,
      total_social_shares: 2,
      current_level: 2,
      level_info: {
        level: 2,
        name: "Fã",
        min_points: 100,
        max_points: 299,
        benefits: [
          "Acesso básico ao app",
          "Badge de Fã",
          "Desconto de 5% em gorjetas",
        ],
      },
      progress_to_next_level: 25,
      is_top_fan: false,
      is_active_supporter: true,
      created_at: repository.items[0].created_at,
      updated_at: repository.items[0].updated_at,
    });
  });
});
