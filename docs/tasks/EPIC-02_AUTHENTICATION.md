# EPIC-02 - Authentication and Identity

## Status
Pending

## Feature
Firebase Authentication.

## Objective
Plan and implement secure account lifecycle with Firebase Auth, Firebase Admin token verification, custom transactional email through Resend, profile management, and authorization boundaries in GraphQL.

## Initial Tasks

- TASK-008 - Configure Firebase authentication specs.
- TASK-009 - Implement Firebase Auth app foundation.
- [x] TASK-010 - Plan Firebase Admin auth context.
- TASK-011 - Plan Firebase Analytics adapter.
- TASK-017 - Implement authenticated GraphQL profile bootstrap.
- TASK-018 - Implement logout and local Firebase session cleanup.
- TASK-019 - Implement password recovery through Firebase links and Resend email.
- TASK-020 - Implement profile management.

## Tasks Detail

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

## Technical Rules

- The backend must never store passwords, password hashes, or refresh tokens.
- The app authenticates with Firebase Auth and sends Firebase ID tokens to GraphQL.
- The backend verifies ID tokens with Firebase Admin before resolving authenticated fields.
- Email verification and password recovery emails use Firebase-generated action links delivered by Resend when custom templates are required.
- User-owned data must be scoped by Firebase UID.
