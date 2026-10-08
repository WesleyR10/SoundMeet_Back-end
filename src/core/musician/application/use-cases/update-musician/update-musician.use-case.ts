import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { DomainEventMediator } from "../../../../shared/domain/events/domain-event-mediator";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Phone } from "../../../../shared/domain/value-objects/phone.vo";
import { Musician } from "../../../domain/musician.aggregate";
import { MusicianId } from "../../../domain/musician.aggregate";
import { IMusicianRepository } from "../../../domain/musician.repository";
import {
  MusicianOutput,
  MusicianOutputMapper,
} from "../common/musician-profile-output";
import { UpdateMusicianInput } from "./update-musician.input";

export class UpdateMusicianUseCase implements IUseCase<
  UpdateMusicianInput,
  UpdateMusicianOutput
> {
  constructor(
    private readonly musicianRepo: IMusicianRepository,
    private readonly domainEventMediator?: DomainEventMediator,
  ) {}

  async execute(input: UpdateMusicianInput): Promise<UpdateMusicianOutput> {
    const musicianId = new MusicianId(input.id);
    const entity = await this.musicianRepo.findById(musicianId);

    if (!entity) {
      throw new NotFoundError(input.id, Musician);
    }

    if (input.email !== undefined && input.email !== entity.email.value) {
      const existing = await this.musicianRepo.findByEmail(input.email);
      if (existing && existing.musician_id.id !== entity.musician_id.id) {
        throw new EntityValidationError([
          { email: ["Email already in use by another musician"] },
        ]);
      }
      // Só PEDE a troca: o e-mail muda quando o link for clicado.
      entity.requestEmailChange(input.email);
    }

    /*
     * O CNPJ é `@unique`: sem esta checagem, dois músicos com o mesmo MEI
     * estouram P2002 do Prisma e o usuário recebe 500 em vez da mensagem.
     * Mesmo cuidado que o e-mail acima já tomava.
     */
    if (input.cnpj !== undefined && input.cnpj !== entity.cnpj?.value) {
      if (input.cnpj) {
        const existing = await this.musicianRepo.findByCnpj(input.cnpj);
        if (existing && existing.musician_id.id !== entity.musician_id.id) {
          throw new EntityValidationError([
            { cnpj: ["CNPJ already in use by another musician"] },
          ]);
        }
      }
      entity.changeCnpj(input.cnpj);
    }

    /*
     * O telefone também é `@unique`. Sem esta checagem a colisão chegava como
     * P2002 e o músico lia "Unique constraint violation" (409), sem saber qual
     * campo — o e-mail e o CNPJ acima já tinham o cuidado, o telefone não.
     * Formato inválido não é tratado aqui: `changePhone` o reporta logo abaixo.
     */
    if (input.phone) {
      const phoneOrError = Phone.create(input.phone);
      if (
        phoneOrError.isOk() &&
        phoneOrError.ok.value !== entity.phone?.value
      ) {
        const existing = await this.musicianRepo.findByPhone(
          phoneOrError.ok.value,
        );
        if (existing && existing.musician_id.id !== entity.musician_id.id) {
          throw new EntityValidationError([
            { phone: ["Phone already in use by another musician"] },
          ]);
        }
      }
    }

    input.name !== undefined && entity.changeName(input.name);
    input.stage_name !== undefined && entity.changeStageName(input.stage_name);
    input.bio !== undefined && entity.changeBio(input.bio);
    input.phone !== undefined && entity.changePhone(input.phone);
    input.genres !== undefined && entity.updateGenres(input.genres);
    input.instruments !== undefined &&
      entity.updateInstruments(input.instruments);
    input.experience_years !== undefined &&
      entity.updateExperience(input.experience_years);

    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    await this.musicianRepo.update(entity);
    await this.domainEventMediator?.publish(entity);

    return MusicianOutputMapper.toOutput(entity);
  }
}

export type UpdateMusicianOutput = MusicianOutput;
