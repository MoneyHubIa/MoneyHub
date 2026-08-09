# Firebase Email Verification Design

**Date:** 2026-08-08
**Status:** Implemented and verified

## Context

MoneyHub authenticates users with Firebase Authentication and authorizes GraphQL profile mutations with the Firebase ID token. The backend intentionally permits authenticated users to read their profile before email verification, but rejects profile updates with the GraphQL error code `EMAIL_NOT_VERIFIED`.

The frontend currently creates Firebase accounts without sending a verification email, does not expose verification state or actions through its authentication boundary, and converts the backend rejection into a generic save failure. As a result, users cannot discover or complete the required verification step from the application.

## Goal

Implement one coherent Firebase-based email-verification flow so that:

- account registration automatically sends Firebase's verification email;
- an authenticated user can resend the verification email;
- a user who completed the link can refresh the Firebase session and ID token;
- the Settings screen explains why a profile update was rejected and lets the user recover without leaving the screen;
- the backend remains the authority that blocks sensitive profile updates until the token contains `email_verified: true`.

## Scope

This change covers Firebase email delivery and the recovery experience in the existing Settings screen. It does not add a dedicated verification route, custom transactional-email infrastructure, backend-generated action links, or changes to the backend's authorization policy.

## Architecture

### Firebase adapter

The Firebase adapter will wrap the modular Firebase Client SDK operations used by the application:

- `createUserWithEmailAndPassword` for registration;
- `sendEmailVerification` immediately after successful account creation and for manual resend;
- `reload` to obtain the latest verification state after the user follows the email link;
- `getIdToken(true)` to force a refreshed token containing the current `email_verified` claim.

Email sending remains entirely in Firebase. No SMTP provider or backend email endpoint is introduced.

### Authentication service

`SessionUser` will include `emailVerified` alongside `uid` and `email`. The authentication service will expose two explicit verification operations:

- `resendEmailVerification()` sends another Firebase verification email for the current user;
- `refreshEmailVerification()` reloads the current Firebase user, force-refreshes the token, and returns the updated session user.

Registration will send the initial verification email only after Firebase successfully creates the account. A failure to send that email will be surfaced as a registration error rather than silently leaving the user without a recovery path.

The service will require an authenticated Firebase user for resend and refresh operations. Missing sessions will produce the existing authentication-domain error instead of calling Firebase with an undefined user.

### Authentication provider

The authentication provider will expose the two verification operations to screens. After refresh, it will replace its local `SessionUser` state with the value returned by the service, because Firebase's auth-state observer is not guaranteed to emit merely because `reload()` changed `emailVerified`.

The forced token refresh is important independently of the visible provider state: subsequent Apollo requests must retrieve the new Firebase token so the backend sees the verified claim.

### Settings screen

The normal profile-reading experience remains available to every authenticated user. When saving changes:

1. the screen executes the existing profile mutation;
2. if Apollo reports GraphQL code `EMAIL_NOT_VERIFIED`, the generic error is replaced with a verification panel;
3. the panel explains that the email must be verified before changes can be saved;
4. **Reenviar e-mail** calls the resend operation and displays a success or actionable failure message;
5. **Já verifiquei** reloads Firebase and force-refreshes the token;
6. if Firebase now reports a verified email, the screen retries the pending profile mutation once;
7. if it remains unverified, the panel stays visible and tells the user that verification has not yet been detected.

Only `EMAIL_NOT_VERIFIED` activates this flow. Network failures, validation failures, and other GraphQL errors keep the existing generic save-error behavior. Automatic retry is limited to one mutation per explicit **Já verifiquei** action, preventing retry loops.

## Data Flow

### Registration

`Registration screen -> AuthProvider.register -> AuthService.register -> Firebase create user -> Firebase send verification email`

The authenticated session continues normally after registration. Profile reads work, while protected updates remain blocked until verification.

### Verification during profile save

`Profile mutation -> backend EMAIL_NOT_VERIFIED -> verification panel -> Firebase verification link -> Já verifiquei -> reload user -> force-refresh token -> update provider state -> retry profile mutation`

Apollo's authentication link continues requesting the current token from the authentication service. No second API URL or configuration value is added.

## Error Handling and User Feedback

- Initial-send failure: registration surfaces a Firebase-mapped error and does not claim that verification was sent.
- Resend success: the panel confirms that a new email was sent and asks the user to check inbox and spam.
- Resend failure: the panel shows a specific retry message while preserving the pending profile edits.
- Refresh still unverified: the screen reports that verification was not detected and does not retry the mutation.
- Refresh failure: the screen reports that verification status could not be refreshed.
- Retry failure with another error: the existing save-error message is used.
- Retry success: the normal save-success state is shown and the verification panel is cleared.

Buttons will be disabled while their associated asynchronous operation is running to avoid duplicate sends, refreshes, or saves.

## Security

Frontend state is informational and does not grant update permission. The backend continues validating Firebase ID tokens and requiring the verified-email claim for profile mutation. A forced token refresh updates the credential presented to the backend; it does not bypass authorization.

## Testing

Automated tests will cover:

- mapping `emailVerified` into `SessionUser`;
- sending verification after successful registration;
- resending verification for the current user;
- reloading the Firebase user and requesting `getIdToken(true)`;
- updating provider state after refresh;
- recognizing only the `EMAIL_NOT_VERIFIED` GraphQL code;
- showing the Settings verification panel after the protected mutation is rejected;
- resend success and failure feedback;
- refresh while still unverified without mutation retry;
- refresh after verification with exactly one mutation retry;
- retaining generic handling for unrelated save failures.

Backend authorization tests remain unchanged except for preserving the established contract: unverified users can read their profile and cannot update it.

## Acceptance Criteria

- A newly registered user receives a Firebase verification email automatically.
- An unverified user can open Settings and read existing profile data.
- Saving as an unverified user presents verification instructions rather than only a generic error.
- The user can resend the Firebase verification email from Settings.
- After completing the Firebase link, **Já verifiquei** refreshes both user state and token, then successfully retries the save.
- Other profile-save errors retain their existing behavior.
- No additional backend/frontend base URL, email provider, or authorization bypass is introduced.
