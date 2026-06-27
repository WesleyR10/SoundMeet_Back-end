# Debate de Design — Chat Estabelecimento ↔ Músico

> Bloco 5.1 (WebSockets) + Bloco 7.1 (Chat)  
> Este documento não é um plano de implementação — é um debate de decisões de design antes de codificar.

---

## 1. O que é esse chat e para que serve

O chat do SoundMeet é um **canal de negociação profissional** entre estabelecimento e músico, contextualizado a uma contratação. Não é um chat social, não é suporte ao cliente, não é comunicação com o público.

Jornada principal:
1. Estabelecimento faz uma `Inquiry` (já existe no domínio `scheduling`)
2. Chat abre **vinculado** a essa Inquiry
3. Negociam cachê, data, repertório, rider técnico
4. Quando fecham → `Booking` (já existe)
5. Chat persiste como registro da negociação

**Análogo mais próximo:** Booking.com messages, Fiverr inbox, LinkedIn InMail — todos têm chat contextual a uma transação, não um messenger genérico.

---

## 2. O que PRECISA ter (Must-have MVP)

| Feature | Motivo |
|---------|--------|
| Mensagens de texto 1:1 | Core do chat |
| Histórico persistente | Rastreabilidade da negociação |
| Status da mensagem (enviada / entregue / lida) | Músico precisa saber se proposta foi vista |
| Notificação in-app (badge/contador) | Urgência em negociações |
| Push notification (Firebase/APNs) | Músico não fica com app aberto |
| Vinculação com Inquiry/Booking | Chat isolado não tem contexto |
| Bloqueio por ownership | Estabelecimento A não pode ver chat do B |
| Rate limiting por conversa | Anti-spam/assédio |
| Mensagens de voz | Complexidade de storage + UX desnecessária inicialmente |
| Reactions/emojis nas mensagens | Nice-to-have futuro |
| Edição/exclusão de mensagem |

---

## 3. O que NÃO precisa ter no MVP (Non-goals)

| Feature | Motivo para adiar |
|---------|------------------|
| Videochamada | Escopo totalmente diferente; use WhatsApp |
| GIFs/stickers | Não é contexto social |
| Chats em grupo | Negociação é 1:1; banda representa um lado só |
| Busca em mensagens | Relevante só com volume alto |
| Forwarding | Sem uso prático no contexto |
| Criptografia E2E | Overhead de implementação; LGPD não exige E2E, exige proteção em trânsito/repouso |

**Regra para o MVP:** se a feature não acelera a conversão de Inquiry → Booking, é backlog.

---

## 4. Análise de apps de chat — o que cada um faz e o que cabe para nós

### 4.1 Fiverr (referência mais próxima)
- Chat **vinculado ao pedido** — você não tem acesso a um inbox global separado
- Mensagens ficam permanentemente (é registro legal do contrato)
- Sistema de "request to contact" — você só envia mensagem após uma transação iniciada
- Bloqueio automático de links externos no início (anti-fraude, evita pagamento fora)
- **O que cabe pra nós:** chat sempre vinculado à Inquiry, bloqueio de contato direto sem Inquiry prévia

### 4.2 Booking.com
- Chat aparece **dentro da reserva**, nunca como thread separado
- Estabelecimento pode enviar mensagem pré-check-in/pós-check-out via templates
- Sistema de moderação: flags automáticos para dados pessoais (ex.: WhatsApp detectado no texto)
- **O que cabe pra nós:** chat contextualizado à Inquiry, não um inbox genérico; detecção de contato externo (evitar fuga da plataforma)

### 4.3 LinkedIn InMail / Mensagens
- Limite de mensagens por dia para contatos fora da rede (anti-spam)
- Mensagem de "connection request" — estabelecimento não manda direto, manda "interesse"
- **O que cabe pra nós:** o modelo de Inquiry JÁ faz esse papel no SoundMeet — o estabelecimento não abre chat do nada, abre uma Inquiry e o chat nasce a partir daí

