# Final Fixes Report

## Scope

Applied final documentation-only fixes for the operational documentation refresh
task. Edited only approved operational docs plus this report file.

## Finding to fix map

1. `docs/specs/FOUNDATION_SPEC.md:5` contradicted current stack and epic state.
   - Fixed status text to describe implemented Node.js GraphQL backend, public
     authentication REST endpoints, universal Expo app, and `EPIC-01` as Done.

2. Recovery limiter wording was ambiguous in `SYSTEM_ARCHITECTURE`,
   `API_SPECIFICATION`, and `EPIC-08`.
   - Fixed all three docs to state three distinct rolling 15-minute buckets:
     5 initiation requests, 10 verification requests, and 10 confirmation
     requests.
   - Made future shared-store work explicit and preserved requirement that the
     shared deployment design keep those buckets separate.

3. `AUTHENTICATION_SPEC` missed retryable frontend recovery mappings.
   - Added explicit mapping notes for `auth/network-request-failed` and
     `auth/recovery-unavailable` and marked both retryable without invalidating
     the recovery link.

4. `API_SPECIFICATION` overstated `meta.requestId` guarantee.
   - Restricted the guarantee to handler-generated recovery response envelopes.
   - Documented that malformed-JSON and parser-level body-limit failures are
     outside that envelope guarantee.

## Validation

Executed targeted scans and formatting checks:

- `rg -n "EPIC-01|React/Vite|REST scaffold|Pending|5 initiation|10 verification|10 confirmation|shared store|meta.requestId|network-request-failed|recovery-unavailable" docs/specs/FOUNDATION_SPEC.md docs/architecture/SYSTEM_ARCHITECTURE.md docs/architecture/API_SPECIFICATION.md docs/specs/AUTHENTICATION_SPEC.md docs/tasks/EPIC-08_DEPLOY.md`
- `git diff --check`

Both checks passed on the final edited state.

## Commit

Commit created after verification:

- `docs: tighten final operational recovery contracts`

## Concerns

- No additional concerns. Findings matched current implementation and stayed
  within approved documentation scope.
