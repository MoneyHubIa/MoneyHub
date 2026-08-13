# Final Firebase REST Password-Recovery Fixes Report

**Date:** 2026-08-13

**Result:** DONE_WITH_CONCERNS

**Reviewed range:** `3a4d79b..ffeeb05`

The requested `final-review-findings.md` was not present when this round began.
The findings supplied in the final-fixes task message were used as the review
source. The approved historical design and implementation plan were read but
not modified.

## Findings and root causes

### 1. Firebase provider messages lost actionable codes

Root cause: `providerCodeFromResponse()` validated the complete Firebase
`error.message` against the safe-code regular expression. Real Firebase policy
errors append human-readable details after `" : "`, so the full message failed
validation and became `provider/unknown`. The domain service consequently could
not map realistic `WEAK_PASSWORD`,
`PASSWORD_DOES_NOT_MEET_REQUIREMENTS`, or action-code errors.

- RED: added realistic fixtures including
  `WEAK_PASSWORD : Password should be at least 6 characters` and observed
  `provider/unknown` instead of `WEAK_PASSWORD`.
- GREEN: extract the segment before the first exact `" : "`, then apply the
  existing bounded safe-code validation. Adapter and service focused tests
  passed (20 tests).
- Commit: `1754b3b fix: harden Firebase recovery error contracts`.

### 2. Invalid route input and optional service wiring produced inconsistent results

Root causes:

- route schema failures returned `INVALID_ACTION_CODE`, while provider failures
  returned the public contract `INVALID_OR_EXPIRED_ACTION_CODE`;
- confirmation validation inferred the bad field from one blank-password check,
  so non-string or overlong passwords were misclassified as action-code errors;
- optional chaining on `options.passwordRecovery?.verify()` and `.confirm()`
  treated absent production wiring as successful verification or confirmation.

- RED: route tests observed `INVALID_ACTION_CODE` for bad `oobCode`, observed
  `INVALID_ACTION_CODE` for overlong password input, and observed HTTP `200` for
  verify/confirm with no recovery service.
- GREEN: action-code input consistently returns
  `INVALID_OR_EXPIRED_ACTION_CODE`; password validation independently returns
  `INVALID_PASSWORD`; missing verify/confirm service returns HTTP `503`
  `RECOVERY_UNAVAILABLE`. Focused route suite passed (14 tests at this cycle).
- Commit: `1754b3b fix: harden Firebase recovery error contracts`.

### 3. Frontend collapsed temporary errors into invalid-link state

Root causes:

- client mapped every non-policy/non-action-code response to
  `auth/internal-error` and allowed raw fetch rejections through;
- request initiation used an untyped generic error path;
- reset-link verification converted every rejection to the permanent invalid
  link screen, discarding a valid action code during provider outage, network
  failure, or throttling.

- RED: nine focused failures proved missing `RECOVERY_UNAVAILABLE`,
  `RATE_LIMITED`, network mapping, recovery-specific copy, and retry behavior.
- GREEN: client maps `RECOVERY_UNAVAILABLE` to
  `auth/recovery-unavailable`, `RATE_LIMITED` to
  `auth/too-many-requests`, and fetch rejection to
  `auth/network-request-failed`, without attaching response details or causes.
  Verification shows `Tentar novamente` for temporary failures and retains the
  same `oobCode`; only invalid/expired codes offer a new link. Confirmation
  temporary failures leave the password form available. Focused frontend suite
  passed (54 tests), followed by frontend lint and typecheck.
- Commit: `2edd533 fix: preserve recoverable password reset states`.

### 4. Recovery limiting used fixed windows instead of rolling windows

Root cause: three `express-rate-limit` instances used the default in-memory
fixed-window behavior. A burst immediately before and after the boundary could
exceed the specified rolling 15-minute limit.

- RED (store): the wished-for sliding-window module did not exist
  (`ERR_MODULE_NOT_FOUND`).
