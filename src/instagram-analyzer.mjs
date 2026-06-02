import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";

export class InstagramAnalysisError extends Error {
  constructor(message) {
    super(message);
    this.name = "InstagramAnalysisError";
  }
}

function fail(message) {
  throw new InstagramAnalysisError(message);
}

function cleanUsername(value) {
  if (typeof value !== "string") {
    return null;
  }

  const username = value.replace(/^@/, "").trim().toLowerCase();

  if (!username || !/^[a-z0-9._]+$/.test(username)) {
    return null;
  }

  return username;
}

export function normalizeUsername(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmedValue)) {
    try {
      const url = new URL(trimmedValue);
      const hostname = url.hostname.toLowerCase();

      if (
        hostname !== "instagram.com" &&
        hostname !== "www.instagram.com"
      ) {
        return null;
      }

      const parts = url.pathname
        .split("/")
        .map((part) => part.trim())
        .filter(Boolean);

      if (parts[0]?.toLowerCase() === "_u") {
        parts.shift();
      }

      return cleanUsername(parts[0]);
    } catch {
      return null;
    }
  }

  return cleanUsername(trimmedValue);
}

function getEntryName(entry) {
  return entry.entryName.replaceAll("\\", "/");
}

function readJsonEntry(entry) {
  try {
    return JSON.parse(entry.getData().toString("utf8"));
  } catch (error) {
    fail(`No se pudo leer ${getEntryName(entry)} como JSON: ${error.message}`);
  }
}

function getFollowersArray(json, filename) {
  if (Array.isArray(json)) {
    return json;
  }

  if (Array.isArray(json?.relationships_followers)) {
    return json.relationships_followers;
  }

  fail(`El formato de ${filename} no corresponde a una lista de seguidores.`);
}

function getFollowingArray(json, filename) {
  if (Array.isArray(json)) {
    return json;
  }

  if (Array.isArray(json?.relationships_following)) {
    return json.relationships_following;
  }

  fail(`El formato de ${filename} no corresponde a una lista de cuentas seguidas.`);
}

function usernameFromStringListData(entry) {
  if (!Array.isArray(entry?.string_list_data)) {
    return null;
  }

  for (const item of entry.string_list_data) {
    const username =
      normalizeUsername(item?.value) ??
      normalizeUsername(item?.href);

    if (username) {
      return username;
    }
  }

  return null;
}

function usernameFromFollowerEntry(entry) {
  return usernameFromStringListData(entry) ?? normalizeUsername(entry?.title);
}

function usernameFromFollowingEntry(entry) {
  return normalizeUsername(entry?.title) ?? usernameFromStringListData(entry);
}

function addUsernames(entries, target, extractor, sourceName, warnings) {
  entries.forEach((entry, index) => {
    const username = extractor(entry);

    if (username) {
      target.add(username);
      return;
    }

    warnings.push(
      `No se pudo identificar un usuario en ${sourceName}, registro ${index + 1}.`
    );
  });
}

function sortedDifference(left, right) {
  return [...left]
    .filter((username) => !right.has(username))
    .sort((a, b) => a.localeCompare(b));
}

function sortedIntersection(left, right) {
  return [...left]
    .filter((username) => right.has(username))
    .sort((a, b) => a.localeCompare(b));
}

function escapeCsv(value) {
  const stringValue = String(value ?? "");

  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }

  return stringValue;
}

function createCsv(usernames) {
  const rows = [
    ["username", "perfil"],
    ...usernames.map((username) => [
      username,
      `https://www.instagram.com/${username}/`,
    ]),
  ];

  const content = rows
    .map((row) => row.map(escapeCsv).join(","))
    .join("\n");

  return `\uFEFF${content}\n`;
}

export function buildAudit(analysis) {
  return {
    archivo_zip: analysis.zipName,
    archivos_procesados: {
      seguidores: analysis.filesProcessed.followers,
      seguidos: analysis.filesProcessed.following,
    },
    totales: {
      personas_que_sigues: analysis.totals.following,
      personas_que_te_siguen: analysis.totals.followers,
      no_te_siguen_segun_el_zip: analysis.totals.notFollowingBack,
      tu_no_sigues_de_vuelta: analysis.totals.youDontFollowBack,
      seguimiento_mutuo: analysis.totals.mutual,
    },
    usuarios_verificados: analysis.inspectedUsers,
    advertencias: analysis.warnings,
    nota: analysis.note,
  };
}

