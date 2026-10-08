import { RespondToRequestAction } from "../../respond-to-request/respond-to-request.input";
import { RespondToRequestUseCase } from "../../respond-to-request/respond-to-request.use-case";
import { BatchRespondToRequestsUseCase } from "../batch-respond-to-requests.use-case";

const MUSICIAN = "33333333-3333-4333-8333-333333333333";
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function makeInner(behaviour: (requestId: string) => unknown) {
  return {
    execute: jest.fn(async (input: { request_id: string }) => {
      const result = behaviour(input.request_id);
      if (result instanceof Error) throw result;
      return result;
    }),
  } as unknown as jest.Mocked<RespondToRequestUseCase>;
}

describe("BatchRespondToRequestsUseCase (Bloco 9.4c)", () => {
  it("responde todos quando não há falha", async () => {
    const inner = makeInner((id) => ({ id }));
    const useCase = new BatchRespondToRequestsUseCase(inner);

    const output = await useCase.execute({
      request_ids: [A, B],
      musician_id: MUSICIAN,
      action: RespondToRequestAction.REJECT,
    });

    expect(output.succeeded).toHaveLength(2);
    expect(output.failed).toHaveLength(0);
  });

  // O ponto do best-effort: um item ruim não pode anular os outros 29.
  it("um item que falha não impede os demais", async () => {
    const inner = makeInner((id) =>
      id === B
        ? new Error("Only pending requests can be responded to")
        : { id },
    );
    const useCase = new BatchRespondToRequestsUseCase(inner);

    const output = await useCase.execute({
      request_ids: [A, B, C],
      musician_id: MUSICIAN,
      action: RespondToRequestAction.ACCEPT,
    });

    expect(output.succeeded).toHaveLength(2);
    expect(output.failed).toEqual([
      { request_id: B, reason: "Only pending requests can be responded to" },
    ]);
  });

  it("identifica a falha pelo request_id, para o app marcar só aquele item", async () => {
    const inner = makeInner(() => new Error("boom"));
    const useCase = new BatchRespondToRequestsUseCase(inner);

    const output = await useCase.execute({
      request_ids: [A, B],
      musician_id: MUSICIAN,
      action: RespondToRequestAction.REJECT,
    });

    expect(output.failed.map((f) => f.request_id)).toEqual([A, B]);
  });

  it("deduplica ids repetidos em vez de reportar erro falso", async () => {
    const inner = makeInner((id) => ({ id }));
    const useCase = new BatchRespondToRequestsUseCase(inner);

    const output = await useCase.execute({
      request_ids: [A, A, A],
      musician_id: MUSICIAN,
      action: RespondToRequestAction.REJECT,
    });

    expect(inner.execute).toHaveBeenCalledTimes(1);
    expect(output.succeeded).toHaveLength(1);
    expect(output.failed).toHaveLength(0);
  });

  // O músico vem do token; o corpo não pode escolher em nome de quem responde.
  it("propaga sempre o mesmo musician_id para cada item", async () => {
    const inner = makeInner((id) => ({ id }));
    const useCase = new BatchRespondToRequestsUseCase(inner);

    await useCase.execute({
      request_ids: [A, B],
      musician_id: MUSICIAN,
      action: RespondToRequestAction.REJECT,
      rejection_reason: "Fora do repertório",
    });

    for (const call of inner.execute.mock.calls) {
      expect(call[0]).toMatchObject({
        musician_id: MUSICIAN,
        rejection_reason: "Fora do repertório",
      });
    }
  });

  it("processa sequencialmente, evitando corrida na gamificação do músico", async () => {
    const order: string[] = [];
    const inner = {
      execute: jest.fn(async (input: { request_id: string }) => {
        order.push(`start:${input.request_id}`);
        await new Promise((r) => setTimeout(r, 1));
        order.push(`end:${input.request_id}`);
        return { id: input.request_id };
      }),
    } as unknown as jest.Mocked<RespondToRequestUseCase>;

    await new BatchRespondToRequestsUseCase(inner).execute({
      request_ids: [A, B],
      musician_id: MUSICIAN,
      action: RespondToRequestAction.ACCEPT,
    });

    expect(order).toEqual([`start:${A}`, `end:${A}`, `start:${B}`, `end:${B}`]);
  });
});
