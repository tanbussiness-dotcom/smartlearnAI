'use client';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useAuth } from '@/firebase/provider';

interface UserState {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to get the current authenticated user.
 * @returns {UserState} The user, loading state, and error.
 */
export const useUser = (): UserState => {
  const auth = useAuth();
  const [userState, setUserState] = useState<UserState>({
    user: auth.currentUser,
    isLoading: !auth.currentUser,
    error: null,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setUserState({ user, isLoading: false, error: null });
      },
      (error) => {
        console.error('useUser onAuthStateChanged error:', error);
        setUserState({ user: null, isLoading: false, error });
      }
    );

    return () => unsubscribe();
  }, [auth]);

  return userState;
};