export function createOutputFiles(analysis) {
  return {
    "personas-que-no-te-siguen.csv": createCsv(analysis.lists.notFollowingBack),
    "personas-que-tu-no-sigues.csv": createCsv(analysis.lists.youDontFollowBack),
    "seguimiento-mutuo.csv": createCsv(analysis.lists.mutual),
    "auditoria.json": `${JSON.stringify(buildAudit(analysis), null, 2)}\n`,
  };
}

export function writeOutputFiles(analysis, outputDirectory) {
  fs.mkdirSync(outputDirectory, { recursive: true });

  const outputFiles = createOutputFiles(analysis);
  const generatedPaths = {};

  for (const [filename, content] of Object.entries(outputFiles)) {
    const filePath = path.join(outputDirectory, filename);
    fs.writeFileSync(filePath, content, "utf8");
    generatedPaths[filename] = filePath;
  }

  return generatedPaths;
}

export function analyzeInstagramZip(zipInput, options = {}) {
  const {
    zipName = "instagram-export.zip",
    usernamesToInspect = [],
  } = options;

  let zip;

  try {
    zip = new AdmZip(zipInput);
  } catch (error) {
    fail(`No se pudo abrir el ZIP: ${error.message}`);
  }

  const zipEntries = zip
    .getEntries()
    .filter((entry) => !entry.isDirectory);

  const followersEntries = zipEntries.filter((entry) => {
    const basename = path.posix.basename(getEntryName(entry)).toLowerCase();
    return /^followers(?:_\d+)?\.json$/.test(basename);
  });

  const followingEntries = zipEntries.filter((entry) => {
    const basename = path.posix.basename(getEntryName(entry)).toLowerCase();
    return (
      basename === "following.json" ||
      basename === "relationships_following.json"
    );
  });

  if (followersEntries.length === 0) {
    fail(
      "El ZIP no incluye followers_*.json. Descarga Seguidores y seguidos en formato JSON."
    );
  }

  if (followingEntries.length === 0) {
    fail(
      "El ZIP no incluye following.json o relationships_following.json."
    );
  }

  const warnings = [];
  const followers = new Set();
  const following = new Set();

  for (const entry of followersEntries) {
    const filename = getEntryName(entry);
    const records = getFollowersArray(readJsonEntry(entry), filename);

    addUsernames(
      records,
      followers,
      usernameFromFollowerEntry,
      filename,
      warnings
    );
  }

  for (const entry of followingEntries) {
    const filename = getEntryName(entry);
    const records = getFollowingArray(readJsonEntry(entry), filename);

    addUsernames(
      records,
      following,
      usernameFromFollowingEntry,
      filename,
      warnings
    );
  }

  const inspectedUsers = usernamesToInspect
    .map(normalizeUsername)
    .filter(Boolean)
    .map((username) => ({
      username,
      appearsInFollowing: following.has(username),
      appearsInFollowers: followers.has(username),
      classification: following.has(username)
        ? followers.has(username)
          ? "seguimiento_mutuo"
          : "no_te_sigue_segun_el_zip"
        : followers.has(username)
          ? "te_sigue_pero_tu_no_lo_sigues"
          : "no_aparece_en_el_zip",
    }));

  const lists = {
    notFollowingBack: sortedDifference(following, followers),
    youDontFollowBack: sortedDifference(followers, following),
    mutual: sortedIntersection(following, followers),
  };

  return {
    zipName,
    filesProcessed: {
      followers: followersEntries.map(getEntryName),
      following: followingEntries.map(getEntryName),
    },
    totals: {
      following: following.size,
      followers: followers.size,
      notFollowingBack: lists.notFollowingBack.length,
      youDontFollowBack: lists.youDontFollowBack.length,
      mutual: lists.mutual.length,
    },
    lists,
    inspectedUsers,
    warnings,
    note:
      "Los resultados representan únicamente el contenido del ZIP. Si Instagram muestra una relación diferente en la aplicación, el ZIP puede estar desactualizado.",
  };
}
