# PROMPT PARA DESENVOLVIMENTO BACKEND SOUNDMEET

## OBJETIVO
Desenvolver o backend da plataforma SoundMeet seguindo rigorosamente a arquitetura DDD + Clean Architecture + Hexagonal baseada no projeto modelo FC3-admin-catalogo-de-videos-typescript.

## ARQUITETURA BASE
**Framework**: NestJS com TypeScript
**Padrões**: DDD + Clean Architecture + Hexagonal
**Estrutura de Referência**: `/home/wesleyr10/Programação/Projetos/SoundMeet/FC3-admin-catalogo-de-videos-typescript/`

### Organização de Módulos (seguir estrutura modelo):
```
src/
├── core/                    # Domínios da aplicação
│   ├── musician/           # Domínio Músicos
│   ├── establishment/      # Domínio Estabelecimentos
│   ├── audience/           # Domínio Público
│   ├── request/            # Domínio Pedidos Musicais
│   ├── gamification/       # Domínio Gamificação
│   ├── payment/            # Domínio Pagamentos/Gorjetas
│   └── shared/             # Componentes compartilhados
├── nest-modules/           # Módulos NestJS
│   ├── auth-module/
│   ├── musician-module/
│   ├── establishment-module/
│   ├── audience-module/
│   ├── request-module/
│   ├── gamification-module/
│   ├── payment-module/
│   ├── config-module/
│   ├── database-module/
│   ├── rabbitmq-module/
│   └── shared-module/
└── app.module.ts
```

### Cada domínio deve conter:
```
domain/
├── application/
│   ├── use-cases/         # Casos de uso
│   └── validations/       # Validações específicas
├── domain/
│   ├── entities/          # Agregados e entidades
│   ├── repositories/      # Interfaces de repositório
│   ├── value-objects/     # Objetos de valor
│   └── validators/        # Validadores de domínio
└── infra/
    └── db/               # Implementações de repositório
```

## STACK TECNOLÓGICA

### Backend Core
- **NestJS**: Framework principal com decorators e DI
- **TypeScript**: Type safety obrigatório
- **Prisma**: ORM principal

### Bancos de Dados
- **PostgreSQL**: Banco principal (dados estruturados)
- **MongoDB**: Dados não-estruturados (analytics, logs)
- **Redis**: Cache e sessões

### Autenticação
- **Keycloak**: Multi-tenant, RBAC, Social Login
- **JWT**: Tokens para mobile
- **Roles**: Público, Músicos, Estabelecimentos

### Mensageria
- **RabbitMQ**: Filas para pedidos em tempo real, notificações, pagamentos, gamificação

### Armazenamento
- **AWS S3**: Vídeos, imagens, áudios
- **CloudFront CDN**: Distribuição de conteúdo
- **FFmpeg**: Processamento de vídeo/áudio

## DOMÍNIOS E FUNCIONALIDADES

### 1. DOMÍNIO MUSICIAN
**Entidades**: Musician, Band, Profile, QRCode
**Funcionalidades**:
- Criação de perfil único com QR code permanente
- Controle de pedidos musicais com moderação anti-spam
- Analytics detalhados (engajamento, preferências, monetização)
- Sistema de gorjetas com dashboard centralizado
- Integração com APIs de cifras (Cifra Club, Ultimate Guitar)
- Biblioteca pessoal de cifras com editor customizado

### 2. DOMÍNIO ESTABLISHMENT
**Entidades**: Establishment, Event, Booking
**Funcionalidades**:
- Dashboard de contratação com busca inteligente
- Filtros por estilo, instrumento, preço, avaliação
- Sistema de chat integrado para negociação
- Agenda compartilhada em tempo real
- Analytics de público e engajamento
- Sistema de indicações do público
- Gestão de eventos e pagamentos automatizados

### 3. DOMÍNIO AUDIENCE
**Entidades**: User, Profile, Interaction
**Funcionalidades**:
- Scan de QR code para acesso a perfis
- Sistema de pedidos musicais inteligente
- Votação democrática em músicas
- Sistema de gorjetas diretas (PIX/QR)
- Indicação de músicos para estabelecimentos
- Feed de descoberta por proximidade

### 4. DOMÍNIO REQUEST
**Entidades**: MusicRequest, Vote, Feedback
**Funcionalidades**:
- Pedidos com sugestões baseadas no estilo do músico
- Limite anti-spam por usuário
- Sistema de confirmação (aceito/recusado)
- Votação democrática com intervalos de 2-3 min
- Histórico completo de pedidos por evento

