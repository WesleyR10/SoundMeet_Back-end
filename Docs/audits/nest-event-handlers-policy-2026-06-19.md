# Politica de handlers @OnEvent - NestJS

## Escopo

Esta nota registra a decisao aplicada na correcao da camada NestJS sobre uso de `@OnEvent` versus RabbitMQ/outbox.

## Decisao

`@OnEvent` pode ser usado para efeitos leves, locais e reprocessaveis, como logs estruturados, metricas derivadas nao financeiras e pequenas projecoes que possam ser recalculadas.

Fluxos criticos nao devem depender apenas de `@OnEvent` sem idempotencia/retry explicitos. Inclui:

- pagamento -> carteira/transacao/gamificacao;
- pontuacao/ranking quando afeta ledger persistente;
- callbacks de IA e bulk jobs;
- efeitos que nao podem ser perdidos silenciosamente.

Para esses casos, o caminho preferido e RabbitMQ com DLX/retry padronizado ou outbox dedicada. Quando a solucao temporaria usar `@OnEvent`, o handler deve:

- capturar e logar erro com `event`, IDs principais e mensagem;
- chamar use cases canonicos, nunca mutar aggregates de outro bounded context diretamente;
- evitar efeitos financeiros ou irreversiveis sem idempotencia;
- ter teste unitario cobrindo o contrato de chamada do use case.

## Trade-off aceito

Manter `@OnEvent` em alguns handlers reduz complexidade no MVP, mas nao oferece garantia operacional suficiente para eventos criticos. A correcao atual moveu pontuacao de requests para `AddPointsUseCase`, mas a auditoria dedicada de outbox/RabbitMQ continua fora desta fase.
