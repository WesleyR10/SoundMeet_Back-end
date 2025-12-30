import { Test, TestingModule } from "@nestjs/testing";
import { MusiciansController } from "../musicians.controller";
import { CreateMusicianUseCase } from "../../../core/musician/application/use-cases/create-musician/create-musician.use-case";
import { UpdateMusicianUseCase } from "../../../core/musician/application/use-cases/update-musician/update-musician.use-case";
import { DeleteMusicianUseCase } from "../../../core/musician/application/use-cases/delete-musician/delete-musician.use-case";
import { GetMusicianUseCase } from "../../../core/musician/application/use-cases/get-musician/get-musician.use-case";
import { ListMusiciansUseCase } from "../../../core/musician/application/use-cases/list-musicians/list-musicians.use-case";

describe("MusiciansController", () => {
  let controller: MusiciansController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MusiciansController],
      providers: [
        {
          provide: CreateMusicianUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: UpdateMusicianUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: DeleteMusicianUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: GetMusicianUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: ListMusiciansUseCase,
          useValue: { execute: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<MusiciansController>(MusiciansController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
});
