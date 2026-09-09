# Backup e restauração

> **Estado em 26/ago/2026: não existe ambiente de produção.** O deploy segue em
> aberto (`Docs/roadmap-web.md` §11, "Vercel vs. Docker"), e por isso este
> documento não descreve um backup que está rodando — ele é a **especificação
> que precisa estar cumprida antes do primeiro deploy**, mais o roteiro do
> primeiro drill. Nada aqui é hipotético a ponto de não poder ser executado: os
> comandos são os do `docker-compose.yml` que já existe.
>
> A ordem importa. Ligar produção antes de o item 4 (custódia da chave de cifra)
> estar resolvido significa gerar backups que **não podem ser restaurados**.

> **Atualização 01/set/2026 (OPS-1) — o que saiu do papel e o que NÃO saiu.**
>
> ✅ **A verificação do drill (§4.3) virou executável:** `npm run drill:verify`
> (`scripts/verify-restore.ts`) roda 5 dos 8 critérios e sai com código 1 se
> qualquer um falhar. Foi exercitado contra o banco local e, o que importa mais,
> contra o caso negativo: com `TOKEN_ENCRYPTION_KEY` errada ele **falha**, com a
> mensagem de auth tag do AES-GCM. Um check que não sabe falhar não é check.
>
> Ele roda contra um banco **restaurado**, não contra um backup — por isso vale
> igual nas duas rotas do §3.1 e pôde ser escrito antes da decisão de deploy.
>
> 🔴 **O que continua bloqueado: o backup em si.** O §3.1 condiciona a rota de
> PITR à decisão de deploy (`roadmap-web.md` §11, "Vercel vs. Docker"), e ela
> segue aberta. Escrever `pgBackRest`/`wal-g` agora seria construir para um alvo
> não escolhido — e o próprio §3.1 **recomenda o Postgres gerenciado** para um
> time de uma pessoa, caso em que PITR é configuração e todo esse código vira
> lixo.
>
> ⚠️ Um dado que estreita a decisão: `docker-compose.prod.yml` **já traz
> Postgres no compose**, fixado por digest. Se o deploy for por ele, a rota é a
> segunda do §3.1 e exige WAL próprio. Vale confirmar essa intenção antes de
> escolher — é a diferença entre configurar um provedor e operar arquivamento
> de WAL.

---

## 1. O que precisa de backup, e por quê

Ordenado por consequência da perda, não por tamanho.

| # | Ativo | Onde | Perder significa | Backup |
|---|-------|------|------------------|--------|
| 1 | **Banco da aplicação** | `postgres` → volume `postgres_data` | Perder tudo: shows, contratos, custódia de cachê, carteira, gamificação | PITR obrigatório |
| 2 | **Chaves de cifra e segredos** | `TOKEN_ENCRYPTION_KEY` e demais em `envs/.env` | Backup do item 1 vira **lixo ilegível** nos campos cifrados | Cofre, fora do backup |
| 3 | **Banco do Keycloak** | `postgres-keycloak` → `postgres_keycloak_data` | Ninguém entra no sistema; senhas não são recuperáveis por recriação | PITR obrigatório |
| 4 | **Contratos assinados** | bucket `CONTRACT_STORAGE_BUCKET` | Perder **prova jurídica** de shows contratados | Versionamento + retenção longa |
| 5 | **Mídia de perfil e cifras** | bucket `soundmeet-media` | Degradação visível, reconstrução parcial pelo usuário | Versionamento |
| 6 | Redis | volume `redis_data` | Cache frio por alguns minutos | **Não** — reconstruível |
| 7 | RabbitMQ | volume `rabbitmq_data` | Mensagens em voo | **Não** — ver §1.1 |

### 1.1 Por que RabbitMQ fica de fora

O projeto usa **outbox**: o evento é gravado na mesma transação do agregado e só
depois publicado (ver `Docs/audits/rabbitmq-outbox-review-2026-06-20.md`), e os
consumidores são idempotentes com `ProcessedEvent`. Uma fila perdida é
reconstruída a partir do banco; um backup de fila, ao contrário, **reintroduz
mensagens já processadas** — e a idempotência protege contra duplicata, não
contra reprocessar um evento de um mundo que não existe mais.

