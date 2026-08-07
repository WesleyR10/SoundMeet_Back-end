# Plano de Implementação — Folha de Cifra (Letra + Acordes)

Este documento é a **fonte única** sobre a folha de cifra (renderização estilo tablatura/letra sincronizada) com API estável e renderização por tokens (não por colunas de caracteres). Consolida LRCLIB/LRC + bulk + API e integração com o pipeline de cifra (`ai-cifra-module` — ver [pipeline-overview.md](pipeline-overview.md)).

## Objetivo final

- Gerar automaticamente (a partir de áudio) BPM/beat, acordes com timestamps, tonalidade e segmentação estrutural, via job/fila + worker (padrão já existente no backend).
- Obter/ingerir letras (preferencialmente sincronizadas em LRC) e normalizá-las.
- Produzir e servir um artefato “Chord Sheet” unificado: `lyrics(tokens + timestamps) + chords(timeline) + anchors(alinhamento)`.

## Estado atual (o que já existe e é reaproveitado)

- Pipeline de cifra no padrão job/fila/worker já existe no backend: `src/nest-modules/ai-cifra-module/*` (controllers, dispatcher e consumers) e tabelas correspondentes no Prisma.
- Infra compartilhada já existe:
  - Postgres/Prisma
  - Redis cache global via `DatabaseModule`
  - RabbitMQ via `RabbitmqModule`
  - `ValidationPipe` global retornando 422

## Artefato alvo (Chord Sheet)

Formato recomendado para suportar renderização estável em qualquer fonte/tela:

- `lyrics.normalized`: sections → lines → tokens
  - `token`: `{ text, kind: "word"|"punct"|"space", normalized, startMs?, endMs? }`
- `chords.timeline`: `{ startMs, endMs?, symbol, confidence }[]`
- `alignment.anchors`: mapeamento `{ chordIndex -> { sectionIndex, lineIndex, tokenIndex } }`
- `meta`: `{ provider, matchScore?, pipelineVersion, modelVersion?, qualityFlags }`

## Plano (resumo da conversa)

### Base de rotas (padrão atual)

- O backend usa prefixo global `api/v1` em `main.ts`; controllers definem apenas o recurso (ex.: `@Controller("requests")` em `requests.controller.ts`).

### Modelo de dados (LRC no Postgres/Prisma)

- Recomendação (mínima e consistente com o schema atual): evoluir `MusicLibrary` (tabela `music_library`) em `schema.prisma` para armazenar LRC “raw”, normalizado e metadados de origem/qualidade.
- Campos sugeridos (todos opcionais, exceto onde indicado):
  - `lrc_raw: String?` (texto LRC original)
  - `lrc_normalized: Json?` (formato canônico: linhas/timestamps + metadata)
  - `lrc_provider: String?` (`lrclib` | `ugc` | outros)
  - `lrc_provider_meta: Json?` (score, ids externos, URL, etc.)
  - `lrc_hash: String?` (hash do raw para idempotência/dedupe)
  - `lrc_version: Int @default(1)` (versão do artefato)
  - `lrc_pipeline_version: Int @default(1)` (versão do parser/normalizer)
  - `lrc_quality_flags: String[] @default([])` (ex.: `out_of_order`, `low_coverage`)
  - `lrc_coverage_ms: Int?`, `lrc_has_word_timestamps: Boolean @default(false)`
  - `lrc_last_synced_at: DateTime?`
- Campos auxiliares para busca/cache:
  - `artist_normalized: String?`, `title_normalized: String?`, `duration_ms: Int?` (se a plataforma tiver duration por track)
- Índices recomendados:
  - `@@index([artist_normalized, title_normalized])` (lookup/match)
  - `@@index([source, sourceId])` (dedupe do catálogo atual)
  - `@@index([lrc_provider])` e/ou `@@index([lrc_last_synced_at])` (operacional/bulk)

### Estratégia de cache (Redis já global)

- Infra de cache Redis já existe via `CacheModule` em `database.module.ts`.
- Chaves recomendadas:
  - Match LRCLIB: `synced_lyrics:match:{artistN}:{titleN}:{durationBucket}`
    - TTL hit: 1–7 dias; TTL negative cache (not found): 5–60 min.
  - Resposta “chord-sheet”: `chord_sheet:{musicLibraryId}:{lrc_version}:{updated_at_epoch}`
    - TTL: 5–30 min (ou cache bust por versão + `updated_at`).
