import * as React from "react";
import { useCallback, useEffect, useState, useRef } from "react";

import type { Route } from "./+types/tournaments.$tournamentId.event";
import {
  saveEventBracketState,
  subscribeToEventBracketState,
  subscribeToTournamentGroups,
  subscribeToTournamentTeams,
} from "~/features/tournaments/api";
import { useTournamentManager } from "~/features/tournaments/context";
import type {
  EventBracketMatch,
  EventBracketState,
  Group,
  Team,
} from "~/features/tournaments/types";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Event | JKFC Admin" }];
}

// ============================================
// TYPES
// ============================================

type ContextMenuState = {
  x: number;
  y: number;
  type: "match" | "winner" | "group";
  matchId?: string;
  winnerId?: string;
  side?: "left" | "right";
  round?: "round1" | "semi" | "third" | "final";
} | null;

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateInitialBracket(): EventBracketState {
  const createMatch = (id: string): EventBracketMatch => ({
    id,
    team1Id: null,
    team2Id: null,
    score1: null,
    score2: null,
    winnerId: null,
    status: "pending",
  });

  return {
    leftSide: {
      groupId: null,
      round1Matches: Array.from({ length: 6 }, (_, i) => createMatch(`L1-${i}`)),
      winnerSlots: Array.from({ length: 2 }, (_, i) => ({ id: `LW-${i}`, teamId: null })),
    },
    rightSide: {
      groupId: null,
      round1Matches: Array.from({ length: 6 }, (_, i) => createMatch(`R1-${i}`)),
      winnerSlots: Array.from({ length: 2 }, (_, i) => ({ id: `RW-${i}`, teamId: null })),
    },
    semiFinals: [createMatch("SF-0"), createMatch("SF-1")],
    thirdPlace: createMatch("3RD"),
    final: createMatch("FINAL"),
  };
}

// ============================================
// CONTEXT MENU COMPONENT
// ============================================

type ContextMenuProps = {
  state: ContextMenuState;
  teams: Team[];
  groups: Group[];
  bracket: EventBracketState;
  onClose: () => void;
  onAssignTeam: (matchId: string, slot: 1 | 2, teamId: string | null, round: string, side?: "left" | "right") => void;
  onSetScore: (matchId: string, round: string, side?: "left" | "right") => void;
  onSetGroup: (side: "left" | "right", groupId: string | null) => void;
  onSetWinner: (winnerId: string, side: "left" | "right", teamId: string | null) => void;
  onClearMatch: (matchId: string, round: string, side?: "left" | "right") => void;
};

