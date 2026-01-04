import * as React from "react";

import type { Route } from "./+types/dashboard";
import { RequireAuth, useAuth } from "~/auth/auth";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Dashboard | JKFC Admin" }];
}

export default function Dashboard() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}

function DashboardContent() {
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
        <div className="mx-auto flex max-w-5xl items-center justify-between p-4">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-600">
              {user?.email ?? user?.uid}
            </p>
          </div>

          <button
            type="button"
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <p className="text-gray-700">
            You&apos;re logged in. Build your admin tools here.
          </p>
        </div>
      </main>
    </div>
  );
}


