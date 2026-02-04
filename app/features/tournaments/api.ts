import { getFirestoreClient, getStorageClient } from "~/firebase/client";
import type {
  BracketState,
  EventBracketState,
  Group,
  Team,
  Tournament,
  TournamentAboutUs,
  TournamentStatus,
  TournamentMatch,
} from "./types";

type Unsubscribe = () => void;

export const DEFAULT_TEAM_LOGO_URL =
  "https://firebasestorage.googleapis.com/v0/b/jkfc-tournment.firebasestorage.app/o/tournaments%2FkB3FwCiGTcGHLY2U93Md%2Fteams%2Fdef%2Fdef-1.svg?alt=media&token=f94c56f9-7ded-40b1-bc48-c5caa6112367";

function mapDoc<T>(docSnap: { id: string; data: () => unknown }): T {
  return { id: docSnap.id, ...(docSnap.data() as object) } as T;
}

export async function subscribeToUserTournaments(
  userId: string,
  onValue: (tournaments: Tournament[]) => void,
  onError?: (err: unknown) => void,
): Promise<Unsubscribe> {
  const firestore = await getFirestoreClient();
  const { collection, onSnapshot, orderBy, query, where } = await import(
    "firebase/firestore"
  );

  const q = query(
    collection(firestore, "tournaments"),
    where("createdBy", "==", userId),
    orderBy("createdAt", "desc"),
  );

  return onSnapshot(
    q,
    (snap) => {
      onValue(snap.docs.map((d) => mapDoc<Tournament>(d)));
    },
    onError,
  );
}

export async function subscribeToTournament(
  tournamentId: string,
  onValue: (tournament: Tournament | null) => void,
  onError?: (err: unknown) => void,
): Promise<Unsubscribe> {
  const firestore = await getFirestoreClient();
  const { doc, onSnapshot } = await import("firebase/firestore");

  return onSnapshot(
    doc(firestore, "tournaments", tournamentId),
    (snap) => {
      onValue(snap.exists() ? mapDoc<Tournament>(snap) : null);
    },
    onError,
  );
}