### 4.4 WhatsApp Business API
- 24h window: após 24h sem resposta do usuário, só templates aprovados
- Templates para abrir conversa proativamente
- End-to-end encryption
- **O que cabe pra nós:** pensar em janela de inatividade — se músico não responde em X horas, notificação mais agressiva; templates de mensagem para casos comuns (proposta padrão, confirmação, etc.)

### Medidas adotadas por apps de chat que CABEM para nós

| Medida | Adaptação SoundMeet |
|--------|-------------------|
| Chat nasce de uma transação, não de contato livre | Chat sempre atrelado a uma `Inquiry` |
| Detecção de dados pessoais (telefone, e-mail externo) | Warn/flag quando músico compartilha contato fora da plataforma — protege o negócio |
| Rate limiting por conversa | Máx N mensagens por hora para evitar flood |
| Indicador "visto" obrigatório | Músico ver que establishment leu a proposta reduz ansiedade |
| Arquivamento permanente | Histórico de negociação é registro de negócio |
| Separação clara de papéis | Músico enxerga diferente do estabelecimento (ex.: estabelecimento vê status "músico online") |
| Anti-fuga de plataforma (light) | Não bloquear menção ao WhatsApp, mas logar para analytics |

---

## 5. Bibliotecas — comparativo

### Candidatas avaliadas

#### 5.1 Custom Socket.io + Prisma + Redis
- **O que faz:** você implementa tudo — rooms, mensagens, presença, histórico
- **Fit com stack:** **máximo** — Socket.io já está no Bloco 5.1, NestJS tem `@nestjs/platform-socket.io`, Redis já existe
- **Prós:** controle total, sem custo SaaS, sem vendor lock-in, LGPD friendly (dados só no seu servidor), escalável horizontalmente com Redis Adapter
- **Contras:** mais código para escrever, precisa implementar presença, typing, delivery receipt manualmente
- **Custo:** $0 (infra existente)
- **Complexidade de implementação:** média

#### 5.2 Stream Chat (GetStream.io)
- **O que faz:** SDK completo de chat (mensagens, channels, reactions, search, moderação, SDKs React/RN/Flutter)
- **Fit com stack:** bom — tem SDK NestJS/Node server-side
- **Prós:** feature-rich out of the box, escalável, search de mensagens, moderação, SDKs multiplataforma prontos
- **Contras:** SaaS externo ($29/mês acima de 100 MAU, ou ~$0,003/MAU), vendor lock-in, dados saem do seu servidor, integração com ownership/RBAC do Keycloak exige mapeamento
- **Custo:** free até 10k MAU (generoso para MVP), depois cresce com escala
- **Complexidade de implementação:** baixa (SDK faz muito)


---

### Decisão recomendada: **Socket.io custom** (com Redis Adapter)

**Por quê Socket.io + Prisma + Redis ganha:**

1. **Já está no roadmap** — Bloco 5.1 planeja Socket.io para pedidos em tempo real; o chat reutiliza a mesma infraestrutura
2. **Stack coesa** — sem nova dependência externa, sem nova conta SaaS
3. **LGPD** — mensagens de negociação contêm dados pessoais e valores comerciais; manter no seu servidor é mais seguro juridicamente
4. **Escala horizontal** — `socket.io-redis` (Redis Adapter) permite múltiplas instâncias do NestJS sem problema
5. **Controle de ownership** — você implementa no seu guard do NestJS, não precisa mapear roles para um serviço externo
6. **Custo previsível** — $0 SaaS; cresce só com infra que você já paga

**Quando reconsiderar Stream Chat:** se você quiser search de mensagens, reações, threads, moderação IA — aí o Stream Chat começa a pagar a conta. Para o MVP (negociação textual simples), Socket.io custom é superior.

---

## 6. Retenção e armazenamento de mensagens

### Onde armazenar?

