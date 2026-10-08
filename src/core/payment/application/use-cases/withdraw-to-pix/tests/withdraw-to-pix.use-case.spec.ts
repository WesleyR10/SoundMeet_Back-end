import {
  IMusicianWalletRepository,
  MusicianWallet,
  PaymentMethod,
  Transaction,
  TransactionInMemoryRepository,
} from "@core/payment";
import { EmailNotVerifiedError } from "@core/shared/domain/errors";
import { FakeEmailVerificationChecker } from "@core/shared/infra/email-verification/fake-email-verification.checker";

import { PlanCheckService } from "../../../../../plans/domain/plan-check.service";
import { MusicianPlanTier } from "../../../../../plans/domain/plan-tier.enum";
import {
  Subscription,
  SubscriptionStatus,
} from "../../../../../plans/domain/subscription.aggregate";
import { SubscriptionInMemoryRepository } from "../../../../../plans/infra/db/in-memory/subscription-in-memory.repository";
import { ConflictError } from "../../../../../shared/domain/errors/conflict.error";
import { InvalidOperationError } from "../../../../../shared/domain/errors/invalid-operation.error";
import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import { UnitOfWorkFakeInMemory } from "../../../../../shared/infra/db/in-memory/fake-unit-of-work-in-memory";
import {
  TransactionStatus,
  TransactionType,
} from "../../../../domain/transaction-enums";
import {
  IPixWithdrawGateway,
  PixWithdrawRejectedError,
  PixWithdrawResponse,
} from "../../../../infra/gateways/pix-withdraw-gateway.interface";
import { RefundFailedWithdrawUseCase } from "../../refund-failed-withdraw/refund-failed-withdraw.use-case";
import { WithdrawToPixUseCase } from "../withdraw-to-pix.use-case";

class MusicianWalletRepoStub implements IMusicianWalletRepository {
  sortableFields: string[] = ["created_at"];
  items: MusicianWallet[] = [];
  async insert(entity: MusicianWallet): Promise<void> {
    this.items.push(entity);
  }
  async bulkInsert(entities: MusicianWallet[]): Promise<void> {
    this.items.push(...entities);
  }
  async update(entity: MusicianWallet): Promise<void> {
    const i = this.items.findIndex((w) => w.wallet_id.equals(entity.wallet_id));
    if (i !== -1) this.items[i] = entity;
  }
  async delete(): Promise<void> {}
  async findById(): Promise<MusicianWallet | null> {
    return null;
  }
  async findAll(): Promise<MusicianWallet[]> {
    return this.items;
  }
  async findByIds(): Promise<MusicianWallet[]> {
    return [];
  }
  async existsById(): Promise<{ exists: any[]; not_exists: any[] }> {
    return { exists: [], not_exists: [] };
  }
  getEntity(): new (...args: any[]) => MusicianWallet {
    return MusicianWallet;
  }
  async findByMusicianId(musicianId: string): Promise<MusicianWallet | null> {
    return this.items.find((w) => w.musician_id.id === musicianId) ?? null;
  }
  async findByMusicianIdForUpdate(
    musicianId: string,
  ): Promise<MusicianWallet | null> {
    return this.findByMusicianId(musicianId);
  }
  /** Não exercitado aqui — o vínculo Mercado Pago não participa do saque. */
  async findMercadoPagoExpiring(): Promise<MusicianWallet[]> {
    return [];
  }
  async findByMercadoPagoUserId(): Promise<MusicianWallet | null> {
    return null;
  }
  async search(): Promise<any> {
    return {
      items: this.items,
      total: this.items.length,
      current_page: 1,
      per_page: 10,
    };
  }
}

const MUSICIAN_ID = "123e4567-e89b-12d3-a456-426614174001";
const pix_key = { key: "12345678909", type: "cpf" } as const;
// Segundo músico, usado só no teste de colisão de chave de idempotência.
const OTHER_MUSICIAN_ID = "123e4567-e89b-12d3-a456-426614174002";
const other_pix_key = { key: "outro@exemplo.com", type: "email" } as const;

type Harness =
  ReturnType<typeof buildHarness> extends Promise<infer T> ? T : never;