### 1.2 🔴 A chave de cifra não pode viajar com o backup

`TOKEN_ENCRYPTION_KEY` (AES-256-GCM, infra do SM-016) protege em repouso o
`asaas_api_key` da subconta de custódia e os tokens OAuth do Mercado Pago —
credenciais que **movem dinheiro**. Duas regras que se contradizem só na
aparência:

- **Sem a chave, o backup do banco é irrecuperável** nos campos cifrados. Um
  restore "bem-sucedido" que não consegue decifrar a carteira de ninguém é um
  restore falhado, e o drill do §4 só passa se decifrar.
- **Com a chave dentro do backup, o backup deixa de proteger.** Quem obtiver o
  arquivo obtém as credenciais de pagamento.

Portanto: chave em cofre (o gerenciador de segredos do provedor de deploy, ou
1Password/Bitwarden com acesso registrado), **nunca** no mesmo bucket, na mesma
conta, nem no mesmo `.env` que acompanha o dump. Rotação de chave exige backfill
— existe precedente executável em `prisma/backfill-sm016-field-encryption.ts`.

> ⚠️ `envs/.env.example` traz um `TOKEN_ENCRYPTION_KEY` com formato de chave
> real (32 bytes base64). É exemplo — e é público, porque o repositório é
> público. **Nunca** copie esse valor para um `.env` de verdade; gere com
> `openssl rand -base64 32`.

---

## 2. Alvos de RPO e RTO

Propostos a partir do que o negócio não tolera, não de um número redondo.

| Ativo | RPO | RTO | O que fixa o número |
|-------|-----|-----|---------------------|
| Banco da aplicação | **5 min** | **4 h** | Uma gorjeta PIX confirmada e depois perdida é dinheiro que entrou na conta do músico sem registro no extrato dele. Custódia de cachê tem o mesmo problema, com valor maior |
| Banco do Keycloak | 1 h | 4 h | Identidade muda com pouca frequência; mas sem ele o RTO do item acima não vale nada, porque ninguém entra |
| Contratos | **0** (versionamento) | 24 h | É documento probatório: perder uma versão é perder a prova de que aquele texto foi assinado |
| Mídia | 24 h | 72 h | Reconstruível pelo usuário, com incômodo |

**Janela crítica:** show acontece à noite, entre 20h e 2h, e é quando pedido,
gorjeta, check-in e liberação de custódia concentram escrita. Restauração
durante essa janela é a pior hora possível; o drill do §4 deve ser executado
**fora** dela, mas o RTO precisa ser medido pensando nela.

---

## 3. Como fazer

### 3.1 PITR do PostgreSQL

Dump lógico diário (`pg_dump`) **não atende** o RPO de 5 minutos — ele dá RPO de
24 h. É necessário arquivamento contínuo de WAL. Duas rotas, decidir junto com o
deploy:

- **Postgres gerenciado** (Neon, RDS, Supabase, Railway): PITR é configuração,
  não código. É a rota recomendada para um time de uma pessoa — a operação de
  WAL própria é uma segunda ocupação.
- **Postgres no compose** (o que existe hoje): `pgBackRest` ou `wal-g` com
  destino em bucket, `archive_mode=on`, `archive_command` apontando para o
  repositório, backup completo semanal + incremental diário.

Independentemente da rota, valem as duas regras abaixo.

**Dois bancos, dois backups, um instante.** `postgres` e `postgres-keycloak` são
instâncias separadas. Restaurar a aplicação em T e o Keycloak em T-2h produz
usuário existente no Keycloak que não existe na aplicação — ou o contrário, com
`musician_id` órfão, já que o agregado nasce com `id == sub` do Keycloak (ver
`Docs/auth/keycloak.md`). **Restaure sempre os dois para o mesmo ponto no
tempo**, e verifique com a consulta do §4.3.

