## 1. Critério de Prioridade

Pensando em valor para o usuário + dificuldade , a ordem de importância dos módulos NestJS para entregar o “produto mínimo SoundMeet” é:

1. shared-module / config-module / database-module
   - Base obrigatória: DI, Prisma, config, logger, etc.
2. musician-module + audience-module
   - Permitem criar perfis, gerar QR e ter o “público acessando músico”.
3. payment-module
   - Entrega gorjeta via PIX/QR – core de monetização.
4. request-module
   - Pedidos musicais inteligentes, base para votações e engajamento.
5. gamification-module
   - Pontos, badges, rankings – fortalece a experiência, mas pode vir logo após pedidos/gorjetas.
6. establishment-module
   - Dashboard de contratação, indicações, analytics de público.
7. auth-module (Keycloak) + rabbitmq-module + integrações externas (cifras, socials, push)
   Nos exemplos abaixo, vou supor a estrutura:

- src/core/... → seu domínio atual (já pronto)
- src/nest-modules/... → camada NestJS que vamos criar

## 2. Fase 0 – Base do Projeto e Infra

Objetivo : garantir que o ambiente Nest + Prisma + Config esteja pronto para receber os módulos.

### 2.1. Verificar projeto Nest e scripts

- Já existe src/main.ts e src/app.module.ts:1-38 .
- Verificar no package.json se você tem scripts:

```
"scripts": {
  "start": "nest start",
  "start:dev": "nest start --watch",
  "build": "nest build",
  "test": "jest",
  "lint": "eslint .",
  "prisma:migrate": "prisma migrate 
  dev",
  "prisma:generate": "prisma 
  generate"
}
```

Se alguns não existirem, você os adiciona manualmente depois.

### 2.2. Prisma e bancos

Se ainda não estiver tudo pronto:

- Inicializar Prisma (caso não tenha):

```
npx prisma init
```

- Ajustar prisma/schema.prisma para refletir os modelos usados pelos mappers:
  - Musician , Band , Audience , Establishment , MusicRequest , Tip , Transaction , MusicianWallet , entidades de Gamification ( UserPoints , UserScore , UserBadge , Ranking , UserInteraction ).
  - Conferir campos usados nos mappers, por exemplo:
    - src/core/establishment/infra/db/prisma/establishment-model-mapper.ts:77-83
    - src/core/audience/infra/db/prisma/audience-model-mapper.ts
    - src/core/payment/infra/db/prisma/\*
    - src/core/gamification/infra/db/prisma/\*
    - src/core/request/infra/db/prisma/request-model.mapper.ts

- Rodar migrations:

```
npm run prisma:generate
npm run prisma:migrate
```

## 3. Fase 1 – Módulos de Infra Compartilhada

### 3.1. shared-module / config-module / database-module

Objetivo : evitar cada módulo criando seu próprio PrismaClient ou config; tudo centralizado.

Arquitetura sugerida:

- src/nest-modules/shared-module/
  - shared.module.ts
  - logging.interceptor.ts (opcional)
  - exception.filter.ts (mapeando erros de domínio como EntityValidationError , NotFoundError para HTTP)
- src/nest-modules/config-module/
  - config.module.ts
  - config.service.ts (wrap em cima do ConfigModule global)
  - validação de env (Joi) se você quiser seguir o roadmap
- src/nest-modules/database-module/
  - database.module.ts
  - prisma.service.ts (singleton contendo PrismaClient )
    Comandos (exemplo usando Nest CLI):

```
nest g module shared nest-modules/
shared-module
nest g module config nest-modules/
config-module
nest g module database nest-modules/
database-module
```

Depois:

- Ajustar os módulos para exportar providers que serão usados nos outros módulos (ex.: PrismaService exportado pelo DatabaseModule ).
- Importar esses módulos no AppModule :

