import { IsBoolean, IsIn, IsOptional, IsUUID } from "class-validator";

import { CLAUSE_TONES } from "../../../domain/catalog/clause.types";

/**
 * Entrada da emissão.
 *
 * Só `booking_id` é obrigatório entre os fatos do contrato: todo o resto é
 * derivado do `Booking`, do `Establishment` e do artista. Os três campos
 * opcionais são os únicos fatos que **nenhum agregado sabe** e que mudam o
 * contrato:
 *
 * - `outdoor` — apresentação em área descoberta muda a cláusula de caso
 *   fortuito (chuva sem menção expressa é litígio garantido);
 * - `exclusivity_requested` — a cláusula de raio é opt-in por desenho:
 *   exclusividade imposta em show de bar é o excesso que derruba o contrato
 *   inteiro por má-fé;
 * - `tone` — a "variedade" de redação. Sem ele, `formal`.
 *
 * 🔴 **Os três NÃO são aceitos pela rota HTTP.** `IssueContractDto` os remove
 * com `OmitType`, e o `whitelist: true` do `ValidationPipe` global descarta o
 * que não está declarado. Eles existem para a emissão automática
 * (`ContractIssuanceHandler`), que os monta em código. A retentativa manual
 * carrega **apenas** o `booking_id` — decisão de produto tomada na fatia B3:
 * exclusividade tem tetos legais e não cabe num botão de "tentar de novo", e
 * deixar o tom no corpo permitiria a uma das partes escolher sozinha a redação
 * que a outra vai assinar.
 */
export class IssueContractInput {
  @IsUUID("4")
  booking_id: string;

  /**
   * Identidades do requisitante (o `sub` mais os claims `establishment_ids` e
   * `band_ids`), ou **`null` para a emissão pelo sistema**.
   *
   * 🔴 **Obrigatório e sem default, de propósito.** Um campo opcional é
   * esquecido em silêncio — foi exatamente assim que esta rota nasceu sem
   * autorização nenhuma, deixando qualquer usuário autenticado fazer nascer
   * contrato alheio (com PDF no storage e e-mail para as duas partes) só por
   * conhecer um `booking_id`. Obrigatório força cada novo chamador a
   * **decidir** entre "sou um ator HTTP" e "sou o handler de evento", e o `tsc`
   * cobra a decisão. Mesma lição registrada em `is_owner` do
   * `personal-chord-sheet`.
   *
   * Nunca preenchível pelo corpo: sai do DTO por `OmitType`.
   */
  requesting_participant_ids: string[] | null;

  is_admin?: boolean;

  @IsOptional()
  @IsBoolean()
  outdoor?: boolean;

  @IsOptional()
  @IsBoolean()
  exclusivity_requested?: boolean;

  @IsOptional()
  @IsIn(CLAUSE_TONES as unknown as string[])
  tone?: string;
}
