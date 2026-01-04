import * as React from "react";
import { Link, Outlet } from "react-router";

import type { Route } from "./+types/dashboard";
import { RequireAuth, useAuth } from "~/auth/auth";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Dashboard | JKFC Admin" }];
}

export default function DashboardLayout() {
  return (
    <RequireAuth>
      <DashboardShell />
    </RequireAuth>
  );
}

function DashboardShell() {
  const { user, signOut } = useAuth();
  const [signingOut, setSigningOut] = React.useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
          <Link to="/dashboard" className="font-semibold text-gray-900">
            JKFC Admin
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-sm text-gray-600">
              {user?.email ?? user?.uid}
            </span>
            <button
              type="button"
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60"
              onClick={handleSignOut}
              disabled={signingOut}
            >
              {signingOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4">
        <Outlet />
      </main>
    </div>
  );
}


