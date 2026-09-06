import { GraphQLError } from 'graphql';
import type { GraphQLContext } from '../../../core/graphql/graphql.js';

const currencies = new Set(['BRL', 'USD', 'EUR']);
const themes = new Set(['SYSTEM', 'LIGHT', 'DARK']);

export type ProfileTheme = 'SYSTEM' | 'LIGHT' | 'DARK';

export type ProfileInput = {
  fullName: string;
  preferredCurrency: string;
  theme: ProfileTheme;
};

export type Profile = {
  id: string;
  fullName: string;
  preferredCurrency: string;
  theme: ProfileTheme;
};

export type ProfileRepository = {
  findUnique(args: { where: { id: string } }): Promise<Profile | null>;
  update(args: {
    where: { id: string };
    data: Omit<Profile, 'id'>;
  }): Promise<Profile>;
};

function profileError(message: string, code: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code } });
}

function requireProfileId(context: GraphQLContext): string {
  if (!context.auth) throw profileError('Authentication credentials are invalid.', 'UNAUTHENTICATED');
  if (!context.auth.profileId) throw profileError('Profile was not found.', 'PROFILE_NOT_FOUND');
  return context.auth.profileId;
}

function requireVerifiedProfileId(context: GraphQLContext): string {
  if (!context.auth) throw profileError('Authentication credentials are invalid.', 'UNAUTHENTICATED');
  if (!context.auth.emailVerified) {
    throw profileError('Email verification is required.', 'EMAIL_NOT_VERIFIED');
  }
  if (!context.auth.profileId) throw profileError('Profile was not found.', 'PROFILE_NOT_FOUND');
  return context.auth.profileId;
}

function normalizeInput(input: ProfileInput): Omit<Profile, 'id'> {
  const fullName = input.fullName.trim();
  if (fullName.length === 0 || fullName.length > 120) {
    throw profileError('Full name must contain between 1 and 120 characters.', 'BAD_USER_INPUT');
  }

  if (!currencies.has(input.preferredCurrency)) {
    throw profileError('Preferred currency is invalid.', 'BAD_USER_INPUT');
  }

  if (!themes.has(input.theme)) {
    throw profileError('Profile theme is invalid.', 'BAD_USER_INPUT');
  }

  return { fullName, preferredCurrency: input.preferredCurrency, theme: input.theme };
}

export async function getMyProfile(
  context: GraphQLContext,
  repository: ProfileRepository
): Promise<Profile> {
  const profileId = requireProfileId(context);
  const profile = await repository.findUnique({ where: { id: profileId } });
  if (!profile) throw profileError('Profile was not found.', 'PROFILE_NOT_FOUND');
  return profile;
}

export async function updateMyProfile(
  context: GraphQLContext,
  input: ProfileInput,
  repository: ProfileRepository
): Promise<Profile> {
  const profileId = requireVerifiedProfileId(context);
  return repository.update({ where: { id: profileId }, data: normalizeInput(input) });
}
