import { BandId } from "../../../core/musician/domain/band.aggregate";
import {
  BandInviteAcceptedEvent,
  BandInviteDeclinedEvent,
} from "../../../core/musician/domain/events/band-invite-responded.event";
import { BandMemberInvitedEvent } from "../../../core/musician/domain/events/band-member-invited.event";
import { Musician } from "../../../core/musician/domain/musician.aggregate";
import { MusicianInMemoryRepository } from "../../../core/musician/infra/db/in-memory/musician-in-memory.repository";
import { BandEventsHandler } from "../band-events.handler";

const TOKEN_LEADER = "ExponentPushToken[leader]";
const TOKEN_INVITED = "ExponentPushToken[invited]";

describe("BandEventsHandler — avisos do convite de banda", () => {
  let handler: BandEventsHandler;
  let push: { send: jest.Mock };
  let musicianRepo: MusicianInMemoryRepository;
  let leader: Musician;
  let invited: Musician;
  const band_id = new BandId();

  beforeEach(async () => {
    push = { send: jest.fn().mockResolvedValue(undefined) };
    musicianRepo = new MusicianInMemoryRepository();
    handler = new BandEventsHandler(musicianRepo, push as never);

    leader = Musician.fake().aMusician().build();
    leader.registerPushToken(TOKEN_LEADER, "android");
    invited = Musician.fake().aMusician().build();
    invited.registerPushToken(TOKEN_INVITED, "android");
    await musicianRepo.bulkInsert([leader, invited]);
  });

  const responded = () => ({
    band_id,
    band_name: "Blues Duo",
    musician_id: invited.musician_id.id,
    instrument: "Voz",
    leader_musician_id: leader.musician_id.id,
  });

  it("🔴 o CONVIDADO é avisado do convite — antes ele não tinha como saber", async () => {
    await handler.handleMemberInvited(
      new BandMemberInvitedEvent({
        band_id,
        band_name: "Blues Duo",
        musician_id: invited.musician_id.id,
        instrument: "Voz",
      }),
    );

    expect(push.send).toHaveBeenCalledTimes(1);
    expect(push.send).toHaveBeenCalledWith(
      TOKEN_INVITED,
      expect.objectContaining({
        body: "Blues Duo te convidou para tocar Voz.",
        // É o `type` que o app usa para abrir "Minhas bandas" no toque.
        data: { type: "band.invite.received", band_id: band_id.id },
      }),
    );
  });

  it("o LÍDER é avisado quando o convite é aceito", async () => {
    await handler.handleInviteAccepted(
      new BandInviteAcceptedEvent(responded()),
    );

    expect(push.send).toHaveBeenCalledWith(
      TOKEN_LEADER,
      expect.objectContaining({
        data: { type: "band.invite.accepted", band_id: band_id.id },
      }),
    );
    expect(push.send.mock.calls[0][1].body).toContain("entrou na Blues Duo");
  });

  it("o LÍDER é avisado quando o convite é recusado", async () => {
    await handler.handleInviteDeclined(
      new BandInviteDeclinedEvent(responded()),
    );

    expect(push.send).toHaveBeenCalledWith(
      TOKEN_LEADER,
      expect.objectContaining({
        data: { type: "band.invite.declined", band_id: band_id.id },
      }),
    );
  });

  it("sem token de push não tenta enviar — o convite continua em 'Minhas bandas'", async () => {
    const noToken = Musician.fake().aMusician().build();
    await musicianRepo.insert(noToken);

    await handler.handleMemberInvited(
      new BandMemberInvitedEvent({
        band_id,
        band_name: "Blues Duo",
        musician_id: noToken.musician_id.id,
        instrument: "Voz",
      }),
    );

    expect(push.send).not.toHaveBeenCalled();
  });

  it("banda sem líder não tem a quem devolver a resposta", async () => {
    await handler.handleInviteAccepted(
      new BandInviteAcceptedEvent({ ...responded(), leader_musician_id: null }),
    );

    expect(push.send).not.toHaveBeenCalled();
  });

  it("🔴 falha do push não sobe: o convite já foi gravado e não pode ser derrubado por ela", async () => {
    push.send.mockRejectedValueOnce(new Error("Expo fora"));

    await expect(
      handler.handleMemberInvited(
        new BandMemberInvitedEvent({
          band_id,
          band_name: "Blues Duo",
          musician_id: invited.musician_id.id,
          instrument: "Voz",
        }),
      ),
    ).resolves.toBeUndefined();
  });
});
