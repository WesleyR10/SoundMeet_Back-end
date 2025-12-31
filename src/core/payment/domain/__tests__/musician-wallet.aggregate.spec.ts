import { MusicianWallet } from "../musician-wallet.entity";

describe("MusicianWallet Aggregate", () => {
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
    expect(() => wallet.withdrawFunds(10)).toThrow();
  });
});
