import React, { useMemo, useState } from "react";
import big5Snapshot from "./data/big5-latest.json";

type Position = "GK" | "DF" | "MF" | "FW";
type RegistrationStatus = "registered" | "not_registered";
type Category = "U23" | "Club" | "Italy" | "Non-HG" | "Review";
type ActiveTab = "sheet" | "lineup";

type Player = {
  id: string;
  name: string;
  dateOfBirth: string;
  position: Position;
  nationality: string;
  isClubTrained: boolean;
  isItalyTrained: boolean;
  isNonEuOrEea: boolean;
  fromAbroadThisWindow: boolean;
  status: RegistrationStatus;
  sourceClub: string;
  needsReview?: boolean;
};

type CatalogPlayer = {
  catalogId: string;
  name: string;
  dateOfBirth: string;
  position: Position;
  nationality: string;
  nationalityCode?: string;
  currentClub: string;
  currentLeague: "Serie A" | "Premier League" | "LaLiga" | "Bundesliga" | "Ligue 1";
  sourceClub?: string;
  sourceLeague?: string;
  isClubTrained?: boolean;
  isItalyTrained?: boolean;
  isNonEuOrEea?: boolean;
  fromAbroadThisWindow?: boolean;
  needsEligibilityReview?: boolean;
  needsDobReview?: boolean;
};

type Big5Snapshot = {
  players: CatalogPlayer[];
  report?: {
    importedAt?: string;
    playerCount?: number;
    teamCount?: number;
    serieAPlayerCount?: number;
    warnings?: string[];
  };
};

type Club = {
  slug: string;
  name: string;
  shortName: string;
  city: string;
  players: Player[];
};

type LineupPlacement = {
  x: number;
  y: number;
};

type ValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  counts: {
    registered: number;
    senior: number;
    u23: number;
    nonHomegrown: number;
    clubTrained: number;
    italyTrained: number;
    nonEuArrivals: number;
    review: number;
    incompleteRegistered: number;
  };
};

const SEASON_START_YEAR = 2026;
const DATA_SNAPSHOT = big5Snapshot as Big5Snapshot;

const CLUB_META = [
  ["atalanta", "Atalanta", "ATA", "Bergamo"],
  ["bologna", "Bologna", "BOL", "Bologna"],
  ["cagliari", "Cagliari", "CAG", "Cagliari"],
  ["como", "Como", "COM", "Como"],
  ["cremonese", "Cremonese", "CRE", "Cremona"],
  ["fiorentina", "Fiorentina", "FIO", "Firenze"],
  ["genoa", "Genoa", "GEN", "Genova"],
  ["hellas-verona", "Hellas Verona", "VER", "Verona"],
  ["inter", "Inter", "INT", "Milano"],
  ["juventus", "Juventus", "JUV", "Torino"],
  ["lazio", "Lazio", "LAZ", "Roma"],
  ["lecce", "Lecce", "LEC", "Lecce"],
  ["milan", "Milan", "MIL", "Milano"],
  ["napoli", "Napoli", "NAP", "Napoli"],
  ["parma", "Parma", "PAR", "Parma"],
  ["pisa", "Pisa", "PIS", "Pisa"],
  ["roma", "Roma", "ROM", "Roma"],
  ["sassuolo", "Sassuolo", "SAS", "Reggio Emilia"],
  ["torino", "Torino", "TOR", "Torino"],
  ["udinese", "Udinese", "UDI", "Udine"],
] as const;

function base(
  name: string,
  dateOfBirth: string,
  position: Position,
  nationality: string,
  isClubTrained: boolean,
  isItalyTrained: boolean,
  isNonEuOrEea: boolean
): Omit<Player, "id" | "status" | "sourceClub"> {
  return {
    name,
    dateOfBirth,
    position,
    nationality,
    isClubTrained,
    isItalyTrained,
    isNonEuOrEea,
    fromAbroadThisWindow: false,
    needsReview: false,
  };
}

function makePlayer(
  name: string,
  dateOfBirth: string,
  position: Position,
  nationality: string,
  isClubTrained: boolean,
  isItalyTrained: boolean,
  isNonEuOrEea: boolean,
  fromAbroadThisWindow = false,
  sourceClub = "Current squad"
): Player {
  return {
    id: `${sourceClub}-${name}-${dateOfBirth}`.toLowerCase().replace(/[^a-z0-9]+/g, "-") || `player-${Date.now()}`,
    name,
    dateOfBirth,
    position,
    nationality,
    isClubTrained,
    isItalyTrained,
    isNonEuOrEea,
    fromAbroadThisWindow,
    status: "registered",
    sourceClub,
    needsReview: fromAbroadThisWindow,
  };
}

function isItalianNationality(nationality?: string, nationalityCode?: string) {
  const values = [nationality, nationalityCode].filter(Boolean).map((value) => String(value).trim().toUpperCase());
  return values.includes("ITA") || values.includes("ITALY") || values.includes("ITALIA");
}

