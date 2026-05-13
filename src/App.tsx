import React, { useEffect, useMemo, useRef, useState } from "react";
import playerSnapshot from "./data/big5-latest.json";

type Position = "GK" | "DF" | "MF" | "FW";
type RegistrationStatus = "registered" | "not_registered";
type Category = "U23" | "Club" | "Italy" | "Non-HG" | "Review";
type ActiveTab = "sheet" | "lineup" | "overview";

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
  sourceLeague?: string;
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
  currentLeague?: string;
  sourceClub?: string;
  sourceLeague?: string;
  isClubTrained?: boolean;
  isItalyTrained?: boolean;
  isNonEuOrEea?: boolean;
  fromAbroadThisWindow?: boolean;
  needsEligibilityReview?: boolean;
  needsDobReview?: boolean;
};

type PlayerCatalogSnapshot = {
  players: CatalogPlayer[];
  report?: {
    source?: string;
    importedAt?: string;
    playerCount?: number;
    teamCount?: number;
    serieAPlayerCount?: number;
    competitionCount?: number;
    leagueCount?: number;
    competitionCodes?: string[];
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
    clubTrainedTotal: number;
    italyTrainedTotal: number;
    clubTrainedNonSenior: number;
    italyTrainedNonSenior: number;
    associationTrained: number;
    seniorCapacity: number;
    unusedReservedSlots: number;
    nonEuArrivals: number;
    review: number;
    incompleteRegistered: number;
  };
};

type LineupPlayer = { player: Player; placement: LineupPlacement };
type SortKey = "status" | "name" | "position" | "dateOfBirth" | "age" | "nationality" | "category" | "sourceClub";
type SortDirection = "asc" | "desc";
type QuickView = "all" | "registered" | "issues" | "additions";
type TransferLeagueFilter = string;

type SavedWorkbook = {
  version: number;
  clubs: Club[];
  lineups: Record<string, Record<string, LineupPlacement>>;
  selectedSlug: string;
  exportedAt?: string;
};

const CATEGORY_STYLES: Record<Category, { className: string; chipClassName: string }> = {
  U23: { className: "bg-emerald-50 text-emerald-700 border-emerald-200", chipClassName: "border-emerald-300 bg-emerald-50 text-emerald-800" },
  Club: { className: "bg-sky-50 text-sky-700 border-sky-200", chipClassName: "border-sky-300 bg-sky-50 text-sky-800" },
  Italy: { className: "bg-indigo-50 text-indigo-700 border-indigo-200", chipClassName: "border-indigo-300 bg-indigo-50 text-indigo-800" },
  Review: { className: "bg-amber-50 text-amber-700 border-amber-200", chipClassName: "border-amber-300 bg-amber-50 text-amber-800" },
  "Non-HG": { className: "bg-slate-100 text-slate-700 border-slate-200", chipClassName: "border-slate-300 bg-white text-slate-800" },
};

const SEASON_START_YEAR = 2026;
const STORAGE_KEY = "serie-a-registration-workbook:v2";
const DATA_SNAPSHOT = playerSnapshot as PlayerCatalogSnapshot;

const POSITION_ORDER: Record<Position, number> = { GK: 0, DF: 1, MF: 2, FW: 3 };
const DEFAULT_LEAGUE_ORDER = [
  "Serie A",
  "Premier League",
  "LaLiga",
  "Bundesliga",
  "Ligue 1",
  "Primeira Liga",
  "Eredivisie",
  "Brazil Serie A",
  "Liga Profesional",
  "MLS",
  "Jupiler Pro League",
  "Turkish Super Lig",
  "Swiss Super League",
  "Austrian Bundesliga",
  "Danish Superliga",
  "Scottish Premiership",
  "J. League",
  "Liga MX",
  "Greek Super League",
  "A-League",
];
const DATA_LEAGUES = buildLeagueList(DATA_SNAPSHOT.players);
const TRANSFER_LEAGUES: TransferLeagueFilter[] = ["All", ...DATA_LEAGUES];
const QUICK_VIEWS: Array<{ value: QuickView; label: string }> = [
  { value: "all", label: "All rows" },
  { value: "registered", label: "REG only" },
  { value: "issues", label: "Issues" },
  { value: "additions", label: "Added" },
];

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

