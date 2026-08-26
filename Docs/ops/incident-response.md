# Resposta a incidentes

> **Escopo:** incidente de **segurança** e de **dados pessoais**. Indisponibilidade
> pura (backend fora do ar sem suspeita de acesso indevido) é operação, não
> incidente deste documento — a restauração está em
> [`backup-restore.md`](backup-restore.md).
>
> **Time de uma pessoa.** Um runbook que pressupõe plantão em turnos seria
> ficção. Este assume o cenário real: uma pessoa descobre, e precisa saber o que
> fazer primeiro sem depender de memória, possivelmente às 2h da manhã depois de
> um show. Por isso a §1 é curta e as decisões difíceis já estão tomadas aqui.

---

## 1. Primeiros 30 minutos

Nesta ordem. Não pule a 2 para investigar melhor: **conter antes de entender**
é a regra, porque a exposição continua correndo enquanto se investiga.

1. **Anote o horário e o que você viu.** Um bloco de texto cru já basta; ele
   vira o registro do §6, que é obrigação legal (§5.3).
2. **Contenha.** Escolha pela §2 conforme o tipo. Contenção é reversível;
   vazamento não é.
3. **Preserve.** Não apague, não force-push, não recrie o container: você
   destrói a evidência de que precisa para dizer à ANPD **o que** vazou. Copie
   logs para fora antes de mexer.
4. **Classifique a severidade** (§3).
5. **Se envolve dado pessoal, ligue o relógio da ANPD** — 3 dias úteis (§5).
6. Só então: erradicar, recuperar, escrever o post-mortem.

---

## 2. Contenção por tipo

### 2.1 🔴 Segredo exposto

Vale para chave em commit, chave em log, chave em captura de tela, chave em
issue pública.

**Rotacione primeiro. Sempre. Antes de qualquer coisa.**

Remover o commit **não** resolve, e acreditar que resolve é o erro clássico:

- o GitHub mantém commits acessíveis por SHA mesmo depois de force-push, e
  **eternamente** através de forks;
- clones já feitos continuam com o histórico;
- indexadores de segredo varrem eventos de push públicos em segundos — o
  intervalo entre `git push` e a primeira tentativa de uso costuma ser de
  minutos.

Ou seja: reescrever histórico é **higiene**, feita depois; o que **para** a
exposição é invalidar a credencial.

1. Rotacione no provedor (Resend, Mercado Pago, Asaas, AWS, Keycloak…).
2. Atualize o cofre e o ambiente de execução.
3. Verifique o **uso** da chave antiga no painel do provedor — a pergunta não é
   "vazou?", é "foi usada por alguém que não somos nós?". Guarde o print.
4. Só agora decida sobre reescrever o histórico (`git filter-repo`). Coordene:
   reescrita muda todos os SHAs e quebra clones existentes.
5. Registre no §6.

#### 🔴 Item ABERTO — `RESEND_API_KEY` no histórico público

Encontrado em **26/ago/2026** durante a implementação do SM-019.

| | |
|---|---|
| **O quê** | `RESEND_API_KEY` com formato de chave real (`re_…`) |
| **Onde** | `envs/.env.e2e`, em 5 commits alcançáveis, o mais recente `185ad7c` |
| **Alcance** | `origin/develop` do repositório **público** `WesleyR10/SoundMeet_Back-end` |
| **Desde quando** | O arquivo deixou de ser rastreado em `79ef798`, mas **permanece no histórico** |
| **Estado atual** | `envs/.env.e2e` está em `.gitignore`; `envs/.env.example` **não** contém chave real |
| **Ação necessária** | **Rotacionar a chave no painel do Resend** e conferir o log de envio por uso indevido |

O que essa chave permite a quem a tiver: enviar e-mail **como o domínio
verificado do SoundMeet**. O dano não é o custo do envio — é phishing com
remetente legítimo contra os próprios usuários, exatamente na hora em que o
produto pede confiança para tratar de dinheiro.

