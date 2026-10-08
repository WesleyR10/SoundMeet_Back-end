import { MODULE_METADATA } from "@nestjs/common/constants";
import { EventEmitter2, EventEmitterModule } from "@nestjs/event-emitter";
import { Test } from "@nestjs/testing";

import { AggregateRoot } from "../../../core/shared/domain/aggregate-root";
import { DomainEventMediator } from "../../../core/shared/domain/events/domain-event-mediator";
import { PaymentModule } from "../payment.module";

/**
 * 🔴 O `DomainEventMediator` do `PaymentModule` nascia SEM o `EventEmitter2`
 * (30/set/2026).
 *
 * Ele estava na lista de `providers` como classe pura. A classe não tem
 * `@Injectable()`, então não há `design:paramtypes` e o Nest a constrói com o
 * construtor vazio — `eventEmitter` fica `undefined` e só estoura no primeiro
 * `publish`: *"Cannot read properties of undefined (reading 'emitAsync')"*,
 * achatado num 500 pelo `GlobalExceptionFilter`.
 *
 * Quem pagava, e sempre DEPOIS de gravar:
 *  - `PATCH /musicians/:id/wallet/pix-key` — 500 para qualquer chave (o app
 *    mostrava "Internal server error" no passo PIX do wizard);
 *  - `ConfirmTipPaymentUseCase` — gorjeta confirmada no banco, mas nenhum
 *    evento publicado (celebração, destaque pago) e o webhook em 500;
 *  - `ReleaseBookingEscrowUseCase` — custódia liberada sem o evento.
 *
 * O teste usa o provider EXATAMENTE como o módulo o declara — não uma cópia —
 * e prova o efeito (o evento chega ao barramento), não a forma.
 */
describe("PaymentModule — DomainEventMediator ligado ao EventEmitter2", () => {
  const declared = (
    Reflect.getMetadata(MODULE_METADATA.PROVIDERS, PaymentModule) as unknown[]
  ).filter(
    (p) =>
      p === DomainEventMediator ||
      (p as { provide?: unknown })?.provide === DomainEventMediator,
  );

  it("declara o mediator uma única vez", () => {
    expect(declared).toHaveLength(1);
  });

  it("o publish entrega o evento ao barramento da aplicação", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [declared[0] as never],
    }).compile();

    const mediator = moduleRef.get(DomainEventMediator);
    const bus = moduleRef.get(EventEmitter2);

    class PixKeyChangedProbe {}
    const received = jest.fn();
    bus.on(PixKeyChangedProbe.name, received);

    const event = new PixKeyChangedProbe();
    const aggregate = {
      getUncommittedEvents: () => [event],
      markEventAsDispatched: jest.fn(),
    } as unknown as AggregateRoot;

    await mediator.publish(aggregate);

    expect(received).toHaveBeenCalledWith(event);
  });
});