- GREEN (store): added an in-process timestamp store that removes only attempts
  at or before the rolling cutoff and returns exact remaining/retry state.
  Parameterized boundary tests cover request limit 5, verify limit 10, and
  confirm limit 10.
- RED (route integration): at exactly 15 minutes the old route remained fixed
  to its real clock and returned `429` where the injected rolling clock expected
  one expired attempt and HTTP `202`.
- GREEN (route integration): all three recovery routes now use separate
  sliding-window instances with limits 5/10/10, 15-minute windows, and
  `RateLimit-Policy`, `RateLimit`, and `Retry-After` response headers. Focused
  limiter and route suites passed (19 tests), followed by backend lint and
  typecheck.
- Commit: `d0ada38 fix: enforce sliding password recovery limits`.

### 5. Client-controlled request IDs could put secrets into logs and audits

Root cause: middleware trusted any non-empty `x-request-id` and copied it into
response metadata, HTTP completion logs, GraphQL context, and recovery audit
input without validation or a length bound.

- RED: a long `secret-token:` header was echoed and logged instead of being
  replaced by a UUID.
- GREEN: accept only 1-128 characters matching `[A-Za-z0-9._-]`; otherwise
  generate `crypto.randomUUID()` before any logger, handler, context, or audit
  sees the value. Tests prove a malicious header is absent from the response
  and logs while a bounded safe ID remains stable. Focused logger and recovery
  route suites passed (22 tests), followed by backend lint and typecheck.
- Commit: `f321e8f fix: sanitize client request IDs`.

## Minor findings

- Reconciled `docs/architecture/SYSTEM_ARCHITECTURE.md` with current GraphQL,
  Expo, Firebase Auth REST, sliding-window, and audit architecture.
- Removed obsolete Resend deployment wording from `docs/planning/ROADMAP.md`
  and retained shared rate limiting/trusted proxy work in EPIC-08.
- Reconciled `docs/specs/AUTHENTICATION_SPEC.md` with backend-only recovery,
  stable error codes, transient password handling, Firebase delivery, 5/10/10
  rolling limits, request-ID sanitization, open smoke acceptance, and EPIC-08.
- Missing `passwordRecovery` can no longer produce false verify/confirm success;
  both return HTTP `503 RECOVERY_UNAVAILABLE`.
- Commit: `ffeeb05 docs: reconcile password recovery architecture`.

Human documentation was not tested by source-text assertions. It was reviewed
against the approved design, current implementation, and terminology scan.

## Final verification gates

Fresh gates after all production and documentation changes:

- `npm test`: PASS. Backend 72/72; frontend 104/104; total 176 tests.
- `npm run lint`: PASS for backend and frontend.
- `npm run typecheck`: PASS for backend and frontend.
- `npm run build`: PASS. Backend TypeScript build plus Expo exports for Web,
  iOS, and Android.
- `git diff --check`: PASS before final report creation.
- focused RED/GREEN commands are documented under each finding above.

Expo build emitted the existing Node experimental CommonJS/ESM warning for
loading `app.config.js`; export still exited 0.

## Commits

1. `1754b3b fix: harden Firebase recovery error contracts`
2. `2edd533 fix: preserve recoverable password reset states`
3. `d0ada38 fix: enforce sliding password recovery limits`
4. `f321e8f fix: sanitize client request IDs`
5. `ffeeb05 docs: reconcile password recovery architecture`

## Open concerns intentionally preserved

- Real Firebase smoke remains open. No automated gate proves actual email
  delivery/content, Firebase Console action URL, authorized domain, successful
  password change, action-code non-reuse, old-password rejection, new-password
  login, or unknown-address response parity. TASK-019 and EPIC-02 must remain
  open until that smoke passes.
- Limiter is genuinely sliding-window but remains in-process. It does not share
  counters across multiple Cloud Run instances. Shared-store enforcement and
  reviewed trusted-proxy behavior remain EPIC-08 pre-deployment work.
