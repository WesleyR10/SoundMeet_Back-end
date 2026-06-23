# 📱 QR Code — Spec (Perfil permanente + validação de scan)

## Princípio: dois níveis

1. **QR permanente (identidade/navegação)** — sem expiração.
   - Conteúdo: `soundmeet://musician/{musicianId}` ou `soundmeet://establishment/{establishmentId}`.
   - Gerado na criação do agregado (`generateQRCode`) e estável (pode ser impresso em mesa/cartão/palco).
   - Abrir perfil é **público** → replay não causa dano; não precisa de token/JWT.

2. **Validação no backend (autorização de ações)** — só quando o scan gera efeito (pontuar, resgatar benefício, registrar presença).
   - O app lê o QR permanente → chama o backend com `musician_id` + usuário autenticado → backend valida regras e registra.

> Colocar JWT com expiração **dentro** do QR impresso é um anti-padrão: o QR "morreria" e exigiria reimpressão. JWT/token curto só entra em fluxo de 2 passos quando houver necessidade real de anti-replay forte (RS256/ES256 se multi-serviço; HS256 se backend único).

## Estado atual (`ScanQRUseCase`)

- ✅ Gera o formato `soundmeet://...` permanente nos agregados Musician/Establishment.
- ✅ Limite anti-abuso: **5 scans/dia por usuário, por músico** (`UserInteraction` com filtro `user_id + musician_id` no dia). Pontos por scan: **10** (máx. 50/dia por músico).
  - Após o limite: o perfil continua abrindo e a interação é registrada, mas `points_earned = 0`.
- ⚠️ Validação do `qr_code` hoje só checa "não vazio" (VO `QRCode` valida não-vazio/URL/expiração; **não** valida o esquema `soundmeet://...` nem assinatura).
- ⚠️ `musician_id` vem separado no input e pode ser qualquer string (sem `IsUUID`).

## Melhorias recomendadas (ordem)

1. **Parse + consistência** no `validateQRCode`:
   - aceitar somente `soundmeet://musician/<uuid>` (e establishment) e extrair o `<uuid>`;
   - validar UUID; se `input.musician_id` vier preenchido, exigir que seja **igual** ao extraído do QR;
   - parar de confiar no `musician_id` "solto" e usar o extraído.
2. **Checar existência/elegibilidade** antes de pontuar (injetar `IMusicianRepository`; rejeitar id inexistente/inativo).
3. **(Opcional) Token curto + anti-replay** apenas se a economia do app (pontos/benefícios) começar a atrair automação: fluxo de 2 passos com `jti` + store Redis (TTL até `exp`).
4. **Atualizar testes**: fixtures hoje usam `musician_123` (não-UUID) → migrar para UUIDs reais e adicionar casos (esquema errado, UUID inválido, `musician_id` divergente do extraído, replay se Opção 3).

## Nota arquitetural

O fluxo de scan faz `update(audience)` + `insert(userInteraction)` sem Unit of Work/outbox → consistência pode ser eventual em infra real. É evolução posterior, não erro de arquitetura.
