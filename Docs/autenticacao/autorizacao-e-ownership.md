# Autorização e ownership — como proteger uma rota

> Pasta [autenticacao/](./): [keycloak.md](keycloak.md) (realm, clients, papéis, claims) ·
> [autorizacao-e-ownership.md](autorizacao-e-ownership.md) (proteger uma rota) ·
> [login-e-cadastro.md](login-e-cadastro.md) (os fluxos de entrada) ·
> [usuarios-de-teste.md](usuarios-de-teste.md) (logins do seed).

## Fluxo de autorizacao — 3 camadas

```
Request HTTP
    │
    ▼
[AuthGuard]  ──── valida JWT assinado (RS256/JWKS ou HS256 local)
    │               extrai sub, roles, establishment_ids, band_ids
    ▼
[RolesGuard]  ─── verifica role minima da rota (@Roles("musician", "admin"))
    │               rejeita com 403 se role ausente
    ▼
[CurrentUserContextGuard]  ─── normaliza request.currentUser
    │                           (userId, roles, establishmentIds, bandIds, isAdmin)
    ▼
[OwnershipGuard ou use-case]  ─── decide se ESTE usuario pode operar ESTE recurso
    │
    ▼
  Controller → Use Case
```

**Quando usar guard vs use-case para ownership:**

| Situacao | Abordagem |
|----------|-----------|
| ID do recurso esta no path param e o JWT ja carrega os IDs do usuario | Guard no metodo (`@UseGuards(MusicianOwnershipGuard)`) |
| Precisa carregar a entidade do banco para saber o dono (ex.: bookings tem `establishment_id` que nao esta no JWT) | Use-case recebe `requesting_user_id` + `is_admin` do `@CurrentUser()` e valida internamente |

---

## Guards de ownership disponiveis

| Guard | Arquivo | Path params, NA ORDEM em que sao lidos | Compara com |
|-------|---------|----------------------------------------|-------------|
| `MusicianOwnershipGuard` | `ownership/musician-ownership.guard.ts` | `musician_id`, `musicianId`, `id` | `sub` do token |
| `AudienceOwnershipGuard` | `ownership/audience-ownership.guard.ts` | `audience_id`, `audienceId`, `id` | `sub` do token |
| `EstablishmentOwnershipGuard` | `ownership/establishment-ownership.guard.ts` | `establishment_id`, `establishmentId`, `id` | claim `establishment_ids` |

> **Banda não tem ownership guard, e é de propósito (out/2026).** Quem pode alterar uma banda é o
> LÍDER ATUAL, lido do banco dentro de cada use-case (`assertBandLeader`, em
> `core/musician/application/use-cases/common/band-actor.ts`). O `BandOwnershipGuard` conferia o
> claim `band_ids`, escrito só na criação da banda: depois de uma transferência de liderança, a
> nova líder levava 403 em tudo e o ex-líder continuava podendo apagar a banda. O guard foi
> removido. **Regra geral:** claim de JWT serve para ESCOPO (o que entra nas listas do usuário);
> um papel que muda dentro do agregado — líder, integrante — se confere na fonte, a cada chamada.

Todos os guards (`resolve-ownership-id.ts`):
- Permitem `isAdmin` sem restricao de ownership (bypass total)
- Lancam `ForbiddenException` quando `currentUser` nao esta presente ou o ID nao corresponde
- Leem o nome ESPECIFICO primeiro e `id` por ultimo. Numa rota aninhada
  (`musicians/:musician_id/repertoires/:id`) o `:id` e de outra entidade; `@OwnershipParam({ param })`
  ou `{ bodyKey }` na rota vence qualquer convencao
- Sao **fail-closed**: aplicados numa rota em que nenhum id e resolvivel, respondem 403
  ("Nao foi possivel determinar o recurso desta operacao"). Esta pagina dizia o contrario
  ("retornam `true`") ate out/2026