```
// src/app.module.ts
@Module({
  imports: [
    ConfigModule.forRoot({ 
    isGlobal: true, envFilePath: [".
    env.local", ".env"] }),
    EventEmitterModule.forRoot({ /
    * ... */ }),
    ScheduleModule.forRoot(),
    // Novos:
    ConfigNestModule,   // seu 
    config-module
    DatabaseModule,     // Prisma
    SharedModule,       // filtros, 
    interceptors, etc.
  ],
})
export class AppModule {}
```

## 4. Fase 2 – Fluxo Essencial: Musician + Audience + Payment

Esse é o core que entrega:

Músico cria perfil → gera QR permanente → Público escaneia QR → vê perfil → faz pedido/gorjeta.

### 4.1. musician-module

Objetivo : CRUD de músicos, incluindo geração e leitura de QR code.

Arquitetura:

- src/nest-modules/musician-module/
  - musician.module.ts
  - musician.controller.ts
  - musician.service.ts (ou “facade” para orquestrar use cases)
  - dto/ para inputs/outputs REST
    Comando:

```
nest g module musician nest-modules/
musician-module
nest g controller musician 
nest-modules/musician-module
nest g service musician 
nest-modules/musician-module
```

No musician.module.ts :

- Registrar como providers os use cases do core, injetando repositórios Prisma:
  - CreateMusicianUseCase ( src/core/musician/application/use-cases/create-musician/create-musician.use-case.ts )
  - GetMusicianUseCase
  - ListMusiciansUseCase
  - UpdateMusicianUseCase
  - DeleteMusicianUseCase
  - use cases de banda ( create-band , add-band-member , remove-band-member , get-band )

- Registrar MusicianPrismaRepository ( src/core/musician/infra/db/prisma/musician-prisma.repository.ts ) como implementação de IMusicianRepository .
  Endpoints prioritários:

- POST /musicians → cria músico (usa CreateMusicianUseCase ).
- GET /musicians/:id → pega músico ( GetMusicianUseCase ).
- GET /musicians → lista com filtros (nome, gênero, instrumento).
- PATCH /musicians/:id → atualizar perfil.
- DELETE /musicians/:id → desativar/remover.
- Endpoints auxiliares para bandas ( /bands ), se quiser conectar cedo a divisão de gorjetas.

### 4.2. audience-module

Objetivo : perfis do público + scan de QR + pedidos básicos.

Arquitetura:

- src/nest-modules/audience-module/
  - audience.module.ts
  - audience.controller.ts
  - audience.service.ts
  - dto/
    Comandos:

```
nest g module audience nest-modules/
audience-module
nest g controller audience 
nest-modules/audience-module
nest g service audience 
nest-modules/audience-module
```

Use cases centrais (já implementados):

- CRUD: CreateAudience , GetAudience , ListAudiences , UpdateAudience , DeleteAudience ( src/core/audience/application/use-cases/index.ts:1-5 ).
- ScanQRUseCase ( scan-qr.use-case.ts ) – registra scan, soma pontos.
- MakeMusicRequestUseCase ( make-music-request.use-case.ts ) – integra Audience + Request domain.
- SendTip do lado Audience (pode ser redirecionando ao use case de payment, ou wrappers aqui).
  Endpoints prioritários:

- CRUD: /audiences .
- POST /audiences/scan-qr – recebe audience_id , qr_code e chama ScanQRUseCase .
- POST /audiences/:id/requests – cria pedido para determinado músico (chama MakeMusicRequestUseCase ).
- POST /audiences/:id/tips – chama o use case de SendTip do domínio Payment.

### 4.3. payment-module

Objetivo : gorjetas via PIX/QR + carteira do músico.

Arquitetura:

- src/nest-modules/payment-module/
  - payment.module.ts
  - payment.controller.ts
  - payment.service.ts
  - dto/
    Comandos:

```
nest g module payment nest-modules/
payment-module
nest g controller payment 
nest-modules/payment-module
nest g service payment nest-modules/
payment-module
```

Use cases centrais:

