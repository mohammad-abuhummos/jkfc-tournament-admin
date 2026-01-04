import * as React from "react";
import { Navigate, useLocation } from "react-router";

import type { User } from "firebase/auth";
import {
  initFirebaseAnalytics,
  onAuthStateChangedClient,
  signInWithEmailPassword,
  signOutClient,
} from "~/firebase/client";
import { FullPageSpinner } from "~/components/FullPageSpinner";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | undefined;

    // Analytics is optional; this is safe to call in browsers only.
    void initFirebaseAnalytics();

    void (async () => {
      try {
        unsubscribe = await onAuthStateChangedClient((nextUser) => {
          if (!mounted) return;
          setUser(nextUser);
          setLoading(false);
        });
      } catch (err) {
        console.error("[AuthProvider] Failed to initialize Firebase Auth", err);
        if (!mounted) return;
        setUser(null);
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  const signIn = React.useCallback(async (email: string, password: string) => {
    await signInWithEmailPassword(email, password);
  }, []);

  const signOut = React.useCallback(async () => {
    await signOutClient();
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({ user, loading, signIn, signOut }),
    [user, loading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = React.useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within <AuthProvider>");
  return value;
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner label="Checking session..." />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <>{children}</>;
}


