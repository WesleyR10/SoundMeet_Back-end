import { CurrencyEnum } from "@prisma/client";

import { FakeEncryptionService } from "../../../../../shared/infra/crypto/fake-encryption.service";
import { MusicianWallet } from "../../../../domain/musician-wallet.aggregate";
import {
  MusicianWalletModelMapper,
  MusicianWalletModelProps,
} from "../musician-wallet-model.mapper";

describe("MusicianWalletModelMapper (SM-016 field encryption)", () => {
  let encryption: FakeEncryptionService;
  let mapper: MusicianWalletModelMapper;

  beforeEach(() => {
    encryption = new FakeEncryptionService();
    mapper = new MusicianWalletModelMapper(encryption);
  });

  function baseModel(overrides: Partial<MusicianWalletModelProps> = {}): any {
    return {
      id: "11111111-1111-4111-8111-111111111111",
      musicianId: "22222222-2222-4222-8222-222222222222",
      balance: "0",
      totalEarned: "0",
      totalWithdrawn: "0",
      currency: CurrencyEnum.BRL,
      pixKey: null,
      pixKeyCiphertext: null,
      pixKeyIv: null,
      pixKeyAuthTag: null,
      pixKeyType: null,
      bankAccount: null,
      bankAccountCiphertext: null,
      bankAccountIv: null,
      bankAccountAuthTag: null,
      heldBalance: "0",
      asaasWalletId: null,
      asaasApiKeyCiphertext: null,
      asaasApiKeyIv: null,
      asaasApiKeyAuthTag: null,
      asaasAccountStatus: null,
      escrowEnabled: false,
      mpUserId: null,
      mpAccessTokenCiphertext: null,
      mpAccessTokenIv: null,
      mpAccessTokenAuthTag: null,
      mpRefreshTokenCiphertext: null,
      mpRefreshTokenIv: null,
      mpRefreshTokenAuthTag: null,
      mpTokenExpiresAt: null,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
      ...overrides,
    };
  }

  it("nunca escreve pix key nem bank account em claro nas colunas legadas", () => {
    const wallet = MusicianWallet.create({
      musician_id: "22222222-2222-4222-8222-222222222222",
    });
    wallet.updatePixKey("52998224725", "cpf");

    const model = mapper.toModel(wallet);

    expect(model.pixKey).toBeNull();
    expect(model.pixKeyCiphertext).not.toBeNull();
    expect(model.pixKeyCiphertext).not.toContain("52998224725");
    expect(model.pixKeyType).toBe("cpf");
    expect(model.bankAccount).toBeNull();
  });

  it("faz round-trip da pix key: cifra em toModel e decifra em toEntity", () => {
    const wallet = MusicianWallet.create({
      musician_id: "22222222-2222-4222-8222-222222222222",
    });
    wallet.updatePixKey("musico@pix.com", "email");

    const model = mapper.toModel(wallet);
    const restored = mapper.toEntity(baseModel(model));

    expect(restored.pix_key?.key).toBe("musico@pix.com");
    expect(restored.pix_key?.type).toBe("email");
  });

  it("cifra e decifra bank_account (objeto arbitrário) preservando o shape", () => {
    const bankAccount = { bank: "001", agency: "1234", account: "987654321" };
    const model = mapper.toModel(
      Object.assign(
        MusicianWallet.create({
          musician_id: "22222222-2222-4222-8222-222222222222",
        }),
        { bank_account: bankAccount },
      ),
    );

    expect(model.bankAccount).toBeNull();
    expect(model.bankAccountCiphertext).not.toBeNull();
    expect(JSON.stringify(model)).not.toContain("987654321");

    const restored = mapper.toEntity(baseModel(model));
    expect(restored.bank_account).toEqual(bankAccount);
  });

  it("cai no fallback das colunas legadas quando não há cifra (linha pré-backfill)", () => {
    const model = baseModel({ pixKey: "legado@pix.com", pixKeyType: "email" });
    const restored = mapper.toEntity(model);
    expect(restored.pix_key?.key).toBe("legado@pix.com");
  });

  it("prefere a coluna cifrada quando ambas existem", () => {
    const encrypted = encryption.encrypt("novo@pix.com");
    const model = baseModel({
      pixKey: "legado-nao-deveria-ser-usado@pix.com",
      pixKeyCiphertext: encrypted.ciphertext,
      pixKeyIv: encrypted.iv,
      pixKeyAuthTag: encrypted.authTag,
      pixKeyType: "email",
    });

    const restored = mapper.toEntity(model);
    expect(restored.pix_key?.key).toBe("novo@pix.com");
  });

  it("cifra a apiKey da subconta e nunca a escreve em claro", () => {
    /*
     * Esta chave move dinheiro DENTRO da subconta do músico e o provedor só a
     * entrega uma vez, na criação — não há como recuperá-la depois. Vazá-la é
     * pior que vazar a chave PIX: a chave PIX recebe, esta opera.
     */
    const wallet = MusicianWallet.create({
      musician_id: "22222222-2222-4222-8222-222222222222",
    });
    wallet.linkSubaccount({
      wallet_id: "wal_abc123",
      api_key: "$aact_super_secreta",
      account_status: "PENDING",
    });

    const model = mapper.toModel(wallet);

    expect(model.asaasWalletId).toBe("wal_abc123");
    expect(model.asaasApiKeyCiphertext).not.toBeNull();
    expect(JSON.stringify(model)).not.toContain("$aact_super_secreta");

    const restored = mapper.toEntity(baseModel(model));
    expect(restored.asaas_api_key).toBe("$aact_super_secreta");
    expect(restored.asaas_account_status).toBe("PENDING");
  });

  it("não expõe a apiKey no toJSON do agregado", () => {
    // `toJSON` alimenta output de use-case, log e presenter.
    const wallet = MusicianWallet.create({
      musician_id: "22222222-2222-4222-8222-222222222222",
    });
    wallet.linkSubaccount({
      wallet_id: "wal_abc123",
      api_key: "$aact_secreta",
    });

    expect(JSON.stringify(wallet.toJSON())).not.toContain("$aact_secreta");
  });

  it("preserva o saldo em custódia na ida e na volta", () => {
    const wallet = MusicianWallet.create({
      musician_id: "22222222-2222-4222-8222-222222222222",
    });
    wallet.holdFunds(1500);

    const restored = mapper.toEntity(baseModel(mapper.toModel(wallet)));

    expect(restored.held_balance.amount).toBe(1500);
    // 🔴 Custódia NÃO é saldo: somá-la ofereceria um saque que o gateway recusa.
    expect(restored.balance.amount).toBe(0);
  });

  it("cifra os tokens OAuth do Mercado Pago e nunca os escreve em claro", async () => {
    /*
     * O access_token move dinheiro DENTRO da conta do músico. O refresh é
     * igualmente sensível: sem ele o vínculo morre em 180 dias e ele precisa
     * reautorizar na mão — provavelmente descobrindo isso no palco.
     */
    const wallet = MusicianWallet.create({
      musician_id: "22222222-2222-4222-8222-222222222222",
    });
    wallet.linkMercadoPago({
      mp_user_id: "MP-123456",
      access_token: "APP_USR-token-secreto",
      refresh_token: "TG-refresh-secreto",
      expires_at: new Date("2027-02-15T00:00:00Z"),
    });

    const model = mapper.toModel(wallet);
    const serialized = JSON.stringify(model);

    expect(model.mpUserId).toBe("MP-123456");
    expect(serialized).not.toContain("APP_USR-token-secreto");
    expect(serialized).not.toContain("TG-refresh-secreto");

    const restored = mapper.toEntity(baseModel(model));
    expect(restored.mp_access_token).toBe("APP_USR-token-secreto");
    expect(restored.mp_refresh_token).toBe("TG-refresh-secreto");
    expect(restored.hasMercadoPagoLink).toBe(true);
  });

  it("não expõe os tokens do Mercado Pago no toJSON", () => {
    const wallet = MusicianWallet.create({
      musician_id: "22222222-2222-4222-8222-222222222222",
    });
    wallet.linkMercadoPago({
      mp_user_id: "MP-123456",
      access_token: "APP_USR-secreto",
      refresh_token: "TG-secreto",
      expires_at: new Date("2027-02-15T00:00:00Z"),
    });

    const json = JSON.stringify(wallet.toJSON());

    expect(json).not.toContain("APP_USR-secreto");
    expect(json).not.toContain("TG-secreto");
    // O vínculo em si aparece — é o que a UI precisa para saber se já conectou.
    expect(json).toContain("MP-123456");
  });
});
