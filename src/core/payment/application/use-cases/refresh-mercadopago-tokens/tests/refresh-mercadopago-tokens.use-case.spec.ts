import { MusicianWallet } from "../../../../domain/musician-wallet.aggregate";
import { MusicianWalletInMemoryRepository } from "../../../../infra/db/in-memory/musician-wallet-in-memory.repository";
import {
  IMercadoPagoOAuthGateway,
  MercadoPagoTokens,
} from "../../../../infra/gateways/mercadopago-oauth.gateway";
import { RefreshMercadoPagoTokensUseCase } from "../refresh-mercadopago-tokens.use-case";

const NOW = new Date("2027-02-01T00:00:00Z");
/** Dentro da folga de 15 dias. */
const VENCE_LOGO = new Date("2027-02-10T00:00:00Z");
/** Fora da folga. */
const VENCE_TARDE = new Date("2027-06-01T00:00:00Z");

class FakeOAuth implements IMercadoPagoOAuthGateway {
  refreshed: string[] = [];
  failFor: string | null = null;

  buildAuthorizationUrl(): string {
    return "";
  }
  async exchangeCode(): Promise<MercadoPagoTokens> {
    throw new Error("não usado");
  }
  async refresh(refreshToken: string): Promise<MercadoPagoTokens> {
    if (this.failFor === refreshToken) {
      throw new Error("vínculo revogado pelo usuário");
    }
    this.refreshed.push(refreshToken);
    return {
      mp_user_id: "MP-1",
      access_token: `novo-${refreshToken}`,
      refresh_token: `r-novo-${refreshToken}`,
      expires_at: new Date("2027-08-01T00:00:00Z"),
    };
  }
}

describe("RefreshMercadoPagoTokensUseCase", () => {
  let walletRepo: MusicianWalletInMemoryRepository;
  let oauth: FakeOAuth;

  beforeEach(() => {
    walletRepo = new MusicianWalletInMemoryRepository();
    oauth = new FakeOAuth();
  });

  function buildUseCase() {
    return new RefreshMercadoPagoTokensUseCase({
      walletRepo,
      oauth,
      clock: { now: () => NOW },
    });
  }

  async function seed(
    musicianId: string,
    expiresAt: Date,
    refreshToken = `r-${musicianId}`,
  ): Promise<MusicianWallet> {
    const wallet = MusicianWallet.create({ musician_id: musicianId });
    wallet.linkMercadoPago({
      mp_user_id: `MP-${musicianId}`,
      access_token: `a-${musicianId}`,
      refresh_token: refreshToken,
      expires_at: expiresAt,
    });
    await walletRepo.insert(wallet);
    return wallet;
  }

  const M1 = "11111111-1111-4111-8111-111111111111";
  const M2 = "22222222-2222-4222-8222-222222222222";

  it("renova o que vence dentro da folga", async () => {
    await seed(M1, VENCE_LOGO);

    const output = await buildUseCase().execute();

    expect(output.refreshed).toBe(1);
    const wallet = await walletRepo.findByMusicianId(M1);
    expect(wallet!.mp_access_token).toBe("novo-r-" + M1);
    expect(wallet!.mp_token_expires_at).toEqual(
      new Date("2027-08-01T00:00:00Z"),
    );
  });

  it("ignora o que ainda está longe de vencer", async () => {
    await seed(M1, VENCE_TARDE);

    const output = await buildUseCase().execute();

    expect(output.examined).toBe(0);
    expect(oauth.refreshed).toEqual([]);
  });

  it("uma carteira revogada não derruba a varredura das outras", async () => {
    /*
     * Vínculo revogado do lado do provedor falha para sempre. Se interrompesse
     * o lote, UM músico que desconectou travaria a renovação de todos — e o
     * estrago apareceria meses depois, em massa.
     */
    await seed(M1, VENCE_LOGO, "r-revogado");
    await seed(M2, VENCE_LOGO);
    oauth.failFor = "r-revogado";

    const output = await buildUseCase().execute();

    expect(output.examined).toBe(2);
    expect(output.refreshed).toBe(1);
    expect(output.failed).toEqual([
      { musician_id: M1, reason: "vínculo revogado pelo usuário" },
    ]);
    expect((await walletRepo.findByMusicianId(M2))!.mp_access_token).toBe(
      "novo-r-" + M2,
    );
  });

  it("ignora carteira sem vínculo", async () => {
    await walletRepo.insert(MusicianWallet.create({ musician_id: M1 }));

    expect((await buildUseCase().execute()).examined).toBe(0);
  });

  it("guarda o refresh_token NOVO — o provedor rotaciona o par", async () => {
    // Guardar o antigo faria a próxima renovação falhar, e o vínculo morreria
    // silenciosamente no fim dos 180 dias.
    await seed(M1, VENCE_LOGO);

    await buildUseCase().execute();

    expect((await walletRepo.findByMusicianId(M1))!.mp_refresh_token).toBe(
      "r-novo-r-" + M1,
    );
  });
});
