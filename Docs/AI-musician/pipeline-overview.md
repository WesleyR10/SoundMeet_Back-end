# Pipeline MIR — Visão Geral

Referência de arquitetura e ferramentas para o subsistema de IA musical do SoundMeet. Para implementação no backend, ver [chord-sheet.md](chord-sheet.md) e módulos `ai-cifra-module` / `ai-audio-module`.

## Arquitetura ideal (nível profissional)

```
[Upload Áudio]
    ↓
[Audio Preprocessing]
    ↓
[Source Separation]      ← Demucs (ver audio-separation.md)
    ↓
[Rhythm & Tempo Detection]
    ↓
[Instrument Transcription] ← MT3, Onsets & Frames, etc.
    ↓
[Harmony & Chord Inference] ← CREMA / Chordino
    ↓
[Music Representation Layer] ← MIDI, cifras, MusicXML
    ↓
[API / Frontend]
```

Cada bloco é independente e orquestrado via job/fila + worker (padrão já usado em `ai-cifra` e `ai-audio`).

## Ferramentas consolidadas (2025)

| Etapa | Ferramenta | Uso |
|-------|-----------|-----|
| Separação | **Demucs** (Meta) | Stems: voz, bateria, baixo, guitarra — [github.com/facebookresearch/demucs](https://github.com/facebookresearch/demucs) |
| Transcrição polifônica | **MT3** (Google/Magenta) | Áudio → MIDI multi-instrumento — [github.com/magenta/mt3](https://github.com/magenta/mt3) |
| Piano | Onsets & Frames | Transcrição piano solo |
| Guitarra | GuitarSet + CNNs | Tablatura / notas |
| Baixo | Pitch tracking monofônico | YIN/Cepstrum |
| Bateria | Drum transcription CNNs | Classificação por kit |
| Harmonia | **CREMA** / Chordino | Acordes, tonalidade, inversões |
| Representação | music21, pretty_midi, librosa | Conversão MIDI → cifra, análise teórica |

## Stack em produção (SoundMeet)

O worker atual usa **ChordFormer v12** para inferência de acordes a partir de áudio, sem separação obrigatória. Demucs e MT3 entram como evolução para maior fidelidade polifônica.

**Alinhamento forçado letra↔áudio (jul/2026):** endpoint novo `POST /v1/align-lyrics` no mesmo worker (`app/lyrics_alignment_service.py`) — pacote `ctc-forced-aligner` (HuggingFace, modelo `MahmoudAshraf/mms-300m-1130-forced-aligner`, mesma família MMS/wav2vec2, romanização já embutida) sobre o stem de voz do Demucs, produz timestamps reais por palavra que alimentam o "Modo A" da folha de cifra (ver [chord-sheet.md](chord-sheet.md) "Estado da implementação — Modo A"). **Não validado empiricamente ainda** (escrito sem GPU/torch disponíveis) e só dispara quando a letra já está sincronizada no momento em que a análise de acordes termina — o áudio é apagado do storage logo depois, então não há segunda chance.

## Roadmap prático de estudo (referência)

1. **Fundamentos** — álgebra linear, DSP (FFT, espectrogramas), harmonia, ritmo
2. **Deep Learning** — CNNs, RNNs, Transformers, PyTorch
3. **Audio ML** — Mel/CQT, pitch, beat tracking, source separation
4. **Implementação** — Demucs local → MT3 → MIDI→cifra → heurísticas + feedback

## Custo estimado (GPU cloud)

| Item | Custo mensal |
|------|-------------|
| GPU cloud | US$ 300–1500 |
| Storage | ~US$ 50 |
| Infra API | ~US$ 100 |

Orquestrar modelos open-source costuma sair mais barato que APIs comerciais de transcrição no longo prazo.

## Conclusão

- Não é necessário treinar modelos do zero — orquestrar modelos SOTA existentes.
- Diferencial: pós-processamento musical, experiência do músico, correção colaborativa.
- Letras LRC: [external-apis.md](external-apis.md) · Spec folha de cifra: [chord-sheet.md](chord-sheet.md).

## Documentos relacionados

- [chord-sheet.md](chord-sheet.md) — spec completa da folha de cifra (LRC + acordes)
- [audio-separation.md](audio-separation.md) — tuning Demucs (segment/overlap)
- [external-apis.md](external-apis.md) — letras LRC e metadados complementares
