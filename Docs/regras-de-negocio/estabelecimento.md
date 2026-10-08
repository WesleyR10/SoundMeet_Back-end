# Estabelecimento

> Parte das [regras de negócio](../README.md) — o que a API já faz, por domínio.
> Marcações: `[x]` implementado · `[~]` parcial · `[ ]` pendente.

*Seção original: “Domínio Establishment (Estabelecimentos)”.*


**Cadastro, QR Code e tipos de estabelecimento**

- [x] Cadastro de estabelecimento com endereço e tipo (bar, restaurante, etc.)  
       Código: establishment.aggregate.ts ([6]).  
       Regras:
  - `create` valida **apenas `name`, `email` e `establishment_type`** — ver `establishment.validate(["name", "email", "establishment_type"])`. `address` é **opcional** no cadastro.
  - Endereço **não** pertence ao agregado raiz: vive em `EstablishmentProfile`, preenchido depois. `Address` é VO com campos obrigatórios (`street`, `number`, `city`, `state`, `zipCode`) quando informado.
  - `CNPJ` opcional, validado via VO específico (`CNPJ`), **único no banco** e checado antes de tocar o provedor de identidade no registro (`findByCnpj`, Bloco 9.1).

- [x] QR Code permanente do estabelecimento  
       Código: establishment.aggregate.ts ([6]) (`generateQRCode`).  
       Regra: QR grava `https://soundmeet.com.br/local/{id}` (`buildEstablishmentQrLink`).

- [x] Validação de CNPJ com tratamento de erro de domínio  
       Código: establishment.aggregate.ts ([6]).  
       Regra: `changeCnpj` captura `InvalidCNPJError`, adiciona erro de notificação em `cnpj` e evita lançamento de exceção genérica.

**Identidade visual — avatar e capa**

- [x] **Capa (banner) do espaço (10/set/2026)** — `POST /establishments/:id/cover` (multipart, campo
      `file`) e `DELETE /establishments/:id/cover`.
      Código: `upload-establishment-cover.use-case.ts`, `delete-establishment-cover.use-case.ts`.
      Regras:
  - **Duas colunas, não uma.** `cover` é a URL pública; `cover_key` é a chave do objeto no bucket.
    Sem a chave, cada troca de capa deixaria o arquivo anterior órfão e cobrado para sempre — é o
    defeito que `avatar` tem e que `menu_pdfs` (`{ url, key }`) não tem. 🔴 `cover_key` **não sai no
    presenter**: `GET /establishments/:id` é `@Public()` e a chave é endereço interno do storage.
  - **Não existe "capa padrão" como arquivo.** O padrão é o que o cliente desenha quando `cover` é
    `null` (gradiente da marca + waveform). Por isso "voltar ao padrão" é um `DELETE`, não o upload
    de um asset nosso — hospedar um seria pagar storage para servir a todo mundo a mesma imagem que
    o CSS produz de graça.
  - 🔴 **O tipo gravado no storage é o DETECTADO pelos BYTES** (`assertFileSignature`, UPL-1), nunca
    o `Content-Type` do cliente. Um HTML anunciado como `image/png` servido pelo CDN com o
    Content-Type escolhido pelo atacante é XSS armazenado no nosso domínio de mídia.
    Allowlist: `image/jpeg`, `image/png`, `image/webp`. Teto: 4 MB
    (`ESTABLISHMENT_COVER_MAX_SIZE`) — menor que os 5 MB do cardápio porque a capa abre no painel
    **e** na página pública indexada do local.
  - **Chave nova (UUID) a cada upload, nunca `cover.jpg` fixo.** Sobrescrever a mesma chave
    pareceria mais limpo e quebraria o CDN: o CloudFront guarda o objeto pelo caminho, e a capa
    trocada continuaria servindo a antiga até uma invalidação que custa dinheiro e que ninguém
    dispara.
  - **Ordem: gravar a nova → persistir → apagar a antiga, sem relançar.** Apagar antes deixaria a
    página pública com capa quebrada se o `update` falhasse; relançar transformaria "a capa foi
    trocada, mas a faxina falhou" num erro na cara do dono sobre uma operação que deu certo.
  - `DELETE` é **idempotente** — quem não tem capa recebe 200 com `cover: null`, não 404.