- Política: leitura sempre prioriza DB/cache; fetch LRCLIB é best-effort e nunca bloqueia o “read path” em tempo real.

### Endpoints REST (contratos e responsabilidade)

- Leitura (público/app):
  - `GET /api/v1/music-library/:id/synced-lyrics`
    - Retorna `normalized` como padrão; `raw` somente quando solicitado (`includeRaw=true`) e permitido.
  - `GET /api/v1/music-library/:id/synced-lyrics/download`
    - Download do LRC raw (`text/plain; charset=utf-8`).
  - `GET /api/v1/music-library/:id/chord-sheet`
    - Retorna artefato unificado: `lyrics(normalized) + chords + anchors/meta`.
- Escrita/ingest (músico/admin):
  - `POST /api/v1/music-library/:id/synced-lyrics`
    - Upload/ingest de LRC (origem `ugc` ou `admin`), com validação estrita e idempotência por `lrc_hash`.
  - `POST /api/v1/music-library/:id/synced-lyrics/sync`
    - Força re-fetch LRCLIB + re-normalização (admin/internal).
- Busca/match:
  - `GET /api/v1/synced-lyrics/search?artist=&title=&durationMs=`
    - Retorna candidatos com score + indicação de cache hit/miss (via `meta`).

### Bulk (seed 10k) e filas (RabbitMQ)

- Padrão a seguir: consumidores/validação via `ValidationPipe` e use-cases, como em `ai-cifra.consumers.ts`.
- Routing keys (exemplo):
  - `ai-musician.lrc-bulk.requested`, `.progress`, `.completed`, `.failed`
- Job entity (core) no mesmo estilo `AiCifraAnalysisJob`:
  - `job_id`, `status`, contadores (`total/processed/success/failed`), `started_at/finished_at`, erros agregados por `error_code`.
- Modos suportados:
  - A (externo/offline): LRCGET roda fora; backend só recebe ingest.
  - B (interno): backend enfileira tracks e processa com worker/consumers.

### Validação/parsing/sanitização (pipeline)

- Pipeline:
  - `parseLrc(raw) -> AST`
  - `validateLrc(AST) -> erros estruturados`
  - `normalize(AST) -> JSON canônico`
  - `computeQuality(AST) -> flags/métricas`
- Regras mínimas:
  - limite de tamanho (ex.: 256KB–1MB), limite de linhas, UTF-8
  - timestamps aceitos `[mm:ss.xx]` e variantes comuns
  - rejeitar timestamps fora de ordem (ou normalizar com flag) e formatos inválidos
- Erros devem seguir o padrão `notification + EntityValidationError`, como nos use-cases existentes.

### Rate limiting e segurança

- Variáveis `RATE_LIMIT_TTL/MAX` já existem no schema de config.
- Observação: `@nestjs/throttler` não aparece nas dependências atuais. Plano:
  - opção 1: adicionar `ThrottlerModule` e aplicar guards por rota (bulk/search/upload)
  - opção 2 (sem dependência nova): quota/rate-limit via Redis em middleware/guard próprio
- Endpoints internos (progress/completion de bulk) devem ser protegidos por token no header, no padrão do `ai-cifra-module`.

### Testes, observabilidade e critérios

- Testes unitários:
  - parser/validator/normalizer (válidos, inválidos, extremos)
  - match scoring + normalização de artista/título + tolerância de duração
  - cache (hit/miss/negative cache)
- Testes de integração:
  - repositório Prisma (search + índices)
  - controllers (contratos HTTP e códigos)
- Observabilidade:
  - logs estruturados com `job_id` e `musicLibraryId` (correlation)
  - métricas: `coverageLrc`, `parseSuccessRate`, `p95FetchLatency`

### Próximo passo prático

- Implementar primeiro o “Modo A (externo/offline)” + endpoints de ingest/leitura/cache; depois evoluir para bulk interno com RabbitMQ seguindo o padrão já consolidado em `ai-cifra` e `ai-audio`.

