import { MusicianWallet } from "../musician-wallet.aggregate";

const MUSICIAN_ID = "22222222-2222-4222-8222-222222222222";
const EXPIRES = new Date("2027-02-15T00:00:00Z");

function novaCarteira(): MusicianWallet {
  return MusicianWallet.create({ musician_id: MUSICIAN_ID });
}

describe("MusicianWallet — vínculo Mercado Pago", () => {
  it("vincula com os dois tokens e a data de expiração", () => {
    const wallet = novaCarteira();

    wallet.linkMercadoPago({
      mp_user_id: "MP-123",
      access_token: "APP_USR-abc",
      refresh_token: "TG-abc",
      expires_at: EXPIRES,
    });

    expect(wallet.hasMercadoPagoLink).toBe(true);
    expect(wallet.mp_token_expires_at).toEqual(EXPIRES);
    expect(wallet.notification.hasErrors()).toBe(false);
  });

  it("🔴 recusa vínculo SEM refresh_token", () => {
    // Sem refresh o vínculo morre em 180 dias e o músico reautoriza na mão —
    // provavelmente descobrindo isso quando uma gorjeta falhar, no palco.
    const wallet = novaCarteira();

    wallet.linkMercadoPago({
      mp_user_id: "MP-123",
      access_token: "APP_USR-abc",
      refresh_token: "  ",
      expires_at: EXPIRES,
    });

    expect(wallet.hasMercadoPagoLink).toBe(false);
    expect(wallet.notification.hasErrors()).toBe(true);
  });

  it("PERMITE revincular — diferente da subconta Asaas", () => {
    /*
     * Aqui não há segredo irrecuperável: o token expira a cada 180 dias e o
     * músico reautoriza quantas vezes quiser. Na subconta Asaas a `apiKey` só
     * vem uma vez, e sobrescrever apagaria a única cópia.
     */
    const wallet = novaCarteira();
    wallet.linkMercadoPago({
      mp_user_id: "MP-1",
      access_token: "a1",
      refresh_token: "r1",
      expires_at: EXPIRES,
    });

    wallet.linkMercadoPago({
      mp_user_id: "MP-2",
      access_token: "a2",
      refresh_token: "r2",
      expires_at: EXPIRES,
    });

    expect(wallet.mp_user_id).toBe("MP-2");
    expect(wallet.notification.hasErrors()).toBe(false);
  });

  it("renova os tokens sem mexer no vínculo", () => {
    const wallet = novaCarteira();
    wallet.linkMercadoPago({
      mp_user_id: "MP-1",
      access_token: "a1",
      refresh_token: "r1",
      expires_at: EXPIRES,
    });

    const novoVencimento = new Date("2027-08-15T00:00:00Z");
    wallet.refreshMercadoPagoTokens({
      access_token: "a2",
      refresh_token: "r2",
      expires_at: novoVencimento,
    });

    expect(wallet.mp_user_id).toBe("MP-1");
    expect(wallet.mp_access_token).toBe("a2");
    expect(wallet.mp_token_expires_at).toEqual(novoVencimento);
  });

  it("recusa renovar sem vínculo", () => {
    const wallet = novaCarteira();

    wallet.refreshMercadoPagoTokens({
      access_token: "a",
      refresh_token: "r",
      expires_at: EXPIRES,
    });

    expect(wallet.notification.hasErrors()).toBe(true);
  });

  it("desvincula sem deixar resíduo", () => {
    const wallet = novaCarteira();
    wallet.linkMercadoPago({
      mp_user_id: "MP-1",
      access_token: "a1",
      refresh_token: "r1",
      expires_at: EXPIRES,
    });

    wallet.unlinkMercadoPago();

    expect(wallet.hasMercadoPagoLink).toBe(false);
    expect(wallet.mp_refresh_token).toBeNull();
    expect(wallet.mp_token_expires_at).toBeNull();
  });

  describe("vencimento", () => {
    const AGORA = new Date("2027-02-14T00:00:00Z"); // 1 dia antes

    function carteiraVinculada(): MusicianWallet {
      const wallet = novaCarteira();
      wallet.linkMercadoPago({
        mp_user_id: "MP-1",
        access_token: "a1",
        refresh_token: "r1",
        expires_at: EXPIRES,
      });
      return wallet;
    }

    it("acusa vencimento dentro da folga", () => {
      // Folga de 7 dias: 1 dia restante está dentro.
      expect(
        carteiraVinculada().isMercadoPagoTokenExpiring(AGORA, 7 * 86_400_000),
      ).toBe(true);
    });

    it("não acusa fora da folga", () => {
      // Folga de 1 hora: 1 dia restante está fora.
      expect(
        carteiraVinculada().isMercadoPagoTokenExpiring(AGORA, 3_600_000),
      ).toBe(false);
    });

    it("carteira sem vínculo nunca está vencendo", () => {
      expect(
        novaCarteira().isMercadoPagoTokenExpiring(AGORA, 7 * 86_400_000),
      ).toBe(false);
    });
  });
});
