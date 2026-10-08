# Subsistema de IA Musical

Contrato entre o backend e o worker de IA (serviço à parte, fora deste repositório): separação de áudio, cifras e folha de cifra (letra + acordes).

| Documento | Escopo |
|-----------|--------|
| [folha-de-cifra.md](folha-de-cifra.md) | **Fonte única** — spec da folha de cifra: LRC, bulk, endpoints, cache, compliance |
| [modo-ensaio.md](modo-ensaio.md) | Modo Ensaio (stems + cifra sincronizada) |
| [casamento-de-faixa-no-spotify.md](../funcionalidades/casamento-de-faixa-no-spotify.md) | Como a música vira link do Spotify |
| [apis-de-letras-e-metadados.md](apis-de-letras-e-metadados.md) | Letras LRC e metadados (complemento ao pipeline de cifras) |

## Módulos no código

- `src/nest-modules/ai-cifra-module/` — jobs de análise de cifra (RabbitMQ + worker)
- `src/nest-modules/ai-audio-module/` — jobs de separação de áudio
- `src/nest-modules/synced-lyrics-module/` — LRC, LRCLIB, chord-sheet materializado
- `src/core/ai-cifra/`, `src/core/ai-audio/`, `src/core/synced-lyrics/`
