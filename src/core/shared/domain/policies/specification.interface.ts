export interface ISpecification<TCandidate = any> {
  isSatisfiedBy(candidate: TCandidate): boolean;
}
