# Coding Standards

## General

- JavaScript only.
- No hard-coded secrets, URLs, credentials, or environment-specific values.
- Prefer small modules with one responsibility.
- Use explicit, consistent names.
- Keep controllers thin and services focused.

## Backend

- Business rules live in services.
- Persistence lives in repositories.
- Middleware owns cross-cutting HTTP concerns.
- Errors must use shared application error utilities.

## Frontend

- Mobile-first CSS.
- Components follow Atomic Design.
- Pages compose features; they do not own API details.
- Services own HTTP integration.
- UI text must be clear and accessible.
