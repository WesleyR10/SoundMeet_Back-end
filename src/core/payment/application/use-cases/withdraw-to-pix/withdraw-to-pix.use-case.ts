import { MusicianWallet, PaymentMethod, Transaction } from "@core/payment";
import {
  IMusicianWalletRepository,
  ITransactionRepository,
} from "@core/payment/domain/repositories";
import { TransactionType } from "@core/payment/domain/transaction-enums";
import {
  IPixWithdrawGateway,
  PixWithdrawRejectedError,
} from "@core/payment/infra/gateways/pix-withdraw-gateway.interface";
import { PlanCheckService } from "@core/plans/domain/plan-check.service";
import { IUseCase } from "@core/shared/application/use-case.interface";
import { IEmailVerificationChecker } from "@core/shared/domain/email-verification.checker";
import {
  ConflictError,
  EmailNotVerifiedError,
  NotFoundError,
} from "@core/shared/domain/errors";
import { InvalidOperationError } from "@core/shared/domain/errors/invalid-operation.error";
import { IUnitOfWork } from "@core/shared/domain/repository/unit-of-work.interface";
import { EntityValidationError } from "@core/shared/domain/validators/validation.error";

import { RefundFailedWithdrawUseCase } from "../refund-failed-withdraw/refund-failed-withdraw.use-case";

export type WithdrawToPixInput = {
  musician_id: string;
  amount: number;
  /**
   * 🔴 A chave de destino NÃO entra por aqui — é sempre a que está cadastrada
   * na carteira (`wallet.pix_key`). Aceitar o destino no próprio pedido de
   * saque transformava um token comprometido em um único POST que drena o
   * saldo para a conta do atacante e ainda apaga a chave legítima no caminho.
   * Trocar de chave é operação à parte (`PATCH .../wallet/pix-key`), que é onde
   * a carência e a notificação de segurança devem viver. Ver
   * `Docs/audits/security-review-2026-08-28.md` (A1).
   */
  idempotency_key?: string | null;
};

export type WithdrawToPixOutput = {
  transaction_id: string;
  wallet_balance: number;
  status: string;
  min_withdrawal_amount_brl: number;
  withdrawal_days: number;
};

/** Limites de saque resolvidos pelo plano do músico (ou defaults). */
type WithdrawalLimits = {
  min_amount_brl: number;
  days: number;
  /** Teto de valor nas últimas 24h. `null` = sem teto próprio. */
  max_per_day_brl: number | null;
  /** Teto de contagem nas últimas 24h (velocity). `null` = sem limite. */
  max_count_per_day: number | null;
};

/** Janela deslizante do teto/velocity de saque. */
const WITHDRAWAL_WINDOW_MS = 24 * 3_600_000;

/**
 * O que a reserva produziu, e o que o despacho precisa saber.
 *
 * `pix_key` viaja aqui em vez de ser relida do input porque num reenvio ela
 * vem da carteira — o destino que a reserva original registrou.
 */
type Reservation = {
  transaction: Transaction;
  wallet_balance: number;
  replayed: boolean;
  /**
   * Destino já resolvido a partir da carteira. `null` só é possível no replay
   * de um saque já concluído (que não fala com o provedor de novo) — o caminho
   * de despacho exige a chave e recusa se ela faltar.
   */
  pix_key: { key: string; type: string } | null;
};

