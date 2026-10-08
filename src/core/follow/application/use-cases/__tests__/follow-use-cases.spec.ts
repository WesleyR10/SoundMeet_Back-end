import { Establishment } from "../../../../establishment/domain/establishment.aggregate";
import { EstablishmentInMemoryRepository } from "../../../../establishment/infra/db/in-memory/establishment-in-memory.repository";
import {
  Musician,
  MusicianId,
} from "../../../../musician/domain/musician.aggregate";
import { MusicianInMemoryRepository } from "../../../../musician/infra/db/in-memory/musician-in-memory.repository";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import { FollowInMemoryRepository } from "../../../infra/db/in-memory/follow-in-memory.repository";
import { FollowTargetReader } from "../common/follow-target-reader";
import { FollowTargetUseCase } from "../follow-target/follow-target.use-case";
import { GetFollowSummaryUseCase } from "../get-follow-summary/get-follow-summary.use-case";
import { ListMyFollowsUseCase } from "../list-my-follows/list-my-follows.use-case";
import { ToggleFollowNotificationsUseCase } from "../toggle-follow-notifications/toggle-follow-notifications.use-case";
import { UnfollowTargetUseCase } from "../unfollow-target/unfollow-target.use-case";

describe("Follow use cases", () => {
  let followRepo: FollowInMemoryRepository;
  let musicianRepo: MusicianInMemoryRepository;
  let establishmentRepo: EstablishmentInMemoryRepository;
  let follow: FollowTargetUseCase;
  const fan = new Uuid().id;

  const addMusician = async (open_to_gigs: boolean | null, active = true) => {
    const builder = Musician.fake()
      .aMusician()
      .withStageName("Ana Lua")
      .withOpenToGigs(open_to_gigs);
    const musician = (
      active ? builder.activate() : builder.deactivate()
    ).build();
    await musicianRepo.insert(musician);
    return musician.musician_id.id;
  };

  const addVenue = async (active = true) => {
    const venue = Establishment.fake()
      .anEstablishment()
      .withName("Bar do Zé")
      .withIsActive(active)
      .build();
    await establishmentRepo.insert(venue);
    return venue.establishment_id.id;
  };

  beforeEach(() => {
    followRepo = new FollowInMemoryRepository();
    musicianRepo = new MusicianInMemoryRepository();
    establishmentRepo = new EstablishmentInMemoryRepository();
    follow = new FollowTargetUseCase(
      followRepo,
      new FollowTargetReader(musicianRepo, establishmentRepo),
    );
  });

  describe("seguir", () => {
    it("segue músico aberto a contratações", async () => {
      const musicianId = await addMusician(true);

      const output = await follow.execute({
        audience_id: fan,
        target_type: "musician",
        target_id: musicianId,
      });

      expect(output.target_id).toBe(musicianId);
      expect(
        await followRepo.countByTarget({
          target_type: "musician",
          target_id: musicianId,
        }),
      ).toBe(1);
    });

    it.each([
      ["fechado a contratações", false],
      ["sem resposta sobre contratações (null)", null],
    ])(
      "🔴 não deixa seguir músico %s — mesma regra da busca",
      async (_, open) => {
        const musicianId = await addMusician(open as boolean | null);

        await expect(
          follow.execute({
            audience_id: fan,
            target_type: "musician",
            target_id: musicianId,
          }),
        ).rejects.toThrow(NotFoundError);
      },
    );

    it("não deixa seguir músico inativo nem casa inativa", async () => {
      const musicianId = await addMusician(true, false);
      const venueId = await addVenue(false);

      await expect(
        follow.execute({
          audience_id: fan,
          target_type: "musician",
          target_id: musicianId,
        }),
      ).rejects.toThrow(NotFoundError);
      await expect(
        follow.execute({
          audience_id: fan,
          target_type: "establishment",
          target_id: venueId,
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it("é idempotente: seguir de novo devolve o mesmo vínculo", async () => {
      const venueId = await addVenue();
      const input = {
        audience_id: fan,
        target_type: "establishment" as const,
        target_id: venueId,
      };

      const first = await follow.execute(input);
      const second = await follow.execute(input);

      expect(second.id).toBe(first.id);
      expect(followRepo.items).toHaveLength(1);
    });
  });

  describe("posse do vínculo", () => {
    it("🔴 não desfaz nem altera o follow de OUTRO fã", async () => {
      const venueId = await addVenue();
      const mine = await follow.execute({
        audience_id: fan,
        target_type: "establishment",
        target_id: venueId,
      });
      const intruder = new Uuid().id;

      await expect(
        new UnfollowTargetUseCase(followRepo).execute({
          audience_id: intruder,
          follow_id: mine.id,
        }),
      ).rejects.toThrow(NotFoundError);
      await expect(
        new ToggleFollowNotificationsUseCase(followRepo).execute({
          audience_id: intruder,
          follow_id: mine.id,
          enabled: false,
        }),
      ).rejects.toThrow(NotFoundError);
      expect(followRepo.items).toHaveLength(1);
      expect(followRepo.items[0].notifications_enabled).toBe(true);
    });

    it("o dono desfaz e desliga avisos", async () => {
      const venueId = await addVenue();
      const mine = await follow.execute({
        audience_id: fan,
        target_type: "establishment",
        target_id: venueId,
      });

      const toggled = await new ToggleFollowNotificationsUseCase(
        followRepo,
      ).execute({
        audience_id: fan,
        follow_id: mine.id,
        enabled: false,
      });
      expect(toggled.notifications_enabled).toBe(false);

      await new UnfollowTargetUseCase(followRepo).execute({
        audience_id: fan,
        follow_id: mine.id,
      });
      expect(followRepo.items).toHaveLength(0);
    });
  });

  describe("listar e resumir", () => {
    it("lista só os vínculos do fã, com nome do alvo; alvo oculto volta `null`", async () => {
      const visible = await addMusician(true);
      const hiddenLater = await addMusician(true);
      const venueId = await addVenue();
      await follow.execute({
        audience_id: fan,
        target_type: "musician",
        target_id: visible,
      });
      await follow.execute({
        audience_id: fan,
        target_type: "musician",
        target_id: hiddenLater,
      });
      await follow.execute({
        audience_id: new Uuid().id,
        target_type: "establishment",
        target_id: venueId,
      });

      const musician = await musicianRepo.findById(new MusicianId(hiddenLater));
      musician!.setOpenToGigs(false);
      await musicianRepo.update(musician!);

      const output = await new ListMyFollowsUseCase(
        followRepo,
        new FollowTargetReader(musicianRepo, establishmentRepo),
      ).execute({ audience_id: fan });

      expect(output.total).toBe(2);
      const byId = new Map(output.items.map((i) => [i.target_id, i.target]));
      expect(byId.get(visible)?.name).toBe("Ana Lua");
      expect(byId.get(hiddenLater)).toBeNull();
    });

    it("resumo: contagem + estado do botão de quem pergunta", async () => {
      const venueId = await addVenue();
      const mine = await follow.execute({
        audience_id: fan,
        target_type: "establishment",
        target_id: venueId,
      });
      await follow.execute({
        audience_id: new Uuid().id,
        target_type: "establishment",
        target_id: venueId,
      });

      const summary = new GetFollowSummaryUseCase(followRepo);
      const asFan = await summary.execute({
        target_type: "establishment",
        target_id: venueId,
        audience_id: fan,
      });
      const asOwner = await summary.execute({
        target_type: "establishment",
        target_id: venueId,
      });

      expect(asFan).toMatchObject({
        followers_count: 2,
        is_following: true,
        follow_id: mine.id,
      });
      expect(asOwner).toMatchObject({
        followers_count: 2,
        is_following: false,
        follow_id: null,
      });
    });
  });
});
