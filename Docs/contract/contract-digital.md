# Contrato Digital de Show — arquitetura do subsistema

> **Fonte única** do domínio `contract`. Todo show confirmado na plataforma gera
> automaticamente um contrato adaptado àquele artista, àquele local e àquele valor; as duas partes
> assinam eletronicamente pelo canal que já usam; o documento fica congelado, com hash de
> integridade e página pública de verificação.

**Código:** `src/core/contract/` · `src/nest-modules/contract-module/`
**Revisão jurídica:** [legal-checklist.md](legal-checklist.md) — leia antes de emitir em produção
**Roadmap:** Bloco 10 em [../roadmap.md](../roadmap.md) · Regras em [../business-rules.md](../business-rules.md)

---

## 1. Por que existe

Três motivos, em ordem de peso:

1. **Prova documental contra chargeback.** É a camada 1 das cinco listadas em
   [payment-gateway-decisions.md](../payment-gateway-decisions.md#camadas-de-proteção-implementadas).
   Sem contrato assinado, uma disputa de "não reconheço" em contexto B2B é decidida no escuro.
2. **Anti-calote nas duas direções.** Cachê não pago e show não cumprido são o par de problemas que
   o músico e o bar trazem para a plataforma. Um documento com valor, data, duração e multa de
   cancelamento resolve a discussão antes dela existir.
3. **Profissionalização da negociação.** É o que separa "combinei no WhatsApp" de um instrumento
   que descreve estrutura de palco, janela de passagem de som e alocação de ECAD.

O contrato **não toca em dinheiro**, e essa foi a razão de ele vir antes do escrow: entrega valor
sozinho, com risco regulatório zero. Escrow sem contrato assinado seria a pior combinação possível —
custódia de recursos de terceiros sem documento probatório.

---

## 2. A decisão que mais moldou o desenho: o catálogo é código, não banco

O desenho original previa `ContractClause`, `ClauseVariant` e `ContractTemplate` como agregados com
repositório. **Foi recusado**, e a razão é substantiva:

Quem edita texto de cláusula não é o estabelecimento nem o músico — é a SoundMeet, com advogado.
Texto jurídico precisa de revisão antes de entrar em produção, e precisa ser enviado
**atomicamente com o código que resolve suas variáveis**. Com as cláusulas em banco, três coisas
ruins acontecem: nasce um CRUD administrativo que ninguém usa; toda correção de redação vira
migration; e passa a ser possível alterar texto legal em produção sem revisão.

Com o catálogo em código:

| Ganho | Como |
|---|---|
| Revisão jurídica = code review | O diff do PR mostra a redação exata que mudou |
| Redação não muda em silêncio | Teste de snapshot por variante; alteração quebra o CI |
| Sem bug de template | `body` é **função pura de variáveis tipadas**, não string com `{{}}` — variável renomeada é erro de compilação, e não existe classe de bug de escaping |
| Zero migration para texto | Cláusula é arquivo `.ts` |

**A imutabilidade do emitido continua garantida onde importa:** o `Contract` guarda o **snapshot
congelado das cláusulas já renderizadas**. O catálogo só é consultado para *construir* um contrato
novo; um contrato de 2026 renderiza igual para sempre porque não depende mais do catálogo.

Trade-off honesto: mudar redação exige deploy. Para conteúdo jurídico, isso é vantagem. E se um dia
as cláusulas precisarem ser editáveis, `IClauseCatalog` é uma interface — uma implementação que lê
de banco entra sem tocar no domínio.

**O único agregado persistido é `Contract`.**

---

## 3. Estrutura

```
src/core/contract/
  domain/
    contract.aggregate.ts          # ÚNICO agregado persistido — imutável por construção
    contract.repository.ts         # IContractRepository + Filter + SearchParams (com override do setter)
    contract.validator.ts
    contract-fake.builder.ts
    contract-types.ts              # consts `as const` + types
    contract-format.ts             # moeda, data no fuso, valor por extenso
    value-objects/
      contract-party.vo.ts         # qualificação congelada de uma parte
      contract-signature.vo.ts     # trilha de uma assinatura
      contract-variables.vo.ts     # os dados que as cláusulas consomem
      rendered-clause.vo.ts        # cláusula já renderizada (texto final)
    catalog/
      clause.types.ts              # ClauseDefinition, ClauseVariant, ClauseApplicability, ContractContext
      clause-catalog.ts            # matchesApplicability + selectVariant + ClauseCatalog
      clause-helpers.ts
      clauses/                     # 23 cláusulas em 8 arquivos por categoria
      templates/show-contract-v1.ts
    events/                        # ContractIssuedEvent, ContractSignedEvent, ContractAnnulledEvent
  application/
    ports/
      contract-renderer.port.ts    # IContractRenderer
      contract-storage.interface.ts# IContractStorage — SEM getPublicUrl, ver §8
      contract-signature-provider.port.ts
    use-cases/                     # issue, sign, get, get-document, list, verify, annul
  infra/
    db/in-memory/ · db/prisma/
    renderer/                      # ReactPdfContractRenderer + contract-pdf.document.tsx
    signature/internal-signature.provider.ts
    storage/s3-contract.storage.ts

src/nest-modules/contract-module/
  contracts.controller.ts              # rotas autenticadas
  contract-verification.controller.ts  # rota @Public() isolada — ver §9
  contract-issuance.handler.ts         # @OnEvent(BookingConfirmedEvent)
  contract.presenter.ts · contract.providers.ts · dto/ · __tests__/
```

`ContractModule` é **nó-folha**: `scheduling` não conhece `contract`. A ligação é o evento de
domínio, não uma dependência.

---

## 4. O agregado `Contract`

**Imutável por construção — não existe mutador de conteúdo, só de status e assinatura.** As partes,
as cláusulas renderizadas e as variáveis entram no construtor e nunca mudam.

| Campo | Papel |
|---|---|
| `template_version` | Qual template gerou. Permite renderizar contrato antigo para sempre |
| `parties` (Json) | Snapshot da qualificação das duas partes no momento da emissão |
| `clauses` (Json) | Snapshot das cláusulas **já renderizadas** — texto final, não referência ao catálogo |
| `variables` (Json) | Os dados que produziram aquele texto |
| `signatures` (Json) | Trilha de cada assinatura |
| `content_hash` | SHA-256 do conteúdo congelado |
| `verification_code` | Código curto e único da página pública |

**Status** (`enum ContractStatus` no Prisma — é máquina de estado de domínio, por isso enum e não
String): `issued` → `partially_signed` → `signed`, e `annulled` como saída lateral.

### O `content_hash` não é decoração

`ContractModelMapper.toEntity` **recalcula o hash na carga** e recusa contrato cujo conteúdo não
bate com o hash gravado (`LoadEntityError`). Sem isso, publicar o hash na página de verificação
seria teatro: um `UPDATE` direto no banco mudaria o texto e o hash continuaria batendo com o que
está gravado ao lado.

### FKs

`booking` e `establishment` com `Restrict`; `musician` e `band` com `SetNull`. Apagamento por LGPD
zera o ponteiro e **o snapshot preserva a prova** — que é o ponto de guardar a qualificação
congelada em vez de fazer join.

---

## 5. O catálogo de cláusulas

**23 cláusulas (18 obrigatórias, 5 opcionais) em 38 variantes**, distribuídas em 8 categorias:

| Categoria | Cláusulas |
|---|---|
| `objeto` | `objeto` |
| `prazo` | `data_horario_duracao` |
| `preco` | `cache_pagamento` |
| `estrutura` | `passagem_som`, `estrutura_tecnica`, `camarim_alimentacao` *(opcional)* |
| `cancelamento` | `cancelamento_remarcacao`, `caso_fortuito` |
| `responsabilidade` | `direitos_autorais_ecad`, `licencas_seguranca`, `equipamentos_danos`, `tributos` |
| `obrigacoes` | `ausencia_vinculo`, `substituicao_integrantes` *(opcional)*, `conduta` *(opcional)* |
| `direitos` | `direito_imagem`, `exclusividade_raio` *(opcional)*, `lgpd` |
| `gerais` | `assinatura_eletronica`, `papel_da_plataforma`, `resolucao_conflitos_foro`, `disposicoes_gerais` |

**Toda cláusula declara `legal_note`** — a âncora legal e o motivo de existir, em português, no
próprio arquivo. São 22 notas, e é o que faz a revisão com advogado ser leitura de código em vez de
arqueologia.

### Como uma variante é escolhida

`ContractContext` descreve o show; `ClauseApplicability` descreve quando uma variante serve.
`selectVariant` filtra por aplicabilidade e depois escolhe pelo tom pedido, caindo para o tom
padrão.

Eixos do contexto: `target` (músico/banda) · `fee` · `has_stage_tech_spec` ·
`has_soundcheck_window` · `uses_escrow` · `outdoor` · `exclusivity_requested` ·
`contractor_is_company` · `contracted_is_company` · `tone`.

> ⚠️ **Aplicabilidade tem que ser mutuamente exclusiva dentro da mesma cláusula e do mesmo tom.**
> `selectVariant` faz `filter` e pega a primeira do tom — duas variantes que casam no mesmo contexto
> não dão erro, dão a *primeira*, em silêncio. Foi por isso que, ao entrar `contracted_is_company`,
> as duas variantes antigas de `tributos` passaram a declarar `contracted_is_company: false`
> explicitamente.

### O eixo que tem consequência fiscal

`tributos` tem **três** variantes, e não é simetria decorativa:

| Variante | Quando | O que diz |
|---|---|---|
| `tributos.contratado_pj.formal` | músico com CNPJ de MEI | **Não há** retenção previdenciária; ele emite nota e recolhe pelo DAS |
| `tributos.contratante_pj.formal` | bar PJ × músico PF | O contratante retém na fonte |
| `tributos.contratante_pf.formal` | bar PF × músico PF | Cada um recolhe o seu — **costura**, ver §11 |

A retenção previdenciária na fonte alcança o **contribuinte individual** (art. 4º da Lei
10.666/2003). MEI é pessoa jurídica e não é contribuinte individual nessa relação — mandar o bar
reter INSS dele seria instruir retenção indevida num documento feito para ser seguido.

---

## 6. Emissão

Reativa: `ContractIssuanceHandler` escuta `BookingConfirmedEvent`. **Não bloqueia o show** — o
booking vai a `confirmed` com ou sem contrato, e as duas UIs mostram o estado.

`IssueContractUseCase` devolve uma união:

```ts
| { issued: true;  contract: ContractOutput }
| { issued: false; missing: string[] }
```

### Pendência de qualificação, não "emitir torto"

Emitir com "não informado" produziria papel fraco; bloquear a confirmação do booking quebraria os
fluxos de web e mobile já entregues. A saída é a terceira: **não emitir, dizer exatamente o que
falta, e oferecer a correção.** As chaves são estáveis e a UI monta a frase, porque é ela que sabe
para onde mandar o usuário:

| Chave | Falta |
|---|---|
| `contratante.cnpj` | CNPJ do estabelecimento |
| `contratante.representante_legal` | Nome **e** CPF de quem assina pela PJ |
| `contratante.perfil` / `contratante.endereco` | Perfil ou endereço do estabelecimento |
| `booking.cache` | Cachê do booking (contrato sem valor não é contrato) |
| `contratado.cpf` | CPF **ou** CNPJ do músico — MEI que só tem CNPJ está qualificado |
| `contratado.lider_da_banda` / `contratado.cpf_do_lider` / `contratado.integrantes` | Banda sem líder, líder sem CPF, banda sem membro aceito |

`POST /contracts/issue` é a retentativa depois de sanar a pendência. A emissão é **idempotente**:
evento reentregue não cria segundo contrato.

### Qualificação das partes

Tudo **derivado**, nunca fixo:

- **Contratante:** `kind` vem de `establishment.cnpj !== null`. Hoje sempre dá `company` (não
  existe campo de CPF em `Establishment`), mas derivar em vez de fixar é o que faz a cláusula de
  tributos escolher sozinha a redação certa no dia em que a plataforma aceitar estabelecimento
  pessoa física — muda o cadastro, não o contrato.
- **Representante legal:** vem do cadastro (`legal_representative_name` + `_document`).
  🔴 **Nunca derivado do CNPJ.** Uma versão anterior compunha o CPF do representante com os 11
  primeiros dígitos do CNPJ, porque o VO exigia representante para PJ — isso é **fabricar documento**
  num instrumento cuja única razão de existir é provar fatos, e o erro passaria despercebido até
  alguém conferir. Hoje o campo é opcional no VO e o documento diz a verdade quando não há dado.
- **Contratado solo:** `kind` vem de `musician.cnpj !== null`. MEI é qualificado como PJ, com o
  CNPJ no papel — é o que faz o contrato bater com a nota que ele emite. `legal_name` continua
  sendo o nome civil de propósito: a razão social do MEI **é** o nome da pessoa.
- **Contratado banda:** sempre o líder **pessoa física**, mesmo que ele tenha MEI. O MEI é dele,
  não da banda; faturar o cachê inteiro pelo CNPJ pessoal cria um repasse entre integrantes que
  nenhuma cláusula descreve e pode estourar o teto do MEI. Banda com CNPJ próprio é fatia futura.
- **Integrantes:** vão **nomeados** (`findByIds` resolvendo `stage_name ?? name`). "Contratei o
  Trio Maré" sem dizer quem toca é o que permite trocar a banda inteira no dia e discutir depois.

---

## 7. Assinatura

Própria, atrás de `IContractSignatureProvider`. Base legal: **MP 2.200-2/2001, art. 10, §2º** —
documento eletrônico assinado por meio diverso do ICP-Brasil é válido **desde que admitido como
válido pelas partes**. Daí duas exigências de implementação, não de redação:

1. **Cláusula de reconhecimento** (`assinatura_eletronica`) é `required: true` no catálogo. Sem ela
   a base legal da assinatura própria fica frágil.
2. **Autoria e integridade demonstráveis:** identidade autenticada pelo Keycloak, aceite explícito,
   timestamp do servidor, IP, user-agent e `content_hash`.

**A âncora de identidade é `signer_user_id`, não o documento declarado no cadastro.** O cadastro diz
quem *deveria* assinar; a trilha diz quem assinou.

### Segundo fator (ago/2026)

A conta autenticada prova que **alguém com a senha entrou**; não prova **quem**. Por isso assinar
tem dois passos:

1. `POST /contracts/:id/sign/challenge` — envia um código de 6 dígitos ao **e-mail congelado da
   parte no contrato** (nunca ao cadastro atual, nunca a um destino vindo do corpo);
2. `POST /contracts/:id/sign` com `challenge_code`.

🔴 **O código nunca entra na resposta HTTP.** A rota devolve só o destino mascarado
(`a****@exemplo.com`) e o vencimento. Devolvê-lo anularia o segundo fator: quem já tem o token da
conta o leria ali mesmo. O `SignatureChallengePresenter` é allowlist justamente para que incluí-lo
exija uma linha deliberada.

`CacheSignatureChallengeProvider` guarda o **hash** do código (dump do Redis não revela código
vivo), compara em tempo constante, expira em 10 minutos, aceita **5 tentativas** e é **de uso
único** — sucesso apaga o registro, então replay de requisição capturada não assina de novo. A chave
inclui contrato + papel + signatário: o código do contratante não assina pelo contratado.

⚠️ **TTL em milissegundos** (`cache-manager` 5+), com teste dedicado — 600 em vez de 600000 daria um
código que expira em 0,6s, e o sintoma não aponta para a unidade.

O consumo acontece **depois** da autorização e **antes** da captura da assinatura: um terceiro não
consegue queimar o código da parte legítima, e não existe janela em que a assinatura exista sem o
código ter sido conferido.

Regras: papel derivado do JWT (nunca do corpo) por `resolveSigningRole`, **compartilhado** entre
emitir e assinar para os dois não divergirem; em banda, **só o líder** assina; segunda assinatura do
mesmo lado → 422; quem não é parte → 403; membro de banda **lê** sem ser líder.

O que a assinatura própria **não** entrega, e o contrato diz com honestidade: sem duas testemunhas
nem certificado ICP-Brasil, o documento **não é título executivo extrajudicial** (CPC art. 784,
III). É prova escrita, o que habilita **ação monitória** (CPC art. 700). Prometer "força de título
executivo" na UI seria falso.

---

## 8. Documento e armazenamento

`ReactPdfContractRenderer` (`@react-pdf/renderer`) gera o PDF; o teste gera um PDF de verdade,
com acentuação, porque um mock não provaria a interoperabilidade que era o risco declarado.

> **`@react-pdf/renderer` × CommonJS:** funciona no runtime (Node 22 faz `require(esm)` nativo) mas
> quebrava no Jest. Resolvido com `transformIgnorePatterns` cirúrgico.

### 8.1 O Anexo I mora no snapshot — e por que isso importa (16/ago/2026)

O Anexo I é a Ficha Técnica do Palco (A3) incorporada ao contrato. A cláusula
`estrutura_tecnica.com_anexo` diz que ele "integra este instrumento para todos os fins" e que **a
ausência, no dia da apresentação, de item nele declarado constitui inadimplemento do CONTRATANTE**.

Até esta data o anexo era impresso no PDF, mas chegava ao renderer por um campo próprio da porta,
lido do **perfil vivo** do estabelecimento — portanto **fora do `content_hash`**. Consequência: o bar
editava a ficha, o contrato era reemitido, o Anexo I saía diferente e o resumo criptográfico era o
mesmo. A parte do documento que cria obrigação era a única fora da verificação de integridade — e o
painel web não conseguia sequer exibi-la, porque o dado não estava no snapshot.

Hoje o anexo é `variables.ficha_tecnica_anexo`, congelado na emissão sob a **mesma condição** que
seleciona a variante da cláusula. `ContractRenderInput` **não tem mais** `stage_tech_spec`: duas
fontes para o mesmo conteúdo foram o que permitiu a divergência, e remover a segunda torna o erro
impossível por construção em vez de proibido por convenção.

> 🔴 **A chave é AUSENTE quando não há ficha — nunca `null`.**
> `JSON.stringify` omite `undefined` e inclui `null`; o mapper **recalcula o hash na carga** e
> recusa contrato divergente. Um `null` aqui faria **todo contrato já assinado** parar de carregar
> com `LoadEntityError`. O construtor de `ContractVariables` apaga a chave para qualquer valor que
> não seja objeto, e `contract-variables.vo.spec.ts` trava a invariante — inclusive os casos `null`
> e array. É o mesmo cuidado exigido de qualquer chave nova que venha a entrar no snapshot.

Nenhum corpo de cláusula mudou, então **não houve `show-v2`** e os 38 snapshots seguem intactos. Os
rótulos do anexo são espelhados em `soundmeet-web/.../stage-spec-rows.ts`, com teste de paridade nos
dois projetos: divergir em rótulo ou ordem faria as duas partes lerem documentos diferentes.

### `IContractStorage` não tem `getPublicUrl` — e isso é a feature

Não é omissão. O documento carrega CPF, CNPJ, endereço e valor de cachê. **Sem função que produza
URL pública, vazar contrato por engano fica impossível por construção.** A leitura é
`GET /contracts/:id/document`, que autoriza e faz stream. Um bucket público desfaria isso — está
avisado em `envs/.env.example`.

Envs: `CONTRACT_STORAGE_PROVIDER` · `CONTRACT_STORAGE_BUCKET` · `CONTRACT_VERIFICATION_BASE_URL` ·
`CONTRACT_ISSUER_LEGAL_NAME` · `CONTRACT_ISSUER_DOCUMENT`.

### Entrega às partes (ago/2026)

Na emissão e quando a segunda assinatura fecha o contrato, `ContractDeliveryHandler` dispara o
e-mail com o **PDF anexo** e o **hash no corpo** para as duas partes — no e-mail congelado de cada
uma. É a camada 4 de proteção contra chargeback e a resposta a uma fragilidade real: enquanto o
documento existe só no nosso storage e a trilha só no nosso banco, somos parte interessada
guardando a própria prova. Uma cópia na caixa de cada parte, com o carimbo do provedor de e-mail, é
a primeira evidência que não depende de acreditar em nós.

**O hash vai no corpo, não só dentro do PDF.** Hash impresso apenas no anexo prova pouco: se o
arquivo foi adulterado, o hash dentro dele foi junto.

Três decisões de robustez:

- **Nada estoura.** O handler corre sobre evento de domínio, com o contrato já persistido. Uma falha
  de e-mail não pode desfazer a emissão nem derrubar outros ouvintes — o e-mail é reforço
  probatório, não condição de validade.
- **Mas nada some em silêncio.** `NotifyContractPartiesUseCase` **relata** quem recebeu e quem não,
  e o handler loga com `contract_id`, papel e motivo. O `MailService.send` privado engole erro e só
  loga; os dois métodos de contrato (código e documento) **não passam por ele** de propósito.
- **A falha é recuperável pela parte**, não só visível no log: `POST /contracts/:id/document/send`
  reenvia — e **só para o lado de quem pediu**, com o papel derivado do agregado dentro do use-case.

Uma parte falhar não impede a outra: as entregas são independentes.

---

## 9. Rotas

Prefixo global `api/v1`.

| Rota | Autorização |
|---|---|
| `GET /contracts` | Escopado pelo token (OR contra os 3 lados), **fail-closed** |
| `GET /contracts/:contract_id` | Quem é parte — membro de banda lê sem ser líder |
| `GET /contracts/:contract_id/document` | Stream autorizado do storage privado |
| `POST /contracts/:contract_id/sign/challenge` | Envia o código à parte; resposta sem o código |
| `POST /contracts/:contract_id/document/send` | Reenvia a cópia **só para quem pediu**; papel derivado dos claims |
| `POST /contracts/:contract_id/sign` | Papel derivado do JWT; exige `challenge_code`; em banda, só o líder |
| `POST /contracts/issue` | Retentativa após sanar pendência — **quem é parte**, checado dentro do use case antes de qualquer efeito. Corpo carrega **só** `booking_id` |
| `POST /contracts/:contract_id/annul` | Admin, e **nunca** de contrato assinado |
| `GET /contracts/verify/:code` | `@Public()` — payload mínimo, nomes mascarados |

> 🔴 **A emissão autoriza na ENTRADA, não na saída.** Até 19/ago/2026 o controller repassava o DTO
> cru e só filtrava a leitura do resultado — quando o contrato alheio já tinha nascido, o PDF já
> estava no storage e o `ContractIssuedEvent` já tinha mandado o documento por e-mail às duas
> partes. Hoje `IssueContractInput.requesting_participant_ids` é **obrigatório e nulável**: `null` é
> o caminho do sistema (`ContractIssuanceHandler`), declarado em código, e é o único que pula a
> checagem. Lista vazia é barrada explicitamente — `assertNegotiationViewer` pularia, por convenção
> dos jobs internos, e isso seria fail-open para todo token sem claim. Ver `roadmap.md` §10E.

> ⚠️ **Duas coisas de ordem que quebram em silêncio.**
> `@Get(":contract_id")` vem **depois** de `@Get()` e **antes** dos `@Post` — o Express casa por
> ordem de declaração. E a rota pública mora em **controller separado**
> (`contract-verification.controller.ts`): um `@Public()` solto no meio de um controller com
> `@UseGuards` é a receita de expor rota autenticada sem querer.

A verificação pública devolve o mínimo: código, status, `content_hash`, data do show e os nomes
**mascarados** (`"Ana Ribeiro"` → `"Ana R."`). Quem tem o PDF em mãos confirma que é o contrato
certo; quem só tem o código não colhe nome completo de ninguém.

---

## 10. Testes

O teste que mais importa é o do catálogo — é ele que garante que **nenhuma combinação real produz
documento com buraco**:

- **1728 contextos** (2 alvos × 3 faixas de cachê × 3 combinações de ficha × 2 escrow × 2 ao ar
  livre × 2 exclusividade × 2 contratante PJ × 2 contratado PJ × 3 tons): toda cláusula obrigatória
  resolve em todos, e nenhum texto sai com `undefined`, `NaN` ou `[object Object]`.
- **Proxy sobre as variáveis** anota cada chave lida pelo corpo da cláusula e compara com o
  `consumes` declarado **nos dois sentidos** — `consumes` não pode envelhecer.
- **Snapshot por variante (37)** — mudança de redação jurídica não passa silenciosa no CI.
- **Tetos legais como asserção:** multa ≤ 100% do cachê, exclusividade dentro do cap de km e dias.
- **Nenhuma variante inalcançável** (ver a exceção documentada em §11).
- `conduta` só existe no tom rigoroso, e há teste provando que ela **não vaza** para contrato
  formal — foi o que barrou um fallback genérico na seleção de variante.

Fora do catálogo: emissão idempotente, pendência de qualificação, **autorização da emissão** (8 casos,
incluindo "recusa sem criar contrato, subir PDF ou renderizar"), autorização de assinatura, `annul` de
assinado → 422, hash estável entre duas emissões do mesmo contexto, regressão do override de
`SearchParams.filter` (busca de um estabelecimento não devolve contrato de outro), e um `int-spec` que
sobe o módulo e exercita as rotas.

⚠️ **Este parágrafo já mentiu.** Dizia "prova que as 7 rotas existem" enquanto `POST /contracts/issue`
e `POST /contracts/:id/annul` não tinham um único teste — e `issue` era justamente a rota sem
autorização. Um spec de DTO (`contract-module/dto/__tests__/issue-contract.dto.spec.ts`) roda o
`ValidationPipe` com as **mesmas opções** de `applyGlobalConfig` e prova que o corpo não injeta
identidade nem exclusividade: o controller faz `...dto`, então o whitelist é o que separa o corpo da
regra.

---

## 11. Armadilhas registradas (não repetir)

- **Autorizar na saída não é autorizar.** Em rota que escreve, a checagem vem antes do **primeiro
  efeito**, não antes do `return`. Filtrar o resultado da emissão parecia seguro e não era.
- **Campo de autorização opcional é campo esquecido.** `requesting_participant_ids` obrigatório e
  nulável transforma a omissão em erro de compilação; `?:` a transformaria em silêncio.
- **Nunca fabricar documento.** Nem CPF derivado de CNPJ, nem razão social inventada, nem endereço
  chutado. Quando o dado não existe, o documento **diz que não existe** (`"Endereço não informado"`,
  `"representante legal identificado no Anexo II"`) ou a emissão vira pendência. Fabricar é a única
  falha deste subsistema que ninguém percebe até o dia em que alguém confere.
- **`SearchParams.filter` exige override na subclasse** — sem ele o repositório monta `where: {}` e
  devolve contrato de todos os estabelecimentos. Regra geral do projeto, aplicada aqui.
- **Aplicabilidade não-exclusiva escolhe a primeira, sem erro.** Toda variante nova precisa fechar
  os eixos que as irmãs abrem.
- **`RenderedClause` reflui o texto.** As quebras de linha do arquivo `.ts` existem para o código,
  não para o documento: linha em branco separa parágrafo, quebra interna vira espaço. Sem isso o
  PDF sai com parágrafos esfarrapados.
- **`tributos.contratante_pf` é costura, não opção viva.** Nenhum contrato real a seleciona hoje
  (não existe estabelecimento PF na plataforma). Ela fica pronta para o dia em que existir. É uma
  violação consciente da regra "nenhuma variante inalcançável": apagar texto jurídico já escrito e
  revisado para satisfazer pureza de código sairia mais caro. Está dito no `legal_note` dela.

---

## 12. O que ainda não existe

| Item | Estado |
|---|---|
| ~~**B3 — Web**~~ | ✅ **Concluído em 16/ago/2026** — feature `contract` em `soundmeet-web`: lista, detalhe com documento em HTML nativo + índice com scroll-spy, assinatura em dois passos, downloads, reenvio, pendência acionável e `/contrato/[codigo]` (`noindex`, fora do sitemap) |
| ~~🔴 **Anexo I fora do `content_hash`**~~ | ✅ **Corrigido em 16/ago/2026** — ver §8.1. O anexo passou a viver em `variables.ficha_tecnica_anexo`, congelado; o campo `stage_tech_spec` saiu da porta do renderer |
| ~~**B4 — Mobile**~~ | ✅ **Concluído em 19/ago/2026** — feature `contract` em `soundmeet-mobile`: lista (que é a agenda de shows fechados), detalhe renderizando o snapshot nativamente, assinatura em dois passos com trava de leitura, Anexo I via `StageTechSpecSection` e entrega do PDF por e-mail em vez de arquivo local |
| **E-mails** de contrato emitido/assinado com PDF anexo | Camada 4 de proteção contra chargeback — saiu do escopo da B2 |
| **Escrow (F1.3a)** | Único ponto de contato: ligar `uses_escrow: true` no contexto e preencher `custodiante_nome`. A variante `cache_pagamento.com_custodia` e a cláusula `custodia_liberacao` já existem e descrevem o fluxo acordado — pagamento integral antecipado, custódia em instituição de pagamento, liberação após a apresentação —, então ligar o escrow **não reescreve cláusula nenhuma**. 🔴 Depende da decisão de custódia — ver [payment-gateway-decisions.md](../payment-gateway-decisions.md) |
| **Banda com CNPJ próprio** | Hoje a banda contrata pelo líder PF |
| **Endereço estruturado do músico** | `Musician` não tem endereço; o documento declara "não informado" em vez de inventar |
