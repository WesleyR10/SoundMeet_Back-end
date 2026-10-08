import { Audience } from "../../../../../audience/domain/audience.aggregate";
import { AudienceInMemoryRepository } from "../../../../../audience/infra/db/in-memory/audience-in-memory.repository";
import { UserPoints } from "../../../../domain/user-points.aggregate";
import { UserPointsInMemoryRepository } from "../../../../infra/db/in-memory/user-points-in-memory.repository";
import { GetLeaderboardUseCase } from "../get-leaderboard.use-case";

describe("GetLeaderboardUseCase Unit Tests", () => {
  let userPointsRepo: UserPointsInMemoryRepository;
  let audienceRepo: AudienceInMemoryRepository;
  let useCase: GetLeaderboardUseCase;

  beforeEach(() => {
    audienceRepo = new AudienceInMemoryRepository();
    userPointsRepo = new UserPointsInMemoryRepository(audienceRepo);
    useCase = new GetLeaderboardUseCase(userPointsRepo);
  });

  it("retorna o ranking com nickname/avatar resolvidos — leaderboard deixa de ser anônimo", async () => {
    const fan = Audience.fake()
      .aAudience()
      .withNickname("Fã Nº1")
      .withAvatar("https://cdn.soundmeet.com.br/avatars/fan1.png")
      .build();
    await audienceRepo.insert(fan);

    const points = UserPoints.fake()
      .aUserPoints()
      .withUserId(fan.audience_id)
      .withTotalPoints(500)
      .build();
    await userPointsRepo.insert(points);

    const [entry] = await useCase.execute({ limit: 10 });

    expect(entry.nickname).toBe("Fã Nº1");
    expect(entry.avatar).toBe("https://cdn.soundmeet.com.br/avatars/fan1.png");
    expect(entry.total_points).toBe(500);
  });

  it("nickname/avatar vêm null quando o fã não preencheu (nunca quebra o ranking)", async () => {
    const fan = Audience.fake()
      .aAudience()
      .withNickname(null)
      .withAvatar(null)
      .build();
    await audienceRepo.insert(fan);

    const points = UserPoints.fake()
      .aUserPoints()
      .withUserId(fan.audience_id)
      .withTotalPoints(200)
      .build();
    await userPointsRepo.insert(points);

    const [entry] = await useCase.execute({ limit: 10 });

    expect(entry.nickname).toBeNull();
    expect(entry.avatar).toBeNull();
  });

  it("ordena por total_points desc, respeitando o limit", async () => {
    for (const total of [100, 900, 500]) {
      const fan = Audience.fake().aAudience().build();
      await audienceRepo.insert(fan);
      await userPointsRepo.insert(
        UserPoints.fake()
          .aUserPoints()
          .withUserId(fan.audience_id)
          .withTotalPoints(total)
          .build(),
      );
    }

    const result = await useCase.execute({ limit: 2 });

    expect(result).toHaveLength(2);
    expect(result[0].total_points).toBe(900);
    expect(result[1].total_points).toBe(500);
  });

  it("sem audienceRepo injetado, degrada pra nickname/avatar null em vez de lançar", async () => {
    const repoSemAudience = new UserPointsInMemoryRepository();
    const useCaseSemAudience = new GetLeaderboardUseCase(repoSemAudience);
    const fan = Audience.fake().aAudience().build();
    await repoSemAudience.insert(
      UserPoints.fake()
        .aUserPoints()
        .withUserId(fan.audience_id)
        .withTotalPoints(300)
        .build(),
    );

    const [entry] = await useCaseSemAudience.execute({ limit: 10 });

    expect(entry.nickname).toBeNull();
    expect(entry.avatar).toBeNull();
    expect(entry.total_points).toBe(300);
  });
});
