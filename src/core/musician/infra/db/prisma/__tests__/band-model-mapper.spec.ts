import { Prisma } from "@prisma/client";

import { BandModelMapper } from "../band-model-mapper";

const model = (over: Record<string, unknown> = {}) =>
  ({
    id: "4bcf1a9d-5723-4c04-a756-6aeb16dbde78",
    name: "Blues Duo",
    description: null,
    avatar: null,
    genres: ["Blues"],
    formed_in: null,
    qr_code: null,
    price_model: null,
    price_min: null,
    price_max: null,
    price_currency: null,
    price_notes: null,
    open_to_gigs: null,
    address: null,
    location_lat: null,
    location_lng: null,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    members: [],
    ...over,
  }) as never;

describe("BandModelMapper", () => {
  /*
   * 🔴 `price_min`/`price_max` são `Decimal(12,2)`: o Prisma devolve um objeto
   * `Decimal`, não um número. Passado cru ao `PriceRange`, lançava "Minimum
   * price must be a finite number" — e uma banda com faixa de preço gravada
   * nunca mais carregava: a busca pública respondia 422 inteira se UMA banda
   * da página tivesse preço. O repositório em memória guarda número como
   * número e não via nada; só o e2e contra Postgres mostrou.
   */
  it("🔴 carrega faixa de preço vinda do banco como Decimal", () => {
    const band = BandModelMapper.toEntity(
      model({
        price_model: "per_event",
        price_min: new Prisma.Decimal("800.00"),
        price_max: new Prisma.Decimal("1500.50"),
        price_currency: "BRL",
        price_notes: "Som incluso",
      }),
    );

    expect(band.priceRange).toMatchObject({
      model: "per_event",
      min: 800,
      max: 1500.5,
      notes: "Som incluso",
    });
    expect(typeof band.priceRange!.min).toBe("number");
  });

  it("banda sem faixa de preço continua sem", () => {
    expect(BandModelMapper.toEntity(model()).priceRange).toBeNull();
  });

  it("os integrantes voltam do banco como Uuid, com o status e o papel gravados", () => {
    const band = BandModelMapper.toEntity(
      model({
        members: [
          {
            id: "6876d9cc-2567-4169-80f8-b933656da586",
            musicianId: "03187da7-5db6-41d7-8ee7-1b11d0db463b",
            role: "leader",
            instrument: "Violão",
            status: "accepted",
            joinedAt: new Date(),
            responded_at: new Date(),
          },
        ],
      }),
    );

    expect(band.leader?.musician_id.id).toBe(
      "03187da7-5db6-41d7-8ee7-1b11d0db463b",
    );
  });
});
