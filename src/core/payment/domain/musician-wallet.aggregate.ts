import { AggregateRoot } from "../../shared/domain/aggregate-root";
import { Money } from "../../shared/domain/value-objects/money.vo";
import { Uuid } from "../../shared/domain/value-objects/uuid.vo";
import { PixKeyChangedEvent } from "./events/pix-key-changed.event";
import { MusicianWalletFakeBuilder } from "./musician-wallet-fake.builder";
import { MusicianWalletValidatorFactory } from "./validators/musician-wallet.validator";
import { PixKey } from "./value-objects/pix-key.vo";

export type MusicianWalletConstructorProps = {
  wallet_id?: MusicianWalletId;
  musician_id: Uuid;
  balance: Money;
  total_earned: Money;
  total_withdrawn: Money;
  pix_key?: PixKey | null;
  /** Última vez que a chave PIX foi definida/alterada — base da carência de saque. */
  pix_key_changed_at?: Date | null;
  bank_account?: any | null; // Placeholder for BankAccount VO if needed
  held_balance?: Money;
  asaas_wallet_id?: string | null;
  asaas_api_key?: string | null;
  asaas_account_status?: string | null;
  escrow_enabled?: boolean;
  mp_user_id?: string | null;
  mp_access_token?: string | null;
  mp_refresh_token?: string | null;
  mp_token_expires_at?: Date | null;
  is_active?: boolean;
  created_at?: Date;
  updated_at?: Date;
};

export class MusicianWalletId extends Uuid {}

export class MusicianWallet extends AggregateRoot {
  wallet_id: MusicianWalletId;
  musician_id: Uuid;
  balance: Money;
  total_earned: Money;
  total_withdrawn: Money;
  pix_key: PixKey | null;
  /** Última vez que a chave PIX foi definida/alterada. `null` = nunca, ou legado. */
  pix_key_changed_at: Date | null;
  bank_account: any | null;
  /**
   * Cachê sob custódia — recebido, **ainda não liberado**.
   *
   * Fora de `balance` de propósito: dinheiro em custódia não é sacável, e
   * somá-lo ao saldo faria o app oferecer um saque que o gateway recusaria. E é
   * ESPELHO, não fonte: o valor está bloqueado na subconta do músico na
   * instituição de pagamento — a plataforma nunca o detém.
   */
  held_balance: Money;
  /** Subconta do músico na instituição de pagamento (F1.0). */
  asaas_wallet_id: string | null;
  /**
   * 🔴 Só existe no momento da criação da subconta e não pode ser recuperada
   * depois. Cifrada em repouso pelo mapper (mesma infra de SM-016).
   */
  asaas_api_key: string | null;
  /** Vocabulário do PROVEDOR — string, nunca enum nosso. */
  asaas_account_status: string | null;
  escrow_enabled: boolean;
  /**
   * Vínculo com a conta Mercado Pago do músico — o gateway da GORJETA.
   *
   * Aqui o dinheiro cai na conta DELE e a comissão sai por `application_fee`:
   * a plataforma nunca detém recurso de terceiro, mesma postura da subconta
   * Asaas. Por isso gorjeta não tem "saque pela plataforma" — ele saca no MP.
   */
  mp_user_id: string | null;
  /** 🔴 Cifrados em repouso pelo mapper. O access move dinheiro na conta dele. */
  mp_access_token: string | null;
  mp_refresh_token: string | null;
  mp_token_expires_at: Date | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;

