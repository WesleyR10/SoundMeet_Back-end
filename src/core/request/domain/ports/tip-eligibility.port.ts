/**
 * O músico consegue RECEBER uma gorjeta hoje?
 *
 * ## Por que é uma porta, e não uma leitura direta de `MusicianWallet`
 *
 * O domínio de `request` não pode depender da infra de `payment` (Clean
 * Architecture). O adapter que sabe ler `MusicianWallet.hasMercadoPagoLink`
 * mora no módulo Nest e é injetado aqui.
 *
 * ## Por que a checagem acontece na CRIAÇÃO do pedido
 *
 * 🔴 A cobrança só nasce no aceite do músico. Se a elegibilidade fosse
 * descoberta lá, o músico aceitaria um pedido de R$10 no meio do show e a
 * cobrança falharia — com o fã achando que pagou e o músico achando que
 * receberia. Barrar na criação transforma isso num aviso calmo, antes de
 * qualquer promessa: "este artista ainda não recebe gorjetas".
 */
export interface ITipEligibilityPort {
  /** `false` quando não há conta do provedor vinculada ao músico. */
  acceptsTips(musician_id: string): Promise<boolean>;
}
