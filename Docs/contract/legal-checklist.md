# Contrato digital de show — checklist para revisão jurídica

> **Este documento não é parecer jurídico.** Foi escrito por quem implementou o sistema, para que a
> revisão com advogado seja curta e objetiva: cada decisão vem com a âncora legal que a motivou e
> com o ponto exato onde ela vira código.
>
> **Nada aqui foi validado por advogado ainda.** Este é o artefato que abre essa conversa, e é
> pré-requisito para emitir o primeiro contrato em produção.

**Data:** 15/ago/2026 · **Template:** `show-v1` · **23 cláusulas, 38 variantes**
**Arquitetura:** [contract-digital.md](contract-digital.md)

---

## 1. Como usar este documento

Leia as seções 2 a 9 para entender o desenho; a **seção 10** é a lista de perguntas abertas —
é ela que precisa das suas respostas.

**As amostras do documento gerado saem por comando:**

```bash
npm run contract:samples     # → tmp/contract-samples/*.pdf
```

São cinco, cobrindo os eixos que trocam a redação: músico solo, banda, tom direto, **com custódia**
(o fluxo do escrow) e músico MEI com custódia. Saem do mesmo catálogo e do mesmo renderizador da
emissão real, então não envelhecem: mudou a cláusula, mudou a amostra. Os dados são fictícios e o
código de verificação do rodapé não resolve — é amostra de layout e redação, nunca documento válido.

O texto de todas as cláusulas está em `src/core/contract/domain/catalog/clauses/`, um arquivo por
categoria, cada cláusula com a nota legal que a justifica.

---

## 2. A posição da plataforma — o ponto de partida

A SoundMeet **não é parte** do contrato. Ela fornece a ferramenta que o gera, guarda e mantém
íntegro. Isso está escrito no próprio documento (cláusula `papel_da_plataforma`), e é a premissa da
qual todo o resto decorre.

**O que a plataforma assume como obrigação própria:**

- fornecer a ferramenta, gerar, armazenar e manter disponível o documento e sua integridade;
- guardar a trilha de auditoria das assinaturas;
- tratar dados pessoais conforme a LGPD;
- **quando houver custódia de valores** — o que ainda não existe —, guardar e repassar conforme as
  regras publicadas. Esta obrigação nasce do ato de custodiar, é indisponível, e a redação a
  **assume** em vez de tentar excluí-la.

**O que a plataforma declara expressamente NÃO ser e NÃO fazer:**

- não garante que o show ocorra, nem a qualidade da apresentação, nem o comparecimento de público;
- não recolhe ECAD, ISS, INSS ou IR, e não emite nota fiscal por nenhuma das partes;
- não é empregadora, agente nem empresária artística;
- não responde por danos, acidentes ou interdição no local;
- não valida a veracidade de CPF/CNPJ além do dígito verificador.

> ⚠️ **Distinção que atravessa o documento inteiro: alocar ≠ executar.** O contrato **diz de quem é**
> cada obrigação tributária; a plataforma **não cumpre** nenhuma delas. Dizer de quem é a obrigação
> custa uma cláusula e protege as duas partes. Assumir a obrigação criaria um passivo que a
> SoundMeet não tem e não quer.

---

## 3. Natureza do contrato e risco de vínculo

**Contrato civil de prestação de serviços artísticos musicais** (CC art. 593 e ss.), entre
estabelecimento (contratante) e músico ou banda (contratado). **Não é contrato de trabalho.**

O risco real é o reconhecimento de vínculo empregatício quando coexistem pessoalidade,
habitualidade, onerosidade e subordinação (CLT art. 3º). Três consequências práticas já
implementadas:

1. **Cláusula de autonomia** (`ausencia_vinculo`), reescrita em 15/ago/2026 para **afirmar fatos
   verificáveis** em vez de negar em cascata: quem define repertório e técnica (contra
   subordinação), a possibilidade de substituição (contra pessoalidade) e a ausência de
   exclusividade. **Não afirma mais "caráter eventual"** — era declaração de fato que a recorrência
   desmentiria, e contrato que declara algo falso vira prova contra quem o escreveu.
   É **necessária e insuficiente**: prevalece a primazia da realidade.
