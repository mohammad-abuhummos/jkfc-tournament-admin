import { Navigate } from "react-router";

import { useAuth } from "~/auth/auth";
import { FullPageSpinner } from "~/components/FullPageSpinner";

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) return <FullPageSpinner label="Checking session..." />;
  return user ? (
    <Navigate to="/dashboard" replace />
  ) : (
    <Navigate to="/login" replace />
  );
}


