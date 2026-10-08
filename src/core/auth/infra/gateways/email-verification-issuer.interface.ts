/**
 * `establishment` entrou no Bloco 9.1. O lado de CONSUMO do token
 * (`VerifyEmailService.verify`/`findByToken`/`confirmEmail`) já tratava os três
 * tipos desde sempre — só a emissão estava restrita a músico/público, o que
 * deixava a conta de estabelecimento sem nenhum e-mail de verificação.
 */
export type EmailVerificationSubjectType =
  | "musician"
  | "audience"
  | "establishment";

export interface IEmailVerificationIssuer {
  issueVerificationToken(
    type: EmailVerificationSubjectType,
    id: string,
  ): Promise<void>;
}

/**
 * Boas-vindas, quando a conta passa a ser utilizável: na PRIMEIRA confirmação
 * de e-mail (cadastro por senha) ou ao concluir o cadastro pelo Google (o
 * endereço já vem verificado pelo Google).
 *
 * Nunca no cadastro por senha em si: ali o endereço ainda não foi provado, e
 * mandar boas-vindas para e-mail digitado errado ou de robô queima a
 * reputação do domínio de envio — além de chegar junto com o link de
 * confirmação, dois e-mails no mesmo minuto. Best-effort: falha vira log.
 */
export interface IWelcomeNotifier {
  sendWelcome(
    type: EmailVerificationSubjectType,
    recipient: { email: string; name: string },
  ): Promise<void>;
}
