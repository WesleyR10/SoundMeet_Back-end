import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { UnauthorizedError } from "../../../../shared/domain/errors/unauthorized.error";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import { Band, BandId } from "../../../domain/band.aggregate";
import { IBandRepository } from "../../../domain/band.repository";
import { BandOutput, BandOutputMapper } from "../common/band-output";
import { GetBandInput } from "./get-band.input";

export type GetBandOutput = {
  band: BandOutput;
  /**
   * Quem pediu é integrante ACEITO da banda (ou admin).
   *
   * 🔴 Derivado aqui, comparando o `sub` com a lista de membros gravada —
   * nunca afirmado pelo chamador. É o flag que libera o endereço completo e
   * os convites em aberto; o controller só escolhe o presenter por ele.
   */
  is_member: boolean;
};

/** Aceita qualquer coisa que pareça um UUID; o resto é "ninguém". */
const toUuid = (value?: string | null): Uuid | null => {
  if (!value) return null;
  try {
    return new Uuid(value.trim());
  } catch {
    return null;
  }
};

export class GetBandUseCase implements IUseCase<GetBandInput, GetBandOutput> {
  constructor(private readonly bandRepo: IBandRepository) {}

  async execute(input: GetBandInput): Promise<GetBandOutput> {
    const bandId = new BandId(input.id);
    const entity = await this.bandRepo.findById(bandId);

    if (!entity) {
      throw new NotFoundError(input.id, Band);
    }

    const requester = toUuid(input.requesting_musician_id);
    const is_member =
      !!input.is_admin || (!!requester && entity.isAcceptedMember(requester));

    /*
     * 🔴 Integrante com token expirado recebe 401, não a versão pública.
     *
     * `GET /bands/:id` é pública com autenticação opcional: token recusado
     * vira anônimo. Para um terceiro isso é inofensivo. Para o LÍDER seria um
     * defeito intermitente por desenho — o access token dura 15 minutos, o app
     * só renova a sessão ao receber 401, e daqui sairia 200 com a banda SEM o
     * endereço completo. O formulário de endereço abriria vazio, e salvar
     * gravaria rua e CEP nulos por cima do que existia. É o mesmo defeito que
     * `GET /musicians/:id` teve com o CNPJ.
     *
     * O `sub` recusado NÃO foi verificado, e por isso só serve para recusar
     * mais: forjar o id de um integrante rende um 401, nunca um dado.
     */
    if (!requester && !input.is_admin) {
      const rejected = toUuid(input.rejected_token_sub);
      if (rejected && entity.isAcceptedMember(rejected)) {
        throw new UnauthorizedError("Session expired");
      }
    }

    return { band: BandOutputMapper.toOutput(entity), is_member };
  }
}
