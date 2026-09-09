import { Audience } from "../../../core/audience/domain/audience.aggregate";
import { IAudienceRepository } from "../../../core/audience/domain/audience.repository";
import { Musician } from "../../../core/musician/domain/musician.aggregate";
import { IMusicianRepository } from "../../../core/musician/domain/musician.repository";
import { TipCompletedEvent } from "../../../core/payment/domain/events/tip-completed.event";
import { ITipRepository } from "../../../core/payment/domain/repositories";
import { Tip } from "../../../core/payment/domain/tip.aggregate";
import { PaymentMethod } from "../../../core/payment/domain/tip-enums";
import { Money, Uuid } from "../../../core/shared/domain";
import { NotificationsGateway } from "../notifications.gateway";
import { NotificationsPaymentEventsHandler } from "../payment-events.handler";
import { PushNotificationService } from "../push-notification.service";

const makeGatewayMock = (): jest.Mocked<
  Pick<NotificationsGateway, "notifyTipReceived" | "notifyTipConfirmed">
> => ({
  notifyTipReceived: jest.fn(),
  notifyTipConfirmed: jest.fn(),
});

const makeMusicianRepoMock = (): jest.Mocked<
  Pick<IMusicianRepository, "findById">
> => ({
  findById: jest.fn(),
});

const makeAudienceRepoMock = (): jest.Mocked<
  Pick<IAudienceRepository, "findById">
> => ({
  findById: jest.fn(),
});

const makeTipRepoMock = (): jest.Mocked<Pick<ITipRepository, "findById">> => ({
  findById: jest.fn(),
});

const makePushServiceMock = (): jest.Mocked<
  Pick<PushNotificationService, "send">
> => ({
  send: jest.fn(),
});

describe("NotificationsPaymentEventsHandler", () => {
  let handler: NotificationsPaymentEventsHandler;
  let gateway: jest.Mocked<
    Pick<NotificationsGateway, "notifyTipReceived" | "notifyTipConfirmed">
  >;
  let musicianRepo: jest.Mocked<Pick<IMusicianRepository, "findById">>;
  let audienceRepo: jest.Mocked<Pick<IAudienceRepository, "findById">>;
  let tipRepo: jest.Mocked<Pick<ITipRepository, "findById">>;
  let pushNotificationService: jest.Mocked<
    Pick<PushNotificationService, "send">
  >;

  const musicianId = "8c0e9a2e-1b7a-4f3e-9c2a-2a6b1e4d5f01";
  const audienceId = "22222222-2222-4222-8222-222222222222";

  function makeEvent() {
    return new TipCompletedEvent(
      new Uuid("33333333-3333-4333-8333-333333333333"),
      new Money(25),
      new Uuid(musicianId),
      new Uuid(audienceId),
      null,
    );
  }

  beforeEach(() => {
    gateway = makeGatewayMock();
    musicianRepo = makeMusicianRepoMock();
    audienceRepo = makeAudienceRepoMock();
    tipRepo = makeTipRepoMock();
    pushNotificationService = makePushServiceMock();
    handler = new NotificationsPaymentEventsHandler(
      gateway as unknown as NotificationsGateway,
      musicianRepo as unknown as IMusicianRepository,
      audienceRepo as unknown as IAudienceRepository,
      tipRepo as unknown as ITipRepository,
      pushNotificationService as unknown as PushNotificationService,
    );
  });

  it("should notify the gateway with the fan's name when the tip is not anonymous", async () => {
    const tip = Tip.create({
      audience_id: audienceId,
      musician_id: musicianId,
      amount: 25,
      payment_method: PaymentMethod.PIX,
      message: "Muito bom!",
    });
    tipRepo.findById.mockResolvedValue(tip);
    audienceRepo.findById.mockResolvedValue(
      Audience.fake().aAudience().withName("Maria").build(),
    );
    musicianRepo.findById.mockResolvedValue(null);

    await handler.handleTipCompleted(makeEvent());

    expect(gateway.notifyTipReceived).toHaveBeenCalledTimes(1);
    expect(gateway.notifyTipReceived).toHaveBeenCalledWith(
      musicianId,
      expect.objectContaining({
        musician_id: musicianId,
        audience_id: audienceId,
        amount: 25,
        fan_name: "Maria",
        message: "Muito bom!",
        is_anonymous: false,
      }),
    );
  });

  it("should use a generic fan name when the tip is anonymous", async () => {
    const tip = Tip.create({
      audience_id: audienceId,
      musician_id: musicianId,
      amount: 10,
      payment_method: PaymentMethod.PIX,
      is_anonymous: true,
    });
    tipRepo.findById.mockResolvedValue(tip);
    audienceRepo.findById.mockResolvedValue(
      Audience.fake().aAudience().withName("Maria").build(),
    );
    musicianRepo.findById.mockResolvedValue(null);

    await handler.handleTipCompleted(makeEvent());

    expect(gateway.notifyTipReceived).toHaveBeenCalledWith(
      musicianId,
      expect.objectContaining({ fan_name: "Um fã", is_anonymous: true }),
    );
  });

  it("should send a push notification when the musician has a push_token", async () => {
    tipRepo.findById.mockResolvedValue(null);
    audienceRepo.findById.mockResolvedValue(null);
    const musician = Musician.fake().aMusician().build();
    musician.registerPushToken("ExponentPushToken[abc123]", "android");
    musicianRepo.findById.mockResolvedValue(musician);

    await handler.handleTipCompleted(makeEvent());

    expect(pushNotificationService.send).toHaveBeenCalledTimes(1);
    expect(pushNotificationService.send).toHaveBeenCalledWith(
      "ExponentPushToken[abc123]",
      expect.objectContaining({
        title: expect.any(String),
        body: expect.stringContaining("R$25.00"),
      }),
    );
  });

  it("should not send a push notification when the musician has no push_token", async () => {
    tipRepo.findById.mockResolvedValue(null);
    audienceRepo.findById.mockResolvedValue(null);
    musicianRepo.findById.mockResolvedValue(
      Musician.fake().aMusician().build(),
    );

    await handler.handleTipCompleted(makeEvent());

    expect(pushNotificationService.send).not.toHaveBeenCalled();
  });

  it("should skip notification when the tip has no musician_id (band tip)", async () => {
    const event = new TipCompletedEvent(
      new Uuid("33333333-3333-4333-8333-333333333333"),
      new Money(25),
      null,
      new Uuid(audienceId),
      new Uuid("44444444-4444-4444-8444-444444444444"),
    );

    await handler.handleTipCompleted(event);

    expect(gateway.notifyTipReceived).not.toHaveBeenCalled();
    expect(pushNotificationService.send).not.toHaveBeenCalled();
  });

  it("should not throw when a repository lookup fails", async () => {
    tipRepo.findById.mockRejectedValue(new Error("db down"));

    await expect(
      handler.handleTipCompleted(makeEvent()),
    ).resolves.not.toThrow();
    expect(pushNotificationService.send).not.toHaveBeenCalled();
  });
});