2. **A cláusula de conduta está deliberadamente ausente do tom padrão.** Regra de conduta detalhada
   aproxima a relação de subordinação — exatamente o que a cláusula anterior tenta afastar. Ela só
   entra no tom rigoroso, quando o contratante assume esse custo conscientemente, e mesmo assim
   limitada a obrigações de resultado e respeito mútuo, sem controle de conduta pessoal.
3. 🔴 **A plataforma inteira deve evitar vocabulário de emprego.** "Escala", "jornada", "ponto",
   "folga", "turno do músico" em qualquer tela são prova contra o próprio produto num litígio.
   Nenhuma string nova usa esses termos; auditar as telas existentes está pendente.

**Já resolvido e o produto não deve reintroduzir:** não exigir registro na Ordem dos Músicos. O STF
declarou inconstitucional a exigência de inscrição na OMB para o exercício da profissão
(RE 795.467, Tema 795). Nenhum campo, gate ou cláusula condiciona nada a isso.

---

## 4. Assinatura eletrônica — o que dá validade e o que não dá

**Base:** MP 2.200-2/2001, art. 10, §2º — documento eletrônico assinado por meio diverso do
ICP-Brasil é válido **desde que admitido como válido pelas partes**.

Daí duas exigências, que são de implementação e não de redação:

| Exigência | Como está implementada |
|---|---|
| **Admissão expressa pelas partes** | Cláusula `assinatura_eletronica`, obrigatória e sem variante — é a própria admissão. Sem ela a base legal fica frágil |
| **Autoria e integridade demonstráveis** | Identidade autenticada (Keycloak), **código de uso único enviado ao e-mail da parte** (segundo fator, ago/2026), aceite explícito por caixa de seleção dedicada (nunca implícito por navegação), timestamp do servidor, IP, user-agent e hash SHA-256 do conteúdo congelado |

**A âncora de identidade é a conta autenticada, não o documento declarado no cadastro.** O cadastro
diz quem *deveria* assinar; a trilha diz quem assinou. Em contratação de banda, **só o líder
assina** — banda não tem personalidade jurídica, e quem responde precisa ser pessoa identificada.

### O limite — e onde ele é dito

Sem duas testemunhas nem certificado ICP-Brasil, a leitura tradicional é que o instrumento **não é
título executivo extrajudicial** (CPC art. 784, III). É **prova escrita**, o que habilita **ação
monitória** (CPC art. 700) — caminho rápido e adequado.

A cláusula **afirma** que o instrumento é prova escrita apta a monitória e **não nega** ser título
executivo (decisão de 15/ago/2026, §10). Negar expressamente entregava ao adversário um argumento
escrito pelo próprio credor e renunciava a algo que a lei talvez permita — ver a pergunta sobre o
§4º do art. 784 do CPC na §10.

**A honestidade sobre o limite é obrigação da interface**, que nunca promete força executiva. O
contrato não precisa renunciar ativamente para que o produto seja honesto.

### Reforço de integridade

Cada contrato tem código curto e **página pública de verificação** que exibe o hash e o estado das
assinaturas, com os nomes das partes **mascarados** (`"Ana Ribeiro"` → `"Ana R."`). Quem tem o PDF
em mãos confere que é o documento certo; quem só tem o código não colhe dado de ninguém.

O sistema **recusa carregar** contrato cujo conteúdo não corresponda ao hash gravado — sem isso,
publicar o hash seria decoração.

---

## 5. Alocação de responsabilidades

### Do CONTRATANTE (estabelecimento)

| Obrigação | Cláusula | Âncora |
|---|---|---|
| Pagar o cachê no prazo | `cache_pagamento` | Obrigação principal |
| **Direitos autorais / ECAD** | `direitos_autorais_ecad` | **Lei 9.610/1998, art. 68** |
| Alvarás, licenças, limites municipais de ruído, segurança, energia | `licencas_seguranca` | Obrigações do explorador do estabelecimento |
| Palco e passagem de som na janela combinada | `passagem_som` | Obrigação de fazer |
| A estrutura declarada na Ficha Técnica (Anexo I) | `estrutura_tecnica` | Anexo integra o contrato |
| Retenções tributárias que lhe caibam | `tributos` | Ver §6 |

