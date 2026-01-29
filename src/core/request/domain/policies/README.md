# Policies (Request Domain)

Este diretório concentra regras de negócio do domínio **Request** que:

- precisam ser reutilizadas em diferentes casos de uso;
- não pertencem a validações “intrínsecas” da entidade (invariantes estruturais);
- exigem um **contexto** calculado fora do domínio (ex.: status do evento, contagens, histórico recente);
- devem produzir erros no mesmo formato usado pelo core (`FieldsErrors[]`), para integração simples com `EntityValidationError`.

Na prática, aqui ficam regras do tipo “pode ou não pode executar X”, normalmente relacionadas a **anti-spam**, **limites**, **permissões por contexto** e **pré-condições**.

## Por que esse diretório existe

No começo, essas regras costumam nascer dentro do use case (camada `application/`). Porém, com o tempo:

- o use case fica grande e difícil de testar;
- regras começam a se repetir (outros fluxos também precisam de “pode fazer pedido?”);
- fica mais difícil evoluir mensagens/erros mantendo consistência;
- cresce a necessidade de testar combinações de regras de forma isolada.

O padrão **Policy** resolve isso ao extrair as regras para componentes pequenos e determinísticos, mantendo o use case focado em:

- orquestração;
- leitura de dependências (repositórios/gateways);
- montagem do contexto;
- persistência/publicação de eventos.

## O que é uma Policy aqui

Uma policy segue a interface [`IPolicy`](../../../shared/domain/policies/policy.interface.ts):

- recebe um `context` (dados já resolvidos pelo use case);
- retorna um [`PolicyResult`](../../../shared/domain/policies/policy-result.ts).

O `PolicyResult` carrega `errors: FieldsErrors[]` (mesma estrutura usada por validators do core), permitindo lançar:

- `throw new EntityValidationError(policyResult.errors)`.

## Como isso se conecta ao Notification Pattern

O core usa “notification pattern” em entidades/VOs, mas há regras que não fazem sentido como `validate()` do aggregate, porque dependem de:

- consultas (ex.: contagem de pedidos do dia);
- contexto externo (ex.: “é performer no evento?”);
- parâmetros de aplicação (ex.: limite configurável).

Nesses casos, o aggregate continua validando invariantes (campos, formatos, limites internos), e as policies cuidam das **pré-condições do caso de uso**.

## Implementação atual: CanMakeRequestPolicy

A policy principal deste diretório é [`CanMakeRequestPolicy`](./can-make-request.policy.ts). Ela é composta por regras menores:

- `EventMustBeActivePolicy`
- `MusicianMustBePerformerPolicy`
- `AudienceMustBeAttendeePolicy`
- `DailyRequestLimitPolicy`
- `NoPendingRequestForMusicianPolicy`
- `AntiSpamSimilarRecentRequestPolicy`

Todas recebem o mesmo `CanMakeRequestPolicyContext`, que contém:

- status do evento;
- flags de relacionamento (performer/attendee);
- contagem de pedidos do dia;
- flag de “já existe pendente”;
- lista de requests recentes (para anti-spam);
- `candidate: Request` (o request já instanciado, ainda não persistido).

A composição acontece via `PolicyResult.merge()`, acumulando erros.

## Uso no código

O fluxo típico (ex.: criação de pedido) é:

1. O use case resolve entidades e contexto (repositórios).
2. Cria o `candidate` (aggregate `Request`) com `created_at` definido.
3. Executa `CanMakeRequestPolicy.evaluate(context)`.
4. Se inválido, lança `EntityValidationError`.
5. Se válido, persiste.

Exemplo real: [`CreateRequestUseCase`](../../application/use-cases/create-request/create-request.use-case.ts).

## Testes

As policies têm testes unitários diretos em:

- [`can-make-request.policy.spec.ts`](./__tests__/can-make-request.policy.spec.ts)

Isso permite testar cenários de regra sem montar módulos NestJS, sem mocks de banco e sem duplicar lógica de arranjo do use case.

## Diretrizes importantes

- Policies devem ser **side-effect free**: não persistem, não publicam eventos, não chamam repositórios.
- O `context` deve ser montado na camada `application` (use case), porque depende de IO.
- Mensagens e “fields” dos erros devem ser estáveis (impactam contratos e testes). Use chaves como `event_id`, `musician_id`, `audience_id`, `song_title`.
- Prefira regras pequenas e nomeadas (fica mais fácil evoluir e reordenar).
- Se uma regra for reutilizável em múltiplos fluxos (ex.: “event must be active”), mantenha como policy separada.

## Specification vs Policy

Existe também a interface [`ISpecification`](../../../shared/domain/policies/specification.interface.ts). A diferença prática aqui:

- **Specification**: retorna `boolean` (satisfez ou não), útil quando você só precisa de um predicado.
- **Policy**: retorna `PolicyResult` com lista de erros, útil quando você precisa reportar falhas com campos/mensagens.

Para o domínio de Request, as rules atuais precisam retornar erros estruturados, então `Policy` é a escolha.

## Como adicionar uma nova regra

1. Crie uma nova classe `XxxPolicy implements IPolicy<CanMakeRequestPolicyContext>` em `can-make-request.policy.ts` (ou extraia para um arquivo próprio se crescer).
2. Retorne `PolicyResult.ok()` quando estiver válido.
3. Retorne `PolicyResult.fail([{ campo: ["mensagem"] }])` quando falhar.
4. Inclua a nova policy na lista do `CanMakeRequestPolicy`.
5. Adicione cenário no teste unitário (idealmente `test.each`).

## Referências

- `Request` aggregate: [`request.aggregate.ts`](../request.aggregate.ts)
- Resultado de policy e merge: [`policy-result.ts`](../../../shared/domain/policies/policy-result.ts)
- Uso no create request: [`create-request.use-case.ts`](../../application/use-cases/create-request/create-request.use-case.ts)
