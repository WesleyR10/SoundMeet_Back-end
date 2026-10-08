import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import { Event } from "../../../domain/event.aggregate";
import { EventInMemoryRepository } from "../../../infra/db/in-memory/event-in-memory.repository";
import { GetEventUseCase } from "../get-event/get-event.use-case";
import { ListEventsUseCase } from "../list-events/list-events.use-case";

const ESTABLISHMENT = "11111111-1111-4111-8111-111111111111";
const OTHER_ESTABLISHMENT = "22222222-2222-4222-8222-222222222222";

/**
 * Bloco 9.4d — vazamento de evento privado.
 *
 * As duas rotas são `@Public()`. Antes desta correção, pinar `establishment_id`
 * (que é o caso da rota aninhada `/establishments/:id/events`) desligava a
 * proteção de `is_public`, e qualquer pessoa que soubesse o UUID do
 * estabelecimento listava — e abria — os eventos privados dele.
 */
describe("Visibilidade de evento privado (Bloco 9.4d)", () => {
  let repo: EventInMemoryRepository;
  let listUseCase: ListEventsUseCase;
  let getUseCase: GetEventUseCase;
  let publicEvent: Event;
  let privateEvent: Event;

  beforeEach(async () => {
    repo = new EventInMemoryRepository();
    listUseCase = new ListEventsUseCase(repo);
    getUseCase = new GetEventUseCase(repo);

    publicEvent = Event.fake()
      .anEvent()
      .withEstablishmentId(new Uuid(ESTABLISHMENT))
      .withIsPublic(true)
      .build();

    privateEvent = Event.fake()
      .anEvent()
      .withEstablishmentId(new Uuid(ESTABLISHMENT))
      .withIsPublic(false)
      .build();

    await repo.bulkInsert([publicEvent, privateEvent]);
  });

  describe("listagem", () => {
    it("anônimo não vê evento privado, mesmo sabendo o id do estabelecimento", async () => {
      const output = await listUseCase.execute({
        establishment_id: ESTABLISHMENT,
      });

      expect(output.total).toBe(1);
      expect(output.items[0].id).toBe(publicEvent.entity_id.id);
    });

    it("terceiro autenticado também não vê", async () => {
      const output = await listUseCase.execute({
        establishment_id: ESTABLISHMENT,
        requesting_establishment_ids: [OTHER_ESTABLISHMENT],
      });

      expect(output.total).toBe(1);
    });

    it("o dono vê os próprios eventos privados", async () => {
      const output = await listUseCase.execute({
        establishment_id: ESTABLISHMENT,
        requesting_establishment_ids: [ESTABLISHMENT],
      });

      expect(output.total).toBe(2);
    });

    it("admin vê tudo", async () => {
      const output = await listUseCase.execute({
        establishment_id: ESTABLISHMENT,
        is_admin: true,
      });

      expect(output.total).toBe(2);
    });

    // Tentativa óbvia de burla: pedir is_public=false explicitamente.
    it("pedir is_public=false não libera privado para estranho", async () => {
      const output = await listUseCase.execute({
        establishment_id: ESTABLISHMENT,
        filter: { is_public: false },
      });

      expect(output.items.some((i) => i.id === privateEvent.entity_id.id)).toBe(
        false,
      );
    });

    it("discovery cross-establishment segue só com públicos", async () => {
      const output = await listUseCase.execute({});
      expect(output.total).toBe(1);
    });
  });

  describe("detalhe por id", () => {
    it("anônimo recebe 404 no evento privado", async () => {
      await expect(
        getUseCase.execute({
          establishment_id: ESTABLISHMENT,
          event_id: privateEvent.entity_id.id,
        }),
      ).rejects.toThrow(NotFoundError);
    });

    // 404 e não 403: dizer "existe mas você não pode ver" já confirma a
    // existência de um evento privado a quem não deveria saber dele.
    it("terceiro recebe 404, não 403", async () => {
      await expect(
        getUseCase.execute({
          establishment_id: ESTABLISHMENT,
          event_id: privateEvent.entity_id.id,
          requesting_establishment_ids: [OTHER_ESTABLISHMENT],
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it("o dono abre o próprio evento privado", async () => {
      const output = await getUseCase.execute({
        establishment_id: ESTABLISHMENT,
        event_id: privateEvent.entity_id.id,
        requesting_establishment_ids: [ESTABLISHMENT],
      });

      expect(output.id).toBe(privateEvent.entity_id.id);
    });

    it("evento público continua aberto a qualquer um", async () => {
      const output = await getUseCase.execute({
        establishment_id: ESTABLISHMENT,
        event_id: publicEvent.entity_id.id,
      });

      expect(output.id).toBe(publicEvent.entity_id.id);
    });
  });
});
