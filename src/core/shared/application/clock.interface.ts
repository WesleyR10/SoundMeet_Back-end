export interface IClock {
  now(): Date;
}

export class FakeClock implements IClock {
  private current: Date;

  constructor(initialDate: Date) {
    this.current = initialDate;
  }

  now(): Date {
    return this.current;
  }

  set(date: Date): void {
    this.current = date;
  }

  advanceBy(milliseconds: number): void {
    this.current = new Date(this.current.getTime() + milliseconds);
  }
}
