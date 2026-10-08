# Contrato digital de show

> Parte das [regras de negócio](../README.md) — o que a API já faz, por domínio.
> Marcações: `[x]` implementado · `[~]` parcial · `[ ]` pendente.

*Seção original: “Domínio Contract (Contrato Digital de Show)”.*


> Todo show confirmado gera automaticamente um contrato adaptado àquele artista, àquele local e
> àquele valor. O documento é **congelado** na emissão, tem hash de integridade e página pública de
> verificação. A plataforma **não é parte**.
>
> Arquitetura: [funcionalidades/contrato-digital.md](../funcionalidades/contrato-digital.md) · Revisão jurídica:
> [_privado/juridico/checklist-juridico-do-contrato.md](../_privado/juridico/checklist-juridico-do-contrato.md)

## Catálogo de cláusulas
- [x] **O catálogo é código, não banco.** 23 cláusulas (18 obrigatórias, 5 opcionais) em 38 variantes, em `src/core/contract/domain/catalog/clauses/`. Revisão jurídica vira **code review**, e um teste de snapshot por variante impede que redação mude em silêncio no CI.
- [x] `body` é **função pura de variáveis tipadas**, não template com `{{}}` — variável renomeada é erro de compilação, e não existe classe de bug de escaping.
- [x] Toda cláusula declara `legal_note` com a âncora legal e o motivo de existir. São 22 notas, no próprio arquivo.
- [x] O `consumes` declarado por variante é comparado com o que o corpo realmente lê, **nos dois sentidos**, via Proxy no teste — `consumes` não envelhece.
- [x] **1728 contextos** varridos no teste: toda cláusula obrigatória resolve em todos, e nenhum texto sai com `undefined`, `NaN` ou `[object Object]`.
- [x] ⚠️ **Aplicabilidade tem que ser mutuamente exclusiva** dentro da mesma cláusula e do mesmo tom. `selectVariant` faz `filter` e pega a primeira — duas variantes que casam no mesmo contexto não dão erro, dão a *primeira*, em silêncio.
- [x] `conduta` só existe no tom rigoroso (regra de conduta detalhada aproxima a relação de subordinação) e há teste provando que **não vaza** para contrato de tom formal.
- [x] `camarim_alimentacao` só entra acima de R$ 500 de cachê — cláusula que ninguém cumpre enfraquece o documento inteiro.

## Tetos legais como invariante de código
- [x] Multa de cancelamento **≤ 100% do cachê** (CC art. 412; art. 413 permite redução judicial). Validado em `ContractVariables`, não só escrito: multa acima disso é cláusula nula, e cláusula nula é pior que cláusula ausente.
- [x] Exclusividade com **teto duro de km e de dias** (`assertExclusivityWithinLegalCap`) — restrição à liberdade profissional (CF art. 5º, XIII) só se sustenta limitada em tempo, espaço e atividade. Opcional e ausente por padrão.
- [x] Uso de imagem sempre com finalidade, prazo e território preenchidos (CC art. 20).
- [x] Foro = **comarca do local do show** (CPC art. 63), nunca a sede da plataforma, que não é parte.
- [x] A janela de cancelamento gratuito vem de `Booking.free_cancellation_hours`, **nunca** de constante do catálogo.