> **ECAD merece destaque.** A obrigação de recolhimento pela execução pública em local de frequência
> coletiva é de quem promove o evento — o estabelecimento. É a cláusula mais barata e mais valiosa
> do documento: sem ela, a cobrança bate no músico, que não tem como se defender.

### Do CONTRATADO (músico ou banda)

Comparecer e executar no horário e duração combinados; instrumentos próprios, salvo o que a Ficha
Técnica atribuir ao contratante; responder pelos próprios integrantes (na banda, o líder responde e
assina); tributos próprios.

### Recíprocas

`equipamentos_danos` (cada parte responde pelo dano que causar; o contratante **não** assume a
guarda de instrumento deixado no local salvo acordo escrito) e `direito_imagem` (uso recíproco,
porque o interesse é mútuo).

---

## 6. Tributos — três variantes, e o porquê

A cláusula **aloca**; a plataforma **não executa**. O texto fala em "retenções exigidas pela
legislação vigente", sem citar percentual nem mecanismo — repete o que a lei já impõe, em vez de
afirmar regra fiscal que pode mudar.

| Variante | Quando é escolhida | O que diz |
|---|---|---|
| `tributos.contratado_pj` | Músico com **CNPJ de MEI** | Pagamento contra nota fiscal; o contratado recolhe pelo regime dele; **não há** retenção previdenciária na fonte |
| `tributos.contratante_pj` | Bar PJ × músico pessoa física | O contratante efetua as retenções na fonte, deduz do valor e comprova ao contratado |
| `tributos.contratante_pf` | Bar pessoa física × músico PF | Cada parte recolhe o que lhe cabe |

**A razão da distinção:** a retenção previdenciária na fonte é obrigação da empresa que contrata
**contribuinte individual** (art. 4º da Lei 10.666/2003). MEI é pessoa jurídica e não é contribuinte
individual nessa relação — instruir o bar a reter INSS dele seria mandar fazer retenção indevida.

### O valor é declarado BRUTO

O contrato diz o valor em algarismos **e por extenso** (defesa contra adulteração de um dígito; em
divergência prevalece o extenso) e declara que o valor é **bruto**:

> *"O valor acima é BRUTO. Eventuais retenções tributárias exigidas por lei do CONTRATANTE serão
> deduzidas dele, e o CONTRATADO receberá o líquido resultante, com o comprovante da retenção. Não
> havendo retenção legalmente exigível, o valor bruto é o valor a receber."*

Sem essa frase, o contrato dizia "R$ 1.500" e a cláusula de tributos dizia "o contratante reterá" —
somados, ninguém sabia se o músico recebia 1.500 ou menos. É a briga clássica de fim de show.

---

## 7. Limites legais que viram invariante de código

Isto é o que separa um gerador de contratos de um gerador de contratos que produz cláusula nula.
Cada limite abaixo é **validado em código**, não apenas escrito na redação — e há teste que falha se
alguém tentar ultrapassar:

| Limite | Âncora | Invariante |
|---|---|---|
| Cláusula penal não pode exceder o valor da obrigação principal | **CC art. 412** (e art. 413, redução judicial por excesso) | Multa de cancelamento ≤ 100% do cachê |
| Não concorrência precisa ser limitada em tempo, espaço e atividade | Liberdade profissional, **CF art. 5º, XIII** | Exclusividade com teto duro de km e de dias, e ausente por padrão |
| Uso de imagem exige autorização com finalidade e prazo definidos | **CC art. 20** | Variante de imagem sempre com prazo, território e finalidade preenchidos |
| Foro de eleição válido entre partes civis | **CPC art. 63** | Foro = comarca do local do show; **nunca** a sede da plataforma, que não é parte |
| Mediação prévia não pode condicionar acesso ao Judiciário | **CF art. 5º, XXXV** | Etapa redigida como facultativa |
| Nulidade parcial não contamina o todo | **CC art. 184** | Cláusula de disposições gerais |

**Por que validar em código e não só redigir:** multa acima do teto é cláusula nula, e cláusula nula
é pior que cláusula ausente — dá ao usuário uma confiança que o documento não sustenta.

Cláusulas de proporcionalidade também: o camarim só entra acima de R$ 500 de cachê, porque exigir
camarim de um bar de bairro em show de R$ 300 produz cláusula que ninguém cumpre — e cláusula
descumprida por rotina enfraquece o documento inteiro.

---

