# Authentication Specification

## Status

Approved

## Objective

Define the contracts for registration, login, email verification, password recovery, Firebase token management, profile bootstrap, and authorization boundaries. This document is the single source of truth for MoneyHub identity rules; implementation tasks must not introduce different identity behavior.

## Identity Architecture

MoneyHub delegates identity and credential management to Firebase Authentication. The backend is a resource server that verifies Firebase identity, synchronizes the local identity projection, and authorizes access to product data. It never manages credentials directly.

- **Frontend (Expo App and Web):** Uses the Firebase Auth SDK to register and authenticate users, complete email-verification actions, refresh sessions, and retrieve ID tokens. Password-recovery actions use the MoneyHub backend REST API.
- **Backend (Node.js/GraphQL and REST):** Uses the Firebase Admin SDK to verify ID tokens and load the current Firebase user before creating the authenticated context. Its isolated Firebase Auth REST adapter owns password-recovery initiation, verification, and confirmation.
- **Firebase Auth:** Is the source of truth for `uid`, email, and email-verification state.
- **PostgreSQL:** Stores an application identity projection in `users` and application preferences in `profiles`.
- **Data ownership:** The Firebase UID is the external identity key used to scope user-owned domain data. `users.id` is the internal relational key used by `profiles.user_id`.

## Contracts

### Registration and Login

- Users register and log in directly through the Firebase Auth SDK on the client.
- Password hashes and refresh tokens are managed exclusively by Firebase. The backend receives a new password only in the public password-recovery confirmation request and forwards it directly to Firebase Auth REST. It must never log or store a password.
- The client retrieves a Firebase ID token and includes it in the `Authorization: Bearer <ID_TOKEN>` header for authenticated GraphQL requests.
- An account must expose an email address. The backend rejects a Firebase identity without an email using the stable GraphQL error code `AUTH_EMAIL_REQUIRED`.
- Creating a Firebase account does not require a pre-existing local `users` or `profiles` row. The authenticated profile-bootstrap flow creates those records.

### Token Verification and Authenticated Context

For every authenticated GraphQL request, the backend must:

1. Verify the bearer ID token with the Firebase Admin SDK, including its signature, issuer, audience, expiration, and revocation policy.
2. Load the current Firebase user by the verified `uid`. The current Firebase user record, rather than a potentially stale local row, is authoritative for email and verification state.
3. Look up `users` by `firebase_uid`. If the row exists, synchronize its email and verification projection on every authenticated request. If it does not exist, leave `userId` and `profileId` as `null`; only the profile-bootstrap mutation may create the local identity records.
4. Build an immutable authenticated context with the following minimum shape:

```ts
type AuthContext = {
  uid: string;
  email: string;
  emailVerified: boolean;
  userId: string | null;
  profileId: string | null;
};
```

- `uid`, `email`, and `emailVerified` come from the current Firebase user.
- `userId` is `users.id` when the local user projection exists; otherwise it is `null`.
- `profileId` is `profiles.id` when a profile exists; otherwise it is `null`.
- A valid Firebase identity remains authenticated when `userId` or `profileId` is `null`. Missing local records represent a bootstrap state, not an invalid token.
- Resolvers and services must obtain identity from this context. They must never accept a Firebase UID, local user ID, profile ID, email, or verification flag from client input as proof of identity.

### Email Verification

Firebase is the source of truth for whether an email is verified. Firebase generates and delivers verification action links.

The backend must require `emailVerified === true` for every authenticated product operation except this explicit bootstrap allowlist:

- read the current authentication state (`me`);
- run `bootstrapProfile`;
- read the current user's own profile;
- request or resend the current user's email-verification link.

An unverified user is authenticated but not authorized to use product features. Until verification, the backend must block:

- all reads and writes of financial data, including categories, cost centers, transactions, accounts, goals, and dashboards;
- all agenda, event, reminder, and notification operations;
- all AI assistant, conversation, and AI-context operations;
- profile updates and every other authenticated mutation not included in the bootstrap allowlist.

Blocked operations must return the stable GraphQL error code `EMAIL_NOT_VERIFIED`. Authorization must use `AuthContext.emailVerified`; it must not authorize from `users.email_verified_at` alone.

After a user completes a verification link, the client must force-refresh the Firebase ID token before retrying a protected operation. The backend still loads the current Firebase user when constructing the authenticated context so that Firebase remains authoritative.

