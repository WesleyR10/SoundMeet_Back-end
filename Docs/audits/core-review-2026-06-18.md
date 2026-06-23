# Auditoria Arquitetural do Core — 2026-06-18

## Escopo

Esta auditoria cobre `soundmeet-backend/src/core/` em modo diagnóstico. Nenhum código de domínio, aplicação ou infraestrutura foi refatorado nesta fase.

Fontes usadas:

- `soundmeet-backend/Docs/architecture.md`
- `soundmeet-backend/Docs/business-rules.md`
- `soundmeet-backend/Docs/features.md`
- `soundmeet-backend/Docs/roadmap.md`
- `soundmeet-backend/Docs/qr-code.md`
- `soundmeet-backend/Docs/AI-musician/chord-sheet.md`
- módulos internos de referência: `src/core/musician/` e `src/core/establishment/`
- referência externa: `FC3-admin-catalogo-de-videos-typescript/src/core/`

## Resumo Executivo

O core do SoundMeet está em bom estado estrutural para um projeto em expansão: os bounded contexts principais estão separados, a maioria dos agregados segue `.aggregate.ts`, a camada de domínio não apresenta dependência direta de Nest/Prisma, os repositórios usam interfaces e existem implementações in-memory e Prisma para a maioria dos agregados operacionais.

A base, porém, não deve ser tratada como “pronta para escalar” sem correções anteriores aos próximos blocos do roadmap. Os riscos centrais não são falta de DDD, mas sim inconsistências de fronteira e transação em fluxos de produto: QR/gamificação, pagamento, analytics/projections, eventos e duplicidade de fonte de verdade entre `Audience`, `Gamification`, `MusicLibrary` e `SyncedLyrics`.

Minha leitura: o core é sólido o bastante para continuar a evolução, mas a próxima fase deveria corrigir os P0/P1 abaixo antes de adicionar mais superfície HTTP ou integrações externas. Especialmente: validação de QR, consistência transacional em pagamentos/gamificação e padronização de módulos que já viraram infraestrutura de produto (`payment`, `events`, `ai-cifra`, `synced-lyrics`).

## Fase 1 — Mapeamento Inicial

### Módulos Encontrados

| Módulo | Domain | Application | Infra | Observação |
|---|---:|---:|---:|---|
| `shared` | sim | sim | sim | Base comum: Entity, AggregateRoot, VO, repository, UoW, in-memory, Prisma helpers. |
| `musician` | sim | sim | sim | Referência interna principal. Estrutura mais alinhada ao padrão FC3 + adaptações SoundMeet. |
| `establishment` | sim | sim | sim | Referência interna, mas contém `EstablishmentAnalytics` como `.entity.ts` e sem in-memory próprio. |
| `audience` | sim | sim | sim | Bem estruturado; risco funcional em QR/gamificação. |
| `request` | sim | sim | sim | Boa aderência geral; anti-spam global por evento ainda parcial. |
| `gamification` | sim | sim | sim | Estrutura rica; risco de sobreposição entre ledger/projeção e pontuação em `Audience`. |
| `payment` | sim | sim | sim | Forte modelagem, mas diverge na organização de repositories/validators e carece de transação/UoW em fluxo crítico. |
| `scheduling` | sim | sim | sim | Boa separação; regra de `max_shows_per_day` ainda não aplicada integralmente. |
| `events` | sim | sim | sim | Boa modelagem, mas há duplicidade entre operações no repository e use cases com aggregates dedicados. |
| `music-library` | sim | sim | sim | Estruturalmente consistente; risco de virar “agregado blob” de IA/letra/cifra. |
| `synced-lyrics` | sim | sim | sim | Bem alinhado ao plano de Chord Sheet; risco de duplicação com `MusicLibrary`. |
| `ai-audio` | sim | sim | sim | Estrutura compatível com pipeline de job; entidade interna simples sem `Entity` base. |
| `ai-cifra` | sim | sim | sim | Domínio existe, mas faltam barrels `index.ts` e testes; mappers não seguem completamente `LoadEntityError`. |

### Referências de Padrão

O padrão FC3 preservado no SoundMeet é:

- `AggregateRoot extends Entity`
- `static create(command)`
- validação por Notification Pattern
- `entity.notification.hasErrors()` no use case
- `EntityValidationError` na aplicação
- `I[Entity]Repository extends ISearchableRepository`
- `SearchParams` e `SearchResult`
- repositório in-memory para testes
- mapper Prisma/ORM reconstrói entidade e lança erro de carga quando inválida

`musician` e `establishment` adicionam necessidades próprias do SoundMeet: VOs de `Email`, `Phone`, `QRCode`, `Rating`, `Address`, perfis ricos, eventos de domínio e propriedades em snake_case no domínio.

### Ordem Recomendada de Auditoria/Refatoração

1. `shared`, `musician`, `establishment`: estabilizar critérios e exceções aceitas.
2. `audience` + `gamification`: QR, pontuação, fonte de verdade e transação.
3. `payment`: fluxo de gorjeta/transaction/wallet/split e consistência.
4. `scheduling`: disponibilidade, conflitos e regras incompletas.
5. `events` + `request`: estado de evento, participantes, pedidos e duplicidades de operação.
6. `music-library` + `synced-lyrics` + `ai-cifra` + `ai-audio`: fronteiras de IA musical e dados derivados.
7. Padronização transversal: barrels, mappers, testes de infra e nomenclatura.

### Riscos e Lacunas que Exigem Leitura Mais Profunda

- QR code ainda confia em input externo solto e não parseia `soundmeet://...`.
- `ScanQRUseCase` atualiza `Audience` e insere `UserInteraction` sem Unit of Work.
- `ConfirmTipPaymentUseCase` grava `Transaction`, depois completa `Tip`, depois altera wallets sem transação explícita.
- `UserScore`, `UserPoints` e campos de pontuação em `Audience` podem disputar fonte de verdade se handlers/eventos não forem disciplinados.
- `MusicLibrary` e `SyncedLyrics` armazenam campos LRC/chord-sheet similares; isso precisa de fronteira explícita para evitar divergência.
- `EstablishmentAnalytics` é entidade/repository própria, mas sem in-memory repository.
- `Audience` contém fluxos paralelos a bounded contexts dedicados: pedido musical, gorjeta, presença em evento, voto e badges.
- `RequestVote` existe como aggregate/validator/fake builder, mas não fecha o pacote repository + in-memory + Prisma + use case.
- `ai-cifra` não tem barrels e não tem testes no core, apesar de ser base para pipeline de IA.
- Testes de Prisma/in-memory são desiguais: alguns módulos têm boa cobertura, outros nenhuma.

## Fase 2 — Auditoria por Módulo

### `shared` — Conforme

Checklist:

- Domain/application/infra: conforme.
- Base FC3: conforme.
- `AggregateRoot`, `Entity`, repositories e in-memory: conforme.
- Clean Architecture: conforme.

Diagnóstico: é uma cópia/adaptação coerente do FC3. A base suporta domínio limpo e testável. O ponto de atenção é evoluir Unit of Work/outbox para fluxos multi-repositório, pois o core já tem operações que exigem atomicidade.

### `musician` — Conforme

Checklist:

- `.aggregate.ts`: conforme.
- Repository interface + in-memory + Prisma: conforme.
- Validators/fake builders/testes: conforme.
- Alinhamento Docs/features: conforme.

Diagnóstico: é a melhor referência interna. `Musician`, `Band` e `MusicianProfile` seguem o padrão esperado e adicionam regras do produto, como QR permanente, rating, perfil, preço, gêneros e instrumentos. O uso de `.aggregate.ts`, `entity_id`, fake builder, validator e output mapper está alinhado ao FC3 e à arquitetura do projeto.

### `establishment` — Parcial

Checklist:

- Agregado principal `Establishment`: conforme.
- `EstablishmentProfile`: conforme.
- `EstablishmentAnalytics`: parcial.
- Repository interface + Prisma: parcial.
- In-memory para todos os repositories: não conforme para analytics.