## Pontos importantes dos Docs (o que é necessário para implementar corretamente)

### Integração com cifra (ponto de acoplamento)

- A “folha de cifra” exige unir duas linhas do tempo:
  - `chords.timeline` (do pipeline MIR, com timestamps e confidence)
  - `lyrics` com timestamps (preferencialmente LRC) para ancorar acordes na letra
- Quando existir LRC sincronizado (linhas/palavras), o alinhamento é determinístico por tempo.

### Sincronização acorde ↔ letra (modos)

- Modo A (melhor precisão): ASR/forced alignment com timestamps de palavras.
  - Opcionalmente usar separação vocal (quando existir e fizer sentido operacional).
- Modo B (fallback): heurístico, baseado em timestamps de linha do LRC + distribuição proporcional por tokens (peso por tamanho de caractere). **Correção (jul/2026):** a spec original citava "beat grid/compassos do áudio" — a implementação real nunca consultou beat-grid, só as timestamps de linha do LRC já sincronizado. Documentado aqui pra bater com o código (`findAnchorForChord`/`pickTokenIndexByWeightedFraction` em `get-chord-sheet-for-music-library.use-case.ts`).

### Provedores e compliance (impacta armazenamento e cache)

- Para letras “plain” (não sincronizadas), provedores têm restrições de direitos/caching.
- Para LRC (LRCLIB), tratar como best-effort com auditoria, score de match e negative caching.
- Regras de cache por “direito de armazenamento”:
  - Metadados de match: TTL longo.
  - Letra completa: respeitar termos do provedor (quando não houver direito, usar link-out e não persistir).
  - Resultados derivados (anchors/timeline) são persistíveis quando a letra for armazenável/licenciada ou quando for UGC.

### Seed (catálogo 10k) para validar cobertura

- Congelar snapshot do catálogo (mensal, por exemplo) e medir:
  - `coverageLrc`
  - taxa de parse
  - latência p95 de fetch (com cache)

## Estrutura de implementação no backend (alinhada ao padrão existente)

Estrutura recomendada (espelhando módulos de job já existentes e respeitando DDD/Clean/Hexagonal):

```
src/core/synced-lyrics/
  application/
    use-cases/
    validations/
  domain/
    entities/
    repositories/
    validators/
    value-objects/
  infra/
    db/
      prisma/
      in-memory/

src/nest-modules/synced-lyrics-module/
```

## Sincronização acorde ↔ letra (modos)

- **Modo A (melhor precisão)** — ASR/forced alignment com timestamps de palavra:
  1. extrair vocal (Demucs); 2. rodar forced alignment usando a própria letra como script; 3. gerar `wordIntervals`; 4. para cada acorde em `t`, ancorar no token cujo intervalo contém `t` (ou `argmin |t - startMs_i|`). Vários acordes entre duas palavras → ancorar no mesmo token (lista compacta).
- **Modo B (fallback heurístico)** — sem timestamps de palavra: distribuição proporcional por tokens dentro da janela `[start_ms, end_ms]` da linha do LRC (peso por tamanho de caractere), **não** beat grid/compassos do áudio (a spec original citava isso, mas nunca foi implementado assim — ver correção acima).
- "Sílaba" exige segmentação fonética; **palavra** é o melhor custo/benefício (sílaba = fase 2).

### Estado da implementação — Modo A (jul/2026)

Implementado nesta rodada, ver `ai-cifra-mir-worker/app/lyrics_alignment_service.py` (worker) + `AlignSyncedLyricsWordTimestampsUseCase` (`src/core/synced-lyrics/application/use-cases/align-synced-lyrics-word-timestamps/`):