async function buildHarness(options?: {
  balance?: number;
  gateway?: IPixWithdrawGateway;
  tier?: MusicianPlanTier;
  /** Cadastra a chave PIX de recebimento na carteira. Default: true. */
  withPixKey?: boolean;
  /** Carência de troca de chave em ms. Default: 0 (desligada). */
  cooldownMs?: number;
  /** E-mail confirmado? Default: true — o gate tem testes próprios. */
  emailVerified?: boolean;
}) {
  const txRepo = new TransactionInMemoryRepository();
  const walletRepo = new MusicianWalletRepoStub();
  const uow = new UnitOfWorkFakeInMemory();

  const wallet = MusicianWallet.create({ musician_id: MUSICIAN_ID });
  if (options?.balance) {
    wallet.receiveFunds(options.balance);
  }
  // A chave de destino agora vem SEMPRE da carteira (nunca do input do saque),
  // então o cenário-base cadastra uma. O teste do caso sem chave passa
  // `withPixKey: false`.
  if (options?.withPixKey !== false) {
    wallet.updatePixKey(pix_key.key, pix_key.type);
  }
  await walletRepo.insert(wallet);

  let planCheckService: PlanCheckService | undefined;
  if (options?.tier) {
    const subRepo = new SubscriptionInMemoryRepository();
    await subRepo.insert(
      new Subscription({
        musician_id: MUSICIAN_ID,
        plan_tier: options.tier,
        persona: "musician",
        status: SubscriptionStatus.ACTIVE,
      }),
    );
    planCheckService = new PlanCheckService(subRepo);
  }

  const refundUseCase = new RefundFailedWithdrawUseCase(
    txRepo,
    walletRepo,
    uow,
  );

  // Default verificado: estes testes exercitam saldo, lock e idempotência —
  // o gate de e-mail tem testes próprios, para os dois lados.
  const emailVerificationChecker = new FakeEmailVerificationChecker(
    options?.emailVerified ?? true,
  );

  const useCase = new WithdrawToPixUseCase({
    walletRepo,
    txRepo,
    uow,
    refundUseCase,
    pixWithdrawGateway: options?.gateway,
    planCheckService,
    emailVerificationChecker,
    pixKeyChangeCooldownMs: options?.cooldownMs ?? 0,
  });

  return {
    useCase,
    walletRepo,
    txRepo,
    refundUseCase,
    uow,
    emailVerificationChecker,
  };
}

const currentBalance = async (h: {
  walletRepo: MusicianWalletRepoStub;
}): Promise<number> =>
  (await h.walletRepo.findByMusicianId(MUSICIAN_ID))!.balance.amount;

describe("WithdrawToPixUseCase", () => {
  it("debita a carteira e cria a transação", async () => {
    const h = await buildHarness({ balance: 200 });

    const output = await h.useCase.execute({
      musician_id: MUSICIAN_ID,
      amount: 110,
    });

    expect(output.wallet_balance).toBe(90);
    expect(output.transaction_id).toBeDefined();
  });

  it("recusa o saque quando não há chave PIX cadastrada na carteira (A1)", async () => {
    const h = await buildHarness({ balance: 200, withPixKey: false });

    await expect(
      h.useCase.execute({ musician_id: MUSICIAN_ID, amount: 110 }),
    ).rejects.toBeInstanceOf(EntityValidationError);

    // O saldo não pode ter sido tocado: sem destino, nada sai.
    expect(await currentBalance(h)).toBe(200);
  });

  it("bloqueia o saque durante a carência da chave recém-trocada (A1 camada 2)", async () => {
    // A wallet do harness cadastra a chave AGORA (via updatePixKey), então ela
    // está dentro da carência. Com cooldown de 24h, o saque é recusado.
    const h = await buildHarness({
      balance: 200,
      cooldownMs: 24 * 3_600_000,
    });

    await expect(
      h.useCase.execute({ musician_id: MUSICIAN_ID, amount: 110 }),
    ).rejects.toBeInstanceOf(InvalidOperationError);

    // Nada saiu do saldo enquanto a carência valia.
    expect(await currentBalance(h)).toBe(200);
  });

  it("libera o saque quando a carência está desligada (cooldown 0)", async () => {
    const h = await buildHarness({ balance: 200, cooldownMs: 0 });

    const output = await h.useCase.execute({
      musician_id: MUSICIAN_ID,
      amount: 110,
    });

    expect(output.wallet_balance).toBe(90);
  });
});

