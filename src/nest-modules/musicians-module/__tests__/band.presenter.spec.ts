import { instanceToPlain } from "class-transformer";

import { BandOutput } from "../../../core/musician/application/use-cases/common/band-output";
import {
  BandCollectionPresenter,
  BandIdentityPresenter,
  BandPresenter,
  presentMyBand,
  PublicBandPresenter,
} from "../band.presenter";

const LEADER = "03187da7-5db6-41d7-8ee7-1b11d0db463b";
const PENDING = "5ea3fb4b-aa97-4f94-bf54-506125c7d2e2";
const DECLINED = "a687756c-6b8e-4952-9def-50692307352e";

const member = (
  musician_id: string,
  status: "accepted" | "pending" | "declined",
  role = "member",
) => ({
  member_id: `member-${musician_id.slice(0, 4)}`,
  musician_id,
  role,
  instrument: "Violão",
  status,
  joined_at: new Date("2026-09-13T23:00:00.000Z"),
  responded_at:
    status === "pending" ? null : new Date("2026-09-14T23:00:00.000Z"),
});

const output = (): BandOutput => ({
  id: "4bcf1a9d-5723-4c04-a756-6aeb16dbde78",
  name: "Blues Duo",
  description: "Duo de blues e rock para bares",
  avatar: null,
  genres: ["Blues", "Rock"],
  formed_in: 2018,
  members: [
    member(LEADER, "accepted", "leader"),
    member(PENDING, "pending"),
    member(DECLINED, "declined"),
  ],
  priceRange: {
    model: "per_event",
    min: 800,
    max: 1500,
    currency: "BRL" as never,
    notes: null,
  },
  address: {
    city: "Guarulhos",
    state: "SP",
    latitude: -23.4538,
    longitude: -46.5333,
    street: "Avenida Paulo Faccini",
    number: "1000",
    complement: "casa 2",
    neighborhood: "Macedo",
    zip_code: "07010000",
  },
  open_to_gigs: true,
  is_active: true,
  created_at: new Date("2026-09-01T12:00:00.000Z"),
  updated_at: new Date("2026-09-02T12:00:00.000Z"),
});

describe("PublicBandPresenter — o que sai para terceiros", () => {
  it("🔴 a lista de chaves é fechada: campo novo no output não sai por herança", () => {
    const plain = instanceToPlain(new PublicBandPresenter(output()));

    expect(Object.keys(plain).sort()).toEqual([
      "address",
      "avatar",
      "description",
      "formed_in",
      "genres",
      "id",
      "is_active",
      "members",
      "name",
      "open_to_gigs",
      "priceRange",
    ]);
    expect(Object.keys(plain.members[0]).sort()).toEqual([
      "instrument",
      "joined_at",
      "member_id",
      "musician_id",
      "role",
      "status",
    ]);
  });

  it("🔴 do endereço saem só cidade e estado", () => {
    const plain = instanceToPlain(new PublicBandPresenter(output()));

    expect(plain.address).toEqual({ city: "Guarulhos", state: "SP" });
    const raw = JSON.stringify(plain);
    for (const leak of [
      "Avenida Paulo Faccini",
      "1000",
      "casa 2",
      "Macedo",
      "07010000",
      "-23.4538",
      "-46.5333",
    ]) {
      expect(raw).not.toContain(leak);
    }
  });

  it("🔴 convite pendente e convite recusado não saem", () => {
    const plain = instanceToPlain(new PublicBandPresenter(output()));

    expect(plain.members).toHaveLength(1);
    expect(plain.members[0]).toMatchObject({
      musician_id: LEADER,
      status: "accepted",
    });
    const raw = JSON.stringify(plain);
    expect(raw).not.toContain(PENDING);
    expect(raw).not.toContain(DECLINED);
    expect(raw).not.toContain("responded_at");
  });

  it("banda sem endereço sai com `address: null`", () => {
    const plain = instanceToPlain(
      new PublicBandPresenter({ ...output(), address: null }),
    );

    expect(plain.address).toBeNull();
  });

  it("a busca usa o presenter público em cada item", () => {
    const collection = new BandCollectionPresenter({
      items: [output()],
      total: 1,
      current_page: 1,
      per_page: 15,
      last_page: 1,
    });

    expect(collection.data[0]).toBeInstanceOf(PublicBandPresenter);
  });
});

describe("BandPresenter — a banda por dentro", () => {
  it("integrante aceito recebe endereço completo e todos os convites", () => {
    const plain = instanceToPlain(new BandPresenter(output()));

    expect(plain.address).toMatchObject({
      street: "Avenida Paulo Faccini",
      zip_code: "07010000",
    });
    expect(plain.members).toHaveLength(3);
    expect(plain.created_at).toBe("2026-09-01T12:00:00.000Z");
  });
});

describe("presentMyBand — um item de 'Minhas bandas'", () => {
  it("banda que integro sai por dentro", () => {
    const presenter = presentMyBand(
      { band: output(), membership_status: "accepted" },
      LEADER,
    );

    expect(presenter).toBeInstanceOf(BandPresenter);
  });

  it("🔴 convite pendente sai na pública + a MINHA linha, e só ela", () => {
    const presenter = presentMyBand(
      { band: output(), membership_status: "pending" },
      PENDING,
    );
    const plain = instanceToPlain(presenter);

    expect(presenter).toBeInstanceOf(PublicBandPresenter);
    expect(plain.members.map((m: any) => [m.musician_id, m.status])).toEqual([
      [LEADER, "accepted"],
      [PENDING, "pending"],
    ]);
    // O convite recusado de OUTRA pessoa continua fora, e o endereço também.
    expect(JSON.stringify(plain)).not.toContain(DECLINED);
    expect(plain.address).toEqual({ city: "Guarulhos", state: "SP" });
  });
});

describe("BandIdentityPresenter", () => {
  it("copia os cinco campos, nada mais", () => {
    const plain = instanceToPlain(
      new BandIdentityPresenter({
        id: "4bcf1a9d-5723-4c04-a756-6aeb16dbde78",
        display_name: "Blues Duo",
        avatar: null,
        genres: ["Blues"],
        instruments: ["Violão"],
        // Um campo a mais no output não pode vazar pelo presenter.
        address: "Rua X",
      } as never),
    );

    expect(Object.keys(plain).sort()).toEqual([
      "avatar",
      "display_name",
      "genres",
      "id",
      "instruments",
    ]);
  });
});