- SendTipUseCase ( src/core/payment/application/use-cases/send-tip/send-tip.use-case.ts )
- ConfirmTipPaymentUseCase ( confirm-tip-payment.use-case.ts:1-25 )
- FailTipPaymentUseCase ( fail-tip-payment.use-case.ts:1-22 )
- GetMusicianWalletUseCase , GetMusicianTransactionsUseCase , GetMusicianTipsUseCase
- WithdrawToPixUseCase
  Endpoints prioritários:

- POST /tips – cria tip (público → músico/banda) → responde com qr_code + copy_paste_code .
- POST /tips/:id/confirm – callback do gateway PIX simulando pagamento confirmado → chama ConfirmTipPaymentUseCase .
- POST /tips/:id/fail – marca falha de pagamento.
- GET /musicians/:id/wallet – usa GetMusicianWalletUseCase .
- GET /musicians/:id/tips e /musicians/:id/transactions .
  Essa fase já entrega:

- Músico com perfil + QR code.
- Público que escaneia QR, acessa perfil do músico, faz pedidos e gorjetas via PIX.

## 5. Fase 3 – Request + Integração com Gamification

### 5.1. request-module

Objetivo : endpoints para o lado do músico gerir os pedidos (aceitar, recusar, listar, votar).

Arquitetura:

- src/nest-modules/request-module/
  - request.module.ts
  - request.controller.ts
  - request.service.ts
  - dto/
    Comandos:

```
nest g module request nest-modules/
request-module
nest g controller request 
nest-modules/request-module
nest g service request nest-modules/
request-module
```

Use cases (provavelmente a criar/terminar):

- Criar pedido: hoje é iniciado via MakeMusicRequestUseCase em Audience → você pode expor apenas Audience, ou criar um use case mais “puro” em Request.
- ListRequestsForMusician , UpdateRequestStatus (accept/reject), UpdateRequestMessage , etc. – se ainda não existem, valem ser implementados agora em src/core/request/application/use-cases .
  Endpoints:

- GET /musicians/:id/requests – lista pedidos para o músico.
- POST /requests/:id/accept – aceita pedido (aplica RequestAcceptedEvent ).
- POST /requests/:id/reject – rejeita pedido (aplica RequestRejectedEvent ).
- POST /requests/:id/vote – voto de up/down (pode ser via Audience ou Request, mas hoje você já tem SongVotedEvent em audience ).

### 5.2. gamification-module

Objetivo : sistematizar pontos, badges e rankings; expor endpoints para dashboards de engajamento.

Arquitetura:

- src/nest-modules/gamification-module/
  - gamification.module.ts
  - gamification.controller.ts
  - gamification.service.ts
  - dto/
    Comandos:

```
nest g module gamification 
nest-modules/gamification-module
nest g controller gamification 
nest-modules/gamification-module
nest g service gamification 
nest-modules/gamification-module
```

Use cases:

- AddPointsUseCase
- CreateUserPointsUseCase , CreateUserScoreUseCase , CreateUserInteractionUseCase
- AwardBadgeUseCase
- CalculateRankingUseCase , GetLeaderboardUseCase
  Endpoints:

- GET /gamification/users/:id – retorna pontos, badges, rankings (pode compor dados de Audience + Gamification ).
- GET /gamification/leaderboard – leaderboards por tipo (Top Fãs, Top Apoiadores etc).
- Endpoints administrativos para recalcular rankings ou dar badges especiais.
  Integração:

- Nessa fase, vale começar a conectar os eventos:
  - Quando TipCompletedEvent acontece → adicionar pontos (gorjetas).
  - Quando MusicRequestMadeEvent acontece → adicionar pontos (pedido).
  - Quando RequestAcceptedEvent acontece → pontos extra por acerto.
  - Quando SongVotedEvent ou SocialMediaSharedEvent acontecem → pontos sociais.
    Isso pode ser feito via handlers NestJS que escutam EventEmitterModule ou mensagens em RabbitMQ na fase seguinte.