// ----------------------------------------------------------------
// SM-023 — corrida, idempotência e falha do provedor
// ----------------------------------------------------------------
describe("WithdrawToPixUseCase — gate de e-mail confirmado", () => {
  /*
   * O saque é a única ação do produto que move dinheiro PARA FORA em
   * definitivo. Um e-mail não confirmado é um canal de recuperação de conta que
   * ninguém provou existir — exatamente o que um invasor precisa que continue
   * assim.
   */
  it("recusa o saque quando o e-mail não foi confirmado", async () => {
    const h = await buildHarness({ balance: 200, emailVerified: false });

    await expect(
      h.useCase.execute({ musician_id: MUSICIAN_ID, amount: 110 }),
    ).rejects.toBeInstanceOf(EmailNotVerifiedError);
  });

  /*
   * 🔴 O teste que prova a POSIÇÃO do gate, não só a existência dele. Se
   * alguém o mover para dentro de `reserve()` — ou para depois dela — o saldo
   * chega a ser debitado antes da recusa, e o músico fica sem o dinheiro e sem
   * a transferência. A recusa tem de acontecer antes de qualquer escrita.
   */
  it("não debita NADA quando o gate recusa", async () => {
    const h = await buildHarness({ balance: 200, emailVerified: false });

    await expect(
      h.useCase.execute({ musician_id: MUSICIAN_ID, amount: 110 }),
    ).rejects.toBeInstanceOf(EmailNotVerifiedError);

    expect(await currentBalance(h)).toBe(200);
    expect((await h.txRepo.findAll()).length).toBe(0);
  });

  // Caso positivo — sem ele o teste acima passaria com um gate que recusa
  // sempre, e o saque estaria quebrado para todo mundo.
  it("libera o saque quando o e-mail está confirmado", async () => {
    const h = await buildHarness({ balance: 200, emailVerified: true });

    const output = await h.useCase.execute({
      musician_id: MUSICIAN_ID,
      amount: 110,
    });

    expect(output.transaction_id).toBeDefined();
    expect(await currentBalance(h)).toBe(90);
  });
});

