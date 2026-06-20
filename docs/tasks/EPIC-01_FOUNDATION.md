# EPIC-01 — Foundation

## Status
Done

## Feature
Project foundation.

## Objective
Create the documentation, monorepo, backend base, frontend base, and testing base required before product features.

## Tasks

### TASK-001 — Create product documentation

## Status
Done

## Epic
EPIC-01 — Foundation

## Feature
Product documentation

## Objetivo
Document product vision, business rules, and user stories.

## Contexto
MoneyHub must be driven by specs before implementation.

## Escopo
Create product Markdown files.

## Fora de Escopo
Code implementation.

## Dependências
Initial product prompt.

## Critérios de Aceite
- Product vision exists.
- Business rules exist.
- User stories exist.

## Critérios Técnicos
- Markdown documentation.
- Clear product boundaries.

## Arquivos Esperados
- `docs/product/PRODUCT_VISION.md`
- `docs/product/BUSINESS_RULES.md`
- `docs/product/USER_STORIES.md`

## Plano de Execução
1. Create product folder.
2. Write product docs.
3. Update task index.

## Testes Necessários
- Documentation review.

## Checklist de Conclusão
- [x] Especificação validada
- [x] Implementação concluída
- [ ] Testes criados
- [ ] Testes passando
- [x] Documentação atualizada
- [x] Revisão de qualidade realizada

### TASK-005 — Scaffold monorepo foundation

## Status
Done

## Epic
EPIC-01 — Foundation

## Feature
Monorepo structure

## Objetivo
Create root workspace, app folders, and initial commands.

## Contexto
The project needs a shared structure before backend and frontend features.

## Escopo
Create root package, `.env.example`, `.gitignore`, backend package, frontend package, and initial tests.

## Fora de Escopo
Authentication, database migrations, and production deploy.

## Dependências
Foundation specification.

## Critérios de Aceite
- Root package exists.
- Backend package exists.
- Frontend package exists.
- Test commands exist.

## Critérios Técnicos
- JavaScript only.
- No hard-coded secrets.
- Workspace scripts must be explicit.

## Arquivos Esperados
- `package.json`
- `.env.example`
- `apps/backend/package.json`
- `apps/frontend/package.json`

## Plano de Execução
1. Create package manifests.
2. Add failing foundation tests.
3. Add minimal code.
4. Run tests.

## Testes Necessários
- Backend health contract test.
- Frontend shell render test.

## Checklist de Conclusão
- [x] Especificação validada
- [x] Implementação concluída
- [x] Testes criados
- [x] Testes passando
- [x] Documentação atualizada
- [x] Revisão de qualidade realizada

### TASK-006 — Configure backend foundation

## Status
Done

## Epic
EPIC-01 — Foundation

## Feature
Backend foundation

## Objetivo
Create a minimal Express application with a versioned health endpoint.

## Contexto
Backend routes need a stable base before authentication and financial modules.

## Escopo
Create app factory, server entrypoint, request ID middleware, security middleware, and health response envelope.

## Fora de Escopo
Database access, authentication, and domain routes.

## Dependências
TASK-005.

## Critérios de Aceite
- Health endpoint responds at `/api/v1/health`.
- Response uses the standard envelope.
- Request ID is included in metadata.

## Critérios Técnicos
- Express application factory.
- Helmet and CORS configured.
- Jest and Supertest coverage.

## Arquivos Esperados
- `apps/backend/src/app.js`
- `apps/backend/src/server.js`
- `apps/backend/tests/health.test.js`

## Plano de Execução
1. Write failing health endpoint test.
2. Add app factory.
3. Add server entrypoint.
4. Run tests.

## Testes Necessários
- Health endpoint test.

## Checklist de Conclusão
- [x] Especificação validada
- [x] Implementação concluída
- [x] Testes criados
- [x] Testes passando
- [x] Documentação atualizada
- [x] Revisão de qualidade realizada

### TASK-007 — Configure frontend foundation

## Status
Done

## Epic
EPIC-01 — Foundation

## Feature
Frontend foundation

## Objetivo
Create a mobile-first React shell for MoneyHub.

## Contexto
The frontend needs a usable application shell before feature pages.

## Escopo
Create Vite setup, root React component, responsive styles, navigation landmarks, and shell test.

## Fora de Escopo
Authentication screens, data loading, and real dashboards.

## Dependências
TASK-005.

## Critérios de Aceite
- App renders MoneyHub heading.
- Primary navigation landmark exists.
- Main dashboard shell exists.
- Production build succeeds.

## Critérios Técnicos
- React with Vite.
- Mobile-first CSS.
- React Testing Library coverage.

## Arquivos Esperados
- `apps/frontend/src/App.jsx`
- `apps/frontend/src/main.jsx`
- `apps/frontend/src/styles.css`
- `apps/frontend/tests/App.test.jsx`

## Plano de Execução
1. Write failing shell render test.
2. Add React app shell.
3. Add responsive styles.
4. Run tests and build.

## Testes Necessários
- App shell render test.

## Checklist de Conclusão
- [x] Especificação validada
- [x] Implementação concluída
- [x] Testes criados
- [x] Testes passando
- [x] Documentação atualizada
- [x] Revisão de qualidade realizada