const FEATURED_PLAYERS: Record<string, Array<Omit<Player, "id" | "status" | "sourceClub">>> = {
  inter: [
    base("Yann Sommer", "1988-12-17", "GK", "Switzerland", false, false, false),
    base("Alessandro Bastoni", "1999-04-13", "DF", "Italy", false, true, false),
    base("Federico Dimarco", "1997-11-10", "DF", "Italy", true, true, false),
    base("Nicolo Barella", "1997-02-07", "MF", "Italy", false, true, false),
    base("Hakan Calhanoglu", "1994-02-08", "MF", "Turkey", false, false, false),
    base("Lautaro Martinez", "1997-08-22", "FW", "Argentina", false, false, true),
    base("Marcus Thuram", "1997-08-06", "FW", "France", false, false, false),
    base("Francesco Pio Esposito", "2005-06-28", "FW", "Italy", true, true, false),
  ],
  juventus: [
    base("Michele Di Gregorio", "1997-07-27", "GK", "Italy", false, true, false),
    base("Federico Gatti", "1998-06-24", "DF", "Italy", false, true, false),
    base("Bremer", "1997-03-18", "DF", "Brazil", false, false, true),
    base("Andrea Cambiaso", "2000-02-20", "DF", "Italy", false, true, false),
    base("Manuel Locatelli", "1998-01-08", "MF", "Italy", false, true, false),
    base("Kenan Yildiz", "2005-05-04", "FW", "Turkey", true, true, false),
    base("Dusan Vlahovic", "2000-01-28", "FW", "Serbia", false, false, true),
  ],
  milan: [
    base("Mike Maignan", "1995-07-03", "GK", "France", false, false, false),
    base("Matteo Gabbia", "1999-10-21", "DF", "Italy", true, true, false),
    base("Davide Calabria", "1996-12-06", "DF", "Italy", true, true, false),
    base("Theo Hernandez", "1997-10-06", "DF", "France", false, false, false),
    base("Yunus Musah", "2002-11-29", "MF", "United States", false, false, true),
    base("Rafael Leao", "1999-06-10", "FW", "Portugal", false, false, false),
    base("Francesco Camarda", "2008-03-10", "FW", "Italy", true, true, false),
  ],
  napoli: [
    base("Alex Meret", "1997-03-22", "GK", "Italy", false, true, false),
    base("Giovanni Di Lorenzo", "1993-08-04", "DF", "Italy", false, true, false),
    base("Amir Rrahmani", "1994-02-24", "DF", "Kosovo", false, false, true),
    base("Stanislav Lobotka", "1994-11-25", "MF", "Slovakia", false, false, false),
    base("Frank Anguissa", "1995-11-16", "MF", "Cameroon", false, false, true),
    base("Giacomo Raspadori", "2000-02-18", "FW", "Italy", false, true, false),
  ],
  roma: [
    base("Mile Svilar", "1999-08-27", "GK", "Serbia", false, false, true),
    base("Gianluca Mancini", "1996-04-17", "DF", "Italy", false, true, false),
    base("Lorenzo Pellegrini", "1996-06-19", "MF", "Italy", true, true, false),
    base("Bryan Cristante", "1995-03-03", "MF", "Italy", false, true, false),
    base("Paulo Dybala", "1993-11-15", "FW", "Argentina", false, false, true),
  ],
};

const TRANSFER_POOL: Player[] = buildTransferPool();

