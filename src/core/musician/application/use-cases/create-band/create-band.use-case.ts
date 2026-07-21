import { IUseCase } from "../../../../shared/application/use-case.interface";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Location } from "../../../../shared/domain/value-objects/location.vo";
import { PriceRange } from "../../../../shared/domain/value-objects/price-range.vo";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import { Band, BandMemberProps } from "../../../domain/band.aggregate";
import { IBandRepository } from "../../../domain/band.repository";
import { BandOutput, BandOutputMapper } from "../common/band-output";
import { CreateBandInput } from "./create-band.input";

export class CreateBandUseCase implements IUseCase<
  CreateBandInput,
  BandOutput
> {
  constructor(private readonly bandRepo: IBandRepository) {}

  async execute(input: CreateBandInput): Promise<BandOutput> {
    // Nunca confiar em `status`/`responded_at`/`member_id` vindos do body —
    // todo membro externo ao criador nasce `pending` e só entra de fato via
    // Band.acceptInvite(). Sem isso, um client poderia mandar
    // `members: [{ musician_id, ... }]` sem `status` e o fallback do
    // construtor de Band (`status: member.status ?? "accepted"`) promoveria
    // o membro a aceito sem nunca passar por inviteMember()/acceptInvite().
    const existingMembers: BandMemberProps[] = (input.members || []).map(
      (m) => ({
        musician_id: m.musician_id,
        role: m.role,
        instrument: m.instrument,
        status: "pending",
        joined_at: new Date(),
        responded_at: null,
      }),
    );

    const members: BandMemberProps[] = input.creator_musician_id
      ? [
          {
            musician_id: new Uuid(input.creator_musician_id),
            role: "leader",
            instrument: "N/A",
            // O líder entra direto como membro aceito — não convida a si mesmo.
            status: "accepted",
            joined_at: new Date(),
            responded_at: new Date(),
          },
          ...existingMembers.filter(
            (m) => m.musician_id.id !== input.creator_musician_id,
          ),
        ]
      : existingMembers;

    const entity = Band.create({
      name: input.name,
      description: input.description,
      avatar: input.avatar,
      genres: input.genres,
      members,
      priceRange: input.priceRange ? new PriceRange(input.priceRange) : null,
      address: input.address ? new Location(input.address) : null,
      open_to_gigs: input.open_to_gigs,
      is_active: input.is_active,
    });

    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    await this.bandRepo.insert(entity);

    return BandOutputMapper.toOutput(entity);
  }
}