**Backup cifrado em repouso, com chave distinta da do §1.2.** Backup de banco com
CPF, CNPJ, endereço e valores de cachê é dado pessoal sob LGPD tanto quanto o
banco vivo.

### 3.2 Buckets

Ligar **versionamento de objeto** no bucket de contratos e o lifecycle que
mantém versões antigas. Vale lembrar por que `IContractStorage` não tem
`getPublicUrl` (CLAUDE.md): o documento carrega CPF, CNPJ, endereço e cachê.
A cópia de backup merece o mesmo cuidado — bucket de backup privado, sem
listagem pública, com acesso registrado.

Os stems do Modo Ensaio têm **prazo de retenção por decisão de direito autoral**
(`PurgeExpiredAiAudioStemsUseCase`, de hora em hora). Backup com retenção maior
que a do dado vivo **desfaz essa decisão** — o objeto expurgado continua
existindo no backup. Excluir o prefixo de stems do backup, ou aplicar lifecycle
igual ao do expurgo.

### 3.3 Segredos

Inventário mínimo a ter no cofre antes do primeiro deploy:

- `TOKEN_ENCRYPTION_KEY` (§1.2)
- `KEYCLOAK_CLIENT_SECRET` e credenciais de admin do realm
- `DATABASE_URL` das duas instâncias
- Credenciais do provedor de pagamento (Asaas, Mercado Pago) — cada uma delas é
  acesso a dinheiro de terceiro, não da plataforma
- `RESEND_API_KEY`
- Credenciais do bucket

---

## 4. Drill de restauração — mensal

Backup não testado não é backup. O drill **não é opcional** e o resultado é
registrado, mesmo (principalmente) quando falha.

**Cadência:** primeira segunda-feira do mês, fora da janela de show (§2).
**Ambiente:** isolado. Nunca apontando para o banco ou o bucket de produção.

### 4.1 Roteiro

1. Anotar `T_inicio`.
2. Escolher um ponto de restauração de **~2 horas atrás** — não o backup mais
   recente. Restaurar o último é o caso fácil; o caso real é "descobrimos hoje
   de manhã que ontem à noite corrompeu".
3. Subir infra limpa: `docker compose up -d postgres postgres-keycloak minio`
   com volumes vazios.
4. Restaurar `postgres` **e** `postgres-keycloak` para o **mesmo** ponto (§3.1).
5. Injetar `TOKEN_ENCRYPTION_KEY` **a partir do cofre** — não de um `.env`
   guardado ao lado do dump. Se este passo for fácil demais, o §1.2 foi violado.
6. Aplicar migrations pendentes: `npx prisma migrate deploy`.
7. Rodar as verificações do §4.3 — **automatizadas desde 01/set/2026**:

   ```bash
   DATABASE_URL=<banco restaurado> \
   TOKEN_ENCRYPTION_KEY=<do cofre, digitada agora> \
     npm run drill:verify
   ```

   Sai com código **1** se qualquer critério falhar, então serve de gate em
   script. Os dois itens que ele NÃO cobre continuam manuais e estão marcados
   no §4.3.
8. Anotar `T_fim`. **RTO medido = T_fim − T_inicio.**
9. Registrar em §5.
10. Derrubar o ambiente e apagar os volumes.

### 4.2 🔴 O índice que o `migrate deploy` não recria sozinho

Dois índices parciais únicos vivem **apenas no SQL das migrations**, fora do
schema do Prisma:

- `performances_one_live_per_event_musician`
- `band_members_one_accepted_leader`

Um `migrate dev` que gere `DROP INDEX` para eles precisa ter o DROP removido à
mão (CLAUDE.md). Depois do restore, **conferir que os dois existem** — a ausência
não quebra nada visivelmente, só deixa de impedir dois sets ao vivo simultâneos
para o mesmo músico:

```sql
SELECT indexname FROM pg_indexes
WHERE indexname IN ('performances_one_live_per_event_musician',
                    'band_members_one_accepted_leader');
-- Esperado: 2 linhas.
```

### 4.3 Critérios de sucesso

