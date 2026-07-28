import { useEffect, useRef, useState } from 'react';
import { Redirect, Stack } from 'expo-router';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useAuth } from '@/providers/AuthProvider';

const SUCCESS_MESSAGE_DURATION_MS = 1500;

export default function AnonymousLayout() {
  const { loading, user } = useAuth();
  const wasAnonymous = useRef(false);
  const [readyToRedirect, setReadyToRedirect] = useState(false);

  // Track that the user was in anonymous state (viewing the login/register form)
  if (!loading && !user) {
    wasAnonymous.current = true;
  }

  useEffect(() => {
    if (!user || !wasAnonymous.current) return;

    // User just authenticated — delay redirect so the success message is visible
    const timer = setTimeout(
      () => setReadyToRedirect(true),
      SUCCESS_MESSAGE_DURATION_MS
    );
    return () => clearTimeout(timer);
  }, [user]);

  if (loading) return <LoadingScreen />;

  // Already authenticated on mount — redirect immediately
  if (user && !wasAnonymous.current) return <Redirect href="/(app)" />;

  // Just authenticated — wait for the success message to be visible
  if (user && readyToRedirect) return <Redirect href="/(app)" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}

