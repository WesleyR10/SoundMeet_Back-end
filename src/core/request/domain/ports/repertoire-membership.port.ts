/**
 * Aquela linha de biblioteca é mesmo deste músico?
 *
 * ## Por que é uma porta
 *
 * O domínio de `request` não pode depender da infra de `music-library` (Clean
 * Architecture). O adapter que sabe consultar `IMusicLibraryRepository` mora
 * no módulo Nest e é injetado aqui — mesmo desenho de `ITipEligibilityPort`.
 *
 * ## Por que a checagem existe
 *
 * 🔴 `library_id` vem do cliente. Sem conferir o dono, um pedido feito ao
 * músico A poderia apontar para a linha do músico B — e, quando o músico
 * desligou o pedido fora do repertório, bastaria mandar QUALQUER `library_id`
 * válido da plataforma para atravessar a restrição. A regra viraria decoração.
 */
export interface IRepertoireMembershipPort {
  belongsToMusician(
    library_id: string,
    musician_id: string,
  ): Promise<boolean>;
}
