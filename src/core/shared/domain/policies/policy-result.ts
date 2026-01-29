import { FieldsErrors } from "../validators/validator-fields-interface";

export class PolicyResult {
  private constructor(readonly errors: FieldsErrors[]) {}

  static ok(): PolicyResult {
    return new PolicyResult([]);
  }

  static fail(errors: FieldsErrors[]): PolicyResult {
    return new PolicyResult(errors);
  }

  get isValid(): boolean {
    return this.errors.length === 0;
  }

  merge(other: PolicyResult): PolicyResult {
    if (this.isValid) {
      return other;
    }
    if (other.isValid) {
      return this;
    }
    return new PolicyResult([...this.errors, ...other.errors]);
  }
}
