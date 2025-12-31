import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { UserPoints } from "../../../domain/user-points.aggregate";
import { InvalidUserLevelError } from "../../../domain/value-objects/user-level.vo";
import { UserPointsInMemoryRepository } from "../../../infra/db/in-memory/user-points-in-memory.repository";
import { UpdateUserPointsUseCase } from "./update-user-points.use-case";

describe("UpdateUserPointsUseCase Unit Tests", () => {
  let useCase: UpdateUserPointsUseCase;
  let repository: UserPointsInMemoryRepository;

  beforeEach(() => {
    repository = new UserPointsInMemoryRepository();
    useCase = new UpdateUserPointsUseCase(repository);
  });

  it("should throw error when entity not found", async () => {
    const input = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      total_points: 100,
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      new NotFoundError(input.id, UserPoints),
    );
  });

  it("should throw an error when entity is not valid", async () => {
    const entity = UserPoints.fake().aUserPoints().build();
    repository.items = [entity];

    const input = {
      id: entity.user_points_id.id,
      total_points: -1,
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      InvalidUserLevelError,
    );
  });

  it("should update a user points", async () => {
    const spyUpdate = jest.spyOn(repository, "update");
    const entity = UserPoints.fake().aUserPoints().asActiveSupporter().build();
    repository.items = [entity];

    const input = {
      id: entity.user_points_id.id,
      total_points: 200,
      total_scans: 15,
      current_level: 2,
    };

    const output = await useCase.execute(input);

    expect(spyUpdate).toHaveBeenCalledTimes(1);
    expect(output).toStrictEqual({
      id: entity.user_points_id.id,
      user_id: entity.user_id.id,
      total_points: 200,
      total_scans: 15,
      total_requests: entity.total_requests,
      total_tips: entity.total_tips,
      total_social_shares: entity.total_social_shares,
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
      progress_to_next_level: 50,
      is_top_fan: false,
      is_active_supporter: true,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    });
  });

  it("should activate and deactivate a user points", async () => {
    const entity = UserPoints.fake()
      .aUserPoints()
      .withTotalTips(5)
      .withTotalSocialShares(3)
      .build();
    repository.items = [entity];

    let input = {
      id: entity.user_points_id.id,
      is_active: false,
    };

    let output = await useCase.execute(input);
    // Verificar se a entidade foi desativada através do aggregate
    const updatedEntity = repository.items[0];
    expect(updatedEntity.is_active).toBe(false);

    input = {
      id: entity.user_points_id.id,
      is_active: true,
    };

    output = await useCase.execute(input);
    // Verificar se a entidade foi ativada através do aggregate
    const reactivatedEntity = repository.items[0];
    expect(reactivatedEntity.is_active).toBe(true);
  });
});