| Opção | Prós | Contras |
|-------|------|---------|
| **PostgreSQL (Prisma)** | Fonte de verdade, joins com Inquiry/Booking, backup junto com resto | Pode crescer muito com volume alto |
| MongoDB | Performance de escrita em volume alto | Introduz outro banco para manter |
| Redis só | Ultra rápido | Não é durável, TTL |

**Recomendação: PostgreSQL como fonte de verdade + Redis como cache de mensagens recentes.**
- Últimas 50 mensagens de cada conversa ficam em Redis (leitura rápida)
- PostgreSQL tem o histórico completo
- Alinhado com a decisão de usar MongoDB apenas para analytics (Bloco 7.4)

### Por quanto tempo guardar?

| App | Política |
|-----|---------|
| WhatsApp Business | Indefinido (no servidor do cliente) |
| Slack Free | 90 dias |
| LinkedIn | Indefinido |
| Fiverr | Permanente (registro de contrato) |
| Booking.com | Permanente (registro de hospedagem) |

**Recomendação para SoundMeet: permanente (sem TTL) para MVP.**

Justificativas:
1. **Registro comercial** — se houver disputa sobre um cachê combinado, o histórico é evidência
2. **Volume é baixo no início** — não há pressão para deletar agora; adicionar política de TTL depois é mais fácil do que recuperar mensagens deletadas
3. **LGPD** — usuário pode solicitar exportação ou deleção dos dados; você precisa do histórico para honrar ambos
4. **Analytics futuro** — padrões de negociação (quanto tempo leva uma Inquiry virar Booking?) são valiosos

**O que implementar por LGPD:** endpoint de `GET /conversations/:id/export` (usuário baixa o histórico) e `DELETE /account` que deleta todas as mensagens também.

---

## 7. Features a implementar — MVP vs Roadmap

### MVP (Bloco 7.1 direto)

| Feature | Domínio | Nota |
|---------|---------|------|
| `Conversation` vinculada a `Inquiry` | `core/chat/` | 1 Inquiry → 1 Conversation |
| `Message` (texto, sender_id, status) | `core/chat/` | status: sent / delivered / read |
| `POST /conversations/:id/messages` | NestJS | envia mensagem |
| `GET /conversations/:id/messages` | NestJS | histórico paginado (cursor-based) |
| `GET /conversations` | NestJS | lista conversas com último preview |
| WebSocket: nova mensagem em tempo real | Socket.io gateway | event: `message.new` |
| WebSocket: status de leitura | Socket.io gateway | event: `message.read` |
| Notificação push (Firebase) | já no Bloco 7.2 | quando destinatário offline |
| Guard de ownership | auth-module | só participantes da Inquiry |
| Rate limit por conversa | throttler | máx 30 msgs/minuto por user |

### Roadmap futuro (não no MVP)

| Feature | Quando faz sentido |
|---------|-------------------|
| Typing indicator ("digitando...") | Quando UX mobile estiver madura |
| Anexo de arquivo (PDF rider/contrato) | Após feature de upload S3 consolidada |
| Mensagem de sistema automática | Quando Booking confirmar/cancelar — "Booking confirmado" aparece no chat |
| Template messages | Quando estabelecimentos reclamarem de repetição |
| Busca em mensagens | Quando tiver volume |
| Arquivamento manual | Quando tiver muitas conversas |
| Reactions | Nice-to-have social |

---

## 8. Arquitetura proposta (overview)

```
Domínio: src/core/chat/
  conversation.aggregate.ts          # 1 conversa por Inquiry
  message.aggregate.ts               # cada mensagem
  conversation.repository.ts         # I[...]Repository
  message.repository.ts
  events/
    MessageSent.event.ts
    MessageRead.event.ts
  use-cases/
    send-message/
    get-conversation/
    list-conversations/
    mark-as-read/

Infra:
  db/prisma/
    conversation-prisma.repository.ts
    message-prisma.repository.ts
  redis/
    conversation-cache.service.ts    # últimas 50 msgs por conversa

NestJS: src/nest-modules/chat-module/
  chat.gateway.ts                    # Socket.io gateway (herda do Bloco 5.1)
  chat.controller.ts                 # REST para histórico
  chat.module.ts
  chat.providers.ts
  dto/
```