function catalogPlayerToPlayer(player: CatalogPlayer, status: RegistrationStatus = "registered"): Player {
  const sourceClub = player.currentClub || player.sourceClub || "Unknown club";
  const sourceLeague = player.currentLeague;
  const nationality = player.nationality || player.nationalityCode || "Unknown";
  const isImportedFromAbroad = sourceLeague !== "Serie A";

  return {
    id: `${sourceLeague}-${sourceClub}-${player.name}-${player.dateOfBirth}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name: player.name,
    dateOfBirth: player.dateOfBirth || "",
    position: player.position,
    nationality,
    isClubTrained: Boolean(player.isClubTrained),
    // FBref does not provide training status. For MVP usability, Italian-nationality
    // players are pre-marked as Italy-trained, and users can correct it manually.
    isItalyTrained: Boolean(player.isItalyTrained) || isItalianNationality(nationality, player.nationalityCode),
    isNonEuOrEea: Boolean(player.isNonEuOrEea),
    fromAbroadThisWindow: isImportedFromAbroad,
    status,
    sourceClub,
    // Do not mark every FBref row as Review. Review is reserved for manual rows
    // and incoming transfer additions where eligibility should be checked.
    needsReview: false,
  };
}

function getImportedPlayersForClub(clubName: string): Player[] {
  return DATA_SNAPSHOT.players
    .filter((player) => player.currentLeague === "Serie A" && player.currentClub === clubName)
    .map((player) => catalogPlayerToPlayer(player, "registered"))
    .sort((a, b) => a.position.localeCompare(b.position) || a.name.localeCompare(b.name));
}

function buildTransferPool(): Player[] {
  return DATA_SNAPSHOT.players
    .map((player) => catalogPlayerToPlayer(player, "registered"))
    .sort((a, b) => a.sourceClub.localeCompare(b.sourceClub) || a.name.localeCompare(b.name));
}
function buildClubs(): Club[] {
  return CLUB_META.map(([slug, name, shortName, city]) => {
    const importedPlayers = getImportedPlayersForClub(name);
    const fallbackPlayers = FEATURED_PLAYERS[slug] ?? [
      base(`${name} Goalkeeper`, "1998-04-10", "GK", "Italy", false, true, false),
      base(`${name} Defender`, "1997-02-14", "DF", "Italy", false, true, false),
      base(`${name} Midfielder`, "1999-09-21", "MF", "France", false, false, false),
      base(`${name} Forward`, "2000-11-05", "FW", "Brazil", false, false, true),
      base(`${name} Academy Player`, "2005-03-18", "MF", "Italy", true, true, false),
    ];

    return {
      slug,
      name,
      shortName,
      city,
      players: importedPlayers.length > 0
        ? importedPlayers
        : fallbackPlayers.map((player) =>
            makePlayer(player.name, player.dateOfBirth, player.position, player.nationality, player.isClubTrained, player.isItalyTrained, player.isNonEuOrEea, false, name)
          ),
    };
  });
}

function hasValidDate(dateOfBirth: string) {
  if (!dateOfBirth) return false;
  const dob = new Date(dateOfBirth);
  return !Number.isNaN(dob.getTime());
}

function isU23Exempt(dateOfBirth: string) {
  if (!hasValidDate(dateOfBirth)) return false;
  const cutoff = new Date(`${SEASON_START_YEAR - 22}-01-01T00:00:00`);
  return new Date(`${dateOfBirth}T00:00:00`) >= cutoff;
}

function getAge(dateOfBirth: string) {
  if (!hasValidDate(dateOfBirth)) return "-";

  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age -= 1;
  return String(age);
}

function isReadyForLineup(player: Player) {
  return (
    player.status === "registered" &&
    player.name.trim().length > 0 &&
    player.nationality.trim().length > 0 &&
    hasValidDate(player.dateOfBirth)
  );
}

function isIncompleteRegistered(player: Player) {
  return (
    player.status === "registered" &&
    (player.name.trim().length === 0 || player.nationality.trim().length === 0 || !hasValidDate(player.dateOfBirth))
  );
}

function getCategory(player: Player): { label: Category; className: string; chipClassName: string } {
  if (player.name.trim().length === 0 || player.nationality.trim().length === 0 || !hasValidDate(player.dateOfBirth)) {
    return { label: "Review", className: "bg-amber-50 text-amber-700 border-amber-200", chipClassName: "border-amber-300 bg-amber-50 text-amber-800" };
  }
  if (isU23Exempt(player.dateOfBirth)) {
    return { label: "U23", className: "bg-emerald-50 text-emerald-700 border-emerald-200", chipClassName: "border-emerald-300 bg-emerald-50 text-emerald-800" };
  }
  if (player.needsReview) {
    return { label: "Review", className: "bg-amber-50 text-amber-700 border-amber-200", chipClassName: "border-amber-300 bg-amber-50 text-amber-800" };
  }
  if (player.isClubTrained) {
    return { label: "Club", className: "bg-sky-50 text-sky-700 border-sky-200", chipClassName: "border-sky-300 bg-sky-50 text-sky-800" };
  }
  if (player.isItalyTrained) {
    return { label: "Italy", className: "bg-indigo-50 text-indigo-700 border-indigo-200", chipClassName: "border-indigo-300 bg-indigo-50 text-indigo-800" };
  }
  return { label: "Non-HG", className: "bg-slate-100 text-slate-700 border-slate-200", chipClassName: "border-slate-300 bg-white text-slate-800" };
}

function validateSerieAList(players: Player[]): ValidationResult {
  const registeredRows = players.filter((player) => player.status === "registered");
  const incompleteRegistered = registeredRows.filter(isIncompleteRegistered).length;
  const registered = registeredRows.filter((player) => player.name.trim().length > 0);
  const senior = registered.filter((player) => !isU23Exempt(player.dateOfBirth));
  const u23 = registered.filter((player) => isU23Exempt(player.dateOfBirth));
  const clubTrained = senior.filter((player) => player.isClubTrained).length;
  const italyTrained = senior.filter((player) => player.isClubTrained || player.isItalyTrained).length;
  const nonHomegrown = senior.length - italyTrained;
  const nonEuArrivals = registered.filter((player) => player.isNonEuOrEea && player.fromAbroadThisWindow).length;
  const review = registered.filter((player) => player.needsReview || !hasValidDate(player.dateOfBirth) || player.nationality.trim().length === 0).length;

  const errors: string[] = [];
  const warnings: string[] = [];

  if (senior.length > 25) errors.push(`Too many senior players: ${senior.length}/25.`);
  if (nonHomegrown > 17) errors.push(`Too many non-homegrown senior players: ${nonHomegrown}/17.`);
  if (clubTrained < 4) errors.push(`Club-trained quota not met: ${clubTrained}/4.`);
  if (italyTrained < 8) errors.push(`Italy-trained/homegrown quota not met: ${italyTrained}/8.`);
  if (nonEuArrivals > 2) warnings.push(`${nonEuArrivals} non-EU arrivals from abroad. Check club slots.`);
  if (review > 0) warnings.push(`${review} players need manual eligibility review.`);
  if (incompleteRegistered > 0) warnings.push(`${incompleteRegistered} registered rows have missing player data.`);

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    counts: { registered: registered.length, senior: senior.length, u23: u23.length, nonHomegrown, clubTrained, italyTrained, nonEuArrivals, review, incompleteRegistered },
  };
}

function runSelfTests() {
  const failures: string[] = [];
  const expect = (condition: boolean, message: string) => {
    if (!condition) failures.push(message);
  };

  const clubs = buildClubs();
  expect(clubs.length === 20, "All 20 Serie A clubs should be built.");
  expect(clubs.every((club) => club.players.length >= 5), "Every preview club should have at least five players.");
  expect(isU23Exempt("2004-01-01"), "2004-01-01 should be U23 for 2026/27.");
  expect(!isU23Exempt("2003-12-31"), "2003-12-31 should be senior for 2026/27.");
  expect(!isU23Exempt(""), "Blank DOB should not be U23.");
  expect(getAge("") === "-", "Blank DOB should display dash age.");
  expect(getCategory(makePlayer("Youth", "2005-01-01", "MF", "Italy", false, false, false)).label === "U23", "Youth player should be U23.");
  expect(catalogPlayerToPlayer({ catalogId: "t", name: "Italian Senior", dateOfBirth: "1999-01-01", position: "MF", nationality: "ITA", nationalityCode: "ITA", currentClub: "Inter", currentLeague: "Serie A", isNonEuOrEea: false, needsEligibilityReview: true, needsDobReview: true }).needsReview === false, "Imported Serie A players should not all default to Review.");
  expect(catalogPlayerToPlayer({ catalogId: "t2", name: "Italian Senior", dateOfBirth: "1999-01-01", position: "MF", nationality: "ITA", nationalityCode: "ITA", currentClub: "Inter", currentLeague: "Serie A", isNonEuOrEea: false }).isItalyTrained === true, "Italian-nationality imported players should default to Italy-trained for MVP usability.");
  expect(validateSerieAList([]).counts.registered === 0, "Empty list should validate with zero registered players.");
  expect(!isReadyForLineup(makePlayer("", "", "MF", "", false, false, false)), "Blank manual rows should not be ready for lineup.");

  return failures;
}

const SELF_TEST_FAILURES = runSelfTests();

function Badge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-bold ${className}`}>{children}</span>;
}

