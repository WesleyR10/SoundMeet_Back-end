import { IIdentityClaimsWriter } from "../../../../../shared/application/identity-claims.interface";
import { BandInMemoryRepository } from "../../../../infra/db/in-memory/band-in-memory.repository";
import { CreateBandInput } from "../create-band.input";
import { CreateBandUseCase } from "../create-band.use-case";

const LEADER_SUB = "11111111-1111-4111-8111-111111111111";

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

const input = () =>
  new CreateBandInput({
    name: "Trio Elétrico",
    genres: ["rock"],
    creator_musician_id: LEADER_SUB,
  } as never);

describe("CreateBandUseCase — vínculo de identidade", () => {
  let repo: BandInMemoryRepository;
  let claims: FakeClaimsWriter;
  let useCase: CreateBandUseCase;

  beforeEach(() => {
    repo = new BandInMemoryRepository();
    claims = new FakeClaimsWriter();
    useCase = new CreateBandUseCase(repo, claims);
  });

  it("grava band_ids no líder com o UUID da banda, não com o sub dele", async () => {
    const output = await useCase.execute(input());

    expect(claims.calls).toEqual([
      { userId: LEADER_SUB, attribute: "band_ids", value: output.id },
    ]);
    expect(output.id).not.toBe(LEADER_SUB);
  });

  it("não persiste a banda se o vínculo falhar", async () => {
    claims.shouldFail = true;

    await expect(useCase.execute(input())).rejects.toThrow(
      "Keycloak indisponível",
    );
    expect(repo.items).toHaveLength(0);
  });

  it("segue funcionando sem writer configurado (modo local)", async () => {
    const semClaims = new CreateBandUseCase(repo);
    await expect(semClaims.execute(input())).resolves.toMatchObject({
      name: "Trio Elétrico",
    });
    expect(repo.items).toHaveLength(1);
  });
});