Diagnóstico: o agregado principal é referência interna válida. O desvio está em `EstablishmentAnalytics`: ele é `Entity`, vive em `.entity.ts`, tem repository próprio e Prisma repository, mas não possui in-memory repository. Se `Analytics` for read model/projection, o nome e a estrutura deveriam deixar isso explícito. Se for raiz persistida com use cases próprios, deveria seguir o padrão completo: `.aggregate.ts`, validator, fake builder, in-memory e Prisma.

Classificação: parcial, com refatoração P1.

### `audience` — Parcial / Crítico em Orquestração Cross-Module

Checklist:

- Estrutura DDD: conforme.
- Aggregate/validator/fake builder/testes: conforme.
- Repository interface + in-memory + Prisma: conforme.
- Conformidade com QR/gamificação: parcial.
- Separação entre experiência de Audience e bounded contexts dedicados: não conforme.

Diagnóstico: a modelagem de perfil e preferências é consistente e respeita o padrão. O problema está na operação de scan. `ScanQRUseCase` valida apenas se o QR não está vazio, aceita `musician_id` separado e usa esse input para pontuar e registrar interação. Isso contraria `Docs/qr-code.md` e o roadmap, que exigem parse do QR, UUID válido e igualdade entre UUID extraído e body.

Há também risco de duplicação de pontuação: `Audience` tem `totalPoints/currentLevel/badges`, enquanto `gamification` tem `UserScore` como ledger e `UserPoints` como projeção. Isso pode ser aceitável se `Audience` for experiência/perfil e `Gamification` for fonte de verdade, mas hoje a fronteira precisa ser explicitada e aplicada por eventos/UoW.

Leitura complementar: `Audience` também contém use cases que parecem paralelos aos módulos dedicados:

- `make-music-request` produz metadados/eventos de pedido, mas o pedido persistente vive em `request/Request`.
- `send-tip` pontua/gera experiência de gorjeta, enquanto `payment/SendTipUseCase` cria `Tip` e fluxo PIX.
- `attend-event` registra presença no universo de Audience, mas presença/capacidade vivem em `events/EventAttendee`.
- `vote-song` gera voto/pontos, mas `request/RequestVote` existe como aggregate separado.
- badges como `string[]` em `Audience` concorrem com `gamification/UserBadge`.

Classificação: parcial, com P0 em QR e P0/P1 para remover fluxos paralelos ou transformá-los em facades que delegam aos bounded contexts canônicos.

### `request` — Parcial

Checklist:

- Estrutura DDD: conforme.
- `.aggregate.ts`: conforme.
- Repository + in-memory + Prisma: conforme.
- Anti-spam e limites por evento: parcial.
- `RequestVote` completo até domínio, mas sem persistência/use case: não conforme.

Diagnóstico: `Request`, `RequestVote` e `RequestFeedback` estão bem modelados, com eventos e validações de estado. O módulo resolve a dor central de pedidos musicais. A lacuna é produto/regra, não estrutura: limite consolidado de pedidos por pessoa/evento ainda está parcial, como o próprio `business-rules.md` registra.

Leitura complementar: `RequestVote` é uma lacuna arquitetural, não apenas regra incompleta. Ele possui aggregate, validator, fake builder e teste, mas não possui repository, implementação in-memory, implementação Prisma ou use case. Ao mesmo tempo, `Request` mantém `votes_count` denormalizado. Isso pode ser projeção, mas precisa de decisão explícita; hoje o pacote fica incompleto e concorre com `Audience.vote-song`.

Classificação: parcial, com P1 para fechar `RequestVote` ou removê-lo se a decisão for manter apenas contador/projeção.

### `gamification` — Parcial

Checklist:

- Estrutura de agregados: conforme.
- Repositories in-memory + Prisma: conforme na maioria.
- Ledger/projeção: conceitualmente conforme aos docs.
- Integração com Audience/Request/Payment: parcial.

Diagnóstico: o módulo tem bons agregados (`UserScore`, `UserPoints`, `UserInteraction`, `Badge`, `UserBadge`, `Ranking`) e está alinhado à ideia do documento de arquitetura: `UserScore` como ledger e `UserPoints` como projeção. O risco é operacional: os fluxos atuais ainda permitem pontuação direta em `Audience`, atualização de `UserPoints` por use case e registro de interação em outro repository sem transação/outbox.