function StatusCell({ ok }: { ok: boolean }) {
  return <span className={`inline-flex rounded px-2 py-1 text-xs font-bold ${ok ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{ok ? "OK" : "CHECK"}</span>;
}

function Metric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className={`border-r border-slate-200 px-4 py-3 last:border-r-0 ${danger ? "bg-amber-50" : "bg-white"}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</div>
      <div className={`mt-1 text-lg font-black ${danger ? "text-amber-800" : "text-slate-950"}`}>{value}</div>
    </div>
  );
}

function CheckboxCell({ checked, onChange, title }: { checked: boolean; onChange: (checked: boolean) => void; title?: string }) {
  return <input title={title} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 cursor-pointer rounded border-slate-300" />;
}

function RegistrationToggle({ value, onChange }: { value: RegistrationStatus; onChange: (value: RegistrationStatus) => void }) {
  const isRegistered = value === "registered";

  return (
    <button
      type="button"
      onClick={() => onChange(isRegistered ? "not_registered" : "registered")}
      title={isRegistered ? "Registered in the list" : "Not listed"}
      className={`inline-flex min-w-[68px] items-center justify-center rounded-full px-2 py-1 text-[11px] font-black transition ${
        isRegistered
          ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200"
          : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
      }`}
    >
      {isRegistered ? "REG" : "OUT"}
    </button>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function App() {
  const [clubs, setClubs] = useState<Club[]>(buildClubs());
  const [selectedSlug, setSelectedSlug] = useState("inter");
  const [activeTab, setActiveTab] = useState<ActiveTab>("sheet");
  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState<"All" | Position>("All");
  const [categoryFilter, setCategoryFilter] = useState<"All" | Category>("All");
  const [transferSearch, setTransferSearch] = useState("");
  const [lineups, setLineups] = useState<Record<string, Record<string, LineupPlacement>>>({});
  const [draggingPlayerId, setDraggingPlayerId] = useState<string | null>(null);

  const selectedClub = clubs.find((club) => club.slug === selectedSlug) ?? clubs[0];
  const validation = useMemo(() => validateSerieAList(selectedClub.players), [selectedClub.players]);
  const currentLineup = lineups[selectedClub.slug] ?? {};
  const registeredPlayers = useMemo(() => selectedClub.players.filter((player) => isReadyForLineup(player)), [selectedClub.players]);

  const placedPlayers = useMemo(() => {
    return registeredPlayers
      .filter((player) => Boolean(currentLineup[player.id]))
      .map((player) => ({ player, placement: currentLineup[player.id] }));
  }, [registeredPlayers, currentLineup]);

  const availableLineupPlayers = useMemo(() => {
    return registeredPlayers.filter((player) => !currentLineup[player.id]);
  }, [registeredPlayers, currentLineup]);

  const filteredPlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return selectedClub.players.filter((player) => {
      const category = getCategory(player).label;
      const matchesText = !q || `${player.name} ${player.nationality} ${player.position} ${category}`.toLowerCase().includes(q);
      const matchesPosition = positionFilter === "All" || player.position === positionFilter;
      const matchesCategory = categoryFilter === "All" || category === categoryFilter;
      return matchesText && matchesPosition && matchesCategory;
    });
  }, [selectedClub.players, search, positionFilter, categoryFilter]);

  const filteredTransfers = useMemo(() => {
    const q = transferSearch.trim().toLowerCase();
    return TRANSFER_POOL.filter((player) => player.sourceClub !== selectedClub.name).filter((player) => !q || `${player.name} ${player.sourceClub} ${player.nationality} ${player.position}`.toLowerCase().includes(q)).slice(0, 200);
  }, [transferSearch, selectedClub.name]);

  function updateSelectedPlayers(updater: (players: Player[]) => Player[]) {
    setClubs((current) => current.map((club) => (club.slug === selectedClub.slug ? { ...club, players: updater(club.players) } : club)));
  }

  function removeFromLineup(playerId: string) {
    setLineups((current) => {
      const clubLineup = { ...(current[selectedClub.slug] ?? {}) };
      delete clubLineup[playerId];
      return { ...current, [selectedClub.slug]: clubLineup };
    });
  }

  function updatePlayer(playerId: string, patch: Partial<Player>) {
    const existing = selectedClub.players.find((player) => player.id === playerId);
    const nextPlayer = existing ? { ...existing, ...patch } : undefined;
    updateSelectedPlayers((players) => players.map((player) => (player.id === playerId ? { ...player, ...patch } : player)));
    if (nextPlayer && !isReadyForLineup(nextPlayer)) removeFromLineup(playerId);
  }

  function removePlayer(playerId: string) {
    updateSelectedPlayers((players) => players.filter((player) => player.id !== playerId));
    removeFromLineup(playerId);
  }

  function addBlankRow() {
    const id = `manual-${selectedClub.slug}-${Date.now()}`;
    updateSelectedPlayers((players) => [
      ...players,
      {
        id,
        name: "",
        dateOfBirth: "",
        position: "MF",
        nationality: "",
        isClubTrained: false,
        isItalyTrained: false,
        isNonEuOrEea: false,
        fromAbroadThisWindow: false,
        status: "not_registered",
        sourceClub: "Manual",
        needsReview: true,
      },
    ]);
  }

  function addTransfer(player: Player) {
    updateSelectedPlayers((players) => [
      ...players,
      { ...player, id: `${player.id}-${selectedClub.slug}-${Date.now()}`, status: "registered", fromAbroadThisWindow: player.fromAbroadThisWindow, needsReview: true },
    ]);
  }

  function setLineupPlacement(playerId: string, placement: LineupPlacement) {
    setLineups((current) => ({
      ...current,
      [selectedClub.slug]: {
        ...(current[selectedClub.slug] ?? {}),
        [playerId]: placement,
      },
    }));
  }

  function addPlayerToBoard(playerId: string) {
    const index = placedPlayers.length;
    const x = 20 + (index % 4) * 20;
    const y = 72 - Math.floor(index / 4) * 14;
    setLineupPlacement(playerId, { x: clamp(x, 8, 92), y: clamp(y, 8, 92) });
  }

  function handlePitchDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const playerId = draggingPlayerId ?? event.dataTransfer.getData("text/plain");
    const player = registeredPlayers.find((item) => item.id === playerId);
    if (!player) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = clamp(((event.clientX - rect.left) / rect.width) * 100, 6, 94);
    const y = clamp(((event.clientY - rect.top) / rect.height) * 100, 6, 94);
    setLineupPlacement(player.id, { x, y });
    setDraggingPlayerId(null);
  }

  function handleBenchDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const playerId = draggingPlayerId ?? event.dataTransfer.getData("text/plain");
    if (!playerId) return;
    removeFromLineup(playerId);
    setDraggingPlayerId(null);
  }

  function resetLineup() {
    setLineups((current) => ({ ...current, [selectedClub.slug]: {} }));
  }

  return (
    <div className="min-h-screen bg-[#eef2f5] text-slate-950">
      <header className="sticky top-0 z-50 border-b border-slate-300 bg-[#107c41] text-white shadow-sm">
        <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
          <div className="mx-auto max-w-[1600px]">
            Unofficial squad registration simulator. Player data is for planning/demo purposes and may require manual verification.
            This app is not affiliated with Serie A, its clubs, FBref, or Sports Reference.
          </div>
        </div>
        <div className="mx-auto flex h-12 max-w-[1600px] items-center justify-between px-3">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded bg-white/15 text-xs font-black">SA</div>
            <div>
              <div className="text-sm font-black leading-4">Serie A Registration Workbook</div>
              <div className="text-[11px] text-white/75">Excel-style squad planning · Big 5 snapshot loaded</div>
            </div>
          </div>
          <div className="hidden text-xs font-bold text-white/80 sm:block">Summer Window · 2026/27</div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] p-3">
        {SELF_TEST_FAILURES.length > 0 && (
          <section className="mb-3 border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-800">
            <div>Self-tests failed:</div>
            <ul className="mt-1 list-disc pl-5">{SELF_TEST_FAILURES.map((failure) => <li key={failure}>{failure}</li>)}</ul>
          </section>
        )}

        <section className="mb-3 border border-slate-300 bg-white shadow-sm">
          <div className="flex flex-wrap items-end gap-3 border-b border-slate-300 bg-slate-100 p-3">
            <div>
              <label className="mb-1 block text-[11px] font-black uppercase tracking-wide text-slate-500">Sheet</label>
              <select value={selectedSlug} onChange={(event) => setSelectedSlug(event.target.value)} className="h-9 min-w-56 border border-slate-300 bg-white px-2 text-sm font-bold outline-none focus:border-green-700">
                {clubs.map((club) => <option key={club.slug} value={club.slug}>{club.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-black uppercase tracking-wide text-slate-500">Sheet search</label>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search current squad sheet..." className="h-9 w-72 border border-slate-300 bg-white px-2 text-sm outline-none focus:border-green-700" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-black uppercase tracking-wide text-slate-500">Position</label>
              <select value={positionFilter} onChange={(event) => setPositionFilter(event.target.value as "All" | Position)} className="h-9 border border-slate-300 bg-white px-2 text-sm font-bold outline-none focus:border-green-700">
                <option value="All">All</option>
                <option value="GK">GK</option>
                <option value="DF">DF</option>
                <option value="MF">MF</option>
                <option value="FW">FW</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-black uppercase tracking-wide text-slate-500">Category</label>
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as "All" | Category)} className="h-9 border border-slate-300 bg-white px-2 text-sm font-bold outline-none focus:border-green-700">
                <option value="All">All</option>
                <option value="U23">U23</option>
                <option value="Club">Club</option>
                <option value="Italy">Italy</option>
                <option value="Non-HG">Non-HG</option>
                <option value="Review">Review</option>
              </select>
            </div>
          </div>

          <div className="flex border-b border-slate-300 bg-white">
            <button onClick={() => setActiveTab("sheet")} className={`border-r border-slate-300 px-5 py-2 text-sm font-black ${activeTab === "sheet" ? "bg-white text-green-800" : "bg-slate-100 text-slate-500 hover:bg-slate-50"}`}>Sheet</button>
            <button onClick={() => setActiveTab("lineup")} className={`border-r border-slate-300 px-5 py-2 text-sm font-black ${activeTab === "lineup" ? "bg-white text-green-800" : "bg-slate-100 text-slate-500 hover:bg-slate-50"}`}>Lineup Board</button>
          </div>

          <div className="grid grid-cols-2 border-b border-slate-300 md:grid-cols-4 xl:grid-cols-8">
            <Metric label="Club" value={selectedClub.shortName} />
            <Metric label="Rows" value={`${filteredPlayers.length}`} />
            <Metric label="Registered" value={`${validation.counts.registered}`} />
            <Metric label="Senior" value={`${validation.counts.senior}/25`} danger={validation.counts.senior > 25} />
            <Metric label="U23" value={`${validation.counts.u23}`} />
            <Metric label="Non-HG" value={`${validation.counts.nonHomegrown}/17`} danger={validation.counts.nonHomegrown > 17} />
            <Metric label="Club Trained" value={`${validation.counts.clubTrained}/4`} danger={validation.counts.clubTrained < 4} />
            <Metric label="Italy Trained" value={`${validation.counts.italyTrained}/8`} danger={validation.counts.italyTrained < 8} />
          </div>
        </section>

        {activeTab === "sheet" ? (
          <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="overflow-hidden border border-slate-300 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-300 bg-slate-100 px-3 py-2">
                <div className="text-sm font-black">{selectedClub.name} Squad Table</div>
                <StatusCell ok={validation.ok} />
              </div>

              <div className="max-h-[calc(100vh-318px)] overflow-auto">
                <table className="min-w-[1380px] w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-20 bg-slate-200 text-[11px] font-black uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="w-10 border border-slate-300 px-2 py-2 text-center">#</th>
                      <th className="w-24 border border-slate-300 px-2 py-2" title="REG means the player is counted in the Serie A registration list.">REG</th>
                      <th className="w-56 border border-slate-300 px-2 py-2 text-left">Player</th>
                      <th className="w-24 border border-slate-300 px-2 py-2">Pos</th>
                      <th className="w-36 border border-slate-300 px-2 py-2">DOB</th>
                      <th className="w-20 border border-slate-300 px-2 py-2">Age</th>
                      <th className="w-44 border border-slate-300 px-2 py-2 text-left">Nationality</th>
                      <th className="w-28 border border-slate-300 px-2 py-2" title="Club-trained: counts toward the 4 club-trained quota.">Club</th>
                      <th className="w-28 border border-slate-300 px-2 py-2" title="Italy-trained/homegrown: counts toward the 8 Italy-trained quota.">Italy</th>
                      <th className="w-28 border border-slate-300 px-2 py-2" title="Non-EU/EEA player flag.">Non-EU</th>
                      <th className="w-28 border border-slate-300 px-2 py-2" title="Arrived from abroad during this transfer window.">Abroad</th>
                      <th className="w-28 border border-slate-300 px-2 py-2" title="Needs manual eligibility review.">Review</th>
                      <th className="w-32 border border-slate-300 px-2 py-2">Category</th>
                      <th className="w-40 border border-slate-300 px-2 py-2 text-left">Source</th>
                      <th className="w-24 border border-slate-300 px-2 py-2">Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPlayers.map((player, index) => {
                      const category = getCategory(player);
                      return (
                        <tr key={player.id} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                          <td className="border border-slate-200 px-2 py-1 text-center text-xs font-bold text-slate-500">{index + 1}</td>
                          <td className="border border-slate-200 px-2 py-1 text-center">
                            <RegistrationToggle value={player.status} onChange={(nextStatus) => updatePlayer(player.id, { status: nextStatus })} />
                          </td>
                          <td className="border border-slate-200 px-1 py-1">
                            <input value={player.name} onChange={(event) => updatePlayer(player.id, { name: event.target.value })} placeholder="Player name" className="w-full border border-transparent bg-transparent px-2 py-1 outline-none placeholder:text-slate-400 focus:border-green-700 focus:bg-white" />
                          </td>
                          <td className="border border-slate-200 px-1 py-1 text-center">
                            <select value={player.position} onChange={(event) => updatePlayer(player.id, { position: event.target.value as Position })} className="w-full border border-transparent bg-transparent px-1 py-1 font-bold outline-none focus:border-green-700">
                              <option value="GK">GK</option>
                              <option value="DF">DF</option>
                              <option value="MF">MF</option>
                              <option value="FW">FW</option>
                            </select>
                          </td>
                          <td className="border border-slate-200 px-1 py-1">
                            <input type="date" value={player.dateOfBirth} onChange={(event) => updatePlayer(player.id, { dateOfBirth: event.target.value })} title="Date of birth" className="w-full border border-transparent bg-transparent px-2 py-1 outline-none focus:border-green-700 focus:bg-white" />
                          </td>
                          <td className="border border-slate-200 px-2 py-1 text-center font-bold">{getAge(player.dateOfBirth)}</td>
                          <td className="border border-slate-200 px-1 py-1">
                            <input value={player.nationality} onChange={(event) => updatePlayer(player.id, { nationality: event.target.value })} placeholder="Nationality" className="w-full border border-transparent bg-transparent px-2 py-1 outline-none placeholder:text-slate-400 focus:border-green-700 focus:bg-white" />
                          </td>
                          <td className="border border-slate-200 px-2 py-1 text-center"><CheckboxCell title="Club-trained: counts toward the 4 club-trained quota." checked={player.isClubTrained} onChange={(checked) => updatePlayer(player.id, { isClubTrained: checked, isItalyTrained: checked ? true : player.isItalyTrained })} /></td>
                          <td className="border border-slate-200 px-2 py-1 text-center"><CheckboxCell title="Italy-trained/homegrown: counts toward the 8 Italy-trained quota." checked={player.isItalyTrained} onChange={(checked) => updatePlayer(player.id, { isItalyTrained: checked })} /></td>
                          <td className="border border-slate-200 px-2 py-1 text-center"><CheckboxCell title="Non-EU/EEA player flag." checked={player.isNonEuOrEea} onChange={(checked) => updatePlayer(player.id, { isNonEuOrEea: checked })} /></td>
                          <td className="border border-slate-200 px-2 py-1 text-center"><CheckboxCell title="Arrived from abroad during this transfer window." checked={player.fromAbroadThisWindow} onChange={(checked) => updatePlayer(player.id, { fromAbroadThisWindow: checked })} /></td>
                          <td className="border border-slate-200 px-2 py-1 text-center"><CheckboxCell title="Needs manual eligibility review." checked={Boolean(player.needsReview)} onChange={(checked) => updatePlayer(player.id, { needsReview: checked })} /></td>
                          <td className="border border-slate-200 px-2 py-1 text-center"><Badge className={category.className}>{category.label}</Badge></td>
                          <td className="border border-slate-200 px-2 py-1 text-xs text-slate-500">{player.sourceClub}</td>
                          <td className="border border-slate-200 px-2 py-1 text-center"><button onClick={() => removePlayer(player.id)} className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs font-black text-red-700 hover:bg-red-100">Delete</button></td>
                        </tr>
                      );
                    })}
                    <tr className="bg-white">
                      <td className="border border-slate-200 px-2 py-1 text-center text-xs font-bold text-slate-400">+</td>
                      <td colSpan={14} className="border border-slate-200 p-0">
                        <button onClick={addBlankRow} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-black text-green-700 hover:bg-green-50">
                          <span className="grid h-5 w-5 place-items-center rounded border border-green-700 text-xs">+</span>
                          Add new player
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <aside className="space-y-3">
              <section className="border border-slate-300 bg-white shadow-sm">
                <div className="border-b border-slate-300 bg-slate-100 px-3 py-2 text-sm font-black">Column help</div>
                <div className="space-y-1 p-3 text-xs text-slate-700">
                  <div><b>REG</b>: counts in the registration list.</div>
                  <div><b>Club</b>: club-trained quota.</div>
                  <div><b>Italy</b>: Italy-trained/homegrown quota.</div>
                  <div><b>Non-EU</b>: non-EU/EEA player.</div>
                  <div><b>Abroad</b>: arrived from abroad this window.</div>
                  <div><b>Review</b>: needs manual eligibility check.</div>
                </div>
              </section>

              <RulesPanel validation={validation} />
              <TransferPanel transferSearch={transferSearch} setTransferSearch={setTransferSearch} filteredTransfers={filteredTransfers} totalPoolPlayers={TRANSFER_POOL.length} addTransfer={addTransfer} />
            </aside>
          </section>
        ) : (
          <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
            <section className="border border-slate-300 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-300 bg-slate-100 px-3 py-2">
                <div>
                  <div className="text-sm font-black">Lineup Board</div>
                </div>
                <button onClick={resetLineup} className="border border-slate-300 bg-white px-3 py-1 text-xs font-black hover:bg-slate-50">Reset board</button>
              </div>

              <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={handlePitchDrop}
                className="relative h-[calc(100vh-306px)] min-h-[500px] overflow-hidden bg-emerald-700"
              >
                <div className="absolute inset-5 border-2 border-white/35" />
                <div className="absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/25" />
                <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/40" />
                <div className="absolute left-1/2 top-5 h-24 w-48 -translate-x-1/2 border-x-2 border-b-2 border-white/25" />
                <div className="absolute bottom-5 left-1/2 h-24 w-48 -translate-x-1/2 border-x-2 border-t-2 border-white/25" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.10),transparent_42%)]" />

                {placedPlayers.length === 0 && (
                  <div className="absolute left-1/2 top-1/2 w-72 -translate-x-1/2 -translate-y-1/2 rounded bg-white/90 p-4 text-center text-sm font-bold text-slate-600 shadow">
                    Drag registered players from the bench to build a free lineup.
                  </div>
                )}

                {placedPlayers.map(({ player, placement }) => {
                  const category = getCategory(player);
                  return (
                    <div
                      key={player.id}
                      draggable
                      onDragStart={(event) => {
                        setDraggingPlayerId(player.id);
                        event.dataTransfer.setData("text/plain", player.id);
                      }}
                      onDragEnd={() => setDraggingPlayerId(null)}
                      className="absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing"
                      style={{ left: `${placement.x}%`, top: `${placement.y}%` }}
                    >
                      <div className={`min-w-32 rounded border-2 px-2 py-1 text-center text-xs font-black shadow-lg backdrop-blur ${category.chipClassName}`}>
                        <div className="truncate">{player.name}</div>
                        <div className="text-[10px] opacity-75">{player.position} · {category.label}</div>
                      </div>
                      <button onClick={() => removeFromLineup(player.id)} className="mx-auto mt-1 block rounded bg-black/50 px-2 py-0.5 text-[10px] font-black text-white hover:bg-black/70">remove</button>
                    </div>
                  );
                })}
              </div>

              <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleBenchDrop}
                className="border-t border-slate-300 bg-white p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-black">Bench</div>
                    <div className="text-xs text-slate-500">Available registered players. Drop a player here to remove him from the board.</div>
                  </div>
                  <Badge className="border-slate-200 bg-slate-100 text-slate-700">{availableLineupPlayers.length} available</Badge>
                </div>
                <div className="flex max-h-28 flex-wrap gap-2 overflow-auto">
                  {availableLineupPlayers.length === 0 ? (
                    <div className="border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">No bench players available.</div>
                  ) : availableLineupPlayers.map((player) => {
                    const category = getCategory(player);
                    return (
                      <div
                        key={player.id}
                        draggable
                        onDragStart={(event) => {
                          setDraggingPlayerId(player.id);
                          event.dataTransfer.setData("text/plain", player.id);
                        }}
                        onDragEnd={() => setDraggingPlayerId(null)}
                        className={`cursor-grab rounded border px-3 py-2 text-xs font-black shadow-sm active:cursor-grabbing ${category.chipClassName}`}
                      >
                        <div>{player.name}</div>
                        <div className="text-[10px] opacity-70">{player.position} · {category.label}</div>
                        <button onClick={() => addPlayerToBoard(player.id)} className="mt-1 block w-full rounded bg-white/70 px-2 py-0.5 text-[10px] font-black hover:bg-white">add</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <aside className="space-y-3">
              <section className="border border-slate-300 bg-white shadow-sm">
                <div className="border-b border-slate-300 bg-slate-100 px-3 py-2 text-sm font-black">Lineup summary</div>
                <div className="grid grid-cols-2 border-b border-slate-200">
                  <Metric label="On board" value={`${placedPlayers.length}`} />
                  <Metric label="Available" value={`${availableLineupPlayers.length}`} />
                </div>
                <div className="p-3 text-xs text-slate-600">Only REG players with name, DOB and nationality appear in the lineup board. If a player becomes OUT or incomplete in the sheet, he is removed from the board automatically.</div>
              </section>
              <RulesPanel validation={validation} />
            </aside>
          </section>
        )}
      </main>
    </div>
  );
}

