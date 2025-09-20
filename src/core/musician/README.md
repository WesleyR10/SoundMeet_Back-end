# 🎵 Domínio Musician

## Visão Geral

O domínio **Musician** é responsável por gerenciar todas as informações e comportamentos relacionados aos músicos da plataforma SoundMeet. Este domínio implementa funcionalidades específicas para artistas que desejam se conectar com o público e estabelecimentos, incluindo perfil profissional, sistema de avaliações, QR codes únicos e gestão de repertório musical.

## 🎯 Características Principais

- **Perfil Profissional Completo**: Informações detalhadas sobre o músico/banda
- **QR Code Único**: Código permanente para acesso rápido ao perfil
- **Sistema de Avaliações**: Rating baseado no feedback do público
- **Gestão de Repertório**: Controle de gêneros musicais e instrumentos
- **Verificação de Perfil**: Sistema de validação para músicos profissionais
- **Experiência Profissional**: Controle de anos de experiência musical

## 🏗️ Arquitetura

Este domínio segue os princípios de **Domain-Driven Design (DDD)** e **Arquitetura Hexagonal**, com uma clara separação entre as camadas de Domínio, Aplicação e Infraestrutura.

## 📋 Campos da Entidade Musician

| Campo              | Tipo       | Descrição                                    |
| ------------------ | ---------- | -------------------------------------------- |
| `id`               | MusicianId | Identificador único do músico                |
| `email`            | Email      | Email único do músico (value object)         |
| `name`             | string     | Nome real do músico                          |
| `stage_name`       | string     | Nome artístico (opcional)                    |
| `bio`              | string     | Biografia/descrição do músico (opcional)     |
| `avatar`           | string     | URL da foto de perfil (opcional)             |
| `phone`            | Phone      | Telefone de contato (value object, opcional) |
| `genres`           | string[]   | Gêneros musicais que toca                    |
| `instruments`      | string[]   | Instrumentos que domina                      |
| `experience_years` | number     | Anos de experiência musical                  |
| `qr_code`          | QRCode     | QR code único do músico (value object)       |
| `rating`           | Rating     | Avaliação média (value object)               |
| `total_ratings`    | number     | Total de avaliações recebidas                |
| `is_active`        | boolean    | Status ativo/inativo                         |
| `is_verified`      | boolean    | Perfil verificado pela plataforma            |
| `created_at`       | Date       | Data de criação do perfil                    |

## 🔧 Funcionalidades Principais

### Casos de Uso (Use Cases)

Os casos de uso orquestram as operações de negócio e interagem com o domínio e a infraestrutura.

#### Gestão Básica de Músicos

- **Criar Músico**: `CreateMusicianUseCase`
- **Atualizar Músico**: `UpdateMusicianUseCase`
- **Listar Músicos**: `ListMusiciansUseCase`
- **Obter Músico por ID**: `GetMusicianUseCase`
- **Deletar Músico**: `DeleteMusicianUseCase`

### Métodos da Entidade `Musician`

A entidade `Musician` encapsula a lógica de negócio e as regras de validação.

#### Métodos de Atualização de Perfil

- `changeName(name)`: Atualiza o nome real do músico
- `changeStageName(stageName)`: Atualiza o nome artístico
- `changeBio(bio)`: Atualiza a biografia
- `changeAvatar(avatar)`: Atualiza a foto de perfil
- `changePhone(phone)`: Atualiza o telefone de contato

#### Métodos de Gestão Musical

- `updateGenres(genres)`: Atualiza os gêneros musicais
- `updateInstruments(instruments)`: Atualiza os instrumentos
- `updateExperience(years)`: Atualiza os anos de experiência
- `generateQRCode()`: Gera um novo QR code único

#### Métodos de Avaliação e Status

- `addRating(rating)`: Adiciona uma nova avaliação
- `activate()`: Ativa o perfil do músico
- `deactivate()`: Desativa o perfil do músico
- `verify()`: Marca o perfil como verificado
- `unverify()`: Remove a verificação do perfil