  constructor(props: MusicianWalletConstructorProps) {
    super();
    this.wallet_id = props.wallet_id ?? new MusicianWalletId();
    this.musician_id = props.musician_id;
    this.balance = props.balance;
    this.total_earned = props.total_earned;
    this.total_withdrawn = props.total_withdrawn;
    this.pix_key = props.pix_key ?? null;
    this.pix_key_changed_at = props.pix_key_changed_at ?? null;
    this.bank_account = props.bank_account ?? null;
    this.held_balance = props.held_balance ?? new Money(0);
    this.asaas_wallet_id = props.asaas_wallet_id ?? null;
    this.asaas_api_key = props.asaas_api_key ?? null;
    this.asaas_account_status = props.asaas_account_status ?? null;
    this.escrow_enabled = props.escrow_enabled ?? false;
    this.mp_user_id = props.mp_user_id ?? null;
    this.mp_access_token = props.mp_access_token ?? null;
    this.mp_refresh_token = props.mp_refresh_token ?? null;
    this.mp_token_expires_at = props.mp_token_expires_at ?? null;
    this.is_active = props.is_active ?? true;
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  get entity_id(): MusicianWalletId {
    return this.wallet_id;
  }

  get value(): number {
    return this.balance.amount;
  }

  static create(command: { musician_id: string }): MusicianWallet {
    const wallet = new MusicianWallet({
      musician_id: new Uuid(command.musician_id),
      balance: new Money(0),
      total_earned: new Money(0),
      total_withdrawn: new Money(0),
    });
    wallet.validate();
    return wallet;
  }

  validate(fields?: string[]): boolean {
    const validator = MusicianWalletValidatorFactory.create();
    return validator.validate(this.notification, this, fields);
  }

  static fake() {
    return MusicianWalletFakeBuilder;
  }

  updatePixKey(pixKey: string, type: string): void {
    const next = new PixKey(pixKey, type);
    /*
     * A carência (A1 camada 2) só faz sentido para uma MUDANÇA de destino.
     * Regravar exatamente a mesma chave — retry do cliente, re-salvar o perfil
     * sem editar — não deve rearmar o relógio nem, mais tarde, travar um saque
     * legítimo. Por isso a data só avança quando a chave de fato muda.
     */
    const changed =
      !this.pix_key ||
      this.pix_key.key !== next.key ||
      this.pix_key.type !== next.type;

    this.pix_key = next;
    if (changed) {
      this.pix_key_changed_at = new Date();
      // Dispara a notificação antifraude — só quando o destino de fato muda.
      this.applyEvent(new PixKeyChangedEvent(this.wallet_id, this.musician_id));
    }
    this.updated_at = new Date();
    this.validate(["pix_key"]);
  }

  /**
   * Falta para a chave PIX sair da carência, em milissegundos. `0` = liberada.
   *
   * Base da defesa contra takeover: um token comprometido que troca a chave e
   * tenta sacar na sequência esbarra nesta janela, que dá ao dono tempo de
   * reagir à notificação de "sua chave PIX foi alterada". Sem `pix_key_changed_at`
   * (carteira legada, ou chave nunca trocada dentro da janela) não há carência.
   */
  pixKeyCooldownRemainingMs(
    cooldownMs: number,
    now: Date = new Date(),
  ): number {
    if (cooldownMs <= 0 || !this.pix_key_changed_at) {
      return 0;
    }
    const elapsed = now.getTime() - this.pix_key_changed_at.getTime();
    return Math.max(0, cooldownMs - elapsed);
  }

  /*
   * A aritmética monetária deste agregado é exata porque `Money.add`/`subtract`
   * operam em CENTAVOS INTEIROS — ver `money.vo.ts`.
   *
   * 🔴 Enquanto operavam em ponto flutuante, a imprecisão não degradava o
   * valor: ela **lançava**, porque o construtor recusa mais de duas casas.
   * `150.30 - 110` dá `40.30000000000001`, e o saque de um músico com R$150,30
   * — saldo com centavos é o caso normal de quem soma gorjetas — simplesmente
   * falhava.
   */
  receiveFunds(amount: number): void {
    if (amount <= 0) {
      this.notification.addError("Amount must be greater than 0", "amount");
      return;
    }
    const money = new Money(amount);
    this.balance = this.balance.add(money);
    this.total_earned = this.total_earned.add(money);
    this.updated_at = new Date();
  }

  withdrawFunds(amount: number): void {
    if (amount <= 0) {
      this.notification.addError("Amount must be greater than 0", "amount");
      return;
    }
    const money = new Money(amount);
    if (this.balance.isLessThan(money)) {
      this.notification.addError("Insufficient funds", "balance");
      return;
    }
    this.balance = this.balance.subtract(money);
    this.total_withdrawn = this.total_withdrawn.add(money);
    this.updated_at = new Date();
  }

  /**
   * O saque não aconteceu: o valor volta a ser sacável.
   *
   * 🔴 Desfaz `withdrawFunds` INTEIRO — devolve `balance` **e** reverte
   * `total_withdrawn`. Devolver só o saldo deixaria o extrato afirmando um
   * saque que o provedor recusou, e `total_withdrawn` é o número que o músico
   * confere contra o próprio banco.
   *
   * Chamado no caminho de rejeição do gateway e pelo webhook TRANSFER_FAILED /
   * TRANSFER_CANCELLED. Quem garante que não roda duas vezes para a mesma
   * transferência é o estado `pending` da transação, conferido dentro da mesma
   * transação de banco.
   */
  refundWithdrawal(amount: number): void {
    if (amount <= 0) {
      this.notification.addError("Amount must be greater than 0", "amount");
      return;
    }

    const money = new Money(amount);
    if (this.total_withdrawn.isLessThan(money)) {
      this.notification.addError(
        "Estorno maior que o total sacado",
        "total_withdrawn",
      );
      return;
    }

    this.balance = this.balance.add(money);
    this.total_withdrawn = this.total_withdrawn.subtract(money);
    this.updated_at = new Date();
  }

  // ── Subconta na instituição de pagamento (F1.0) ───────────────────────────

  /**
   * Vincula a subconta recém-criada no provedor.
   *
   * 🔴 **A `apiKey` chega uma única vez, na resposta da criação.** O provedor
   * não a devolve depois — perder aqui é ter de recriar a subconta, o que
   * significa outro KYC e outro período de avaliação. Por isso este método
   * **recusa** vincular sem ela e recusa sobrescrever um vínculo existente:
   * sobrescrever apagaria a única cópia da chave da subconta antiga, deixando
   * dinheiro custodiado num lugar que ninguém mais consegue operar.
   */
  linkSubaccount(command: {
    wallet_id: string;
    api_key: string;
    account_status?: string | null;
  }): void {
    if (this.asaas_wallet_id !== null) {
      this.notification.addError(
        "Esta carteira já tem subconta vinculada",
        "asaas_wallet_id",
      );
      return;
    }
    if (!command.wallet_id?.trim() || !command.api_key?.trim()) {
      this.notification.addError(
        "Subconta exige wallet_id e api_key",
        "asaas_wallet_id",
      );
      return;
    }

    this.asaas_wallet_id = command.wallet_id.trim();
    this.asaas_api_key = command.api_key.trim();
    this.asaas_account_status = command.account_status ?? null;
    this.updated_at = new Date();
  }

  /** Telemetria do provedor (aprovação de KYC, bloqueio, etc). */
  changeAccountStatus(status: string | null): void {
    this.asaas_account_status = status;
    this.updated_at = new Date();
  }

  get hasSubaccount(): boolean {
    return this.asaas_wallet_id !== null;
  }

  /**
   * Liga a Conta Escrow desta subconta.
   *
   * Custa por subconta habilitada (R$9,90/mês), então ligar é decisão de
   * domínio — tomada quando existe booking a custodiar, não no cadastro.
   * Sem subconta não há o que habilitar.
   */
  enableEscrow(): void {
    if (!this.hasSubaccount) {
      this.notification.addError(
        "Não é possível habilitar custódia sem subconta",
        "escrow_enabled",
      );
      return;
    }
    this.escrow_enabled = true;
    this.updated_at = new Date();
  }

  /**
   * 🔴 Desligar a Conta Escrow no provedor **libera imediatamente tudo que
   * ainda está sob garantia**. Por isso o agregado recusa desligar com saldo
   * custodiado: seria transformar uma economia de R$9,90 num pagamento
   * antecipado de show que talvez nem tenha acontecido.
   */
  disableEscrow(): void {
    if (this.held_balance.amount > 0) {
      this.notification.addError(
        "Não é possível desabilitar custódia com valor ainda retido",
        "escrow_enabled",
      );
      return;
    }
    this.escrow_enabled = false;
    this.updated_at = new Date();
  }

  // ── Vínculo Mercado Pago (gorjeta) ────────────────────────────────────────

  /**
   * Vincula (ou revincula) a conta Mercado Pago do músico.
   *
   * Diferente de `linkSubaccount`, aqui **revincular é permitido**: o token
   * expira a cada 180 dias e o músico pode reautorizar quantas vezes precisar.
   * Não há segredo irrecuperável para proteger — se ele reautoriza, o par de
   * tokens novo simplesmente substitui o velho.
   */
  linkMercadoPago(command: {
    mp_user_id: string;
    access_token: string;
    refresh_token: string;
    expires_at: Date;
  }): void {
    if (
      !command.mp_user_id?.trim() ||
      !command.access_token?.trim() ||
      !command.refresh_token?.trim()
    ) {
      this.notification.addError(
        "Vínculo Mercado Pago exige mp_user_id, access_token e refresh_token",
        "mp_user_id",
      );
      return;
    }

    /*
     * 🔴 O `refresh_token` é obrigatório, e não opcional "por robustez".
     *
     * Sem ele o vínculo morre em 180 dias e o músico tem de reautorizar na mão —
     * provavelmente descobrindo isso quando uma gorjeta falhar, no palco. O
     * fluxo tem de pedir `scope=offline_access`; guardar um vínculo sem refresh
     * é guardar uma bomba-relógio.
     */
    this.mp_user_id = command.mp_user_id.trim();
    this.mp_access_token = command.access_token.trim();
    this.mp_refresh_token = command.refresh_token.trim();
    this.mp_token_expires_at = command.expires_at;
    this.updated_at = new Date();
  }

  /** Renovação silenciosa pelo job — não mexe no `mp_user_id`. */
  refreshMercadoPagoTokens(command: {
    access_token: string;
    refresh_token: string;
    expires_at: Date;
  }): void {
    if (!this.hasMercadoPagoLink) {
      this.notification.addError(
        "Não há vínculo Mercado Pago para renovar",
        "mp_user_id",
      );
      return;
    }

    this.mp_access_token = command.access_token;
    this.mp_refresh_token = command.refresh_token;
    this.mp_token_expires_at = command.expires_at;
    this.updated_at = new Date();
  }

  /**
   * O músico desvincula a conta.
   *
   * Não há saldo a proteger aqui — diferente da custódia, a gorjeta já caiu na
   * conta dele no momento do pagamento. Desvincular só impede gorjetas novas.
   */
  unlinkMercadoPago(): void {
    this.mp_user_id = null;
    this.mp_access_token = null;
    this.mp_refresh_token = null;
    this.mp_token_expires_at = null;
    this.updated_at = new Date();
  }

  get hasMercadoPagoLink(): boolean {
    return this.mp_user_id !== null && this.mp_access_token !== null;
  }

  /**
   * O token venceu (ou vence dentro da folga)?
   *
   * A folga existe porque renovar em cima da hora é renovar tarde: entre o job
   * decidir e a chamada chegar ao provedor, um token com 30 segundos de vida
   * pode morrer no meio de uma gorjeta.
   */
  isMercadoPagoTokenExpiring(now: Date, slackMs: number): boolean {
    if (!this.hasMercadoPagoLink || this.mp_token_expires_at === null) {
      return false;
    }
    return this.mp_token_expires_at.getTime() - now.getTime() <= slackMs;
  }

  /**
   * Ganho que já foi liquidado **fora** da plataforma.
   *
   * 🔴 Cresce `total_earned` e **não toca `balance`** — e essa distinção é
   * dinheiro de verdade.
   *
   * Desde que a gorjeta passou a ser criada na conta Mercado Pago do próprio
   * músico (split com `application_fee`), o valor **já está com ele** no
   * instante em que o pagamento aprova. Creditar `balance` aqui produziria um
   * saldo sacável de dinheiro que a plataforma nunca recebeu — e o saque sai do
   * `AsaasGatewayAdapter`, ou seja, **da conta da plataforma**. Um músico com
   * R$1.000 em gorjetas sacaria R$1.000 que sairiam do nosso caixa.
   *
   * `total_earned` continua crescendo porque a afirmação dele é "quanto este
   * músico já ganhou", e isso permanece verdadeiro — é o que alimenta o extrato.
   */
  recordExternalEarning(amount: number): void {
    if (amount <= 0) {
      this.notification.addError("Amount must be greater than 0", "amount");
      return;
    }

    this.total_earned = this.total_earned.add(new Money(amount));
    this.updated_at = new Date();
  }

  // ── Custódia ──────────────────────────────────────────────────────────────

  /**
   * Entra dinheiro em custódia.
   *
   * **Não toca `balance` nem `total_earned`.** O músico ainda não ganhou —
   * ganhou quando o show acontece e a custódia é liberada. Creditar aqui faria
   * o app anunciar um ganho que pode ser estornado.
   */
  holdFunds(amount: number): void {
    if (amount <= 0) {
      this.notification.addError("Amount must be greater than 0", "amount");
      return;
    }
    this.held_balance = this.held_balance.add(new Money(amount));
    this.updated_at = new Date();
  }

  /**
   * Custódia liberada: o valor sai de retido e vira saldo sacável.
   *
   * É **aqui** que `total_earned` cresce — é o momento em que o serviço foi
   * prestado e a remuneração passou a ser devida, exatamente como a cláusula
   * `papel_da_plataforma.com_custodia` descreve.
   */
  releaseHeldFunds(amount: number): void {
    if (amount <= 0) {
      this.notification.addError("Amount must be greater than 0", "amount");
      return;
    }
    const money = new Money(amount);
    if (this.held_balance.isLessThan(money)) {
      this.notification.addError("Insufficient held funds", "held_balance");
      return;
    }

    this.held_balance = this.held_balance.subtract(money);
    this.balance = this.balance.add(money);
    this.total_earned = this.total_earned.add(money);
    this.updated_at = new Date();
  }

  /**
   * Custódia devolvida ao estabelecimento.
   *
   * Só reduz o retido: o dinheiro nunca foi do músico, então não passa por
   * `balance` nem por `total_earned` em momento nenhum. Um estorno que
   * transitasse pelo saldo deixaria rastro de um ganho que não existiu.
   */
  refundHeldFunds(amount: number): void {
    if (amount <= 0) {
      this.notification.addError("Amount must be greater than 0", "amount");
      return;
    }
    const money = new Money(amount);
    if (this.held_balance.isLessThan(money)) {
      this.notification.addError("Insufficient held funds", "held_balance");
      return;
    }

    this.held_balance = this.held_balance.subtract(money);
    this.updated_at = new Date();
  }

  toJSON() {
    return {
      wallet_id: this.wallet_id.id,
      musician_id: this.musician_id.id,
      balance: this.balance.amount,
      total_earned: this.total_earned.amount,
      total_withdrawn: this.total_withdrawn.amount,
      pix_key: this.pix_key?.key ?? null,
      bank_account: this.bank_account,
      held_balance: this.held_balance.amount,
      asaas_wallet_id: this.asaas_wallet_id,
      // 🔴 `asaas_api_key` NUNCA sai daqui. `toJSON` alimenta output de
      // use-case, log e presenter — e essa chave move dinheiro na subconta.
      asaas_account_status: this.asaas_account_status,
      escrow_enabled: this.escrow_enabled,
      // 🔴 Só o vínculo, NUNCA os tokens: `toJSON` alimenta output de use-case,
      // log e presenter, e o access_token move dinheiro na conta do músico.
      mp_user_id: this.mp_user_id,
      mp_linked: this.hasMercadoPagoLink,
      is_active: this.is_active,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}
