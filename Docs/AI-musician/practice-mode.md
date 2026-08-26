# Modo Ensaio — separação de stems como produto (S3)

> Entregue em 22/ago/2026. O `ai-audio-module` existia completo e **sem uma
> linha de UI** desde sempre — era o maior ativo desperdiçado do repositório.
> Este doc registra o que foi construído em cima dele e, principalmente, as
> decisões que não são óbvias no código.

---

## 1. O que é

O músico escolhe uma música do repertório, a IA separa a gravação em quatro
faixas (voz, bateria, baixo, harmonia), ele silencia o próprio instrumento e
toca por cima — com a cifra do ChordFormer rolando **no tempo da gravação**.

É Moises + Cifra Club no mesmo app, sobre dois motores que já rodavam.

---

## 2. Três decisões que moldam tudo

### 2.1 🔴 Os stems têm prazo de validade

Esta é a decisão mais importante, e ela é jurídica antes de ser técnica.

O `ai-cifra` **nunca retém a gravação**: baixa o áudio, extrai a cifra e apaga o
objeto no instante em que a análise conclui (`complete-ai-cifra-analysis-job`),
com um purge por TTL como rede de segurança. O sistema guarda o dado derivado,
não a obra.

O `ai-audio`, até aqui, não tinha política nenhuma — `grep` por
`purge`/`deleteObject`/`ttl` em `src/core/ai-audio/` não retornava nada. Cada
separação gravava quatro arquivos de áudio que ficavam no bucket para sempre.

**Stem não é dado derivado no mesmo sentido: stem É a gravação, separada.**
Guardar os quatro por tempo indeterminado, servidos por URL, é uma postura de
direito autoral diferente da que o resto do projeto escolheu deliberadamente —
além de storage crescendo sem teto.

Por isso: `AiAudioSeparationJob.stems_expire_at`, `PurgeExpiredAiAudioStemsUseCase`
de hora em hora, e `AI_AUDIO_STEMS_RETENTION_HOURS` (default 72h). Pedir de novo
custa uma passada de GPU — é o preço combinado.

> ⚠️ O gate jurídico deste bloco **não foi fechado**. A retenção curta reduz a
> exposição; não a elimina. Vale entrar na mesma lista de perguntas ao advogado
> que `contract/legal-checklist.md` já concentra.

### 2.2 `expired` é status próprio, nunca `failed`

A separação deu certo; o que venceu foi o prazo. Sem essa distinção o job
continuaria `completed` com URLs que respondem 404 — a pior resposta possível
para quem abriu o app para ensaiar. O registro do job sobrevive ao áudio: só o
arquivo some, e a tela oferece "separar de novo" em vez de "deu erro".

### 2.3 O app não envia arquivo

Descoberta que mudou a arquitetura: **o mobile nunca fez upload de áudio**, nem
para a cifra. O caminho real é
`POST /musicians/:id/ai-cifra/uploads/from-provider/analyses`, onde o backend
resolve a fonte.

Consequência: como o áudio da biblioteca **não existe mais** (§2.1), o Modo
Ensaio re-resolve a fonte pelo mesmo provider, usando `source`/`source_id` que a
própria análise da cifra gravou em `music_library`. `AiAudioModule` importa
`AiCifraModule` só para reusar o resolver — duplicar a cadeia
SimpMusic/yt-dlp → Musify/Piped num segundo módulo violaria a regra de não
duplicar lógica entre os três módulos de IA.

---

## 3. Rotas

| Rota | Para quê |
|---|---|
| `POST /musicians/:musician_id/ai-audio/practice/separations` | Separar uma música da biblioteca (Modo Ensaio) |
| `POST /musicians/:musician_id/ai-audio/uploads` | Upload de arquivo solto (já existia) |
| `POST /ai-audio/uploads/:id/separations` | Separar um upload (já existia) |
| `GET /ai-audio/separations/:id` | Status + stems + `stems_expire_at` |

