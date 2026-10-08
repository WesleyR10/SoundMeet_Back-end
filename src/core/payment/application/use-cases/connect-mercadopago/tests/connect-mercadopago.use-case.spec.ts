import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import {
  InvalidOAuthStateError,
  OAuthStateService,
} from "../../../../../shared/infra/crypto/oauth-state.service";
import { MusicianWallet } from "../../../../domain/musician-wallet.aggregate";
import { MusicianWalletInMemoryRepository } from "../../../../infra/db/in-memory/musician-wallet-in-memory.repository";
import {
  IMercadoPagoOAuthGateway,
  MercadoPagoTokens,
} from "../../../../infra/gateways/mercadopago-oauth.gateway";
import { CompleteMercadoPagoConnectionUseCase } from "../complete-mercadopago-connection.use-case";
import { ConnectMercadoPagoUseCase } from "../connect-mercadopago.use-case";
import { DisconnectMercadoPagoUseCase } from "../disconnect-mercadopago.use-case";

const MUSICIAN_ID = "22222222-2222-4222-8222-222222222222";
const OUTRO_MUSICO = "33333333-3333-4333-8333-333333333333";
const EXPIRES = new Date("2027-02-15T00:00:00Z");

class FakeOAuth implements IMercadoPagoOAuthGateway {
  exchanged: string[] = [];
  refreshed: string[] = [];
  next: MercadoPagoTokens = {
    mp_user_id: "MP-999",
    access_token: "APP_USR-novo",
    refresh_token: "TG-novo",
    expires_at: EXPIRES,
  };

  buildAuthorizationUrl(state: string): string {
    return `https://auth.mercadopago.com/authorization?state=${state}`;
  }

  async exchangeCode(code: string): Promise<MercadoPagoTokens> {
    this.exchanged.push(code);
    return this.next;
  }

  async refresh(refreshToken: string): Promise<MercadoPagoTokens> {
    this.refreshed.push(refreshToken);
    return this.next;
  }
}

describe("Vínculo Mercado Pago", () => {
  let walletRepo: MusicianWalletInMemoryRepository;
  let oauth: FakeOAuth;
  let state: OAuthStateService;

  beforeEach(() => {
    walletRepo = new MusicianWalletInMemoryRepository();
    oauth = new FakeOAuth();
    state = new OAuthStateService("segredo-de-teste", "mp_connect");
  });

  describe("ConnectMercadoPagoUseCase", () => {
    it("devolve a URL com o state assinado", async () => {
      const useCase = new ConnectMercadoPagoUseCase(oauth, state);

      const { authorization_url } = await useCase.execute({
        musician_id: MUSICIAN_ID,
      });

      const assinado = new URL(authorization_url).searchParams.get("state")!;
      expect(state.verify(assinado)).toEqual({ musician_id: MUSICIAN_ID });
    });
  });

  describe("CompleteMercadoPagoConnectionUseCase", () => {
    function buildUseCase() {
      return new CompleteMercadoPagoConnectionUseCase(walletRepo, oauth, state);
    }

    it("cria a carteira quando ainda não existe e vincula", async () => {
      // O músico pode conectar o MP antes da primeira gorjeta; exigir carteira
      // prévia seria uma ordem de cadastro que não existe no produto.
      const output = await buildUseCase().execute({
        code: "TG-code",
        state: state.sign(MUSICIAN_ID),
      });

      expect(output.mp_user_id).toBe("MP-999");
      const wallet = await walletRepo.findByMusicianId(MUSICIAN_ID);
      expect(wallet!.hasMercadoPagoLink).toBe(true);
      expect(wallet!.mp_access_token).toBe("APP_USR-novo");
    });

    it("vincula numa carteira já existente sem duplicar", async () => {
      await walletRepo.insert(
        MusicianWallet.create({ musician_id: MUSICIAN_ID }),
      );

      await buildUseCase().execute({
        code: "TG-code",
        state: state.sign(MUSICIAN_ID),
      });

      expect(walletRepo.items).toHaveLength(1);
      expect(walletRepo.items[0].hasMercadoPagoLink).toBe(true);
    });

    it("🔴 recusa state adulterado ANTES de gastar o code", async () => {
      /*
       * O callback chega pelo navegador, sem Bearer token. Sem a verificação da
       * assinatura, qualquer um montaria um `state` apontando para outro músico
       * e vincularia a própria conta de pagamento à conta dele.
       */
      await expect(
        buildUseCase().execute({
          code: "TG-code",
          state: state.sign(MUSICIAN_ID).replace(/.$/, "X"),
        }),
      ).rejects.toBeInstanceOf(InvalidOAuthStateError);

      expect(oauth.exchanged).toHaveLength(0);
      expect(walletRepo.items).toHaveLength(0);
    });

    it("🔴 recusa state emitido para OUTRO propósito", async () => {
      // Um `state` do fluxo de calendário não pode vincular conta que recebe
      // dinheiro — é o que o `purpose` impede.
      const outroFluxo = new OAuthStateService(
        "segredo-de-teste",
        "gcal_connect",
      );

      await expect(
        buildUseCase().execute({
          code: "TG-code",
          state: outroFluxo.sign(MUSICIAN_ID),
        }),
      ).rejects.toBeInstanceOf(InvalidOAuthStateError);

      expect(oauth.exchanged).toHaveLength(0);
    });

    it("recusa vínculo quando o provedor não devolve refresh_token", async () => {
      // Sem refresh o vínculo morre em 180 dias e o músico descobre no palco.
      oauth.next = { ...oauth.next, refresh_token: "" };

      await expect(
        buildUseCase().execute({
          code: "TG-code",
          state: state.sign(MUSICIAN_ID),
        }),
      ).rejects.toBeInstanceOf(EntityValidationError);
    });

    it("vincula ao músico do STATE, nunca a outro", async () => {
      await buildUseCase().execute({
        code: "TG-code",
        state: state.sign(OUTRO_MUSICO),
      });

      expect(await walletRepo.findByMusicianId(MUSICIAN_ID)).toBeNull();
      expect(
        (await walletRepo.findByMusicianId(OUTRO_MUSICO))!.hasMercadoPagoLink,
      ).toBe(true);
    });
  });

  describe("DisconnectMercadoPagoUseCase", () => {
    it("desvincula sem exigir saldo zerado — a gorjeta já é dele", async () => {
      const wallet = MusicianWallet.create({ musician_id: MUSICIAN_ID });
      wallet.linkMercadoPago({
        mp_user_id: "MP-1",
        access_token: "a",
        refresh_token: "r",
        expires_at: EXPIRES,
      });
      await walletRepo.insert(wallet);

      const output = await new DisconnectMercadoPagoUseCase(walletRepo).execute(
        { musician_id: MUSICIAN_ID },
      );

      expect(output.linked).toBe(false);
      expect(
        (await walletRepo.findByMusicianId(MUSICIAN_ID))!.hasMercadoPagoLink,
      ).toBe(false);
    });

    it("404 quando não há carteira", async () => {
      await expect(
        new DisconnectMercadoPagoUseCase(walletRepo).execute({
          musician_id: MUSICIAN_ID,
        }),
      ).rejects.toThrow(/Not Found/i);
    });
  });
});
