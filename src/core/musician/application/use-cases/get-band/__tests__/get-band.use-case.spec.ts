import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { UnauthorizedError } from "../../../../../shared/domain/errors/unauthorized.error";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { BandInMemoryRepository } from "../../../../infra/db/in-memory/band-in-memory.repository";
import { bandLedBy, bandMember } from "../../common/__tests__/band-fixtures";
import { GetBandInput } from "../get-band.input";
import { GetBandUseCase } from "../get-band.use-case";

describe("GetBandUseCase Unit Tests", () => {
  let useCase: GetBandUseCase;
  let repository: BandInMemoryRepository;
  let leader: Uuid;
  let member: Uuid;
  let invited: Uuid;

  beforeEach(() => {
    repository = new BandInMemoryRepository();
    useCase = new GetBandUseCase(repository);
    leader = new Uuid();
    member = new Uuid();
    invited = new Uuid();
  });

  const seed = () => {
    const band = bandLedBy(leader, [
      bandMember(member),
      bandMember(invited, "member", "pending"),
    ]);
    repository.items = [band];
    return band;
  };

  it("should get a band", async () => {
    const band = seed();

    const output = await useCase.execute(
      new GetBandInput({ id: band.band_id.id }),
    );

    expect(output.band).toMatchObject({
      id: band.band_id.id,
      name: band.name,
      description: band.description,
      is_active: band.is_active,
    });
  });

  it("should throw error when band not found", async () => {
    const input = new GetBandInput({
      id: "9366b7dc-2d71-4799-b91c-c64adb205104", // Valid UUID but not in repo
    });

    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  describe("🔴 `is_member` é derivado da lista de integrantes, nunca afirmado", () => {
    it.each([
      ["anônimo", () => null, false],
      ["estranho autenticado", () => new Uuid().id, false],
      ["líder", () => leader.id, true],
      ["integrante aceito", () => member.id, true],
      // Convidado ainda não é da banda: vê o convite em "Minhas bandas", não
      // o endereço nem os outros convites.
      ["convidado pendente", () => invited.id, false],
    ])("%s", async (_label, requester, expected) => {
      const band = seed();

      const output = await useCase.execute(
        new GetBandInput({
          id: band.band_id.id,
          requesting_musician_id: requester(),
        }),
      );

      expect(output.is_member).toBe(expected);
    });

    it("admin vê a banda por dentro", async () => {
      const band = seed();

      const output = await useCase.execute(
        new GetBandInput({
          id: band.band_id.id,
          requesting_musician_id: new Uuid().id,
          is_admin: true,
        }),
      );

      expect(output.is_member).toBe(true);
    });

    it("`sub` que não é UUID é tratado como ninguém, sem estourar", async () => {
      const band = seed();

      const output = await useCase.execute(
        new GetBandInput({
          id: band.band_id.id,
          requesting_musician_id: "não-é-uuid",
        }),
      );

      expect(output.is_member).toBe(false);
    });
  });

  describe("🔴 token recusado de um integrante vira 401, não a versão pública", () => {
    it("líder com token expirado recebe 401 — o app renova e repete", async () => {
      const band = seed();

      await expect(
        useCase.execute(
          new GetBandInput({
            id: band.band_id.id,
            rejected_token_sub: leader.id,
          }),
        ),
      ).rejects.toThrow(UnauthorizedError);
    });

    it("token recusado de um estranho segue anônimo: recebe a versão pública", async () => {
      const band = seed();

      const output = await useCase.execute(
        new GetBandInput({
          id: band.band_id.id,
          rejected_token_sub: new Uuid().id,
        }),
      );

      expect(output.is_member).toBe(false);
    });

    it("o `sub` recusado nunca vira identidade: não libera a visão de integrante", async () => {
      const band = seed();

      // Se o valor não verificado fosse usado como identidade, forjar o id do
      // líder num token inválido renderia a banda por dentro. Rende um 401.
      await expect(
        useCase.execute(
          new GetBandInput({
            id: band.band_id.id,
            rejected_token_sub: member.id,
          }),
        ),
      ).rejects.toThrow(UnauthorizedError);
    });
  });
});