## 6. Fase 4 – Establishment + Dashboard

### 6.1. establishment-module

Objetivo : expor CRUD de estabelecimentos e, aos poucos, as features de dashboard, indicação e analytics do público.

Arquitetura:

- src/nest-modules/establishment-module/
  - establishment.module.ts
  - establishment.controller.ts
  - establishment.service.ts
  - dto/
    Comandos:

```
nest g module establishment 
nest-modules/establishment-module
nest g controller establishment 
nest-modules/establishment-module
nest g service establishment 
nest-modules/establishment-module
```

Use cases do core:

- CreateEstablishmentUseCase (já implementado) src/core/establishment/application/use-cases/create-establishment/create-establishment.use-case.ts:1-32
- GetEstablishment , ListEstablishments , UpdateEstablishment , DeleteEstablishment (estruturas já no README; precisa garantir implementação e testes como em musician/audience).
  Endpoints:

- CRUD /establishments .
- Filtros por nome, tipo, localização, rating.
- Futuro: endpoints para dashboard (lista de músicos recomendados, indicações recebidas de Audience, analytics de eventos).
  Esse módulo é mais complexo na experiência de produto, mas a parte de core já está bem encaminhada.

## 7. Fase 5 – Auth, RabbitMQ, Real-Time, Integrações Externas

### 7.1. auth-module (Keycloak)

- Integrar Keycloak via guardas (roles: público, músico, estabelecimento).
- Proteger rotas sensíveis ( /tips , /requests , /wallet , /gamification ).
  Comandos:

```
nest g module auth nest-modules/
auth-module
nest g service auth nest-modules/
auth-module
```

### 7.2. rabbitmq-module

- Encapsular conexão com RabbitMQ e definir producers/consumers:
  - Eventos: pedido criado, pedido aceito, gorjeta confirmada, compartilhou social, etc.
  - Consumidores: gamification, analytics, notificações push.
    Comandos:

```
nest g module rabbitmq nest-modules/
rabbitmq-module
nest g service rabbitmq 
nest-modules/rabbitmq-module
```

### 7.3. Real-time (WebSockets)

- Módulo de request ou um realtime-module para:
  - Atualizar musician em tempo real dos pedidos e estados.
  - Notificar público sobre aceitação/recusa de pedido.

### 7.4. Integrações Externas (Cifras, Social, Push)

- Criar submódulos ou serviços sob musician-module / request-module ou um integration-module :
  - Cifras : integrar APIs de acordes genéricas (seguindo Docs/api-sugestion.md ) em vez de Cifra Club/Ultimate Guitar diretos.
  - PIX real : substituir o PixGatewayMock por um gateway real em payment .
  - Redes sociais : registrar compartilhamentos (para pontos sociais).
  - Push notifications : Firebase/APNs enviando eventos importantes.

## 8. Resumo Rápido da Ordem Recomendada

1. Fase 0 : Ajustar Prisma, scripts e .env .
2. Fase 1 : shared-module , config-module , database-module (infra Nest).
3. Fase 2 (mais importante para valor inicial):
   - musician-module (perfil + QR).
   - audience-module (perfil público + scan QR + pedidos).
   - payment-module (gorjetas PIX, carteira).
4. Fase 3 :
   - request-module (gestão de pedidos pelo músico).
   - gamification-module (pontos, badges, rankings + integração com eventos).
5. Fase 4 :
   - establishment-module (cadastro + busca inicial).
6. Fase 5 :
   - auth-module (Keycloak), rabbitmq-module , websockets, integrações externas (cifras, social, push), analytics Mongo.
     Se você quiser, no próximo passo posso pegar um módulo concreto (por exemplo musician-module ) e:

- Desenhar exatamente musician.module.ts , musician.controller.ts , musician.service.ts
- Mostrar como injetar MusicianPrismaRepository e os use cases
- E montar exemplos de DTOs e endpoints seguindo o que já existe no core.
