# Destaque pago do pedido — custódia, reembolso e taxas (TAREFA ABERTA)

> **Dono:** Wesley. **Aberta em:** 28/set/2026.
> **Status:** a estrutura "paga antes, destaca depois" está pronta; o que está
> abaixo é o que falta para o dinheiro se comportar como o produto promete.
> Nada aqui está implementado.

## O que JÁ mudou (28/set/2026)

| Antes (Bloco 15, ago/2026) | Agora |
|---|---|
| PIX nascia no **aceite** do músico | PIX nasce no **pedido** (`CreateRequestUseCase.chargeBoost`) |
| `promised` e `awaiting_payment` subiam na fila | **Só `paid` sobe** (VO + `ORDER BY`, que também só ordena valor pago) |
| Fã podia prometer R$20, furar a fila e não pagar | Sem pagamento, o pedido é comum |
| Recusa nunca envolvia dinheiro | Recusa de pedido **pago** → `refund_pending` + `RequestBoostRefundPendingEvent` |

Transições que envolvem dinheiro (`request-boost.vo.ts`):

- `awaiting_payment` → `paid` (pagou com o pedido aberto) · `expired` (janela venceu) · `cancelled` (recusado antes de pagar)
- `expired` → `paid` (pagou atrasado, pedido ainda aberto) · `refund_pending` (pagou atrasado, pedido recusado)
- `cancelled` → `refund_pending` (pagou depois da recusa — o QR continua pagável)
- `paid` → `refund_pending` (pagou e o músico recusou)
- `refund_pending` → **terminal até esta tarefa existir** — a lista de quem precisa receber de volta é
  `SELECT … FROM music_requests WHERE "boostStatus" = 'refund_pending'`.

## 🔴 Bloqueio de produção

O app JÁ DIZ ao fã: *"Se o pedido for recusado, o valor volta pra você."*
(`disclaimer` em `soundmeet-mobile/src/widgets/fan-request/model/priority-fader.ts`). É a política
combinada — mas hoje `refund_pending` não devolve nada. **Não publicar o destaque pago em produção
antes do reembolso funcionar** (ou trocar essa frase), senão a promessa é falsa.

## A decisão de produto que falta: ONDE o dinheiro fica até o pedido acontecer

O combinado com o usuário: **enquanto o pedido não foi atendido, o dinheiro não pode ir para a conta
do músico** — só depois de TOCADO (ou no fim do show). É como Mercado Livre e Shopee operam: quem
paga é o comprador, mas o dinheiro fica retido por uma **instituição de pagamento regulada** e só é
liberado ao vendedor quando a condição se cumpre (entrega confirmada / "pedido recebido").

🔴 **Hoje isso NÃO acontece.** A cobrança é criada **na conta Mercado Pago do músico** (split 1:1,
`MercadoPagoPixGateway`, OAuth + `marketplace_fee`), e a liberação do dinheiro lá segue os prazos
configurados pelo próprio vendedor ("tarifas e prazos"). Na busca da documentação do MP (28/set) não
apareceu um parâmetro para "segurar até uma condição" no split 1:1 — **confirmar com o Mercado Pago**
antes de descartar.

Caminhos a avaliar:

- [ ] **A. Mercado Pago com retenção** — perguntar ao MP se existe produto de custódia/retenção
      condicional para marketplace 1:1 (liberar por chamada de API). Se existir, é o menor desvio.
- [ ] **B. Custódia do Asaas, a mesma do cachê** — o projeto JÁ tem isso: `BookingEscrow`
      (`src/core/payment/`) bloqueia o valor na **subconta do músico na instituição de pagamento** e
      só libera com condição (check-in + sem contestação). Levar o destaque para lá: liberação =
      pedido tocado (`SongStartedEvent` → `MarkRequestPlayedUseCase`). Custo: gorjeta de destaque
      sairia do MP e voltaria a ter a taxa fixa do Asaas (R$1,99 no PIX em ago/2026 — ver
      `Docs/_privado/pagamentos/pesquisa-de-gateways-2026-08.md`), pesada para tickets de R$2–R$20.
- [ ] 🔴 **Nunca** "saldo lógico numa conta da SoundMeet": é o caminho recusado da Woovi (atividade
      regulada; tornaria falsa a cláusula `papel_da_plataforma.com_custodia`). Ver CLAUDE.md, "Custódia".

## Reembolso (depende da decisão acima)

- [ ] Handler de `RequestBoostRefundPendingEvent` que pede o reembolso ao provedor.
      MP: `POST /v1/payments/{id}/refunds`; mandar `X-Render-In-Process-Refunds: true` para receber
      `201` + `status: in_process` em vez de `400` quando o reembolso PIX entra em contingência (Bacen).
- [ ] Estados novos no VO: `refunding` → `refunded` | `refund_failed`, com retry idempotente.
- [ ] 🔴 **Músico já sacou.** Documentação do MP (split 1:1): *"o Marketplace não poderá realizar o
      reembolso total se o vendedor não tiver dinheiro na conta. Nesse caso, cabe à conta do
      Marketplace reembolsar o equivalente à sua parte e decidir se devolverá o restante, que é
      responsabilidade do vendedor, por outro meio."* Com custódia (A ou B) isso some; sem ela,
      decidir quem cobre.
- [ ] Cancelar o PIX pendente no provedor quando o pedido é recusado ANTES do pagamento — hoje o QR
      continua pagável e o pagamento tardio vira `refund_pending`.
- [ ] Pedido **aceito e nunca tocado** com destaque pago: reembolsar no fim do evento? Liberar mesmo
      assim? (Decisão de produto.)

## Taxas

- [ ] Quem absorve a taxa do gateway num reembolso? No MP o reembolso sai **proporcional** da conta do
      vendedor e da do marketplace (documentação do split 1:1). Validar no sandbox: o 0,99% do PIX
      volta? A `marketplace_fee` volta?
- [ ] Refletir no texto do app o que o fã recebe de volta (valor cheio ou líquido).

## Arestas que a estrutura nova expõe

- [ ] ⚠️ **Janela × validade do PIX.** A janela do app é `REQUEST_BOOST_PAYMENT_WINDOW_MINUTES=15`,
      mas no MP a validade mínima de um PIX é **30 minutos**. Entre 15 e 30 min o QR ainda é pagável
      com o destaque já `expired` — o domínio trata (paga tarde: vale se o pedido está aberto, senão
      reembolso), mas alinhar os dois evita surpresa.
- [ ] `payment-events.handler.ts` avisa `tip.confirmed` ao fã para TODA gorjeta concluída — inclusive
      a que virou `refund_pending`. Hoje o fã veria a celebração de um pagamento que vai voltar.
- [ ] Aviso de reembolso por push: o fã ganhou push token em 02/out/2026 (Bloco 19.B), mas hoje só
      os avisos de quem ele segue o usam. Sem ligar aqui, o aviso de reembolso chega só por socket.

## Deploy da estrutura nova

- [ ] `npx prisma migrate deploy` — `20260928120000_request_boost_pay_first` (aditiva: só o valor
      `refund_pending` no enum). ⚠️ O e2e `test/request/boosted-request-ordering.e2e-spec.ts` roda no
      MESMO banco do desenvolvimento (`envs/.env.e2e`) e precisa da migration aplicada.
- [ ] Rebuild do `soundmeet-app` e `npm run seed -- --reset` (o seed semeia os seis estados novos).