export async function createTournament(input: {
  userId: string;
  nameEn: string;
  nameAr: string;
  description?: string;
}): Promise<string> {
  const firestore = await getFirestoreClient();
  const { addDoc, collection, serverTimestamp } = await import(
    "firebase/firestore"
  );

  const ref = await addDoc(collection(firestore, "tournaments"), {
    nameEn: input.nameEn,
    nameAr: input.nameAr,
    description: input.description || "",
    youtubeUrl: "",
    youtubeActive: false,
    logoUrl: "",
    logoPath: "",
    status: "draft",
    createdBy: input.userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return ref.id;
}

export async function updateTournament(input: {
  tournamentId: string;
  nameEn: string;
  nameAr: string;
  description?: string;
  youtubeUrl?: string;
  youtubeActive?: boolean;
  status: TournamentStatus;
}): Promise<void> {
  const firestore = await getFirestoreClient();
  const { doc, serverTimestamp, updateDoc } = await import("firebase/firestore");

  const payload: Record<string, unknown> = {
    nameEn: input.nameEn,
    nameAr: input.nameAr,
    description: input.description || "",
    status: input.status,
    updatedAt: serverTimestamp(),
  };

  if (input.youtubeUrl !== undefined) payload.youtubeUrl = input.youtubeUrl || "";
  if (input.youtubeActive !== undefined) payload.youtubeActive = input.youtubeActive;

  await updateDoc(doc(firestore, "tournaments", input.tournamentId), payload);
}

export async function updateTournamentAboutUs(input: {
  tournamentId: string;
  aboutUs: TournamentAboutUs;
}): Promise<void> {
  const firestore = await getFirestoreClient();
  const { doc, serverTimestamp, updateDoc } = await import("firebase/firestore");

  await updateDoc(doc(firestore, "tournaments", input.tournamentId), {
    aboutUs: input.aboutUs,
    updatedAt: serverTimestamp(),
  });
}

export async function uploadTournamentLogo(input: {
  tournamentId: string;
  file: File;
  previousPath?: string | null;
}): Promise<{ logoUrl: string; logoPath: string }> {
  const storage = await getStorageClient();
  const firestore = await getFirestoreClient();

  const { deleteObject, getDownloadURL, ref, uploadBytes } = await import(
    "firebase/storage"
  );
  const { doc, serverTimestamp, updateDoc } = await import("firebase/firestore");

  const ext = getFileExtension(input.file.name);
  const logoPath = `tournaments/${input.tournamentId}/logo${ext ? `.${ext}` : ""}`;
  const storageRef = ref(storage, logoPath);

  await uploadBytes(storageRef, input.file);
  const logoUrl = await getDownloadURL(storageRef);

  await updateDoc(doc(firestore, "tournaments", input.tournamentId), {
    logoUrl,
    logoPath,
    updatedAt: serverTimestamp(),
  });

  // Best-effort cleanup of previous logo file.
  if (input.previousPath && input.previousPath !== logoPath) {
    try {
      await deleteObject(ref(storage, input.previousPath));
    } catch (err) {
      // ignore (missing permission, file already deleted, etc.)
      console.warn("[uploadTournamentLogo] Failed to delete old logo", err);
    }
  }

  return { logoUrl, logoPath };
}

export async function subscribeToTournamentTeams(
  tournamentId: string,
  onValue: (teams: Team[]) => void,
  onError?: (err: unknown) => void,
): Promise<Unsubscribe> {
  const firestore = await getFirestoreClient();
  const { collection, onSnapshot, orderBy, query } = await import(
    "firebase/firestore"
  );

  const q = query(
    collection(firestore, "tournaments", tournamentId, "teams"),
    orderBy("createdAt", "asc"),
  );

  return onSnapshot(
    q,
    (snap) => {
      onValue(snap.docs.map((d) => mapDoc<Team>(d)));
    },
    onError,
  );
}

export async function createTournamentTeam(input: {
  tournamentId: string;
  nameEn: string;
  nameAr: string;
  description?: string;
  logoFile?: File | null;
}): Promise<string> {
  const firestore = await getFirestoreClient();
  const { addDoc, collection, serverTimestamp, updateDoc, doc } = await import(
    "firebase/firestore"
  );

  const teamsCol = collection(firestore, "tournaments", input.tournamentId, "teams");
  const teamRef = await addDoc(teamsCol, {
    nameEn: input.nameEn,
    nameAr: input.nameAr,
    description: input.description || "",
    logoUrl: input.logoFile ? "" : DEFAULT_TEAM_LOGO_URL,
    logoPath: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (input.logoFile) {
    const storage = await getStorageClient();
    const { getDownloadURL, ref, uploadBytes } = await import("firebase/storage");

    const ext = getFileExtension(input.logoFile.name);
    const path = `tournaments/${input.tournamentId}/teams/${teamRef.id}/logo${ext ? `.${ext}` : ""
      }`;

    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, input.logoFile);
    const logoUrl = await getDownloadURL(storageRef);

    await updateDoc(doc(teamsCol, teamRef.id), {
      logoUrl,
      logoPath: path,
      updatedAt: serverTimestamp(),
    });
  }

  return teamRef.id;
}

export async function updateTournamentTeam(input: {
  tournamentId: string;
  teamId: string;
  nameEn: string;
  nameAr: string;
  description?: string;
  logoFile?: File | null;
  previousLogoPath?: string | null;
}): Promise<void> {
  const firestore = await getFirestoreClient();
  const { doc, serverTimestamp, updateDoc } = await import("firebase/firestore");

  const teamDocRef = doc(firestore, "tournaments", input.tournamentId, "teams", input.teamId);

  await updateDoc(teamDocRef, {
    nameEn: input.nameEn,
    nameAr: input.nameAr,
    description: input.description || "",
    updatedAt: serverTimestamp(),
  });

  if (input.logoFile) {
    const storage = await getStorageClient();
    const { deleteObject, getDownloadURL, ref, uploadBytes } = await import(
      "firebase/storage"
    );

    const ext = getFileExtension(input.logoFile.name);
    const logoPath = `tournaments/${input.tournamentId}/teams/${input.teamId}/logo${ext ? `.${ext}` : ""
      }`;
    const storageRef = ref(storage, logoPath);

    await uploadBytes(storageRef, input.logoFile);
    const logoUrl = await getDownloadURL(storageRef);

    await updateDoc(teamDocRef, {
      logoUrl,
      logoPath,
      updatedAt: serverTimestamp(),
    });

    // Best-effort cleanup of previous logo file.
    if (input.previousLogoPath && input.previousLogoPath !== logoPath) {
      try {
        await deleteObject(ref(storage, input.previousLogoPath));
      } catch (err) {
        // ignore (missing permission, file already deleted, etc.)
        console.warn("[updateTournamentTeam] Failed to delete old logo", err);
      }
    }
  }
}

export async function deleteTournamentTeam(input: {
  tournamentId: string;
  teamId: string;
  logoPath?: string | null;
}): Promise<void> {
  const firestore = await getFirestoreClient();
  const { deleteDoc, doc } = await import("firebase/firestore");

  await deleteDoc(doc(firestore, "tournaments", input.tournamentId, "teams", input.teamId));

  // Best-effort cleanup of logo file.
  if (input.logoPath) {
    try {
      const storage = await getStorageClient();
      const { deleteObject, ref } = await import("firebase/storage");
      await deleteObject(ref(storage, input.logoPath));
    } catch (err) {
      // ignore (missing permission, file already deleted, etc.)
      console.warn("[deleteTournamentTeam] Failed to delete logo", err);
    }
  }
}

export async function subscribeToTournamentGroups(
  tournamentId: string,
  onValue: (groups: Group[]) => void,
  onError?: (err: unknown) => void,
): Promise<Unsubscribe> {
  const firestore = await getFirestoreClient();
  const { collection, onSnapshot, orderBy, query } = await import(
    "firebase/firestore"
  );

  const q = query(
    collection(firestore, "tournaments", tournamentId, "groups"),
    orderBy("order", "asc"),
  );

  return onSnapshot(
    q,
    (snap) => {
      onValue(snap.docs.map((d) => mapDoc<Group>(d)));
    },
    onError,
  );
}

export async function createTournamentGroup(input: {
  tournamentId: string;
  name: string;
  order: number;
}): Promise<string> {
  const firestore = await getFirestoreClient();
  const { addDoc, collection, serverTimestamp } = await import(
    "firebase/firestore"
  );

  const ref = await addDoc(
    collection(firestore, "tournaments", input.tournamentId, "groups"),
    {
      name: input.name,
      order: input.order,
      teamIds: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
  );

  return ref.id;
}

export async function updateTournamentGroup(input: {
  tournamentId: string;
  groupId: string;
  name: string;
  order: number;
}): Promise<void> {
  const firestore = await getFirestoreClient();
  const { doc, serverTimestamp, updateDoc } = await import("firebase/firestore");

  await updateDoc(doc(firestore, "tournaments", input.tournamentId, "groups", input.groupId), {
    name: input.name,
    order: input.order,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTournamentGroup(input: {
  tournamentId: string;
  groupId: string;
}): Promise<void> {
  const firestore = await getFirestoreClient();
  const { deleteDoc, doc } = await import("firebase/firestore");

  await deleteDoc(doc(firestore, "tournaments", input.tournamentId, "groups", input.groupId));
}

export async function addTeamToGroup(input: {
  tournamentId: string;
  groupId: string;
  teamId: string;
}): Promise<void> {
  const firestore = await getFirestoreClient();
  const { arrayUnion, doc, serverTimestamp, updateDoc } = await import(
    "firebase/firestore"
  );

  await updateDoc(doc(firestore, "tournaments", input.tournamentId, "groups", input.groupId), {
    teamIds: arrayUnion(input.teamId),
    updatedAt: serverTimestamp(),
  });
}

export async function removeTeamFromGroup(input: {
  tournamentId: string;
  groupId: string;
  teamId: string;
}): Promise<void> {
  const firestore = await getFirestoreClient();
  const { arrayRemove, doc, serverTimestamp, updateDoc } = await import(
    "firebase/firestore"
  );

  await updateDoc(doc(firestore, "tournaments", input.tournamentId, "groups", input.groupId), {
    teamIds: arrayRemove(input.teamId),
    updatedAt: serverTimestamp(),
  });
}

export async function subscribeToTournamentMatches(
  tournamentId: string,
  onValue: (matches: TournamentMatch[]) => void,
  onError?: (err: unknown) => void,
): Promise<Unsubscribe> {
  const firestore = await getFirestoreClient();
  const { collection, onSnapshot, orderBy, query } = await import(
    "firebase/firestore"
  );

  const q = query(
    collection(firestore, "tournaments", tournamentId, "matches"),
    orderBy("createdAt", "desc"),
  );

  return onSnapshot(
    q,
    (snap) => {
      onValue(snap.docs.map((d) => mapDoc<TournamentMatch>(d)));
    },
    onError,
  );
}

export async function createTournamentMatch(input: {
  tournamentId: string;
  groupId?: string | null;
  team1Id: string;
  team2Id: string;
  scheduledAt?: Date | null;
}): Promise<string> {
  const firestore = await getFirestoreClient();
  const { addDoc, collection, serverTimestamp, Timestamp } = await import(
    "firebase/firestore"
  );

  const ref = await addDoc(
    collection(firestore, "tournaments", input.tournamentId, "matches"),
    {
      groupId: input.groupId ?? null,
      team1Id: input.team1Id,
      team2Id: input.team2Id,
      scheduledAt: input.scheduledAt ? Timestamp.fromDate(input.scheduledAt) : null,
      status: "scheduled",
      score1: null,
      score2: null,
      winnerTeamId: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      finishedAt: null,
    },
  );

  return ref.id;
}

export async function updateTournamentMatch(input: {
  tournamentId: string;
  matchId: string;
  groupId?: string | null;
  team1Id: string;
  team2Id: string;
  scheduledAt?: Date | null;
  status?: "scheduled" | "finished";
  score1?: number | null;
  score2?: number | null;
}): Promise<void> {
  const firestore = await getFirestoreClient();
  const { Timestamp, doc, serverTimestamp, updateDoc } = await import(
    "firebase/firestore"
  );

  const winnerTeamId =
    input.status === "finished" &&
      typeof input.score1 === "number" &&
      typeof input.score2 === "number"
      ? input.score1 === input.score2
        ? null
        : input.score1 > input.score2
          ? input.team1Id
          : input.team2Id
      : undefined;

  const payload: Record<string, unknown> = {
    groupId: input.groupId ?? null,
    team1Id: input.team1Id,
    team2Id: input.team2Id,
    scheduledAt: input.scheduledAt ? Timestamp.fromDate(input.scheduledAt) : null,
    updatedAt: serverTimestamp(),
  };

  if (winnerTeamId !== undefined) payload.winnerTeamId = winnerTeamId;

  await updateDoc(
    doc(firestore, "tournaments", input.tournamentId, "matches", input.matchId),
    payload,
  );
}

export async function deleteTournamentMatch(input: {
  tournamentId: string;
  matchId: string;
}): Promise<void> {
  const firestore = await getFirestoreClient();
  const { deleteDoc, doc } = await import("firebase/firestore");

  await deleteDoc(
    doc(firestore, "tournaments", input.tournamentId, "matches", input.matchId),
  );
}

export async function createTournamentMatchesBatch(input: {
  tournamentId: string;
  groupId?: string | null;
  matches: Array<{
    team1Id: string;
    team2Id: string;
    scheduledAt?: Date | null;
  }>;
}): Promise<void> {
  const firestore = await getFirestoreClient();
  const { Timestamp, collection, doc, serverTimestamp, writeBatch } = await import(
    "firebase/firestore"
  );

  const batch = writeBatch(firestore);
  const col = collection(firestore, "tournaments", input.tournamentId, "matches");

  for (const m of input.matches) {
    const ref = doc(col);
    batch.set(ref, {
      groupId: input.groupId ?? null,
      team1Id: m.team1Id,
      team2Id: m.team2Id,
      scheduledAt: m.scheduledAt ? Timestamp.fromDate(m.scheduledAt) : null,
      status: "scheduled",
      score1: null,
      score2: null,
      winnerTeamId: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      finishedAt: null,
    });
  }

  await batch.commit();
}

export async function setTournamentMatchResult(input: {
  tournamentId: string;
  matchId: string;
  team1Id: string;
  team2Id: string;
  score1: number;
  score2: number;
}): Promise<void> {
  const firestore = await getFirestoreClient();
  const { doc, serverTimestamp, updateDoc } = await import("firebase/firestore");

  const winnerTeamId =
    input.score1 === input.score2
      ? null
      : input.score1 > input.score2
        ? input.team1Id
        : input.team2Id;

  await updateDoc(doc(firestore, "tournaments", input.tournamentId, "matches", input.matchId), {
    score1: input.score1,
    score2: input.score2,
    status: "finished",
    finishedAt: serverTimestamp(),
    // For group-stage matches, draws are allowed, so winnerTeamId is optional.
    winnerTeamId,
    updatedAt: serverTimestamp(),
  });
}

export async function subscribeToTournamentBracketState(
  tournamentId: string,
  onValue: (bracket: BracketState | null) => void,
  onError?: (err: unknown) => void,
): Promise<Unsubscribe> {
  const firestore = await getFirestoreClient();
  const { doc, onSnapshot } = await import("firebase/firestore");

  return onSnapshot(
    doc(firestore, "tournaments", tournamentId, "bracket", "state"),
    (snap) => {
      onValue(snap.exists() ? (snap.data() as BracketState) : null);
    },
    onError,
  );
}

export async function saveTournamentBracketState(input: {
  tournamentId: string;
  bracket: BracketState;
}): Promise<void> {
  const firestore = await getFirestoreClient();
  const { doc, serverTimestamp, setDoc } = await import("firebase/firestore");

  await setDoc(
    doc(firestore, "tournaments", input.tournamentId, "bracket", "state"),
    {
      ...input.bracket,
      updatedAt: serverTimestamp(),
      createdAt: input.bracket.createdAt ?? serverTimestamp(),
    },
    { merge: true },
  );
}

export async function subscribeToEventBracketState(
  tournamentId: string,
  onValue: (bracket: EventBracketState | null) => void,
  onError?: (err: unknown) => void,
): Promise<Unsubscribe> {
  const firestore = await getFirestoreClient();
  const { doc, onSnapshot } = await import("firebase/firestore");

  return onSnapshot(
    doc(firestore, "tournaments", tournamentId, "eventBracket", "state"),
    (snap) => {
      onValue(snap.exists() ? (snap.data() as EventBracketState) : null);
    },
    onError,
  );
}

export async function saveEventBracketState(input: {
  tournamentId: string;
  bracket: EventBracketState;
}): Promise<void> {
  const firestore = await getFirestoreClient();
  const { doc, serverTimestamp, setDoc } = await import("firebase/firestore");

  await setDoc(
    doc(firestore, "tournaments", input.tournamentId, "eventBracket", "state"),
    {
      ...input.bracket,
      updatedAt: serverTimestamp(),
      createdAt: input.bracket.createdAt ?? serverTimestamp(),
    },
    { merge: true },
  );
}

function getFileExtension(filename: string): string | null {
  const idx = filename.lastIndexOf(".");
  if (idx === -1) return null;
  const ext = filename.slice(idx + 1).trim().toLowerCase();
  return ext || null;
}