#### Métodos de Consulta e Validação

- `get displayName()`: Retorna o nome de exibição (stage_name ou name)
- `get isExperienced()`: Verifica se tem mais de 5 anos de experiência
- `get isHighlyRated()`: Verifica se tem rating acima de 4.0
- `validate(fields?)`: Valida os campos da entidade

## 🔍 Filtros de Busca

O repositório `IMusicianRepository` oferece filtros específicos para consultas:

### MusicianFilter

- `name`: Busca por nome real
- `stage_name`: Busca por nome artístico
- `email`: Busca por email
- `genres`: Filtro por gêneros musicais
- `instruments`: Filtro por instrumentos
- `is_active`: Filtro por status ativo/inativo
- `is_verified`: Filtro por perfis verificados

### Métodos de Busca Especializados

- `findByGenres(genres)`: Busca músicos por gêneros específicos
- `findByInstruments(instruments)`: Busca músicos por instrumentos
- `findVerifiedMusicians()`: Busca apenas músicos verificados
- `findActiveMusicians()`: Busca apenas músicos ativos
- `findExperiencedMusicians()`: Busca músicos com mais de 5 anos de experiência
- `findHighlyRatedMusicians()`: Busca músicos com rating alto

## 🔒 Validações de Negócio

As validações são aplicadas na camada de domínio para garantir a integridade dos dados.

### Validações Automáticas

- Email deve ser único na plataforma
- Nome é obrigatório (máximo 255 caracteres)
- Email deve ter formato válido
- Gêneros e instrumentos devem ser arrays válidos
- Anos de experiência entre 0 e 100
- Rating deve estar entre 0 e 5

### Validações de Campos

- `name`: Obrigatório, máximo 255 caracteres
- `stage_name`: Opcional, máximo 255 caracteres
- `email`: Obrigatório, formato de email válido
- `bio`: Opcional, máximo 1000 caracteres
- `avatar`: Opcional, máximo 500 caracteres (URL)
- `phone`: Opcional, máximo 20 caracteres
- `genres`: Array opcional de strings
- `instruments`: Array opcional de strings
- `experience_years`: Opcional, número entre 0 e 100

## 🎨 Value Objects Utilizados

### Email

- Validação de formato de email
- Garantia de unicidade na plataforma

### Phone

- Validação de formato de telefone brasileiro
- Formatação automática

### QRCode

- Geração automática de código único
- Persistência do código para acesso permanente

### Rating

- Cálculo automático da média de avaliações
- Validação de valores entre 0 e 5

## 🧪 Testes

O domínio Musician possui uma cobertura de testes abrangente, incluindo:

- **Testes de Unidade**: Para a entidade `Musician`, seus métodos e validações
- **Testes de Integração**: Para os casos de uso, verificando a interação entre as camadas
- **Testes de Repositório**: Para garantir que as operações de persistência funcionem corretamente
- **Testes de Validação**: Para verificar as regras de negócio e validações de campo
- **Testes de Fake Builder**: Para geração de dados de teste realistas

## 📚 Padrões Utilizados

- **Domain-Driven Design (DDD)**: Foco no domínio e na linguagem ubíqua
- **Clean Architecture / Arquitetura Hexagonal**: Separação de preocupações e inversão de dependências
- **Repository Pattern**: Abstração da persistência de dados
- **Use Case Pattern**: Orquestração das operações de negócio
- **Aggregate Pattern**: Agrupamento de entidades e objetos de valor
- **Value Objects**: Para representar conceitos como `Email`, `Phone`, `QRCode`, `Rating`
- **Factory Pattern**: Para a criação de validadores (`MusicianValidatorFactory`)
- **Builder Pattern**: Para criação de objetos de teste (`MusicianFakeBuilder`)

## 🔄 Integração com Outros Domínios

O domínio Musician é projetado para se integrar com outros domínios da plataforma SoundMeet:

