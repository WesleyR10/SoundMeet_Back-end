import { UserPoints } from "../../../domain/user-points.aggregate";
import { UserPointsInMemoryRepository } from "../../../infra/db/in-memory/user-points-in-memory.repository";
import { ListUserPointsUseCase } from "./list-user-points.use-case";

describe("ListUserPointsUseCase Unit Tests", () => {
  let useCase: ListUserPointsUseCase;
  let repository: UserPointsInMemoryRepository;

  beforeEach(() => {
    repository = new UserPointsInMemoryRepository();
    useCase = new ListUserPointsUseCase(repository);
  });

  test("toOutput method", async () => {
    let result = await useCase.execute({});
    expect(result).toStrictEqual({
      items: [],
      total: 0,
      current_page: 1,
      per_page: 15,
      last_page: 0,
    });

    const entity = UserPoints.fake().aUserPoints().build();
    repository.items = [entity];

    result = await useCase.execute({});
    expect(result).toStrictEqual({
      items: [
        {
          id: entity.user_points_id.id,
          user_id: entity.user_id.id,
          total_points: entity.total_points,
          total_scans: entity.total_scans,
          total_requests: entity.total_requests,
          total_tips: entity.total_tips,
          total_social_shares: entity.total_social_shares,
          current_level: entity.current_level,
          level_info: entity.toJSON().level_info,
          progress_to_next_level: entity.toJSON().progress_to_next_level,
          is_top_fan: entity.toJSON().is_top_fan,
          is_active_supporter: entity.toJSON().is_active_supporter,
          created_at: entity.created_at,
          updated_at: entity.updated_at,
        },
      ],
      total: 1,
      current_page: 1,
      per_page: 15,
      last_page: 1,
    });
  });

  it("should return output using pagination, sort and filter", async () => {
    const entities = [
      UserPoints.fake()
        .aUserPoints()
        .withTotalPoints(100)
        .withCurrentLevel(1)
        .build(),
      UserPoints.fake()
        .aUserPoints()
        .withTotalPoints(200)
        .withCurrentLevel(2)
        .build(),
      UserPoints.fake()
        .aUserPoints()
        .withTotalPoints(300)
        .withCurrentLevel(3)
        .build(),
    ];
    repository.items = entities;

    const result = await useCase.execute({
      page: 1,
      per_page: 2,
      sort: "points",
      sort_dir: "asc",
      filter: { audienceId: entities[1].user_id.id },
    });

    expect(result).toStrictEqual({
      items: [
        {
          id: entities[1].user_points_id.id,
          user_id: entities[1].user_id.id,
          total_points: entities[1].total_points,
          total_scans: entities[1].total_scans,
          total_requests: entities[1].total_requests,
          total_tips: entities[1].total_tips,
          total_social_shares: entities[1].total_social_shares,
          current_level: entities[1].current_level,
          level_info: entities[1].toJSON().level_info,
          progress_to_next_level: entities[1].toJSON().progress_to_next_level,
          is_top_fan: entities[1].toJSON().is_top_fan,
          is_active_supporter: entities[1].toJSON().is_active_supporter,
          created_at: entities[1].created_at,
          updated_at: entities[1].updated_at,
        },
      ],
      total: 1,
      current_page: 1,
      per_page: 2,
      last_page: 1,
    });
  });
});
