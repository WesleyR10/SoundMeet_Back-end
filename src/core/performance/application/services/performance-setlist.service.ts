import {
  Repertoire,
  RepertoireId,
} from "../../../repertoire/domain/repertoire.aggregate";
import { IRepertoireRepository } from "../../../repertoire/domain/repertoire.repository";
import { NotFoundError } from "../../../shared/domain/errors/not-found.error";

/**
 * A setlist da noite tem que ser um repertório DO PRÓPRIO músico.
 *
 * 🔴 Sem esta checagem, qualquer músico com set aberto poderia apontar o show
 * para o repertório de outro — e a tela do palco o LERIA (títulos, ordem,
 * notas pessoais), porque o set é dele. O `repertoire_id` vem do corpo, então
 * a posse é afirmação do cliente até ser provada aqui.
 *
 * Repertório alheio responde **404, igual a inexistente**: distinguir os dois
 * confirmaria a quem tenta adivinhar que aquele id existe.
 *
 * ⚠️ Repertório COMPARTILHADO comigo (convite) não conta como meu. Ele pode
 * mudar sem aviso nas mãos do dono no meio do show; se um dia for pedido, é
 * decisão de produto, não uma checagem a afrouxar.
 */
export class PerformanceSetlistService {
  constructor(private readonly repertoireRepo: IRepertoireRepository) {}

  async assertOwnedBy(repertoire_id: string, musician_id: string): Promise<Repertoire> {
    const repertoire = await this.repertoireRepo.findById(new RepertoireId(repertoire_id));
    if (!repertoire || repertoire.musician_id !== musician_id) {
      throw new NotFoundError(repertoire_id, Repertoire);
    }
    return repertoire;
  }
}