- **Ferramenta:** `ctc-forced-aligner` (pip puro, PyPI, versão fixada `1.0.2`) — modelo `MahmoudAshraf/mms-300m-1130-forced-aligner` no HuggingFace, mesma família MMS/wav2vec2-CTC multilingual (Meta) que uma versão anterior usava via `torchaudio.pipelines.MMS_FA` diretamente. Trocado (jul/2026, 2ª rodada) pela versão empacotada porque romanização (uroman) já vem embutida e testada pelo pacote, em vez de reimplementada na mão. Ainda em vez de Montreal Forced Aligner (MFA, precisão mais estabelecida na literatura) porque MFA exige Kaldi + conda + dicionário fonético por idioma, e este worker é pip/PyTorch puro (sem conda no Dockerfile). Se a precisão se provar insuficiente num teste real, considerar MFA como worker separado.
- **Arquitetura — alinha LINHA POR LINHA, não o áudio/texto inteiro de uma vez (jul/2026, 3ª rodada, corrigido a partir de uma pergunta direta do usuário):** uma versão anterior concatenava todas as linhas da letra num texto único, mandava numa chamada só (áudio inteiro + texto inteiro) e recortava o resultado achatado de volta em linhas contando palavras. Isso tinha dois problemas reais: (1) jogava fora a fronteira de linha que o próprio LRC **já dá** (`start_ms`/`end_ms` por linha, dado sincronizado confiável) só pra reconstruí-la depois por contagem de palavra — trabalho desnecessário; (2) a reconstrução assumia, sem verificar contra o código-fonte real do pacote, que a romanização preserva 1:1 a contagem de palavras do texto concatenado — se isso falhar num caso de borda, palavras de uma linha podem ser silenciosamente atribuídas à linha ERRADA. Corrigido: cada linha agora é alinhada contra o recorte de ÁUDIO daquela linha (janela `[start_ms, end_ms]` do próprio LRC, com margem de 500ms de folga pra compensar timestamp de linha impreciso) numa chamada independente — sem concatenação, sem reconstrução; um eventual desvio de contagem de palavra por romanização fica contido a uma linha só (a linha inteira é descartada se a contagem não bater, nunca contamina outra linha). Trade-off consciente: perde o contexto de áudio/texto de linhas vizinhas que uma passada única teria; ver docstring completa em `lyrics_alignment_service.py`.
- **⚠️ NÃO validado empiricamente ainda** — escrito num ambiente sem GPU/torch instalados; a API foi conferida contra a documentação oficial do torchaudio, mas nunca rodou de ponta a ponta contra áudio real. Antes de confiar nisso em produção: rodar contra 2-3 músicas reais (PT-BR e EN) com LRC conhecido-bom e conferir visualmente os limites de palavra.
- **⚠️ Limitação arquitetural real, não é um detalhe de implementação:** o worker de análise de cifra (`ProcessAiCifraAnalysisJobUseCase`/`CompleteAiCifraAnalysisJobUseCase`) **apaga o áudio original do storage imediatamente após a análise de acordes terminar**. O alinhamento de letra só pode rodar nesse exato momento (áudio ainda existe) — e só se a letra **já estiver sincronizada** nesse ponto. Ou seja: **só funciona quando o fluxo é "sincronizar letra primeiro, depois rodar análise de cifra"**; na ordem inversa (cifra primeiro, letra depois — provavelmente a mais comum), o áudio já foi apagado quando a letra chega, e não há re-tentativa. Não foi implementado (nem faria sentido sem mudar a política de retenção de áudio, fora de escopo desta rodada) um gatilho pelo lado do sync de letra — só existe o gatilho em `ProcessAiCifraAnalysisJobUseCase`/`CompleteAiCifraAnalysisJobUseCase`, logo antes do `deleteObject`.
- Quando o alinhamento roda com sucesso, `SyncedLyrics.applyWordAlignment()` popula `lrc_normalized.lines[i].words` com timestamps reais — o código de leitura (`get-chord-sheet-for-music-library.use-case.ts`, `coerceLineWords`/`hasWordLevelTimings`) **já sabia consumir esse formato antes desta mudança**, não precisou de nenhuma alteração.

## Provedores de letra e compliance

Impacta diretamente o que pode ser **armazenado/exibido/cacheado**:

| Provedor | Uso | Restrições |
|----------|-----|-----------|
| **LRCLIB** | Primário p/ LRC sincronizada (seed 10k + fallback) | Comunitário/best-effort: tratar com score de match, `quality_flags` e negative cache. Não é licença de exibição. |
| **Vagalume** (BR) | Letras/metadados PT-BR | API oficial gratuita, exige atribuição + link; **não concede direito de exibição**; rate limit/captcha por IP. |
| **Musixmatch** (global) | Escala/compliance forte | Licenciado; **proíbe cache/armazenamento local** fora do Enterprise; quotas por dia. |
| **Genius** | Apenas metadados/anotações | Uso comercial de letra completa **não permitido** sem licença. |
| **UGC (próprio músico)** | Repertório autoral | Melhor caso: conteúdo próprio, armazenável e alinhável livremente. |

**Regra de cache por direito de armazenamento:** metadados de match (TTL longo) ✓; letra completa só conforme termos do provedor (sem direito → link-out, não persistir); resultados derivados (`anchors`/timeline) persistíveis quando a letra for armazenável/licenciada ou for UGC.

**Correção (jul/2026):** `SyncSyncedLyricsForMusicLibraryUseCase` fazia scrape da letra completa da página do Genius (`data-lyrics-container`) e persistia como LRC sintética (timestamps uniformes fabricados) — violava a própria regra acima, já que não há evidência de licença Genius no projeto (nenhuma env var de licenciamento). Corrigido: o fallback Genius agora só captura `song_id`/`url`/`full_title` (metadados) e devolve como link-out (`external_link` no erro 404-equivalente lançado quando não há LRCLIB/UGC disponível); nunca mais monta/persiste uma LRC a partir do texto raspado. Ver `align-synced-lyrics-word-timestamps` — testes de regressão em `sync-synced-lyrics-for-music-library.use-case.spec.ts`.

## Fallback (quando provedor falha / letra incompleta)

1. provider primário (ex.: Musixmatch) → quota/timeout →
2. provider secundário (ex.: Vagalume) → captcha/rate limit →
3. link-out para a página do provedor (sem trazer o texto) →
4. letra fornecida pelo músico (UGC) →
5. exibir só acordes + estrutura (sem letra), mantendo utilidade.

Implementação real hoje: LRCLIB (busca + get) → Genius (link-out apenas, ver correção acima) → 422 com `external_link` quando só o Genius achou algo. Vagalume/Musixmatch **não têm cliente implementado** — só documentados aqui como opção futura.

## Normalização de letra (parser único)

Transformar qualquer entrada (plain text / HTML / JSON) no formato canônico:
- **Plain text**: preservar quebras; detectar marcadores (`Refrão`, `[Chorus]`, `[Verse]`) → `section.kind`; linhas vazias = separadores.
- **HTML**: `<br>/<p>` → `\n`; remover tags mantendo texto e entidades.
- **JSON**: por provedor (ex.: Vagalume retorna `text`); sempre mapear para `rawText` + `providerMeta`.
- **Casos especiais**: pontuação como token próprio; contrações/hífens com regra estável; refrões repetidos podem ser referência (render expande).

## Meta de precisão (verificável no backend)

- `ChordAnchorAccuracy` = acordes ancorados no token correto / total (reportar strict e tolerant ±1 token), sobre um conjunto gold com alinhamento manual.
- Cobertura PT-BR + EN, refrão repetido, partes faladas, melismas.
- Render por token-grid garante invariância de tela; reflow só redistribui tokens, não altera anchors.

**Correção (jul/2026) — duration mismatch no auto-sync:** `pickBestLyrics` (usado pelo fluxo de auto-sync, `POST .../synced-lyrics/sync`) não considerava duração ao escolher entre candidatos do LRCLIB — diferente do endpoint irmão de busca manual (`MatchSyncedLyricsOnLrclibUseCase`), que já pontuava duração. Isso podia casar a letra de uma versão diferente da música (ex.: rádio edit vs. ao vivo estendido) sem penalidade nenhuma, quebrando a precisão dos anchors rio abaixo (os `startMs` dos acordes vêm do áudio completo, não da LRC casada). Corrigido: mesma fórmula de pontuação por bucket de diferença de duração (`≤2s→1.0, ≤6s→0.8, ≤12s→0.6, senão 0.3`) nos dois fluxos agora; picks com diferença `>12s` ganham a flag `duration_mismatch` em `lrc_quality_flags`, visível no `meta.qualityFlags` do chord-sheet.