function createManualPlayer(clubSlug: string, position: Position, id = `manual-${clubSlug}-${Date.now()}`): Player {
  return {
    id,
    name: "",
    dateOfBirth: "",
    position,
    nationality: "",
    isClubTrained: false,
    isItalyTrained: false,
    isNonEuOrEea: false,
    fromAbroadThisWindow: false,
    status: "registered",
    sourceClub: "Manual",
    needsReview: true,
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

function buildLeagueList(players: CatalogPlayer[]): string[] {
  const leagues = Array.from(new Set(players.map((player) => player.currentLeague || player.sourceLeague).filter(Boolean) as string[]));
  const preferred = DEFAULT_LEAGUE_ORDER.filter((league) => leagues.includes(league));
  const remaining = leagues.filter((league) => !DEFAULT_LEAGUE_ORDER.includes(league)).sort((a, b) => a.localeCompare(b));
  return [...preferred, ...remaining];
}

function catalogPlayerToPlayer(player: CatalogPlayer, status: RegistrationStatus = "registered"): Player {
  const sourceClub = player.currentClub || player.sourceClub || "Unknown club";
  const sourceLeague = player.currentLeague || player.sourceLeague || "Unknown league";
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
    sourceLeague,
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

function getCategoryStyle(label: Category): { label: Category; className: string; chipClassName: string } {
  return { label, ...CATEGORY_STYLES[label] };
}

function getCategory(player: Player): { label: Category; className: string; chipClassName: string } {
  if (player.name.trim().length === 0 || player.nationality.trim().length === 0 || !hasValidDate(player.dateOfBirth)) {
    return getCategoryStyle("Review");
  }
  if (isU23Exempt(player.dateOfBirth)) {
    return getCategoryStyle("U23");
  }
  if (player.isClubTrained) {
    return getCategoryStyle("Club");
  }
  if (player.isItalyTrained) {
    return getCategoryStyle("Italy");
  }
  if (player.needsReview) {
    return getCategoryStyle("Review");
  }
  return getCategoryStyle("Non-HG");
}

function getSupplementalCategories(player: Player): Category[] {
  const primary = getCategory(player).label;
  const categories: Category[] = [];

  if (player.isClubTrained && primary !== "Club") {
    categories.push("Club");
  } else if (player.isItalyTrained && primary !== "Italy" && primary !== "Club") {
    categories.push("Italy");
  }

  if (player.needsReview && primary !== "Review") categories.push("Review");

  return categories;
}

function validateSerieAList(players: Player[]): ValidationResult {
  const registeredRows = players.filter((player) => player.status === "registered");
  const incompleteRegistered = registeredRows.filter(isIncompleteRegistered).length;
  const registered = registeredRows.filter((player) => player.name.trim().length > 0);
  const completeRegistered = registered.filter((player) => !isIncompleteRegistered(player));
  const senior = completeRegistered.filter((player) => !isU23Exempt(player.dateOfBirth));
  const u23 = completeRegistered.filter((player) => isU23Exempt(player.dateOfBirth));
  const clubTrained = senior.filter((player) => player.isClubTrained).length;
  const italyTrained = senior.filter((player) => player.isClubTrained || player.isItalyTrained).length;
  const clubTrainedTotal = registered.filter((player) => player.isClubTrained).length;
  const italyTrainedTotal = registered.filter((player) => player.isClubTrained || player.isItalyTrained).length;
  const clubTrainedNonSenior = clubTrainedTotal - clubTrained;
  const italyTrainedNonSenior = italyTrainedTotal - italyTrained;
  const associationTrained = Math.max(0, italyTrained - clubTrained);
  const localReservedSlotsFilled = Math.min(8, clubTrained + Math.min(associationTrained, 4));
  const seniorCapacity = 17 + localReservedSlotsFilled;
  const unusedReservedSlots = 25 - seniorCapacity;
  const nonHomegrown = senior.length - italyTrained;
  const nonEuArrivals = completeRegistered.filter((player) => player.isNonEuOrEea && player.fromAbroadThisWindow).length;
  const review = registered.filter((player) => player.needsReview || !hasValidDate(player.dateOfBirth) || player.nationality.trim().length === 0).length;

  const errors: string[] = [];
  const warnings: string[] = [];

  if (senior.length > seniorCapacity) {
    errors.push(
      unusedReservedSlots > 0
        ? `Too many senior players for available reserved slots: ${senior.length}/${seniorCapacity}. ${unusedReservedSlots} reserved senior slot${unusedReservedSlots === 1 ? " is" : "s are"} unused.`
        : `Too many senior players: ${senior.length}/25.`
    );
  }
  if (nonHomegrown > 17) errors.push(`Too many non-homegrown senior players: ${nonHomegrown}/17.`);
  if (nonEuArrivals > 2) warnings.push(`${nonEuArrivals} non-EU arrivals from abroad. Check club slots.`);
  if (review > 0) warnings.push(`${review} players need manual eligibility review.`);
  if (incompleteRegistered > 0) warnings.push(`${incompleteRegistered} registered rows have missing player data.`);

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    counts: { registered: registered.length, senior: senior.length, u23: u23.length, nonHomegrown, clubTrained, italyTrained, clubTrainedTotal, italyTrainedTotal, clubTrainedNonSenior, italyTrainedNonSenior, associationTrained, seniorCapacity, unusedReservedSlots, nonEuArrivals, review, incompleteRegistered },
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
  const manualPlayer = createManualPlayer("test", "DF", "manual-test");
  expect(manualPlayer.status === "registered", "Manual rows should default to registered so they affect squad-list requirements once completed.");
  expect(manualPlayer.sourceClub === "Manual" && manualPlayer.needsReview === true, "Manual rows should remain marked as manual-review additions.");
  const incompleteManualPlayer = { ...manualPlayer, name: "Incomplete Manual", isClubTrained: true, isItalyTrained: true };
  const incompleteManualValidation = validateSerieAList([incompleteManualPlayer]);
  expect(incompleteManualValidation.counts.registered === 1, "Named incomplete manual players should appear in the registered row count.");
  expect(incompleteManualValidation.counts.senior === 0, "Incomplete manual players should not count toward senior quota checks.");
  expect(incompleteManualValidation.counts.clubTrained === 0, "Incomplete manual players should not satisfy the senior club-trained quota.");
  const completedManualPlayer = { ...manualPlayer, name: "Manual Senior", dateOfBirth: "1999-01-01", nationality: "Brazil" };
  const completedManualValidation = validateSerieAList([completedManualPlayer]);
  expect(completedManualValidation.counts.registered === 1, "Completed manual players should count as registered.");
  expect(completedManualValidation.counts.senior === 1, "Completed senior manual players should count toward the senior list.");
  expect(completedManualValidation.counts.nonHomegrown === 1, "Completed manual players without HG flags should count as non-homegrown.");
  const clubTrainedManualPlayer = { ...completedManualPlayer, isClubTrained: true, isItalyTrained: true };
  const clubTrainedManualValidation = validateSerieAList([clubTrainedManualPlayer]);
  expect(getCategory(clubTrainedManualPlayer).label === "Club", "Completed club-trained manual players should show as Club even while marked for review.");
  expect(clubTrainedManualValidation.counts.clubTrained === 1, "Club-trained manual players should count toward the club-trained requirement.");
  expect(clubTrainedManualValidation.counts.italyTrained === 1, "Club-trained manual players should also count toward the Italy-trained/homegrown requirement.");
  expect(clubTrainedManualValidation.counts.nonHomegrown === 0, "Club-trained manual players should not count as non-homegrown.");
  const u23ClubTrainedManualPlayer = { ...clubTrainedManualPlayer, dateOfBirth: "2006-02-21" };
  const u23ClubTrainedManualValidation = validateSerieAList([u23ClubTrainedManualPlayer]);
  expect(getCategory(u23ClubTrainedManualPlayer).label === "U23", "U23 club-trained players should keep U23 as the primary squad-list category.");
  expect(getSupplementalCategories(u23ClubTrainedManualPlayer).includes("Club"), "U23 club-trained players should still visibly show Club eligibility.");
  expect(u23ClubTrainedManualValidation.counts.clubTrained === 0, "U23 club-trained players should not fill the senior club-trained quota.");
  expect(u23ClubTrainedManualValidation.counts.clubTrainedTotal === 1, "U23 club-trained players should still count as club-trained eligibility flags.");
  expect(u23ClubTrainedManualValidation.counts.clubTrainedNonSenior === 1, "U23 club-trained players should be counted as non-senior C flags.");
  expect(u23ClubTrainedManualValidation.ok, "Missing senior club-trained slots should not be a standalone validation error.");

  const makeTestSenior = (name: string, isClubTrained = false, isItalyTrained = false) =>
    makePlayer(name, "1999-01-01", "MF", isItalyTrained ? "Italy" : "Brazil", isClubTrained, isItalyTrained, false);
  const fullListWithThreeClub = validateSerieAList([
    ...Array.from({ length: 17 }, (_, index) => makeTestSenior(`Non-HG ${index + 1}`)),
    ...Array.from({ length: 3 }, (_, index) => makeTestSenior(`Club ${index + 1}`, true, true)),
    ...Array.from({ length: 5 }, (_, index) => makeTestSenior(`Italy ${index + 1}`, false, true)),
  ]);
  expect(fullListWithThreeClub.counts.senior === 25, "Reserved-slot self-test should build a full 25-player senior list.");
  expect(fullListWithThreeClub.counts.seniorCapacity === 24, "Three club-trained seniors with excess association-trained seniors should reduce senior capacity to 24.");
  expect(!fullListWithThreeClub.ok, "A 25-player senior list should fail when only 24 reserved slots are available.");
  expect(fullListWithThreeClub.errors.some((error) => error.includes("25/24")), "Reduced-capacity errors should explain the available senior slots.");
  const reducedListWithThreeClub = validateSerieAList([
    ...Array.from({ length: 17 }, (_, index) => makeTestSenior(`Reduced Non-HG ${index + 1}`)),
    ...Array.from({ length: 3 }, (_, index) => makeTestSenior(`Reduced Club ${index + 1}`, true, true)),
    ...Array.from({ length: 4 }, (_, index) => makeTestSenior(`Reduced Italy ${index + 1}`, false, true)),
  ]);
  expect(reducedListWithThreeClub.ok, "A 24-player senior list should pass with three club-trained seniors if all available slots are respected.");

  return failures;
}

const SELF_TEST_FAILURES = runSelfTests();

function Badge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-bold ${className}`}>{children}</span>;
}

function StatusCell({ ok }: { ok: boolean }) {
  return <span className={`inline-flex rounded px-2 py-1 text-xs font-bold ${ok ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{ok ? "OK" : "CHECK"}</span>;
}

function Metric({ label, value, danger = false, progress }: { label: string; value: string; danger?: boolean; progress?: number }) {
  const normalizedProgress = typeof progress === "number" ? clamp(progress, 0, 100) : undefined;

  return (
    <div className={`border-r border-slate-200 px-4 py-3 last:border-r-0 ${danger ? "bg-amber-50" : "bg-white"}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</div>
      <div className={`mt-1 text-lg font-black ${danger ? "text-amber-800" : "text-slate-950"}`}>{value}</div>
      {normalizedProgress !== undefined && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div className={`h-full rounded-full ${danger ? "bg-amber-500" : "bg-emerald-600"}`} style={{ width: `${normalizedProgress}%` }} />
        </div>
      )}
    </div>
  );
}

function SidePanel({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 to-slate-800 px-3 py-2 text-white">
        {eyebrow && <div className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200">{eyebrow}</div>}
        <div className="text-sm font-black">{title}</div>
      </div>
      {children}
    </section>
  );
}

function RailStat({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "good" | "warn" }) {
  const toneClass = tone === "good"
    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
    : tone === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-slate-200 bg-slate-50 text-slate-900";

  return (
    <div className={`rounded-md border p-2 ${toneClass}`}>
      <div className="text-[10px] font-black uppercase tracking-wide opacity-65">{label}</div>
      <div className="mt-1 text-lg font-black leading-none">{value}</div>
    </div>
  );
}

function RailProgress({ label, value, max, danger = false }: { label: string; value: number; max: number; danger?: boolean }) {
  const progress = max > 0 ? clamp((value / max) * 100, 0, 100) : 0;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px] font-black text-slate-600">
        <span>{label}</span>
        <span className={danger ? "text-amber-800" : "text-slate-950"}>{value}/{max}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${danger ? "bg-amber-500" : "bg-emerald-600"}`} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function ColumnHelpPanel() {
  const rows = [
    ["REG", "Counts in the registration list."],
    ["Club", "Club-trained eligibility; senior players can fill reserved slots."],
    ["Italy", "Italy-trained/homegrown eligibility; includes club-trained players."],
    ["Non-EU", "Non-EU/EEA player flag."],
    ["Abroad", "Arrived from abroad this window."],
    ["Review", "Needs manual eligibility check."],
  ];

  return (
    <SidePanel title="Column Help" eyebrow="Sheet keys">
      <div className="divide-y divide-slate-100 p-3 text-xs">
        {rows.map(([label, description]) => (
          <div key={label} className="grid grid-cols-[58px_minmax(0,1fr)] gap-2 py-2 first:pt-0 last:pb-0">
            <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-center font-black text-slate-700">{label}</span>
            <span className="font-semibold leading-5 text-slate-600">{description}</span>
          </div>
        ))}
      </div>
    </SidePanel>
  );
}

function CheckboxCell({ checked, onChange, title }: { checked: boolean; onChange: (checked: boolean) => void; title?: string }) {
  return <input title={title} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300" />;
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

function getPlayerInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function isBrowserStorageAvailable() {
  try {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

function loadSavedWorkbook(): SavedWorkbook | null {
  if (!isBrowserStorageAvailable()) return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<SavedWorkbook>;
    if (parsed.version !== 2 || !Array.isArray(parsed.clubs) || parsed.clubs.length === 0 || !parsed.lineups || !parsed.selectedSlug) return null;

    return {
      version: 2,
      clubs: parsed.clubs,
      lineups: parsed.lineups,
      selectedSlug: parsed.selectedSlug,
    };
  } catch {
    return null;
  }
}

function saveWorkbook(workbook: SavedWorkbook) {
  if (!isBrowserStorageAvailable()) return false;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workbook));
    return true;
  } catch {
    return false;
  }
}

function clearSavedWorkbook() {
  if (!isBrowserStorageAvailable()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}

function slugifyFileName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "squad";
}

function escapeCsvCell(value: string | number | boolean | undefined) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function escapeHtml(value: string | number | boolean | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeXml(value: string | number | boolean | undefined) {
  return escapeHtml(value).replace(/'/g, "&apos;");
}

function downloadTextFile(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getExportRows(players: Player[]) {
  return players.map((player) => {
    const category = [getCategory(player).label, ...getSupplementalCategories(player)].join(" + ");
    return [
      player.status === "registered" ? "REG" : "OUT",
      player.name,
      player.position,
      player.dateOfBirth,
      getAge(player.dateOfBirth),
      player.nationality,
      player.isClubTrained ? "Yes" : "No",
      player.isItalyTrained ? "Yes" : "No",
      player.isNonEuOrEea ? "Yes" : "No",
      player.fromAbroadThisWindow ? "Yes" : "No",
      player.needsReview ? "Yes" : "No",
      category,
      player.sourceClub,
    ];
  });
}

function exportSquadCsv(club: Club) {
  const headers = ["Status", "Player", "Pos", "DOB", "Age", "Nationality", "Club-trained", "Italy-trained", "Non-EU", "From abroad", "Review", "Category", "Source"];
  const rows = [headers, ...getExportRows(club.players)];
  const csv = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
  downloadTextFile(`${slugifyFileName(club.name)}-squad.csv`, csv, "text/csv;charset=utf-8");
}

function exportSquadExcel(club: Club) {
  const headers = ["Status", "Player", "Pos", "DOB", "Age", "Nationality", "Club-trained", "Italy-trained", "Non-EU", "From abroad", "Review", "Category", "Source"];
  const rows = getExportRows(club.players);
  const tableRows = [
    `<tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>`,
    ...rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`),
  ].join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>table{border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px}th,td{border:1px solid #94a3b8;padding:5px 8px}th{background:#e2e8f0}</style></head><body><table>${tableRows}</table></body></html>`;
  downloadTextFile(`${slugifyFileName(club.name)}-squad.xls`, html, "application/vnd.ms-excel;charset=utf-8");
}

function exportWorkbookJson(workbook: SavedWorkbook) {
  downloadTextFile(
    `serie-a-registration-workbook-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify({ ...workbook, exportedAt: new Date().toISOString() }, null, 2),
    "application/json;charset=utf-8"
  );
}

function isValidSavedWorkbook(value: unknown): value is SavedWorkbook {
  if (!value || typeof value !== "object") return false;
  const workbook = value as Partial<SavedWorkbook>;
  return (
    workbook.version === 2 &&
    Array.isArray(workbook.clubs) &&
    workbook.clubs.length > 0 &&
    typeof workbook.selectedSlug === "string" &&
    typeof workbook.lineups === "object" &&
    workbook.lineups !== null
  );
}

function getCategorySvgColors(category: Category) {
  if (category === "Club") return { fill: "#e0f2fe", stroke: "#0284c7", text: "#0c4a6e" };
  if (category === "Italy") return { fill: "#eef2ff", stroke: "#4f46e5", text: "#312e81" };
  if (category === "U23") return { fill: "#dcfce7", stroke: "#16a34a", text: "#14532d" };
  if (category === "Review") return { fill: "#fef3c7", stroke: "#d97706", text: "#78350f" };
  return { fill: "#f8fafc", stroke: "#64748b", text: "#1e293b" };
}

function exportLineupSvg(club: Club, lineupPlayers: LineupPlayer[]) {
  const width = 900;
  const height = 1200;
  const playerCards = lineupPlayers.map(({ player, placement }) => {
    const category = getCategory(player).label;
    const colors = getCategorySvgColors(category);
    const cardWidth = 178;
    const cardHeight = 54;
    const x = clamp((placement.x / 100) * width - cardWidth / 2, 24, width - cardWidth - 24);
    const y = clamp((placement.y / 100) * height - cardHeight / 2, 24, height - cardHeight - 24);
    return `
      <g>
        <rect x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="12" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="3"/>
        <text x="${x + cardWidth / 2}" y="${y + 23}" text-anchor="middle" font-family="Arial, sans-serif" font-size="17" font-weight="700" fill="${colors.text}">${escapeXml(player.name)}</text>
        <text x="${x + cardWidth / 2}" y="${y + 42}" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="700" fill="${colors.text}" opacity="0.72">${player.position} - ${category}</text>
      </g>`;
  }).join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="grass" x1="0" x2="1">
        <stop offset="0" stop-color="#047857"/>
        <stop offset="1" stop-color="#065f46"/>
      </linearGradient>
      <pattern id="stripes" width="180" height="1200" patternUnits="userSpaceOnUse">
        <rect width="90" height="1200" fill="#ffffff" fill-opacity="0.08"/>
      </pattern>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#grass)"/>
    <rect width="${width}" height="${height}" fill="url(#stripes)"/>
    <rect x="40" y="40" width="${width - 80}" height="${height - 80}" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="5"/>
    <line x1="40" y1="${height / 2}" x2="${width - 40}" y2="${height / 2}" stroke="#ffffff" stroke-opacity="0.35" stroke-width="4"/>
    <circle cx="${width / 2}" cy="${height / 2}" r="100" fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="4"/>
    <rect x="${width / 2 - 150}" y="40" width="300" height="170" fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="4"/>
    <rect x="${width / 2 - 150}" y="${height - 210}" width="300" height="170" fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="4"/>
    <text x="52" y="92" font-family="Arial, sans-serif" font-size="30" font-weight="800" fill="#ffffff" fill-opacity="0.78">${escapeXml(club.name)}</text>
    ${playerCards}
  </svg>`;

  downloadTextFile(`${slugifyFileName(club.name)}-lineup.svg`, svg, "image/svg+xml;charset=utf-8");
}

function isWorkbookAddition(player: Player, club: Club) {
  return player.sourceClub !== club.name && player.sourceClub !== "Current squad";
}

function getPlayerRowClass(player: Player, index: number) {
  if (isIncompleteRegistered(player)) return "bg-red-50";
  if (player.needsReview) return "bg-amber-50";
  if (player.status === "not_registered") return "bg-slate-100 text-slate-500";
  return index % 2 === 0 ? "bg-white" : "bg-slate-50";
}

function getSortValue(player: Player, sortKey: SortKey) {
  if (sortKey === "status") return player.status;
  if (sortKey === "name") return player.name.toLowerCase();
  if (sortKey === "position") return POSITION_ORDER[player.position];
  if (sortKey === "dateOfBirth") return player.dateOfBirth || "9999-99-99";
  if (sortKey === "age") return Number(getAge(player.dateOfBirth)) || 999;
  if (sortKey === "nationality") return player.nationality.toLowerCase();
  if (sortKey === "category") return getCategory(player).label;
  return player.sourceClub.toLowerCase();
}

function sortPlayers(players: Player[], sortKey: SortKey, direction: SortDirection) {
  return [...players].sort((a, b) => {
    const aValue = getSortValue(a, sortKey);
    const bValue = getSortValue(b, sortKey);
    const result = typeof aValue === "number" && typeof bValue === "number"
      ? aValue - bValue
      : String(aValue).localeCompare(String(bValue));

    if (result !== 0) return direction === "asc" ? result : -result;
    return a.name.localeCompare(b.name);
  });
}

function getPositionCounts(players: Player[]) {
  return players.reduce<Record<Position, number>>((counts, player) => {
    counts[player.position] += 1;
    return counts;
  }, { GK: 0, DF: 0, MF: 0, FW: 0 });
}

function getAverageAge(players: Player[]) {
  const ages = players.map((player) => Number(getAge(player.dateOfBirth))).filter((age) => Number.isFinite(age));
  if (ages.length === 0) return "-";
  return (ages.reduce((total, age) => total + age, 0) / ages.length).toFixed(1);
}

function getDuplicateNames(players: Player[]) {
  const counts = new Map<string, number>();
  players.forEach((player) => {
    const name = player.name.trim().toLowerCase();
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  });

  return Array.from(counts.entries()).filter(([, count]) => count > 1).length;
}

export default function App() {
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const [initialWorkbook] = useState(() => loadSavedWorkbook());
  const [clubs, setClubs] = useState<Club[]>(() => initialWorkbook?.clubs ?? buildClubs());
  const [selectedSlug, setSelectedSlug] = useState(() => initialWorkbook?.selectedSlug ?? "inter");
  const [activeTab, setActiveTab] = useState<ActiveTab>("sheet");
  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState<"All" | Position>("All");
  const [categoryFilter, setCategoryFilter] = useState<"All" | Category>("All");
  const [quickView, setQuickView] = useState<QuickView>("all");
  const [sortKey, setSortKey] = useState<SortKey>("position");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [transferSearch, setTransferSearch] = useState("");
  const [transferLeagueFilter, setTransferLeagueFilter] = useState<TransferLeagueFilter>("All");
  const [lineups, setLineups] = useState<Record<string, Record<string, LineupPlacement>>>(() => initialWorkbook?.lineups ?? {});
  const [draggingPlayerId, setDraggingPlayerId] = useState<string | null>(null);
  const [isTransferPanelOpen, setIsTransferPanelOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState(() => (initialWorkbook ? "Restored saved workbook" : "Autosave ready"));
  const [lineupSearch, setLineupSearch] = useState("");
  const [benchPositionFilter, setBenchPositionFilter] = useState<"All" | Position>("All");

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
    const rows = selectedClub.players.filter((player) => {
      const category = getCategory(player).label;
      const supplementalCategories = getSupplementalCategories(player);
      const categoryText = [category, ...supplementalCategories].join(" ");
      const matchesText = !q || `${player.name} ${player.nationality} ${player.position} ${categoryText} ${player.sourceClub}`.toLowerCase().includes(q);
      const matchesPosition = positionFilter === "All" || player.position === positionFilter;
      const matchesCategory = categoryFilter === "All" || category === categoryFilter || supplementalCategories.includes(categoryFilter);
      const matchesQuickView =
        quickView === "all" ||
        (quickView === "registered" && player.status === "registered") ||
        (quickView === "issues" && (player.needsReview || isIncompleteRegistered(player))) ||
        (quickView === "additions" && isWorkbookAddition(player, selectedClub));
      return matchesText && matchesPosition && matchesCategory && matchesQuickView;
    });

    return sortPlayers(rows, sortKey, sortDirection);
  }, [selectedClub, search, positionFilter, categoryFilter, quickView, sortKey, sortDirection]);

  const selectedPlayers = useMemo(() => selectedClub.players.filter((player) => selectedPlayerIds.includes(player.id)), [selectedClub.players, selectedPlayerIds]);
  const allFilteredSelected = filteredPlayers.length > 0 && filteredPlayers.every((player) => selectedPlayerIds.includes(player.id));
  const squadPositionCounts = useMemo(() => getPositionCounts(selectedClub.players.filter((player) => player.status === "registered")), [selectedClub.players]);
  const averageAge = useMemo(() => getAverageAge(selectedClub.players.filter((player) => player.status === "registered")), [selectedClub.players]);
  const duplicateNameCount = useMemo(() => getDuplicateNames(selectedClub.players), [selectedClub.players]);

  const visibleBenchPlayers = useMemo(() => {
    const q = lineupSearch.trim().toLowerCase();
    return availableLineupPlayers.filter((player) => {
      const category = getCategory(player).label;
      const matchesText = !q || `${player.name} ${player.position} ${player.nationality} ${category}`.toLowerCase().includes(q);
      const matchesPosition = benchPositionFilter === "All" || player.position === benchPositionFilter;
      return matchesText && matchesPosition;
    });
  }, [availableLineupPlayers, lineupSearch, benchPositionFilter]);

  const filteredTransfers = useMemo(() => {
    const q = transferSearch.trim().toLowerCase();
    const currentSheetKeys = new Set(selectedClub.players.map((player) => `${player.name.trim().toLowerCase()}|${player.dateOfBirth}`));

    return TRANSFER_POOL
      .filter((player) => !currentSheetKeys.has(`${player.name.trim().toLowerCase()}|${player.dateOfBirth}`))
      .filter((player) => transferLeagueFilter === "All" || player.sourceLeague === transferLeagueFilter)
      .filter((player) => !q || `${player.name} ${player.sourceClub} ${player.sourceLeague ?? ""} ${player.nationality} ${player.position}`.toLowerCase().includes(q));
  }, [transferSearch, transferLeagueFilter, selectedClub.players]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const saved = saveWorkbook({ version: 2, clubs, lineups, selectedSlug });
      setSaveStatus(saved ? `Autosaved ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Autosave unavailable");
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [clubs, lineups, selectedSlug]);

  useEffect(() => {
    if (!isTransferPanelOpen) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsTransferPanelOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isTransferPanelOpen]);

  useEffect(() => {
    setSelectedPlayerIds((current) => current.filter((id) => selectedClub.players.some((player) => player.id === id)));
  }, [selectedClub.players]);

  function toggleSort(nextSortKey: SortKey) {
    if (sortKey === nextSortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextSortKey);
    setSortDirection("asc");
  }

  function togglePlayerSelection(playerId: string) {
    setSelectedPlayerIds((current) => current.includes(playerId) ? current.filter((id) => id !== playerId) : [...current, playerId]);
  }

  function toggleFilteredSelection() {
    setSelectedPlayerIds((current) => {
      if (allFilteredSelected) {
        const filteredIds = new Set(filteredPlayers.map((player) => player.id));
        return current.filter((id) => !filteredIds.has(id));
      }

      return Array.from(new Set([...current, ...filteredPlayers.map((player) => player.id)]));
    });
  }

  function bulkPatchSelected(patch: Partial<Player>) {
    const selectedIds = new Set(selectedPlayerIds);
    updateSelectedPlayers((players) => players.map((player) => selectedIds.has(player.id) ? { ...player, ...patch } : player));

    if (patch.status === "not_registered") {
      selectedPlayerIds.forEach(removeFromLineup);
    }
  }

  function deleteSelectedPlayers() {
    if (selectedPlayerIds.length === 0) return;
    if (typeof window !== "undefined" && !window.confirm(`Delete ${selectedPlayerIds.length} selected player rows?`)) return;

    const selectedIds = new Set(selectedPlayerIds);
    updateSelectedPlayers((players) => players.filter((player) => !selectedIds.has(player.id)));
    selectedPlayerIds.forEach(removeFromLineup);
    setSelectedPlayerIds([]);
  }

  function clearFilters() {
    setSearch("");
    setPositionFilter("All");
    setCategoryFilter("All");
    setQuickView("all");
  }

  async function importWorkbookFile(file: File) {
    try {
      const parsed = JSON.parse(await file.text());
      if (!isValidSavedWorkbook(parsed)) {
        window.alert("This file is not a valid Serie A Registration Workbook backup.");
        return;
      }

      setClubs(parsed.clubs);
      setLineups(parsed.lineups);
      setSelectedSlug(parsed.clubs.some((club) => club.slug === parsed.selectedSlug) ? parsed.selectedSlug : parsed.clubs[0].slug);
      setSelectedPlayerIds([]);
      setSearch("");
      setPositionFilter("All");
      setCategoryFilter("All");
      setQuickView("all");
      setSaveStatus("Imported workbook backup");
    } catch {
      window.alert("Could not read that backup file.");
    } finally {
      if (importFileInputRef.current) importFileInputRef.current.value = "";
    }
  }

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
    const defaultPosition: Position = positionFilter === "All" ? "MF" : positionFilter;

    setSearch("");
    setCategoryFilter("All");
    setQuickView("all");

    updateSelectedPlayers((players) => [...players, createManualPlayer(selectedClub.slug, defaultPosition)]);
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

  function resetWorkbook() {
    if (typeof window !== "undefined" && !window.confirm("Reset all saved edits and return every club to the original imported workbook?")) return;

    setClubs(buildClubs());
    setSelectedSlug("inter");
    setSearch("");
    setPositionFilter("All");
    setCategoryFilter("All");
    setTransferSearch("");
    setTransferLeagueFilter("All");
    setLineups({});
    setIsTransferPanelOpen(false);
    clearSavedWorkbook();
    setSaveStatus("Reset to original data");
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
              <div className="text-[11px] text-white/75">Excel-style squad planning · {TRANSFER_POOL.length.toLocaleString()} players · {DATA_LEAGUES.length} leagues</div>
            </div>
          </div>
          <div className="hidden text-right text-xs font-bold text-white/80 sm:block">
            <div>Summer Window · 2026/27</div>
            <div className="text-[10px] text-white/65">{saveStatus}</div>
          </div>
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
            <div>
              <label className="mb-1 block text-[11px] font-black uppercase tracking-wide text-slate-500">Quick view</label>
              <div className="flex h-9 border border-slate-300 bg-white">
                {QUICK_VIEWS.map((view) => (
                  <button
                    key={view.value}
                    type="button"
                    onClick={() => setQuickView(view.value)}
                    className={`border-r border-slate-300 px-2.5 text-xs font-black last:border-r-0 ${quickView === view.value ? "bg-green-700 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                  >
                    {view.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-2 lg:ml-auto">
              <button type="button" onClick={() => setIsTransferPanelOpen(true)} className="h-9 border border-green-700 bg-green-700 px-3 text-xs font-black text-white hover:bg-green-800">Player pool</button>
              <button type="button" onClick={() => exportSquadCsv(selectedClub)} className="h-9 border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50">CSV</button>
              <button type="button" onClick={() => exportSquadExcel(selectedClub)} className="h-9 border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50">Excel</button>
              <button type="button" onClick={() => exportWorkbookJson({ version: 2, clubs, lineups, selectedSlug })} className="h-9 border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50">Backup</button>
              <button type="button" onClick={() => importFileInputRef.current?.click()} className="h-9 border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50">Import</button>
              <button type="button" onClick={resetWorkbook} className="h-9 border border-red-200 bg-red-50 px-3 text-xs font-black text-red-700 hover:bg-red-100">Reset</button>
            </div>
          </div>
          <input
            ref={importFileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importWorkbookFile(file);
            }}
          />

          <div className="flex border-b border-slate-300 bg-white">
            <button onClick={() => setActiveTab("sheet")} className={`border-r border-slate-300 px-5 py-2 text-sm font-black ${activeTab === "sheet" ? "bg-white text-green-800" : "bg-slate-100 text-slate-500 hover:bg-slate-50"}`}>Sheet</button>
            <button onClick={() => setActiveTab("lineup")} className={`border-r border-slate-300 px-5 py-2 text-sm font-black ${activeTab === "lineup" ? "bg-white text-green-800" : "bg-slate-100 text-slate-500 hover:bg-slate-50"}`}>Lineup Board</button>
            <button onClick={() => setActiveTab("overview")} className={`border-r border-slate-300 px-5 py-2 text-sm font-black ${activeTab === "overview" ? "bg-white text-green-800" : "bg-slate-100 text-slate-500 hover:bg-slate-50"}`}>League Overview</button>
          </div>

          <div className="grid grid-cols-2 border-b border-slate-300 md:grid-cols-4 xl:grid-cols-8">
            <Metric label="Club" value={selectedClub.shortName} />
            <Metric label="Rows" value={`${filteredPlayers.length}`} />
            <Metric label="Registered" value={`${validation.counts.registered}`} progress={(validation.counts.registered / 25) * 100} />
            <Metric label="Senior" value={`${validation.counts.senior}/${validation.counts.seniorCapacity}`} danger={validation.counts.senior > validation.counts.seniorCapacity} progress={(validation.counts.senior / validation.counts.seniorCapacity) * 100} />
            <Metric label="U23" value={`${validation.counts.u23}`} />
            <Metric label="Non-HG" value={`${validation.counts.nonHomegrown}/17`} danger={validation.counts.nonHomegrown > 17} progress={(validation.counts.nonHomegrown / 17) * 100} />
            <Metric label="Senior Club" value={`${validation.counts.clubTrained} C`} />
            <Metric label="Senior Local" value={`${validation.counts.italyTrained} HG`} />
          </div>
        </section>

        {activeTab === "sheet" ? (
          <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="overflow-hidden border border-slate-300 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-300 bg-slate-100 px-3 py-2">
                <div className="text-sm font-black">{selectedClub.name} Squad Table</div>
                <StatusCell ok={validation.ok} />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2 text-xs">
                <div className="font-bold text-slate-600">
                  {filteredPlayers.length} visible · {selectedPlayerIds.length} selected · sorted by {sortKey} {sortDirection}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={clearFilters} className="border border-slate-300 bg-white px-2 py-1 font-black text-slate-700 hover:bg-slate-50">Clear filters</button>
                  <button type="button" onClick={() => bulkPatchSelected({ status: "registered" })} disabled={selectedPlayerIds.length === 0} className="border border-emerald-200 bg-emerald-50 px-2 py-1 font-black text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40">Mark REG</button>
                  <button type="button" onClick={() => bulkPatchSelected({ status: "not_registered" })} disabled={selectedPlayerIds.length === 0} className="border border-slate-300 bg-slate-50 px-2 py-1 font-black text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40">Mark OUT</button>
                  <button type="button" onClick={() => bulkPatchSelected({ needsReview: false })} disabled={selectedPlayerIds.length === 0} className="border border-amber-200 bg-amber-50 px-2 py-1 font-black text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40">Clear review</button>
                  <button type="button" onClick={deleteSelectedPlayers} disabled={selectedPlayerIds.length === 0} className="border border-red-200 bg-red-50 px-2 py-1 font-black text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40">Delete selected</button>
                </div>
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px]">
                  <label className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-2 py-1 font-black text-slate-700">
                    <input title="Select all visible rows" type="checkbox" checked={allFilteredSelected} onChange={toggleFilteredSelection} className="h-4 w-4 cursor-pointer rounded border-slate-300" />
                    Select visible
                  </label>
                  <span className="font-black uppercase tracking-wide text-slate-400">Sort</span>
                  {[
                    { value: "status" as SortKey, label: "REG" },
                    { value: "name" as SortKey, label: "Player" },
                    { value: "position" as SortKey, label: "Pos" },
                    { value: "dateOfBirth" as SortKey, label: "DOB" },
                    { value: "age" as SortKey, label: "Age" },
                    { value: "nationality" as SortKey, label: "Nation" },
                    { value: "category" as SortKey, label: "Category" },
                    { value: "sourceClub" as SortKey, label: "Source" },
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => toggleSort(item.value)}
                      className={`rounded-full border px-2.5 py-1 font-black ${sortKey === item.value ? "border-green-700 bg-green-700 text-white" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"}`}
                    >
                      {item.label} {sortKey === item.value ? (sortDirection === "asc" ? "▲" : "▼") : ""}
                    </button>
                  ))}
                </div>

                <table className="w-full table-fixed border-collapse text-[11px]">
                  <colgroup>
                    <col className="w-[4.2%]" />
                    <col className="w-[6.5%]" />
                    <col className="w-[19%]" />
                    <col className="w-[5.4%]" />
                    <col className="w-[10.8%]" />
                    <col className="w-[4.2%]" />
                    <col className="w-[10.2%]" />
                    <col className="w-[15.7%]" />
                    <col className="w-[8.2%]" />
                    <col className="w-[10.6%]" />
                    <col className="w-[5.2%]" />
                  </colgroup>
                  <thead className="bg-slate-200 text-[10px] font-black uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="border border-slate-300 px-1 py-1 text-center">#</th>
                      <th className="border border-slate-300 px-1 py-1">REG</th>
                      <th className="border border-slate-300 px-1 py-1 text-left">Player</th>
                      <th className="border border-slate-300 px-1 py-1">Pos</th>
                      <th className="border border-slate-300 px-1 py-1">DOB</th>
                      <th className="border border-slate-300 px-1 py-1">Age</th>
                      <th className="border border-slate-300 px-1 py-1 text-left">Nation</th>
                      <th className="border border-slate-300 px-1 py-1">Flags</th>
                      <th className="border border-slate-300 px-1 py-1">Cat</th>
                      <th className="border border-slate-300 px-1 py-1 text-left">Source</th>
                      <th className="border border-slate-300 px-1 py-1">Del</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPlayers.map((player, index) => {
                      const category = getCategory(player);
                      const supplementalCategories = getSupplementalCategories(player);
                      const addition = isWorkbookAddition(player, selectedClub);
                      const isSelected = selectedPlayerIds.includes(player.id);

                      return (
                        <tr key={player.id} className={`${getPlayerRowClass(player, index)} ${isSelected ? "outline outline-2 outline-green-600 outline-offset-[-2px]" : ""}`}>
                          <td className="border border-slate-200 px-1 py-0.5 text-center align-middle font-bold text-slate-500">
                            <label className="flex items-center justify-center gap-1">
                              <input title={`Select ${player.name || "row"}`} type="checkbox" checked={isSelected} onChange={() => togglePlayerSelection(player.id)} className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300" />
                              <span>{index + 1}</span>
                            </label>
                          </td>
                          <td className="border border-slate-200 px-1 py-0.5 text-center align-middle">
                            <RegistrationToggle value={player.status} onChange={(nextStatus) => updatePlayer(player.id, { status: nextStatus })} />
                          </td>
                          <td className="border border-slate-200 px-1 py-0.5 align-middle">
                            <div className="flex items-center gap-1">
                              <input value={player.name} onChange={(event) => updatePlayer(player.id, { name: event.target.value })} placeholder="Player name" className="min-w-0 flex-1 border border-transparent bg-transparent px-1 py-0.5 font-bold outline-none placeholder:text-slate-400 focus:border-green-700 focus:bg-white" />
                              {addition && <span className="shrink-0 rounded border border-cyan-200 bg-cyan-50 px-1 text-[9px] font-black text-cyan-700">{player.sourceClub === "Manual" ? "M" : "+"}</span>}
                            </div>
                          </td>
                          <td className="border border-slate-200 px-1 py-0.5 text-center align-middle">
                            <select value={player.position} onChange={(event) => updatePlayer(player.id, { position: event.target.value as Position })} className="w-full border border-transparent bg-transparent px-0.5 py-0.5 text-center font-black outline-none focus:border-green-700 focus:bg-white">
                              <option value="GK">GK</option>
                              <option value="DF">DF</option>
                              <option value="MF">MF</option>
                              <option value="FW">FW</option>
                            </select>
                          </td>
                          <td className="border border-slate-200 px-1 py-0.5 align-middle">
                            <input type="date" value={player.dateOfBirth} onChange={(event) => updatePlayer(player.id, { dateOfBirth: event.target.value })} title="Date of birth" className="w-full border border-transparent bg-transparent px-1 py-0.5 outline-none focus:border-green-700 focus:bg-white" />
                          </td>
                          <td className="border border-slate-200 px-1 py-0.5 text-center align-middle font-black">{getAge(player.dateOfBirth)}</td>
                          <td className="border border-slate-200 px-1 py-0.5 align-middle">
                            <input value={player.nationality} onChange={(event) => updatePlayer(player.id, { nationality: event.target.value })} placeholder="Nationality" className="w-full border border-transparent bg-transparent px-1 py-0.5 outline-none placeholder:text-slate-400 focus:border-green-700 focus:bg-white" />
                          </td>
                          <td className="border border-slate-200 px-1 py-0.5 align-middle">
                            <div className="grid grid-cols-5 gap-0.5 text-center text-[8px] font-black text-slate-500">
                              <label title="Club-trained" className="cursor-pointer">C<CheckboxCell checked={player.isClubTrained} onChange={(checked) => updatePlayer(player.id, { isClubTrained: checked, isItalyTrained: checked ? true : player.isItalyTrained })} /></label>
                              <label title="Italy-trained/homegrown" className="cursor-pointer">I<CheckboxCell checked={player.isItalyTrained} onChange={(checked) => updatePlayer(player.id, { isItalyTrained: checked })} /></label>
                              <label title="Non-EU/EEA player" className="cursor-pointer">EU<CheckboxCell checked={player.isNonEuOrEea} onChange={(checked) => updatePlayer(player.id, { isNonEuOrEea: checked })} /></label>
                              <label title="Arrived from abroad" className="cursor-pointer">A<CheckboxCell checked={player.fromAbroadThisWindow} onChange={(checked) => updatePlayer(player.id, { fromAbroadThisWindow: checked })} /></label>
                              <label title="Needs review" className="cursor-pointer">R<CheckboxCell checked={Boolean(player.needsReview)} onChange={(checked) => updatePlayer(player.id, { needsReview: checked })} /></label>
                            </div>
                          </td>
                          <td className="border border-slate-200 px-1 py-0.5 text-center align-middle">
                            <div className="flex flex-wrap justify-center gap-1">
                              <Badge className={category.className}>{category.label}</Badge>
                              {supplementalCategories.map((label) => {
                                const supplementalCategory = getCategoryStyle(label);
                                return <Badge key={label} className={supplementalCategory.className}>{label}</Badge>;
                              })}
                            </div>
                          </td>
                          <td className="truncate border border-slate-200 px-1 py-0.5 align-middle text-[10px] font-bold text-slate-500" title={player.sourceClub}>{player.sourceClub}</td>
                          <td className="border border-slate-200 px-1 py-0.5 text-center align-middle">
                            <button onClick={() => removePlayer(player.id)} className="rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-black text-red-700 hover:bg-red-100">Del</button>
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-white">
                      <td className="border border-slate-200 px-1 py-1 text-center text-xs font-bold text-slate-400">+</td>
                      <td colSpan={10} className="border border-slate-200 p-0">
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

            <aside className="space-y-3 xl:sticky xl:top-28">
              <ColumnHelpPanel />
              <SquadInsightPanel
                validation={validation}
                positionCounts={squadPositionCounts}
                averageAge={averageAge}
                duplicateNameCount={duplicateNameCount}
              />
              <RulesPanel validation={validation} />
              <SidePanel title="Player Pool" eyebrow="Additions">
                <div className="space-y-3 p-3 text-xs text-slate-600">
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 font-semibold leading-5 text-emerald-950">
                    Search the bundled database, add a player to this sheet, then review the eligibility flags.
                  </div>
                  <button type="button" onClick={() => setIsTransferPanelOpen(true)} className="h-10 w-full rounded-md border border-green-700 bg-green-700 px-3 text-xs font-black text-white shadow-sm hover:bg-green-800">
                    Open player pool
                  </button>
                </div>
              </SidePanel>
            </aside>
          </section>
        ) : activeTab === "lineup" ? (
          <section className="grid gap-3">
            <section className="border border-slate-300 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 bg-slate-100 px-3 py-2">
                <div>
                  <div className="text-sm font-black">Lineup Board</div>
                  <div className="text-xs font-semibold text-slate-500">Drag players freely onto the pitch. Drop a player back on the subs panel to remove him.</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => exportLineupSvg(selectedClub, placedPlayers)} className="border border-slate-300 bg-white px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-50">Export SVG</button>
                  <button type="button" onClick={resetLineup} className="border border-slate-300 bg-white px-3 py-1.5 text-xs font-black hover:bg-slate-50">Reset board</button>
                </div>
              </div>

              <div className="grid gap-3 bg-slate-50 p-3 xl:grid-cols-[minmax(360px,620px)_minmax(280px,1fr)] xl:items-start">
                <div
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handlePitchDrop}
                  className="lineup-pitch relative aspect-[3/4] w-full max-w-[620px] overflow-hidden bg-emerald-700"
                >
                <div className="absolute inset-5 border-2 border-white/35 shadow-[inset_0_0_60px_rgba(0,0,0,0.18)]" />
                <div className="absolute left-5 right-5 top-1/2 border-t-2 border-white/25" />
                <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/25 sm:h-32 sm:w-32" />
                <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/40" />
                <div className="absolute left-1/2 top-5 h-28 w-40 -translate-x-1/2 border-x-2 border-b-2 border-white/25 sm:h-32 sm:w-48" />
                <div className="absolute bottom-5 left-1/2 h-28 w-40 -translate-x-1/2 border-x-2 border-t-2 border-white/25 sm:h-32 sm:w-48" />
                <div className="absolute left-1/2 top-5 h-10 w-24 -translate-x-1/2 border-x-2 border-b-2 border-white/20" />
                <div className="absolute bottom-5 left-1/2 h-10 w-24 -translate-x-1/2 border-x-2 border-t-2 border-white/20" />
                <div className="absolute left-1/2 top-[17%] h-2 w-2 -translate-x-1/2 rounded-full bg-white/35" />
                <div className="absolute bottom-[17%] left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-white/35" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.10),transparent_42%)]" />

                {placedPlayers.length === 0 && (
                  <div className="absolute left-1/2 top-1/2 w-72 -translate-x-1/2 -translate-y-1/2 rounded bg-white/90 p-4 text-center text-sm font-bold text-slate-600 shadow">
                    Drag registered players from the bench to build a free lineup.
                  </div>
                )}

                {placedPlayers.map(({ player, placement }) => {
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
                      <div className="flex flex-col items-center gap-1">
                        <div className="grid h-12 w-12 place-items-center rounded-full border-2 border-white bg-slate-950/90 text-xs font-black text-white shadow-xl ring-2 ring-white/35">
                          {getPlayerInitials(player.name)}
                        </div>
                        <div className="max-w-28 truncate rounded-full bg-black/60 px-2 py-0.5 text-center text-[10px] font-black text-white shadow">
                          {player.name}
                        </div>
                      </div>
                      <button onClick={() => removeFromLineup(player.id)} className="mx-auto mt-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-[11px] font-black text-white hover:bg-black/80">x</button>
                    </div>
                  );
                })}
                </div>

              <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleBenchDrop}
                className="border border-slate-300 bg-white p-3 shadow-sm"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-black">Subs</div>
                    <div className="text-xs text-slate-500">Available registered players. Drop a player here to remove him from the board.</div>
                  </div>
                  <Badge className="border-slate-200 bg-slate-100 text-slate-700">{visibleBenchPlayers.length}/{availableLineupPlayers.length} available</Badge>
                </div>
                <div className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px]">
                  <input value={lineupSearch} onChange={(event) => setLineupSearch(event.target.value)} placeholder="Search bench..." className="h-9 border border-slate-300 px-2 text-sm outline-none focus:border-green-700" />
                  <select value={benchPositionFilter} onChange={(event) => setBenchPositionFilter(event.target.value as "All" | Position)} className="h-9 border border-slate-300 bg-white px-2 text-sm font-bold outline-none focus:border-green-700">
                    <option value="All">All pos</option>
                    <option value="GK">GK</option>
                    <option value="DF">DF</option>
                    <option value="MF">MF</option>
                    <option value="FW">FW</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
                  {visibleBenchPlayers.length === 0 ? (
                    <div className="border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">No matching bench players.</div>
                  ) : visibleBenchPlayers.map((player) => {
                    return (
                      <div
                        key={player.id}
                        draggable
                        onDragStart={(event) => {
                          setDraggingPlayerId(player.id);
                          event.dataTransfer.setData("text/plain", player.id);
                        }}
                        onDragEnd={() => setDraggingPlayerId(null)}
                        className="cursor-grab rounded border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-black shadow-sm active:cursor-grabbing"
                      >
                        <div className="flex items-center gap-2">
                          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-white bg-slate-900 text-[10px] text-white shadow">{getPlayerInitials(player.name)}</div>
                          <div className="min-w-0">
                            <div className="truncate">{player.name}</div>
                            <div className="text-[10px] text-slate-500">{player.position}</div>
                          </div>
                        </div>
                        <button onClick={() => addPlayerToBoard(player.id)} className="mt-1 block w-full rounded bg-white/70 px-2 py-0.5 text-[10px] font-black hover:bg-white">add</button>
                      </div>
                    );
                  })}
                </div>
              </div>
              </div>
            </section>
          </section>
        ) : (
          <LeagueOverview
            clubs={clubs}
            selectedSlug={selectedSlug}
            onOpenClub={(slug) => {
              setSelectedSlug(slug);
              setActiveTab("sheet");
            }}
          />
        )}
      </main>
      <TransferPanel
        isOpen={isTransferPanelOpen}
        onClose={() => setIsTransferPanelOpen(false)}
        transferSearch={transferSearch}
        setTransferSearch={setTransferSearch}
        transferLeagueFilter={transferLeagueFilter}
        setTransferLeagueFilter={setTransferLeagueFilter}
        filteredTransfers={filteredTransfers}
        totalPoolPlayers={TRANSFER_POOL.length}
        addTransfer={addTransfer}
      />
    </div>
  );
}

function RulesPanel({ validation }: { validation: ValidationResult }) {
  return (
    <SidePanel title="Rules / Checks" eyebrow="Validation">
      <div className="space-y-3 p-3 text-sm">
        <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 p-2">
          <div>
            <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">Sheet status</div>
            <div className="text-xs font-bold text-slate-600">Reserved slots lower capacity when unfilled.</div>
          </div>
          <StatusCell ok={validation.ok} />
        </div>

        <div className="space-y-2">
          <RailProgress label="Senior capacity" value={validation.counts.senior} max={validation.counts.seniorCapacity} danger={validation.counts.senior > validation.counts.seniorCapacity} />
          <RailProgress label="Non-HG senior slots" value={validation.counts.nonHomegrown} max={17} danger={validation.counts.nonHomegrown > 17} />
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <RailStat label="Senior C" value={`${validation.counts.clubTrained}`} />
          <RailStat label="Local HG" value={`${validation.counts.italyTrained}`} />
          <RailStat label="U23" value={`${validation.counts.u23}`} />
          <RailStat label="Review" value={`${validation.counts.review}`} tone={validation.counts.review > 0 ? "warn" : "good"} />
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-3 text-xs font-semibold leading-5 text-slate-600">
          <div><b>25</b> senior places only when every reserved slot is usable.</div>
          <div><b>17</b> non-homegrown/free senior places.</div>
          <div><b>C</b> and <b>I</b> can be shown on U23 players without filling senior slots.</div>
        </div>

        {(validation.errors.length > 0 || validation.warnings.length > 0) && (
          <div className="space-y-2">
            {validation.errors.map((error) => <div key={error} className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs font-bold text-amber-800">{error}</div>)}
            {validation.warnings.map((warning) => <div key={warning} className="rounded-md border border-slate-300 bg-slate-50 p-2 text-xs font-bold text-slate-700">{warning}</div>)}
          </div>
        )}
      </div>
    </SidePanel>
  );
}

function SquadInsightPanel({
  validation,
  positionCounts,
  averageAge,
  duplicateNameCount,
}: {
  validation: ValidationResult;
  positionCounts: Record<Position, number>;
  averageAge: string;
  duplicateNameCount: number;
}) {
  const seniorSlotsLeft = Math.max(0, validation.counts.seniorCapacity - validation.counts.senior);
  const nonHgSlotsLeft = Math.max(0, 17 - validation.counts.nonHomegrown);

  return (
    <SidePanel title="Squad Insight" eyebrow="Capacity">
      <div className="space-y-3 p-3">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <RailStat label="Avg age" value={averageAge} />
          <RailStat label="Room" value={`${seniorSlotsLeft}`} tone={validation.counts.senior > validation.counts.seniorCapacity ? "warn" : "good"} />
          <RailStat label="Non-HG left" value={`${nonHgSlotsLeft}`} tone={validation.counts.nonHomegrown > 17 ? "warn" : "neutral"} />
        </div>

        <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          <RailProgress label="Senior capacity" value={validation.counts.senior} max={validation.counts.seniorCapacity} danger={validation.counts.senior > validation.counts.seniorCapacity} />
          <RailProgress label="Non-HG usage" value={validation.counts.nonHomegrown} max={17} danger={validation.counts.nonHomegrown > 17} />
        </div>

      <div className="grid grid-cols-4 overflow-hidden rounded-md border border-slate-200 text-center text-xs font-black">
        {(["GK", "DF", "MF", "FW"] as Position[]).map((position) => (
          <div key={position} className="border-r border-slate-200 bg-white p-2 last:border-r-0">
            <div className="text-slate-400">{position}</div>
            <div className="text-slate-950">{positionCounts[position]}</div>
          </div>
        ))}
      </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <RailStat label="Senior C" value={`${validation.counts.clubTrained}`} />
          <RailStat label="Senior local" value={`${validation.counts.italyTrained}`} />
          <RailStat label="All C flags" value={`${validation.counts.clubTrainedTotal}`} />
          <RailStat label="All I flags" value={`${validation.counts.italyTrainedTotal}`} />
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-3 text-xs font-semibold leading-5 text-slate-600">
          Italy-only senior players: <b>{validation.counts.associationTrained}</b>. Non-HG senior slots left: <b>{nonHgSlotsLeft}</b>.
        </div>

        {validation.counts.unusedReservedSlots > 0 && (
          <div className="rounded-md border border-slate-300 bg-slate-50 p-2 text-xs font-bold text-slate-700">
            {validation.counts.unusedReservedSlots} reserved senior slot{validation.counts.unusedReservedSlots === 1 ? " is" : "s are"} unused. This lowers capacity; it is not a failed quota.
          </div>
        )}
        {(validation.counts.clubTrainedNonSenior > 0 || validation.counts.italyTrainedNonSenior > 0) && (
          <div className="rounded-md border border-slate-300 bg-slate-50 p-2 text-xs font-bold text-slate-700">
            Non-senior flags shown on the sheet: {validation.counts.clubTrainedNonSenior} C, {validation.counts.italyTrainedNonSenior} I.
          </div>
        )}
        {duplicateNameCount > 0 && <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs font-bold text-amber-800">{duplicateNameCount} duplicate player name group(s) found.</div>}
      </div>
    </SidePanel>
  );
}

function LeagueOverview({
  clubs,
  selectedSlug,
  onOpenClub,
}: {
  clubs: Club[];
  selectedSlug: string;
  onOpenClub: (slug: string) => void;
}) {
  const rows = clubs.map((club) => ({ club, validation: validateSerieAList(club.players) }));
  const okCount = rows.filter(({ validation }) => validation.ok).length;
  const issueCount = rows.length - okCount;

  return (
    <section className="border border-slate-300 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 bg-slate-100 px-3 py-3">
        <div>
          <div className="text-sm font-black">League Overview</div>
          <div className="text-xs font-semibold text-slate-500">Registration health across all 20 Serie A clubs.</div>
        </div>
        <div className="flex gap-2 text-xs font-black">
          <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">{okCount} OK</Badge>
          <Badge className="border-amber-200 bg-amber-50 text-amber-800">{issueCount} need work</Badge>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-xs">
          <thead className="bg-slate-200 text-[11px] font-black uppercase tracking-wide text-slate-600">
            <tr>
              <th className="border border-slate-300 px-2 py-2 text-left">Club</th>
              <th className="border border-slate-300 px-2 py-2">Status</th>
              <th className="border border-slate-300 px-2 py-2">Registered</th>
              <th className="border border-slate-300 px-2 py-2">Senior</th>
              <th className="border border-slate-300 px-2 py-2">U23</th>
              <th className="border border-slate-300 px-2 py-2">Non-HG</th>
              <th className="border border-slate-300 px-2 py-2">Senior C</th>
              <th className="border border-slate-300 px-2 py-2">Local</th>
              <th className="border border-slate-300 px-2 py-2">Review</th>
              <th className="border border-slate-300 px-2 py-2">Open</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ club, validation }, index) => (
              <tr key={club.slug} className={club.slug === selectedSlug ? "bg-green-50" : index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                <td className="border border-slate-200 px-3 py-2">
                  <div className="font-black text-slate-950">{club.name}</div>
                  <div className="text-[10px] font-bold text-slate-500">{club.city}</div>
                </td>
                <td className="border border-slate-200 px-2 py-2 text-center"><StatusCell ok={validation.ok} /></td>
                <td className="border border-slate-200 px-2 py-2 text-center font-bold">{validation.counts.registered}</td>
                <td className={`border border-slate-200 px-2 py-2 text-center font-bold ${validation.counts.senior > validation.counts.seniorCapacity ? "bg-amber-50 text-amber-800" : ""}`}>{validation.counts.senior}/{validation.counts.seniorCapacity}</td>
                <td className="border border-slate-200 px-2 py-2 text-center font-bold">{validation.counts.u23}</td>
                <td className={`border border-slate-200 px-2 py-2 text-center font-bold ${validation.counts.nonHomegrown > 17 ? "bg-amber-50 text-amber-800" : ""}`}>{validation.counts.nonHomegrown}/17</td>
                <td className="border border-slate-200 px-2 py-2 text-center font-bold">{validation.counts.clubTrained} C</td>
                <td className="border border-slate-200 px-2 py-2 text-center font-bold">{validation.counts.italyTrained} HG</td>
                <td className="border border-slate-200 px-2 py-2 text-center font-bold">{validation.counts.review}</td>
                <td className="border border-slate-200 px-2 py-2 text-center">
                  <button type="button" onClick={() => onOpenClub(club.slug)} className="border border-green-700 bg-green-700 px-3 py-1.5 text-xs font-black text-white hover:bg-green-800">Open</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TransferPanel({
  isOpen,
  onClose,
  transferSearch,
  setTransferSearch,
  transferLeagueFilter,
  setTransferLeagueFilter,
  filteredTransfers,
  totalPoolPlayers,
  addTransfer,
}: {
  isOpen: boolean;
  onClose: () => void;
  transferSearch: string;
  setTransferSearch: (value: string) => void;
  transferLeagueFilter: TransferLeagueFilter;
  setTransferLeagueFilter: (value: TransferLeagueFilter) => void;
  filteredTransfers: Player[];
  totalPoolPlayers: number;
  addTransfer: (player: Player) => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-slate-950/35">
      <button type="button" aria-label="Close player pool" onClick={onClose} className="absolute inset-0 cursor-default" />
      <section className="relative flex h-full w-full max-w-xl flex-col border-l border-slate-300 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-300 bg-slate-100 px-4 py-3">
          <div>
            <div className="text-sm font-black">Player pool / database · {totalPoolPlayers} players</div>
            <div className="text-xs font-semibold text-slate-500">{filteredTransfers.length} visible results</div>
          </div>
          <button type="button" onClick={onClose} className="border border-slate-300 bg-white px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-50">Close</button>
        </div>

        <div className="border-b border-slate-200 p-4">
          <div className="mb-2 text-xs font-semibold text-slate-500">Search here to add players that are not already in the current squad sheet.</div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_170px]">
            <input value={transferSearch} onChange={(event) => setTransferSearch(event.target.value)} placeholder="Search player, club, league, nationality..." className="h-10 w-full border border-slate-300 px-3 text-sm outline-none focus:border-green-700" autoFocus />
            <select value={transferLeagueFilter} onChange={(event) => setTransferLeagueFilter(event.target.value as TransferLeagueFilter)} className="h-10 border border-slate-300 bg-white px-2 text-sm font-bold outline-none focus:border-green-700">
              {TRANSFER_LEAGUES.map((league) => <option key={league} value={league}>{league}</option>)}
            </select>
          </div>
        </div>

        <div className="flex-1 space-y-2 overflow-auto p-4">
          {filteredTransfers.length === 0 ? (
            <div className="border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-bold text-slate-500">No matching players found.</div>
          ) : filteredTransfers.map((player) => {
            const category = getCategory(player);
            return (
              <div key={player.id} className="border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-black">{player.name}</div>
                    <div className="text-xs text-slate-500">{player.position} · {player.sourceClub} · {player.sourceLeague ?? "Unknown league"}</div>
                  </div>
                  <Badge className={category.className}>{category.label}</Badge>
                </div>
                <button onClick={() => addTransfer(player)} className="mt-2 w-full border border-green-700 bg-green-700 px-3 py-1.5 text-xs font-black text-white hover:bg-green-800">Add to sheet</button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
