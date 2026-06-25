import { IEventRepository } from "@core/events/domain";
import {
  EventInMemoryRepository,
  EventMusicianInMemoryRepository,
} from "@core/events/infra/db/in-memory";
import { Test, TestingModule } from "@nestjs/testing";

import { EstablishmentOutputMapper } from "../../../core/establishment/application/use-cases/common/establishment-output";
import { CreateEstablishmentUseCase } from "../../../core/establishment/application/use-cases/create-establishment/create-establishment.use-case";
import { CreateEstablishmentProfileUseCase } from "../../../core/establishment/application/use-cases/create-establishment-profile/create-establishment-profile.use-case";
import { DeleteEstablishmentUseCase } from "../../../core/establishment/application/use-cases/delete-establishment/delete-establishment.use-case";
import { DeleteEstablishmentProfileUseCase } from "../../../core/establishment/application/use-cases/delete-establishment-profile/delete-establishment-profile.use-case";
import { GetEstablishmentUseCase } from "../../../core/establishment/application/use-cases/get-establishment/get-establishment.use-case";
import { GetHiringDashboardUseCase } from "../../../core/establishment/application/use-cases/get-hiring-dashboard/get-hiring-dashboard.use-case";
import { ListEstablishmentAnalyticsUseCase } from "../../../core/establishment/application/use-cases/list-establishment-analytics/list-establishment-analytics.use-case";
import { ListEstablishmentsUseCase } from "../../../core/establishment/application/use-cases/list-establishments/list-establishments.use-case";
import { UpdateEstablishmentUseCase } from "../../../core/establishment/application/use-cases/update-establishment/update-establishment.use-case";
import { UpdateEstablishmentProfileUseCase } from "../../../core/establishment/application/use-cases/update-establishment-profile/update-establishment-profile.use-case";
import {
  Establishment,
  EstablishmentId,
} from "../../../core/establishment/domain/establishment.aggregate";
import { IEstablishmentRepository } from "../../../core/establishment/domain/establishment.repository";
import { EstablishmentInMemoryRepository } from "../../../core/establishment/infra/db/in-memory/establishment-in-memory.repository";
import { ActivateEventUseCase } from "../../../core/events/application/use-cases/activate-event/activate-event.use-case";
import { AddEventAttendeeUseCase } from "../../../core/events/application/use-cases/add-event-attendee/add-event-attendee.use-case";
import { AddEventPerformerUseCase } from "../../../core/events/application/use-cases/add-event-performer/add-event-performer.use-case";
import { CancelEventUseCase } from "../../../core/events/application/use-cases/cancel-event/cancel-event.use-case";
import { CreateEventUseCase } from "../../../core/events/application/use-cases/create-event/create-event.use-case";
import { DeleteEventUseCase } from "../../../core/events/application/use-cases/delete-event/delete-event.use-case";
import { FinishEventUseCase } from "../../../core/events/application/use-cases/finish-event/finish-event.use-case";
import { GetEventUseCase } from "../../../core/events/application/use-cases/get-event/get-event.use-case";
import { ListEventsUseCase } from "../../../core/events/application/use-cases/list-events/list-events.use-case";
import { ListEventAttendeesUseCase } from "../../../core/events/application/use-cases/list-event-attendees/list-event-attendees.use-case";
import { ListEventMusiciansUseCase } from "../../../core/events/application/use-cases/list-event-musicians/list-event-musicians.use-case";
import { RemoveEventAttendeeUseCase } from "../../../core/events/application/use-cases/remove-event-attendee/remove-event-attendee.use-case";
import { RemoveEventPerformerUseCase } from "../../../core/events/application/use-cases/remove-event-performer/remove-event-performer.use-case";
import { UpdateEventMusicianStatusUseCase } from "../../../core/events/application/use-cases/update-event-musician-status/update-event-musician-status.use-case";
import { UpdateEventUseCase } from "../../../core/events/application/use-cases/update-event/update-event.use-case";
import { EntityValidationError } from "../../../core/shared/domain/validators/validation.error";
import { applyAuthGuardMocks } from "../../shared-module/testing/auth-guard-mock";
import {
  EstablishmentCollectionPresenter,
  EstablishmentPresenter,
  EstablishmentProfilePresenter,
} from "../establishment.presenter";
import { EstablishmentsController } from "../establishments.controller";

