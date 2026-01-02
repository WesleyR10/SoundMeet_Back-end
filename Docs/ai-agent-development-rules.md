# 🤖 AGENTE DE IA - REGRAS DE DESENVOLVIMENTO SOUNDMEET

## 🎯 OBJETIVO PRINCIPAL

Este agente de IA deve auxiliar no desenvolvimento do backend da plataforma SoundMeet, garantindo **consistência arquitetural absoluta** com os padrões estabelecidos nos módulos existentes e seguindo rigorosamente a arquitetura DDD + Clean Architecture + Hexagonal.

## 📋 REGRA FUNDAMENTAL

**ANTES DE QUALQUER ALTERAÇÃO EM ARQUIVO**: Sempre comparar e analisar os módulos de referência existentes para manter consistência em:

- ✅ Arquitetura e estrutura de pastas
- ✅ Design patterns utilizados
- ✅ Nomenclatura de classes, métodos e propriedades
- ✅ Funcionalidades e comportamentos
- ✅ Padrões de validação e tratamento de erros

## 🏗️ MÓDULOS DE REFERÊNCIA OBRIGATÓRIOS

### Módulos Concluídos (Base para Comparação):

- **Musician**: `/home/wesleyr10/Programação/Projetos/SoundMeet/soundmeet-backend/src/core/musician/`
- **Establishment**: `/home/wesleyr10/Programação/Projetos/SoundMeet/soundmeet-backend/src/core/establishment/`

### Arquitetura de Referência:

- **FC3 Project**: `/home/wesleyr10/Programação/Projetos/SoundMeet/FC3-admin-catalogo-de-videos-typescript/`

### Documentação de Requisitos:

- **Features**: `/home/wesleyr10/Programação/Projetos/SoundMeet/soundmeet-backend/Docs/Features-SoundMeet.md`
- **Backend Tecnologias**: `/home/wesleyr10/Programação/Projetos/SoundMeet/soundmeet-backend/Docs/Tecnologias.md`

## 🔍 ANÁLISE OBRIGATÓRIA ANTES DE QUALQUER MODIFICAÇÃO

### 1. ESTRUTURA ARQUITETURAL

Sempre verificar e seguir a estrutura padrão identificada:

```
src/core/[domain]/
├── application/
│   ├── use-cases/
│   │   ├── common/           # Outputs e mappers compartilhados
│   │   ├── create-[entity]/  # Caso de uso de criação
│   │   ├── delete-[entity]/  # Caso de uso de exclusão
│   │   ├── get-[entity]/     # Caso de uso de busca individual
│   │   ├── list-[entities]/  # Caso de uso de listagem
│   │   ├── update-[entity]/  # Caso de uso de atualização
│   │   └── index.ts          # Exports do módulo
│   └── validations/          # Validações específicas da aplicação
├── domain/
│   ├── __tests__/            # Testes unitários do domínio
│   ├── [entity].aggregate.ts # Agregado principal
│   ├── [entity].repository.ts# Interface do repositório
│   ├── [entity].validator.ts # Validadores de domínio
│   ├── [entity]-fake.builder.ts # Builder para testes
│   └── index.ts              # Exports do domínio
├── infra/
│   └── db/
│       ├── in-memory/        # Implementação em memória para testes
│       └── prisma/           # Implementação com Prisma
└── index.ts                  # Exports do módulo completo
```

### 2. PADRÕES DE NOMENCLATURA IDENTIFICADOS

#### Classes e Interfaces:

- **Agregados**: `[Entity].aggregate.ts` → `export class [Entity] extends AggregateRoot`
- **IDs**: `export class [Entity]Id extends Uuid`
- **Repositórios**: `I[Entity]Repository extends ISearchableRepository`
- **Use Cases**: `[Action][Entity]UseCase implements IUseCase`
- **Validators**: `[Entity]ValidatorFactory`
- **Fake Builders**: `[Entity]FakeBuilder`

#### Propriedades e Métodos:

- **IDs de Entidade**: `[entity]_id: [Entity]Id` (snake_case para propriedades de domínio)
- **Métodos de Mudança**: `change[Property](value: type): void`
- **Métodos de Atualização**: `update[Property](value: type): void`
- **Métodos de Estado**: `activate()`, `deactivate()`, `verify()`, `unverify()`
- **Getters Computados**: `get is[State](): boolean`, `get [computed](): type`

### 3. PADRÕES DE IMPLEMENTAÇÃO OBRIGATÓRIOS

#### Agregados (Domain):

