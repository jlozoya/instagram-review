import fs from "node:fs";
import path from "node:path";
import {
  InstagramAnalysisError,
  analyzeInstagramZip,
  writeOutputFiles,
} from "./src/instagram-analyzer.mjs";

const [zipArgument, outputArgument, ...usernamesToInspect] = process.argv.slice(2);

function printUsageAndExit() {
  console.error(`
Uso:
  node instagram-export-checker.mjs <archivo-zip> [directorio-salida] [usuarios-a-verificar...]

Ejemplos:
  node instagram-export-checker.mjs "C:\\Users\\TU_USUARIO\\Downloads\\instagram-export.zip"
  node instagram-export-checker.mjs "C:\\Users\\TU_USUARIO\\Downloads\\instagram-export.zip" ".\\resultado-instagram" "_criminals666_"
`);
  process.exit(1);
}

function exitWithError(message) {
  console.error(`\nError: ${message}\n`);
  process.exit(1);
}

if (!zipArgument) {
  printUsageAndExit();
}

const zipPath = path.resolve(zipArgument);
const outputDirectory = path.resolve(
  outputArgument ?? path.join(process.cwd(), "resultado-instagram")
);

if (!fs.existsSync(zipPath)) {
  exitWithError(`No existe el ZIP indicado: ${zipPath}`);
}

if (!zipPath.toLowerCase().endsWith(".zip")) {
  exitWithError("El primer argumento debe ser un archivo ZIP de Instagram.");
}

try {
  const analysis = analyzeInstagramZip(fs.readFileSync(zipPath), {
    zipName: zipPath,
    usernamesToInspect,
  });

  const generatedPaths = writeOutputFiles(analysis, outputDirectory);

  console.log(`
Proceso terminado.

ZIP procesado:
  ${zipPath}

Archivos detectados:
  Seguidores: ${analysis.filesProcessed.followers.join(", ")}
  Seguidos:   ${analysis.filesProcessed.following.join(", ")}

Resultados basados en el ZIP:
  Personas que sigues:               ${analysis.totals.following}
  Personas que te siguen:            ${analysis.totals.followers}
  No te siguen de vuelta:            ${analysis.totals.notFollowingBack}
  Tú no sigues de vuelta:            ${analysis.totals.youDontFollowBack}
  Seguimiento mutuo:                 ${analysis.totals.mutual}

Archivos generados:
  ${Object.values(generatedPaths).join("\n  ")}
`);

  if (analysis.inspectedUsers.length > 0) {
    console.log("Usuarios verificados:");

    for (const user of analysis.inspectedUsers) {
      console.log(
        `  @${user.username}: seguidos=${user.appearsInFollowing ? "sí" : "no"}, seguidores=${user.appearsInFollowers ? "sí" : "no"} -> ${user.classification}`
      );
    }

    console.log("");
  }

  if (analysis.warnings.length > 0) {
    console.warn("Advertencias:");

    for (const warning of analysis.warnings) {
      console.warn(`  - ${warning}`);
    }

    console.warn("");
  }
} catch (error) {
  if (error instanceof InstagramAnalysisError) {
    exitWithError(error.message);
  }

  exitWithError(`Ocurrió un error inesperado: ${error.message}`);
}