O drill só passa com **todos**. 🤖 = verificado por `npm run drill:verify`
(`scripts/verify-restore.ts`); 👤 = manual, porque depende de serviço de pé.

- [ ] 👤 Aplicação sobe e `GET /api/v1/health` responde 200.
- [ ] 👤 Login funciona com um usuário real do ponto restaurado (prova que os
      dois bancos estão no mesmo instante). O script cobre só o lado que alcança
      sem o Keycloak: que todo `musician.id` tem formato de `sub`.
- [ ] 🤖 **Um `MusicianWallet` com token de Mercado Pago decifra** — é o único
      teste que prova que a chave do §1.2 sobreviveu junto com o dado. Sem ele, o
      restore parece bom e não é.
      ⚠️ O seed passou a criar uma carteira vinculada **por causa deste
      critério**: sem ela o script reportava "não pôde ser exercido", que não é
      o mesmo que passou.
- [ ] 🤖 Contagem de `bookings`, `contracts` e `booking_escrows` bate com o
      esperado para o ponto escolhido.
- [ ] 🤖 `held_balance` somado bate com os `booking_escrows` em `held` — custódia
      inconsistente depois de restore é dinheiro retido sem contrapartida.
- [ ] 🤖 Os dois índices do §4.2 existem.
- [ ] 👤 Um PDF de contrato é baixável do bucket restaurado.
- [ ] 👤 **RTO medido ≤ 4 h** e **RPO medido ≤ 5 min**.

### 4.4 Quando o drill falha

Falhar é o objetivo do exercício — é o momento barato de descobrir. Registre em
§5 com a causa, abra a correção como tarefa, e **repita o drill em até 7 dias**.
Drill falhado sem repetição agendada é a mesma armadilha da cláusula que nunca é
emitida: parece cobertura, não é.

---

## 5. Registro dos drills

| Data | Ponto restaurado | RTO medido | RPO medido | Resultado | Observações |
|------|------------------|-----------|-----------|-----------|-------------|
| — | — | — | — | **nenhum drill executado** | Não há produção. Primeira execução: junto com o primeiro deploy |

> ⚠️ **A tabela acima continua vazia de propósito, e não deve ser preenchida com
> a execução de 01/set/2026.** O que rodou naquele dia foi o *verificador*
> contra o banco de desenvolvimento — não houve restauração de backup nenhum,
> logo não há RTO nem RPO a medir. Registrar aquilo aqui daria a impressão de
> cobertura que não existe, que é exatamente o que o §4.4 alerta.
>
> O primeiro drill de verdade é o do primeiro deploy.

---

## 6. Dívidas de infraestrutura conhecidas

Registradas aqui porque afetam restauração e reprodutibilidade, e não têm dono
em nenhum outro documento.

- **Node 20 em produção, Node 22 no CI e no desenvolvimento.** O `Dockerfile`
  usa `node:20-alpine`; o CI e a máquina local usam 22. O job `docker` do CI é o
  único ponto que exercita o Node 20. Alinhar os três na próxima janela de
  manutenção.
- **`yt-dlp` fixado em `latest` no `Dockerfile`.** É deliberado (versão velha
  quebra o pipeline de IA — ver o comentário lá), mas significa que **a imagem
  não é reproduzível byte a byte**. Para reconstruir exatamente a imagem de uma
  data, é preciso saber qual versão era `latest` naquele dia; o SBOM gerado pelo
  workflow de segurança não cobre binário baixado por `wget`.
- **Sem registry de imagem.** O CI constrói a imagem e a descarta. Rollback hoje
  é rebuild, não redeploy de tag — o que faz o RTO depender de o build funcionar
  no pior momento possível.

---

## 7. Documentos relacionados

- [`incident-response.md`](incident-response.md) — o que fazer quando algo já
  aconteceu, incluindo prazo da ANPD
- [`../auth/keycloak.md`](../auth/keycloak.md) — realm, clients, usuários
- [`../contract/legal-checklist.md`](../contract/legal-checklist.md) — 🔴 gate
  jurídico ainda aberto
