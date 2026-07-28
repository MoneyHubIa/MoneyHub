# Backend HTTP Logging Design

## Objective

Add structured HTTP request logging to the MoneyHub backend through one shared
Express middleware. The middleware must cover `/health`, `/graphql`, the `404`
fallback, and routes added in the future without requiring route-specific
logging code.

## Scope

The change covers one completion log for every HTTP request handled by the
Express application. It does not add business-event logs, GraphQL
operation-level logs, audit logs, or request/response payload logging.

## Architecture

Create a focused logging module that owns:

- the application-level Pino logger;
- the structured HTTP completion event contract;
- the Express middleware that measures duration and emits the event;
- log-level selection based on the final HTTP status.

`createApp` will install this middleware after assigning the request ID and
before registering application routes. This guarantees that every route and
the fallback handler share the same correlation identifier and completion
behavior.

The middleware will subscribe to the response `finish` event. It will emit
exactly one `http_request_completed` event after Express has finalized the
response status.

## Log Event Contract

Each completed request produces a structured JSON event with these fields:

```json
{
  "event": "http_request_completed",
  "requestId": "5dcb470d-8226-43b7-b615-4cf128dfbe20",
  "method": "GET",
  "path": "/health",
  "statusCode": 200,
  "durationMs": 12
}
```

Pino adds its standard fields, including numeric log level, timestamp, process
ID, and hostname.

The log level is selected from the final status:

- `info` for status codes below `400`;
- `warn` for status codes from `400` through `499`;
- `error` for status codes `500` and above.

The logged `path` is the request pathname and excludes query-string values.

## Correlation

The existing request-ID behavior remains authoritative:

- accept an incoming `x-request-id` when present;
- otherwise generate a UUID;
- return the value in the `x-request-id` response header;
- include the same value in the completion log.

The logger middleware consumes the ID already stored in
`response.locals.requestId`. It does not generate a second identifier.

## Security and Privacy

The completion event must not include:

- request or response bodies;
- GraphQL documents, operation variables, or resolver results;
- the `Authorization` header or Firebase ID token;
- passwords, cookies, or arbitrary request headers;
- query-string values.

This keeps authentication credentials and potentially sensitive financial data
out of application logs.

## Integration and Configuration

Use the existing `pino` dependency and do not add `pino-http`. The default
application logger writes structured JSON to standard output.

`createApp` accepts an optional logger dependency for tests and future runtime
composition. Production behavior uses the default application logger when no
logger is provided.

No endpoint-specific logging is introduced. `/health`, `/graphql`, `404`
responses, and future endpoints are covered solely by the shared middleware.

## Error Handling

The completion logger observes the final response status and does not alter
response bodies or status codes. A logging failure must not change the HTTP
response or trigger another response.

The current application does not have a dedicated Express error handler. This
feature does not expand scope to redesign application error handling; any
request that reaches a completed HTTP response is logged according to its final
status.

## Testing

Tests inject an in-memory logger-compatible object into `createApp` and assert
observable completion events.

Coverage must prove:

- `GET /health` emits one `info` completion event with status `200`;
- `POST /graphql` emits one `info` completion event with status `200`;
- an unknown route emits one `warn` completion event with status `404`;
- the logged request ID matches the response header;
- duration is a finite, non-negative number;
- path logging excludes query-string values;
- event objects do not contain authorization headers, bodies, or tokens;
- status-to-level selection maps `5xx` responses to `error` at the unit level.

Existing authentication, GraphQL, health, and schema tests must continue to
pass.

## Success Criteria

The feature is complete when every completed backend HTTP request emits exactly
one structured completion event with the approved fields and severity, no
sensitive request data is logged, all backend tests pass, and TypeScript
type-checking succeeds.
