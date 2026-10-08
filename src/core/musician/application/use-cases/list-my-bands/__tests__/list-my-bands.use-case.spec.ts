import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { BandInMemoryRepository } from "../../../../infra/db/in-memory/band-in-memory.repository";
import { bandLedBy, bandMember } from "../../common/__tests__/band-fixtures";
import { ListMyBandsUseCase } from "../list-my-bands.use-case";

describe("ListMyBandsUseCase Unit Tests", () => {
  let useCase: ListMyBandsUseCase;
  let repository: BandInMemoryRepository;
  let me: Uuid;

  beforeEach(() => {
    repository = new BandInMemoryRepository();
    useCase = new ListMyBandsUseCase(repository);
    me = new Uuid();
  });

  it("🔴 traz o convite PENDENTE — sem isto o convidado não tinha onde vê-lo", async () => {
    const invitedTo = bandLedBy(new Uuid(), [
      bandMember(me, "member", "pending"),
    ]);
    repository.items = [invitedTo];

    const output = await useCase.execute({ musician_id: me.id });

    expect(output.items).toHaveLength(1);
    expect(output.items[0]).toMatchObject({
      membership_status: "pending",
      band: { id: invitedTo.band_id.id },
    });
  });

  it("separa o que integro do que fui convidado, e deixa de fora o que recusei", async () => {
    const mine = bandLedBy(me);
    const member = bandLedBy(new Uuid(), [bandMember(me)]);
    const invited = bandLedBy(new Uuid(), [
      bandMember(me, "member", "pending"),
    ]);
    const declined = bandLedBy(new Uuid(), [
      bandMember(me, "member", "declined"),
    ]);
    const stranger = bandLedBy(new Uuid());
    repository.items = [mine, member, invited, declined, stranger];

    const output = await useCase.execute({ musician_id: me.id });

    const statusById = Object.fromEntries(
      output.items.map((item) => [item.band.id, item.membership_status]),
    );
    expect(statusById).toEqual({
      [mine.band_id.id]: "accepted",
      [member.band_id.id]: "accepted",
      [invited.band_id.id]: "pending",
    });
  });

  it("não passa pelo gate da busca: banda fora do radar continua sendo minha", async () => {
    const offRadar = bandLedBy(me);
    expect(offRadar.open_to_gigs).toBeNull();
    repository.items = [offRadar];

    const output = await useCase.execute({ musician_id: me.id });

    expect(output.items).toHaveLength(1);
  });

  it("banda arquivada continua na lista de quem a integrava, mas o convite dela some", async () => {
    const archivedMine = bandLedBy(me);
    archivedMine.archive();
    // Linha de convite que sobrou numa banda desativada (corrida com o archive).
    const archivedInvite = bandLedBy(new Uuid(), [
      bandMember(me, "member", "pending"),
    ]);
    archivedInvite.deactivate();
    repository.items = [archivedMine, archivedInvite];

    const output = await useCase.execute({ musician_id: me.id });

    expect(output.items.map((item) => item.band.id)).toEqual([
      archivedMine.band_id.id,
    ]);
  });
});
