import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Musician, MusicianId } from "../../../domain/musician.aggregate";
import { IMusicianRepository } from "../../../domain/musician.repository";

export type ClearPushTokenInput = {
  id: string;
};

export type ClearPushTokenOutput = void;

/**
 * Apaga o token de push do músico — o que o app chama ao SAIR da conta.
 *
 * 🔴 Sem isto o token nunca era apagado: `registerPushToken` só sabia
 * sobrescrever. Depois do logout o aparelho continuava recebendo "novo pedido"
 * e "proposta de show" daquele músico, inclusive com outra pessoa já logada
 * nele — o aviso de uma conta chegando na tela de outra.
 *
 * **Idempotente:** quem já não tem token recebe o mesmo resultado. O logout
 * não pode falhar por causa de uma limpeza que já aconteceu.
 */
export class ClearPushTokenUseCase implements IUseCase<
  ClearPushTokenInput,
  ClearPushTokenOutput
> {
  constructor(private readonly musicianRepo: IMusicianRepository) {}

  async execute(input: ClearPushTokenInput): Promise<ClearPushTokenOutput> {
    const musician = await this.musicianRepo.findById(new MusicianId(input.id));

    if (!musician) {
      throw new NotFoundError(input.id, Musician);
    }

    if (musician.push_token === null) {
      return;
    }

    musician.clearPushToken();

    await this.musicianRepo.update(musician);
  }
}
