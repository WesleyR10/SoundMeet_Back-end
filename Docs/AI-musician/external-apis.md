# APIs Externas — Letras e Metadados

Provedores complementares ao **pipeline próprio de cifras** (`ai-cifra-module`). Acordes vêm da inferência interna; este doc cobre apenas letras, LRC e metadados auxiliares.

## Letras sincronizadas (LRC)

| Provedor | Uso | Restrições |
|----------|-----|------------|
| **LRCLIB / LRCGET** | LRC sincronizada (seed + fallback) | Comunitário/best-effort: score de match, `quality_flags`, negative cache |
| **UGC (músico)** | Repertório autoral | Conteúdo próprio, armazenável e editável livremente |

Ver implementação em [chord-sheet.md](chord-sheet.md).

## Metadados e letras plain (opcional)

| Provedor | Uso | Restrições |
|----------|-----|------------|
| **Vagalume** (BR) | Letras + metadados PT-BR | API oficial; atribuição + link; rate limit. **Sem cliente implementado** — documentado como opção futura. |
| **Musixmatch** | Escala global | Licenciado; cache local restrito no plano Enterprise. **Sem cliente implementado** — documentado como opção futura. |
| **Genius** | Metadados/anotações | Letra completa comercial exige licença. **Cliente implementado (`GeniusHttpClient`) só extrai metadados (song_id/url/full_title) pra link-out — nunca persiste o texto raspado da página como LRC (corrigido jul/2026, violava esta mesma regra antes).** |

## APIs de teoria musical (acordes isolados)

Úteis para diagramas e referência — **não** substituem o pipeline de cifra por música:

| API | O que fornece |
|-----|---------------|
| [Chords API](https://chords.alday.dev) | Diagramas de acordes isolados (C, Gmaj7…) |
| [Scales-Chords](https://www.scales-chords.com) | Diagramas + sons embed |
| [ChordMini](https://chordmini.me) | Reconhecimento de acordes em áudio (referência técnica) |

## Estratégia SoundMeet

1. **Cifras** — pipeline próprio (`ai-cifra-module` + worker MIR).
2. **Letras LRC** — LRCLIB + ingest UGC — [chord-sheet.md](chord-sheet.md).
3. **Fallback** — link-out ou só acordes quando letra não estiver disponível/licenciada.
