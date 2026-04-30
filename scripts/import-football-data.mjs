import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const API_BASE = "https://api.football-data.org/v4";
const TOKEN = process.env.FOOTBALL_DATA_TOKEN;
const OUTPUT = resolve(process.env.PLAYER_DATA_OUTPUT ?? "src/data/big5-latest.json");
const REQUEST_DELAY_MS = Number(process.env.FOOTBALL_DATA_DELAY_MS ?? "6500");

const DEFAULT_TOP_20_COMPETITIONS = [
  { code: "PL", name: "Premier League" },
  { code: "PD", name: "LaLiga" },
  { code: "SA", name: "Serie A" },
  { code: "BL1", name: "Bundesliga" },
  { code: "FL1", name: "Ligue 1" },
  { code: "PPL", name: "Primeira Liga" },
  { code: "DED", name: "Eredivisie" },
  { code: "BSA", name: "Brazil Serie A" },
  { code: "ASL", name: "Liga Profesional" },
  { code: "MLS", name: "MLS" },
  { code: "BJL", name: "Jupiler Pro League" },
  { code: "TSL", name: "Turkish Super Lig" },
  { code: "SSL", name: "Swiss Super League" },
  { code: "ABL", name: "Austrian Bundesliga" },
  { code: "DSU", name: "Danish Superliga" },
  { code: "SPL", name: "Scottish Premiership" },
  { code: "JJL", name: "J. League" },
  { code: "LMX", name: "Liga MX" },
  { code: "GSL", name: "Greek Super League" },
  { code: "AAL", name: "A-League" },
];

function mapPosition(position) {
  const value = String(position ?? "").toLowerCase();
  if (value.includes("goal")) return "GK";
  if (value.includes("def")) return "DF";
  if (value.includes("mid")) return "MF";
  return "FW";
}

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseCompetitionInput() {
  const value = process.env.FOOTBALL_DATA_COMPETITIONS?.trim();
  if (!value) return DEFAULT_TOP_20_COMPETITIONS;
  if (value.toUpperCase() === "ALL") return "ALL";

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [code, label] = entry.split(":");
      return { code: code.trim().toUpperCase(), name: (label ?? code).trim() };
    });
}

async function fetchJson(path) {
  if (!TOKEN) {
    throw new Error("Missing FOOTBALL_DATA_TOKEN. Get an API token, then run with FOOTBALL_DATA_TOKEN=...");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "X-Auth-Token": TOKEN },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${path}`);
  }

  return response.json();
}

async function getCompetitions() {
  const requested = parseCompetitionInput();
  if (requested !== "ALL") return requested;

  console.log("Fetching Football-Data competition catalog...");
  const response = await fetchJson("/competitions");
  return (response.competitions ?? [])
    .filter((competition) => competition.type === "LEAGUE" && competition.code)
    .map((competition) => ({ code: competition.code, name: competition.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function main() {
  const competitions = await getCompetitions();
  const playersById = new Map();
  const warnings = [];

  for (const [index, competition] of competitions.entries()) {
    try {
      console.log(`Fetching teams for ${competition.name} (${competition.code})...`);
      const teamsResponse = await fetchJson(`/competitions/${competition.code}/teams`);
      const teams = teamsResponse.teams ?? [];

      for (const team of teams) {
        const squad = team.squad ?? [];
        for (const player of squad) {
          if (player.role && player.role !== "PLAYER") continue;
          if (!player.name) continue;

          const dateOfBirth = player.dateOfBirth ? String(player.dateOfBirth).slice(0, 10) : "";
          const catalogId = player.id
            ? `football-data-${player.id}`
            : `football-data-${competition.code}-${team.id ?? slugify(team.name)}-${slugify(player.name)}-${dateOfBirth}`;

          if (playersById.has(catalogId)) continue;

          playersById.set(catalogId, {
            catalogId,
            name: player.name,
            dateOfBirth,
            position: mapPosition(player.position),
            nationality: player.nationality ?? "Unknown",
            currentClub: team.name,
            currentLeague: competition.name,
            sourceClub: team.name,
            sourceLeague: competition.name,
            isClubTrained: false,
            isItalyTrained: false,
            isNonEuOrEea: false,
            fromAbroadThisWindow: competition.name !== "Serie A",
            needsEligibilityReview: true,
            needsDobReview: !dateOfBirth,
          });
        }
      }
    } catch (error) {
      warnings.push(`${competition.name}: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (REQUEST_DELAY_MS > 0 && index < competitions.length - 1) {
      await delay(REQUEST_DELAY_MS);
    }
  }

  const players = Array.from(playersById.values()).sort(
    (a, b) => a.currentLeague.localeCompare(b.currentLeague) || a.currentClub.localeCompare(b.currentClub) || a.name.localeCompare(b.name),
  );
  const playersByLeague = players.reduce((acc, player) => {
    acc[player.currentLeague] = (acc[player.currentLeague] ?? 0) + 1;
    return acc;
  }, {});

  const payload = {
    players,
    report: {
      source: "football-data.org",
      importedAt: new Date().toISOString(),
      playerCount: players.length,
      teamCount: new Set(players.map((player) => player.currentClub)).size,
      competitionCount: competitions.length,
      leagueCount: new Set(players.map((player) => player.currentLeague)).size,
      competitionCodes: competitions.map((competition) => competition.code),
      serieAPlayerCount: players.filter((player) => player.currentLeague === "Serie A").length,
      playersByLeague,
      warnings: [
        "Imported eligibility fields are defaulted and require manual review.",
        "Coverage depends on the competitions available to the configured Football-Data API plan.",
        "Set FOOTBALL_DATA_COMPETITIONS=ALL to try every league code exposed by the provider.",
        ...warnings,
      ],
    },
  };

  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Wrote ${players.length} players to ${OUTPUT}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