function ContextMenu({
  state,
  teams,
  groups,
  bracket,
  onClose,
  onAssignTeam,
  onSetScore,
  onSetGroup,
  onSetWinner,
  onClearMatch,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [openSubmenu, setOpenSubmenu] = useState<"team1" | "team2" | null>(null);

  useEffect(() => {
    if (!state) {
      setOpenSubmenu(null);
      return;
    }
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (openSubmenu) {
          setOpenSubmenu(null);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [state, onClose, openSubmenu]);

  // Reset submenu when context menu closes
  useEffect(() => {
    if (!state) setOpenSubmenu(null);
  }, [state]);

  if (!state) return null;

  const { x, y, type, matchId, winnerId, side, round } = state;

  // Get available teams based on side's group
  const getAvailableTeams = () => {
    if (!side) return teams;
    const sideData = side === "left" ? bracket.leftSide : bracket.rightSide;
    if (!sideData.groupId) return teams;
    const group = groups.find((g) => g.id === sideData.groupId);
    if (!group) return teams;
    return teams.filter((t) => group.teamIds.includes(t.id));
  };

  const availableTeams = getAvailableTeams();

  // Get the match data
  const getMatch = (): EventBracketMatch | null => {
    if (!matchId) return null;
    if (round === "round1" && side) {
      const sideData = side === "left" ? bracket.leftSide : bracket.rightSide;
      return sideData.round1Matches.find((m) => m.id === matchId) ?? null;
    }
    if (round === "semi") {
      return bracket.semiFinals.find((m) => m.id === matchId) ?? null;
    }
    if (round === "third") {
      return bracket.thirdPlace;
    }
    if (round === "final") {
      return bracket.final;
    }
    return null;
  };

  const match = getMatch();

  // Calculate menu position to keep it on screen
  const menuStyle: React.CSSProperties = {
    left: Math.min(x, window.innerWidth - 220),
    top: Math.min(y, window.innerHeight - 300),
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] min-w-[200px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
      style={menuStyle}
    >
      {type === "group" && side && (
        <>
          <div className="px-3 py-2 text-xs font-semibold uppercase text-gray-500">
            Set {side === "left" ? "Left" : "Right"} Side Group
          </div>
          <button
            className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
            onClick={() => {
              onSetGroup(side, null);
              onClose();
            }}
          >
            No Group (All Teams)
          </button>
          {groups.map((group) => (
            <button
              key={group.id}
              className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
              onClick={() => {
                onSetGroup(side, group.id);
                onClose();
              }}
            >
              {group.name}
            </button>
          ))}
        </>
      )}

      {type === "match" && matchId && round && (
        <>
          <div className="px-3 py-2 text-xs font-semibold uppercase text-gray-500">
            Match Actions
          </div>

          {/* Assign Team 1 - Click to toggle submenu */}
          <div className="relative">
            <button
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-100 ${
                openSubmenu === "team1" ? "bg-blue-50 text-blue-700" : "text-gray-700"
              }`}
              onClick={() => setOpenSubmenu(openSubmenu === "team1" ? null : "team1")}
            >
              <span>Assign Team 1</span>
              <svg className={`h-4 w-4 transition-transform ${openSubmenu === "team1" ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            {openSubmenu === "team1" && (
              <div className="absolute left-full top-0 z-10 ml-1 max-h-[300px] min-w-[180px] overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <button
                  className="w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-100"
                  onClick={() => {
                    onAssignTeam(matchId, 1, null, round, side);
                    onClose();
                  }}
                >
                  TBD (Clear)
                </button>
                {availableTeams.map((team) => (
                  <button
                    key={team.id}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 ${
                      match?.team1Id === team.id ? "bg-blue-50 text-blue-700" : "text-gray-700"
                    }`}
                    onClick={() => {
                      onAssignTeam(matchId, 1, team.id, round, side);
                      onClose();
                    }}
                  >
                    {team.nameEn}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Assign Team 2 - Click to toggle submenu */}
          <div className="relative">
            <button
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-100 ${
                openSubmenu === "team2" ? "bg-blue-50 text-blue-700" : "text-gray-700"
              }`}
              onClick={() => setOpenSubmenu(openSubmenu === "team2" ? null : "team2")}
            >
              <span>Assign Team 2</span>
              <svg className={`h-4 w-4 transition-transform ${openSubmenu === "team2" ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            {openSubmenu === "team2" && (
              <div className="absolute left-full top-0 z-10 ml-1 max-h-[300px] min-w-[180px] overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <button
                  className="w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-100"
                  onClick={() => {
                    onAssignTeam(matchId, 2, null, round, side);
                    onClose();
                  }}
                >
                  TBD (Clear)
                </button>
                {availableTeams.map((team) => (
                  <button
                    key={team.id}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 ${
                      match?.team2Id === team.id ? "bg-blue-50 text-blue-700" : "text-gray-700"
                    }`}
                    onClick={() => {
                      onAssignTeam(matchId, 2, team.id, round, side);
                      onClose();
                    }}
                  >
                    {team.nameEn}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="my-1 border-t border-gray-100" />

          <button
            className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
            onClick={() => {
              onSetScore(matchId, round, side);
              onClose();
            }}
          >
            Set Score
          </button>

          <button
            className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            onClick={() => {
              onClearMatch(matchId, round, side);
              onClose();
            }}
          >
            Clear Match
          </button>
        </>
      )}

      {type === "winner" && winnerId && side && (
        <>
          <div className="px-3 py-2 text-xs font-semibold uppercase text-gray-500">
            Set Winner Slot
          </div>
          <button
            className="w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-100"
            onClick={() => {
              onSetWinner(winnerId, side, null);
              onClose();
            }}
          >
            TBD (Clear)
          </button>
          {availableTeams.map((team) => (
            <button
              key={team.id}
              className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
              onClick={() => {
                onSetWinner(winnerId, side, team.id);
                onClose();
              }}
            >
              {team.nameEn}
            </button>
          ))}
        </>
      )}
    </div>
  );
}

// ============================================
// MODAL COMPONENTS
// ============================================

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

function Modal({ open, title, onClose, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="Close modal"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="text-lg font-semibold text-gray-900">{title}</div>
          <button
            type="button"
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            onClick={onClose}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

// ============================================
// BRACKET COMPONENTS
// ============================================

type MatchCardProps = {
  match: EventBracketMatch;
  teams: Team[];
  size?: "sm" | "md" | "lg";
  highlight?: boolean;
  variant?: "default" | "semi" | "final";
  onContextMenu: (e: React.MouseEvent) => void;
};

function MatchCard({ match, teams, size = "sm", highlight = false, variant = "default", onContextMenu }: MatchCardProps) {
  const team1 = match.team1Id ? teams.find((t) => t.id === match.team1Id) : null;
  const team2 = match.team2Id ? teams.find((t) => t.id === match.team2Id) : null;

  const sizeClasses = {
    sm: "py-2",
    md: "py-2.5",
    lg: "py-3",
  };

  const getTeamLogo = (team: Team | null) => {
    if (!team) return "?";
    if (team.logoUrl) {
      return <img src={team.logoUrl} alt="" className="h-5 w-5 rounded object-cover" />;
    }
    return "⚽";
  };

  const variantClasses = {
    default: "bg-white border-gray-200 hover:border-amber-300",
    semi: "bg-gradient-to-br from-emerald-50 to-cyan-50 border-emerald-200 hover:border-emerald-400",
    final: "bg-gradient-to-br from-amber-50 to-orange-50 border-amber-300 hover:border-amber-500 shadow-md",
  };

  return (
    <div
      className={`min-w-[140px] cursor-context-menu overflow-hidden rounded-xl border transition-all ${variantClasses[highlight ? "final" : variant]}`}
      onContextMenu={onContextMenu}
    >
      <div className={`flex items-center gap-2 px-3 ${sizeClasses[size]} hover:bg-gray-50`}>
        <span className="flex h-6 w-6 items-center justify-center rounded bg-gray-100 text-xs">
          {getTeamLogo(team1)}
        </span>
        <span className="flex-1 truncate text-sm font-medium text-gray-900">
          {team1?.nameEn ?? "TBD"}
        </span>
        <span className="min-w-[24px] text-center text-sm font-bold text-amber-600">
          {match.score1 ?? "-"}
        </span>
      </div>
      <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
      <div className={`flex items-center gap-2 px-3 ${sizeClasses[size]} hover:bg-gray-50`}>
        <span className="flex h-6 w-6 items-center justify-center rounded bg-gray-100 text-xs">
          {getTeamLogo(team2)}
        </span>
        <span className="flex-1 truncate text-sm font-medium text-gray-900">
          {team2?.nameEn ?? "TBD"}
        </span>
        <span className="min-w-[24px] text-center text-sm font-bold text-amber-600">
          {match.score2 ?? "-"}
        </span>
      </div>
    </div>
  );
}

type WinnerCardProps = {
  teamId: string | null;
  teams: Team[];
  onContextMenu: (e: React.MouseEvent) => void;
};

function WinnerCard({ teamId, teams, onContextMenu }: WinnerCardProps) {
  const team = teamId ? teams.find((t) => t.id === teamId) : null;

  return (
    <div
      className="flex min-w-[120px] cursor-context-menu items-center justify-center rounded-lg border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 px-4 py-3 transition-all hover:border-emerald-400"
      onContextMenu={onContextMenu}
    >
      <span className="text-sm font-semibold text-emerald-700">
        {team?.nameEn ?? "Winner"}
      </span>
    </div>
  );
}

type GroupSelectorProps = {
  side: "left" | "right";
  groupId: string | null;
  groups: Group[];
  onContextMenu: (e: React.MouseEvent) => void;
};

function GroupSelector({ side, groupId, groups, onContextMenu }: GroupSelectorProps) {
  const group = groupId ? groups.find((g) => g.id === groupId) : null;

  return (
    <button
      className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-600 transition-all hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
      onContextMenu={onContextMenu}
      onClick={onContextMenu}
    >
      {group ? group.name : `Set ${side === "left" ? "Left" : "Right"} Group`}
    </button>
  );
}

// ============================================
// MAIN BRACKET TREE
// ============================================

type BracketTreeProps = {
  bracket: EventBracketState;
  teams: Team[];
  groups: Group[];
  onMatchContext: (e: React.MouseEvent, matchId: string, round: string, side?: "left" | "right") => void;
  onWinnerContext: (e: React.MouseEvent, winnerId: string, side: "left" | "right") => void;
  onGroupContext: (e: React.MouseEvent, side: "left" | "right") => void;
};

function BracketTree({ bracket, teams, groups, onMatchContext, onWinnerContext, onGroupContext }: BracketTreeProps) {
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex min-w-[1100px] items-center justify-center gap-6 px-4 py-8">
        {/* LEFT SIDE */}
        <div className="flex items-center gap-6">
          {/* Round 1 - Left */}
          <div className="flex flex-col gap-3">
            <div className="mb-2 text-center">
              <GroupSelector
                side="left"
                groupId={bracket.leftSide.groupId}
                groups={groups}
                onContextMenu={(e) => onGroupContext(e, "left")}
              />
            </div>
            {bracket.leftSide.round1Matches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                teams={teams}
                size="sm"
                onContextMenu={(e) => onMatchContext(e, match.id, "round1", "left")}
              />
            ))}
          </div>

          {/* Winner Slots - Left */}
          <div className="flex flex-col justify-around gap-8 py-8">
            {bracket.leftSide.winnerSlots.map((slot) => (
              <WinnerCard
                key={slot.id}
                teamId={slot.teamId}
                teams={teams}
                onContextMenu={(e) => onWinnerContext(e, slot.id, "left")}
              />
            ))}
          </div>
        </div>

        {/* CENTER - Semi Finals + Finals */}
        <div className="flex flex-col items-center gap-6 px-4">
          {/* Semi Final 1 */}
          <div className="text-center">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Semi Final
            </div>
            <MatchCard
              match={bracket.semiFinals[0]}
              teams={teams}
              size="md"
              variant="semi"
              onContextMenu={(e) => onMatchContext(e, bracket.semiFinals[0].id, "semi")}
            />
          </div>

          {/* Finals Row */}
          <div className="flex items-start gap-6">
            {/* Grand Final */}
            <div className="text-center">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-600">
                🏆 Grand Final
              </div>
              <MatchCard
                match={bracket.final}
                teams={teams}
                size="lg"
                highlight
                variant="final"
                onContextMenu={(e) => onMatchContext(e, bracket.final.id, "final")}
              />
            </div>

            {/* 3rd Place */}
            <div className="text-center">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-violet-500">
                3rd Place
              </div>
              <MatchCard
                match={bracket.thirdPlace}
                teams={teams}
                size="md"
                onContextMenu={(e) => onMatchContext(e, bracket.thirdPlace.id, "third")}
              />
            </div>
          </div>

          {/* Semi Final 2 */}
          <div className="text-center">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Semi Final
            </div>
            <MatchCard
              match={bracket.semiFinals[1]}
              teams={teams}
              size="md"
              variant="semi"
              onContextMenu={(e) => onMatchContext(e, bracket.semiFinals[1].id, "semi")}
            />
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="flex items-center gap-6">
          {/* Winner Slots - Right */}
          <div className="flex flex-col justify-around gap-8 py-8">
            {bracket.rightSide.winnerSlots.map((slot) => (
              <WinnerCard
                key={slot.id}
                teamId={slot.teamId}
                teams={teams}
                onContextMenu={(e) => onWinnerContext(e, slot.id, "right")}
              />
            ))}
          </div>

          {/* Round 1 - Right */}
          <div className="flex flex-col gap-3">
            <div className="mb-2 text-center">
              <GroupSelector
                side="right"
                groupId={bracket.rightSide.groupId}
                groups={groups}
                onContextMenu={(e) => onGroupContext(e, "right")}
              />
            </div>
            {bracket.rightSide.round1Matches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                teams={teams}
                size="sm"
                onContextMenu={(e) => onMatchContext(e, match.id, "round1", "right")}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function TournamentEvent() {
  const { tournamentId, tournament } = useTournamentManager();

  // Data state
  const [teams, setTeams] = useState<Team[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [bracket, setBracket] = useState<EventBracketState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // UI state
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [scoreModal, setScoreModal] = useState<{
    matchId: string;
    round: string;
    side?: "left" | "right";
  } | null>(null);
  const [score1, setScore1] = useState("");
  const [score2, setScore2] = useState("");

  // Load data
  useEffect(() => {
    let mounted = true;
    let unsubTeams: (() => void) | undefined;
    let unsubGroups: (() => void) | undefined;
    let unsubBracket: (() => void) | undefined;

    const loaded = { teams: false, groups: false, bracket: false };
    const checkLoaded = () => {
      if (loaded.teams && loaded.groups && loaded.bracket && mounted) {
        setLoading(false);
      }
    };

    void (async () => {
      try {
        unsubTeams = await subscribeToTournamentTeams(
          tournamentId,
          (items) => {
            if (!mounted) return;
            setTeams(items);
            loaded.teams = true;
            checkLoaded();
          },
          () => {
            loaded.teams = true;
            checkLoaded();
          }
        );

        unsubGroups = await subscribeToTournamentGroups(
          tournamentId,
          (items) => {
            if (!mounted) return;
            setGroups(items);
            loaded.groups = true;
            checkLoaded();
          },
          () => {
            loaded.groups = true;
            checkLoaded();
          }
        );

        unsubBracket = await subscribeToEventBracketState(
          tournamentId,
          (state) => {
            if (!mounted) return;
            setBracket(state ?? generateInitialBracket());
            loaded.bracket = true;
            checkLoaded();
          },
          () => {
            if (!mounted) return;
            setBracket(generateInitialBracket());
            loaded.bracket = true;
            checkLoaded();
          }
        );
      } catch (err) {
        console.error("[Event] Failed to load data", err);
        if (mounted) {
          setBracket(generateInitialBracket());
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
      unsubTeams?.();
      unsubGroups?.();
      unsubBracket?.();
    };
  }, [tournamentId]);

  // Save bracket helper
  const saveBracket = useCallback(
    async (newBracket: EventBracketState) => {
      setSaving(true);
      try {
        await saveEventBracketState({ tournamentId, bracket: newBracket });
      } catch (err) {
        console.error("[Event] Failed to save bracket", err);
      } finally {
        setSaving(false);
      }
    },
    [tournamentId]
  );

  // Context menu handlers
  const handleMatchContext = useCallback(
    (e: React.MouseEvent, matchId: string, round: string, side?: "left" | "right") => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, type: "match", matchId, round, side });
    },
    []
  );

  const handleWinnerContext = useCallback(
    (e: React.MouseEvent, winnerId: string, side: "left" | "right") => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, type: "winner", winnerId, side });
    },
    []
  );

  const handleGroupContext = useCallback(
    (e: React.MouseEvent, side: "left" | "right") => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, type: "group", side });
    },
    []
  );

  // Action handlers
  const handleAssignTeam = useCallback(
    (matchId: string, slot: 1 | 2, teamId: string | null, round: string, side?: "left" | "right") => {
      if (!bracket) return;

      const newBracket = { ...bracket };
      const updateMatch = (match: EventBracketMatch) => {
        if (slot === 1) {
          match.team1Id = teamId;
        } else {
          match.team2Id = teamId;
        }
      };

      if (round === "round1" && side) {
        const sideData = side === "left" ? newBracket.leftSide : newBracket.rightSide;
        const match = sideData.round1Matches.find((m) => m.id === matchId);
        if (match) updateMatch(match);
      } else if (round === "semi") {
        const match = newBracket.semiFinals.find((m) => m.id === matchId);
        if (match) updateMatch(match);
      } else if (round === "third") {
        updateMatch(newBracket.thirdPlace);
      } else if (round === "final") {
        updateMatch(newBracket.final);
      }

      setBracket(newBracket);
      void saveBracket(newBracket);
    },
    [bracket, saveBracket]
  );

  const handleSetGroup = useCallback(
    (side: "left" | "right", groupId: string | null) => {
      if (!bracket) return;

      const newBracket = { ...bracket };
      if (side === "left") {
        newBracket.leftSide = { ...newBracket.leftSide, groupId };
      } else {
        newBracket.rightSide = { ...newBracket.rightSide, groupId };
      }

      setBracket(newBracket);
      void saveBracket(newBracket);
    },
    [bracket, saveBracket]
  );

  const handleSetWinner = useCallback(
    (winnerId: string, side: "left" | "right", teamId: string | null) => {
      if (!bracket) return;

      const newBracket = { ...bracket };
      const sideData = side === "left" ? newBracket.leftSide : newBracket.rightSide;
      const slot = sideData.winnerSlots.find((s) => s.id === winnerId);
      if (slot) {
        slot.teamId = teamId;
      }

      setBracket(newBracket);
      void saveBracket(newBracket);
    },
    [bracket, saveBracket]
  );

  const handleClearMatch = useCallback(
    (matchId: string, round: string, side?: "left" | "right") => {
      if (!bracket) return;

      const newBracket = { ...bracket };
      const clearMatch = (match: EventBracketMatch) => {
        match.team1Id = null;
        match.team2Id = null;
        match.score1 = null;
        match.score2 = null;
        match.winnerId = null;
        match.status = "pending";
      };

      if (round === "round1" && side) {
        const sideData = side === "left" ? newBracket.leftSide : newBracket.rightSide;
        const match = sideData.round1Matches.find((m) => m.id === matchId);
        if (match) clearMatch(match);
      } else if (round === "semi") {
        const match = newBracket.semiFinals.find((m) => m.id === matchId);
        if (match) clearMatch(match);
      } else if (round === "third") {
        clearMatch(newBracket.thirdPlace);
      } else if (round === "final") {
        clearMatch(newBracket.final);
      }

      setBracket(newBracket);
      void saveBracket(newBracket);
    },
    [bracket, saveBracket]
  );

  const handleOpenScoreModal = useCallback(
    (matchId: string, round: string, side?: "left" | "right") => {
      if (!bracket) return;

      let match: EventBracketMatch | null = null;

      if (round === "round1" && side) {
        const sideData = side === "left" ? bracket.leftSide : bracket.rightSide;
        match = sideData.round1Matches.find((m) => m.id === matchId) ?? null;
      } else if (round === "semi") {
        match = bracket.semiFinals.find((m) => m.id === matchId) ?? null;
      } else if (round === "third") {
        match = bracket.thirdPlace;
      } else if (round === "final") {
        match = bracket.final;
      }

      setScore1(match?.score1?.toString() ?? "");
      setScore2(match?.score2?.toString() ?? "");
      setScoreModal({ matchId, round, side });
    },
    [bracket]
  );

  const handleSaveScore = useCallback(() => {
    if (!bracket || !scoreModal) return;

    const newBracket = { ...bracket };
    const s1 = score1 === "" ? null : parseInt(score1, 10);
    const s2 = score2 === "" ? null : parseInt(score2, 10);

    const updateScore = (match: EventBracketMatch) => {
      match.score1 = isNaN(s1 as number) ? null : s1;
      match.score2 = isNaN(s2 as number) ? null : s2;
      if (s1 !== null && s2 !== null && !isNaN(s1) && !isNaN(s2)) {
        match.status = "finished";
        match.winnerId = s1 > s2 ? match.team1Id : s2 > s1 ? match.team2Id : null;
      }
    };

    const { matchId, round, side } = scoreModal;

    if (round === "round1" && side) {
      const sideData = side === "left" ? newBracket.leftSide : newBracket.rightSide;
      const match = sideData.round1Matches.find((m) => m.id === matchId);
      if (match) updateScore(match);
    } else if (round === "semi") {
      const match = newBracket.semiFinals.find((m) => m.id === matchId);
      if (match) updateScore(match);
    } else if (round === "third") {
      updateScore(newBracket.thirdPlace);
    } else if (round === "final") {
      updateScore(newBracket.final);
    }

    setBracket(newBracket);
    void saveBracket(newBracket);
    setScoreModal(null);
  }, [bracket, scoreModal, score1, score2, saveBracket]);

  const handleResetBracket = useCallback(() => {
    if (!confirm("Are you sure you want to reset the entire bracket? This cannot be undone.")) {
      return;
    }
    const newBracket = generateInitialBracket();
    setBracket(newBracket);
    void saveBracket(newBracket);
  }, [saveBracket]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-gray-500">Loading event bracket...</div>
      </div>
    );
  }

  if (!bracket) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <p className="text-gray-700">Failed to load bracket data.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Event Bracket</h1>
            <p className="mt-1 text-sm text-gray-600">
              Right-click on matches, winner slots, or group buttons to manage the bracket.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {saving && (
              <span className="text-sm text-gray-500">Saving...</span>
            )}
            <button
              type="button"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
              onClick={handleResetBracket}
            >
              Reset Bracket
            </button>
          </div>
        </div>
      </div>

      {/* Bracket */}
      <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-slate-100 p-6">
        <div className="mb-6 text-center">
          <div className="text-4xl">🏆</div>
          <h2 className="mt-2 text-2xl font-bold tracking-wide text-gray-900">
            {tournament.nameEn}
          </h2>
          <p className="mt-1 text-sm text-gray-500">Tournament Bracket</p>
        </div>

        <BracketTree
          bracket={bracket}
          teams={teams}
          groups={groups}
          onMatchContext={handleMatchContext}
          onWinnerContext={handleWinnerContext}
          onGroupContext={handleGroupContext}
        />
      </div>

      {/* Instructions */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-900">How to use</h3>
        <ul className="mt-3 space-y-2 text-sm text-gray-600">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-blue-500" />
            <span><strong>Set Groups:</strong> Click or right-click the group buttons above each side to assign a group. Teams from that group will be available for matches.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span><strong>Assign Teams:</strong> Right-click on any match card to assign Team 1 or Team 2 from the available teams.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span><strong>Set Scores:</strong> Right-click on a match and select "Set Score" to enter the final score.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-violet-500" />
            <span><strong>Winner Slots:</strong> Right-click on winner slots to manually set which teams advance.</span>
          </li>
        </ul>
      </div>

      {/* Context Menu */}
      <ContextMenu
        state={contextMenu}
        teams={teams}
        groups={groups}
        bracket={bracket}
        onClose={() => setContextMenu(null)}
        onAssignTeam={handleAssignTeam}
        onSetScore={handleOpenScoreModal}
        onSetGroup={handleSetGroup}
        onSetWinner={handleSetWinner}
        onClearMatch={handleClearMatch}
      />

      {/* Score Modal */}
      <Modal
        open={!!scoreModal}
        title="Set Match Score"
        onClose={() => setScoreModal(null)}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Team 1 Score</label>
              <input
                type="number"
                min="0"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={score1}
                onChange={(e) => setScore1(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Team 2 Score</label>
              <input
                type="number"
                min="0"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={score2}
                onChange={(e) => setScore2(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              onClick={() => setScoreModal(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              onClick={handleSaveScore}
            >
              Save Score
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
