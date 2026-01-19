# Domínio Establishment

## Visão Geral

O domínio **Establishment** é responsável por gerenciar estabelecimentos na plataforma SoundMeet, incluindo bares, restaurantes, clubes, pubs, cafés, hotéis, teatros e outros locais que contratam músicos para apresentações ao vivo. Este domínio implementa funcionalidades específicas para a conexão entre estabelecimentos e artistas musicais.

## Características Principais

- **Gestão Completa de Estabelecimentos**: Cadastro, atualização e gerenciamento de perfis
- **Sistema de Avaliações**: Rating baseado em experiências de músicos e público
- **QR Code Permanente**: Código único para cada estabelecimento
- **Verificação de Autenticidade**: Sistema de verificação para estabelecimentos legítimos
- **Busca Inteligente**: Filtros avançados por tipo, localização e características
- **Dashboard de Contratação**: Interface para buscar e contratar músicos
- **Analytics de Público**: Métricas de engajamento e preferências musicais

## Arquitetura

O domínio segue os princípios de **Domain Driven Design (DDD)** e **Clean Architecture**:

```
establishment/
├── application/
│   ├── use-cases/           # Casos de uso da aplicação
│   │   ├── create-establishment/
│   │   ├── update-establishment/
│   │   ├── delete-establishment/
│   │   ├── get-establishment/
│   │   ├── list-establishments/
│   │   ├── list-establishment-analytics/
│   │   ├── recalculate-establishment-analytics/
│   │   └── common/          # DTOs e mappers compartilhados
│   └── validations/         # Validações específicas da aplicação
├── domain/
│   ├── establishment.aggregate.ts    # Agregado principal
│   ├── establishment-profile.aggregate.ts # Agregado de perfil
│   ├── establishment.repository.ts   # Interface do repositório
│   ├── establishment.validator.ts    # Validações de domínio
│   ├── establishment-analytics.entity.ts  # Entidade de analytics
│   ├── establishment-analytics.repository.ts # Repositório de analytics
│   ├── establishment-fake.builder.ts # Builder para testes
│   └── events/              # Eventos de domínio
│       ├── establishment-created.event.ts
│       ├── establishment-rated.event.ts
│       └── establishment-verified.event.ts
└── infra/
    └── db/                  # Implementações de persistência
        ├── in-memory/       # Repositório em memória (testes)
        └── prisma/          # Repositório Prisma (produção)
```

## Campos da Entidade

### Campos Obrigatórios

- **establishment_id**: Identificador único (UUID)
- **name**: Nome do estabelecimento
- **email**: Email de contato
- **establishment_type**: Tipo do estabelecimento

### Campos Opcionais

- **description**: Descrição do estabelecimento
- **avatar**: URL da imagem do perfil
- **cnpj**: CNPJ do estabelecimento (Value Object)
- **phone**: Telefone de contato (Value Object)
- **website**: Site oficial
- **rating**: Avaliação média (Value Object)
- **total_ratings**: Total de avaliações recebidas
- **qr_code**: QR Code permanente (Value Object)
- **is_active**: Status de ativação
- **is_verified**: Status de verificação
- **created_at**: Data de criação

## Funcionalidades

### Operações CRUD

- **Criar Estabelecimento**: Cadastro com validações específicas
- **Buscar Estabelecimento**: Recuperação por ID
- **Listar Estabelecimentos**: Busca paginada com filtros
- **Atualizar Estabelecimento**: Modificação de dados
- **Excluir Estabelecimento**: Remoção lógica

### Funcionalidades Específicas do SoundMeet

- **Dashboard de Contratação**: Interface para buscar músicos
- **Sistema de Chat**: Comunicação direta com artistas
- **Agenda Compartilhada**: Visualização de disponibilidade
- **Analytics de Público**: Métricas de engajamento
- **Sistema de Indicações**: Recebimento de sugestões do público
- **Pagamentos Automatizados**: Processamento via plataforma
- **QR Code Permanente**:
  - Identificação única do estabelecimento
  - Acesso direto ao perfil via `soundmeet://establishment/{id}`
  - Analytics de escaneamentos e engajamento
  - Canal para indicações de músicos pelo público
  - Marketing digital integrado (promoções, eventos, fidelidade)

