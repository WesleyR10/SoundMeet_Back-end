## 1) O que é segment e overlap? (e por que eles dominam o tempo)

### segment (segment_seconds)

- É o tamanho do chunk (em segundos) que o modelo processa em cada “janela”.
- Para o htdemucs, o chunk size é calculado assim:
  - chunk_size = samplerate \* segment
- Exemplo: 44.1kHz e segment=6 → chunk_size ≈ 264.600 samples por janela.
  Efeito prático:

- segment maior → menos janelas para cobrir a música → menos overhead (menos iterações).
- segment maior também → cada janela é maior → mais memória/VRAM e potencialmente mais lento por janela (mas geralmente compensa por reduzir o número de janelas).

### overlap (num_overlap)

- Determina quanto as janelas se sobrepõem quando você “desliza” pelo áudio.
- No código do htdemucs, ele define:
  - step = chunk_size // num_overlap
- Então overlap=2 significa “andar metade do chunk por vez” (50% de sobreposição).
- overlap=4 significa “andar 1/4 do chunk por vez” (75% de sobreposição).
  Efeito prático:

- overlap maior → mais janelas para cobrir a mesma música → mais chamadas de modelo → mais tempo.
- overlap maior → “emendas” ficam mais suaves, porque cada trecho do áudio é visto mais vezes e depois combinado.

### O que significa “melhorar bordas”

Quando você processa áudio em chunks, a transição no ponto onde um chunk termina e o outro começa pode gerar:

- pequenas distorções, “buracos”, variação de fase, ou “costuras” audíveis
- especialmente em transientes (ataques de bateria) e em vocais sustentados
  Mais overlap reduz esses artefatos porque você “esconde” a costura usando informação redundante e uma fusão (no modo “generic” ainda tem windowing/fade explícito; no modo demucs ele faz média por contagem). Isso aparece no counter e no acúmulo do result no demix() : model_utils.py

## 2) O que é “forward” e por que é caro?

Forward (forward pass) é uma execução do modelo neural: você pega um batch de chunks e faz x = model(arr) .

No seu demix() isso acontece aqui: model_utils.py

Por que é caro:

- É onde está o custo pesado de GPU/CPU (convoluções, atenção/transformers etc).
- Cada forward processa uma quantidade grande de dados (chunks estéreo em alta taxa).
- Se você faz muitos forwards pequenos, você paga muito overhead de execução/lançamento de kernels, além do compute em si.
  Interferência no processo:

- Menos forwards (ou forwards mais “cheios”, com batch maior) normalmente = grande queda no tempo total.
- Mas aumentar batch/segment pode estourar memória e causar OOM.