Isso não torna o módulo errado, mas exige uma decisão arquitetural clara: `UserScore` deve ser a fonte de verdade para eventos de pontuação, `UserPoints` deve ser uma projeção derivada, e `Audience` não deve competir como saldo canônico. A leitura complementar reforçou um ponto mais grave: use cases como `AddPointsUseCase`/`CalculatePointsUseCase` atualizam diretamente `UserPoints` e não escrevem o ledger `UserScore`. Isso inverte a arquitetura documentada.

Classificação: parcial, com refatoração P1.

### `payment` — Parcial

Checklist:

- Agregados em `.aggregate.ts`: conforme.
- Validators/fake builders/testes de domínio: conforme, mas em subpasta diferente.
- Repository interfaces: conforme funcionalmente, divergente no path `domain/repositories/`.
- In-memory + Prisma: conforme.
- Consistência transacional: não conforme para fluxo crítico.

Diagnóstico: a modelagem de `Tip`, `Transaction` e `MusicianWallet` é boa e resolve uma dor central do roadmap. O problema é que `ConfirmTipPaymentUseCase` é um fluxo financeiro multi-agregado e multi-repository, mas não usa Unit of Work/transação. Ele insere `Transaction`, completa `Tip`, atualiza wallets e cria transações de split em sequência. Uma falha intermediária pode deixar transaction criada sem tip completo, ou tip completo sem wallet atualizada.

Há também divergências menores de padrão: repositories em `domain/repositories/`, validators em `domain/validators/` e mappers sem `LoadEntityError` explícito em reconstrução. Não é bloqueador isolado, mas dificulta consistência com `musician`/`establishment`. A leitura complementar também apontou colisão de responsabilidade com `audience/send-tip`: o fluxo de gorjeta precisa ter `payment` como bounded context canônico, e `audience` deve consumir o resultado via evento/projeção/facade, não implementar outro fluxo.

Classificação: parcial, com P0 para atomicidade antes de PaymentModule HTTP.

### `scheduling` — Conforme Parcial

Checklist:

- Agregados `Availability`, `Booking`, `Inquiry`: conforme.
- Repository + in-memory + Prisma: conforme.
- Regras de disponibilidade e conflito: parcialmente conformes.
- Testes de use case: presentes.

Diagnóstico: é um dos módulos mais bem encaminhados em termos de domínio. `Booking` e `Availability` têm boa separação e os use cases aplicam disponibilidade e conflito. A lacuna documentada permanece: `max_shows_per_day` existe, mas não é regra consolidada no cálculo de disponibilidade. Também há dependência opcional de repositories em alguns use cases, o que facilita teste, mas pode esconder invariantes quando não injetado.

Leitura complementar: `Availability` não tem mapper Prisma dedicado (`availability-model-mapper.ts`); o mapeamento fica inline no repository. Além disso, `Inquiry` tem menos cobertura de teste de domínio, e há referência documental a `SetAvailability` sem use case correspondente. São desvios menores que QR/pagamento, mas devem entrar na limpeza P2/P1.

Classificação: conforme parcial por regra incompleta e lacunas de padronização.

### `events` — Parcial

Checklist:

- Agregados em `.aggregate.ts`: conforme.
- Repositories + in-memory + Prisma: conforme.
- Event attendees/performers como aggregates próprios: conforme.
- Operações de domínio dentro do Prisma repository: parcial.

Diagnóstico: o módulo tem boa base (`Event`, `EventMusician`, `EventAttendee`) e está mais rico que uma simples tabela relacional. O problema é duplicidade de caminhos: `IEventRepository` expõe `addAttendee/removeAttendee/addPerformer`, e a implementação Prisma carrega o agregado e aplica mutações dentro do repository; ao mesmo tempo, os use cases já têm caminho com `EventAttendeeRepository` dedicado.

Repository com método comportamental não é proibido pelo FC3, mas aqui começa a misturar persistência com orquestração de domínio. O ideal é consolidar: use case coordena aggregates e repository persiste; repository não deveria ser o local principal de regra de participante/capacidade.