### Operações de Negócio

- **Gerar QR Code**: Criação de código permanente
- **Adicionar Avaliação**: Sistema de rating com comentários
- **Ativar/Desativar**: Controle de status
- **Verificar/Desverificar**: Controle de autenticidade
- **Alterar Dados**: Métodos específicos para cada campo

## Filtros de Busca

O sistema suporta os seguintes filtros:

- **name**: Busca por nome (parcial)
- **email**: Busca por email (exato)
- **cnpj**: Busca por CNPJ (exato)
- **is_active**: Filtro por status ativo
- **is_verified**: Filtro por verificação

## Validações

### Regras de Domínio

- **Nome**: Obrigatório, máximo 255 caracteres
- **Email**: Formato válido obrigatório
- **CNPJ**: Formato XX.XXX.XXX/XXXX-XX ou 14 dígitos (opcional)
- **Telefone**: Máximo 20 caracteres (opcional)
- **Descrição**: Máximo 1000 caracteres (opcional)
- **Avatar**: URL válida, máximo 500 caracteres (opcional)
- **Website**: URL válida, máximo 500 caracteres (opcional)
- **Tipo**: Valores permitidos: bar, restaurant, club, pub, cafe, hotel, theater, other

### Validações Específicas do SoundMeet

- **QR Code**: Unicidade garantida
- **Rating**: Valores entre 0 e 5
- **Verificação**: Processo manual de autenticação

## Value Objects

- **EstablishmentId**: Identificador único baseado em UUID
- **Email**: Validação de formato de email
- **Phone**: Formatação e validação de telefone
- **CNPJ**: Validação e formatação de CNPJ
- **Rating**: Sistema de avaliação de 0 a 5
- **QRCode**: Geração e validação de códigos QR únicos
  - Formato: `soundmeet://establishment/{establishment_id}`
  - URL Web: `https://soundmeet.app/establishment/{establishment_id}`
  - Funcionalidades: Analytics, indicações, marketing digital

## Eventos de Domínio

- **EstablishmentCreatedEvent**: Disparado quando um estabelecimento é criado
- **EstablishmentRatedEvent**: Disparado quando um estabelecimento recebe uma avaliação
- **EstablishmentVerifiedEvent**: Disparado quando um estabelecimento é verificado

## Testes

### Cobertura de Testes

- **Testes Unitários**: Entidade, validações e value objects
- **Testes de Integração**: Use cases e repositórios
- **Testes E2E**: Fluxos completos da API

### Fake Builder

O `EstablishmentFakeBuilder` permite criar dados de teste consistentes:

```typescript
const establishment = Establishment.fake()
  .anEstablishment()
  .withName("Bar do João")
  .withEstablishmentType("bar")
  .withEmail("contato@bardojoao.com")
  .build();
```

## Padrões Utilizados

- **Aggregate Root**: Establishment como raiz do agregado
- **Repository Pattern**: Interface para persistência
- **Factory Pattern**: Criação de validadores
- **Builder Pattern**: Construção de objetos para testes
- **Domain Events**: Comunicação entre contextos
- **Value Objects**: Encapsulamento de regras de negócio

## Integração com Outros Domínios

### Musician

- Busca de músicos para contratação
- Sistema de avaliação mútua
- Comunicação via chat integrado

### Audience

- Recebimento de indicações do público
- Analytics de preferências musicais
- Feedback sobre eventos

### Request

- Monitoramento de pedidos musicais
- Analytics de engajamento

### Payment

- Processamento de pagamentos para músicos
- Sistema de comissões

### Gamification

- Pontuação por engajamento
- Recompensas para estabelecimentos ativos

## Funcionalidades Específicas do SoundMeet