**Ownership:** `:musician_id` no path com `MusicianOwnershipGuard`, mas **a posse
da música é checada dentro do use-case**, comparando `song.musician_id`. O guard
prova quem é o usuário, nunca de quem é o sub-recurso — mesma armadilha já
registrada em `personal-chord-sheet`.

Música sem fonte conhecida responde **422 acionável**. Não se inventa busca por
título+artista: traria outra gravação (ao vivo, cover, remaster), que é
exatamente o erro caro documentado em `spotify-track-matching.md`.

---

## 4. O player — onde mora o risco técnico

🔴 **Quatro players nativos independentes não andam juntos sozinhos.** Cada
`play()` agenda no próprio pipeline; a defasagem inicial e a deriva ao longo da
música são reais. Abaixo de ~40ms a diferença some no ataque das notas; acima
disso a bateria "borra" contra o baixo e o ensaio fica inútil.

`usePracticeStems` trata isso com três medidas:

- **Um líder fixo** (o primeiro stem), nunca "quem estiver mais adiantado" — do
  contrário a referência muda a cada tick e todo mundo persegue todo mundo.
- **Correção rala e tolerante** (checagem a cada 250ms, limiar de 40ms). Corrigir
  agressivamente é pior que o problema: `seekTo` audível a cada meio segundo
  vira estalo.
- **Todos os `play()` no mesmo tick do JS** — um `await` entre um e o próximo
  vira defasagem audível logo na entrada.

Não há mixagem no `expo-audio`: não dá para somar buffers em JS. Tirar "o meu
instrumento" tem que ser silenciar uma faixa entre quatro, e por isso as quatro
tocam juntas.

**Isso não foi confirmado em device físico** — vale a mesma ressalva de todos os
blocos do mobile, e aqui com peso maior, porque a qualidade da sincronia é a
feature.

---

## 5. A cifra rola pelo áudio, não por estimativa

No palco não existe gravação tocando, então `usePlayModeAutoScroll` estima o
andamento com um playhead virtual que o músico calibra num slider. No ensaio a
gravação **está** tocando: `usePracticeScrollSync` usa a posição real como fonte
da rolagem — nada a calibrar, e a cifra não desanda ao longo da música.

🔴 **`usePlayModeAutoScroll` não foi alterado.** Aquele hook é o motor da tela de
palco; enfiar um segundo modo de operação dentro dele colocaria o caminho ao vivo
em risco por uma feature de estudo. Os dois compartilham só os helpers puros de
`chord-sheet-timing` e o componente de renderização.

O mapeamento é proporcional (fração do áudio → fração do peso acumulado das
linhas), porque a cifra não carrega marcação de tempo confiável em toda música.
Arrastar com o dedo dá 4s de trégua antes de o áudio retomar o comando — sem
isso, olhar dois compassos à frente seria impossível.

---

## 6. Por que é uma tela separada do Play Mode

O Play Mode é a tela de **palco**: fonte mínima de 18px, contraste máximo, zero
distração, e é ela que transmite "tocando agora" quando há set aberto. Mesa de
som e controle de velocidade ali contrariam a regra de UX do músico e colocam o
caminho ao vivo em risco.

As duas telas compartilham a renderização da cifra (`PlayModeChordSheetView`) e
**nada de estado**.

---

## 7. O que ficou de fora

- **Loop A/B de trecho.** É o controle que mais falta num modo de ensaio de
  verdade; exige marcar dois pontos e re-seek contínuo nos quatro players.
- **Fader contínuo por stem.** Hoje é mute + solo. O caso de uso é binário e o
  projeto não tem lib de slider — construir um do zero com gesture-handler para
  um ganho que ninguém pediu não se paga.
- **Transposição e capotraste** já existem no Play Mode; não foram trazidos para
  cá porque mudam a cifra, não o áudio, e misturar os dois eixos na mesma tela
  confunde o que está soando.
- **Custo de GPU por usuário.** Cada músico separando a mesma música paga GPU de
  novo. A camada canônica compartilhada de `music_library` (roadmap-web §7) é
  pré-requisito de margem antes de isto escalar — e vale lembrar a restrição de
  **um worker de GPU por vez** em placa de 8GB.
