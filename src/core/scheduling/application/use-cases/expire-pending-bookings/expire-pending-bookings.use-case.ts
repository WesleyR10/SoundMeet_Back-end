import { IClock } from "../../../../shared/application/clock.interface";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { IBookingRepository } from "../../../domain/booking.repository";

export class ExpirePendingBookingsUseCase implements IUseCase<
  ExpirePendingBookingsInput,
  ExpirePendingBookingsOutput
> {
  constructor(
    private readonly bookingRepo: IBookingRepository,
    private readonly clock: IClock = { now: () => new Date() },
  ) {}

  async execute(
    _input: ExpirePendingBookingsInput = {},
  ): Promise<ExpirePendingBookingsOutput> {
    const now = this.clock.now();
    const expired = await this.bookingRepo.expirePendingExpired(now);
    return { expired };
  }
}

export type ExpirePendingBookingsInput = Record<string, never>;

export type ExpirePendingBookingsOutput = {
  expired: number;
};
