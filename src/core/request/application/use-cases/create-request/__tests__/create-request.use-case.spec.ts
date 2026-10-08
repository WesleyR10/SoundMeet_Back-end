import { Audience, AudienceId } from "@core/audience/domain";
import { AudienceInMemoryRepository } from "@core/audience/infra/db/in-memory/audience-in-memory.repository";
import { Event, EventId, PresenceVerifier } from "@core/events/domain";
import { EventInMemoryRepository } from "@core/events/infra/db/in-memory";
import { VenueLocationInMemoryAdapter } from "@core/events/infra/venue-location";
import { Musician, MusicianId } from "@core/musician/domain";
import { MusicianInMemoryRepository } from "@core/musician/infra/db/in-memory/musician-in-memory.repository";

import { FakeClock } from "../../../../../shared/application/clock.interface";
import { InvalidArgumentError } from "../../../../../shared/domain/errors/invalid-argument.error";
import { InvalidOperationError } from "../../../../../shared/domain/errors/invalid-operation.error";
import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { InvalidUuidError } from "../../../../../shared/domain/value-objects/uuid.vo";
import { IRepertoireMembershipPort } from "../../../../domain/ports/repertoire-membership.port";
import { Request, RequestId } from "../../../../domain/request.aggregate";
import { RequestInMemoryRepository } from "../../../../infra/db/in-memory/request-in-memory.repository";
import { CreateRequestInput } from "../create-request.input";
import { CreateRequestUseCase } from "../create-request.use-case";

