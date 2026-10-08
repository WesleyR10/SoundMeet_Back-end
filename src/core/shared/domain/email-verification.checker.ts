// Port de checagem de e-mail confirmado.
//
// Existe porque `email_verified_at` é campo de INFRA — o `emails-do-produto.md` registra
// que ele não pertence ao agregado e é gerenciado direto via Prisma pelo fluxo
// de verificação. Um use-case de domínio que precise da resposta não pode ler
// a coluna, então pergunta por esta porta. Implementação em
// `nest-modules/auth-module/` (Prisma) + fake para testes.
//
// Espelha a forma de `IGeocodingService`: interface no domínio, adapters fora.

export interface IEmailVerificationChecker {
  /**
   * O e-mail deste músico já foi confirmado?
   *
   * 🔴 Retorna `false` quando não sabe (perfil inexistente). Falhar para o lado
   * FECHADO é obrigatório aqui: quem consome esta porta usa a resposta para
   * liberar movimentação de dinheiro, e um `true` por omissão anularia o gate
   * inteiro em silêncio — o mesmo modo de falha do `InternalTokenGuard`, que
   * por isso é fail-closed.
   */
  isMusicianEmailVerified(musicianId: string): Promise<boolean>;
}
