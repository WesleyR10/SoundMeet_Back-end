import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Musician, MusicianId } from "../../../domain/musician.aggregate";
import { IMusicianRepository } from "../../../domain/musician.repository";
import { MusicianOutputMapper } from "../common/musician-profile-output";
import { RegisterPushTokenInput } from "./register-push-token.input";
import { RegisterPushTokenOutput } from "./register-push-token.output";

export class RegisterPushTokenUseCase implements IUseCase<
  RegisterPushTokenInput,
  RegisterPushTokenOutput
> {
  constructor(private readonly musicianRepo: IMusicianRepository) {}

  async execute(
    input: RegisterPushTokenInput,
  ): Promise<RegisterPushTokenOutput> {
    const musicianId = new MusicianId(input.id);
    const musician = await this.musicianRepo.findById(musicianId);

    if (!musician) {
      throw new NotFoundError(input.id, Musician);
    }

    musician.registerPushToken(input.push_token, input.push_token_platform);

    await this.musicianRepo.update(musician);

    return MusicianOutputMapper.toOutput(musician);
  }
}
