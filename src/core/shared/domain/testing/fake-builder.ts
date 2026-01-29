import { InvariantViolationError } from "../errors/invariant-violation.error";

export type PropOrFactory<T> = T | ((index: number) => T);

export class FakeBuilderBase {
  protected readonly countObjs: number;

  protected constructor(countObjs: number = 1) {
    this.countObjs = countObjs;
  }

  protected callFactory<T>(factoryOrValue: PropOrFactory<T>, index: number): T {
    if (Array.isArray(factoryOrValue)) {
      return factoryOrValue.map((item) =>
        this.callFactory(item as any, index),
      ) as any;
    }

    return typeof factoryOrValue === "function"
      ? (factoryOrValue as (index: number) => T)(index)
      : factoryOrValue;
  }

  protected getValue<T>(
    prop: string,
    index: number = 0,
    options?: {
      optionalProps?: string[];
      guards?: Array<(value: T) => void>;
    },
  ): T {
    const optionalProps = options?.optionalProps ?? this.getOptionalProps();
    const privateProp = `_${prop}` as keyof this;
    const factoryOrValue = this[privateProp] as any;

    if (factoryOrValue === undefined && optionalProps.includes(prop)) {
      throw new InvariantViolationError(
        `Property ${prop} not have a factory, use 'with' methods`,
      );
    }

    const value = this.callFactory(factoryOrValue, index);
    if (options?.guards?.length) {
      for (const guard of options.guards) {
        guard(value);
      }
    }
    return value;
  }

  protected getOptionalProps(): string[] {
    return [];
  }
}