Leitura complementar: além dos attendees, performers também têm duas fontes de verdade: `add-event-performer` via métodos de `IEventRepository` e `add-event-musician` via aggregate `EventMusician`. A recomendação passa a ser mais forte: escolher uma estratégia canônica para attendees e performers, com aggregates próprios ou métodos no aggregate `Event`, mas não os dois caminhos ativos.

Classificação: parcial, com P1 forte para simplificar fronteira.

### `music-library` — Conforme Parcial

Checklist:

- Estrutura padrão: conforme.
- Aggregate/repository/validator/fake builder: conforme.
- In-memory + Prisma: conforme.
- Fronteira com IA musical: parcial.

Diagnóstico: a estrutura está boa, mas o agregado concentra muitos dados derivados: `lyrics`, `chords`, `structure_segments`, `chord_sheet`, `renderable_chord_sheet`, `lrc_*`. O comentário no código reconhece que alguns JSONs são blobs de outros bounded contexts. Isso é aceitável como catálogo/materialized view, mas perigoso se `MusicLibrary` virar fonte de verdade de dados que pertencem a `synced-lyrics` ou `ai-cifra`.

Classificação: conforme parcial, com P1 para fronteira de fonte de verdade.

### `synced-lyrics` — Conforme Parcial

Checklist:

- Estrutura DDD: conforme.
- Aggregate/repository/validator/fake builder: conforme.
- In-memory + Prisma: conforme.
- Alinhamento com `chord-sheet.md`: bom.
- Fronteira com `MusicLibrary`: parcial.

Diagnóstico: o módulo segue bem o plano de LRC/chord sheet: parser, normalização, provider metadata, hash, versionamento e quality flags. A principal cautela é que `SyncedLyrics` usa `music_library_id` como id da entidade e guarda campos similares aos de `MusicLibrary`. Isso pode ser uma escolha deliberada de 1:1, mas deve ser formalizada: `SyncedLyrics` como fonte de verdade de LRC e `MusicLibrary` como projeção/cache, ou o inverso. Sem isso, bugs de sincronização serão prováveis.

Classificação: conforme parcial.

### `ai-audio` — Parcial

Checklist:

- Job aggregates: conforme.
- Repository + in-memory + Prisma: conforme.
- Output interno como entidade simples: parcial.
- Testes de domínio/use case: presentes.

Diagnóstico: o módulo segue a arquitetura de pipeline/job. `AiAudioSeparationOutput` é classe simples em `.entity.ts`, mas não estende `Entity` nem é root aggregate. Como objeto filho do job, isso é aceitável conceitualmente, mas o sufixo `.entity.ts` fica ambíguo diante da regra do projeto. Melhor renomear/modelar como value object ou child entity explícita.

Classificação: parcial por nomenclatura/modelagem secundária.

### `ai-cifra` — Parcial

Checklist:

- Aggregates de upload/job: conforme.
- Repositories + in-memory + Prisma: conforme.
- Application ports: conforme.
- Barrels `index.ts`: não conforme.
- Testes do core: não conforme.
- Prisma mappers com `LoadEntityError`: parcial.

Diagnóstico: o módulo tem desenho correto para job/fila/worker e está alinhado à regra de status operacional como string. Mas ele é menos integrado ao padrão do restante do core: não há barrels `index.ts`, não há specs no core, e mappers como `ai-cifra-analysis-job-model-mapper.ts` fazem fallback silencioso de status inválido para `queued` em vez de falhar com `LoadEntityError`.

Esse fallback é perigoso em pipeline operacional: status corrompido no banco deveria ser tratado como dado inválido, não “normalizado” sem ruído.

Classificação: parcial, com P1 antes de evoluir mais o pipeline.

## Achados Críticos

### P0 — QR/Gamificação Ainda Não É Seguro Como Fonte de Pontuação

`ScanQRUseCase` ainda valida só string não vazia. Ele não parseia `soundmeet://musician/<uuid>`, não exige UUID válido e não garante que `musician_id` do body bate com o QR. Isso contradiz `Docs/qr-code.md` e o Bloco 2 do roadmap.

Impacto: pontos, interações e anti-abuso podem ser registrados para músico diferente do QR real.