**Prisma schema (esboço):**

```prisma
model Conversation {
  id          String    @id @default(uuid())
  inquiry_id  String    @unique
  inquiry     Inquiry   @relation(...)
  messages    Message[]
  created_at  DateTime  @default(now())
}

model Message {
  id              String       @id @default(uuid())
  conversation_id String
  conversation    Conversation @relation(...)
  sender_id       String       # musician_id ou establishment_id
  sender_type     String       # "musician" | "establishment"
  content         String       @db.Text
  status          String       @default("sent")  # sent | delivered | read
  created_at      DateTime     @default(now())
  read_at         DateTime?

  @@index([conversation_id, created_at])
}
```

**Por que `status` como String e não enum?**  
Mesmo padrão dos workers de IA no projeto — status pode evoluir (ex.: "moderated", "deleted_by_admin") sem migration agressiva.

---

## 9. Encaixe no roadmap

| Bloco | Item | Relação com chat |
|-------|------|-----------------|
| **5.1** | WebSockets (Socket.io) | **Pré-requisito direto** — o gateway do chat reutiliza o mesmo Socket.io que notifica pedidos aceitos/recusados |
| **5.2** | RabbitMQ pagamento → gamificação | Não bloqueia, mas o padrão event-driven é o mesmo |
| **7.1** | Chat estabelecimento ↔ músico | **Este item** |
| **7.2** | WebSockets push / Firebase APNs | **Depende do 5.1** — push notification quando destinatário está offline |
| **4B** | Ownership multi-tenant | **Já resolvido** — `EstablishmentOwnershipGuard` + `MusicianOwnershipGuard` cobrem o chat |

**Ordem lógica de implementação:**
1. Bloco 5.1 (Socket.io gateway base) → 2. Bloco 7.1 (chat sobre esse gateway) → 3. Bloco 7.2 (push quando offline)

Implementar o chat sem o gateway Socket.io do 5.1 seria duplicar código depois. **5.1 primeiro.**

---

## 10. Perguntas abertas para o debate

1. **Chat só nasce de uma Inquiry, ou o estabelecimento pode iniciar contato livre?**  
   Recomendo: sempre vinculado à Inquiry. Contato livre = spam. (modelo Fiverr/Booking)

2. **Músico pode recusar/bloquear conversa?**  
   Sim, mas implementar no MVP ou depois?

3. **Estabelecimento vê se músico está online?**  
   Prós: pressão social para responder. Contras: invasivo. Decisão de produto.

4. **A conversa fecha quando o Booking é finalizado ou fica aberta para pós-evento?**  
   Ex.: estabelecimento quer remarcar → abre nova Inquiry ou continua na mesma conversa?

5. **Mensagem mínima/máxima de caracteres?**  
   Sugestão: mín 1, máx 2000. Acima disso → compartilhe um documento.

6. **Detecção de dados de contato externo (WhatsApp/e-mail)?**  
   Light: logar como analytics de "tentativa de fuga". Pesado: bloquear envio.  
   Recomendo: logar no MVP, não bloquear (UX ruim no início).

---

## Resumo da recomendação

| Decisão | Escolha | Motivo |
|---------|---------|--------|
| Biblioteca de chat | **Socket.io custom** (já no roadmap 5.1) | Controle, custo $0, stack coesa |
| Persistência | **PostgreSQL** (Prisma) + Redis cache | Fonte de verdade relacional, join com Inquiry/Booking |
| Retenção | **Permanente** | Registro comercial, LGPD, analytics |
| Contexto | **Vinculado à Inquiry** | Anti-spam, contexto claro, modelo de negócio |
| MVP scope | Texto + status + notificação | Tudo além disso é backlog |
| Implementar após | Bloco 5.1 (Socket.io gateway) | Reutiliza infraestrutura, não duplica |