## Emissão
- [x] Reativa: `ContractIssuanceHandler` escuta `BookingConfirmedEvent`. **Não bloqueia o show** — o booking vai a `confirmed` com ou sem contrato.
- [x] `ContractModule` é **nó-folha**: `scheduling` não conhece `contract`.
- [x] **Idempotente** — evento reentregue não cria segundo contrato.
- [x] **Qualificação incompleta não emite contrato torto:** o use-case devolve `{ issued: false, missing: [...] }` com chaves estáveis (`contratante.cnpj`, `contratante.representante_legal`, `contratado.cpf`, `booking.cache`, …) e a UI monta a frase, porque é ela que sabe para onde mandar o usuário corrigir. `POST /contracts/issue` é a retentativa.
- [x] 🔴 **Só quem é parte do show emite** *(19/ago/2026)* — checado **antes do primeiro efeito**, e não sobre o resultado. `requesting_participant_ids` é obrigatório e nulável no input: `null` é o caminho do sistema (`ContractIssuanceHandler`), declarado em código, e lista vazia é recusada em vez de pular a checagem. Vale para os dois ramos: emitir de fato **e** consultar a pendência de qualificação, que de outro modo seria um oráculo do estado cadastral alheio. Membro de banda não-líder **pode** disparar (`assertNegotiationViewer`): emitir é retentativa, não ato vinculante — quem se obriga é quem assina.
- [x] **A retentativa manual carrega só o `booking_id`.** `tone`, `outdoor` e `exclusivity_requested` existem no input mas saem do DTO HTTP por `OmitType`: exclusividade é opt-in com tetos legais e não cabe num botão de "tentar de novo", e o tom escolhe a redação que a **outra** parte vai assinar. Quem os preenche é a emissão automática.
- [x] 🔴 **Nenhum documento é jamais fabricado.** O CPF do representante legal **não** é derivado do CNPJ (uma versão anterior compunha com os 11 primeiros dígitos) — vem do cadastro, ou o contrato não é emitido. Endereço que o músico nunca informou sai como "não informado" em vez de inventado.
- [x] Natureza das partes é **derivada, nunca fixa**: `contractor_is_company` de `establishment.cnpj !== null`, `contracted_is_company` de `musician.cnpj !== null`. No dia em que o cadastro aceitar estabelecimento PF, a cláusula de tributos escolhe sozinha a redação certa — muda o cadastro, não o contrato.
- [x] **Músico MEI é qualificado como pessoa jurídica**, com o CNPJ no papel — é o que faz o contrato bater com a nota que ele emite. `legal_name` continua sendo o nome civil: a razão social do MEI *é* o nome da pessoa.
- [x] **Banda contrata pelo líder pessoa física**, mesmo que ele tenha MEI: o MEI é dele, não da banda, e faturar o cachê inteiro pelo CNPJ pessoal cria um repasse que nenhuma cláusula descreve e pode estourar o teto do MEI.
- [x] Integrantes vão **nomeados** no objeto (`findByIds`, `stage_name ?? name`) — "contratei o Trio Maré" sem dizer quem toca é o que permite trocar a banda inteira no dia.
- [x] Retenção previdenciária **não** se aplica a contratado MEI (art. 4º da Lei 10.666/2003 alcança o contribuinte individual) — variante própria de `tributos`, senão o contrato mandaria o bar fazer retenção indevida.
- [x] O cachê é declarado **BRUTO**, com o líquido e o comprovante de retenção descritos. Sem isso o contrato dizia "R$ 1.500" e a cláusula de tributos dizia "o contratante reterá" — ninguém sabia quanto o músico recebia.

## Imutabilidade e integridade
- [x] O agregado é **imutável por construção** — não existe mutador de conteúdo, só de status e assinatura.
- [x] O contrato guarda o **snapshot congelado das cláusulas já renderizadas**. O catálogo só é consultado para *construir*; um contrato de 2026 renderiza igual para sempre.
- [x] O mapper **recalcula o `content_hash` na carga** e recusa contrato adulterado no banco (`LoadEntityError`). Sem isso, publicar o hash na página de verificação seria decoração.
- [x] 🔴 **Objeto aninhado no snapshot passa por VO de ordem fixa** *(14/set/2026)*. A coluna é `jsonb`, que reordena chaves, e o hash é `JSON.stringify`: o Anexo I (`ficha_tecnica_anexo`) guardado verbatim fazia **todo contrato de casa com ficha técnica** falhar na carga logo depois de emitido. `ContractVariables` normaliza por `StageTechSpec.fromJSON().toJSON()` — a mesma ordem da emissão, então nenhum hash gravado mudou.
- [x] FKs: `Restrict` em booking/establishment, `SetNull` em musician/band — apagamento por LGPD zera o ponteiro e **o snapshot preserva a prova**.
- [x] Status como enum Prisma (`issued` → `partially_signed` → `signed`, `annulled` como saída lateral) — é máquina de estado de domínio.