Outros valores do mesmo arquivo (`KEYCLOAK_CLIENT_SECRET`, `MINIO_*`, `JWT_*`)
aparentam ser de ambiente local (`soundmeet123`, `test…`). **Confirme um a um**
antes de descartar: se algum foi reaproveitado em algum ambiente real, entra na
mesma rotação.

> Enquanto este bloco estiver aqui, o item está **aberto**. Ao rotacionar,
> substitua-o por uma linha no registro do §6 com a data.

### 2.2 Acesso indevido a conta de usuário

1. Revogue as sessões no Keycloak (admin → Sessions → Logout all) do usuário
   afetado. Isso invalida o refresh token; o access token expira em minutos.
2. Force troca de senha.
3. Verifique o vínculo de **Mercado Pago** da conta (`mp_linked`): é o caminho
   que leva a dinheiro. Se houver suspeita, desvincule.
4. Verifique `booking_escrows` em `held` do músico e **suspenda liberação** até
   o esclarecimento — liberar sob dúvida é decidir a disputa por omissão, o
   oposto da regra do agregado.

### 2.3 Vazamento de dados pessoais

Categorias que este sistema guarda e que mudam a gravidade: **CPF** (músico),
**CNPJ e CPF do representante** (estabelecimento), **endereço**, **valor de
cachê**, **contratos assinados em PDF** — que reúnem tudo isso num arquivo só.

1. Corte o acesso (chave, rota, bucket).
2. **Delimite o escopo com dado, não com estimativa:** quais tabelas, quais
   linhas, quantos titulares. É exatamente o que a ANPD pergunta, e é o que
   distingue comunicar um incidente de especular sobre ele.
3. Vá para §5.

### 2.4 Comprometimento de dependência (supply chain)

1. Identifique a versão exata pelo **SBOM** do build afetado (artefato
   `sbom-*-<sha>` do workflow de segurança, retenção de 90 dias).
2. Congele deploys.
3. Fixe a versão segura, rebuild, redeploy.
4. Se o pacote comprometido tinha acesso a segredo em tempo de build, trate
   **também** como §2.1.

---

## 3. Severidade

| Nível | Critério | Resposta |
|-------|----------|----------|
| **S1** | Dado pessoal exposto a terceiro; acesso indevido a dinheiro; credencial de produção em uso indevido | Largue tudo. Relógio da ANPD provavelmente correndo |
| **S2** | Credencial exposta **sem** evidência de uso; falha que permitiria S1 mas não foi explorada | Contenha hoje. Rotação no mesmo dia |
| **S3** | Vulnerabilidade sem caminho de exploração conhecido; aviso de dependência sem correção | Tarefa no roadmap com prazo. Entra na allowlist do gate de auditoria com motivo e data |

O `RESEND_API_KEY` do §2.1 é **S2** enquanto o painel do Resend não mostrar uso
indevido; vira **S1** se mostrar.

---

## 4. Erradicar, recuperar, aprender

1. **Erradicar** — a causa, não o sintoma. Chave rotacionada mas ainda commitável
   é o mesmo incidente esperando data nova; o gate de segredos do CI existe para
   isso.
2. **Recuperar** — se houve perda ou corrupção, siga
   [`backup-restore.md`](backup-restore.md) §4. Restaure em ambiente isolado
   primeiro; restaurar por cima do que ainda está sob investigação apaga a
   evidência.
3. **Post-mortem, sem culpado.** Três perguntas: o que permitiu, o que atrasou a
   descoberta, qual gate automático teria pego. A terceira é a que gera trabalho
   — e é a que impede a repetição.

---

## 5. LGPD / ANPD

> ⚠️ **Este bloco é orientação operacional, não parecer jurídico.** Prazos e
> conteúdo de comunicação precisam de confirmação de advogado, no mesmo gate
> aberto de [`../contract/legal-checklist.md`](../contract/legal-checklist.md).
> Confirme na fonte antes de usar: a base é a **Resolução CD/ANPD nº 15, de
> 24/04/2024**, que regulamenta a comunicação de incidente do art. 48 da LGPD.

