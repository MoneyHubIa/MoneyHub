# Environment Variables

## Backend

- `NODE_ENV`
- `PORT`
- `FRONTEND_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_EXPIRES_IN`
- `JWT_REFRESH_EXPIRES_IN`
- `BCRYPT_SALT_ROUNDS`
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX`

## Frontend

- `VITE_API_BASE_URL`

## AI

- `LLM_PROVIDER`
- `LLM_API_KEY`
- `LLM_MODEL`

## Rules

- Do not commit `.env`.
- Do not log secrets.
- Keep `.env.example` synchronized with required variables.