## 8. Qualificação das partes

Contrato com parte não qualificada é papel fraco. O sistema **não emite** contrato incompleto: ele
recusa e lista exatamente o que falta, para a interface pedir a correção.

| Parte | Como é qualificada |
|---|---|
| **Estabelecimento** | Razão social, CNPJ, endereço, e-mail e **representante legal com nome e CPF** |
| **Músico solo** | Nome civil, CPF — ou **CNPJ, quando tem MEI**, caso em que é qualificado como pessoa jurídica |
| **Banda** | O **líder**, pessoa física, na qualidade de representante; os integrantes vão **nomeados** no objeto |

> 🔴 **Nenhum documento é jamais fabricado.** Uma versão anterior compunha o CPF do representante
> legal a partir dos 11 primeiros dígitos do CNPJ, porque o sistema exigia representante para pessoa
> jurídica e a plataforma não coletava esse dado. Isso é falsificar documento num instrumento cuja
> única razão de existir é provar fatos. Hoje os dados são coletados no cadastro; quando não
> existem, o contrato **não é emitido**.
>
> Pelo mesmo princípio: o músico não tem endereço estruturado na plataforma, então o documento
> declara *"Endereço não informado"* em vez de inventar um.

**Por que a banda contrata pelo líder pessoa física, mesmo quando ele tem MEI:** o MEI é dele, não
da banda. Faturar o cachê inteiro pelo CNPJ pessoal do líder cria um repasse entre integrantes que
nenhuma cláusula descreve e pode estourar o teto do MEI.

---

## 9. Dados pessoais

| Tema | Tratamento |
|---|---|
| **Base legal** | Execução de contrato — **Lei 13.709/2018, art. 7º, V**. Não consentimento, que seria revogável e tornaria o documento instável |
| **Minimização** | No instrumento entra apenas o necessário à qualificação das partes |
| **Trilha de auditoria** | O Marco Civil (Lei 12.965/2014, art. 15) obriga guarda de registros de aplicação por 6 meses; aqui a guarda é por prazo maior e por outra razão — prova contratual |
| **Apagamento** | Apagar o cadastro do músico zera o ponteiro, mas **o contrato preserva o snapshot** da qualificação. É o que mantém a prova de pé |
| **Exposição** | O documento tem CPF, CNPJ, endereço e valor de cachê. O armazenamento é privado por construção: **não existe função no sistema capaz de gerar URL pública de um contrato.** O acesso é sempre autorizado, por parte |
| **Página pública** | Expõe só código, estado, hash, data do show e nomes **mascarados** |

⚠️ **Ponto para sua avaliação:** a guarda do contrato por prazo maior que o do Marco Civil é
justificada pela finalidade probatória, mas o prazo exato de retenção não está definido — ver §10.

---

## 10. Perguntas abertas — o que precisamos de você

### Enquadramento

- [ ] **Lei 6.533/1978** (profissões de artista e técnico em espetáculos de diversões) e seu decreto
      regulamentador tratam de contrato padronizado e registro sindical para artistas. A prática de
      mercado para show pontual em bar é a contratação autônoma. **O enquadramento se sustenta?**
      Precisamos de registro sindical, anotação ou contrato padronizado específico?
- [ ] A cláusula de ausência de vínculo, **reescrita em 15/ago/2026** (ver decisão abaixo), está no
      tom certo? Ficou curta demais, ou é exatamente o suficiente?

> **DECIDIDO (15/ago/2026) — a cláusula passou a AFIRMAR em vez de NEGAR.** A versão anterior negava
> em cascata, usava vocabulário de emprego ainda que negado ("sem controle de jornada") e empregava
> jargão trabalhista ("não há pessoalidade obrigatória") — o conjunto sinalizava consciência do risco
> e podia ser lido como tentativa de mascarar a relação. **Duas afirmações de fato falsificáveis
> foram removidas:** "em caráter eventual" e "sem controle de jornada". O que sobrou são fatos
> verificáveis: quem define repertório e técnica, a possibilidade de substituição e a ausência de
> exclusividade.

### 🟡 PENDENTE — contratação recorrente

> **Registrado em 15/ago/2026, decisão de adiar a implementação.** A pesquisa feita nesta data
> contradiz a premissa inicial ("se é acordado e querido pelas duas partes, continua sendo evento"),
> e por isso o item fica anotado em vez de fechado.

