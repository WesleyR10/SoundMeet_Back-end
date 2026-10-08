import { IUseCase } from "../../../../shared/application/use-case.interface";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import { BandMemberStatus } from "../../../domain/band.aggregate";
import { IBandRepository } from "../../../domain/band.repository";
import { BandOutput, BandOutputMapper } from "../common/band-output";

export type ListMyBandsInput = {
  /** `sub` do token — nunca um id escolhido pelo cliente. */
  musician_id: string;
};

export type MyBandOutput = {
  band: BandOutput;
  /** O estado do vínculo DESTE músico com a banda. */
  membership_status: Extract<BandMemberStatus, "accepted" | "pending">;
};

export type ListMyBandsOutput = {
  items: MyBandOutput[];
};

/**
 * "Minhas bandas": as que integro e os convites que ainda não respondi.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O QUE ISTO CONSERTA
 * ════════════════════════════════════════════════════════════════════════════
 *
 * O app montava esta tela com `GET /bands?filter[musician_id]=` e separava,
 * no cliente, convites pendentes de bandas aceitas. Mas o repositório filtra
 * `status: "accepted"` nesse caminho — de propósito, porque o currículo do
 * músico usa o mesmo filtro e convite não é vínculo. Resultado: a lista de
 * pendentes vinha SEMPRE vazia. O convite era gravado, a rota de aceitar
 * existia, e o convidado não tinha onde vê-lo. Não havia push nem e-mail.
 *
 * Aqui as duas coisas saem da mesma leitura, e o `membership_status` diz qual
 * é qual. Convite RECUSADO não volta: é decisão tomada. Convite pendente de
 * banda já dissolvida também não — `Band.archive` descarta os convites, e o
 * filtro abaixo cobre a linha que tenha sobrado.
 *
 * Sem paginação: um músico integra um punhado de bandas.
 */
export class ListMyBandsUseCase implements IUseCase<
  ListMyBandsInput,
  ListMyBandsOutput
> {
  constructor(private readonly bandRepo: IBandRepository) {}

  async execute(input: ListMyBandsInput): Promise<ListMyBandsOutput> {
    const musicianId = new Uuid(input.musician_id);
    const bands = await this.bandRepo.findByMember(musicianId, [
      "accepted",
      "pending",
    ]);

    const items = bands.flatMap((band): MyBandOutput[] => {
      const status = band.findMember(musicianId)?.status;
      if (status !== "accepted" && status !== "pending") return [];
      if (status === "pending" && band.isArchived) return [];
      return [
        { band: BandOutputMapper.toOutput(band), membership_status: status },
      ];
    });

    return { items };
  }
}
