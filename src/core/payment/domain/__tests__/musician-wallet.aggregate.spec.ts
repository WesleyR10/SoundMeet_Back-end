import { MusicianWallet } from "../musician-wallet.aggregate";

describe("MusicianWallet Aggregate", () => {
  /**
   * Regressão: `150.30 - 110` em ponto flutuante dá `40.30000000000001`, e o
   * `Money` recusa mais de duas casas — o saque não ficava impreciso, ele
   * LANÇAVA. Saldo com centavos é o caso normal de quem recebe gorjeta.
   */
  it.each([
    [150.3, 110, 40.3],
    [120.7, 110, 10.7],
    [110.05, 110, 0.05],
    [0.3, 0.1, 0.2],
  ])(
    "saca de um saldo com centavos (%p - %p = %p) sem estourar o Money",
    (balance, amount, expected) => {
      const wallet = MusicianWallet.create({
        musician_id: "123e4567-e89b-12d3-a456-426614174004",
      });
      wallet.receiveFunds(balance);
      wallet.withdrawFunds(amount);

      expect(wallet.notification.hasErrors()).toBe(false);
      expect(wallet.balance.amount).toBe(expected);
      expect(wallet.total_withdrawn.amount).toBe(amount);
    },
  );

  it("should credit and withdraw funds with validations", () => {
    const wallet = MusicianWallet.create({
      musician_id: "123e4567-e89b-12d3-a456-426614174001",
    });
    wallet.receiveFunds(200);
    expect(wallet.balance.amount).toBe(200);
    wallet.withdrawFunds(50);
    expect(wallet.balance.amount).toBe(150);
  });

  it("should throw on insufficient funds", () => {
    const wallet = MusicianWallet.create({
      musician_id: "123e4567-e89b-12d3-a456-426614174002",
    });
    wallet.withdrawFunds(10);
    expect(wallet.notification.hasErrors()).toBe(true);
  });
});

// SM-023 — o saque que o provedor recusou tem de voltar INTEIRO.
describe("MusicianWallet — refundWithdrawal", () => {
  const build = (balance: number) => {
    const wallet = MusicianWallet.create({
      musician_id: "123e4567-e89b-12d3-a456-426614174003",
    });
    wallet.receiveFunds(balance);
    return wallet;
  };

  it("desfaz withdrawFunds por inteiro — balance e total_withdrawn", () => {
    const wallet = build(200);
    wallet.withdrawFunds(110);
    expect(wallet.balance.amount).toBe(90);
    expect(wallet.total_withdrawn.amount).toBe(110);

    wallet.refundWithdrawal(110);

    expect(wallet.balance.amount).toBe(200);
    expect(wallet.total_withdrawn.amount).toBe(0);
    expect(wallet.notification.hasErrors()).toBe(false);
  });

  /**
   * A razão de a aritmética ser em centavos: `(a - b) + b` em ponto flutuante
   * não devolve `a`, e o `Money` recusa mais de duas casas decimais — um
   * estorno que explode é dinheiro que não volta.
   */
  it("valores que quebram em ponto flutuante voltam exatos", () => {
    const wallet = build(0.3);
    wallet.withdrawFunds(0.1);
    wallet.refundWithdrawal(0.1);

    expect(wallet.balance.amount).toBe(0.3);
    expect(wallet.total_withdrawn.amount).toBe(0);
  });

  it("recusa estornar mais do que foi sacado", () => {
    const wallet = build(200);
    wallet.withdrawFunds(50);

    wallet.refundWithdrawal(110);

    expect(wallet.notification.hasErrors()).toBe(true);
    expect(wallet.balance.amount).toBe(150);
    expect(wallet.total_withdrawn.amount).toBe(50);
  });

  it("recusa valor não positivo", () => {
    const wallet = build(200);
    wallet.withdrawFunds(50);

    wallet.refundWithdrawal(0);

    expect(wallet.notification.hasErrors()).toBe(true);
    expect(wallet.balance.amount).toBe(150);
  });
});

describe("MusicianWallet — carência de troca de chave PIX (A1 camada 2)", () => {
  const MUSICIAN = "123e4567-e89b-12d3-a456-426614174050";
  const COOLDOWN_MS = 24 * 3_600_000;

  it("marca pix_key_changed_at e emite PixKeyChangedEvent quando a chave muda", () => {
    const wallet = MusicianWallet.create({ musician_id: MUSICIAN });

    wallet.updatePixKey("12345678909", "cpf");

    expect(wallet.pix_key_changed_at).toBeInstanceOf(Date);
    const events = wallet.getUncommittedEvents();
    expect(events).toHaveLength(1);
    expect(events[0].constructor.name).toBe("PixKeyChangedEvent");
  });

  it("NÃO rearma o relógio nem emite evento ao regravar a MESMA chave", () => {
    const wallet = MusicianWallet.create({ musician_id: MUSICIAN });
    wallet.updatePixKey("12345678909", "cpf");
    const firstChangedAt = wallet.pix_key_changed_at;
    wallet.markEventAsDispatched(wallet.getUncommittedEvents()[0]);

    wallet.updatePixKey("12345678909", "cpf");

    expect(wallet.pix_key_changed_at).toBe(firstChangedAt);
    expect(wallet.getUncommittedEvents()).toHaveLength(0);
  });

  it("reporta carência restante enquanto dentro da janela e 0 depois", () => {
    const wallet = MusicianWallet.create({ musician_id: MUSICIAN });
    wallet.updatePixKey("12345678909", "cpf");
    const changedAt = wallet.pix_key_changed_at!;

    const oneHourLater = new Date(changedAt.getTime() + 3_600_000);
    expect(wallet.pixKeyCooldownRemainingMs(COOLDOWN_MS, oneHourLater)).toBe(
      23 * 3_600_000,
    );

    const wellAfter = new Date(changedAt.getTime() + COOLDOWN_MS + 1000);
    expect(wallet.pixKeyCooldownRemainingMs(COOLDOWN_MS, wellAfter)).toBe(0);
  });

  it("sem carência configurada (0) ou sem troca registrada, nunca bloqueia", () => {
    const wallet = MusicianWallet.create({ musician_id: MUSICIAN });
    // sem chave trocada
    expect(wallet.pixKeyCooldownRemainingMs(COOLDOWN_MS)).toBe(0);
    // com chave trocada mas cooldown desligado
    wallet.updatePixKey("12345678909", "cpf");
    expect(wallet.pixKeyCooldownRemainingMs(0)).toBe(0);
  });
});