export type WithdrawToPixDeps = {
  walletRepo: IMusicianWalletRepository;
  txRepo: ITransactionRepository;
  /**
   * Reserva e transferência real são a MESMA operação de dinheiro, e nenhuma
   * das duas escritas da reserva faz sentido sozinha: uma carteira debitada
   * sem lançamento é dinheiro que sumiu, um lançamento sem débito é saldo que
   * pode ser sacado de novo.
   */
  uow: IUnitOfWork;
  refundUseCase: RefundFailedWithdrawUseCase;
  /**
   * 🔴 **Obrigatório, não opcional.** Um `?` aqui faria o gate de e-mail sumir
   * em silêncio no dia em que alguém montasse o use-case sem passá-lo — e o
   * sintoma seria dinheiro saindo de conta não confirmada, sem erro nenhum.
   * Sendo obrigatório, esquecê-lo é erro de compilação. Mesmo raciocínio que
   * pôs o escopo de dono na assinatura de `findByIdempotencyKey`.
   */
  emailVerificationChecker: IEmailVerificationChecker;
  pixWithdrawGateway?: IPixWithdrawGateway;
  planCheckService?: PlanCheckService;
  /**
   * Carência após troca de chave PIX, em MILISSEGUNDOS (A1 camada 2). Saque para
   * uma chave trocada há menos que isto é bloqueado. `0`/ausente desliga.
   */
  pixKeyChangeCooldownMs?: number;
};

/**
 * Saque PIX do saldo do músico.
 *
 * ## A ordem é RESERVA → PROVEDOR, e é o oposto da custódia
 *
 * Em `ReleaseBookingEscrowUseCase` o provedor vem primeiro, porque lá o
 * dinheiro já está lá e o nosso registro é espelho. Aqui é o contrário: a
 * transferência **cria** o fato, e quem autoriza é o saldo que só nós
 * conhecemos. Chamar o provedor antes de persistir o débito — como este
 * use-case fazia — deixava a janela inteira da chamada HTTP com o saldo antigo
 * visível no banco:
 *
 * > dois saques simultâneos liam R$200, os dois passavam pela checagem de
 * > fundos, os dois disparavam transferência real de R$110, e a segunda
 * > escrita sobrescrevia a primeira a partir do mesmo snapshot. Resultado:
 * > R$220 saindo da conta, R$110 debitados. O músico recebia o dobro e o
 * > extrato não registrava nada de errado.
 *
 * Reservar primeiro inverte o custo do erro: se o provedor falha depois da
 * reserva, o pior caso é saldo temporariamente indisponível — recuperável, e
 * visível. Um pagamento duplicado não é nem uma coisa nem outra.
 *
 * ## As três barreiras, e por que nenhuma substitui a outra
 *
 * 1. **Lock da carteira** (`findByMusicianIdForUpdate`) serializa execuções
 *    concorrentes do mesmo músico. É o que faz a invariante de saldo do
 *    agregado voltar a valer sob concorrência.
 * 2. **Saldo insuficiente** barra o segundo saque quando não há fundo para os
 *    dois. Mas com saldo sobrando os dois seriam legítimos — e o lock, sozinho,
 *    executaria os dois em fila, obediente.
 * 3. **Chave de idempotência** cobre exatamente esse caso: o duplo clique e o
 *    retry de rede, em que os dois pedidos são um só. Vem do cliente porque só
 *    ele sabe distinguir "pedi de novo" de "quero sacar de novo".
 *
 * ## Falha do provedor: recusa e silêncio não são a mesma coisa
 *
 * Recusa conclusiva (`PixWithdrawRejectedError`) estorna na hora. Timeout, 5xx
 * ou erro de rede **não** estornam: a transferência pode ter sido processada
 * com a resposta perdida no caminho, e devolver o saldo aí reabriria o duplo
 * pagamento pela porta dos fundos. O desempate é consultar o provedor pela
 * referência que nós mesmos geramos; sem resposta, a transação fica `pending`
 * para o webhook resolver — o lado seguro de "não sei" é não mexer no dinheiro.
 */
export class WithdrawToPixUseCase implements IUseCase<
  WithdrawToPixInput,
  WithdrawToPixOutput
