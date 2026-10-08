import { BandInMemoryRepository } from "@core/musician/infra/db/in-memory/band-in-memory.repository";
import { InvalidOperationError } from "@core/shared/domain/errors/invalid-operation.error";
import { NotFoundError } from "@core/shared/domain/errors/not-found.error";
import { EntityValidationError } from "@core/shared/domain/validators/validation.error";
import { Currency } from "@core/shared/domain/value-objects";
import { Location } from "@core/shared/domain/value-objects/location.vo";
import { Uuid } from "@core/shared/domain/value-objects/uuid.vo";
import { FakeGeocodingService } from "@core/shared/infra/geocoding/fake-geocoding.service";
import { ForbiddenException } from "@nestjs/common";

import { bandLedBy, bandMember } from "../../common/__tests__/band-fixtures";
import { UpdateBandInput } from "../update-band.input";
import { UpdateBandUseCase } from "../update-band.use-case";

describe("UpdateBandUseCase Unit Tests", () => {
  let useCase: UpdateBandUseCase;
  let repository: BandInMemoryRepository;
  let geocoding: FakeGeocodingService;
  let leader: Uuid;

  beforeEach(() => {
    repository = new BandInMemoryRepository();
    geocoding = new FakeGeocodingService();
    useCase = new UpdateBandUseCase(repository, geocoding);
    leader = new Uuid();
  });

  const asLeader = {
    get requesting_musician_id() {
      return leader.id;
    },
  };

  it("atualiza nome e descrição", async () => {
    const band = bandLedBy(leader);
    repository.items = [band];

    const output = await useCase.execute(
      new UpdateBandInput({
        id: band.band_id.id,
        name: "updated name",
        description: "updated description",
        ...asLeader,
      }),
    );

    expect(output).toMatchObject({
      id: band.band_id.id,
      name: "updated name",
      description: "updated description",
    });
  });

  it("should throw error when band not found", async () => {
    const input = new UpdateBandInput({
      id: "9366b7dc-2d71-4799-b91c-c64adb205104", // Valid UUID but not in repo
      name: "updated name",
      ...asLeader,
    });

    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  it("should update price range", async () => {
    const band = bandLedBy(leader);
    repository.items = [band];

    const output = await useCase.execute(
      new UpdateBandInput({
        id: band.band_id.id,
        priceRange: {
          model: "per_hour",
          min: 200,
          max: 300,
          currency: Currency.BRL,
          notes: "updated notes",
        },
        ...asLeader,
      }),
    );

    expect(output.priceRange).toStrictEqual({
      model: "per_hour",
      min: 200,
      max: 300,
      currency: "BRL",
      notes: "updated notes",
    });
  });

  describe("🔴 só o líder ATUAL altera a banda (lido do banco, não do claim)", () => {
    it("integrante comum é recusado", async () => {
      const member = new Uuid();
      const band = bandLedBy(leader, [bandMember(member)]);
      repository.items = [band];

      await expect(
        useCase.execute(
          new UpdateBandInput({
            id: band.band_id.id,
            name: "tomada",
            requesting_musician_id: member.id,
          }),
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(repository.items[0].name).not.toBe("tomada");
    });

    it("ex-líder perde o acesso no instante da transferência", async () => {
      const successor = new Uuid();
      const band = bandLedBy(leader, [bandMember(successor)]);
      band.transferLeadership(leader, successor);
      repository.items = [band];

      await expect(
        useCase.execute(
          new UpdateBandInput({
            id: band.band_id.id,
            name: "do ex-líder",
            requesting_musician_id: leader.id,
          }),
        ),
      ).rejects.toThrow(ForbiddenException);

      // …e a nova líder passa a conseguir, sem depender de token novo.
      const output = await useCase.execute(
        new UpdateBandInput({
          id: band.band_id.id,
          name: "da nova líder",
          requesting_musician_id: successor.id,
        }),
      );
      expect(output.name).toBe("da nova líder");
    });

    it("sem `sub` não há como provar liderança: nega", async () => {
      const band = bandLedBy(leader);
      repository.items = [band];

      await expect(
        useCase.execute(
          new UpdateBandInput({ id: band.band_id.id, name: "x" }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("admin opera pela banda", async () => {
      const band = bandLedBy(leader);
      repository.items = [band];

      const output = await useCase.execute(
        new UpdateBandInput({
          id: band.band_id.id,
          name: "suporte",
          requesting_musician_id: new Uuid().id,
          is_admin: true,
        }),
      );
      expect(output.name).toBe("suporte");
    });
  });

  describe("🔴 valor inválido não é gravado nem ignorado", () => {
    it("nome vazio é recusado — antes era descartado com 200", async () => {
      const band = bandLedBy(leader);
      const original = band.name;
      repository.items = [band];

      await expect(
        useCase.execute(
          new UpdateBandInput({ id: band.band_id.id, name: "", ...asLeader }),
        ),
      ).rejects.toThrow(EntityValidationError);
      expect(original).not.toBe("");
    });

    it("nome acima de 255 caracteres é recusado — o resultado da validação era jogado fora", async () => {
      const band = bandLedBy(leader);
      repository.items = [band];

      await expect(
        useCase.execute(
          new UpdateBandInput({
            id: band.band_id.id,
            name: "a".repeat(256),
            ...asLeader,
          }),
        ),
      ).rejects.toThrow(EntityValidationError);
    });

    it("faixa de preço invertida vira erro de validação", async () => {
      const band = bandLedBy(leader);
      repository.items = [band];

      await expect(
        useCase.execute(
          new UpdateBandInput({
            id: band.band_id.id,
            priceRange: { model: "per_event", min: 900, max: 100 },
            ...asLeader,
          }),
        ),
      ).rejects.toThrow(EntityValidationError);
    });
  });

  describe("ano de formação", () => {
    it("grava o ano declarado", async () => {
      const band = bandLedBy(leader);
      repository.items = [band];

      const output = await useCase.execute(
        new UpdateBandInput({
          id: band.band_id.id,
          formed_in: 2015,
          ...asLeader,
        }),
      );
      expect(output.formed_in).toBe(2015);
    });

    it("`null` apaga; ausente preserva", async () => {
      const band = bandLedBy(leader);
      band.changeFormedIn(2015);
      repository.items = [band];

      const untouched = await useCase.execute(
        new UpdateBandInput({
          id: band.band_id.id,
          name: "outro",
          ...asLeader,
        }),
      );
      expect(untouched.formed_in).toBe(2015);

      const cleared = await useCase.execute(
        new UpdateBandInput({
          id: band.band_id.id,
          formed_in: null,
          ...asLeader,
        }),
      );
      expect(cleared.formed_in).toBeNull();
    });
  });

  describe("🔴 endereço: a banda passa a ter coordenada", () => {
    const address = {
      city: "São Paulo",
      state: "SP",
      street: "Av. Paulista",
      number: "1000",
      zip_code: "01310-100",
    };

    it("geocodifica o primeiro endereço — antes ficava sem coordenada e fora da busca por raio", async () => {
      geocoding.setCoordinates({ latitude: -23.56, longitude: -46.65 });
      const band = bandLedBy(leader);
      repository.items = [band];

      const output = await useCase.execute(
        new UpdateBandInput({
          id: band.band_id.id,
          // É exatamente o que o app manda: a coordenada que recebeu (nenhuma).
          address: { ...address, latitude: null, longitude: null } as never,
          ...asLeader,
        }),
      );

      expect(geocoding.queries).toHaveLength(1);
      expect(output.address).toMatchObject({
        latitude: -23.56,
        longitude: -46.65,
      });
    });

    it("endereço novo com a coordenada ANTIGA reenviada é regeocodificado", async () => {
      const band = bandLedBy(leader);
      band.changeAddress(
        new Location({ ...address, latitude: -23.56, longitude: -46.65 }),
      );
      repository.items = [band];
      geocoding.setCoordinates({ latitude: -22.9, longitude: -43.2 });

      const output = await useCase.execute(
        new UpdateBandInput({
          id: band.band_id.id,
          address: {
            city: "Rio de Janeiro",
            state: "RJ",
            zip_code: "20040-020",
            // O app devolve o par que recebeu ao abrir a tela.
            latitude: -23.56,
            longitude: -46.65,
          },
          ...asLeader,
        }),
      );

      expect(output.address).toMatchObject({
        city: "Rio de Janeiro",
        latitude: -22.9,
        longitude: -43.2,
      });
    });

    it("mudou de cidade e o geocodificador não respondeu: fica SEM coordenada, não com a da cidade antiga", async () => {
      const band = bandLedBy(leader);
      band.changeAddress(
        new Location({ ...address, latitude: -23.56, longitude: -46.65 }),
      );
      repository.items = [band];
      geocoding.setCoordinates(null);

      const output = await useCase.execute(
        new UpdateBandInput({
          id: band.band_id.id,
          address: {
            city: "Rio de Janeiro",
            state: "RJ",
            zip_code: "20040-020",
            latitude: -23.56,
            longitude: -46.65,
          },
          ...asLeader,
        }),
      );

      expect(output.address).toMatchObject({ latitude: null, longitude: null });
    });

    it("mesmo endereço não custa chamada ao geocodificador", async () => {
      const band = bandLedBy(leader);
      band.changeAddress(
        new Location({ ...address, latitude: -23.56, longitude: -46.65 }),
      );
      repository.items = [band];

      await useCase.execute(
        new UpdateBandInput({
          id: band.band_id.id,
          address: {
            ...address,
            complement: "sala 3",
            latitude: -23.56,
            longitude: -46.65,
          },
          ...asLeader,
        }),
      );

      expect(geocoding.queries).toHaveLength(0);
    });
  });

  it("banda dissolvida (arquivada) não é mais alterada", async () => {
    const band = bandLedBy(leader);
    band.archive();
    repository.items = [band];

    await expect(
      useCase.execute(
        new UpdateBandInput({
          id: band.band_id.id,
          name: "volta",
          ...asLeader,
        }),
      ),
    ).rejects.toThrow(InvalidOperationError);
  });
});
