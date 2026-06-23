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

## 🔄 Workflow Git Flow

### 1. Desenvolvimento de Features

```bash
# Criar nova feature
git flow feature start nome-da-feature

# Desenvolver e fazer commits
git add .
git commit -m "feat(scope): description"

# Finalizar feature
git flow feature finish nome-da-feature
```

### 2. Correção de Bugs

```bash
# Criar bugfix
git flow bugfix start nome-do-bugfix

# Desenvolver e fazer commits
git add .
git commit -m "fix(scope): description"

# Finalizar bugfix
git flow bugfix finish nome-do-bugfix
```

### 3. Preparação de Release

```bash
# Criar release
git flow release start 1.0.0

# Fazer ajustes finais
git add .
git commit -m "chore(release): prepare release 1.0.0"

# Finalizar release
git flow release finish 1.0.0
```

### 4. Hotfix para Produção

```bash
# Criar hotfix
git flow hotfix start nome-do-hotfix

# Corrigir e fazer commits
git add .
git commit -m "fix(scope): critical production fix"

# Finalizar hotfix
git flow hotfix finish nome-do-hotfix
```

## 🚀 Comandos Úteis

### Configuração Inicial

```bash
# Configurar template de commit
git config commit.template .gitmessage

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
- [ ] Mensagem segue o padrão CommitLint
- [ ] Escopo está correto
- [ ] Descrição é clara e concisa
- [ ] Não há dados sensíveis no commit

## 📚 Recursos Adicionais

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git Flow](https://nvie.com/posts/a-successful-git-branching-model/)
- [CommitLint](https://github.com/conventional-changelog/commitlint)