### 5. DOMÍNIO GAMIFICATION
**Entidades**: Points, Badge, Ranking, Reward
**Funcionalidades**:
- Sistema de pontuação (scan: 10pts, pedidos: 25pts, acertos: 50pts, gorjetas: 1pt/real, social: 50pts)
- Badges progressivos (Iniciante, Sugestor, Acertador, Apoiador, Mecenas, Socializer, Discoverer, Super Fã)
- Rankings mensais (Top Fãs, Top Sugestões, Top Apoiadores, Top Discoverers)
- Recompensas exclusivas (acesso antecipado, descontos VIP, conteúdo exclusivo, meet & greet)

### 6. DOMÍNIO PAYMENT
**Entidades**: Tip, Transaction, Wallet
**Funcionalidades**:
- Gorjetas diretas via PIX/QR code
- Mensagens personalizadas com gorjetas
- Wall de apoiadores público (opcional)
- Divisão automática para bandas
- Dashboard financeiro para músicos
- Sistema de comissões para estabelecimentos

## INTEGRAÇÕES OBRIGATÓRIAS

### APIs Externas
- **Cifra Club API**: Acesso a cifras oficiais
- **Ultimate Guitar API**: Database internacional
- **PIX API**: Pagamentos instantâneos
- **Social Media APIs**: Verificação de compartilhamentos
- **Firebase/APNs**: Push notifications

### Processamento de Mídia
- **FFmpeg**: Processamento de vídeo/áudio
- **HLS Streaming**: Vídeos adaptativos
- **Transcoding**: Múltiplas resoluções

## PADRÕES DE DESENVOLVIMENTO

### Clean Architecture
- Separação clara entre domínio, aplicação e infraestrutura
- Inversão de dependências rigorosa
- Interfaces para todos os contratos externos

### DDD (Domain Driven Design)
- Agregados bem definidos por domínio
- Value Objects para conceitos de negócio
- Domain Events para comunicação entre contextos
- Repository Pattern para persistência

### Hexagonal Architecture
- Portas e adaptadores bem definidos
- Isolamento do core de negócio
- Testabilidade máxima

### Qualidade de Código
- **ESLint + Prettier**: Formatação consistente
- **Jest**: Testes unitários e integração
- **Swagger**: Documentação automática de APIs
- **Class-validator**: Validação de DTOs
- **Class-transformer**: Transformação de dados

## CONFIGURAÇÕES ESSENCIAIS

### Docker
- Containerização completa (app, PostgreSQL, MongoDB, Redis, RabbitMQ)
- Docker Compose para desenvolvimento
- Dockerfile otimizado para produção

### Variáveis de Ambiente
- Configuração por ambiente (dev, test, prod)
- Secrets management seguro
- Validação de configurações com Joi

### Migrations
- Prisma migrations para PostgreSQL
- Scripts de seed para dados iniciais
- Versionamento de schema

## ENTREGÁVEIS ESPERADOS

1. **Estrutura inicial** completa seguindo o modelo de referência
2. **Configuração de todos os serviços** (PostgreSQL, MongoDB, Redis, RabbitMQ, Keycloak)
3. **Implementação de todos os 6 domínios** com suas respectivas funcionalidades
4. **APIs REST** completas para cada módulo
5. **Sistema de autenticação** integrado com Keycloak
6. **Filas RabbitMQ** configuradas para tempo real
7. **Testes automatizados** para casos de uso críticos
8. **Documentação Swagger** completa
9. **Docker Compose** funcional para desenvolvimento
10. **Scripts de deployment** e migrations

## CRITÉRIOS DE QUALIDADE

- **Cobertura de testes**: Mínimo 80% nos use cases
- **Performance**: APIs respondendo em < 200ms
- **Segurança**: Autenticação/autorização em todos os endpoints
- **Escalabilidade**: Arquitetura preparada para crescimento
- **Manutenibilidade**: Código limpo seguindo SOLID
- **Documentação**: README completo e APIs documentadas

**IMPORTANTE**: Seguir rigorosamente a estrutura e padrões do projeto modelo em `/home/wesleyr10/Programação/Projetos/SoundMeet/FC3-admin-catalogo-de-videos-typescript/` para garantir consistência arquitetural.