function RulesPanel({ validation }: { validation: ValidationResult }) {
  return (
    <section className="border border-slate-300 bg-white shadow-sm">
      <div className="border-b border-slate-300 bg-slate-100 px-3 py-2 text-sm font-black">Rules / Checks</div>
      <div className="p-3 text-sm">
        <div className="mb-3"><StatusCell ok={validation.ok} /></div>
        <ul className="space-y-1 text-slate-700">
          <li><b>25</b> max senior registered players</li>
          <li><b>17</b> max non-homegrown senior players</li>
          <li><b>4</b> min club-trained senior players</li>
          <li><b>8</b> min Italy-trained/homegrown senior players</li>
          <li><b>U23</b> players are exempt</li>
        </ul>
        {(validation.errors.length > 0 || validation.warnings.length > 0) && (
          <div className="mt-3 space-y-2">
            {validation.errors.map((error) => <div key={error} className="border border-amber-300 bg-amber-50 p-2 text-xs font-bold text-amber-800">{error}</div>)}
            {validation.warnings.map((warning) => <div key={warning} className="border border-slate-300 bg-slate-50 p-2 text-xs font-bold text-slate-700">{warning}</div>)}
          </div>
        )}
      </div>
    </section>
  );
}

function TransferPanel({
  transferSearch,
  setTransferSearch,
  filteredTransfers,
  totalPoolPlayers,
  addTransfer,
}: {
  transferSearch: string;
  setTransferSearch: (value: string) => void;
  filteredTransfers: Player[];
  totalPoolPlayers: number;
  addTransfer: (player: Player) => void;
}) {
  return (
    <section className="border border-slate-300 bg-white shadow-sm">
      <div className="border-b border-slate-300 bg-slate-100 px-3 py-2 text-sm font-black">Player pool / database · {totalPoolPlayers} players</div>
      <div className="p-3">
        <div className="mb-2 text-xs font-semibold text-slate-500">Search here to add players that are not already in the current squad sheet.</div>
        <input value={transferSearch} onChange={(event) => setTransferSearch(event.target.value)} placeholder="Search player pool / database..." className="mb-2 h-9 w-full border border-slate-300 px-2 text-sm outline-none focus:border-green-700" />
        <div className="max-h-[340px] overflow-auto space-y-2">
          {filteredTransfers.map((player) => {
            const category = getCategory(player);
            return (
              <div key={player.id} className="border border-slate-200 bg-slate-50 p-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-black">{player.name}</div>
                    <div className="text-xs text-slate-500">{player.position} · {player.sourceClub}</div>
                  </div>
                  <Badge className={category.className}>{category.label}</Badge>
                </div>
                <button onClick={() => addTransfer(player)} className="mt-2 w-full border border-green-700 bg-green-700 px-3 py-1.5 text-xs font-black text-white hover:bg-green-800">Add to sheet</button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
