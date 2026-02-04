import * as React from "react";

import type { Route } from "./+types/tournaments.$tournamentId.settings";
import {
  updateTournament,
  updateTournamentAboutUs,
  uploadTournamentLogo,
} from "~/features/tournaments/api";
import { useTournamentManager } from "~/features/tournaments/context";
import type {
  TournamentAboutUs,
  TournamentStatus,
} from "~/features/tournaments/types";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Tournament Settings | JKFC Admin" }];
}

export default function TournamentSettings() {
  const { tournamentId, tournament } = useTournamentManager();

  const [nameEn, setNameEn] = React.useState(tournament.nameEn);
  const [nameAr, setNameAr] = React.useState(tournament.nameAr);
  const [description, setDescription] = React.useState(tournament.description ?? "");
  const [status, setStatus] = React.useState<TournamentStatus>(tournament.status);
  const [youtubeUrl, setYoutubeUrl] = React.useState(tournament.youtubeUrl ?? "");
  const [youtubeActive, setYoutubeActive] = React.useState<boolean>(
    tournament.youtubeActive ?? false,
  );

  const [logoFile, setLogoFile] = React.useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = React.useState<string | null>(null);

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const [aboutUsLogoUrl, setAboutUsLogoUrl] = React.useState("");
  const [aboutUsLogoAlt, setAboutUsLogoAlt] = React.useState("");
  const [aboutUsParagraphs, setAboutUsParagraphs] = React.useState<string[]>([
    "",
  ]);
  const [savingAboutUs, setSavingAboutUs] = React.useState(false);
  const [aboutUsError, setAboutUsError] = React.useState<string | null>(null);
  const [aboutUsMessage, setAboutUsMessage] = React.useState<string | null>(
    null,
  );

  React.useEffect(() => {
    setNameEn(tournament.nameEn);
    setNameAr(tournament.nameAr);
    setDescription(tournament.description ?? "");
    setStatus(tournament.status);
    setYoutubeUrl(tournament.youtubeUrl ?? "");
    setYoutubeActive(tournament.youtubeActive ?? false);
    setLogoFile(null);
    setLogoPreviewUrl(null);
  }, [tournamentId]);

  React.useEffect(() => {
    const au = tournament.aboutUs;
    if (au?.paragraphs?.length) {
      setAboutUsLogoUrl(au.logoUrl ?? "");
      setAboutUsLogoAlt(au.logoAlt ?? "");
      setAboutUsParagraphs(au.paragraphs.length ? au.paragraphs : [""]);
    } else {
      setAboutUsLogoUrl("");
      setAboutUsLogoAlt("");
      setAboutUsParagraphs([""]);
    }
  }, [tournamentId, tournament.aboutUs]);

  React.useEffect(() => {
    if (!logoFile) {
      setLogoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(logoFile);
    setLogoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    const trimmedYoutubeUrl = youtubeUrl.trim();
    if (youtubeActive && !trimmedYoutubeUrl) {
      setError("Please add a YouTube link or set it to inactive.");
      setSaving(false);
      return;
    }

    try {
      await updateTournament({
        tournamentId,
        nameEn: nameEn.trim(),
        nameAr: nameAr.trim(),
        description: description.trim(),
        youtubeUrl: trimmedYoutubeUrl,
        youtubeActive,
        status,
      });

      if (logoFile) {
        await uploadTournamentLogo({
          tournamentId,
          file: logoFile,
          previousPath: tournament.logoPath ?? null,
        });
        setLogoFile(null);
      }

      setMessage("Saved.");
    } catch (err) {
      console.error("[Settings] save failed", err);
      setError("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAboutUs(e: React.FormEvent) {
    e.preventDefault();
    setSavingAboutUs(true);
    setAboutUsError(null);
    setAboutUsMessage(null);

    const paragraphs = aboutUsParagraphs.map((p) => p.trim()).filter(Boolean);
    // Empty paragraphs = use default About Us on tournament pages
    try {
      const aboutUs: TournamentAboutUs = {
        paragraphs,
        ...(aboutUsLogoUrl.trim() && { logoUrl: aboutUsLogoUrl.trim() }),
        ...(aboutUsLogoAlt.trim() && { logoAlt: aboutUsLogoAlt.trim() }),
      };
      await updateTournamentAboutUs({ tournamentId, aboutUs });
      setAboutUsMessage(
        paragraphs.length
          ? "About Us saved."
          : "About Us cleared; default content will show on tournament pages.",
      );
    } catch (err) {
      console.error("[Settings] save About Us failed", err);
      setAboutUsError("Failed to save About Us.");
    } finally {
      setSavingAboutUs(false);
    }
  }

  function addAboutUsParagraph() {
    setAboutUsParagraphs((prev) => [...prev, ""]);
  }

  function removeAboutUsParagraph(index: number) {
    setAboutUsParagraphs((prev) =>
      prev.length > 1 ? prev.filter((_, i) => i !== index) : [""],
    );
  }

  const currentLogo = logoPreviewUrl || tournament.logoUrl || "";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-600">
          Update tournament name, status, YouTube link, and logo.
        </p>

        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {message}
          </div>
        ) : null}

        <form className="mt-6 space-y-6" onSubmit={handleSave}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Name (EN)</span>
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                required
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">Name (AR)</span>
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                required
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Description</span>
            <textarea
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <label className="block max-w-xs">
            <span className="text-sm font-medium text-gray-700">Status</span>
            <select
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              value={status}
              onChange={(e) => setStatus(e.target.value as TournamentStatus)}
            >
              <option value="draft">draft</option>
              <option value="published">published</option>
            </select>
          </label>

          <div className="rounded-xl border border-gray-200 p-4">
            <div className="text-sm font-semibold text-gray-900">YouTube</div>
            <p className="mt-1 text-sm text-gray-600">
              Add a YouTube link and choose if it&apos;s active or inactive.
            </p>

            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium text-gray-700">Link</span>
                <input
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                  type="url"
                  inputMode="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-gray-700">Status</span>
                <select
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  value={youtubeActive ? "active" : "inactive"}
                  onChange={(e) => setYoutubeActive(e.target.value === "active")}
                >
                  <option value="inactive">inactive</option>
                  <option value="active">active</option>
                </select>
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 p-4">
            <div className="flex items-start gap-4">
              <div className="h-20 w-20 overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                {currentLogo ? (
                  <img
                    src={currentLogo}
                    alt="Tournament logo"
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-gray-900">Logo</div>
                <p className="mt-1 text-sm text-gray-600">
                  Upload a square image for best results.
                </p>

                <input
                  className="mt-3 block w-full text-sm text-gray-700"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                />

                {logoFile ? (
                  <p className="mt-2 text-xs text-gray-600">
                    Selected: {logoFile.name}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-60"
            disabled={saving}
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="text-xl font-semibold text-gray-900">About Us</h2>
        <p className="mt-1 text-sm text-gray-600">
          This block is shown on every tournament page. Add paragraphs and an
          optional logo; if left empty, the default SMT Group content is shown.
        </p>

        {aboutUsError ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {aboutUsError}
          </div>
        ) : null}
        {aboutUsMessage ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {aboutUsMessage}
          </div>
        ) : null}

        <form className="mt-6 space-y-6" onSubmit={handleSaveAboutUs}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                About Us logo URL (optional)
              </span>
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                type="url"
                inputMode="url"
                placeholder="https://..."
                value={aboutUsLogoUrl}
                onChange={(e) => setAboutUsLogoUrl(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                About Us logo alt text (optional)
              </span>
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Tournament logo"
                value={aboutUsLogoAlt}
                onChange={(e) => setAboutUsLogoAlt(e.target.value)}
              />
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Paragraphs</span>
              <button
                type="button"
                onClick={addAboutUsParagraph}
                className="text-sm text-blue-600 hover:underline"
              >
                + Add paragraph
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Add one or more paragraphs for custom About Us. Save with all
              paragraphs empty to use the default SMT Group content on tournament
              pages.
            </p>
            <div className="mt-3 space-y-3">
              {aboutUsParagraphs.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <textarea
                    className="min-h-[80px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={`Paragraph ${i + 1}`}
                    value={p}
                    onChange={(e) =>
                      setAboutUsParagraphs((prev) => {
                        const next = [...prev];
                        next[i] = e.target.value;
                        return next;
                      })
                    }
                  />
                  <button
                    type="button"
                    onClick={() => removeAboutUsParagraph(i)}
                    className="shrink-0 rounded-lg border border-gray-300 px-2 text-sm text-gray-600 hover:bg-gray-50"
                    title="Remove paragraph"
                  >
                    −
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-60"
            disabled={savingAboutUs}
          >
            {savingAboutUs ? "Saving..." : "Save About Us"}
          </button>
        </form>
      </div>
    </div>
  );
}


