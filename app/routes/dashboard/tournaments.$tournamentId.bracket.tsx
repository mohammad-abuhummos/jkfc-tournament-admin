import * as React from "react";

import type { Route } from "./+types/tournaments.$tournamentId.bracket";
import { FullPageSpinner } from "~/components/FullPageSpinner";
import {
  saveTournamentBracketState,
  subscribeToTournamentBracketState,
  subscribeToTournamentTeams,
} from "~/features/tournaments/api";
import { setBracketMatchResult, generateSingleEliminationBracket } from "~/features/tournaments/bracket";
import { useTournamentManager } from "~/features/tournaments/context";
import type { BracketState, Team } from "~/features/tournaments/types";

export function meta({ }: Route.MetaArgs) {
  return [{ title: "Bracket | JKFC Admin" }];
}

const BRACKET_SIZES = [4, 8, 16, 32] as const;

export default function TournamentBracketAdmin() {
  const { tournamentId } = useTournamentManager();

  const [teams, setTeams] = React.useState<Team[]>([]);
  const [bracket, setBracket] = React.useState<BracketState | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const [size, setSize] = React.useState<(typeof BRACKET_SIZES)[number]>(8);
  const [selectedTeamIds, setSelectedTeamIds] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let unsubTeams: (() => void) | undefined;
    let unsubBracket: (() => void) | undefined;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        unsubTeams = await subscribeToTournamentTeams(
          tournamentId,
          (items) => setTeams(items),
          (err) => {
            console.error("[Bracket] subscribeToTournamentTeams failed", err);
            setError("Failed to load teams.");
          },
        );

        unsubBracket = await subscribeToTournamentBracketState(
          tournamentId,
          (state) => {
            setBracket(state);
            setLoading(false);
          },
          (err) => {
            console.error("[Bracket] subscribeToTournamentBracketState failed", err);
            setError("Failed to load bracket.");
            setLoading(false);
          },
        );
      } catch (err) {
        console.error("[Bracket] subscribe failed", err);
        setError("Failed to load data.");
        setLoading(false);
      }
    })();

    return () => {
      unsubTeams?.();
      unsubBracket?.();
    };
  }, [tournamentId]);

  const teamById = React.useMemo(() => {
    const m = new Map<string, Team>();
    for (const t of teams) m.set(t.id, t);
    return m;
  }, [teams]);

  async function handleGenerateBracket() {
    setError(null);
    setMessage(null);
    setSaving(true);

    try {
      const next = generateSingleEliminationBracket({
        teamIds: selectedTeamIds,
        size,
      });
      await saveTournamentBracketState({ tournamentId, bracket: next });
      setMessage("Bracket generated.");
    } catch (err) {
      console.error("[Bracket] generate/save failed", err);
      setError(
        err instanceof Error ? err.message : "Failed to generate bracket.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSetMatchResult(input: {
    roundIndex: number;
    matchIndex: number;
    score1: number;
    score2: number;
  }) {
    if (!bracket) return;
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      const next = setBracketMatchResult(bracket, input);
      await saveTournamentBracketState({ tournamentId, bracket: next });
      setMessage("Bracket updated.");
    } catch (err) {
      console.error("[Bracket] setBracketMatchResult failed", err);
      setError(err instanceof Error ? err.message : "Failed to update bracket.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <FullPageSpinner label="Loading bracket..." />;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-gray-900">Bracket</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage knockout bracket.
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

        <div className="mt-6 grid gap-4 lg:grid-cols-[220px_1fr]">
          <div className="rounded-xl border border-gray-200 p-4">
            <div className="text-sm font-semibold text-gray-900">
              Generate bracket
            </div>
            <label className="mt-3 block">
              <span className="text-sm font-medium text-gray-700">Size</span>
              <select
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                value={size}
                onChange={(e) =>
                  setSize(Number(e.target.value) as (typeof BRACKET_SIZES)[number])
                }
              >
                {BRACKET_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              disabled={saving || selectedTeamIds.length !== size}
              onClick={handleGenerateBracket}
              title="Select exactly N teams to generate the bracket"
            >
              {saving ? "Saving..." : "Generate"}
            </button>

            <p className="mt-2 text-xs text-gray-600">
              Selected: {selectedTeamIds.length}/{size}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 p-4">
            <div className="text-sm font-semibold text-gray-900">Seed teams</div>
            {teams.length === 0 ? (
              <p className="mt-2 text-sm text-gray-600">No teams yet.</p>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {teams.map((t) => {
                  const checked = selectedTeamIds.includes(t.id);
                  const disabled = !checked && selectedTeamIds.length >= size;

                  return (
                    <label
                      key={t.id}
                      className={[
                        "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                        checked
                          ? "border-blue-200 bg-blue-50"
                          : "border-gray-200 bg-white",
                        disabled ? "opacity-60" : "",
                      ].join(" ")}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...selectedTeamIds, t.id]
                            : selectedTeamIds.filter((id) => id !== t.id);
                          setSelectedTeamIds(next);
                        }}
                      />
                      <span className="min-w-0 truncate">{t.nameEn}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Current bracket</h2>

        {!bracket ? (
          <p className="mt-2 text-sm text-gray-600">No bracket generated yet.</p>
        ) : (
          <div className="mt-4 space-y-6">
            {bracket.rounds.map((round, roundIndex) => (
              <div key={round.name} className="rounded-xl border border-gray-200 p-4">
                <div className="font-semibold text-gray-900">{round.name}</div>
                <div className="mt-3 space-y-3">
                  {round.matches.map((m, matchIndex) => (
                    <BracketMatchRow
                      key={m.id}
                      match={m}
                      teamById={teamById}
                      disabled={saving}
                      onSave={(score1, score2) =>
                        handleSetMatchResult({ roundIndex, matchIndex, score1, score2 })
                      }
                    />
                  ))}
                </div>
              </div>
            ))}

            <details className="rounded-xl border border-gray-200 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-gray-900">
                Export JSON
              </summary>
              <pre className="mt-3 overflow-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-800">
                {JSON.stringify(bracket, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}

function BracketMatchRow({
  match,
  teamById,
  disabled,
  onSave,
}: {
  match: BracketState["rounds"][number]["matches"][number];
  teamById: Map<string, Team>;
  disabled: boolean;
  onSave: (score1: number, score2: number) => void;
}) {
  const [s1, setS1] = React.useState(match.score1 != null ? String(match.score1) : "");
  const [s2, setS2] = React.useState(match.score2 != null ? String(match.score2) : "");

  React.useEffect(() => {
    setS1(match.score1 != null ? String(match.score1) : "");
    setS2(match.score2 != null ? String(match.score2) : "");
  }, [match.score1, match.score2]);

  const t1 = match.team1Id ? teamById.get(match.team1Id) : null;
  const t2 = match.team2Id ? teamById.get(match.team2Id) : null;

  const canSave = Boolean(match.team1Id && match.team2Id && s1 !== "" && s2 !== "");

  return (
    <div className="grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:grid-cols-[1fr_1fr_220px] items-end">
      <div className="text-sm">
        <div className="font-medium text-gray-900">{t1?.nameEn ?? "TBD"}</div>
        <div className="text-xs text-gray-600">Team 1</div>
      </div>
      <div className="text-sm">
        <div className="font-medium text-gray-900">{t2?.nameEn ?? "TBD"}</div>
        <div className="text-xs text-gray-600">Team 2</div>
      </div>

      <div className="flex items-end gap-2">
        <label className="block w-16">
          <span className="text-xs font-medium text-gray-600">S1</span>
          <input
            className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            type="number"
            min={0}
            value={s1}
            disabled={disabled || match.status === "finished" || !match.team1Id || !match.team2Id}
            onChange={(e) => setS1(e.target.value)}
          />
        </label>
        <label className="block w-16">
          <span className="text-xs font-medium text-gray-600">S2</span>
          <input
            className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            type="number"
            min={0}
            value={s2}
            disabled={disabled || match.status === "finished" || !match.team1Id || !match.team2Id}
            onChange={(e) => setS2(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="ml-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          disabled={disabled || match.status === "finished" || !canSave}
          onClick={() => onSave(Number(s1), Number(s2))}
        >
          Save
        </button>
      </div>
    </div>
  );
}


