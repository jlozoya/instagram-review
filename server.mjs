import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import multer from "multer";
import {
  InstagramAnalysisError,
  analyzeInstagramZip,
  createOutputFiles,
} from "./src/instagram-analyzer.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.join(__dirname, "public");
const port = Number.parseInt(process.env.PORT ?? "3000", 10);

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 200 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_request, file, callback) => {
    if (!file.originalname.toLowerCase().endsWith(".zip")) {
      callback(new InstagramAnalysisError("Selecciona un archivo ZIP exportado desde Instagram."));
      return;
    }

    callback(null, true);
  },
});

app.disable("x-powered-by");

app.use((_request, response, next) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'"
  );
  next();
});

app.use(express.static(publicDirectory));

app.post("/api/analyze", upload.single("instagramZip"), (request, response) => {
  if (!request.file) {
    response.status(400).json({
      error: "Selecciona el archivo ZIP de Instagram antes de analizar.",
    });
    return;
  }

  const usernamesToInspect = String(request.body.usernames ?? "")
    .split(/[\s,;]+/)
    .map((username) => username.trim())
    .filter(Boolean);

  try {
    const analysis = analyzeInstagramZip(request.file.buffer, {
      zipName: request.file.originalname,
      usernamesToInspect,
    });

    response.json({
      ...analysis,
      outputs: createOutputFiles(analysis),
    });
  } catch (error) {
    if (error instanceof InstagramAnalysisError) {
      response.status(400).json({ error: error.message });
      return;
    }

    console.error(error);
    response.status(500).json({
      error: "No fue posible analizar el archivo. Revisa que el ZIP no esté dañado.",
    });
  }
});

app.use((error, _request, response, _next) => {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    response.status(413).json({
      error: "El archivo supera el límite de 200 MB. Exporta solo la información de seguidores y seguidos.",
    });
    return;
  }

  if (error instanceof InstagramAnalysisError) {
    response.status(400).json({ error: error.message });
    return;
  }

  console.error(error);
  response.status(500).json({ error: "No fue posible procesar la solicitud." });
});

app.listen(port, () => {
  console.log(`Instagram Export Checker disponible en http://localhost:${port}`);
});
