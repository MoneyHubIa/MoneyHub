# Expo App Foundation Specification

## Status

Approved for `TASK-049` and the app portion of `TASK-009`.

## Runtime and Navigation

- Expo SDK 57 with strict TypeScript.
- `apps/frontend` remains the universal app workspace.
- Expo Router separates anonymous authentication routes from authenticated app
  routes.
- Existing MoneyHub navigation and dashboard placeholders are ported to React
  Native components with responsive Web and mobile layouts.

## Data and Identity

- Apollo Client reads `EXPO_PUBLIC_GRAPHQL_ENDPOINT` and resolves a fresh
  Firebase ID token for every request.
- Firebase JS SDK implements email/password registration, login, and session
  restoration on Web, iOS, and Android.
- Logout, recovery, verification delivery, and profile bootstrap remain outside
  this foundation.

## Analytics

- Application code depends only on the typed `AnalyticsAdapter` contract.
- Web uses Firebase Analytics after `isSupported()` succeeds.
- Configured development builds use React Native Firebase Analytics.
- Expo Go, missing configuration, unsupported browsers, and SDK failures use a
  no-op adapter without interrupting application workflows.
- Event parameters must never contain PII or financial data.

## Verification

Jest Expo and React Native Testing Library cover routing, session state, forms,
Apollo authorization, and adapter behavior. Firebase integration runs against
the Auth Emulator. Expo export must bundle Web, iOS, and Android.
