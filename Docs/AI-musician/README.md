# Subsistema de IA Musical

Documentação do pipeline MIR (Music Information Retrieval): separação de áudio, transcrição, cifras e folha de cifra (letra + acordes).

| Documento | Escopo |
|-----------|--------|
| [pipeline-overview.md](pipeline-overview.md) | Arquitetura MIR, ferramentas (Demucs, MT3, CREMA), roadmap de estudo |
| [chord-sheet.md](chord-sheet.md) | **Fonte única** — spec da folha de cifra: LRC, bulk, endpoints, cache, compliance |
| [audio-separation.md](audio-separation.md) | Tuning Demucs: segment, overlap, performance |
| [external-apis.md](external-apis.md) | Letras LRC e metadados (complemento ao pipeline de cifras) |

## Módulos no código

- `src/nest-modules/ai-cifra-module/` — jobs de análise de cifra (RabbitMQ + worker)
- `src/nest-modules/ai-audio-module/` — jobs de separação de áudio
- `src/nest-modules/synced-lyrics-module/` — LRC, LRCLIB, chord-sheet materializado
- `src/core/ai-cifra/`, `src/core/ai-audio/`, `src/core/synced-lyrics/`
