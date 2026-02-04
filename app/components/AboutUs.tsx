import * as React from "react";

import { getFirestoreClient } from "~/firebase/client";
import type { TournamentAboutUs } from "~/features/tournaments/types";

const DEFAULT_LOGO_URL = "/logo.webp";
const DEFAULT_LOGO_ALT = "SMT Group";
const DEFAULT_PARAGRAPHS = [
  "SMT Group organizes and supports events and tournaments.",
  "We are committed to delivering high-quality competitive experiences for participants and audiences alike.",
];

export type AboutUsProps = {
  tournamentId?: string;
};

export function AboutUs({ tournamentId }: AboutUsProps) {
  const [aboutUs, setAboutUs] = React.useState<TournamentAboutUs | null>(null);
  const [loading, setLoading] = React.useState(!!tournamentId);

  React.useEffect(() => {
    if (!tournamentId) {
      setAboutUs(null);
      setLoading(false);
      return;
    }

    let unsubscribe: (() => void) | undefined;

    void (async () => {
      setLoading(true);
      try {
        const firestore = await getFirestoreClient();
        const { doc, onSnapshot } = await import("firebase/firestore");

        unsubscribe = onSnapshot(
          doc(firestore, "tournaments", tournamentId),
          (snap) => {
            const data = snap.exists() ? snap.data() : undefined;
            const about = data?.aboutUs as TournamentAboutUs | undefined;
            const hasParagraphs =
              about &&
              Array.isArray(about.paragraphs) &&
              about.paragraphs.length > 0;
            setAboutUs(hasParagraphs ? about : null);
            setLoading(false);
          },
          (err) => {
            console.error("[AboutUs] Firestore subscription failed", err);
            setAboutUs(null);
            setLoading(false);
          },
        );
      } catch (err) {
        console.error("[AboutUs] Firestore subscription failed", err);
        setAboutUs(null);
        setLoading(false);
      }
    })();

    return () => unsubscribe?.();
  }, [tournamentId]);

  const useCustom = aboutUs != null;
  const logoUrl = useCustom && aboutUs.logoUrl ? aboutUs.logoUrl : DEFAULT_LOGO_URL;
  const logoAlt = useCustom && aboutUs.logoAlt ? aboutUs.logoAlt : DEFAULT_LOGO_ALT;
  const paragraphs = useCustom ? aboutUs.paragraphs : DEFAULT_PARAGRAPHS;

  if (loading) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="animate-pulse text-sm text-gray-500">
          Loading About Us...
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6">
      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-left">
        <img
          src={logoUrl}
          alt={logoAlt}
          className="h-16 w-auto shrink-0 object-contain sm:h-20"
        />
        <div className="space-y-2">
          {paragraphs.map((p, i) => (
            <p key={i} className="text-sm text-gray-700">
              {p}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
