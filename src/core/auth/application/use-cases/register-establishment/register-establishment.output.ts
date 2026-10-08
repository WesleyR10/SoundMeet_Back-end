export type RegisterEstablishmentOutput = {
  /**
   * UUID do agregado `Establishment` — **não** é o `sub` do usuário, ao
   * contrário de músico e público. Quem autoriza o dono a operá-lo é o claim
   * `establishment_ids`, e não a igualdade `id == sub`.
   */
  establishment_id: string;
};

/*
 * 🔴 AUTH-1 — este output NÃO devolve tokens, e a ausência é a feature.
 *
 * Havia `access_token`/`refresh_token`/`needs_token_refresh` aqui. O único
 * chamador (`soundmeet-web`) descartava os três e mandava o usuário pelo
 * Authorization Code + PKCE, porque o refresh token vinha vinculado ao client
 * `soundmeet-mobile` e o access token nascia sem o claim `establishment_ids`
 * (escrito no Keycloak DEPOIS da emissão) — era isso que `needs_token_refresh`
 * anunciava.
 *
 * Quem cadastra segue para o login normal, e o primeiro token dele já nasce
 * completo. Não reintroduzir sem resolver os dois problemas acima.
 */