### 5.1 Prazo

**3 (três) dias úteis** contados do **conhecimento** do incidente, para comunicar
à ANPD e ao titular, quando o incidente puder acarretar risco ou dano relevante.

Duas consequências práticas que costumam ser descobertas tarde:

- **O relógio começa no conhecimento, não na confirmação.** "Ainda estamos
  investigando" não pausa o prazo. Comunicação preliminar com o que se sabe, e
  complementação depois, é o caminho previsto.
- **É prazo curto para quem descobre numa sexta.** Por isso a §1 manda anotar o
  horário antes de investigar.

### 5.2 O que a comunicação precisa conter

Tenha estes campos prontos — a §2.3 existe para produzi-los:

- descrição da natureza do incidente e dos dados afetados;
- **número de titulares** envolvidos;
- medidas técnicas e de segurança adotadas antes e depois;
- riscos ao titular;
- se houve comunicação ao titular, quando e como;
- medidas de mitigação e o responsável pelo contato.

### 5.3 Registro obrigatório — 5 anos

Todo incidente de segurança com dado pessoal é registrado e **mantido por 5
anos**, tenha ou não sido comunicado à ANPD — inclusive aqueles em que se
concluiu que **não** havia risco relevante, porque é o registro que sustenta essa
conclusão se ela for questionada. O registro vive no §6.

### 5.4 Papéis

Enquanto o time for de uma pessoa, ela acumula controlador e encarregado (DPO).
Isso é permitido, mas **o contato do encarregado precisa ser público** (LGPD art.
41 §1º). Item aberto: publicar o canal na página pública quando o `soundmeet-web`
W5 for ao ar.

---

## 6. Registro de incidentes

> Retenção: **5 anos** (§5.3). Não apague linha; feche com data e desfecho.

| # | Data da descoberta | Tipo | Severidade | Dado pessoal? | ANPD | Estado |
|---|--------------------|------|-----------|---------------|------|--------|
| 1 | 26/ago/2026 | `RESEND_API_KEY` em histórico público (§2.1) | S2 | Não — credencial de envio, sem base de dados anexa | Não aplicável enquanto S2 | **ABERTO** — aguarda rotação |

---

## 7. Contatos

Preencher **antes** do primeiro deploy. Procurar o número do suporte durante um
incidente é tempo que conta no prazo do §5.1.

| Serviço | Para quê | Canal | Conta |
|---------|----------|-------|-------|
| Resend | Rotação de chave, log de envio | — | — |
| Mercado Pago | Vínculo OAuth, cobranças | — | — |
| Asaas | Subconta de custódia | — | — |
| Provedor de banco | PITR, restauração | — | — |
| Provedor de bucket | Versionamento, logs de acesso | — | — |
| ANPD | Comunicação de incidente | Portal gov.br | — |
| Advogado(a) | §5, e o gate de `legal-checklist.md` | — | — |

---

## 8. Simulação de mesa (tabletop) — semestral

30 minutos, sem tocar em sistema. Escolha um cenário, siga o runbook **lendo**, e
anote onde ele falhou em responder. O produto do exercício é a correção deste
documento.

Cenários prontos:

1. Um `MERCADOPAGO_CLIENT_SECRET` aparece num screenshot de issue pública.
2. Um músico relata que a gorjeta caiu em conta que não é dele.
3. Backup do Postgres restaura, mas nenhuma carteira decifra — a chave do §1.2
   de `backup-restore.md` foi perdida.
4. Dependência do `soundmeet-web` publica versão maliciosa e o deploy foi ontem.

O cenário 3 é o mais importante e o menos intuitivo: é o único em que **não
existe resposta** se a preparação não tiver sido feita antes.