- [x] **Foto de perfil (logo) do espaço (18/set/2026)** — `POST /establishments/:id/avatar`
      (multipart, campo `file`) e `DELETE /establishments/:id/avatar`.
      Código: `upload-establishment-avatar.use-case.ts`, `delete-establishment-avatar.use-case.ts`.
      Migration `20260918120000_add_establishment_avatar_key` (aditiva, só a coluna `avatar_key`).
      Regras:
  - 🔴 **Antes disto nada no produto gravava `avatar`.** O único caminho era o `PATCH
    /establishments/:id`, que aceitava a URL como **texto livre de até 500 caracteres, sem validação
    de URL** — e nenhum cliente o usava. O círculo ao lado do nome, em "Meu espaço", era só leitura.
  - **Espelho exato da capa:** par `avatar` (URL) + `avatar_key` (chave no bucket), bytes detectados
    por `assertFileSignature` (JPEG/PNG/WEBP, sem SVG), chave UUID nova a cada upload, ordem gravar →
    persistir → apagar a anterior sem relançar, `DELETE` idempotente, `avatar_key` fora do presenter.
    Teto de **2 MB** (`ESTABLISHMENT_AVATAR_MAX_SIZE`) — metade da capa: a foto aparece em toda
    conversa, lista e cartão, e o painel web já a recorta e reduz para 512×512 antes de enviar.
  - 🔴 **`avatar` SAIU do `UpdateEstablishmentInput`.** Duas portas para o mesmo campo — uma com
    chave, outra sem — fariam o PATCH desligar a chave do objeto que o upload gravou, e o arquivo
    viraria lixo pago no bucket. Com `forbidNonWhitelisted`, quem mandar `avatar` no PATCH recebe
    **422** (nenhum cliente manda — conferido no web e no mobile). A capa nunca esteve no PATCH.
  - ⚠️ **Linhas antigas podem ter `avatar` com `avatar_key` nulo** (URL que não é objeto nosso).
    Upload e remoção tratam isso: a URL é substituída/limpa e o storage **não** é tocado — tratar a
    URL como chave apagaria, na melhor hipótese, nada.
  - `changeAvatar(url, key)` no agregado devolve a chave ANTERIOR, como `changeCover`.

**Avaliações e reputação do estabelecimento**

- [x] Sistema de rating com média ponderada e contagem de avaliações  
       Código: establishment.aggregate.ts ([6]).  
       Regras:
  - 🔴 **`addRating` (e o `EstablishmentRatedEvent` que ele dispara) é código morto.** O caminho real é o ledger `Review` + `syncRatingProjection`, igual ao músico — ver "Domínio Review".
  - Flags derivadas:
    - `isHighlyRated`: rating bom e `total_ratings >= 10`.
    - `isPopular`: `total_ratings >= 50`.
    - `isBar`/`isRestaurant`/`isClub` conforme `establishment_type`.

- [x] Verificação de estabelecimento  
       Código: establishment.aggregate.ts ([6]).  
       Regra: `verify` define `is_verified = true` e dispara `EstablishmentVerifiedEvent`.

**Funcionalidades avançadas para estabelecimentos — o que falta**

- [~] Agenda compartilhada com disponibilidade de músicos e bandas — leitura já existe (`GET scheduling/calendar/free-busy`, `GET scheduling/calendar/month-slots`, ambos `@Public()`); falta o "tempo real" (push via WebSocket)
- [~] Gestão completa de eventos — confirmação de booking, contrato e custódia do cachê existem (ver Scheduling, Contract e Payment); lembrete existe só para quem **segue** o artista/casa (`follow-reminders.job.ts`). Falta lembrete às partes do show
- [~] Módulo de marketing — **campanhas** existem (`src/core/campaign/`, CRUD em `campaign-module`, tela no web). Faltam geração de artes (banner, roadmap 4D.5), cupons e integração com redes sociais
- [ ] Priorização das indicações recebidas por relevância — hoje a caixa de entrada é cronológica.

Já entregues e documentadas nas próprias seções: dashboard de contratação (Musician), avaliações (Review), chat da negociação (abaixo) e caixa de indicações (Indicação de talentos).

## Chat com o artista

A negociação (as duas portas da conversa e a proposta feita dentro dela) está em
[chat-e-negociacao.md](chat-e-negociacao.md).

[6]: ../../src/core/establishment/domain/establishment.aggregate.ts