- Configurar e integrar Prisma + bancos (Postgres/Mongo) , Redis , RabbitMQ , Keycloak .
- Implementar WebSockets e fila de eventos para tempo real (pedidos, notificações, gamificação).
- Criar os gateways externos (PIX real, cifras, redes sociais, push notifications).

## Musician

- Lógicas específicas de chat , agenda de shows e feed/reels estão fora desse domínio (devem ser resolvidas na camada Nest / módulos de aplicação, utilizando esses agregados).
- Integração com APIs de cifras (Cifra Club, Ultimate Guitar) ainda não aparece em código (será responsabilidade de gateways/infra e possivelmente de um subdomínio dentro de musician ou request ).

## Establishment

Dashboard de contratação, chat integrado, agenda compartilhada, analytics de público, sistema de indicações :

- O core de Establishment fornece a base (entidade, rating, filtros, QR, CNPJ, etc.), mas funcionalidades de dashboard, chat, agenda e analytics são fluxos de aplicação:
  - Devem ser implementados na camada NestJS (controllers, services + possivelmente domínios adicionais para Chat/Agenda/Analytics ou reuso de request / gamification ).

## Request

Limites anti‑spam por usuário/evento e votações democráticas com janela de 2–3min :

- O Request fornece base para estados e timestamps; o enforcement de limites de pedidos por usuário e a mecânica de votação/votação por tempo provavelmente serão implementados em:
  - Use cases mais específicos de Request/Audience (talvez ainda a criar), e
  - Camadas NestJS (websocket, timers, workers via ScheduleModule /RabbitMQ).

### 3.3. O que Falta Fazer para Cobrir Tudo

Resumindo por camadas:
Faltando na camada NestJS / Módulos de Aplicação

- Criar módulos Nest para cada domínio com controllers/DTOs:
  - auth-module , musician-module , establishment-module , audience-module , request-module , gamification-module , payment-module , config-module , database-module , rabbitmq-module , shared-module (seguindo a estrutura que você definiu na instrução).
- Expor os use cases via HTTP/WebSockets:
  - Endpoints CRUD para músicos, estabelecimentos, audience.
  - Endpoints/mensageria para:
    - Scan de QR
    - Criar pedido musical
    - Votar em pedido
    - Enviar gorjeta
    - Responder pedidos (accept/reject) do lado do músico
    - Operações de gamificação (rankings, badges, leaderboards). Infraestrutura que ainda precisa ser plugada
- Prisma :
  - Garantir que o PrismaClient esteja centralizado e injetado via DatabaseModule .
  - Conferir/ajustar schema.prisma para refletir todos os campos e relacionamentos usados pelos mappers (ex.: establishment_type , rating, wallet, tip, transaction, musicRequest, etc.).
  - Rodar migrations e seeds conforme plano do README geral.
- PostgreSQL, MongoDB, Redis, RabbitMQ, Keycloak :
  - Criar docker-compose com todos esses serviços.
  - Implementar módulos Nest específicos: - database-module (Postgres + Prisma; Mongo para analytics). - rabbitmq-module com producers/consumers para pedidos, notificações, pagamentos, gamificação (event-driven, como sugerido no roadmap). - config-module com validação de env (Joi) e profiles por ambiente. - auth-module integrado com Keycloak (guardas, decorators de roles para público/músico/estabelecimento). - redis para cache de perfis e dados quentes (como recomendado em Roadmap-Consolidado.md:133-135 ). Funcionalidades avançadas ainda não materializadas em código
    Na camada de core você já tem:

- Pedidos, gorjetas, gamificação, perfis, ranking, eventos.
  Ainda faltam principalmente:

- Integrações externas :
  - Cifra Club API / Ultimate Guitar API (gateways HTTP + use cases dedicados).
  - PIX com gateway real (hoje há apenas mock; ver pix-gateway.mock.ts:1-10 ).
  - APIs de redes sociais para validar compartilhamentos.
  - Firebase/APNs para push notifications.
- Real-time :
  - WebSockets (provavelmente via @nestjs/websockets /Socket.IO) para:
    - Pedidos em tempo real para o músico.
    - Votos, mudança de status, notificações de gorjetas.
  - Integração com RabbitMQ para desacoplar:
    - payment -> gamification
    - request -> gamification
    - audience -> analytics .
- Analytics (MongoDB) :
  - Modelos e coleções para registrar eventos de interação, histórico de pedidos, performance por evento, etc.
  - Queries agregadas para atender dashboards de música/estabelecimento. Ajustes menores e TODOs internos
    Há alguns pontos marcados como TODO que mostram gaps pequenos:

- EstablishmentModelMapper ainda usa valores default para establishment_type e rating ( src/core/establishment/infra/db/prisma/establishment-model-mapper.ts:77-83 ), que precisam ser conectados ao schema do banco.
- AudienceModelMapper tem TODO para location e social_links ( src/core/audience/infra/db/prisma/**tests**/audience-model-mapper.spec.ts:41-49 ), que estão no modelo, mas não no aggregate atual.
- Alguns use cases de Establishment (update/list/get) devem ser conferidos para garantir que estão completos, no mesmo nível de musician/audience/payment.

---

# Relatório de Consolidação e Roadmap - SoundMeet Backend

## 1. Análise de Viabilidade das Features

### Domínio Musician

| Feature                 | Viabilidade | Complexidade | Esforço (h) | Prioridade | Riscos                               |
| ----------------------- | ----------- | ------------ | ----------- | ---------- | ------------------------------------ |
| Perfil + QR Code        | Alta        | Baixa        | 16          | Alta       | Nenhum significativo                 |
| Controle de Pedidos     | Alta        | Média        | 24          | Alta       | Latência em tempo real               |
| Analytics Detalhados    | Média       | Alta         | 40          | Média      | Volume de dados, performance         |
| Integração Cifras (API) | Média       | Alta         | 32          | Baixa      | Mudanças na API de terceiros, custos |
| Biblioteca de Cifras    | Alta        | Média        | 24          | Baixa      | Armazenamento                        |

### Domínio Establishment

| Feature               | Viabilidade | Complexidade | Esforço (h) | Prioridade | Riscos                        |
| --------------------- | ----------- | ------------ | ----------- | ---------- | ----------------------------- |
| Dashboard Contratação | Alta        | Média        | 32          | Média      | Adoção pelos estabelecimentos |
| Chat Integrado        | Média       | Alta         | 40          | Baixa      | Segurança, moderação          |
| Agenda Compartilhada  | Alta        | Média        | 24          | Média      | Conflitos de agenda           |
| Analytics de Público  | Média       | Alta         | 40          | Média      | Precisão dos dados            |

### Domínio Audience

| Feature             | Viabilidade | Complexidade | Esforço (h) | Prioridade | Riscos                             |
| ------------------- | ----------- | ------------ | ----------- | ---------- | ---------------------------------- |
| Scan QR Code        | Alta        | Baixa        | 8           | Alta       | Compatibilidade de dispositivos    |
| Pedidos Musicais    | Alta        | Média        | 24          | Alta       | Spam, moderação                    |
| Votação Democrática | Alta        | Média        | 16          | Média      | Manipulação de votos               |
| Gorjetas (PIX)      | Alta        | Alta         | 40          | Alta       | Segurança, fraudes, integração PIX |

### Domínio Gamification

| Feature           | Viabilidade | Complexidade | Esforço (h) | Prioridade | Riscos             |
| ----------------- | ----------- | ------------ | ----------- | ---------- | ------------------ |
| Sistema de Pontos | Alta        | Média        | 24          | Média      | Inflação de pontos |
| Badges e Rankings | Alta        | Média        | 24          | Baixa      | Engajamento real   |

### Domínio Payment

| Feature            | Viabilidade | Complexidade | Esforço (h) | Prioridade | Riscos                             |
| ------------------ | ----------- | ------------ | ----------- | ---------- | ---------------------------------- |
| Integração PIX     | Alta        | Alta         | 40          | Alta       | Segurança, conformidade financeira |
| Divisão Automática | Alta        | Alta         | 32          | Média      | Erros de cálculo, taxas            |

---

## 2. Análise Arquitetural do Core Atual

O core do projeto segue rigorosamente os padrões de **Clean Architecture** e **DDD**, alinhado com o modelo de referência.

### Pontos Fortes:

- **Separação Clara de Camadas**: `domain`, `application`, `infra` bem definidos em todos os módulos.
- **Padronização de Entidades**: Uso consistente de `AggregateRoot`, `ValueObject`, `EntityId` (Uuid).
- **Validação**: Uso extensivo de `class-validator` e Notification Pattern.
- **Testabilidade**: Estrutura preparada para testes unitários e de integração (ex: `fake.builder`).
- **Modularização**: Domínios bem isolados (`musician`, `establishment`, `audience`, etc.).

### Pontos de Atenção (Gaps Identificados):