## Assinatura
- [x] Própria, atrás de `IContractSignatureProvider`. Válida entre as partes pela **MP 2.200-2/2001, art. 10, §2º**, que exige admissão expressa — daí a cláusula `assinatura_eletronica` ser obrigatória e sem variante.
- [x] Trilha: conta autenticada pelo Keycloak, aceite explícito, timestamp do servidor, IP, user-agent e hash.
- [x] **A âncora de identidade é `signer_user_id`, não o documento do cadastro.** O cadastro diz quem *deveria* assinar; a trilha diz quem assinou. *(19/ago/2026)* O campo passou a ser **obrigatório** no input: os dois use-cases faziam `?? ""` e a âncora degradava para string vazia em silêncio — no exato documento que existe para provar quem assinou, e com a chave do desafio (que inclui o signatário) virando balde compartilhado entre pessoas do mesmo papel.
- [x] **Segundo fator por código de uso único** enviado ao e-mail **congelado** da parte — a conta autenticada prova que alguém com a senha entrou, não quem. O código nunca volta na resposta HTTP: ela traz só o destino mascarado e o vencimento. 10 min de validade, 5 tentativas, uso único, e pedir outro invalida o anterior.
- [x] **O código é guardado como HMAC com segredo do servidor** (`CONTRACT_CHALLENGE_SECRET`, ≥32 chars exigidos em produção), não como hash puro *(19/ago/2026)*: 6 dígitos são 1 milhão de possibilidades, e um SHA-256 sem chave se converte nos códigos vivos por tabela pré-computada assim que o cache vaza. Comparação em tempo constante. `POST /:id/sign/challenge` tem `@Throttle` próprio de 5/60s — cada pedido escreve na caixa de entrada de alguém e mata o código anterior.
- [x] Papel derivado do JWT, nunca do corpo. Em banda, **só o líder assina**; membro **lê** sem ser líder.
- [x] **Parte PJ sem representante nomeado (músico MEI) assina com `signer_document: null`** *(14/set/2026)* — o documento dela é CNPJ, e o campo é CPF. Antes o CNPJ era copiado, o `ContractSignature` lançava e o MEI não conseguia assinar o próprio contrato.
- [x] Segunda assinatura do mesmo lado → **422**; quem não é parte → **403**; `annul` de contrato assinado → **422** (e só admin).
- [x] O documento **declara que não é título executivo** (CPC art. 784, III) e que é prova escrita apta a ação monitória (CPC art. 700). Prometer o contrário na UI seria falso.

## Acesso e privacidade
- [x] 🔑 **`IContractStorage` não tem `getPublicUrl`, e isso é a feature.** O documento carrega CPF, CNPJ, endereço e cachê; sem função que produza URL pública, vazar contrato por engano fica impossível por construção. A leitura é `GET /contracts/:id/document`, autorizada e por stream.
- [x] `GET /contracts` é escopado pelo token (OR contra os três lados), **fail-closed**.
- [x] A verificação pública (`GET /contracts/verify/:code`, `@Public()`) devolve o mínimo — código, status, hash, data do show — com os nomes **mascarados** (`"Ana Ribeiro"` → `"Ana R."`).
- [x] A rota pública mora em **controller separado**: um `@Public()` solto num controller com `@UseGuards` é a receita de expor rota autenticada sem querer.
- [x] `SearchParams.filter` com override na subclasse — sem ele o repositório monta `where: {}` e devolve contrato de todos os estabelecimentos.

## Pendente
- [ ] **Revisão por advogado** antes do primeiro contrato em produção — [_privado/juridico/checklist-juridico-do-contrato.md](../_privado/juridico/checklist-juridico-do-contrato.md) é o artefato dessa conversa. É gate, não sugestão.
- [ ] `CONTRACT_ISSUER_LEGAL_NAME` e `CONTRACT_ISSUER_DOCUMENT` ainda são placeholder.
- [ ] Auditoria de **vocabulário de emprego** nas telas existentes ("escala", "jornada", "turno") — prova contra o próprio produto num litígio de vínculo.
- [~] Prazo de retenção do contrato e da trilha — **decidido: 5 anos** contados da apresentação, escrito na cláusula LGPD. Falta a rotina de expurgo: hoje nada é apagado.
- [ ] Banda com **CNPJ próprio**; endereço estruturado do músico.