O que a pesquisa mostrou, e que precisa da sua confirmação:

- **Acordo entre as partes não afasta vínculo.** O art. 9º da CLT anula atos que visem desvirtuar a
  aplicação da lei trabalhista — vínculo não é renunciável por vontade das partes.
- **Exclusividade não é requisito.** "Ele também toca em outros bares" não é defesa; a
  jurisprudência admite vínculo com múltiplos empregadores.
- **Existe critério formal de eventualidade para músicos**, e ele é mais apertado do que a prática
  de mercado sugere: a tradição da **Nota Contratual** (Lei 3.857/60 + Portaria MTE 3.347/86) falava
  em prestação de **até 7 dias consecutivos**, com vedação de reutilizar o mesmo profissional pelo
  mesmo contratante em prazo determinado. ⚠️ A Portaria 3.347/86 foi **revogada pela Portaria
  656/2018** — o status atual do critério precisa ser confirmado.
- **Jurisprudência:** há reconhecimento de vínculo com apresentação **uma vez por semana**; seis
  meses tocando todo fim de semana caracterizou pessoalidade, subordinação e habitualidade.
- **O que continua protegendo:** habitualidade sozinha não basta. Nos casos de reconhecimento havia
  subordinação real (o local mandava no horário e no repertório, exigia aquela pessoa). O desenho da
  plataforma — músico define repertório, pode se fazer substituir, sem controle de jornada — é
  defesa real, e é o que a cláusula reescrita afirma.

Perguntas:

- [ ] Show recorrente no mesmo local (ex.: toda sexta-feira por meses) muda a análise a ponto de
      exigir **variante própria** da cláusula de vínculo?
- [ ] Qual o **limiar** a partir do qual a recorrência é relevante? Deve sair do critério dos 7 dias
      / intervalo, ou existe parâmetro melhor?
- [ ] Vale **alertar no produto** quando o par estabelecimento × músico passar do limiar? A
      plataforma tem esse dado; o estabelecimento não tem.

**Não implementado por decisão de produto (15/ago/2026).** O catálogo já tem o mecanismo pronto —
bastaria um eixo `is_recurring` no `ClauseContext` e uma variante, o mesmo movimento feito para o
MEI. Mitigação parcial já em vigor: a cláusula **parou de afirmar "caráter eventual"**, então hoje
ela não declara nada falso num show recorrente.

### Assinatura e execução

- [ ] O conjunto **cláusula de admissão + trilha (conta autenticada, código de uso único por
      e-mail, aceite explícito, IP, timestamp, hash)** é suficiente para sustentar a validade entre
      as partes na sua leitura da MP 2.200-2?

> **IMPLEMENTADO (15/ago/2026) — segundo fator na assinatura.** A conta autenticada provava que
> alguém com a senha entrou, não quem. Agora assinar exige um código de 6 dígitos enviado ao e-mail
> **congelado da parte no contrato**, válido por 10 minutos, de uso único, com 5 tentativas. O
> código nunca aparece na resposta HTTP nem no assunto do e-mail. **Não** foi adotada biometria:
> é dado pessoal sensível (LGPD art. 5º, II) e elevaria o risco de forma desproporcional ao ganho
> sobre o OTP.
- [ ] ⚠️ A **Lei 14.620/2023** teria incluído um **§4º no art. 784 do CPC**, dispensando a
      assinatura de testemunhas quando a integridade do documento for conferida por **provedor de
      assinatura**. Confirme a existência, o texto e o alcance — e, principalmente: *provedor de
      assinatura* exige terceiro, ou a própria plataforma se enquadra? Se o §4º valer para o nosso
      caso, o instrumento pode já ser título executivo sem mudar nada no fluxo.

> **DECIDIDO (15/ago/2026) — não haverá testemunhas.** Assinam apenas as partes. A plataforma
> aporta uma **validação de sistema** (hash, código de verificação e trilha de auditoria), que
> **não é assinatura de testemunha** e não deve ser apresentada como tal em lugar nenhum do produto.
> Descartada a hipótese de a SoundMeet figurar como testemunha: ela tem interesse econômico na
> transação, é quem gera o documento e guarda a prova, e uma "testemunha" que assina milhares de
> contratos automaticamente é formalidade sem substância. 🔴 **Confirmar esta decisão com o
> advogado antes do deploy** — item no checklist da §12.

