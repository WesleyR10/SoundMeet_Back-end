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

| Guard | Arquivo | Path params aceitos | Modulos aplicados |
|-------|---------|--------------------|--------------------|
| `MusicianOwnershipGuard` | `ownership/musician-ownership.guard.ts` | `id`, `musicianId`, `musician_id` | MusiciansController, PaymentController, AvailabilityController |
| `EstablishmentOwnershipGuard` | `ownership/establishment-ownership.guard.ts` | `id`, `establishmentId` | EstablishmentsController, PaymentController |

Ambos os guards:
- Permitem `isAdmin` sem restricao de ownership (bypass total)
- Lancam `ForbiddenException` quando `currentUser` nao esta presente ou o ID nao corresponde
- Ignoram silenciosamente rotas sem o path param esperado (retornam `true`)

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

> **Estado atual (jun/2026):** criacao de groups por entidade e manual via Admin Console. Automacao via `scripts/keycloak-sync.mjs` esta planejada mas nao implementada.
