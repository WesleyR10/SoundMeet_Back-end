/**
 * Onde fica o token de push do fã.
 *
 * Fora do agregado `Audience` de propósito — mesmo precedente de
 * `email_verified_at`: é dado de infraestrutura de entrega, e no agregado ele
 * correria o risco de sair por `AudienceOutput` no dia em que alguém
 * serializasse o agregado inteiro. O token identifica o aparelho; vazado, deixa
 * qualquer um mandar push para aquele celular.
 */
export interface IAudiencePushTokenStore {
  /** `false` quando o fã não existe. Último aparelho registrado sobrescreve. */
  save(params: {
    audience_id: string;
    push_token: string;
    platform: "ios" | "android";
  }): Promise<boolean>;
}
