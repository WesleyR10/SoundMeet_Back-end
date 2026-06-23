# SoundMeet — Visão de Produto

**Conceito:** Som + encontro social · **Slogan:** "Onde o som encontra pessoas"

Plataforma que conecta músicos, público e estabelecimentos em eventos ao vivo via QR code, pedidos musicais, gorjetas e gamificação.

## Documentos relacionados

| Documento | Conteúdo |
|-----------|----------|
| [business-rules.md](business-rules.md) | Regras de negócio × estado no código (`[x]/[~]/[ ]`) |
| [monetization.md](monetization.md) | Planos, preços, estratégias de receita (detalhes de cada feature) |
| [qr-code.md](qr-code.md) | Spec do QR (perfil permanente + validação) |
| [roadmap.md](roadmap.md) | Próximas tarefas de implementação (passo a passo) |
| [AI-musician/](AI-musician/README.md) | Pipeline de cifras e folha de cifra |

## Índice

1. [Fluxo principal](#fluxo-principal)
2. [Ideias futuras (P&D)](#ideias-futuras-pd)
3. [Músicos](#músicos)
4. [Estabelecimentos](#estabelecimentos)
5. [Público](#público)
6. [Gamificação avançada](#gamificação-avançada)
7. [Folha de cifra e pipeline de IA](#folha-de-cifra-e-pipeline-de-ia)
8. [Segmentação por instrumentos](#segmentação-por-instrumentos)
9. [IA e integrações futuras](#ia-e-integrações-futuras)
10. [Memórias musicais](#memórias-musicais)
11. [Marketplace com reels](#marketplace-com-reels)
12. [Resumo de monetização](#resumo-de-monetização)

---

## Fluxo principal

1. **Músico/Banda** — cria perfil → gera QR permanente vinculado ao perfil
2. **Público** — escaneia QR → acessa perfil → pede músicas / vota → dá gorjetas
3. **Estabelecimento** — busca talentos → contrata → analytics de público

---

## Ideias futuras (P&D)

<a id="ideias-futuras-pd"></a>

- **Mood/Emotion (recomendação, playlist, tags)**: base para evoluir “descoberta” e “contexto” usando `chords/key + embeddings`. Referência: https://github.com/AMAAI-Lab/Music2Emotion
- **Restauração/masterização com prompts (premium)**: melhorar qualidade do áudio antes/depois do upload (ex.: reduzir reverb, corrigir clipping, ajustar tonalidade). Referência: https://github.com/AMAAI-Lab/SonicMaster
- **Referência de produto (UX/contexto)**: app de playlist por emoção/contexto para inspiração de fluxo e UI, não é dataset de acordes. Referência: https://github.com/AMAAI-Lab/calm-me-down

---

## Músicos

<a id="músicos"></a>

- **QR Code Permanente**: Código único vinculado ao perfil (não por apresentação)
- **Controle de Pedidos**: Moderação inteligente e limite anti-spam por evento
- **Analytics Detalhados** [(Ver Detalhes)](monetization.md#analytics-detalhados):
  ├── Engajamento: taxa de scaneamento, tempo de interação (relatório pós-evento opcional)
  ├── Preferências: gêneros mais pedidos, horários de pico por categoria musical
  ├── Desempenho: comparação entre eventos, evolução temporal
  ├── Demografia: perfil por categoria musical (rock, sertanejo, pagode) - mais relevante que idade para contexto musical
  │ ├── **Para quem**: Estabelecimentos e músicos
  │ ├── **Vantagem**: Entender o perfil do público que frequenta eventos específicos
  │ ├── **Funcionamento**: Categorização automática baseada nas músicas mais pedidas
  │ └── **Benefício**: Direcionar melhor o repertório e eventos futuros
  └── Monetização: gorjetas por música, momento, frequência (análise por estilo musical)
- **Monetização Especializada** [(Ver Detalhes)](monetization.md#monetização-especializada):
  ├── **Músico Solo**: Gorjetas individuais, metas pessoais
  └── **Banda**: Divisão automática por membro, percentuais customizáveis

### Para Estabelecimentos

<a id="estabelecimentos"></a>

- **Dashboard de Contratação**:
  ├── Busca inteligente por músicos/bandas locais
  ├── Filtros por estilo musical, instrumento, avaliação
  ├── Histórico de performances e engajamento anterior
  ├── Sistema de avaliação e reviews de outros estabelecimentos
  ├── **Visualização de Preços**: Exibição clara do valor/hora cobrado por cada músico
  ├── **Chat Integrado**: Sistema de mensagens direto com músicos para negociação e agendamento
  └── **Agenda Compartilhada**: Visualização da disponibilidade de músicos e bandas em tempo real

- **Analytics de Público**:
  ├── Demografia do público por evento (idade, gênero, preferências)
  ├── Taxa de ocupação e tempo médio de permanência
  └── Preferências musicais por dia da semana e horário

### 🎯 Novas Funcionalidades para Estabelecimentos

- **Busca por Preço**:
  ├── Filtro por faixa de valor/hora dos músicos
  ├── Exibição transparente de cachês públicos
  ├── Comparativo de preços por estilo musical
  └── Ordenação por custo-benefício (avaliação vs preço)

- **Sistema de Comunicação**:
  ├── Chat seguro integrado para negociações
  ├── Confirmação de agendamento com notificações
  └── Histórico completo de conversas por músico

### 🤝 Sistema de Indicação Público-Estabelecimento

- **Indicação de Talentos**:
  ├── Botão "Indicar para Estabelecimento" no perfil do músico
  ├── Formulário simples com motivo da indicação
  ├── Notificação para o estabelecimento com dados do indicador
  └── Sistema de recompensas para indicações que resultem em contratação

- **Gestão de Indicações**:
  ├── Dashboard do estabelecimento com indicações recebidas
  ├── Filtro por localização, estilo musical e disponibilidade
  ├── Sistema de priorização baseado em relevância
  └── Feedback automático para quem indicou (agradecimento)
- **Gestão de Eventos**:
  ├── Agenda integrada com calendário do estabelecimento
  ├── Sistema de confirmação e lembretes automáticos
  └── Pagamentos automatizados via plataforma

- **Marketing e Promoção**:
  ├── Integração com redes sociais do estabelecimento
  ├── Geração automática de artes para eventos
  ├── Campanhas promocionais segmentadas
  └── Cupons de desconto e fidelidade para o público

- **Monetização Parceira**:
  ├── Programa de indicação de músicos (comissão)
  ├── Venda de ingressos antecipados com taxa reduzida
  ├── Patrocínio de eventos e branding exclusivo
  └── Analytics premium sobre tendências do mercado musical

### Para o Público

<a id="público"></a>

- **Experiência de Descoberta**:
  ├── Acesso ao perfil do músico (bio, estilo, histórico)
  ├── Surpresa musical (repertório não revelado em momento algum)
  ├── Conexão emocional com o artista
  ├── Descobrimento de novos talentos locais
  └── **Sistema de Indicação**: Compartilhamento de músicos com estabelecimentos para eventos

- **Sistema de Pedidos Inteligente** [(Ver Detalhes)](monetization.md#sistema-de-pedidos):
  ├── Sugestões baseadas no estilo do músico
  ├── Limite de pedidos por pessoa para evitar spam
  ├── Votação democrática: músico coloca música em votação (repertório próprio ou pedidos aceitos, 2-3 min entre músicas)
  ├── Feedback visual: sistema de visibilidade diferenciada
  └── **Sistema de Confirmação**: Notificação quando pedido é aceito/recusado com motivo opcional
  │ ├── **Público**: vê apenas status do SEU pedido (pendente/aceito/recusado)
  │ ├── **Músico**: vê detalhes completos (quem pediu, mensagens, histórico)
  │ ├── **Privacidade**: evita birra ao não mostrar pedidos recusados de outros
  │ └── **Transparência**: mantém o foco na experiência individual do usuário

- **Gorjetas Diretas** [(Ver Detalhes)](monetization.md#gorjetas-diretas---implementação):
  ├── QR Code único permanente por perfil + opção "Copia e Cola" PIX
  │ ├── **Público**: Facilidade de pagamento instantâneo sem cadastro
  │ ├── **Vantagem**: Experiência rápida e sem complicações
  │ ├── **Funcionamento**: Scan do QR ou copiar chave PIX
  │ └── **Benefício**: Apoio direto ao artista preferido
  ├── Mensagens personalizadas com a gorjeta
  │ ├── **Público**: Expressar gratidão com mensagem personalizada
  │ ├── **Vantagem**: Conexão emocional com o artista
  │ ├── **Funcionamento**: Campo de texto opcional no pagamento
  │ └── **Benefício**: Reconhecimento pessoal do apoio
  ├── Wall de Apoiadores público (opcional para reconhecimento)
  │ ├── **Público**: Visibilidade como apoiador do artista
  │ ├── **Vantagem**: Status social na comunidade musical
  │ ├── **Funcionamento**: Lista pública de maiores doadores
  │ └── **Benefício**: Reconhecimento público pelo apoio
  └── Dashboard centralizado para músico ver todas gorjetas
  │ ├── **Público**: Transparência no destino das doações
  │ ├── **Vantagem**: Confiança no sistema de pagamentos
  │ └── **Benefício**: Segurança e organização financeira

## Gamificação avançada

<a id="gamificação-avançada"></a>

**Sistema de Pontuação**:

- **Pontos por Participação**: 10pts por scan do QR code
  ├── **Público**: Recompensa por engajamento inicial
  ├── **Vantagem**: Incentivo para interagir com artistas
  ├── **Funcionamento**: Pontuação automática no primeiro scan
  └── **Benefício**: Estímulo à descoberta musical
- **Pontos por Pedidos**: 25pts por sugestão enviada (independente de aceite)
  ├── **Público**: Reconhecimento pela participação ativa
  ├── **Vantagem**: Valorização da criatividade do público
  ├── **Funcionamento**: Pontos creditados ao enviar pedido
  └── **Benefício**: Engajamento contínuo com o repertório
- **Pontos por Acertos**: 50pts se pedido for aceito e tocado
  ├── **Público**: Premiação por sugestões de qualidade
  ├── **Vantagem**: Reconhecimento do bom gosto musical
  ├── **Funcionamento**: Pontuação dobrada para pedidos aceitos
  └── **Benefício**: Satisfação em influenciar o setlist
- **Pontos por Gorjetas**: 1pt por real doado (com bônus progressivo)
  ├── **Público**: Retorno pelo apoio financeiro
  ├── **Vantagem**: Recompensa proporcional à contribuição
  ├── **Funcionamento**: Sistema progressivo (mais pontos para maiores valores)
  └── **Benefício**: Incentivo ao apoio monetário contínuo
- **Pontos por Social**: 50pts por compartilhamento nas redes marcando o músico.
  ├── **Público**: Divulgação recompensada
  ├── **Vantagem**: Amplificação orgânica do artista
  ├── **Funcionamento**: Verificação via API das redes sociais
  └── **Benefício**: Crescimento mútuo da comunidade

**Rankings e Reconhecimento**:

- **Top Fãs**: Ranking mensal por artista/banda
  ├── **Público**: Reconhecimento como fã mais engajado
  ├── **Vantagem**: Status exclusivo na comunidade
  ├── **Funcionamento**: Algoritmo baseado em pontos totais
  └── **Benefício**: Orgulho e visibilidade como super fã
- **Top Sugestões**: Melhores pedidos por gênero musical  
   ├── **Público**: Destaque por sugestões de qualidade
  ├── **Vantagem**: Reconhecimento do bom gosto musical
  ├── **Funcionamento**: Avaliação baseada em aceitação e engajamento
  └── **Benefício**: Influência no repertório dos artistas
- **Top Apoiadores**: Maiores contribuidores financeiros
  ├── **Público**: Visibilidade como principal apoiador
  ├── **Vantagem**: Status de mecenas da cena musical
  ├── **Funcionamento**: Ranking por valor total doado
  └── **Benefício**: Reconhecimento pelo apoio financeiro
- **Top Discoverers**: Fãs que mais descobriram novos artistas
  ├── **Público**: Destaque por descobrir talentos
  ├── **Vantagem**: Reconhecimento como curador musical
  ├── **Funcionamento**: Métrica baseada em artistas seguidos
  └── **Benefício**: Influência na descoberta de novos talentos

**Sistema de Badges**:

- 🎵 **Iniciante Musical**: Primeiro scan completo
  ├── **Público**: Primeira interação com a plataforma
  ├── **Vantagem**: Introdução ao sistema de gamificação
  ├── **Funcionamento**: Conquista automática no primeiro scan
  └── **Benefício**: Estímulo para continuar explorando
- 💡 **Sugestor Criativo**: 10+ pedidos enviados
  ├── **Público**: Reconhecimento pela participação ativa
  ├── **Vantagem**: Incentivo para sugerir mais músicas
  ├── **Funcionamento**: Contagem cumulativa de pedidos
  └── **Benefício**: Desenvolvimento do repertório musical
- 🎯 **Acertador**: 5+ pedidos aceitos e tocados
  ├── **Público**: Premiação por sugestões acertadas
  ├── **Vantagem**: Reconhecimento do bom gosto
  ├── **Funcionamento**: Pedidos que foram realmente tocados
  └── **Benefício**: Influência direta nas apresentações
- 💰 **Apoiador**: Primeira gorjeta enviada
  ├── **Público**: Primeiro apoio financeiro a artista
  ├── **Vantagem**: Introdução ao sistema de doações
  ├── **Funcionamento**: Qualquer valor doado conta
  └── **Benefício**: Conexão mais profunda com artistas
- 🥇 **Mecenas**: R$ 100+ em gorjetas totais
  ├── **Público**: Status de apoiador premium
  ├── **Vantagem**: Reconhecimento como investidor cultural
  ├── **Funcionamento**: Soma acumulada de todas doações
  └── **Benefício**: Impacto significativo na carreira artística
- 📱 **Socializer**: 10+ compartilhamentos
  ├── **Público**: Divulgador ativo da cena musical
  ├── **Vantagem**: Amplificação do reach dos artistas
  ├── **Funcionamento**: Compartilhamentos verificados
  └── **Benefício**: Crescimento orgânico da comunidade
- 🔍 **Discoverer**: Seguiu 5+ artistas novos
  ├── **Público**: Explorador de novos talentos
  ├── **Vantagem**: Curadoria musical ativa
  ├── **Funcionamento**: Artistas seguidos pela primeira vez
  └── **Benefício**: Diversificação do consumo musical
- 🏆 **Super Fã**: Badge rara por contribuição excepcional
  ├── **Público**: Reconhecimento máximo na plataforma
  ├── **Vantagem**: Status exclusivo e diferenciado
  ├── **Funcionamento**: Combinação de múltiplas métricas
  └── **Benefício**: Destaque como membro premium da comunidade

**Recompensas Exclusivas** [(Ver Detalhes)](monetization.md#gamificação-avançada):

- 💎 **Acesso Antecipado**: Primeiro a ver novos recursos
  ├── **Público**: Preview de funcionalidades antes do lançamento
  ├── **Vantagem**: Sensação de exclusividade e importância
  ├── **Funcionamento**: Liberação gradual para top users
  └── **Benefício**: Feedback valioso para melhorias
- 🎫 **Descontos VIP**: Parceria com casas de show - desconto em ingressos
  ├── **Público**: Economia em eventos culturais
  ├── **Vantagem**: Acesso a preços preferenciais
  ├── **Funcionamento**: Cupons exclusivos no app
  └── **Benefício**: Incentivo à frequência em eventos
- 🎁 **Conteúdo Exclusivo**: Vídeos, behind-the-scenes
  ├── **Público**: Conteúdo especial não disponível publicamente
  ├── **Vantagem**: Conexão mais íntima com artistas
  ├── **Funcionamento**: Área VIP no perfil do artista
  └── **Benefício**: Experiência imersiva na jornada artística
- 🤝 **Meet & Greet**: Encontros com artistas (para top fãs)
  ├── **Público**: Encontro pessoal com ídolos
  ├── **Vantagem**: Experiência única e memorável
  ├── **Funcionamento**: Sistema de agendamento via plataforma
  └── **Benefício**: Fortalecimento do vínculo artista-fã
- 🎤 **Voto Premium**: Peso maior em votações especiais
  ├── **Público**: Maior influência nas decisões
  ├── **Vantagem**: Voto com valor diferenciado
  ├── **Funcionamento**: Multiplicador de peso no algoritmo
  └── **Benefício**: Reconhecimento da opinião premium
- ✨ **Customização**: Perfil personalizado e emblemas exclusivos
  ├── **Público**: Personalização da identidade na plataforma
  ├── **Vantagem**: Diferenciação visual dos demais users
  ├── **Funcionamento**: Editor de perfil com opções exclusivas
  └── **Benefício**: Expressão individual na comunidade
- 🍻 **Consumação Grátis**: Cupons de cortesia em estabelecimentos parceiros (validação via QR code do app)
  ├── **Público**: Benefícios concretos em estabelecimentos
  ├── **Vantagem**: Economia direta no consumo
  ├── **Funcionamento**: QR code único para resgate
  └── **Benefício**: Parceria win-win com estabelecimentos
- 🎟️ **Ingressos Cortesia**: Para shows dos próprios artistas
  ├── **Público**: Acesso gratuito a eventos
  ├── **Vantagem**: Experiência cultural sem custo
  ├── **Funcionamento**: Sistema de distribuição via app
  └── **Benefício**: Reconhecimento pelo apoio contínuo
- 🎪 **Experiências Únicas**: Aulas particulares com artistas, participação em ensaios
  ├── **Público**: Vivências exclusivas com artistas
  ├── **Vantagem**: Aprendizado direto com profissionais
  ├── **Funcionamento**: Agenda de experiências premium
  └── **Benefício**: Desenvolvimento musical e conexão única

## Folha de cifra e pipeline de IA

<a id="folha-de-cifra-e-pipeline-de-ia"></a>

> **Estratégia:** pipeline próprio (`ai-cifra-module` + worker MIR). Spec técnica: [AI-musician/chord-sheet.md](AI-musician/chord-sheet.md)

**Geração automática a partir de áudio**:

- Inferência de acordes, BPM, tonalidade e timeline via worker (ChordFormer + pós-processamento)
- Job/fila + RabbitMQ — padrão já existente no backend
- Folha unificada: letra (LRC) + acordes ancorados por token

**Funcionalidades para músicos**:

- 📋 **Biblioteca pessoal**: cifras geradas e salvas no perfil
- ✏️ **Editor personalizado**:
  ├── Edição de cifras para uso próprio
  ├── Anotações privadas (alterações, dicas, acordes)
  ├── Versões customizadas por música
  └── Correções colaborativas (feedback → retreino/heurísticas)
- 🎶 **Transposição inteligente**:
  ├── Adaptação automática para diferentes tons
  └── Opções de complexidade (simples/avançado)
- ⚡ **Sincronização em tempo real**:
  ├── Cifras disponíveis durante apresentações
  ├── Acesso offline prévio aos ensaios
  └── Compartilhamento seguro com banda (se aplicável)

**Letras sincronizadas (LRC)**:

- LRCLIB + ingest UGC — ver [external-apis.md](AI-musician/external-apis.md)
- Alinhamento acorde ↔ letra (Modo A: ASR; Modo B: heurístico)

- **Histórico**: salva cifras usadas em cada apresentação
  ├── Registro completo do desempenho
  ├── Analytics de repertório popular
  └── Melhoria contínua do setlist

## Segmentação por instrumentos

<a id="segmentação-por-instrumentos"></a>

**Sistema de Busca Avançada** [(Ver Detalhes)](monetization.md#segmentação-por-instrumentos):

- 🔍 **Filtros por Instrumento**: Público encontra músicos específicos por instrumento
  ├── **Funcionamento**: Público busca músicos por instrumentos específicos
  ├── **Multi-seleção**: combinação de instrumentos (ex: guitarra + voz)
  └── **Disponibilidade**: filtro por agenda e localização
- 📍 **Localização**: Artistas por região/cidade com agenda
  ├── **Proximidade**: raio em km do usuário
  ├── **Feed de proximidade**: músicos próximos em tempo real
  └── **Agenda**: filtro por disponibilidade de datas
- 🎵 **Gênero Musical**: Estilos e especialidades
  ├── **Estilo**: rock, sertanejo, MPB, jazz, eletrônica
  └── **Especialidades**: subgêneros e nichos musicais
- 💰 **Faixa de Preço**: Cachês públicos ou faixas de valor (transparência)
- 📱 **Feed de Proximidade**: Reels de artistas próximos geograficamente
  ├── **Demonstração**: 30-60 segundos mostrando técnica
  ├── **Engajamento**: likes e comentários nos reels
  └── **Descoberta**: algoritmo de recomendação baseado em visualizações
- 🔄 **Integração Social**: Posta no app → posta no Instagram marcando artista
- 🎯 **Busca por Ritmo**: Filtro por gênero + localização + horário apresentação
- 👥 **Formação de Bandas**: Busca por instrumentos complementares
  ├── **Busca por instrumentos complementares**: encontrar músicos que tocam instrumentos que combinam com o seu
  ├── **Match por estilo**: algoritmo que sugere parcerias baseadas em compatibilidade musical
  ├── **Teste de afinação**: ferramenta para verificar se instrumentos estão afinados
  └── **Biblioteca de backing tracks**: base de músicas de apoio para práticas

**Formação de Bandas Inteligente** [(Ver Detalhes)](monetization.md#formação-de-bandas):

- 🤝 **Matching Automático**:
  ├── Alerta de Substituição: violonista falta → sugere substitutos
  │ ├── **Algoritmo**: machine learning baseado em compatibilidade musical
  │ ├── **Critérios**: estilo, experiência, localização, disponibilidade horária
  │ ├── **Score de match**: porcentagem de compatibilidade calculada
  │ └── **Teste de química**: sugestão de primeira jam session virtual
  ├── Compatibilidade Musical: match por estilo e repertório
  ├── Reels de Apresentação: vídeos curtos mostrando skill
  │ ├── **Padrão**: 60 segundos mostrando técnica principal
  │ ├── **Multi-instrumentos**: vídeos separados para cada instrumento
  │ ├── **Estilos diversos**: demonstração em diferentes gêneros musicais
  └── Sugestões de bandas com vagas em aberto
- 👥 **Sistema de Contato**:
  ├── Opção "Interesse em Bandas" no perfil do músico
  ├── Chat seguro: mensagens criptografadas dentro do app
  ├── Compartilhamento: arquivos de música, tablaturas, backing tracks
  ├── Agendamento: marcador de ensaios e encontros
- 🔄 **Integração com Reels**: Vídeos mostrando habilidades específicas

**Estatísticas e Insights de Mercado** [(Ver Detalhes)](monetization.md#estatísticas-de-mercado):

- 📊 **Popularidade por Instrumento**:
  ├── Demanda relativa no mercado (dados para divulgação paga)
  ├── Instrumentos mais solicitados por região
  ├── Sazonalidade e tendências
  └── Valor médio de cachê por especialidade

- 💡 **Oportunidades de Carreira**:
  ├── Instrumentos com maior carência profissional
  ├── Nichos pouco explorados com alta demanda
  ├── Dados de crescimento por categoria
  └── Insights para desenvolvimento musical
- 💰 **Divulgação Paga**:
  ├── Destaque por Instrumento: artistas pagam para aparecer primeiro
  └── Analytics Premium: relatórios detalhados por assinatura
- 📈 **Monetização de Dados**: Venda de insights de mercado para escolas de música

## IA e integrações futuras

<a id="ia-e-integrações-futuras"></a>

- **Recomendação Inteligente**: Sugere músicas baseadas em histórico e tendências
- **Análise de Performance**: Feedback automático sobre setlists e engajamento
- **Otimização de Repertório**: Sugestões para maximizar gorjetas e aprovação
- **Matchmaking**: Conexão inteligente entre músicos, eventos e estabelecimentos
- **API de Analytics**: Integração com Google Analytics 4 e Facebook Pixel
- **Social Listening**: Monitoramento de menções e engajamento nas redes
- **Influencer Marketing**: Conexão com influenciadores musicais
- **Análise de Sentimento**: Monitora reação do público em tempo real

## Memórias musicais

<a id="memórias-musicais"></a>

### 1. Álbum de Momentos

- **Público**: Músicos e público que participam de eventos
- **Vantagem**: Registro automático de momentos especiais sem interromper a performance
- **Funcionamento**:
  ├── Fotos automáticas quando pedido é aceito pelo músico
  ├── Captura de momentos-chave durante apresentações
  ├── Geolocalização e timestamp automáticos
  └── Organização por evento e data
- **Benefício**: Criação de memórias afetivas que fortalecem a conexão músico-público

### 2. Timeline Pessoal

- **Público**: Músicos profissionais e amadores
- **Vantagem**: Portfólio visual automático da carreira musical
- **Funcionamento**:
  ├── Histórico cronológico de shows que participou
  ├── Estatísticas de performance por evento
  ├── Galeria de fotos e vídeos organizados
  ├── Marcos e conquistas destacados
  └── Compartilhamento seletivo com fãs e contratantes
- **Benefício**: Ferramenta de marketing pessoal e registro de evolução artística

## Marketplace com reels

<a id="marketplace-com-reels"></a>

**Tipos de Conteúdo Exclusivo**:

- 🎤 **Performances Ao Vivo**: Gravações de shows e apresentações

- 📚 **Aulas e Masterclasses** [(Ver Detalhes)](monetization.md#aulas-e-masterclasses):
  ├── Modelo Assinatura: acesso ilimitado por mensalidade
  ├── Aulas Particulares: conexão aluno-professor com taxa da plataforma
  ├── Cursos Certificados: programas completos com certificação
  ├── Pay-per-View: performances exclusivas
  └── Conteúdo Patrocinado: marcas financiam produção de conteúdo
  └── Monetização: Revenue sharing 70/30 entre professor e plataforma

- 🎵 **Covers e Versões**: Releituras autorais de músicas
- 💡 **Tutoriais Rápidos**: Dicas em formato reel/short

**Sistema de Monetização Avançado** [(Ver Detalhes)](monetization.md#sistema-de-monetização-avançado):

- 💰 **Revenue Sharing** [(Ver Detalhes)](monetization.md#revenue-sharing):
  ├── 70% para o criador / 30% para plataforma
  ├── Pagamentos por views (RPM personalizado)
  ├── Bonificação por engajamento (comentários, shares)
  └── Sistema de metas e bônus de performance

- 🔒 **Conteúdo Premium** [(Ver Detalhes)](monetization.md#conteúdo-premium):
  ├── Aulas exclusivas com assinatura
  ├── Performances raras por pay-per-view
  ├── Pacotes de masterclasses completas
  └── Acesso antecipado a lançamentos

- 🎁 **Sistema de Gorjetas** [(Ver Detalhes)](monetization.md#sistema-de-gorjetas):
  ├── Doações diretas nos vídeos
  ├── Super thanks durante transmissões
  ├── Presentes digitais convertíveis
  └── Apoio mensal (modelo similar ao Patreon)

**Algoritmo de Recomendação Inteligente**:

- 🎯 **Descoberta de Talentos**:
  ├── Algoritmo que identidade artistas promissores
  ├── Boost orgânico para conteúdo de qualidade
  ├── Curadoria editorial por gênero/região
  └── Programa de embaixadores e talentos

**Integração Social Multiplataforma**:

- 🔗 **Compartilhamento Cross-Platform**:
  ├── Publicação automática nas redes sociais
  ├── Embed players para sites e blogs
  ├── API para desenvolvedores terceiros
  └── Integração com streaming services

- 👥 **Comunidade Interativa**:
  ├── Comentários com timestamp musical
  ├── Sistema de colaborações entre artistas
  ├── Grupos por gênero e interesses
  └── Eventos ao vivo e Q&A sessions

- 📱 **Experiência Mobile-First**:
  ├── App nativo com upload facilitado
  ├── Edição básica integrada (cortar, filters)
  ├── Notificações de novos conteúdos
  └── Download offline para assinantes

**Programas Especiais e Parcerias**:

- 🏆 **Talent Shows Virtuais**:
  ├── Competições mensais por categorias
  ├── Jurados especializados da indústria
  ├── Prêmios em dinheiro e contratações
  └── Exposição para vencedores

- 🤝 **Parcerias com Estabelecimentos**:
  ├── Transmissões ao vivo de casas noturnas
  ├── Co-branding com festivais e eventos
  ├── Programas de residência artística
  └── Capture de talentos para contratação

- 📈 **Aceleração de Carreira**:
  ├── Mentoria com profissionais do mercado
  ├── Conexão com selos e produtoras
  ├── Workshops de monetização e marketing
  └── Oportunidades de performances reais

## Resumo de monetização

<a id="resumo-de-monetização"></a>

- **Músicos**: Planos freemium (R$ 39,90 individual / R$ 79,90 banda) [(Ver Detalhes)](monetization.md#planos-para-músicos)
- **Estabelecimentos**: Planos Básico (R$ 149/mês) e Premium (R$ 299/mês) [(Ver Detalhes)](monetization.md#planos-para-estabelecimentos)
- **Marketplace**: 10% sobre cachês + taxas de eventos especiais [(Ver Detalhes)](monetization.md#marketplace---expansão)
- **Gorjetas**: Taxas reduzidas conforme plano (8% free → 3% premium) [(Ver Detalhes)](monetization.md#gorjetas-diretas---implementação)