> **DECIDIDO (15/ago/2026) — a negação de título executivo saiu do contrato.** O parágrafo dizia
> *"sem que se lhe atribua a qualidade de título executivo extrajudicial"*. Negar expressamente
> entregava ao adversário um argumento escrito pelo próprio credor e **renunciava** a algo que a lei
> talvez permitisse (ver o §4º acima). A cláusula agora **afirma** o que o instrumento é — prova
> escrita apta a monitória — e para por aí. A honestidade sobre o limite continua sendo obrigação da
> **interface**, que nunca promete força executiva.

### Tributário *(pode exigir contador, não advogado)*

- [ ] A alocação das três variantes de `tributos` está correta, em especial a de **MEI sem retenção
      previdenciária**?
- [ ] Existem **hipóteses de equiparação a empresa** (IN RFB 971) que fariam um contratante pessoa
      física ter obrigação de reter? Se sim, a variante `contratante_pf` precisa de ressalva.
- [ ] A cláusula do valor BRUTO com dedução das retenções está redigida de forma inatacável?

### Responsabilidade e proteção de dados

- [ ] A delimitação do papel da plataforma (§2) é **suficiente** para afastar responsabilidade
      solidária num litígio entre as partes?
- [ ] Confirmar o **prazo de retenção de 5 anos** adotado (ver decisão abaixo) e se a contagem a
      partir da data da apresentação é a correta.
- [ ] A cláusula LGPD agora declara **controladores independentes**. Confirmar se é isso mesmo ou se
      o arranjo é de **controladoria conjunta** (art. 5º, VI, c/c art. 42, §1º, II) — o que mudaria
      as obrigações de transparência e a resposta a incidente.

> **DECIDIDO (15/ago/2026) — retenção de 5 anos**, contados da data da apresentação. Âncoras: a
> prescrição da pretensão contratual (CC art. 206, §5º, I) e a janela trabalhista do art. 11 da CLT
> — o contrato é justamente a prova **contra** a alegação de vínculo, e precisa existir enquanto
> essa ação for possível. Está escrito na própria cláusula LGPD, não só aqui. ⚠️ **Ainda não há
> rotina de expurgo implementada** — hoje nada apaga nada.

> **DECIDIDO (15/ago/2026) — a plataforma é CONTROLADORA, não operadora.** A redação anterior dizia
> "atua como operadora". Operador age sob instrução de um controlador; a SoundMeet decidiu sozinha
> que o contrato seria gerado na confirmação do booking, quais dados entram, por quanto tempo
> guardar e que haveria página pública de verificação — todas decisões de finalidade, que é o que
> define o controlador. Chamar-se de operadora não afastaria obrigação nenhuma (rótulo não muda
> fato) e ainda sinalizaria desconhecimento perante a ANPD.

> **REFORÇO CONTRA SOLIDARIEDADE (15/ago/2026).** A cláusula `papel_da_plataforma.com_custodia`
> passou a dizer que **a remuneração da plataforma só é devida na liberação do valor custodiado** —
> não realizada a apresentação, não há liberação e nada lhe é devido. Isso responde de frente ao
> argumento "a plataforma lucrou com o negócio": ela só ganha se o serviço foi efetivamente
> prestado. Some-se a isso que o valor **não transita pelo patrimônio da SoundMeet** (custódia em
> instituição de pagamento) e que o cachê é pago **antes** da apresentação, sendo restituído se ela
> não ocorrer.

### Antes do escrow *(não é desta entrega, mas condiciona a próxima)*

> **Atualizado em 15/ago/2026.** A redação de custódia foi reescrita para o fluxo realmente
> acordado em [payment-gateway-decisions.md](../payment-gateway-decisions.md): o estabelecimento
> paga **o cachê integral, antecipadamente**, o valor fica **custodiado em instituição de pagamento**
> (não com a plataforma) e é liberado ao músico após a apresentação. A redação anterior descrevia um
> **sinal parcial** — modelo que nunca foi o acordado — e remetia a um "prazo de contestação previsto
> neste instrumento" que não existia em cláusula nenhuma. As cláusulas envolvidas são
> `cache_pagamento` (variante `com_custodia`), a nova `custodia_liberacao` e `papel_da_plataforma`.