- **Request Domain**: Para receber e gerenciar pedidos musicais
- **Establishment Domain**: Para conexão com locais de apresentação
- **Audience Domain**: Para interação com o público
- **Payment Domain**: Para recebimento de gorjetas
- **Gamification Domain**: Para sistema de pontuação e badges

## 🎵 Funcionalidades Específicas do SoundMeet

### QR Code Permanente

- Cada músico possui um QR code único e permanente
- Permite acesso rápido ao perfil via scan
- Facilita a conexão com o público durante apresentações

### Sistema de Avaliações

- Público pode avaliar apresentações
- Cálculo automático de rating médio
- Histórico de total de avaliações recebidas

### Perfil Profissional

- Informações detalhadas sobre experiência
- Gêneros musicais e instrumentos dominados
- Sistema de verificação para músicos profissionais

### Gestão de Repertório

- Controle de gêneros musicais que toca
- Lista de instrumentos que domina
- Anos de experiência na área musical

## 📁 Estrutura de Pastas

```
musician/
├── application/                    # Camada de Aplicação
│   ├── index.ts                   # Exports principais
│   ├── use-cases/                 # Casos de uso
│   │   ├── common/                # DTOs e mappers comuns
│   │   │   └── musician-output.ts # Output padrão
│   │   ├── create-musician/       # Criar músico
│   │   ├── delete-musician/       # Deletar músico
│   │   ├── get-musician/          # Obter músico por ID
│   │   ├── list-musicians/        # Listar músicos
│   │   └── update-musician/       # Atualizar músico
│   └── validations/               # Validações de aplicação
├── domain/                        # Camada de Domínio
│   ├── __tests__/                 # Testes da entidade
│   │   ├── musician.entity.spec.ts
│   │   ├── musician.validator.spec.ts
│   │   └── musician-fake.builder.spec.ts
│   ├── musician-fake.builder.ts   # Builder para dados de teste
│   ├── musician.aggregate.ts      # Entidade principal
│   ├── musician.validator.ts      # Validador de regras
│   └── musician.repository.ts     # Interface de repositório
├── infra/                         # Camada de Infraestrutura
│   └── db/
│       ├── in-memory/             # Implementação em memória
│       └── prisma/                # Implementação Prisma
└── index.ts                       # Exports do módulo
```

## 🚀 Exemplos de Uso

### Criando um músico

```typescript
const musician = Musician.create({
  email: "joao@musician.com",
  name: "João Silva",
  stage_name: "João Blues",
  bio: "Guitarrista com 10 anos de experiência",
  genres: ["Blues", "Rock", "Jazz"],
  instruments: ["Guitarra", "Violão"],
  experience_years: 10,
  is_active: true,
});
```

### Buscando músicos por gênero

```typescript
const useCase = new ListMusiciansUseCase(repository);
const result = await useCase.execute({
  filter: { genres: ["Rock", "Blues"] },
  sort: "rating",
  sort_dir: "desc",
});
```

### Adicionando avaliação

```typescript
musician.addRating(4.5);
// Atualiza automaticamente o rating médio e total de avaliações
```

## 🎯 Casos de Uso Específicos da Plataforma

### Músico Recebe Pedido Musical

1. Público escaneia QR code do músico
2. Acessa perfil e faz pedido musical
3. Músico recebe notificação do pedido
4. Pode aceitar ou recusar o pedido

### Sistema de Avaliações

1. Após apresentação, público pode avaliar
2. Rating é calculado automaticamente
3. Músicos com alto rating ganham destaque
4. Histórico de avaliações fica registrado

### Verificação de Perfil

1. Músicos podem solicitar verificação
2. Plataforma valida informações profissionais
3. Perfis verificados ganham badge especial
4. Maior credibilidade junto ao público

_Este README.md visa fornecer uma visão clara e concisa do domínio Musician, facilitando o entendimento e a colaboração entre os desenvolvedores da plataforma SoundMeet._
