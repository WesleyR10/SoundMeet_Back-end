# Cifra pessoal e comunidade

> Parte das [regras de negócio](../README.md) — o que a API já faz, por domínio.
> Marcações: `[x]` implementado · `[~]` parcial · `[ ]` pendente.

*Seção original: “Domínio Personal Chord Sheet (Cifra Pessoal e Comunidade)”.*


> A versão que o músico tem de uma cifra gerada pela IA. Guarda **o que ele
> mudou** (overlay), não uma cópia: a original em `music_library.chord_sheet`
> permanece imutável e continua servida a todos.

## Criação e unicidade
- [x] **A cifra original da IA é imutável.** Nenhuma operação da cifra pessoal escreve em `music_library.chord_sheet` — o fork é a camada por cima.
- [x] **Um fork por música por músico.** Índice único `(musician_id, music_library_id)` no banco; a checagem na aplicação é só o caminho feliz. Dois POSTs simultâneos: o segundo recebe **409**.
- [x] **Qualquer música de qualquer artista pode ser cifrada e editada** — não existe restrição de catálogo. O músico busca (`ai-cifra/search`), analisa, e a análise materializa a linha dele em `music_library`.
- [x] O fork é criado sobre a **linha do próprio músico** em `music_library`. Isso não limita *quais músicas* (`music_library` é biblioteca **pessoal**, não catálogo global: `musicianId` é obrigatório e a linha carrega `notes`/`isFavorite`/`difficulty` do dono, e cada músico tem a sua própria linha da mesma música). Limita *qual linha*: o use-case base lança `NotFoundError` quando a linha é de outro músico, que é o que impede editar a cifra pessoal alheia.
- [x] O fork nasce **sem nenhuma edição**, ancorado no `base_fingerprint` (sha256 do timeline normalizado) da análise vigente.

## Overlay de edições
- [x] Seis tipos de edição: `replace_chord`, `insert_chord`, `delete_chord`, `shift_chord`, `relabel_section`, `annotate`. Máximo de **500 por fork**.
- [x] As edições são ancoradas por **(instante, símbolo)**, nunca por índice — índice não sobrevive a uma re-análise que insira ou remova um acorde.
- [x] Edição que não acha mais onde ancorar vira **conflito explícito** e não é aplicada: `anchor_not_found`, `symbol_mismatch`, `ambiguous_match`, `unparseable_symbol`, `out_of_range`. O músico revisa dois conflitos; ele não descobre no palco que a cifra saiu do lugar.
- [x] Símbolo de acorde que o sistema não entende é **preservado verbatim**, nunca descartado.
- [x] O matching é **enarmônico**: o músico gravou `Db`, a IA re-analisou como `C#`, a correção dele continua valendo.
- [x] **O músico edita o que VÊ; o overlay guarda no tom ORIGINAL** *(25/set/2026)*. `ApplyChordEditsUseCase` desfaz o deslocamento da view atual (`transpose − capo`) em `from`/`to`/`symbol` antes de gravar. 🔴 Sem isso, com a cifra transposta, o `from` exibido (`A`) não casava com o base (`G`) → `symbol_mismatch`, e "corrigir" não fazia nada; e o acorde escolhido era gravado como base e **transposto de novo** na exibição.
- [x] **O casamento tolera a simplificação exibida** *(25/set/2026)*. Com "acordes básicos", a tela mostra `Am` onde o base é `Am11`; `symbolsMatch` aceita o base simplificado em qualquer dos três níveis, para a correção não virar conflito se o músico trocar a simplificação depois. Fundamental ou qualidade diferentes continuam não casando.
- [x] **Corrigir/remover ancora pelo tempo DO ACORDE, não da palavra** *(mobile, 25/set/2026)*. O token carrega `chordStartMs`; mandar o `startMs` da palavra caía fora da tolerância de 250 ms e virava `anchor_not_found` — 200 na resposta e nada na tela.