describe("CreateRequestUseCase Unit Tests", () => {
  let useCase: CreateRequestUseCase;
  let repository: RequestInMemoryRepository;
  let eventRepository: EventInMemoryRepository;
  let musicianRepository: MusicianInMemoryRepository;
  let audienceRepository: AudienceInMemoryRepository;
  let repertoireMembership: IRepertoireMembershipPort;
  // Sem coordenada cadastrada por padrão (`venue_without_coords`, aceito):
  // os testes anteriores à verificação de presença continuam exercitando só
  // as regras deles. O bloco "presença no show" cadastra a casa.
  let venueLocation: VenueLocationInMemoryAdapter;
  let ownedLibraryIds: Set<string>;
  const now = new Date("2026-01-01T10:00:00.000Z");
  const clock = new FakeClock(now);

  const setupEventWithMusicians = async (
    eventId: string,
    musicianIds: string[],
  ) => {
    const now = clock.now();
    const event = new Event({
      event_id: new EventId(eventId),
      establishment_id: new Uuid(),
      name: "Event",
      start_at: now,
      end_at: new Date(now.getTime() + 60 * 60 * 1000),
      status: "active",
    });
    await eventRepository.insert(event);

    for (const musicianId of musicianIds) {
      const musician = Musician.create({
        musician_id: new MusicianId(musicianId),
        email: `${musicianId}@soundmeet.test`,
        name: `Musician ${musicianId}`,
        genres: ["rock"],
        instruments: ["guitar"],
      });
      await musicianRepository.insert(musician);
      await eventRepository.addPerformer(new EventId(eventId), {
        musician_id: musicianId,
      });
    }
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
    repository = new RequestInMemoryRepository();
    eventRepository = new EventInMemoryRepository();
    musicianRepository = new MusicianInMemoryRepository();
    audienceRepository = new AudienceInMemoryRepository();
    // Porta de repertório: por padrão, toda linha citada é do músico. Os
    // testes que exercitam a restrição sobrescrevem `ownedLibraryIds`.
    ownedLibraryIds = new Set<string>();
    repertoireMembership = {
      belongsToMusician: async (library_id: string) =>
        ownedLibraryIds.has(library_id),
    };
    venueLocation = new VenueLocationInMemoryAdapter();
    useCase = new CreateRequestUseCase(
      repository,
      eventRepository,
      musicianRepository,
      audienceRepository,
      repertoireMembership,
      venueLocation,
      new PresenceVerifier(),
      10,
      120,
      clock,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should throw an error when aggregate is not valid", async () => {
    const input: CreateRequestInput = {
      event_id: "invalid-uuid",
      audience_id: "invalid-uuid",
      musician_id: "invalid-uuid",
      song_title: "",
      artist: "Test Artist",
      message: "Test message",
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      InvalidUuidError,
    );
  });

  test.each([
    {
      scenario: "daily limit is exceeded",
      arrange: async () => {
        const eventId = new Uuid().id;
        const audienceId = new Uuid().id;
        const musicianId = new Uuid().id;

        await setupEventWithMusicians(eventId, [musicianId]);
        await audienceRepository.insert(
          new Audience({
            audience_id: new AudienceId(audienceId),
            email: `${audienceId}@soundmeet.test`,
            name: "Audience",
            is_active: true,
          }),
        );
        await eventRepository.addAttendee(new EventId(eventId), audienceId);

        for (let i = 0; i < 10; i++) {
          const request = new Request({
            event_id: eventId,
            audience_id: audienceId,
            musician_id: new Uuid().id,
            song_title: `Song ${i}`,
            artist: "Artist",
            message: "Message",
            created_at: clock.now(),
          });
          await repository.insert(request);
        }

        return {
          event_id: eventId,
          audience_id: audienceId,
          musician_id: musicianId,
          song_title: "New Song",
          artist: "New Artist",
          message: "New message",
        };
      },
    },
    {
      scenario: "pending request exists for same musician",
      arrange: async () => {
        const eventId = new Uuid().id;
        const audienceId = new Uuid().id;
        const musicianId = new Uuid().id;

        await setupEventWithMusicians(eventId, [musicianId]);
        await audienceRepository.insert(
          new Audience({
            audience_id: new AudienceId(audienceId),
            email: `${audienceId}@soundmeet.test`,
            name: "Audience",
            is_active: true,
          }),
        );
        await eventRepository.addAttendee(new EventId(eventId), audienceId);

        await repository.insert(
          Request.create({
            event_id: eventId,
            audience_id: audienceId,
            musician_id: musicianId,
            song_title: "Existing Song",
            artist: "Existing Artist",
            message: "Existing message",
          }),
        );

        return {
          event_id: eventId,
          audience_id: audienceId,
          musician_id: musicianId,
          song_title: "New Song",
          artist: "New Artist",
          message: "New message",
        };
      },
    },
    {
      scenario: "similar recent request exists for same musician",
      arrange: async () => {
        const eventId = new Uuid().id;
        const audienceId = new Uuid().id;
        const musicianId = new Uuid().id;
        const songTitle = "Same Song";

        await setupEventWithMusicians(eventId, [musicianId]);
        await audienceRepository.insert(
          new Audience({
            audience_id: new AudienceId(audienceId),
            email: `${audienceId}@soundmeet.test`,
            name: "Audience",
            is_active: true,
          }),
        );
        await eventRepository.addAttendee(new EventId(eventId), audienceId);

        await repository.insert(
          new Request({
            event_id: eventId,
            audience_id: audienceId,
            musician_id: musicianId,
            song_title: songTitle,
            artist: "Same Artist",
            message: "Message",
            created_at: now,
          }),
        );

        return {
          event_id: eventId,
          audience_id: audienceId,
          musician_id: musicianId,
          song_title: songTitle,
          artist: "Same Artist",
          message: "New message",
        };
      },
    },
  ])(
    "should throw EntityValidationError when $scenario",
    async ({ arrange }) => {
      const input = await arrange();
      await expect(() => useCase.execute(input)).rejects.toThrow(
        EntityValidationError,
      );
    },
  );

  it("should allow similar request for a different musician in the last 2 hours", async () => {
    const eventId = new Uuid().id;
    const audienceId = new Uuid().id;
    const musicianId = new Uuid().id;
    const songTitle = "Same Song";
    const differentMusicianId = new Uuid().id;

    await setupEventWithMusicians(eventId, [musicianId, differentMusicianId]);
    await audienceRepository.insert(
      new Audience({
        audience_id: new AudienceId(audienceId),
        email: `${audienceId}@soundmeet.test`,
        name: "Audience",
        is_active: true,
      }),
    );
    await eventRepository.addAttendee(new EventId(eventId), audienceId);

    // Create a recent request with the same song for one musician
    const existingRequest = new Request({
      event_id: eventId,
      audience_id: audienceId,
      musician_id: musicianId,
      song_title: songTitle,
      artist: "Same Artist",
      message: "Message",
      created_at: clock.now(),
    });
    await repository.insert(existingRequest);

    const input = {
      event_id: eventId,
      audience_id: audienceId,
      musician_id: differentMusicianId,
      song_title: songTitle,
      artist: "Same Artist",
      message: "New message",
    };

    const output = await useCase.execute(input);
    const createdRequest = await repository.findById(new RequestId(output.id));

    expect(createdRequest).toBeInstanceOf(Request);
    expect(createdRequest!.musician_id.id).toBe(input.musician_id);
  });

  describe("should create a request", () => {
    const arrange = [
      {
        input: {
          event_id: new Uuid().id,
          audience_id: new Uuid().id,
          musician_id: new Uuid().id,
          song_title: "Bohemian Rhapsody",
          artist: "Queen",
          message: "Please play this classic!",
        },
        expected: {
          song_title: "Bohemian Rhapsody",
          artist: "Queen",
          message: "Please play this classic!",
          status: "pending",
          rejection_reason: null,
          responded_at: null,
        },
      },
      {
        input: {
          event_id: new Uuid().id,
          audience_id: new Uuid().id,
          musician_id: new Uuid().id,
          song_title: "Imagine",
          artist: "John Lennon",
        },
        expected: {
          song_title: "Imagine",
          artist: "John Lennon",
          message: null,
          status: "pending",
          rejection_reason: null,
          responded_at: null,
        },
      },
      {
        input: {
          event_id: new Uuid().id,
          audience_id: new Uuid().id,
          musician_id: new Uuid().id,
          song_title: "Hotel California",
        },
        expected: {
          song_title: "Hotel California",
          artist: null,
          message: null,
          status: "pending",
          rejection_reason: null,
          responded_at: null,
        },
      },
    ];

    test.each(arrange)("input: %j", async ({ input, expected }) => {
      await setupEventWithMusicians(input.event_id, [input.musician_id]);
      await audienceRepository.insert(
        new Audience({
          audience_id: new AudienceId(input.audience_id),
          email: `${input.audience_id}@soundmeet.test`,
          name: "Audience",
          is_active: true,
        }),
      );
      await eventRepository.addAttendee(
        new EventId(input.event_id),
        input.audience_id,
      );
      const output = await useCase.execute(input);
      const entity = await repository.findById(new RequestId(output.id));

      expect(output.id).toBeDefined();
      expect(output.event_id).toBe(input.event_id);
      expect(output.audience_id).toBe(input.audience_id);
      expect(output.musician_id).toBe(input.musician_id);
      expect(output.song_title).toBe(expected.song_title);
      expect(output.artist).toBe(expected.artist);
      expect(output.message).toBe(expected.message);
      expect(output.status).toBe(expected.status);
      expect(output.rejection_reason).toBe(expected.rejection_reason);
      expect(output.responded_at).toBe(expected.responded_at);
      expect(output.created_at).toBeDefined();

      expect(entity!.toJSON()).toStrictEqual({
        request_id: output.id,
        event_id: input.event_id,
        audience_id: input.audience_id,
        musician_id: input.musician_id,
        library_id: null,
        song_title: expected.song_title,
        artist: expected.artist,
        message: expected.message,
        status: expected.status,
        rejection_reason: expected.rejection_reason,
        votes_count: 0,
        played_at: null,
        created_at: output.created_at,
        updated_at: output.created_at,
        responded_at: expected.responded_at,
        is_pending: true,
        is_accepted: false,
        is_rejected: false,
        is_played: false,
        is_responded: false,
        has_message: expected.message !== null,
        display_title: expected.artist
          ? `${expected.song_title} - ${expected.artist}`
          : expected.song_title,
        age_in_minutes: expect.any(Number),
        is_recent: true,
        is_old: false,
        is_urgent: false,
        priority: expect.any(String),
        boost: null,
        is_boosted: false,
        points_value: expect.any(Object),
        can_be_accepted: true,
        can_be_rejected: true,
        is_within_response_time: true,
      });
    });
  });
  /*
   * Escopo de repertório — SM: switch `accepts_requests_outside_repertoire`.
   *
   * 🔴 A razão destes testes existirem: sem eles, o switch inteiro pode ser
   * removido do use-case sem quebrar nada. A UI esconde o campo de texto
   * livre, o app nunca manda `library_id` de terceiro, e nenhum outro teste
   * atravessa este caminho — a defesa sumiria em silêncio, que é exatamente o
   * modo de falha que o CLAUDE.md deste repo cataloga.
   */
  describe("escopo do repertório", () => {
    const setupRestricted = async (accepts: boolean) => {
      const eventId = new Uuid().id;
      const audienceId = new Uuid().id;
      const musicianId = new Uuid().id;

      await setupEventWithMusicians(eventId, [musicianId]);
      const musician = await musicianRepository.findById(
        new MusicianId(musicianId),
      );
      musician!.setAcceptsRequestsOutsideRepertoire(accepts);
      await musicianRepository.update(musician!);

      await audienceRepository.insert(
        new Audience({
          audience_id: new AudienceId(audienceId),
          email: `${audienceId}@soundmeet.test`,
          name: "Audience",
          is_active: true,
        }),
      );
      await eventRepository.addAttendee(new EventId(eventId), audienceId);

      return { eventId, audienceId, musicianId };
    };

    it("recusa pedido SEM library_id quando o músico só aceita o próprio repertório", async () => {
      const { eventId, audienceId, musicianId } = await setupRestricted(false);

      await expect(
        useCase.execute({
          event_id: eventId,
          audience_id: audienceId,
          musician_id: musicianId,
          song_title: "Música Fora do Repertório",
          artist: "Artista",
        }),
      ).rejects.toThrow(InvalidOperationError);
    });

    it("aceita pedido com library_id do PRÓPRIO músico e grava o vínculo", async () => {
      const { eventId, audienceId, musicianId } = await setupRestricted(false);
      const libraryId = new Uuid().id;
      ownedLibraryIds.add(libraryId);

      const output = await useCase.execute({
        event_id: eventId,
        audience_id: audienceId,
        musician_id: musicianId,
        library_id: libraryId,
        song_title: "Do Repertório",
        artist: "Artista",
      });

      const created = await repository.findById(new RequestId(output.id));
      expect(created!.library_id?.id).toBe(libraryId);
    });

    it("recusa library_id que é de OUTRO músico", async () => {
      const { eventId, audienceId, musicianId } = await setupRestricted(false);
      // Não entra em `ownedLibraryIds`: a porta responde "não é dele".
      const alheio = new Uuid().id;

      await expect(
        useCase.execute({
          event_id: eventId,
          audience_id: audienceId,
          musician_id: musicianId,
          library_id: alheio,
          song_title: "Qualquer",
          artist: "Artista",
        }),
      ).rejects.toThrow(InvalidArgumentError);
    });

    it("recusa library_id alheio TAMBÉM com o switch ligado", async () => {
      // Se a posse só fosse checada no modo restrito, bastaria o músico
      // religar o switch para o pedido passar a apontar para a linha de
      // outra pessoa.
      const { eventId, audienceId, musicianId } = await setupRestricted(true);

      await expect(
        useCase.execute({
          event_id: eventId,
          audience_id: audienceId,
          musician_id: musicianId,
          library_id: new Uuid().id,
          song_title: "Qualquer",
          artist: "Artista",
        }),
      ).rejects.toThrow(InvalidArgumentError);
    });

    it("aceita pedido de texto livre quando o switch está ligado (padrão)", async () => {
      const { eventId, audienceId, musicianId } = await setupRestricted(true);

      const output = await useCase.execute({
        event_id: eventId,
        audience_id: audienceId,
        musician_id: musicianId,
        song_title: "Qualquer Música",
        artist: "Artista",
      });

      const created = await repository.findById(new RequestId(output.id));
      expect(created!.library_id).toBeNull();
    });
  });

  describe("presença no show", () => {
    // Bar fictício no centro do Rio; 0,001° de latitude ≈ 111 m.
    const VENUE = { latitude: -22.9068, longitude: -43.1729 };

    const setupPresent = async () => {
      const eventId = new Uuid().id;
      const audienceId = new Uuid().id;
      const musicianId = new Uuid().id;

      await setupEventWithMusicians(eventId, [musicianId]);
      const event = await eventRepository.findById(new EventId(eventId));
      venueLocation.set(event!.establishment_id.id, VENUE);

      await audienceRepository.insert(
        new Audience({
          audience_id: new AudienceId(audienceId),
          email: `${audienceId}@soundmeet.test`,
          name: "Audience",
          is_active: true,
        }),
      );
      await eventRepository.addAttendee(new EventId(eventId), audienceId);

      return {
        event_id: eventId,
        audience_id: audienceId,
        musician_id: musicianId,
        song_title: "Garota de Ipanema",
        artist: "Tom Jobim",
      };
    };

    const refusalField = async (promise: Promise<unknown>) => {
      try {
        await promise;
      } catch (e) {
        expect(e).toBeInstanceOf(EntityValidationError);
        return JSON.stringify((e as EntityValidationError).error);
      }
      throw new Error("esperava recusa");
    };

    it("aceita o pedido de quem está dentro do raio da casa", async () => {
      const input = await setupPresent();

      const output = await useCase.execute({
        ...input,
        location: {
          latitude: VENUE.latitude + 0.001,
          longitude: VENUE.longitude,
          accuracy_m: 20,
        },
      });

      expect(output.status).toBe("pending");
    });

    it("recusa o pedido de quem tem check-in mas está longe (saiu do bar)", async () => {
      const input = await setupPresent();

      const body = await refusalField(
        useCase.execute({
          ...input,
          location: { latitude: -23.5505, longitude: -46.6333, accuracy_m: 15 },
        }),
      );

      expect(body).toContain("location");
      expect(await repository.findAll()).toHaveLength(0);
    });

    it("recusa o pedido sem leitura de GPS", async () => {
      const input = await setupPresent();

      const body = await refusalField(useCase.execute(input));

      expect(body).toContain("Ative a localização");
    });

    it("recusa localização simulada mesmo dentro do raio", async () => {
      const input = await setupPresent();

      const body = await refusalField(
        useCase.execute({
          ...input,
          location: { ...VENUE, accuracy_m: 5, mocked: true },
        }),
      );

      expect(body).toContain("simulada");
    });
  });

  /*
   * 🔴 O "dia" do limite é o da CASA. Antes era `setHours(0)` no fuso do
   * processo — UTC no container —, e o limite zerava às 21h de Brasília, no
   * meio do show.
   */
  describe("limite diário — dia da casa, virando às 6h locais", () => {
    const LIMIT = 2;

    const scenario = async (opts: { timezone: string; requestsAt: Date[] }) => {
      const eventId = new Uuid().id;
      const audienceId = new Uuid().id;
      const musicianId = new Uuid().id;
      await setupEventWithMusicians(eventId, [musicianId]);
      const event = await eventRepository.findById(new EventId(eventId));
      venueLocation.setTimezone(event!.establishment_id.id, opts.timezone);
      await audienceRepository.insert(
        new Audience({
          audience_id: new AudienceId(audienceId),
          email: `${audienceId}@soundmeet.test`,
          name: "Audience",
          is_active: true,
        }),
      );
      await eventRepository.addAttendee(new EventId(eventId), audienceId);
      for (const [i, created_at] of opts.requestsAt.entries()) {
        await repository.insert(
          new Request({
            event_id: eventId,
            audience_id: audienceId,
            musician_id: new Uuid().id,
            song_title: `Antiga ${i}`,
            artist: "Artist",
            status: "accepted",
            created_at,
          }),
        );
      }
      return {
        event_id: eventId,
        audience_id: audienceId,
        musician_id: musicianId,
        song_title: "Nova",
        artist: "Artist",
      };
    };

    const useCaseAt = (at: Date) => {
      const fixed = new FakeClock(at);
      return new CreateRequestUseCase(
        repository,
        eventRepository,
        musicianRepository,
        audienceRepository,
        repertoireMembership,
        venueLocation,
        new PresenceVerifier(),
        LIMIT,
        0,
        fixed,
        undefined,
        2,
        undefined,
        undefined,
        6,
      );
    };

    it("🔴 não ganha outro lote às 21h de Brasília (meia-noite UTC)", async () => {
      const input = await scenario({
        timezone: "America/Sao_Paulo",
        requestsAt: [
          new Date("2026-10-02T23:00:00.000Z"), // 20h
          new Date("2026-10-02T23:30:00.000Z"), // 20h30
        ],
      });

      await expect(
        useCaseAt(new Date("2026-10-03T00:05:00.000Z")).execute(input), // 21h05
      ).rejects.toThrow(EntityValidationError);
    });

    it("o show das 22h às 2h é um dia só: à 1h ainda conta o que foi pedido às 22h", async () => {
      const input = await scenario({
        timezone: "America/Sao_Paulo",
        requestsAt: [
          new Date("2026-10-03T01:00:00.000Z"), // 22h
          new Date("2026-10-03T02:00:00.000Z"), // 23h
        ],
      });

      await expect(
        useCaseAt(new Date("2026-10-03T04:00:00.000Z")).execute(input), // 1h
      ).rejects.toThrow(EntityValidationError);
    });

    it("vira às 6h no fuso da casa — Manaus vira uma hora depois de Brasília", async () => {
      const requestsAt = [
        new Date("2026-10-03T02:00:00.000Z"), // 22h em Manaus
        new Date("2026-10-03T03:00:00.000Z"), // 23h em Manaus
      ];
      // 9h30 UTC = 6h30 em Brasília, 5h30 em Manaus.
      const at = new Date("2026-10-03T09:30:00.000Z");

      const manaus = await scenario({ timezone: "America/Manaus", requestsAt });
      await expect(useCaseAt(at).execute(manaus)).rejects.toThrow(
        EntityValidationError,
      );

      const saoPaulo = await scenario({
        timezone: "America/Sao_Paulo",
        requestsAt,
      });
      const output = await useCaseAt(at).execute(saoPaulo);
      expect(output.status).toBe("pending");
    });
  });
});