> **DECIDIDO (15/ago/2026) — subconta em instituição de pagamento, nunca ledger interno.** O valor
> fica custodiado na **subconta do músico na Asaas**, instituição de pagamento autorizada, e é
> liberado pelo cumprimento das regras (apresentação registrada + decurso do prazo de contestação).
> A SoundMeet **apenas determina a liberação por API**: o dinheiro não entra na conta dela, não
> integra seu patrimônio e ela não pode dele dispor. As três cláusulas de custódia já afirmam isso
> expressamente. O caminho de "ledger interno na conta da plataforma" foi **descartado** —
> era ele que criava o risco de custódia de recurso de terceiro.

- [ ] Confirmar que a estrutura acima (subconta + split + liberação por API) **afasta** o
      enquadramento como instituição de pagamento sujeita a autorização do BACEN (Lei 12.865/2013),
      dado que quem custodia é a Asaas e a SoundMeet é camada de tecnologia.

### Antes da gorjeta em produção *(Mercado Pago, decidido 19/ago/2026)*

> **O que o código faz hoje.** A cobrança da gorjeta é criada **na conta Mercado Pago do próprio
> músico** (`POST /v1/payments` autenticado com o access token dele, obtido por OAuth), e a comissão
> da plataforma sai como `application_fee`. O Mercado Pago liquida direto na conta dele; **o valor
> não entra na conta da SoundMeet em momento nenhum**, nem por segundos. Não há repasse — há divisão
> na liquidação.
>
> **O modelo alternativo foi recusado de propósito:** receber na conta da plataforma e repassar
> depois, ainda que automaticamente, é o que caracteriza a atividade de **subadquirente /
> facilitador de pagamento** (Circular BCB 3.815/2016) — a plataforma passa a ser responsável por
> recurso que não é dela. Foi por isso que a Woovi/OpenPix foi descartada mesmo sendo a mais barata:
> a "subconta" dela é **saldo virtual dentro da conta da plataforma** (a documentação é literal —
> *"transações de split para sub contas são transações virtuais"*), o que é exatamente esse modelo.

- [ ] Confirmar que o split do Mercado Pago com `application_fee` (cobrança criada na conta do
      recebedor, comissão retida pelo marketplace, **sem trânsito pela conta da SoundMeet**)
      **afasta** o enquadramento como subadquirente sujeito a autorização.
- [ ] Confirmar se existe **limiar de volume** a partir do qual a atividade exige autorização mesmo
      nessa estrutura — e, se existir, qual é. ⚠️ Estar abaixo de um limiar **não é permissão**, é
      adiamento: precisamos saber onde está a linha antes de chegar nela.
- [ ] Confirmar o enquadramento da **comissão** (`application_fee`) como receita de serviço de
      intermediação, e não como parte do valor da gorjeta — inclusive para efeito de nota fiscal e
      de base tributária (ver §"Tributário").
- [ ] Confirmar que a **gorjeta ao músico** não configura, por si, relação de emprego nem
      remuneração paga pela plataforma — o pagador é o fã, e a SoundMeet só intermedeia. (A cláusula
      `ausencia_vinculo` já trata do cachê; a gorjeta não passa por contrato nenhum.)
- [ ] A cláusula de custódia e liberação (`custodia_liberacao`) descreve corretamente o mecanismo,
      em especial o **prazo de contestação** e a liberação automática pelo decurso do prazo?
- [ ] 🔴 **O código do escrow não existe.** As cláusulas estão escritas e testadas, mas
      `uses_escrow` é `false` fixo no `IssueContractUseCase` e não há subconta, `held_balance` nem
      gateway de custódia em `src/`. Nenhum contrato real seleciona hoje a redação de custódia.
      A decisão de produto é a subconta — e o texto já foi escrito para ela.
- [ ] 🔴 **A redação afirma que o valor custodiado não integra o patrimônio da plataforma.** Isso é
      verdade só no caminho de subconta. Confirmar que a afirmação se sustenta no arranjo contratado
      com a instituição — se o dinheiro passar por conta da própria SoundMeet, a cláusula vira
      declaração falsa e precisa ser reescrita antes de qualquer emissão.
