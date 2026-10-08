import { MusicianWallet } from "../../../domain/musician-wallet.aggregate";
import { MusicianWalletInMemoryRepository } from "../../db/in-memory/musician-wallet-in-memory.repository";
import { WalletMercadoPagoAccountResolver } from "../wallet-mercadopago-account.resolver";

const MUSICIAN_ID = "22222222-2222-4222-8222-222222222222";

describe("WalletMercadoPagoAccountResolver", () => {
  let walletRepo: MusicianWalletInMemoryRepository;
  let resolver: WalletMercadoPagoAccountResolver;

  beforeEach(() => {
    walletRepo = new MusicianWalletInMemoryRepository();
    resolver = new WalletMercadoPagoAccountResolver(walletRepo);
  });

  it("devolve a credencial do músico vinculado", async () => {
    const wallet = MusicianWallet.create({ musician_id: MUSICIAN_ID });
    wallet.linkMercadoPago({
      mp_user_id: "MP-123",
      access_token: "APP_USR-abc",
      refresh_token: "TG-abc",
      expires_at: new Date("2027-01-01T00:00:00Z"),
    });
    await walletRepo.insert(wallet);

    await expect(resolver.resolve(MUSICIAN_ID)).resolves.toEqual({
      mp_user_id: "MP-123",
      access_token: "APP_USR-abc",
    });
  });

  it("devolve null quando a carteira existe mas não há vínculo", async () => {
    // É o caso normal do músico que ainda não conectou — e o adapter traduz
    // isso num erro com ação clara, não numa falha genérica.
    await walletRepo.insert(
      MusicianWallet.create({ musician_id: MUSICIAN_ID }),
    );

    await expect(resolver.resolve(MUSICIAN_ID)).resolves.toBeNull();
  });

  it("devolve null quando nem carteira existe", async () => {
    await expect(resolver.resolve(MUSICIAN_ID)).resolves.toBeNull();
  });

  it("devolve null depois de desvincular", async () => {
    const wallet = MusicianWallet.create({ musician_id: MUSICIAN_ID });
    wallet.linkMercadoPago({
      mp_user_id: "MP-123",
      access_token: "APP_USR-abc",
      refresh_token: "TG-abc",
      expires_at: new Date("2027-01-01T00:00:00Z"),
    });
    wallet.unlinkMercadoPago();
    await walletRepo.insert(wallet);

    await expect(resolver.resolve(MUSICIAN_ID)).resolves.toBeNull();
  });
});