### Dashboard de Contratação

- **Busca Inteligente**: Filtros por estilo, instrumento, preço, avaliação
- **Visualização de Preços**: Exibição clara do valor/hora
- **Chat Integrado**: Negociação direta com músicos
- **Agenda Compartilhada**: Disponibilidade em tempo real

### Analytics de Público

- **Demografia**: Perfil do público por evento
- **Engajamento**: Taxa de ocupação e permanência
- **Preferências**: Estilos musicais por horário/dia

### Sistema de Indicações

- **Recebimento**: Sugestões do público
- **Gestão**: Dashboard de indicações
- **Feedback**: Retorno para indicadores

### Monetização

- **Comissões**: Percentual sobre contratações
- **Eventos Premium**: Cobrança por recursos avançados
- **Analytics**: Relatórios detalhados pagos

## Getters Computados

- **isHighlyRated**: Estabelecimento com rating >= 4.0
- **isPopular**: Estabelecimento com muitas avaliações
- **isBar**: Tipo específico "bar"
- **isRestaurant**: Tipo específico "restaurant"
- **isClub**: Tipo específico "club"

## Estrutura de Pastas

Estrutura atual simplificada do domínio, alinhada com o código existente:

```
establishment/
├── application/
│   └── use-cases/
│       ├── common/
│       │   ├── establishment-output.ts
│       │   └── index.ts
│       ├── create-establishment/
│       ├── update-establishment/
│       ├── delete-establishment/
│       ├── get-establishment/
│       ├── list-establishments/
│       ├── create-establishment-profile/
│       ├── update-establishment-profile/
│       ├── delete-establishment-profile/
│       ├── list-establishment-analytics/
│       ├── recalculate-establishment-analytics/
│       └── get-hiring-dashboard/
├── domain/
│   ├── __tests__/
│   │   ├── establishment.aggregate.spec.ts
│   │   ├── establishment.validator.spec.ts
│   │   └── establishment-fake.builder.spec.ts
│   ├── events/
│   │   ├── __tests__/
│   │   │   └── establishment-rated.event.spec.ts
│   │   ├── establishment-created.event.ts
│   │   ├── establishment-rated.event.ts
│   │   └── establishment-verified.event.ts
│   ├── establishment.aggregate.ts
│   ├── establishment-profile.aggregate.ts
│   ├── establishment.repository.ts
│   ├── establishment.validator.ts
│   ├── establishment-fake.builder.ts
│   ├── establishment-analytics.entity.ts
│   ├── establishment-analytics.repository.ts
│   └── index.ts
└── infra/
    └── db/
        ├── in-memory/
        │   ├── establishment-in-memory.repository.ts
        │   └── index.ts
        ├── prisma/
        │   ├── establishment-prisma.repository.ts
        │   ├── establishment-analytics-prisma.repository.ts
        │   ├── establishment-model-mapper.ts
        │   └── index.ts
        └── index.ts
```

## Exemplo de Uso

```typescript
// Criar um estabelecimento
const establishment = Establishment.create({
  name: "Bar do João",
  email: "contato@bardojoao.com",
  establishment_type: "bar",
});

// Gerar QR Code
establishment.generateQRCode();

// Adicionar avaliação
establishment.addRating(4.5, new Uuid(), "Ótimo ambiente!");

// Verificar estabelecimento
establishment.verify();
```

Este domínio é fundamental para o ecossistema SoundMeet, conectando estabelecimentos com músicos e proporcionando uma experiência completa de descoberta e contratação musical.

## Tarefas Pendentes

- Implementar RBAC/Keycloak em todos endpoints do módulo
- Implementar chat para negociação estabelecimento ↔ músico/banda
- Implementar sistema de indicações do público e dashboard de gestão
- Evoluir analytics para demografia, permanência e preferências
- Completar updates event-driven (event finish/cancel, attendee join/leave)
- Implementar comissões e automação de pagamentos vinculados a bookings