#### Local verification projection

Whenever the backend synchronizes a Firebase identity, it must update `users.email_verified_at` as follows:

- if the normalized Firebase email differs from `users.email`, replace the email and reset the timestamp to the backend observation time when the new email is verified, or to `null` when it is unverified;
- if Firebase reports `emailVerified: true` and the column is `null`, set it to the backend observation time;
- if Firebase reports `emailVerified: true` and the column already has a value, preserve the original value;
- if Firebase reports `emailVerified: false`, set the column to `null`, including after an email change that resets verification.

Firebase does not expose the original verification timestamp, so `email_verified_at` records when MoneyHub first observed the current email as verified. It is a synchronized local projection for application data and auditing, not an independent authorization source.

### Password Recovery

- All recovery operations pass through public MoneyHub backend REST endpoints;
  the frontend must not call Firebase password-recovery SDK methods directly.
- `POST /auth/password-recovery` accepts an email. Syntactically valid input
  always returns account-neutral HTTP `202` with the same public result for
  known addresses, unknown addresses, and provider failures. Each recovery
  route parses JSON bodies with a `16 KiB` limit.
- `POST /auth/password-recovery/verify` accepts a non-empty `oobCode`. Invalid,
  expired, used, or malformed codes return HTTP `400`
  `INVALID_OR_EXPIRED_ACTION_CODE`; too many attempts return
  `429 RATE_LIMITED`; other provider failures or missing service wiring return
  HTTP `503` `RECOVERY_UNAVAILABLE`.
- `POST /auth/password-recovery/confirm` accepts `oobCode` and `newPassword`.
  Invalid action codes use `INVALID_OR_EXPIRED_ACTION_CODE`; invalid password
  input uses `INVALID_PASSWORD`; Firebase policy rejection uses `WEAK_PASSWORD`;
  too many attempts use `RATE_LIMITED`; other provider failures or missing
  service wiring use HTTP `503` `RECOVERY_UNAVAILABLE`.
- Firebase generates and delivers recovery action links and remains responsible
  for changing the credential. Firebase Console owns recovery email content and
  the action URL targeting the MoneyHub `/reset-password` handler. The backend
  initiation request currently sends `continueUrl: ${APP_URL}/login` to
  Firebase Auth REST.
- The backend-owned Firebase Auth REST adapter aborts provider calls after
  10 seconds and maps only allowlisted provider codes into recovery audit
  events.
- Request initiation permits 5 attempts per source IP per rolling 15 minutes.
  Verify and confirm each permit 10 attempts per source IP per rolling
  15 minutes. The current store is in-process; shared multi-instance enforcement
  and reviewed trusted-proxy configuration are future scale-hardening work.
- Recovery operations are audited with only `requestId`, internal `status`, the
  SHA-256 hash of the normalized email for initiation events, and an
  allowlisted provider code when one is safe to retain. Raw email, password,
  `oobCode`, token, provider response body, full action link, and Firebase API
  key material are prohibited. Client-provided request IDs must match
  `[A-Za-z0-9._-]{1,128}` or be replaced by a generated UUID before response
  metadata, logs, GraphQL context, and recovery audit events use them.
- Frontend recovery screens treat temporary verification or confirmation
  failures as retryable. Only invalid or expired action codes invalidate the
  link and send the user back to request a new one.
- Frontend recovery error mapping treats both
  `auth/network-request-failed` and `auth/recovery-unavailable` as retryable
  temporary recovery failures. Neither code invalidates the link or changes
  the requirement to let the user retry verification or confirmation.
- After a successful password reset confirmation, the client signs out the
  local session before it offers navigation back to login.
- Password recovery does not create or bootstrap local user or profile records.
- TASK-019 real Firebase smoke confirmed delivery, email content, the MoneyHub
  action URL, successful password change, code non-reuse, old-password
  rejection, new-password login, and unknown-address response parity.
  EPIC-02 is complete.

### Profile Bootstrap

The backend must expose this authenticated GraphQL contract:

```graphql
enum ProfileTheme {
  SYSTEM
  LIGHT
  DARK
}

input BootstrapProfileInput {
  fullName: String!
  preferredCurrency: String = "BRL"
  theme: ProfileTheme = SYSTEM
}

type Profile {
  id: ID!
  fullName: String!
  preferredCurrency: String!
  theme: ProfileTheme!
}

extend type AuthUser {
  profile: Profile
  needsProfileBootstrap: Boolean!
}

type BootstrapProfilePayload {
  user: AuthUser!
  profile: Profile!
  created: Boolean!
}

extend type Mutation {
  bootstrapProfile(input: BootstrapProfileInput!): BootstrapProfilePayload!
}
```

The mutation requires a valid Firebase token but does not require a verified email, because completing the local bootstrap is part of the pre-verification allowlist. It derives identity exclusively from `AuthContext`.

#### Minimum profile data

- `fullName` is required after trimming and must contain between 1 and 120 characters.
- `preferredCurrency` is an uppercase ISO 4217 currency code and defaults to `BRL`.
- `theme` is one of `SYSTEM`, `LIGHT`, or `DARK` and defaults to `SYSTEM`.
- The Firebase UID, email, email-verification state, and any database identifiers are not accepted in `BootstrapProfileInput`.

#### Persistence and synchronization

The mutation must execute in one database transaction:

1. Load the current Firebase user and normalize its email by trimming it and converting it to lowercase.
2. Upsert `users` by `firebase_uid`, synchronizing `email` and `email_verified_at` according to this specification.
3. Create `profiles` with `profiles.user_id = users.id` when no profile exists for that user.
4. Return the persisted user and profile and set `created` to `true` only when this call created the profile.

The storage contract requires:

- `users.firebase_uid` to be non-null and unique;
- the normalized `users.email` to be non-null and unique;
- `profiles.user_id` to be a non-null, unique foreign key to `users.id`;
- a user to have at most one profile.

If the normalized email is already linked to another Firebase UID, the mutation must fail atomically with `IDENTITY_EMAIL_CONFLICT`; it must never relink or merge identities automatically.

#### Idempotency and incomplete local state

- Repeating `bootstrapProfile` for the same Firebase UID returns the same `users` and `profiles` records.
- A repeated call synchronizes identity fields but does not overwrite an existing profile with bootstrap input. Profile changes belong to the dedicated profile-management mutation.
- Concurrent calls must rely on the unique constraints and transactional conflict handling to converge on one user and one profile.
- If the Firebase user exists but neither local record exists, the mutation creates both.
- If `users` exists but `profiles` does not, the mutation synchronizes the user and creates the missing profile.
- If both records exist, the mutation synchronizes the user and returns the existing profile with `created: false`.
- Before bootstrap, `me` must still return the authenticated Firebase identity with `profile: null` and `needsProfileBootstrap: true`. After bootstrap, it returns the persisted profile and `needsProfileBootstrap: false`. Product operations remain unavailable until the profile exists and the email is verified.

### Authorization Boundaries

- Authentication validates who the caller is; email verification and profile existence determine whether the caller may enter product flows.
- Every user-owned query and mutation must derive its ownership filter from the authenticated `uid`. Repositories must not expose unscoped cross-user access paths.
- Product operations must require both `emailVerified === true` and a non-null `profileId`, in addition to any domain-specific authorization.
- Profile bootstrap is the only operation that may create the local `users` and `profiles` identity link.
- Administrative roles, account linking, identity merging, and Firebase-account deletion synchronization are outside the first-release contract and require separate specifications before implementation.

## Specification Completion Criteria

These checks certify that `TASK-008` has fixed the required contracts. They do not claim that the implementation tasks are complete.

- [x] Firebase Auth is defined as the exclusive credential and external identity authority.
- [x] Registration, login, token delivery, email verification, and password recovery boundaries are explicit.
- [x] The authenticated context has required fields and defined behavior when local records are absent.
- [x] Email-verification requirements, allowed bootstrap operations, blocked product operations, and error behavior are explicit.
- [x] Synchronization rules for `users.firebase_uid`, `users.email`, and `users.email_verified_at` are defined.
- [x] The `bootstrapProfile` GraphQL mutation, minimum fields, defaults, identity source, and response are defined.
- [x] Profile bootstrap is transactionally idempotent and covers missing, partial, repeated, and concurrent local state.
- [x] The relationship between `users.firebase_uid`, `users.id`, and `profiles.user_id` is unambiguous.
- [x] Authorization and data-scoping boundaries are fixed for future implementation tasks.