describe("EstablishmentsController Integration Tests", () => {
  let controller: EstablishmentsController;
  let repository: IEstablishmentRepository;

  beforeEach(async () => {
    const repositoryInstance = new EstablishmentInMemoryRepository();
    const eventRepositoryInstance = new EventInMemoryRepository();
    const eventMusicianRepositoryInstance = new EventMusicianInMemoryRepository();

    const moduleBuilder = Test.createTestingModule({
      controllers: [EstablishmentsController],
      providers: [
        {
          provide: "EstablishmentRepository",
          useValue: repositoryInstance,
        },
        {
          provide: "EventRepository",
          useValue: eventRepositoryInstance,
        },
        {
          provide: CreateEstablishmentUseCase,
          useFactory: (repo: IEstablishmentRepository) =>
            new CreateEstablishmentUseCase(repo),
          inject: ["EstablishmentRepository"],
        },
        {
          provide: UpdateEstablishmentUseCase,
          useFactory: (repo: IEstablishmentRepository) =>
            new UpdateEstablishmentUseCase(repo),
          inject: ["EstablishmentRepository"],
        },
        {
          provide: DeleteEstablishmentUseCase,
          useFactory: (repo: IEstablishmentRepository) =>
            new DeleteEstablishmentUseCase(repo),
          inject: ["EstablishmentRepository"],
        },
        {
          provide: GetEstablishmentUseCase,
          useFactory: (repo: IEstablishmentRepository) =>
            new GetEstablishmentUseCase(repo),
          inject: ["EstablishmentRepository"],
        },
        {
          provide: ListEstablishmentsUseCase,
          useFactory: (repo: IEstablishmentRepository) =>
            new ListEstablishmentsUseCase(repo),
          inject: ["EstablishmentRepository"],
        },
        {
          provide: CreateEstablishmentProfileUseCase,
          useFactory: (repo: IEstablishmentRepository) =>
            new CreateEstablishmentProfileUseCase(repo),
          inject: ["EstablishmentRepository"],
        },
        {
          provide: UpdateEstablishmentProfileUseCase,
          useFactory: (repo: IEstablishmentRepository) =>
            new UpdateEstablishmentProfileUseCase(repo),
          inject: ["EstablishmentRepository"],
        },
        {
          provide: DeleteEstablishmentProfileUseCase,
          useFactory: (repo: IEstablishmentRepository) =>
            new DeleteEstablishmentProfileUseCase(repo),
          inject: ["EstablishmentRepository"],
        },
        {
          provide: CreateEventUseCase,
          useFactory: (repo: IEventRepository) => new CreateEventUseCase(repo),
          inject: ["EventRepository"],
        },
        {
          provide: UpdateEventUseCase,
          useFactory: (repo: IEventRepository) => new UpdateEventUseCase(repo),
          inject: ["EventRepository"],
        },
        {
          provide: GetEventUseCase,
          useFactory: (repo: IEventRepository) => new GetEventUseCase(repo),
          inject: ["EventRepository"],
        },
        {
          provide: ListEventsUseCase,
          useFactory: (repo: IEventRepository) => new ListEventsUseCase(repo),
          inject: ["EventRepository"],
        },
        {
          provide: DeleteEventUseCase,
          useFactory: (repo: IEventRepository) => new DeleteEventUseCase(repo),
          inject: ["EventRepository"],
        },
        {
          provide: ActivateEventUseCase,
          useFactory: (repo: IEventRepository) =>
            new ActivateEventUseCase(repo),
          inject: ["EventRepository"],
        },
        {
          provide: CancelEventUseCase,
          useFactory: (repo: IEventRepository) => new CancelEventUseCase(repo),
          inject: ["EventRepository"],
        },
        {
          provide: FinishEventUseCase,
          useFactory: (repo: IEventRepository) => new FinishEventUseCase(repo),
          inject: ["EventRepository"],
        },
        {
          provide: AddEventAttendeeUseCase,
          useFactory: (repo: IEventRepository) =>
            new AddEventAttendeeUseCase(repo),
          inject: ["EventRepository"],
        },
        {
          provide: RemoveEventAttendeeUseCase,
          useFactory: (repo: IEventRepository) =>
            new RemoveEventAttendeeUseCase(repo),
          inject: ["EventRepository"],
        },
        {
          provide: AddEventPerformerUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: RemoveEventPerformerUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: ListEventAttendeesUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: ListEventMusiciansUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: UpdateEventMusicianStatusUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: GetHiringDashboardUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: ListEstablishmentAnalyticsUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
      ],
    });

    const module: TestingModule =
      await applyAuthGuardMocks(moduleBuilder).compile();

    controller = module.get<EstablishmentsController>(EstablishmentsController);
    repository = module.get<IEstablishmentRepository>(
      "EstablishmentRepository",
    );
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
    expect(controller["createUseCase"]).toBeInstanceOf(
      CreateEstablishmentUseCase,
    );
    expect(controller["updateUseCase"]).toBeInstanceOf(
      UpdateEstablishmentUseCase,
    );
    expect(controller["listUseCase"]).toBeInstanceOf(ListEstablishmentsUseCase);
    expect(controller["getUseCase"]).toBeInstanceOf(GetEstablishmentUseCase);
    expect(controller["deleteUseCase"]).toBeInstanceOf(
      DeleteEstablishmentUseCase,
    );
    expect(controller["createProfileUseCase"]).toBeInstanceOf(
      CreateEstablishmentProfileUseCase,
    );
    expect(controller["updateProfileUseCase"]).toBeInstanceOf(
      UpdateEstablishmentProfileUseCase,
    );
    expect(controller["deleteProfileUseCase"]).toBeInstanceOf(
      DeleteEstablishmentProfileUseCase,
    );
  });

  it("should create an establishment", async () => {
    const presenter = await controller.create({
      name: "Rock Bar",
      email: "rock@bar.com",
      phone: "+5511999999999",
      establishment_type: "bar",
    } as any);

    const entity = await repository.findById(new EstablishmentId(presenter.id));
    expect(entity).toBeInstanceOf(Establishment);
    expect(presenter.qr_code).toBe(`soundmeet://establishment/${presenter.id}`);

    const output = EstablishmentOutputMapper.toOutput(entity!);
    expect(presenter).toEqual(new EstablishmentPresenter(output));
  });

  it("should update an establishment", async () => {
    const establishment = Establishment.fake()
      .anEstablishment()
      .withName("Original Name")
      .withEmail("original@bar.com")
      .withPhone("+5511888888888")
      .withEstablishmentType("bar")
      .build();
    await repository.insert(establishment);

    const presenter = await controller.update(
      establishment.establishment_id.id,
      {
        name: "Updated Name",
        website: "https://example.com",
      } as any,
    );

    const entity = await repository.findById(establishment.establishment_id);
    expect(entity!.name).toBe("Updated Name");
    expect(entity!.website).toBe("https://example.com");
    expect(presenter.qr_code).toBe(`soundmeet://establishment/${presenter.id}`);
  });

  it("should create, update and delete an establishment profile", async () => {
    const establishment = Establishment.fake()
      .anEstablishment()
      .withName("Profile Venue")
      .withEmail("profile@venue.com")
      .withPhone("+5511777777777")
      .withEstablishmentType("club")
      .build();
    establishment.removeProfile();
    await repository.insert(establishment);

    const created = await controller.createProfile(
      establishment.establishment_id.id,
      {
        capacity: 300,
        location: {
          street: "Av. Paulista",
          number: "1000",
          neighborhood: "Bela Vista",
          city: "São Paulo",
          state: "SP",
          zipCode: "01310-100",
          country: "BR",
          latitude: -23.561684,
          longitude: -46.655981,
        },
        amenities: ["stage", "sound_system"],
        preferredGenres: ["rock"],
      } as any,
    );
    expect(created).toBeInstanceOf(EstablishmentProfilePresenter);
    expect(created.establishment_id).toBe(establishment.establishment_id.id);

    const updated = await controller.updateProfile(
      establishment.establishment_id.id,
      {
        capacity: 450,
        operatingHours: { monday: { open: "18:00", close: "02:00" } },
      } as any,
    );
    expect(updated).toBeInstanceOf(EstablishmentProfilePresenter);
    expect(updated.capacity).toBe(450);
    expect(updated.operating_hours).toEqual({
      timezone: "UTC",
      weekly: {
        1: [{ start: "18:00", end: "02:00" }],
      },
      specialDays: [],
      vacations: [],
      closures: [],
    });

    const response = await controller.removeProfile(
      establishment.establishment_id.id,
    );
    expect(response).not.toBeDefined();

    const entity = await repository.findById(establishment.establishment_id);
    expect(entity!.profile).toBeNull();
  });

  it("should create a profile via updateProfile when it does not exist", async () => {
    const establishment = Establishment.fake()
      .anEstablishment()
      .withName("Update Creates Profile")
      .withEmail("update-creates@venue.com")
      .withPhone("+5511777777777")
      .withEstablishmentType("club")
      .build();
    establishment.removeProfile();
    await repository.insert(establishment);

    const updated = await controller.updateProfile(
      establishment.establishment_id.id,
      {
        location: {
          street: "Av Paulista",
          number: "1000",
          neighborhood: "Bela Vista",
          city: "São Paulo",
          state: "SP",
          zipCode: "01310100",
        },
        amenities: ["stage"],
      } as any,
    );

    expect(updated).toBeInstanceOf(EstablishmentProfilePresenter);
    expect(updated.amenities).toEqual(["stage"]);
  });

  it("should throw EntityValidationError when creating profile that already exists", async () => {
    const establishment = Establishment.fake()
      .anEstablishment()
      .withName("Already Has Profile")
      .withEmail("already@venue.com")
      .withPhone("+5511777777777")
      .withEstablishmentType("club")
      .build();
    await repository.insert(establishment);

    await controller.createProfile(establishment.establishment_id.id, {
      location: {
        street: "Rua A",
        number: "10",
        neighborhood: "Centro",
        city: "São Paulo",
        state: "SP",
        zipCode: "01001000",
      },
    } as any);

    await expect(
      controller.createProfile(establishment.establishment_id.id, {
        location: {
          street: "Rua A",
          number: "10",
          neighborhood: "Centro",
          city: "São Paulo",
          state: "SP",
          zipCode: "01001000",
        },
      } as any),
    ).rejects.toThrow(EntityValidationError);
  });

  it("should throw EntityValidationError when updating profile without location and it does not exist", async () => {
    const establishment = Establishment.fake()
      .anEstablishment()
      .withName("No Profile")
      .withEmail("no-profile@venue.com")
      .withPhone("+5511777777777")
      .withEstablishmentType("club")
      .build();
    establishment.removeProfile();
    await repository.insert(establishment);

    await expect(
      controller.updateProfile(establishment.establishment_id.id, {
        capacity: 100,
      } as any),
    ).rejects.toThrow(EntityValidationError);
  });

  it("should throw EntityValidationError when creating profile with invalid capacity", async () => {
    const establishment = Establishment.fake()
      .anEstablishment()
      .withName("Invalid Capacity")
      .withEmail("invalid-capacity@venue.com")
      .withPhone("+5511777777777")
      .withEstablishmentType("club")
      .build();
    establishment.removeProfile();
    await repository.insert(establishment);

    await expect(
      controller.createProfile(establishment.establishment_id.id, {
        capacity: -1,
        location: {
          street: "Rua A",
          number: "10",
          neighborhood: "Centro",
          city: "São Paulo",
          state: "SP",
          zipCode: "01001000",
        },
      } as any),
    ).rejects.toThrow(EntityValidationError);
  });

  it("should throw EntityValidationError when creating profile with invalid address", async () => {
    const establishment = Establishment.fake()
      .anEstablishment()
      .withName("Invalid Address")
      .withEmail("invalid-address@venue.com")
      .withPhone("+5511777777777")
      .withEstablishmentType("club")
      .build();
    establishment.removeProfile();
    await repository.insert(establishment);

    await expect(
      controller.createProfile(establishment.establishment_id.id, {
        location: {
          street: "Rua A",
          number: "10",
          neighborhood: "Centro",
          city: "São Paulo",
          state: "SP",
          zipCode: "123",
        },
      } as any),
    ).rejects.toThrow(EntityValidationError);
  });

  it("should delete an establishment", async () => {
    const establishment = Establishment.fake().anEstablishment().build();
    await repository.insert(establishment);

    const response = await controller.remove(establishment.establishment_id.id);
    expect(response).not.toBeDefined();

    await expect(
      repository.findById(establishment.establishment_id),
    ).resolves.toBeNull();
  });

  it("should get an establishment", async () => {
    const establishment = Establishment.fake()
      .anEstablishment()
      .withName("Test Restaurant")
      .withEmail("test@restaurant.com")
      .withPhone("+5511666666666")
      .withEstablishmentType("restaurant")
      .build();
    await repository.insert(establishment);

    const presenter = await controller.findOne(
      establishment.establishment_id.id,
    );
    expect(presenter.id).toBe(establishment.establishment_id.id);
    expect(presenter.name).toBe("Test Restaurant");
    expect(presenter.email).toBe("test@restaurant.com");
    expect(presenter.qr_code).toBe(
      `soundmeet://establishment/${establishment.establishment_id.id}`,
    );
  });

  it("should list establishments", async () => {
    const establishments = Establishment.fake().theEstablishments(2).build();
    await repository.bulkInsert(establishments);

    const presenter = await controller.findAll({
      page: 1,
      per_page: 10,
    } as any);
    expect(presenter).toBeInstanceOf(EstablishmentCollectionPresenter);
    expect(presenter.data.length).toBe(2);
  });
});