## Visualização
- [x] Tom, capotraste, complexidade, instrumento e velocidade de rolagem são **parâmetros de visualização**, nunca gravados no acorde. Um único artefato serve todos os tons.
- [x] Deslocamento efetivo = `transpose_semitones − capo_fret`. Transpor +2 com capô 2 devolve as **mesmas formas** — que é o ponto do capotraste.
- [x] A rota `/chord-sheet` aceita overrides de query **efêmeros**: sobrepõem a view salva só naquela resposta, sem persistir nada.

## Re-análise da IA (reconciliação)
- [x] Quem detecta que a IA re-analisou é o **`base_fingerprint`**, não `base_version` — `MusicLibrary.updateChords()` não incrementa versão, então a coluna é advisory e está sempre em 0.
- [x] **Leitura não escreve.** A divergência é sinalizada (`base_changed: true`, `reconcile_status: "base_updated"` na resposta) mas o fork no banco não é tocado: reconciliar é ato explícito do músico.
- [ ] Use-case de reconciliação (`markReconciled`) — **pendente**, Bloco 8C do roadmap.

## Compartilhamento
- [x] Fork é **privado por padrão**. Escopos: `private` | `band` | `community`.
- [x] `band` libera para os músicos que dividem alguma banda com o autor, contando só membros com `status = "accepted"`.
- [x] `community` publica para qualquer músico da plataforma, **somente leitura**.
- [x] **As anotações pessoais (`notes`) nunca são visíveis para terceiros** — nem na comunidade, nem para o par de banda, nem para o admin. É o único campo redigido na leitura de terceiro (`is_owner` derivado do dono real do fork, nunca afirmado pelo controller).
- [x] ⚠️ **A edição `annotate` NÃO é privada.** Ela também é texto livre, mas vive em `edits[]` e é publicada junto com as correções — são duas gavetas diferentes: `notes` é o **caderno** (privado), `annotate` é **recado colado na cifra** (compartilhado). Defensável por desenho, mas a UI precisa deixar explícito no momento de escrever, senão o músico publica sem querer.
- [x] Descompartilhar tem **efeito imediato**, sem carência.
- [x] Fork da comunidade não é lido "no lugar" do próprio: o leitor **importa**, e as correções são reancoradas contra a análise dele. As que não ancoram voltam como conflito e não entram.

## Planos
- [x] Editar, transpor e usar cifra é **core em todos os tiers** (coerente com `music_library_access: true` nos três).
- [x] `max_personal_chord_sheets` — FREE: 3; ESSENCIAL e PRO: ilimitado.
- [x] `chord_sheet_community_sharing` — FREE: não; ESSENCIAL e PRO: sim. Compartilhar com a **própria banda não é gateado** em nenhum tier.
- [x] **Grant-at-action:** o limite é cobrado no fork e no import, **nunca na leitura**. Quem cai de plano continua abrindo e tocando as cifras que já tem.

## Moderação
- [x] Admin pode remover **qualquer** fork (takedown) via `DELETE /admin/personal-chord-sheets/:id`.
- [x] A navegação de moderação (`GET /admin/personal-chord-sheets`) só lista o que está **publicado na comunidade** — o admin não *descobre* fork privado por listagem.
- [x] O admin **lê qualquer fork por id**, inclusive `private`, por `GET /community/personal-chord-sheets/:id` e `/:id/chord-sheet`: `resolveAccess` manda `requesting_musician_id: undefined`, que é o bypass de moderação do `CheckPersonalChordSheetAccessUseCase` (retorna antes de consultar `share_scope`). Vê as correções, a view e a cifra renderizada com a letra; **`notes` continua redigido**, porque `is_owner` sai `false`. Decisão consciente (jul/2026): o admin é o próprio fundador, e restringir seria proteger o dono do produto dele mesmo. **Revisar no dia em que existir admin que não seja o dono** — a role passa a dar leitura de qualquer cifra privada a quem a tiver.
- [x] `PERSONAL_CHORD_SHEET_COMMUNITY_ENABLED=false` derruba a comunidade inteira sem deploy; as rotas do dono seguem intactas.
- [ ] Denúncia (`POST /:id/report`) — **pendente**, Bloco 8C.1.
