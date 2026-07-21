import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { GoogleCalendarIntegration } from "../../../../domain/google-calendar-integration.aggregate";
import { GoogleCalendarIntegrationInMemoryRepository } from "../../../../infra/db/in-memory/google-calendar-integration-in-memory.repository";
import { GetGoogleCalendarStatusUseCase } from "../get-google-calendar-status.use-case";

describe("GetGoogleCalendarStatusUseCase", () => {
  let repo: GoogleCalendarIntegrationInMemoryRepository;
  let useCase: GetGoogleCalendarStatusUseCase;

  beforeEach(() => {
    repo = new GoogleCalendarIntegrationInMemoryRepository();
    useCase = new GetGoogleCalendarStatusUseCase(repo);
  });

  it("retorna connected=false sem integração", async () => {
    const output = await useCase.execute({ musician_id: new Uuid().id });

    expect(output).toEqual({ connected: false, google_account_email: null });
  });

  it("retorna connected=true com e-mail quando ativa", async () => {
    const integration = GoogleCalendarIntegration.fake()
      .aGoogleCalendarIntegration()
      .withGoogleAccountEmail("musico@gmail.com")
      .build();
    repo.items.push(integration);

    const output = await useCase.execute({
      musician_id: integration.musician_id.id,
    });

    expect(output).toEqual({
      connected: true,
      google_account_email: "musico@gmail.com",
    });
  });

  it("retorna connected=false para integração desativada (e-mail não vaza)", async () => {
    const integration = GoogleCalendarIntegration.fake()
      .aGoogleCalendarIntegration()
      .deactivated()
      .build();
    repo.items.push(integration);

    const output = await useCase.execute({
      musician_id: integration.musician_id.id,
    });

    expect(output).toEqual({ connected: false, google_account_email: null });
  });
});
