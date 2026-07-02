export type EmailVerificationSubjectType = "musician" | "audience";

export interface IEmailVerificationIssuer {
  issueVerificationToken(
    type: EmailVerificationSubjectType,
    id: string,
  ): Promise<void>;
}