```typescript
export class [Entity] extends AggregateRoot {
  [entity]_id: [Entity]Id;
  // ... propriedades do domínio

  constructor(props: [Entity]ConstructorProps) {
    super();
    this.[entity]_id = props.[entity]_id ?? new [Entity]Id();
    // ... inicialização das propriedades
  }

  get entity_id(): ValueObject {
    return this.[entity]_id;
  }

  static create(command: [Entity]CreateCommand): [Entity] {
    const entity = new [Entity](command);
    entity.validate(['required_field']);
    return entity;
  }

  // Métodos de negócio seguindo padrão change/update
  change[Property](value: type): void {
    this.[property] = value;
    this.validate(['property']);
  }

  validate(fields?: string[]): boolean {
    const validator = [Entity]ValidatorFactory.create();
    return validator.validate(this.notification, this, fields);
  }

  static fake() {
    return [Entity]FakeBuilder;
  }

  toJSON() {
    return {
      [entity]_id: this.[entity]_id.id,
      // ... todas as propriedades
    };
  }
}
```

#### Use Cases (Application):

```typescript
export class [Action][Entity]UseCase
  implements IUseCase<[Action][Entity]Input, [Action][Entity]Output>
{
  constructor(private readonly [entity]Repo: I[Entity]Repository) {}

  async execute(input: [Action][Entity]Input): Promise<[Action][Entity]Output> {
    // 1. Validação de entrada
    // 2. Lógica de negócio
    // 3. Persistência
    // 4. Retorno do output mapeado

    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    return [Entity]OutputMapper.toOutput(entity);
  }
}
```

#### Repositórios (Domain):

```typescript
export type [Entity]Filter = {
  name?: string | null;
  email?: string | null;
  is_active?: boolean | null;
  is_verified?: boolean | null;
  // ... outros filtros específicos
};

export class [Entity]SearchParams extends DefaultSearchParams<[Entity]Filter> {
  private constructor(props: SearchParamsConstructorProps<[Entity]Filter> = {}) {
    super(props);
  }

  static create(props: SearchParamsConstructorProps<[Entity]Filter> = {}) {
    return new [Entity]SearchParams(props);
  }

  get filter(): [Entity]Filter | null {
    return this._filter;
  }

  protected set filter(value: [Entity]Filter | null) {
    // Lógica de validação e normalização dos filtros
  }
}

export class [Entity]SearchResult extends DefaultSearchResult<[Entity]> {}

export interface I[Entity]Repository
  extends ISearchableRepository<
    [Entity],
    [Entity]Id,
    [Entity]Filter,
    [Entity]SearchParams,
    [Entity]SearchResult
  > {}
```

## 🎯 DOMÍNIOS PENDENTES E SUAS ESPECIFICAÇÕES

### 1. DOMÍNIO AUDIENCE (Público)

**Entidades Principais**: `User`, `Profile`, `Interaction`
**Funcionalidades Específicas**:

- Scan de QR code para acesso a perfis de músicos
- Sistema de pedidos musicais com votação democrática
- Sistema de gorjetas diretas (PIX/QR)
- Indicação de músicos para estabelecimentos
- Feed de descoberta por proximidade geográfica

**Propriedades Específicas do Agregado User**:

```typescript
export class User extends AggregateRoot {
  user_id: UserId;
  email: Email;
  name: string;
  avatar: string | null;
  phone: Phone | null;
  location: Location | null; // Para proximidade
  preferences: string[]; // Gêneros musicais preferidos
  total_tips_given: number;
  total_requests_made: number;
  gamification_points: number;
  is_active: boolean;
  created_at: Date;
}
```

### 2. DOMÍNIO REQUEST (Pedidos Musicais)

**Entidades Principais**: `MusicRequest`, `Vote`, `Feedback`
**Funcionalidades Específicas**:

- Pedidos com sugestões baseadas no estilo do músico
- Limite anti-spam por usuário por evento
- Sistema de confirmação (aceito/recusado/executado)
- Votação democrática com intervalos de tempo
- Histórico completo de pedidos por evento

**Propriedades Específicas do Agregado MusicRequest**:

```typescript
export class MusicRequest extends AggregateRoot {
  request_id: RequestId;
  musician_id: MusicianId;
  user_id: UserId;
  establishment_id: EstablishmentId | null;
  song_title: string;
  artist_name: string;
  message: string | null;
  status: RequestStatus; // pending, accepted, rejected, played
  votes_count: number;
  priority_score: number; // Baseado em votos e gorjetas
  requested_at: Date;
  responded_at: Date | null;
  played_at: Date | null;
}
```

### 3. DOMÍNIO GAMIFICATION (Gamificação)

**Entidades Principais**: `Points`, `Badge`, `Ranking`, `Reward`
**Funcionalidades Específicas**:

- Sistema de pontuação multi-ação
- Badges progressivos por categoria
- Rankings mensais segmentados
- Recompensas exclusivas por nível

**Sistema de Pontuação**:

- Scan QR: 10 pontos
- Pedido musical: 25 pontos
- Acerto de sugestão: 50 pontos
- Gorjeta: 1 ponto por real
- Compartilhamento social: 50 pontos

### 4. DOMÍNIO PAYMENT (Pagamentos/Gorjetas)

**Entidades Principais**: `Tip`, `Transaction`, `Wallet`
**Funcionalidades Específicas**:

- Gorjetas diretas via PIX/QR code
- Mensagens personalizadas com gorjetas
- Wall de apoiadores público (opcional)
- Divisão automática para bandas
- Dashboard financeiro para músicos

## 🔧 VALIDAÇÕES E TRATAMENTO DE ERROS

### Padrão de Validação Identificado:

1. **Validação no Agregado**: Usar `validate(fields?: string[])` com `[Entity]ValidatorFactory`
2. **Validação no Use Case**: Verificar `entity.notification.hasErrors()`
3. **Tratamento de Erro**: Lançar `EntityValidationError(entity.notification.toJSON())`

### Value Objects Compartilhados Disponíveis:

- `Uuid` - IDs únicos
- `Email` - Validação de email
- `Phone` - Validação de telefone
- `QRCode` - Códigos QR
- `Rating` - Sistema de avaliações
- `Address` - Endereços completos
- `CNPJ` - Validação de CNPJ

## 🧪 PADRÕES DE TESTE IDENTIFICADOS

### Estrutura de Testes:

- **Domain Tests**: `src/core/[domain]/domain/__tests__/`
- **Fake Builders**: Para geração de dados de teste
- **Testes Unitários**: Cobertura de agregados, use cases e validadores
- **Testes de Integração**: Repositórios e infraestrutura

## 📦 INTEGRAÇÕES FUTURAS (Referência)

Quando necessário, consultar: `/home/wesleyr10/Programação/Projetos/SoundMeet/soundmeet-backend/Docs/prompt-desenvolvimento-backend.md`

### Stack Tecnológica Planejada:

- **NestJS + TypeScript**: Framework e tipagem
- **Prisma**: ORM principal
- **PostgreSQL**: Banco principal
- **MongoDB**: Analytics e logs
- **Redis**: Cache e sessões
- **RabbitMQ**: Mensageria em tempo real
- **Keycloak**: Autenticação multi-tenant
- **AWS S3 + CloudFront**: Armazenamento e CDN

## ✅ CHECKLIST DE VERIFICAÇÃO ANTES DE IMPLEMENTAR

### 🔍 Análise Prévia Obrigatória:

- [ ] Analisei os módulos `musician` e `establishment` existentes
- [ ] Verifiquei a estrutura de pastas e arquivos
- [ ] Identifiquei os padrões de nomenclatura utilizados
- [ ] Compreendi os design patterns aplicados
- [ ] Revisei as funcionalidades específicas do domínio

### 🏗️ Implementação:

- [ ] Estrutura de pastas segue o padrão identificado
- [ ] Nomenclatura de classes e métodos é consistente
- [ ] Agregado implementa todos os métodos de negócio necessários
- [ ] Use cases seguem o padrão de validação e tratamento de erros
- [ ] Repositório implementa filtros e busca adequados
- [ ] Testes unitários cobrem cenários principais
- [ ] Fake builder está implementado para testes

### 🎯 Funcionalidades Específicas:

- [ ] Todas as funcionalidades do domínio estão implementadas
- [ ] Regras de negócio específicas estão no agregado
- [ ] Validações de domínio estão adequadas
- [ ] Integração com outros domínios está prevista

## 🚨 ALERTAS CRÍTICOS

### ❌ NUNCA FAZER:

- Alterar arquivos sem analisar os padrões existentes
- Criar estruturas diferentes dos módulos de referência
- Usar nomenclaturas inconsistentes com o projeto
- Implementar funcionalidades sem consultar os requisitos
- Quebrar os princípios de Clean Architecture e DDD

### ✅ SEMPRE FAZER:

- Comparar com módulos existentes antes de implementar
- Seguir rigorosamente os padrões identificados
- Manter consistência arquitetural absoluta
- Implementar todas as funcionalidades específicas do domínio
- Garantir que o código atende aos requisitos funcionais

---

## 📚 RESUMO EXECUTIVO

Este agente de IA deve ser um **guardião da consistência arquitetural** do projeto SoundMeet. Sua função principal é garantir que todo novo código siga exatamente os mesmos padrões, estruturas e convenções estabelecidas nos módulos `musician` e `establishment`, mantendo a integridade da arquitetura DDD + Clean Architecture + Hexagonal em todos os aspectos do desenvolvimento.

**Lembre-se**: A consistência é mais importante que a inovação. Siga os padrões estabelecidos religiosamente.