> {
  constructor(private readonly deps: WithdrawToPixDeps) {}

  async execute(input: WithdrawToPixInput): Promise<WithdrawToPixOutput> {
    /*
     * 🔴 Gate de e-mail confirmado — a PRIMEIRA coisa, antes de qualquer
     * leitura de plano e muito antes de `reserve()`.
     *
     * Fica aqui, e não dentro da reserva, de propósito: é pré-condição de
     * negócio, não parte da mecânica de dinheiro. As três barreiras de
     * concorrência (lock `FOR UPDATE`, saldo, chave de idempotência) e a ordem
     * reserva → provedor são invariantes provadas contra Postgres real em
     * `test/payment/withdraw-concurrency.e2e-spec.ts`; enfiar uma consulta a
     * mais lá dentro alargaria a janela do lock sem necessidade nenhuma.
     *
     * Por que o saque é o gate: é a única ação do produto que move dinheiro
     * PARA FORA em definitivo. Um e-mail não confirmado é um canal de
     * recuperação de conta que ninguém provou existir — exatamente o que um
     * invasor precisa que continue assim.
     */
    const emailVerified =
      await this.deps.emailVerificationChecker.isMusicianEmailVerified(
        input.musician_id,
      );
    if (!emailVerified) {
      throw new EmailNotVerifiedError(
        "Confirme seu e-mail antes de sacar. Reenviamos o link se você não o encontrar.",
      );
    }

    const withdrawalConfig: WithdrawalLimits = this.deps.planCheckService
      ? await this.deps.planCheckService.getMusicianWithdrawalConfig(
          input.musician_id,
        )
      : {
          min_amount_brl: 110,
          days: 5,
          max_per_day_brl: null,
          max_count_per_day: null,
        };

    if (input.amount < withdrawalConfig.min_amount_brl) {
      throw new EntityValidationError([
        {
          amount: [
            `Valor mínimo de saque para seu plano é R$${withdrawalConfig.min_amount_brl.toFixed(2)}`,
          ],
        },
      ]);
    }

    const reservation = await this.reserve(input, withdrawalConfig);

    const transaction = await this.dispatch(reservation);

    return {
      transaction_id: transaction.transaction_id.id,
      wallet_balance: reservation.wallet_balance,
      status: transaction.status,
      min_withdrawal_amount_brl: withdrawalConfig.min_amount_brl,
      withdrawal_days: withdrawalConfig.days,
    };
  }

  /**
   * Debita e registra o lançamento numa transação só, com a carteira travada.
   *
   * Devolve `replayed: true` quando a chave de idempotência já tinha uma
   * transação — nesse caso nada foi debitado agora.
   */
  private async reserve(
    input: WithdrawToPixInput,
    limits: WithdrawalLimits,
  ): Promise<Reservation> {
    try {
      return await this.tryReserve(input, limits);
    } catch (error) {
      /*
       * 🔴 A recuperação da colisão acontece FORA da transação, e essa é a
       * única forma que funciona.
       *
       * Corrida entre dois pedidos com a MESMA chave: os dois passaram pelo
       * `find` antes de qualquer um inserir, e quem perde recebe a violação do
       * UNIQUE — é para isso que a garantia mora no banco, e não no `find`.
       * Mas no Postgres uma query que falha **aborta a transação inteira**:
       * qualquer consulta seguinte no mesmo cliente responde
       * `25P02 current transaction is aborted`. Tentar reconsultar o vencedor
       * ainda lá dentro trocaria um erro claro por um obscuro.
       *
       * Deixando o erro propagar, o rollback desfaz o débito deste ramo e a
       * releitura acontece numa conexão sã.
       *
       * ⚠️ A releitura é ESCOPADA pelo músico, então ela devolve `null` quando
       * a violação veio da chave de OUTRA pessoa (o UNIQUE da coluna é global,
       * a chave é escolhida pelo cliente). Nesse caso o `ConflictError` sobe,
       * que é o resultado certo: nada foi reservado, nada vazou, e quem pediu
       * escolhe outra chave. Antes do escopo, este mesmo caminho devolvia a
       * transação alheia como se fosse um reenvio.
       */
      if (error instanceof ConflictError && input.idempotency_key) {
        const winner = await this.deps.txRepo.findByIdempotencyKey(
          input.idempotency_key,
          input.musician_id,
        );
        if (winner) {
          return this.toReplay(winner, input);
        }
      }
      throw error;
    }
  }

  private async tryReserve(
    input: WithdrawToPixInput,
    limits: WithdrawalLimits,
  ): Promise<Reservation> {
    return this.deps.uow.do(async () => {
      if (input.idempotency_key) {
        const existing = await this.deps.txRepo.findByIdempotencyKey(
          input.idempotency_key,
          input.musician_id,
        );
        if (existing) {
          return this.toReplay(existing, input);
        }
      }

      const wallet = await this.deps.walletRepo.findByMusicianIdForUpdate(
        input.musician_id,
      );
      if (!wallet) {
        throw new NotFoundError(input.musician_id, MusicianWallet);
      }

      /*
       * O destino é a chave já cadastrada — nunca uma do corpo do pedido. Sem
       * chave cadastrada, não há para onde sacar: erro acionável, e não um
       * saque para lugar nenhum.
       */
      const pixKey = wallet.pix_key;
      if (!pixKey) {
        throw new EntityValidationError([
          {
            pix_key: [
              "Cadastre sua chave PIX de recebimento antes de solicitar um saque.",
            ],
          },
        ]);
      }

      /*
       * Carência pós-troca de chave (A1 camada 2). Bloqueia sacar para uma chave
       * recém-trocada — a janela dá ao dono tempo de reagir à notificação de
       * alteração antes de o dinheiro sair, que é a defesa contra o token
       * comprometido que troca a chave e saca na sequência.
       */
      const cooldownRemainingMs = wallet.pixKeyCooldownRemainingMs(
        this.deps.pixKeyChangeCooldownMs ?? 0,
      );
      if (cooldownRemainingMs > 0) {
        const hours = Math.ceil(cooldownRemainingMs / 3_600_000);
        throw new InvalidOperationError(
          `Sua chave PIX foi alterada recentemente. Por segurança, o saque para a nova chave é liberado em aproximadamente ${hours}h.`,
        );
      }

      /*
       * Teto diário de valor e de contagem (A1 antifraude). A soma é lida DENTRO
       * desta transação com o lock da carteira: fora dela, dois saques
       * concorrentes leriam a mesma soma antiga e furariam o teto juntos. Conta
       * PENDING + COMPLETED das últimas 24h — a reserva do concorrente já é
       * PENDING e entra na conta.
       */
      await this.assertDailyLimits(input, limits);

      wallet.withdrawFunds(input.amount);

      if (wallet.notification.hasErrors()) {
        throw new EntityValidationError(wallet.notification.toJSON());
      }

      const transaction = Transaction.create({
        musician_id: input.musician_id,
        type: TransactionType.WITHDRAWAL,
        amount: input.amount,
        fee: 0,
        payment_method: PaymentMethod.PIX,
        idempotency_key: input.idempotency_key ?? null,
        metadata: { kind: "withdraw" },
      });

      /*
       * 🔴 O LANÇAMENTO É INSERIDO ANTES DO DÉBITO SER PERSISTIDO.
       *
       * As duas escritas estão na mesma transação, então o rollback cobriria a
       * ordem inversa — mas depender do rollback para não debitar é depender de
       * uma garantia que some no dia em que alguém injetar um repositório sem
       * UnitOfWork (o provider já constrói os repos ligados à UoW justamente
       * por isso, e é uma linha de configuração de distância de deixar de
       * fazê-lo). Nesta ordem, a colisão do UNIQUE aborta antes de a carteira
       * ser tocada, e o pior caso deixa de ser "saldo debitado sem saque".
       *
       * A colisão em si é tratada em `reserve`, fora desta transação.
       */
      await this.deps.txRepo.insert(transaction);

      await this.deps.walletRepo.update(wallet);

      return {
        transaction,
        wallet_balance: wallet.balance.amount,
        replayed: false,
        pix_key: { key: pixKey.key, type: pixKey.type },
      };
    });
  }

  /**
   * Monta o resultado de um reenvio, conferindo que ele descreve o MESMO saque.
   *
   * 🔴 Mesma chave com valor diferente não é retry, é chave reutilizada — e
   * devolver em silêncio a transação de R$110 para quem pediu R$500 faria o
   * app confirmar um saque que o músico não solicitou, com um valor que ele não
   * escolheu. Recusar é a única resposta que não inventa uma intenção.
   *
   * A chave PIX devolvida é a que está cadastrada na carteira: o dinheiro vai
   * para o destino que o saque original mandou, que é o único destino que este
   * fluxo conhece.
   */
  /**
   * Teto de valor e de contagem de saques nas últimas 24h (A1 antifraude).
   *
   * Limita a drenagem de um token comprometido sem travar o saque legítimo: o
   * teto por tier é alinhado ao limite do provedor de saída (Asaas PF), e a
   * contagem barra a drenagem por muitos saques pequenos que o teto de valor
   * deixaria passar. Ambos `null` desligam a respectiva checagem.
   */
  private async assertDailyLimits(
    input: WithdrawToPixInput,
    limits: WithdrawalLimits,
  ): Promise<void> {
    if (limits.max_per_day_brl == null && limits.max_count_per_day == null) {
      return;
    }

    const since = new Date(Date.now() - WITHDRAWAL_WINDOW_MS);
    const { total, count } = await this.deps.txRepo.sumWithdrawalsSince(
      input.musician_id,
      since,
    );

    if (limits.max_count_per_day != null && count >= limits.max_count_per_day) {
      throw new InvalidOperationError(
        `Você atingiu o limite de ${limits.max_count_per_day} saques em 24h. Tente novamente mais tarde.`,
      );
    }

    if (
      limits.max_per_day_brl != null &&
      total + input.amount > limits.max_per_day_brl
    ) {
      throw new InvalidOperationError(
        `Este saque ultrapassa o limite de R$${limits.max_per_day_brl.toFixed(2)} em 24h para o seu plano.`,
      );
    }
  }

  private async toReplay(
    transaction: Transaction,
    input: WithdrawToPixInput,
  ): Promise<Reservation> {
    if (transaction.amount.amount !== input.amount) {
      throw new ConflictError(
        "Idempotency-Key já usada para um saque de outro valor",
      );
    }

    const wallet = await this.deps.walletRepo.findByMusicianId(
      input.musician_id,
    );

    return {
      transaction,
      wallet_balance: wallet?.balance.amount ?? 0,
      replayed: true,
      pix_key: wallet?.pix_key
        ? { key: wallet.pix_key.key, type: wallet.pix_key.type }
        : null,
    };
  }

  /**
   * Manda a transferência ao provedor — já fora da transação de banco.
   *
   * Fora dela de propósito, por dois motivos. Uma chamada HTTP de até 30s
   * dentro da transação seguraria o lock da carteira o tempo todo e empilharia
   * conexões do pool. E o caminho de recusa chama `RefundFailedWithdrawUseCase`,
   * que abre a PRÓPRIA transação e trava a mesma carteira: rodar isso ainda
   * dentro da reserva seria esperar por um lock que a própria execução detém —
   * deadlock até o timeout do banco.
   *
   * O que protege o intervalo é a reserva já commitada: o saldo já saiu.
   */
  private async dispatch(reservation: Reservation): Promise<Transaction> {
    const { transaction, replayed, pix_key } = reservation;

    /*
     * Replay que já tem `external_id` — ou que já concluiu/falhou — não fala
     * com o provedor de novo: o efeito existe.
     *
     * Um replay AINDA pendente e sem `external_id` é o caso perigoso e o
     * motivo de este ramo não ser um simples `return`: significa que a reserva
     * foi commitada e o processo caiu antes de despachar. Devolver "pendente"
     * aqui deixaria o saldo debitado para sempre por um saque que ninguém
     * chegou a pedir ao provedor.
     */
    if (replayed && (transaction.external_id || !transaction.isPending)) {
      return transaction;
    }

    const gateway = this.deps.pixWithdrawGateway;
    if (!gateway) {
      // Sem gateway configurado (desenvolvimento): o saque é fictício e
      // conclui na hora, como antes.
      transaction.complete();
      await this.deps.txRepo.update(transaction);
      return transaction;
    }

    if (replayed) {
      const existing = await this.findExistingTransfer(transaction);
      if (existing) {
        return this.link(transaction, existing.transfer_id);
      }
    }

    if (!pix_key) {
      /*
       * Só alcançável no replay de um saque ainda pendente cuja chave sumiu da
       * carteira entre a reserva e o redespacho: não há destino para o qual
       * reenviar. A reserva fresca sempre traz a chave (é pré-condição dela).
       */
      throw new InvalidOperationError(
        "Não foi possível concluir o saque: chave PIX de recebimento ausente.",
      );
    }

    try {
      const result = await gateway.withdraw({
        amount: transaction.amount.amount,
        pix_key: pix_key.key,
        pix_key_type: pix_key.type,
        description: "Saque SoundMeet",
        external_reference: transaction.transaction_id.id,
      });

      // Fica PENDING — quem conclui é o webhook TRANSFER_DONE.
      return this.link(transaction, result.transfer_id);
    } catch (error) {
      return this.handleDispatchFailure(transaction, error);
    }
  }

  private async handleDispatchFailure(
    transaction: Transaction,
    error: unknown,
  ): Promise<Transaction> {
    if (error instanceof PixWithdrawRejectedError) {
      await this.deps.refundUseCase.execute({
        transaction_id: transaction.transaction_id.id,
        reason: error.message,
      });
      throw new InvalidOperationError(
        `Saque recusado pelo provedor: ${error.message}`,
      );
    }

    /*
     * Indeterminado. A referência externa é o `transaction_id`, que geramos
     * antes de chamar — então dá para perguntar ao provedor se a transferência
     * existe em vez de adivinhar.
     */
    const existing = await this.findExistingTransfer(transaction);
    if (existing) {
      return this.link(transaction, existing.transfer_id);
    }

    /*
     * O provedor respondeu que NÃO existe transferência para esta referência:
     * a criação não chegou a acontecer, e estornar é seguro.
     */
    if (existing === null) {
      await this.deps.refundUseCase.execute({
        transaction_id: transaction.transaction_id.id,
        reason:
          error instanceof Error
            ? `Falha ao solicitar transferência: ${error.message}`
            : "Falha ao solicitar transferência",
      });
      throw new InvalidOperationError(
        "Não foi possível concluir o saque. O valor voltou para a sua carteira.",
      );
    }

    /*
     * Nem confirmar nem descartar foi possível. A transação fica `pending` com
     * o saldo debitado, e a resposta diz exatamente isso — porque a alternativa
     * (erro para o cliente) convidaria um retry que abriria uma SEGUNDA reserva
     * para uma transferência que talvez já esteja em curso.
     */
    return transaction;
  }

  /** `null` = provedor afirmou que não existe. `undefined` = não deu para saber. */
  private async findExistingTransfer(transaction: Transaction) {
    const gateway = this.deps.pixWithdrawGateway;
    if (!gateway?.findTransferByExternalReference) {
      return undefined;
    }
    try {
      return await gateway.findTransferByExternalReference(
        transaction.transaction_id.id,
      );
    } catch {
      return undefined;
    }
  }

  private async link(
    transaction: Transaction,
    transferId: string,
  ): Promise<Transaction> {
    transaction.linkExternalId(transferId);
    if (transaction.notification.hasErrors()) {
      throw new EntityValidationError(transaction.notification.toJSON());
    }
    await this.deps.txRepo.update(transaction);
    return transaction;
  }
}
