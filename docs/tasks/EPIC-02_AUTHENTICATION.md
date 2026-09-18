# EPIC-02 - Authentication and Identity

## Status
Done

## Feature
Firebase Authentication.

## Objective
Plan and implement secure account lifecycle with Firebase Auth, Firebase Admin token verification, Firebase-managed identity email flows, profile management, and authorization boundaries in GraphQL.

## Initial Tasks

- [x] TASK-008 - Configure Firebase authentication specs.
- [x] TASK-009 - Implement Firebase Auth app foundation.
- [x] TASK-010 - Plan Firebase Admin auth context.
- [x] TASK-011 - Plan Firebase Analytics adapter.
- [x] TASK-017 - Implement authenticated GraphQL profile bootstrap.
- [x] TASK-018 - Implement logout and local Firebase session cleanup.
- [x] TASK-019 - Implement password recovery through Firebase REST endpoints.
- [x] TASK-020 - Implement profile management.

## Tasks Detail

### TASK-009 - Implement Firebase Auth app foundation

## Status
Done

## Completion Review

The Expo app implements Firebase email/password registration, login, session
observation with native persistence, and fresh ID-token propagation to Apollo
requests. The Auth Emulator acceptance test verifies registration, login, token
issuance, and restored session state without contacting production Firebase.

### TASK-010 - Plan Firebase Admin auth context

## Status
Done

## Objective
Planejar o contexto de autenticação com Firebase Admin no backend (Node.js/GraphQL), estabelecendo as regras para verificação de token, formato do contexto do usuário e isolamento de dados por usuário.

## Scope
Definir o fluxo do middleware HTTP, o mapeamento do objeto AuthUser no contexto GraphQL do Apollo Server, o isolamento implícito de recursos financeiros por UID do Firebase nos resolvers e repositories, e os códigos de erro do GraphQL para UNAUTHENTICATED e FORBIDDEN.

## Out of Scope
Executar alterações ou escrita de código funcional, configurações de infraestrutura de rede, banco de dados ou integração cliente.

## Acceptance Criteria
- Fluxo de validação de ID Token do Firebase planejado via Firebase Admin SDK.
- Interface AuthUser definida e propagada via contexto do Apollo Server.
- Isolamento implícito de dados mapeado por Firebase UID.
- Mensagens e extensões de erro GraphQL mapeadas para autenticação e autorização falhas.

## Completion Review
A arquitetura do middleware de autenticação, o tipo de contexto do usuário e as políticas de isolamento de consultas com base no UID do Firebase foram planejados e documentados em `docs/specs/BACKEND_AUTH_CONTEXT_SPEC.md`. Esta etapa cobriu o planejamento arquitetural da autenticação do backend.

### TASK-011 - Plan Firebase Analytics adapter

## Status
Done

## Objective
Planejar o adapter do Firebase Analytics no app cliente Expo (com suporte a Web, iOS e Android), estabelecendo a interface comum, a estratégia de inicialização resiliente por plataforma e o isolamento dos fluxos financeiros.

## Scope
Definir a interface TypeScript comum `AnalyticsAdapter`, a estratégia de build/divisão de arquivos por plataforma (`.web.ts` e `.native.ts`), a inicialização segura com verificação de suporte (`isSupported()` do SDK Web), o uso de comportamento No-Op como fallback de resiliência e as regras de mock para testes unitários.

## Out of Scope
Escrever códigos de implementação funcionais, configurar projetos de Firebase no console do Google, instalar dependências no app ou realizar deploys.

## Acceptance Criteria
- Interface `AnalyticsAdapter` especificada com suporte a eventos genéricos, identificação de usuário, propriedades e visualização de telas.
- Estratégia de resolução por plataforma planejada via extensões de arquivo do Metro/Vite.
- Fluxo de resiliência (verificação de suporte e fallback No-Op) detalhado para evitar que falhas de analytics interrompam fluxos financeiros.
- Padrão de mock para testes unitários definido.

## Completion Review
A arquitetura do adapter, as regras de resiliência por plataforma, o contrato unificado de eventos e a estratégia de mocks de teste foram planejados e documentados na especificação `docs/specs/FIREBASE_ANALYTICS_ADAPTER_SPEC.md`.

### TASK-020 - Implement profile management

## Status
Done

## Completion Review

Authenticated users with verified email and a persisted local profile can now
read and update their own `fullName`, `preferredCurrency`, and `theme` through
the `myProfile` query and `updateMyProfile` mutation. The Expo **Ajustes**
screen loads those values, saves them with Apollo, and provides safe loading,
success, and failure feedback. Backend and frontend tests cover the contract,
authorization, validation, and save flow.

### TASK-019 - Implement password recovery through Firebase REST endpoints

## Status
Done

## Implementation Review

The backend owns the Firebase Auth REST integration and exposes rate-limited
`POST /auth/password-recovery`, `POST /auth/password-recovery/verify`, and
`POST /auth/password-recovery/confirm`. It returns account-neutral public
responses, applies process-local sliding-window enforcement, records only a
SHA-256 email hash plus safe operational status, maps retryable temporary
failures safely, validates `APP_URL` plus `FIREBASE_WEB_API_KEY` at startup,
and sanitizes client-provided `x-request-id` values before logs or audit
events.

The Expo app links login to `/forgot-password` and hosts `/reset-password`
outside the authenticated and anonymous layouts. It validates Firebase action
codes, confirms matching passwords, maps weak-password errors safely, retries
recoverable temporary failures, signs out and clears the local session after
success, and offers a new request for missing, invalid, expired, or used
links. Automated backend and frontend tests cover the security contract.

## Completion Review

Real Firebase smoke confirmed delivery and message content, MoneyHub action
URL, password change, action-code non-reuse, rejection of the old password,
acceptance of the new password, and indistinguishable submission for an unknown
address. `TASK-019` and `EPIC-02` are complete.

## Technical Rules

- The backend must never store passwords, password hashes, or refresh tokens.
- The app authenticates with Firebase Auth and sends Firebase ID tokens to GraphQL.
- The backend verifies ID tokens with Firebase Admin before resolving authenticated fields.
- Password recovery uses backend-owned Firebase Auth REST endpoints and Firebase
  password-reset templates.
- Email verification remains delivered directly by Firebase.
- User-owned data must be scoped by Firebase UID.
