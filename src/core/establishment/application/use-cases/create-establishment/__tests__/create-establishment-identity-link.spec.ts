import { IIdentityClaimsWriter } from "../../../../../shared/application/identity-claims.interface";
import { EstablishmentInMemoryRepository } from "../../../../infra/db/in-memory/establishment-in-memory.repository";
import { CreateEstablishmentUseCase } from "../create-establishment.use-case";

const OWNER_SUB = "11111111-1111-4111-8111-111111111111";

class FakeClaimsWriter implements IIdentityClaimsWriter {
  readonly calls: Array<{ userId: string; attribute: string; value: string }> =
    [];
  shouldFail = false;

  async addClaimValue(userId: string, attribute: any, value: string) {
    if (this.shouldFail) {
      throw new Error("Keycloak indisponível");
    }
    this.calls.push({ userId, attribute, value });
  }

  async removeClaimValue() {
    /* não exercitado aqui */
  }
}

const input = (over: Record<string, unknown> = {}) => ({
  name: "Bar do Zé",
  email: `bar-${Math.random()}@teste.com`,
  phone: "11999998888",
  establishment_type: "bar" as const,
  existing_establishment_ids: [],
  owner_user_id: OWNER_SUB,
  ...over,
});

describe("CreateEstablishmentUseCase — vínculo de identidade", () => {
  let repo: EstablishmentInMemoryRepository;
  let claims: FakeClaimsWriter;
  let useCase: CreateEstablishmentUseCase;

  beforeEach(() => {
    repo = new EstablishmentInMemoryRepository();
    claims = new FakeClaimsWriter();
    useCase = new CreateEstablishmentUseCase(repo, undefined, claims);
  });

  it("grava establishment_ids no dono com o id do agregado recém-criado", async () => {
    const output = await useCase.execute(input() as never);

    expect(claims.calls).toEqual([
      {
        userId: OWNER_SUB,
        attribute: "establishment_ids",
        value: output.id,
      },
    ]);
  });

  it("o id vinculado NÃO é o sub — é o UUID próprio do estabelecimento", async () => {
    const output = await useCase.execute(input() as never);

    expect(output.id).not.toBe(OWNER_SUB);
    expect(claims.calls[0].value).toBe(output.id);
  });

  it("não persiste o estabelecimento se o vínculo falhar", async () => {
    claims.shouldFail = true;

    await expect(useCase.execute(input() as never)).rejects.toThrow(
      "Keycloak indisponível",
    );
    // Sem esta ordem sobraria um estabelecimento que o dono não consegue operar.
    expect(repo.items).toHaveLength(0);
  });

  it("acumula vínculos: a segunda casa do mesmo dono também é gravada", async () => {
    const primeiro = await useCase.execute(input() as never);
    const segundo = await useCase.execute(
      input({ existing_establishment_ids: [primeiro.id] }) as never,
    );

    expect(claims.calls.map((c) => c.value)).toEqual([primeiro.id, segundo.id]);
  });

  it("segue funcionando sem writer configurado (modo local)", async () => {
    const semClaims = new CreateEstablishmentUseCase(repo);
    await expect(semClaims.execute(input() as never)).resolves.toMatchObject({
      name: "Bar do Zé",
    });
    expect(repo.items).toHaveLength(1);
  });
});
