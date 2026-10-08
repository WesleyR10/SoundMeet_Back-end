import { Chance } from "chance";

import { Money } from "../../shared/domain/value-objects/money.vo";
import { Uuid } from "../../shared/domain/value-objects/uuid.vo";
import { BookingEscrow, BookingEscrowId } from "./booking-escrow.aggregate";
import { BookingEscrowStatus } from "./booking-escrow-enums";

type PropOrFactory<T> = T | ((index: number) => T);

export class BookingEscrowFakeBuilder<TBuild = any> {
  private _escrow_id: PropOrFactory<BookingEscrowId> | undefined = undefined;
  private _booking_id: PropOrFactory<Uuid> | undefined = undefined;
  private _musician_id: PropOrFactory<Uuid | null> | undefined = undefined;
  private _amount: PropOrFactory<Money> | undefined = undefined;
  private _platform_fee: PropOrFactory<Money> | undefined = undefined;
  private _net_amount: PropOrFactory<Money> | undefined = undefined;
  private _status: PropOrFactory<BookingEscrowStatus> | undefined = undefined;
  private _external_id: PropOrFactory<string | null> | undefined = undefined;
  private _expires_at: PropOrFactory<Date | null> | undefined = undefined;
  private _held_at: PropOrFactory<Date | null> | undefined = undefined;
  private _created_at: PropOrFactory<Date> | undefined = undefined;
  private _updated_at: PropOrFactory<Date> | undefined = undefined;

  private countObjs: number;
  private chance: Chance.Chance;

  static anEscrow() {
    return new BookingEscrowFakeBuilder<BookingEscrow>();
  }

  static theEscrows(countObjs: number) {
    return new BookingEscrowFakeBuilder<BookingEscrow[]>(countObjs);
  }

  private constructor(countObjs: number = 1) {
    this.countObjs = countObjs;
    this.chance = Chance();
  }

  withEscrowId(v: PropOrFactory<BookingEscrowId>) {
    this._escrow_id = v;
    return this;
  }

  withBookingId(v: PropOrFactory<Uuid>) {
    this._booking_id = v;
    return this;
  }

  withMusicianId(v: PropOrFactory<Uuid | null>) {
    this._musician_id = v;
    return this;
  }

  withAmount(v: PropOrFactory<Money>) {
    this._amount = v;
    return this;
  }

  withPlatformFee(v: PropOrFactory<Money>) {
    this._platform_fee = v;
    return this;
  }

  withNetAmount(v: PropOrFactory<Money>) {
    this._net_amount = v;
    return this;
  }

  withStatus(v: PropOrFactory<BookingEscrowStatus>) {
    this._status = v;
    return this;
  }

  withExternalId(v: PropOrFactory<string | null>) {
    this._external_id = v;
    return this;
  }

  withExpiresAt(v: PropOrFactory<Date | null>) {
    this._expires_at = v;
    return this;
  }

  withHeldAt(v: PropOrFactory<Date | null>) {
    this._held_at = v;
    return this;
  }

  withCreatedAt(v: PropOrFactory<Date>) {
    this._created_at = v;
    return this;
  }

  /** Atalho do estado mais usado nos testes: retida, com referência e prazo. */
  held(expiresAt: Date | null = null) {
    this._status = BookingEscrowStatus.HELD;
    this._external_id =
      this._external_id ?? `pay_${this.chance.hash({ length: 12 })}`;
    this._held_at = new Date();
    this._expires_at = expiresAt;
    return this;
  }

  build(): TBuild {
    const escrows = new Array(this.countObjs)
      .fill(undefined)
      .map((_, index) => {
        /*
         * O cachê vem em CENTAVOS inteiros (`fixed: 2`) de propósito: o `Money`
         * recusa mais de duas casas, e o default do chance é 4 — armadilha que
         * já derrubou `tip-fake.builder` e `transaction-fake.builder`.
         */
        const amount =
          this.callFactory(this._amount, index) ??
          new Money(this.chance.floating({ min: 200, max: 5000, fixed: 2 }));

        /*
         * Divisão em centavos pelo mesmo motivo de `BookingEscrow.splitAmount`:
         * `amount - fee` em ponto flutuante devolve `1111.1000000000001` e o
         * `Money` recusa. O builder usa o MÉTODO do agregado de propósito — um
         * cálculo próprio aqui divergiria da regra real sem ninguém notar.
         */
        const split = BookingEscrow.splitAmount(amount.amount, 10);
        const platformFee =
          this.callFactory(this._platform_fee, index) ?? split.platform_fee;

        return new BookingEscrow({
          escrow_id:
            this.callFactory(this._escrow_id, index) ?? new BookingEscrowId(),
          booking_id: this.callFactory(this._booking_id, index) ?? new Uuid(),
          musician_id: this.callFactory(this._musician_id, index) ?? new Uuid(),
          amount,
          platform_fee: platformFee,
          net_amount:
            this.callFactory(this._net_amount, index) ?? split.net_amount,
          status:
            this.callFactory(this._status, index) ??
            BookingEscrowStatus.PENDING,
          external_id: this.callFactory(this._external_id, index) ?? null,
          expires_at: this.callFactory(this._expires_at, index) ?? null,
          held_at: this.callFactory(this._held_at, index) ?? null,
          created_at: this.callFactory(this._created_at, index) ?? new Date(),
          updated_at: this.callFactory(this._updated_at, index) ?? new Date(),
        });
      });

    return this.countObjs === 1 ? (escrows[0] as any) : (escrows as any);
  }

  private callFactory(factoryOrValue: PropOrFactory<any>, index: number) {
    return typeof factoryOrValue === "function"
      ? factoryOrValue(index)
      : factoryOrValue;
  }
}