- [ ] A **liberação automática por decurso do prazo** de contestação (parágrafo segundo de
      `custodia_liberacao`) é oponível ao CONTRATANTE que simplesmente não se manifestou? Ela existe
      para impedir que a plataforma retenha valor alheio por inércia.
- [ ] O percentual da comissão e os prazos (pagamento, contestação, liberação) **não estão escritos
      nas cláusulas** — elas remetem ao que foi "informado às partes e vigente na data de emissão
      deste instrumento". Isso é decisão deliberada: número em cláusula só muda com versão nova de
      template, e a âncora de data impede que uma alteração posterior alcance show já contratado.
      **Essa remissão resiste à análise de cláusula abusiva?** É a pergunta mais importante desta
      seção.
- [ ] A comissão é declarada **devida pelo CONTRATADO** e deduzida na liberação, com o cachê
      permanecendo obrigação **integral** do CONTRATANTE. Confirmar que a construção está correta —
      a alternativa (declarar o líquido) faria o contrato afirmar valor que ninguém paga.

---

## 11. O que decidimos deliberadamente NÃO fazer

Registrado para que a revisão não os proponha como lacuna:

| Decisão | Motivo |
|---|---|
| Não executar nenhuma obrigação fiscal | Criaria passivo que a plataforma não tem e não quer |
| Não intermediar o pagamento do cachê (hoje) | O contrato declara pagamento direto entre as partes; a variante de custódia já está escrita para o fluxo acordado, e é selecionada só quando `uses_escrow` ligar |
| Não escrever percentual de comissão nem prazo em dias dentro de cláusula | Número em texto jurídico só muda com versão nova de template. As cláusulas remetem ao informado e **vigente na data de emissão** — determinável (CC art. 594) e imune a mudança superveniente |
| Não exigir registro na OMB | Inconstitucional (RE 795.467) |
| Não incluir cláusula de conduta no tom padrão | Aproxima da subordinação |
| Não incluir exclusividade por padrão | Restrição à liberdade profissional; entra só se pedida e dentro do teto |
| Não bloquear a confirmação do show pela falta de contrato | Quebraria fluxos já entregues; a interface mostra a pendência |
| Não emitir contrato com parte não qualificada | Papel fraco é pior que ausência de papel |

---

## 12. Checklist de liberação para produção

- [ ] Revisão desta análise por advogado
- [ ] Revisão do texto das 23 cláusulas (`src/core/contract/domain/catalog/clauses/`) — cada uma traz
      a nota legal que a justifica
- [ ] Conferência das cinco amostras em PDF (`npm run contract:samples`)
- [ ] Decisão sobre as perguntas da §10
- [ ] Ajustes de redação aplicados via pull request *(o teste de snapshot obriga revisão explícita
      de qualquer mudança de texto — nenhuma redação muda em silêncio)*
- [ ] `CONTRACT_ISSUER_LEGAL_NAME` e `CONTRACT_ISSUER_DOCUMENT` preenchidos com os dados reais da
      empresa (hoje são placeholder)
- [ ] Auditoria de vocabulário de emprego nas telas existentes
- [x] ~~Prazo de retenção definido~~ — **5 anos da data da apresentação** (§10)
- [ ] Rotina de expurgo implementada — hoje nada apaga nada
- [ ] 🔴 **Confirmar com o advogado a decisão de NÃO usar testemunhas** (§10). Assinam apenas as
      partes; a validação da plataforma (hash + código + trilha) **não é assinatura de testemunha** e
      não pode ser apresentada como tal em nenhuma tela, e-mail ou material de venda
- [ ] 🔴 **Confirmar o enquadramento da custódia** (§10) — subconta em instituição de pagamento,
      liberação por API, dinheiro fora do patrimônio da plataforma
- [ ] Confirmar se o §4º do art. 784 do CPC (Lei 14.620/2023) se aplica — pode dar título executivo
      sem mudar o fluxo
- [x] ~~OTP na assinatura~~ — ✅ implementado em 15/ago/2026
- [x] ~~Envio do PDF assinado por e-mail às duas partes~~ — ✅ implementado em 15/ago/2026, na emissão e no fechamento, com reenvio manual por parte
- [ ] Carimbo de tempo de terceiro sobre o hash — aprovado, ainda não implementado