describe("WithdrawToPixUseCase — SM-023", () => {
  /**
   * O cenário que motivou o achado: dois saques ao mesmo tempo, saldo para um
   * só. Antes da correção os dois liam R$200, os dois disparavam transferência
   * de R$110 e a segunda escrita sobrescrevia a primeira — R$220 saindo, R$110
   * debitados.
   *
   * ⚠️ Este teste cobre a REGRA (uma transferência, um débito), não o LOCK: o
   * `UnitOfWorkFakeInMemory` não serializa nada, e é a referência compartilhada
   * do repositório in-memory que faz a segunda leitura enxergar o débito da
   * primeira. Quem prova o `SELECT ... FOR UPDATE` é a suíte de integração
   * contra Postgres.
   */
  it("dois saques simultâneos com saldo para um: o segundo é recusado e só uma transferência é emitida", async () => {
    const transfers: string[] = [];
    const gateway: IPixWithdrawGateway = {
      async withdraw(input): Promise<PixWithdrawResponse> {
        transfers.push(input.external_reference!);
        return { transfer_id: `tr_${transfers.length}`, status: "PENDING" };
      },
    };

    const h = await buildHarness({ balance: 200, gateway });

    const results = await Promise.allSettled([
      h.useCase.execute({ musician_id: MUSICIAN_ID, amount: 110 }),
      h.useCase.execute({ musician_id: MUSICIAN_ID, amount: 110 }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      EntityValidationError,
    );
    // A garantia que importa: uma única transferência REAL foi emitida.
    expect(transfers).toHaveLength(1);
    expect(await currentBalance(h)).toBe(90);
  });

  it("mesma chave de idempotência: o reenvio devolve o saque original sem debitar de novo", async () => {
    const transfers: string[] = [];
    const gateway: IPixWithdrawGateway = {
      async withdraw(input): Promise<PixWithdrawResponse> {
        transfers.push(input.external_reference!);
        return { transfer_id: `tr_${transfers.length}`, status: "PENDING" };
      },
      async findTransferByExternalReference(ref) {
        return transfers.includes(ref)
          ? {
              transfer_id: `tr_${transfers.indexOf(ref) + 1}`,
              status: "PENDING",
            }
          : null;
      },
    };

    const h = await buildHarness({ balance: 500, gateway });

    const first = await h.useCase.execute({
      musician_id: MUSICIAN_ID,
      amount: 110,
      idempotency_key: "req-1",
    });
    const replay = await h.useCase.execute({
      musician_id: MUSICIAN_ID,
      amount: 110,
      idempotency_key: "req-1",
    });

    expect(replay.transaction_id).toBe(first.transaction_id);
    expect(transfers).toHaveLength(1);
    expect(await currentBalance(h)).toBe(390);
  });

  /*
   * 🔴 A chave de idempotência é escolhida pelo CLIENTE e o UNIQUE da coluna é
   * GLOBAL. Enquanto `findByIdempotencyKey` buscava só por chave, uma colisão
   * entre dois músicos devolvia ao segundo a transação do primeiro:
   *
   *  - `transaction_id` e `status` de outra pessoa vazavam na resposta;
   *  - e, se aquela transação estivesse `pending` sem `external_id`, o ramo de
   *    redespacho pedia a transferência ao provedor usando a chave PIX de quem
   *    fez a chamada — dinheiro do primeiro saindo para o destino do segundo.
   *
   * Não era alcançável enquanto os clientes gerassem chave aleatória. Este
   * teste existe para que a defesa não dependa disso: exercitado contra o caso
   * negativo (removendo o `musicianId` do `where`), ele falha na primeira
   * asserção.
   */
  it("mesma chave em MÚSICOS DIFERENTES não é reenvio — nada vaza e nada é despachado", async () => {
    const transfers: string[] = [];
    const gateway: IPixWithdrawGateway = {
      async withdraw(input): Promise<PixWithdrawResponse> {
        transfers.push(input.external_reference!);
        return { transfer_id: `tr_${transfers.length}`, status: "PENDING" };
      },
    };

    const h = await buildHarness({ balance: 500, gateway });

    const owner = await h.useCase.execute({
      musician_id: MUSICIAN_ID,
      amount: 110,
      idempotency_key: "chave-adivinhada",
    });

    // Segundo músico, carteira própria, MESMO valor e MESMA chave — o cenário
    // exato que o lookup global confundia com um reenvio.
    const intruder = MusicianWallet.create({ musician_id: OTHER_MUSICIAN_ID });
    intruder.receiveFunds(500);
    intruder.updatePixKey(other_pix_key.key, other_pix_key.type);
    await h.walletRepo.insert(intruder);

    const second = await h.useCase.execute({
      musician_id: OTHER_MUSICIAN_ID,
      amount: 110,
      idempotency_key: "chave-adivinhada",
    });

    // Não devolveu a transação alheia.
    expect(second.transaction_id).not.toBe(owner.transaction_id);

    // Cada saque debitou a PRÓPRIA carteira, e nenhuma foi debitada duas vezes.
    expect(await currentBalance(h)).toBe(390);
    const intruderWallet =
      await h.walletRepo.findByMusicianId(OTHER_MUSICIAN_ID);
    expect(intruderWallet!.balance.amount).toBe(390);

    // Duas transferências reais e distintas — nenhuma delas redespachando a
    // transação do outro.
    expect(transfers).toHaveLength(2);
    expect(new Set(transfers).size).toBe(2);
  });

  it("sem chave de idempotência, dois pedidos com saldo sobrando são dois saques (é o cliente que distingue)", async () => {
    const transfers: string[] = [];
    const gateway: IPixWithdrawGateway = {
      async withdraw(input): Promise<PixWithdrawResponse> {
        transfers.push(input.external_reference!);
        return { transfer_id: `tr_${transfers.length}`, status: "PENDING" };
      },
    };

    const h = await buildHarness({ balance: 500, gateway });

    await h.useCase.execute({ musician_id: MUSICIAN_ID, amount: 110 });
    await h.useCase.execute({ musician_id: MUSICIAN_ID, amount: 110 });

    expect(transfers).toHaveLength(2);
    expect(await currentBalance(h)).toBe(280);
  });

  /**
   * Mesma chave com valor diferente não é retry, é chave reutilizada. Devolver
   * em silêncio a transação antiga confirmaria ao músico um saque de valor que
   * ele não pediu.
   */
  it("mesma chave com valor diferente é recusada, não silenciosamente reaproveitada", async () => {
    const gateway: IPixWithdrawGateway = {
      async withdraw(): Promise<PixWithdrawResponse> {
        return { transfer_id: "tr_1", status: "PENDING" };
      },
    };
    const h = await buildHarness({ balance: 1000, gateway });

    await h.useCase.execute({
      musician_id: MUSICIAN_ID,
      amount: 110,
      idempotency_key: "req-x",
    });

    await expect(
      h.useCase.execute({
        musician_id: MUSICIAN_ID,
        amount: 500,
        idempotency_key: "req-x",
      }),
    ).rejects.toThrow(ConflictError);

    // Nenhum débito extra: a segunda tentativa não reservou nada.
    expect(await currentBalance(h)).toBe(890);
  });

  /**
   * A garantia definitiva da idempotência é o UNIQUE do banco, não o `find`
   * que o antecede: duas requisições podem passar pelo `find` antes de
   * qualquer uma inserir. Quem perde a corrida tem de desistir e devolver a
   * transação do vencedor — com a transação inteira revertida, sem débito.
   */
  it("colisão no UNIQUE da chave: o perdedor devolve a transação do vencedor sem debitar", async () => {
    const gateway: IPixWithdrawGateway = {
      async withdraw(): Promise<PixWithdrawResponse> {
        return { transfer_id: "tr_1", status: "PENDING" };
      },
    };
    const h = await buildHarness({ balance: 1000, gateway });

    const winner = await h.useCase.execute({
      musician_id: MUSICIAN_ID,
      amount: 110,
      idempotency_key: "req-race",
    });
    // Simula a janela: o `find` não enxerga o vencedor, mas o insert colide.
    const originalFind = h.txRepo.findByIdempotencyKey.bind(h.txRepo);
    const findSpy = jest
      .spyOn(h.txRepo, "findByIdempotencyKey")
      .mockResolvedValueOnce(null);
    jest
      .spyOn(h.txRepo, "insert")
      .mockRejectedValueOnce(new ConflictError("Unique constraint violation"));
    findSpy.mockImplementation(originalFind);

    const loser = await h.useCase.execute({
      musician_id: MUSICIAN_ID,
      amount: 110,
      idempotency_key: "req-race",
    });

    expect(loser.transaction_id).toBe(winner.transaction_id);
    /*
     * O que NÃO dá para afirmar aqui: que o débito do perdedor não persistiu.
     * O repositório in-memory devolve a MESMA instância do agregado, então
     * `withdrawFunds` já muta o que o próximo `find` enxerga, tenha ou não
     * havido `update` — e o fake de UnitOfWork não faz rollback. Contra
     * Postgres as duas garantias existem, e há uma terceira que não depende de
     * nenhuma delas: o `insert` vem ANTES do `update` da carteira, então a
     * colisão aborta antes de tocá-la. Ver a suíte de integração.
     */
    jest.restoreAllMocks();
  });

  it("recusa conclusiva do provedor: estorna o saldo e reverte total_withdrawn", async () => {
    const gateway: IPixWithdrawGateway = {
      async withdraw(): Promise<PixWithdrawResponse> {
        throw new PixWithdrawRejectedError("Chave PIX inválida", "invalid_key");
      },
    };

    const h = await buildHarness({ balance: 200, gateway });

    await expect(
      h.useCase.execute({ musician_id: MUSICIAN_ID, amount: 110 }),
    ).rejects.toThrow(InvalidOperationError);

    const wallet = (await h.walletRepo.findByMusicianId(MUSICIAN_ID))!;
    expect(wallet.balance.amount).toBe(200);
    expect(wallet.total_withdrawn.amount).toBe(0);

    const [tx] = await h.txRepo.findByMusicianId(MUSICIAN_ID);
    expect(tx.status).toBe(TransactionStatus.FAILED);
    expect(tx.metadata?.failure_reason).toBe("Chave PIX inválida");
  });

  /**
   * 🔴 A distinção que separa esta correção de um bug novo: um timeout NÃO
   * prova que a transferência não saiu. Estornar aqui devolveria saldo sacável
   * de um saque possivelmente em curso.
   */
  it("timeout do provedor sem como consultar: mantém pendente e NÃO estorna", async () => {
    const gateway: IPixWithdrawGateway = {
      async withdraw(): Promise<PixWithdrawResponse> {
        throw new Error("ETIMEDOUT");
      },
    };

    const h = await buildHarness({ balance: 200, gateway });

    const output = await h.useCase.execute({
      musician_id: MUSICIAN_ID,
      amount: 110,
    });

    expect(output.status).toBe(TransactionStatus.PENDING);
    expect(await currentBalance(h)).toBe(90);
  });

  it("timeout mas a consulta acha a transferência: vincula o external_id e segue pendente", async () => {
    const gateway: IPixWithdrawGateway = {
      async withdraw(): Promise<PixWithdrawResponse> {
        throw new Error("socket hang up");
      },
      async findTransferByExternalReference() {
        return { transfer_id: "tr_recuperada", status: "PENDING" };
      },
    };

    const h = await buildHarness({ balance: 200, gateway });

    const output = await h.useCase.execute({
      musician_id: MUSICIAN_ID,
      amount: 110,
    });

    expect(output.status).toBe(TransactionStatus.PENDING);
    const [tx] = await h.txRepo.findByMusicianId(MUSICIAN_ID);
    expect(tx.external_id).toBe("tr_recuperada");
    expect(await currentBalance(h)).toBe(90);
  });

  it("timeout e a consulta afirma que não existe transferência: estorna com segurança", async () => {
    const gateway: IPixWithdrawGateway = {
      async withdraw(): Promise<PixWithdrawResponse> {
        throw new Error("ECONNRESET");
      },
      async findTransferByExternalReference() {
        return null;
      },
    };

    const h = await buildHarness({ balance: 200, gateway });

    await expect(
      h.useCase.execute({ musician_id: MUSICIAN_ID, amount: 110 }),
    ).rejects.toThrow(InvalidOperationError);

    expect(await currentBalance(h)).toBe(200);
  });

  /**
   * Reserva commitada e processo caído antes do despacho. O replay não pode
   * ser um `return` silencioso: o saldo já saiu e ninguém pediu nada ao
   * provedor.
   */
  it("replay de reserva pendente sem external_id: despacha ao provedor em vez de devolver pendente", async () => {
    const transfers: string[] = [];
    const gateway: IPixWithdrawGateway = {
      async withdraw(input): Promise<PixWithdrawResponse> {
        transfers.push(input.external_reference!);
        return { transfer_id: "tr_tardia", status: "PENDING" };
      },
      async findTransferByExternalReference() {
        return null;
      },
    };

    const h = await buildHarness({ balance: 200, gateway });

    // Simula a queda: a reserva foi persistida, o despacho não aconteceu.
    const crashing = new WithdrawToPixUseCase({
      walletRepo: h.walletRepo,
      txRepo: h.txRepo,
      uow: h.uow,
      refundUseCase: h.refundUseCase,
      pixWithdrawGateway: {
        async withdraw(): Promise<PixWithdrawResponse> {
          throw new Error("processo morreu");
        },
      },
      emailVerificationChecker: new FakeEmailVerificationChecker(),
    });
    await crashing
      .execute({
        musician_id: MUSICIAN_ID,
        amount: 110,
        idempotency_key: "req-crash",
      })
      .catch(() => undefined);

    expect(transfers).toHaveLength(0);
    expect(await currentBalance(h)).toBe(90);

    const output = await h.useCase.execute({
      musician_id: MUSICIAN_ID,
      amount: 110,
      idempotency_key: "req-crash",
    });

    expect(transfers).toEqual([output.transaction_id]);
    // O saldo NÃO foi debitado de novo — a reserva era a mesma.
    expect(await currentBalance(h)).toBe(90);
  });
});

// ----------------------------------------------------------------
// Gate 4C.2 — min_withdrawal_amount_brl por plano
// ----------------------------------------------------------------
describe("WithdrawToPixUseCase — gate 4C.2 (withdrawal config por plano)", () => {
  const run = async (tier: MusicianPlanTier | undefined, amount: number) => {
    const h = await buildHarness({ balance: 500, tier });
    return h.useCase.execute({ musician_id: MUSICIAN_ID, amount });
  };

  it("FREE: mínimo R$110 — R$100 lança EntityValidationError", async () => {
    await expect(run(undefined, 100)).rejects.toThrow(EntityValidationError);
  });

  it("FREE: mínimo R$110 — R$109 lança EntityValidationError", async () => {
    await expect(run(undefined, 109)).rejects.toThrow(EntityValidationError);
  });

  it("ESSENTIAL: mínimo R$70 — R$60 lança EntityValidationError", async () => {
    await expect(run(MusicianPlanTier.ESSENTIAL, 60)).rejects.toThrow(
      EntityValidationError,
    );
  });

  it("ESSENTIAL: mínimo R$70 — R$70 valida mínimo corretamente", async () => {
    await expect(run(MusicianPlanTier.ESSENTIAL, 70)).resolves.not.toThrow();
  });

  it("PRO: mínimo R$50 — R$40 lança EntityValidationError", async () => {
    await expect(run(MusicianPlanTier.PRO, 40)).rejects.toThrow(
      EntityValidationError,
    );
  });

  it("PRO: mínimo R$50 — R$50 valida mínimo corretamente", async () => {
    await expect(run(MusicianPlanTier.PRO, 50)).resolves.not.toThrow();
  });
});

// ----------------------------------------------------------------
// A1 — teto diário de valor e limite de velocidade (velocity)
// ----------------------------------------------------------------
describe("WithdrawToPixUseCase — teto diário e velocity (A1)", () => {
  // Insere um saque já existente na janela de 24h, como se o músico já tivesse
  // sacado hoje. `completed` e `pending` contam; o teto soma os dois.
  async function seedWithdrawal(
    h: Harness,
    amount: number,
    status: "completed" | "pending",
  ): Promise<void> {
    const tx = Transaction.create({
      musician_id: MUSICIAN_ID,
      type: TransactionType.WITHDRAWAL,
      amount,
      fee: 0,
      payment_method: PaymentMethod.PIX,
    });
    if (status === "completed") {
      tx.complete();
    }
    await h.txRepo.insert(tx);
  }

  it("FREE: bloqueia quando o valor no dia + este saque passa do teto (R$2.000)", async () => {
    const h = await buildHarness({
      balance: 5000,
      tier: MusicianPlanTier.FREE,
    });
    await seedWithdrawal(h, 1500, "completed"); // já sacou R$1.500 hoje

    // 1500 + 600 = 2100 > 2000
    await expect(
      h.useCase.execute({ musician_id: MUSICIAN_ID, amount: 600 }),
    ).rejects.toBeInstanceOf(InvalidOperationError);

    // saldo intacto: o teto barra antes de tocar o dinheiro
    expect(await currentBalance(h)).toBe(5000);
  });

  it("FREE: permite quando o total no dia fica dentro do teto", async () => {
    const h = await buildHarness({
      balance: 5000,
      tier: MusicianPlanTier.FREE,
    });
    await seedWithdrawal(h, 1500, "completed");

    // 1500 + 400 = 1900 <= 2000
    await expect(
      h.useCase.execute({ musician_id: MUSICIAN_ID, amount: 400 }),
    ).resolves.not.toThrow();
  });

  it("ESSENTIAL: teto maior (R$5.000) — R$1.500 sobre R$3.800 já sacado passa", async () => {
    const h = await buildHarness({
      balance: 10000,
      tier: MusicianPlanTier.ESSENTIAL,
    });
    await seedWithdrawal(h, 3800, "completed");

    // 3800 + 1500 = 5300 > 5000
    await expect(
      h.useCase.execute({ musician_id: MUSICIAN_ID, amount: 1500 }),
    ).rejects.toBeInstanceOf(InvalidOperationError);
  });

  it("velocity: bloqueia ao atingir o limite de contagem (5 saques/24h)", async () => {
    const h = await buildHarness({
      balance: 5000,
      tier: MusicianPlanTier.FREE,
    });
    for (let i = 0; i < 5; i++) {
      await seedWithdrawal(h, 100, "completed"); // 5 saques, R$500 no total
    }

    // 6º saque: valor caberia (500 + 110 = 610 < 2000), mas a contagem estourou
    await expect(
      h.useCase.execute({ musician_id: MUSICIAN_ID, amount: 110 }),
    ).rejects.toBeInstanceOf(InvalidOperationError);
  });

  it("um saque pendente na janela também consome a cota", async () => {
    const h = await buildHarness({
      balance: 5000,
      tier: MusicianPlanTier.FREE,
    });
    await seedWithdrawal(h, 1800, "pending"); // ainda em curso

    // 1800 + 300 = 2100 > 2000 — pending conta
    await expect(
      h.useCase.execute({ musician_id: MUSICIAN_ID, amount: 300 }),
    ).rejects.toBeInstanceOf(InvalidOperationError);
  });
});