Recomendação: corrigir antes de evoluir gamificação real, benefícios, rankings ou presença por QR.

### P0 — Pagamento Não Tem Atomicidade em Fluxo Financeiro

`ConfirmTipPaymentUseCase` altera `Transaction`, `Tip`, `MusicianWallet` e transações de split sem Unit of Work. É um fluxo financeiro e deve ser transacional.

Impacto: falhas intermediárias podem gerar saldo, tip e transaction divergentes.

Recomendação: antes do `payment-module` HTTP do roadmap, introduzir transação/UoW para confirmação de gorjeta e split de banda.

### P0/P1 — Fonte de Verdade de Pontos Precisa Ser Fechada

Docs dizem que `UserScore` é ledger e `UserPoints` é projeção. O código também mantém pontuação em `Audience`. Isso precisa de contrato claro.

Impacto: ranking, badges, audience level e histórico podem divergir.

Recomendação: definir `UserScore` como ledger canônico, `UserPoints` como projection e `Audience` como leitura/experiência, ou remover duplicidade em fase posterior.

### P0/P1 — Audience Implementa Fluxos Que Pertencem a Outros Bounded Contexts

`Audience` possui use cases para pedido, gorjeta, presença, voto e badges que concorrem com `request`, `payment`, `events` e `gamification`.

Impacto: o sistema pode registrar experiências de usuário sem criar o agregado canônico correspondente, ou criar duas narrativas para a mesma ação.

Recomendação: transformar os fluxos de `Audience` em facades/orquestrações que delegam aos módulos canônicos, ou removê-los em favor dos use cases dedicados.

### P1 — `RequestVote` Está Órfão

`RequestVote` existe no domínio, mas não tem repository, in-memory, Prisma ou use case. O contador `votes_count` em `Request` pode ser projeção, mas a decisão não está fechada.

Impacto: votação pode ficar dividida entre `Audience.vote-song`, contador em `Request` e aggregate `RequestVote` sem persistência.

Recomendação: completar `RequestVote` como aggregate persistido ou remover o aggregate e declarar `votes_count` como projeção calculada.

## Achados Médios e Baixos

### P1 — `EstablishmentAnalytics` Está Entre Entity, Aggregate e Read Model

Ele é `.entity.ts`, tem repository e Prisma, mas não in-memory. Se for projeção, deveria ser nomeado/isolado como read model; se for domínio persistido, precisa seguir o pacote completo de aggregate.

### P1 — `events` Duplica Orquestração em Repository e Use Case

`EventPrismaRepository` executa mutações de domínio e transações internas, enquanto use cases também têm caminho por `EventAttendeeRepository`. Há padrão semelhante para performers (`add-event-performer` versus `EventMusician`). A fronteira deve ser simplificada.

### P1 — `ai-cifra` Precisa de Testes, Barrels e Mappers Mais Estritos

Ausência de `index.ts` e specs deixa o módulo menos previsível que os demais. Mapper não deveria converter status desconhecido para `queued` silenciosamente.

### P1 — `MusicLibrary` e `SyncedLyrics` Podem Duplicar LRC/Chord Sheet

A arquitetura precisa declarar quem é fonte de verdade e quem é projeção/cache.

### P2 — Estrutura de Pastas Divergente em `payment`

`domain/repositories/` e `domain/validators/` funcionam, mas fogem do padrão documentado de arquivos planos. O custo é menor que os riscos transacionais, então não deve ser primeira refatoração.

### P2 — Cobertura de Infra É Desigual

Há testes Prisma/in-memory para `musician`, `establishment`, `audience`, partes de `gamification` e `synced-lyrics`, mas faltam em módulos importantes como `payment`, `events`, `scheduling`, `music-library` e `ai-cifra`.

### P2 — Barrels/Exports Inconsistentes

Alguns módulos têm `index.ts` completos; outros têm apenas parciais; `ai-cifra` não tem. Isso não quebra arquitetura, mas aumenta acoplamento a paths internos.

## Desvios de Padrão

### Contra FC3

