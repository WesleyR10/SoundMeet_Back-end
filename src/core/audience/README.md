# Audience Domain

Este módulo implementa o domínio **Audience** da plataforma SoundMeet, responsável por gerenciar os usuários do público que interagem com músicos e estabelecimentos.

## Estrutura

```
audience/
├── application/           # Camada de aplicação
│   ├── use-cases/        # Casos de uso
│   └── validations/      # Validações específicas
├── domain/               # Camada de domínio
│   ├── audience.aggregate.ts      # Agregado principal
│   ├── audience.repository.ts     # Interface do repositório
│   └── audience.validator.ts      # Validador de domínio
├── infra/                # Camada de infraestrutura
│   └── db/              # Implementações de repositório
│       ├── in-memory/   # Repositório em memória
│       └── prisma/      # Repositório Prisma
└── README.md            # Este arquivo
```

## Funcionalidades

### Core Features
- **Perfil de Usuário**: Criação e gerenciamento de perfis de público
- **Sistema de Gamificação**: Pontuação, níveis e badges
- **Interações**: Pedidos musicais, votações e gorjetas
- **Descoberta**: Sistema de busca e recomendações

### Gamificação
- **Pontuação**: Sistema de pontos por ações (scan QR, pedidos, gorjetas)
- **Níveis**: Progressão baseada em pontuação acumulada
- **Badges**: Conquistas por diferentes tipos de engajamento
- **Rankings**: Classificações mensais e globais

### Integrações
- **QR Code**: Scan de códigos para acesso a perfis de músicos
- **Pagamentos**: Sistema de gorjetas via PIX
- **Social**: Compartilhamento e indicações

## Entidades

### Audience (Agregado Principal)
- **ID**: Identificador único
- **Dados Pessoais**: Nome, email, telefone, avatar
- **Preferências**: Gêneros musicais favoritos
- **Gamificação**: Pontos, nível, badges
- **Status**: Ativo/inativo, data de criação

## Use Cases

1. **CreateAudience**: Criação de novo usuário do público
2. **UpdateAudience**: Atualização de dados do usuário
3. **DeleteAudience**: Remoção de usuário
4. **GetAudience**: Busca de usuário por ID
5. **ListAudiences**: Listagem com filtros e paginação

## Repositórios

### In-Memory Repository
- Implementação para testes e desenvolvimento
- Métodos específicos para gamificação (rankings, estatísticas)

### Prisma Repository
- Implementação para produção com PostgreSQL
- Queries otimizadas para gamificação e analytics
- Suporte a filtros avançados

## Validações

- **Email**: Formato válido e unicidade
- **Nome**: Obrigatório, tamanho mínimo/máximo
- **Telefone**: Formato brasileiro válido
- **Gêneros**: Lista de gêneros válidos

## Eventos de Domínio

- **AudienceCreated**: Usuário criado
- **AudienceUpdated**: Dados atualizados
- **PointsAdded**: Pontos adicionados
- **LevelUp**: Subida de nível
- **BadgeEarned**: Badge conquistado

## Integração com Outros Domínios

- **Musician**: Interações via QR code e pedidos
- **Establishment**: Indicações e avaliações
- **Request**: Criação e votação em pedidos musicais
- **Payment**: Gorjetas e transações
- **Gamification**: Sistema de pontuação e recompensas