# Git Workflow - SoundMeet

Este documento descreve o workflow Git utilizado no projeto, seguindo as melhores práticas do **Git Flow** e **Conventional Commits / CommitLint**.

## 🏗️ Estrutura de Branches

### Branches Principais

- **`master`**: Código em produção
- **`develop`**: Código em desenvolvimento (branch principal de desenvolvimento)

### Branches de Suporte

- **`feature/`**: Novas funcionalidades
- **`bugfix/`**: Correções de bugs
- **`hotfix/`**: Correções urgentes para produção
- **`release/`**: Preparação de releases
- **`support/`**: Suporte a versões antigas

## 📝 Padrão de Commits (CommitLint)

### Formato

```
type(scope): description

[optional body]

[optional footer]
```

### Tipos de Commit

- **`feat`**: Nova funcionalidade
- **`fix`**: Correção de bug
- **`docs`**: Documentação
- **`style`**: Formatação, ponto e vírgula, etc
- **`refactor`**: Refatoração de código
- **`perf`**: Melhoria de performance
- **`test`**: Adicionando ou corrigindo testes
- **`chore`**: Tarefas de build, configs, etc
- **`ci`**: Mudanças em CI/CD
- **`revert`**: Reverter commits
- **`build`**: Build do sistema ou dependências
- **`wip`**: Work in progress

### Escopos (Opcional)

- **`project`**: Configuração do projeto
- **`database`**: Banco de dados e schema (Prisma)
- **`core`**: Agregados, VOs e lógica de domínio
- **`docker`**: Configuração de containers
- **`auth`**: Autenticação e autorização (Keycloak)
- **`api`**: Controllers, módulos NestJS e endpoints
- **`musician`**: Domínio músico/banda
- **`establishment`**: Domínio estabelecimentos
- **`audience`**: Domínio público
- **`request`**: Pedidos musicais
- **`payment`**: Gorjetas, transações e carteira
- **`gamification`**: Pontos, badges, rankings
- **`ai-cifra`** / **`ai-audio`** / **`synced-lyrics`**: Subsistema de IA musical
- **`scheduling`** · **`events`** · **`chat`** · **`campaign`** · **`contract`** · **`performance`** · **`plans`** · **`repertoire`** · **`music-library`** · **`personal-chord-sheet`** · **`review`** · **`indication`** · **`follow`** · **`notifications`**: um escopo por domínio (`src/core/<domínio>`)

### Exemplos

```bash
feat(auth): add JWT authentication system
fix(database): resolve connection timeout issue
docs(api): update API documentation
style(core): format code according to prettier
refactor(payment): extract tip split calculation logic
test(request): add unit tests for accept/reject flow
chore(build): update dependencies
ci(deploy): add GitHub Actions workflow
```

## 🔄 Fluxo de trabalho (pull request)

> **Não use `git flow ... finish`.** Ele faz merge local em `develop` e espera um push direto, que as
> regras de branch bloqueiam. Todo código entra em `develop` por pull request revisado.

### 1. Feature ou bugfix

```bash
git checkout develop && git pull
git checkout -b feature/SM-123-descricao-curta     # ou bugfix/SM-123-descricao-curta

# commits pequenos, no padrão abaixo
git add <arquivos>                                 # prefira listar arquivos a usar `git add .`
git commit -m "feat(scope): description"

git push -u origin feature/SM-123-descricao-curta
# abra o PR para develop no GitHub
```

O PR entra com **CI verde** e **aprovação do Code Owner (fundador)**. Depois do merge, apague a
branch.

### 2. Atualizar a branch com `develop`

```bash
git fetch origin
git rebase origin/develop      # ou merge, se preferir; nunca force push em develop ou master
git push --force-with-lease    # só na SUA branch de feature, depois de um rebase
```

### 3. Release e hotfix — só o fundador

- **Release:** `develop` → `master` por pull request, seguido do deploy.
- **Hotfix:** branch `hotfix/descricao` a partir de `master`, PR para `master` e depois para
  `develop`.

## 🚀 Comandos Úteis

### Configuração Inicial

```bash
# Configurar aliases úteis
git config alias.lg "log --oneline --graph --decorate"
git config alias.st "status"
```

### Visualização

```bash
# Ver histórico de commits
git log --oneline --graph --decorate

# Ver status atual
git status

# Ver branches
git branch -a
```

### Limpeza

```bash
# Limpar branches locais deletadas
git remote prune origin

# Limpar branches locais não rastreadas
git branch --merged | grep -v "\*" | xargs -n 1 git branch -d
```

## 📋 Checklist de Commit

Antes de fazer um commit, verifique:

- [ ] Código segue os padrões do projeto
- [ ] Testes passam
- [ ] Mensagem segue o padrão Conventional Commits (não há hook que valide — a revisão do PR confere)
- [ ] Escopo está correto
- [ ] Descrição é clara e concisa
- [ ] Não há dados sensíveis no commit

## 📚 Recursos Adicionais

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git Flow](https://nvie.com/posts/a-successful-git-branching-model/)
- [CommitLint](https://github.com/conventional-changelog/commitlint)

