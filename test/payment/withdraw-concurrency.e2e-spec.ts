import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { randomBytes, randomUUID } from "crypto";

import { RefundFailedWithdrawUseCase } from "../../src/core/payment/application/use-cases/refund-failed-withdraw/refund-failed-withdraw.use-case";
import { WithdrawToPixUseCase } from "../../src/core/payment/application/use-cases/withdraw-to-pix/withdraw-to-pix.use-case";
import { MusicianWallet } from "../../src/core/payment/domain/musician-wallet.aggregate";
import { MusicianWalletPrismaRepository } from "../../src/core/payment/infra/db/prisma/musician-wallet-prisma.repository";
import { TransactionPrismaRepository } from "../../src/core/payment/infra/db/prisma/transaction-prisma.repository";
import {
  IPixWithdrawGateway,
  PixWithdrawResponse,
} from "../../src/core/payment/infra/gateways/pix-withdraw-gateway.interface";
import { AesGcmEncryptionService } from "../../src/core/shared/infra/crypto/aes-gcm-encryption.service";
import { PrismaUnitOfWork } from "../../src/core/shared/infra/db/prisma/prisma-unit-of-work";
import { FakeEmailVerificationChecker } from "@core/shared/infra/email-verification/fake-email-verification.checker";

/**
 * SM-023 — as garantias do saque contra o Postgres de verdade.
 *
 * 🔴 Esta suíte existe porque os testes unitários **não conseguem** prová-las.
 * Lá o `UnitOfWorkFakeInMemory` não abre transação nenhuma e o repositório
 * in-memory devolve a mesma instância do agregado: o que faz a segunda leitura
 * enxergar o débito da primeira é a referência compartilhada, não o lock. Um
 * `SELECT ... FOR UPDATE` que nunca foi executado passaria naqueles testes
 * exatamente como o código quebrado passava antes.
 *
 * Aqui os três mecanismos são exercitados como em produção: transação real,
 * lock real, e o UNIQUE real da coluna de idempotência.
 */
