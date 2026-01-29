# Núcleo de erros de domínio

Este diretório concentra um conjunto pequeno e estável de erros usados no core da aplicação, para manter consistência de modelagem, mensagens e tratamento no NestJS.

## Princípios

- O core lança erros sem depender de HTTP (sem `HttpException` no domínio/aplicação).
- Erros de domínio podem carregar `metadata` e `cause` para enriquecer logs/observabilidade sem acoplar ao framework.
- O tratamento HTTP acontece na borda (filters/exception filters).

## Tipos principais

- `EntityValidationError`: validação via notification/validator (invariantes de entidade/VO).
- `NotFoundError`: recurso/entidade inexistente.
- `ConflictError`: conflito de estado/concorrência (ex.: violação de unicidade, versão desatualizada).
- `InvalidArgumentError`: input inválido (parâmetro ruim).
- `InvalidOperationError`: regra de negócio / transição de estado inválida (ex.: “não pode aceitar request já rejeitado”).
- `InvariantViolationError`: bug/programação incorreta (invariante interna quebrada). Em geral vira 500, não 422.

## DomainError

Os erros de domínio (exceto `EntityValidationError`) estendem `DomainError`, que suporta:

- `metadata: Record<string, unknown>` para contexto estruturado
- `cause?: unknown` para encadear erros

## Mapeamento HTTP (na borda)

- `EntityValidationError` e `InvalidArgumentError`: 422
- `NotFoundError`: 404
- `ConflictError`: 409
- `InvalidOperationError`: 422
- `InvariantViolationError`: 500

## Boas práticas

- Prefira lançar erros do núcleo em vez de `throw new Error(...)` no core.
- Use `metadata` para informações úteis (ex.: `entity`, `id`, `field`, `operation`).
- Use `cause` quando estiver encapsulando um erro externo (DB, API, etc.).

