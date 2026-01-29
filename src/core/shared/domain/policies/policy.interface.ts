import { PolicyResult } from "./policy-result";

export interface IPolicy<TContext = any> {
  evaluate(context: TContext): PolicyResult;
}