describe("Saque PIX — concorrência (e2e, Postgres real)", () => {
  jest.setTimeout(30_000);

  // Prisma 7 exige driver adapter — mesmo caminho do `PrismaService` da app.
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  // A chave só precisa ser válida e viver o tempo desta suíte: o que é cifrado
  // aqui (a chave PIX) é escrito e lido na mesma execução.
  const encryption = new AesGcmEncryptionService(
    randomBytes(32).toString("base64"),
  );

  const musicianIds: string[] = [];

  /** Gateway que apenas CONTA as transferências emitidas — é o que se mede. */
  function countingGateway() {
    const emitted: string[] = [];
    const gateway: IPixWithdrawGateway = {
      async withdraw(input): Promise<PixWithdrawResponse> {
        emitted.push(input.external_reference!);
        return { transfer_id: `tr_${emitted.length}_${randomUUID()}`, status: "PENDING" };
      },
    };
    return { gateway, emitted };
  }

  function buildUseCase(gateway: IPixWithdrawGateway) {
    /*
     * UMA instância de UnitOfWork, como no provider real. O
     * `AsyncLocalStorage` dela é o que dá a cada cadeia async a sua própria
     * transação — usar duas instâncias aqui mascararia justamente o que se
     * quer verificar.
     */
    const uow = new PrismaUnitOfWork(prisma);
    const walletRepo = new MusicianWalletPrismaRepository(
      prisma,
      uow,
      encryption,
    );
    const txRepo = new TransactionPrismaRepository(prisma, uow);

    const refundUow = new PrismaUnitOfWork(prisma);
    const refundUseCase = new RefundFailedWithdrawUseCase(
      new TransactionPrismaRepository(prisma, refundUow),
      new MusicianWalletPrismaRepository(prisma, refundUow, encryption),
      refundUow,
    );

    return new WithdrawToPixUseCase({
      walletRepo,
      txRepo,
      uow,
      refundUseCase,
      pixWithdrawGateway: gateway,
      emailVerificationChecker: new FakeEmailVerificationChecker(),
    });
  }

  async function seedMusicianWithBalance(balance: number): Promise<string> {
    const musicianId = randomUUID();
    const unique = musicianId.replace(/-/g, "").slice(0, 12);

    await prisma.musician.create({
      data: {
        id: musicianId,
        email: `e2e-withdraw-${unique}@soundmeet.test`,
        name: "E2E Saque",
      },
    });
    musicianIds.push(musicianId);

    const walletRepo = new MusicianWalletPrismaRepository(
      prisma,
      undefined,
      encryption,
    );
    const wallet = MusicianWallet.create({ musician_id: musicianId });
    wallet.receiveFunds(balance);
    // A chave de destino vem da carteira (nunca do input do saque, A1) — sem
    // ela cadastrada, o saque é recusado antes de tocar o saldo.
    wallet.updatePixKey("12345678909", "cpf");
    await walletRepo.insert(wallet);

    return musicianId;
  }

  async function readWallet(musicianId: string) {
    const row = await prisma.musicianWallet.findUnique({
      where: { musicianId },
      select: { balance: true, totalWithdrawn: true },
    });
    return {
      balance: Number(row!.balance),
      total_withdrawn: Number(row!.totalWithdrawn),
    };
  }

  const countWithdrawals = (musicianId: string) =>
    prisma.transaction.count({ where: { musicianId, type: "withdrawal" } });

  afterAll(async () => {
    // `onDelete: Cascade` leva carteira e transações junto com o músico.
    if (musicianIds.length) {
      await prisma.musician.deleteMany({ where: { id: { in: musicianIds } } });
    }
    await prisma.$disconnect();
  });

  /**
   * O cenário exato do achado, medido contra Postgres real.
   *
   * Trocando `findByMusicianIdForUpdate` por `findByMusicianId` (o código de
   * antes da correção), este teste reproduz o bug literalmente: as duas
   * execuções são `fulfilled`, `emitted` tem DUAS transferências e o saldo
   * final é 90 — R$220 saindo da conta com um único débito de R$110 registrado.
   *
   * ⚠️ Mas ele é FLAKY sem o lock: com apenas duas cadeias async, o
   * escalonamento do Node às vezes as executa em fila e o teste passa mesmo com
   * o código quebrado. Quem dá a garantia determinística é o teste de cinco
   * concorrentes, logo abaixo — não remova um achando que o outro cobre.
   */
  it("dois saques simultâneos com saldo para um só: UMA transferência, UM débito", async () => {
    const musicianId = await seedMusicianWithBalance(200);
    const { gateway, emitted } = countingGateway();
    const useCase = buildUseCase(gateway);

    const results = await Promise.allSettled([
      useCase.execute({ musician_id: musicianId, amount: 110 }),
      useCase.execute({ musician_id: musicianId, amount: 110 }),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);

    // A garantia que vale dinheiro.
    expect(emitted).toHaveLength(1);
    expect(await countWithdrawals(musicianId)).toBe(1);

    const wallet = await readWallet(musicianId);
    expect(wallet.balance).toBe(90);
    expect(wallet.total_withdrawn).toBe(110);
  });

  /**
   * 🔴 Cinco ao mesmo tempo com saldo para dois — este é o teste que de fato
   * PROVA o lock.
   *
   * Verificado por remoção deliberada do `FOR UPDATE`: sem ele, os cinco saques
   * são aceitos, cinco transferências reais são emitidas e o saldo cai apenas
   * duas vezes (R$550 saindo, R$220 debitados). Diferente do caso de dois, isto
   * não depende de sorte de escalonamento: cinco cadeias disputando a mesma
   * linha não se organizam sozinhas.
   */
  it("cinco saques simultâneos com saldo para dois: exatamente dois vencem", async () => {
    const musicianId = await seedMusicianWithBalance(250);
    const { gateway, emitted } = countingGateway();
    const useCase = buildUseCase(gateway);

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        useCase.execute({ musician_id: musicianId, amount: 110 }),
      ),
    );

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    expect(emitted).toHaveLength(2);
    expect(await countWithdrawals(musicianId)).toBe(2);

    const wallet = await readWallet(musicianId);
    expect(wallet.balance).toBe(30);
    expect(wallet.total_withdrawn).toBe(220);
  });

  /**
   * O caso que o lock **não** cobre: saldo sobra para os dois, então ambos são
   * legítimos vistos um de cada vez e o lock só os executaria em fila. Quem
   * distingue "pedi de novo" de "quero sacar de novo" é a chave do cliente, e a
   * garantia é o UNIQUE da coluna — não o `find` que o antecede.
   */
  it("duplo clique com a mesma Idempotency-Key: UMA transferência, mesmo com saldo sobrando", async () => {
    const musicianId = await seedMusicianWithBalance(1000);
    const { gateway, emitted } = countingGateway();
    const useCase = buildUseCase(gateway);
    const idempotency_key = `e2e-${randomUUID()}`;

    const results = await Promise.all([
      useCase.execute({
        musician_id: musicianId,
        amount: 110,
        idempotency_key,
      }),
      useCase.execute({
        musician_id: musicianId,
        amount: 110,
        idempotency_key,
      }),
    ]);

    expect(results[0].transaction_id).toBe(results[1].transaction_id);
    expect(emitted).toHaveLength(1);
    expect(await countWithdrawals(musicianId)).toBe(1);
    expect((await readWallet(musicianId)).balance).toBe(890);
  });

  /** Sem chave, dois pedidos com saldo sobrando são dois saques de verdade. */
  it("sem Idempotency-Key e com saldo sobrando, os dois saques acontecem", async () => {
    const musicianId = await seedMusicianWithBalance(1000);
    const { gateway, emitted } = countingGateway();
    const useCase = buildUseCase(gateway);

    await Promise.all([
      useCase.execute({ musician_id: musicianId, amount: 110 }),
      useCase.execute({ musician_id: musicianId, amount: 110 }),
    ]);

    expect(emitted).toHaveLength(2);
    expect(await countWithdrawals(musicianId)).toBe(2);
    expect((await readWallet(musicianId)).balance).toBe(780);
  });

  /**
   * 🔴 A proteção que não pode depender do rollback: o `insert` do lançamento
   * vem antes do `update` da carteira, então a colisão do UNIQUE aborta a
   * transação sem que o saldo tenha sido tocado.
   */
  it("colisão de chave não deixa saldo debitado sem transferência", async () => {
    const musicianId = await seedMusicianWithBalance(500);
    const { gateway, emitted } = countingGateway();
    const useCase = buildUseCase(gateway);
    const idempotency_key = `e2e-${randomUUID()}`;

    await Promise.allSettled(
      Array.from({ length: 4 }, () =>
        useCase.execute({
          musician_id: musicianId,
          amount: 110,
          idempotency_key,
        }),
      ),
    );

    expect(emitted).toHaveLength(1);
    expect(await countWithdrawals(musicianId)).toBe(1);
    // Um único débito, apesar das quatro tentativas.
    expect((await readWallet(musicianId)).balance).toBe(390);
  });

  /**
   * O lock existe para proteger uma transação; fora dela o banco o libera ao
   * fim do próprio SELECT. Degradar em silêncio daria a garantia aparente sem
   * a real, então o repositório recusa.
   */
  it("findByMusicianIdForUpdate recusa rodar fora de transação", async () => {
    const musicianId = await seedMusicianWithBalance(200);
    const repoSemUow = new MusicianWalletPrismaRepository(
      prisma,
      undefined,
      encryption,
    );

    await expect(
      repoSemUow.findByMusicianIdForUpdate(musicianId),
    ).rejects.toThrow(/transação ativa/);
  });
});
