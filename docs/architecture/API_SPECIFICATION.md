# API Specification

## Base Path

All endpoints use:

```txt
/api/v1
```

## Response Envelope

```json
{
  "success": true,
  "data": {},
  "error": null,
  "meta": {
    "requestId": "string"
  }
}
```

## Error Envelope

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request.",
    "details": {}
  },
  "meta": {
    "requestId": "string"
  }
}
```

## Initial Routes

- `GET /health`
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/password-recovery`
- `GET /profile`
- `PATCH /profile`
- `GET /categories`
- `POST /categories`
- `GET /cost-centers`
- `POST /cost-centers`
- `GET /incomes`
- `POST /incomes`
- `GET /expenses`
- `POST /expenses`
- `GET /dashboard/summary`
- `POST /ai/messages`

## API Rules

- Authenticated routes require bearer access token.
- User-owned resources must be filtered by authenticated user ID.
- Controllers must not contain business rules.
- Validation must run before service execution.
- Errors must use the standard envelope.