> O guard prova QUEM e o usuario, nunca de quem e o sub-recurso: a posse de um filho
> (`:personal_chord_sheet_id`, `:repertoire_id`) e checada no use-case.

### Rota publica que responde diferente para o dono

`GET /musicians/:id` e `@Public()` com autenticacao opcional: o dono recebe e-mail, telefone, CNPJ e
endereco; qualquer outro recebe a versao publica. O `AuthGuard` degrada token recusado para anonimo,
o que e certo para terceiros e era um defeito para o dono — o access token dura 15 minutos, o app so
renova a sessao ao receber 401, e a rota respondia 200 com a versao publica do perfil dele.

Desde out/2026 o guard registra em `request.rejectedTokenSub` o `sub` do token recusado, e o handler
responde 401 quando ele e o proprio `:id` (`@RejectedTokenSub()`). **Esse valor nao foi verificado:**
so pode servir para recusar mais, nunca para liberar um dado. Use o mesmo padrao em qualquer rota
publica nova com representacao dupla.

---

## Como adicionar ownership a uma nova rota

Siga este checklist de 5 passos:

**1.** Confirmar que o controller ja tem na classe:
```typescript
@UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
```

**2.** Escolher o guard correto:
- Recurso pertence a um musico → `MusicianOwnershipGuard`
- Recurso pertence a um estabelecimento → `EstablishmentOwnershipGuard`

**3.** Verificar que o path param usa nome suportado pelo guard (ver tabela acima). Se necessario, renomear o param na rota.

**4.** Adicionar o guard no metodo:
```typescript
@Patch(":musician_id/profile")
@UseGuards(MusicianOwnershipGuard)
async updateProfile(...) { ... }
```

**5.** Se o recurso nao esta no path param (ex.: um booking nao expoe o `establishment_id` na URL), use a validacao no use-case:

```typescript
// No controller:
async confirm(
  @Param("id") id: string,
  @CurrentUser() user: AuthenticatedUser,
) {
  await this.useCase.execute({
    booking_id: id,
    requesting_user_id: user.userId,
    is_admin: user.isAdmin,
  });
}

// No use-case, apos findById:
if (!input.is_admin) {
  const isOwner =
    entity.establishment_id.id === input.requesting_user_id ||
    entity.musician_id?.id === input.requesting_user_id;
  if (!isOwner) throw new ForbiddenException();
}
```

Este padrao ja esta implementado em: `ConfirmBookingUseCase`, `CancelBookingUseCase`, `AcceptInquiryUseCase`, `RejectInquiryUseCase`.

---

## Convencao de groups para novas entidades

Quando o sistema criar um novo establishment ou banda, o backend DEVE adicionar o usuario responsavel ao group correspondente via **Keycloak Admin API**:

```
POST /admin/realms/soundmeet/users/{user_id}/groups/{group_id}
```

Convencao de nomes:

```text
/soundmeet/establishments/{establishment_id}/owners   ← dono (pode alterar tudo)
/soundmeet/establishments/{establishment_id}/staff    ← operador (acesso limitado)
/soundmeet/bands/{band_id}/managers                   ← gerente da banda
/soundmeet/bands/{band_id}/members                    ← membro (agenda, cifra)
```

Isso popula `establishment_ids` e `band_ids` automaticamente no proximo token emitido pelo Keycloak sem necessidade de alterar o backend.

> **Estado atual (out/2026):** o vinculo e **automatico e nao usa groups**. O backend grava os
> atributos `establishment_ids` / `band_ids` no usuario pela Admin API ao criar o estabelecimento ou a
> banda (`IIdentityClaimsWriter.addClaimValue`, chamado por `register-establishment`,
> `create-establishment` e `create-band`); o valor aparece no proximo token. A convencao de groups
> acima ficou como desenho para o futuro (papeis `owners`/`staff`), nao como o que roda hoje — ate
> out/2026 esta nota dizia que a criacao era manual, contradizendo o `keycloak.md`.
