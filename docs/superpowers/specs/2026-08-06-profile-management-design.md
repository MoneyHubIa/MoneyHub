# Profile Management Design

## Objective

Complete `TASK-020` by allowing an authenticated, email-verified user to view
and update their own persisted profile without changing Firebase identity data.

## Scope

The first version edits exactly these `profiles` fields:

- `fullName`
- `preferredCurrency`
- `theme`

It adds a dedicated profile-management screen to the existing **Ajustes**
section of the authenticated Expo app and GraphQL operations to read and update
the current user's profile.

## Out of Scope

- Changing Firebase email, password, UID, or verification state.
- Creating a profile. `bootstrapProfile` remains the only creation path.
- Avatar, locale, notification preferences, account deletion, and financial
  preferences beyond the existing currency and theme fields.
- Database schema changes or a new Prisma migration.

## Backend Contract

GraphQL adds these operations:

```graphql
input UpdateMyProfileInput {
  fullName: String!
  preferredCurrency: String!
  theme: ProfileTheme!
}

type Query {
  myProfile: Profile!
}

type Mutation {
  updateMyProfile(input: UpdateMyProfileInput!): Profile!
}
```

Both operations derive ownership solely from `GraphQLContext.auth.profileId`.
They never accept a user ID, profile ID, Firebase UID, email, or verification
state from client input.

`myProfile` and `updateMyProfile` require a valid Firebase identity, a verified
email, and a non-null local profile. Missing authentication returns
`UNAUTHENTICATED`; an unverified email returns `EMAIL_NOT_VERIFIED`; and a
missing local profile returns `PROFILE_NOT_FOUND`.

Validation occurs before persistence:

- `fullName` is trimmed and must contain 1 to 120 characters.
- `preferredCurrency` is one of `BRL`, `USD`, or `EUR`.
- `theme` is `SYSTEM`, `LIGHT`, or `DARK`.

The resolver updates only the profile addressed by the authenticated context and
returns the persisted record.

## App Flow

Selecting **Ajustes** in the dashboard opens a dedicated settings view rather
than the current placeholder. On entry, it queries `myProfile` and initializes
a form with the stored values. The user can change name, currency, and theme,
then save.

While saving, controls are disabled. On success, the mutation result updates
Apollo's cache and the screen shows a success message. On failure, the form
retains the user's input and displays a safe error message. The screen does not
offer controls for Firebase credentials or identity data.

## Testing

Backend tests cover successful self-update, each validation failure, anonymous
access, unverified access, missing-profile access, and proof that the resolver
uses the context profile ID rather than client-provided identity data.

Frontend tests cover initial loading, rendering persisted values, editing each
field, save success, disabled state while saving, and visible failure feedback.

## Completion Criteria

`TASK-020` is complete when the GraphQL contract, authorization and validation,
Expo settings flow, and automated tests are implemented; root tests, lint, and
typecheck pass; and the task index and authentication epic are updated.