- `payment` organiza repositories/validators em subpastas, diferente do padrão plano FC3/SoundMeet.
- `events` coloca operações comportamentais no repository, enquanto FC3 tende a deixar repository focado em persistência.
- alguns mappers Prisma não lançam `LoadEntityError` ao reconstruir entidade inválida.
- `ai-cifra` tem fallback silencioso de status inválido.

### Contra Docs do SoundMeet

- `ScanQRUseCase` não cumpre parse/UUID/consistência do QR.
- `EstablishmentAnalytics` não cumpre in-memory obrigatório para repository.
- `ai-cifra` não tem estrutura de exportação consistente com os demais módulos.
- `max_shows_per_day` em scheduling existe, mas ainda não vira regra consolidada.

### Contra Módulos de Referência

- `payment` diverge em paths de repository/validator.
- `events` tem duas formas de aplicar participante/performer.
- `ai-cifra` não tem barrels e não tem testes equivalentes.
- `EstablishmentAnalytics` foge do padrão de aggregate completo.

## Inconsistências Entre Módulos

- Root aggregate: quase todos usam `.aggregate.ts`; exceções aparentes são entidades internas (`AiAudioSeparationOutput`) e `EstablishmentAnalytics`, que merece decisão explícita.
- Repositories: a maioria usa arquivo plano `[entity].repository.ts`; `payment` usa `domain/repositories/`.
- Validators: a maioria usa `[entity].validator.ts`; `payment` usa `domain/validators/`.
- Mappers: parte valida e lança `LoadEntityError`; parte apenas reconstrói entidade.
- Infra tests: cobertura varia bastante entre módulos.
- Exports: barrels são inconsistentes, especialmente em `ai-cifra`.
- Fonte de verdade: `Audience`/`Gamification` e `MusicLibrary`/`SyncedLyrics` precisam de contrato mais rígido.

## Recomendações Priorizadas

### P0

1. Corrigir validação de QR em `ScanQRUseCase`: parse `soundmeet://`, UUID válido, igualdade com body e checagem de músico ativo/existente.
2. Introduzir Unit of Work/transação no fluxo de confirmação de gorjeta antes de expor HTTP em `payment-module`.
3. Definir e aplicar fonte de verdade de pontuação: `UserScore` ledger, `UserPoints` projection, `Audience` leitura/experiência.

### P1

1. Refatorar `EstablishmentAnalytics` para projection/read model explícito ou aggregate completo com in-memory repository.
2. Simplificar `events`: mover orquestração de attendee/performer para use cases e deixar repository focado em persistência.
3. Padronizar `ai-cifra`: adicionar barrels, testes de domínio/use case/mapper e `LoadEntityError` em mappers.
4. Formalizar fronteira `MusicLibrary` x `SyncedLyrics`: fonte de verdade, projeção e política de sincronização.
5. Aplicar regra `max_shows_per_day` em scheduling ou documentar explicitamente como não implementada.

### P2

1. Padronizar paths de `payment` para o padrão documentado, se o custo for baixo.
2. Completar testes Prisma/in-memory nos módulos sem cobertura.
3. Uniformizar barrels `index.ts`.
4. Revisar comentários TODO/placeholder em fluxos financeiros e IA.
5. Adicionar checks de mapper para todos os módulos com status operacional ou enums.

## Próximos Passos Sugeridos Fora do Core

1. Auditar `src/nest-modules/`, começando por `payment-module` ausente, `ai-audio-module` órfão e auth/guards.
2. Auditar `prisma/schema.prisma` contra os aggregates: nomes snake_case/camelCase, enums, relations e constraints.
3. Auditar integração RabbitMQ/outbox para payment → gamification → ranking.
4. Auditar segurança de endpoints internos de IA (`ai-cifra`, `synced-lyrics`, bulk callbacks).
5. Auditar testes de integração HTTP após estabilizar P0 no core.

## Parecer Final

O core do SoundMeet tem fundação arquitetural real: não é um conjunto de services anêmicos, e a maior parte dos módulos respeita DDD/Clean Architecture. A prioridade agora é não crescer em cima de inconsistências conhecidas. A próxima fase deve ser uma rodada curta de refatoração P0/P1, começando por QR/gamificação e pagamento, antes de abrir novos módulos HTTP ou integrações externas.