1. **Ausência de Eventos de Domínio em Alguns Agregados**:
   - `Musician`: Não emite eventos como `MusicianCreatedEvent`, `MusicianVerifiedEvent`.
   - `Audience`: Emite eventos, mas falta padronização em alguns casos.
2. **Repositórios**: Interfaces definidas e implementações Prisma em andamento.
   - `Establishment`: Repositório validado e corrigido.
   - `Audience`: Repositório validado e mapeamento de `location` e `social_links` implementado.
   - `Musician`: Repositório validado e implementado com todos os métodos e tratamento de erros.
   - `Payment`: Repositório `TransactionPrismaRepository` validado e testado com sucesso.
   - Outros domínios em processo de validação.
3. **Casos de Uso**:
   - Faltam Use Cases específicos para algumas features planejadas (ex: Integração com Cifras, Chat, Agenda Compartilhada).
   - `Establishment`: Use Cases listados no diretório mas vazios ou não implementados completamente (verificação visual mostrou diretórios, mas conteúdo precisa ser garantido).
4. **Value Objects**:
   - Alguns VOs podem ser promovidos para o `shared` se reutilizados (ex: `Address` já está no shared, mas `Money` no payment poderia ser shared se usado em outros lugares).
5. **Integração com Infraestrutura**:
   - A camada `infra` existe estruturalmente, mas a implementação real dos repositórios com Prisma/Mongoose precisa ser confirmada na fase de NestJS.

---

## 3. Plano de Padronização e Correções

### Ações Imediatas (Core):

1. **Padronizar Eventos de Domínio**:
   - Implementar `MusicianCreatedEvent`, `MusicianUpdatedEvent` no agregado `Musician`.
   - Revisar todos os agregados para garantir que mudanças de estado críticas emitam eventos.
2. **Completar Use Cases Faltantes**:
   - Mapear Use Cases CRUD básicos para todos os agregados principais (já existem para a maioria).
   - Implementar Use Cases de negócio complexos (ex: `ProcessTipPayment`, `CalculateGamificationPoints`).
3. **Refinar Validações**:
   - Garantir que todas as regras de negócio descritas no `Features-SoundMeet.md` estejam refletidas nos Validators.

---

## 4. Roadmap Recomendado (NestJS Implementation)

### Fase 1: Fundação e Configuração (Semana 1)

- Configurar projeto NestJS com estrutura modular.
- Configurar Docker (PostgreSQL, MongoDB, Redis, RabbitMQ).
- Implementar `SharedModule` (Config, Database, EventBus).
- Configurar Auth com Keycloak.

### Fase 2: Core Domains - Essencial (Semana 2-3)

- **Musician Module**: CRUD, Perfil, QR Code.
- **Audience Module**: Cadastro, Perfil.
- **Establishment Module**: Cadastro básico.
- **Auth Integration**: Proteção de rotas.

### Fase 3: Funcionalidades de Interação (Semana 4-5)

- **Request Module**: Fluxo completo de pedidos musicais (WebSocket/RabbitMQ).
- **Payment Module**: Integração PIX básica (recebimento).
- **Audience Interaction**: Scan QR, Pedir Música.

### Fase 4: Gamification e Analytics (Semana 6)

- **Gamification Module**: Sistema de pontos e badges (Async via eventos).
- **Analytics**: Coleta de dados básica (MongoDB).

### Fase 5: Features Avançadas e Polimento (Semana 7-8)

- **Payment Avançado**: Divisão de gorjetas, carteira.
- **Integrações Externas**: Cifras, Redes Sociais.
- **Testes E2E e Carga**.
- **Documentação Swagger Completa**.

## 5. Recomendações Técnicas

- **Event-Driven**: Utilizar pesadamente o RabbitMQ para desacoplar domínios (ex: Pagamento confirmado -> Gera Pontos -> Atualiza Ranking).
- **Cache**: Utilizar Redis para cache de perfis e catálogos de músicas para reduzir latência.
- **Real-time**: Usar WebSockets (Socket.io) no NestJS para atualizações de pedidos musicais em tempo real para o músico.
- **Database**:
  - PostgreSQL: Dados relacionais (Usuários, Pedidos, Transações).
  - MongoDB: Logs de auditoria, Analytics, Histórico de Chat.

---

**Status Atual**: A estrutura do Core está sólida e bem alinhada com os requisitos. O próximo passo lógico é iniciar a implementação da aplicação NestJS, trazendo esses domínios para a vida e conectando com a infraestrutura real.

