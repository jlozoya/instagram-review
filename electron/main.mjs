import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  net,
  protocol,
  shell,
} from "electron";
import {
  InstagramAnalysisError,
  analyzeInstagramZip,
  createOutputFiles,
} from "../src/instagram-analyzer.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.join(__dirname, "..", "public");
const appIconPath = path.join(__dirname, "..", "build", "icon.ico");
const appId = "com.fernandolozoya.instagramexportchecker";
const permittedOutputFilenames = new Set([
  "personas-que-no-te-siguen.csv",
  "personas-que-tu-no-sigues.csv",
  "seguimiento-mutuo.csv",
  "auditoria.json",
]);

let mainWindow = null;
const outputFilesBySender = new Map();

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: false,
    },
  },
]);

function errorResult(message) {
  return { ok: false, error: message };
}

function getSafePublicPath(requestUrl) {
  const url = new URL(requestUrl);
  const requestedPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const absolutePath = path.resolve(publicDirectory, `.${requestedPath}`);

  if (
    absolutePath !== publicDirectory &&
    !absolutePath.startsWith(`${publicDirectory}${path.sep}`)
  ) {
    return null;
  }

  return absolutePath;
}

function isValidZipPath(zipPath) {
  return (
    typeof zipPath === "string" &&
    zipPath.toLowerCase().endsWith(".zip") &&
    fs.existsSync(zipPath) &&
    fs.statSync(zipPath).isFile()
  );
}

function getWindowFromEvent(event) {
  return BrowserWindow.fromWebContents(event.sender);
}

async function handleSelectZip(event) {
  const window = getWindowFromEvent(event);
  const result = await dialog.showOpenDialog(window, {
    title: "Selecciona tu exportación de Instagram",
    properties: ["openFile"],
    filters: [{ name: "Archivos ZIP", extensions: ["zip"] }],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  const zipPath = result.filePaths[0];
  const stats = fs.statSync(zipPath);

  return {
    canceled: false,
    file: {
      path: zipPath,
      name: path.basename(zipPath),
      size: stats.size,
    },
  };
}

async function handleAnalyze(event, payload) {
  const zipPath = payload?.zipPath;
  const usernames = typeof payload?.usernames === "string" ? payload.usernames : "";

  if (!isValidZipPath(zipPath)) {
    return errorResult("Selecciona un archivo ZIP válido de Instagram.");
  }

  const usernamesToInspect = usernames
    .split(/[\s,;]+/)
    .map((username) => username.trim())
    .filter(Boolean);

  try {
    const analysis = analyzeInstagramZip(fs.readFileSync(zipPath), {
      zipName: path.basename(zipPath),
      usernamesToInspect,
    });
    const outputs = createOutputFiles(analysis);
    outputFilesBySender.set(event.sender.id, outputs);

    return {
      ok: true,
      result: analysis,
    };
  } catch (error) {
    if (error instanceof InstagramAnalysisError) {
      return errorResult(error.message);
    }

    console.error(error);
    return errorResult(
      "No fue posible analizar el archivo. Verifica que el ZIP no esté dañado."
    );
  }
}

async function handleSaveOutput(event, payload) {
  const filename = payload?.filename;
  const outputs = outputFilesBySender.get(event.sender.id);
  const content = outputs?.[filename];

  if (
    !permittedOutputFilenames.has(filename) ||
    typeof content !== "string"
  ) {
    return errorResult("No existe un resultado válido para guardar.");
  }

  const window = getWindowFromEvent(event);
  const result = await dialog.showSaveDialog(window, {
    title: "Guardar resultado",
    defaultPath: path.join(app.getPath("downloads"), filename),
    filters: filename.endsWith(".json")
      ? [{ name: "JSON", extensions: ["json"] }]
      : [{ name: "CSV", extensions: ["csv"] }],
  });

  if (result.canceled || !result.filePath) {
    return { ok: true, canceled: true };
  }

  fs.writeFileSync(result.filePath, content, "utf8");

  return {
    ok: true,
    canceled: false,
    savedPath: result.filePath,
  };
}

async function handleSaveAllOutputs(event) {
  const outputs = outputFilesBySender.get(event.sender.id);

  if (
    !outputs ||
    [...permittedOutputFilenames].some(
      (filename) => typeof outputs[filename] !== "string"
    )
  ) {
    return errorResult("No hay resultados válidos para guardar.");
  }

  const window = getWindowFromEvent(event);
  const result = await dialog.showOpenDialog(window, {
    title: "Selecciona una carpeta para guardar los resultados",
    properties: ["openDirectory", "createDirectory"],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { ok: true, canceled: true };
  }

  const outputDirectory = result.filePaths[0];

  for (const filename of permittedOutputFilenames) {
    fs.writeFileSync(path.join(outputDirectory, filename), outputs[filename], "utf8");
  }

  return {
    ok: true,
    canceled: false,
    savedPath: outputDirectory,
  };
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1260,
    height: 900,
    minWidth: 820,
    minHeight: 640,
    title: "Instagram Export Checker",
    icon: appIconPath,
    backgroundColor: "#090b12",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  window.once("ready-to-show", () => {
    window.show();
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://www.instagram.com/")) {
      void shell.openExternal(url);
    }

    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event) => {
    event.preventDefault();
  });

  window.on("closed", () => {
    outputFilesBySender.delete(window.webContents.id);
    if (mainWindow === window) {
      mainWindow = null;
    }
  });

  void window.loadURL("app://local/index.html");
  return window;
}

app.whenReady().then(() => {
  if (process.platform === "win32") {
    app.setAppUserModelId(appId);
  }
  protocol.handle("app", (request) => {
    const resourcePath = getSafePublicPath(request.url);

    if (!resourcePath || !fs.existsSync(resourcePath)) {
      return new Response("Not found", { status: 404 });
    }

    return net.fetch(pathToFileURL(resourcePath).toString());
  });

  ipcMain.handle("dialog:select-zip", handleSelectZip);
  ipcMain.handle("analysis:run", handleAnalyze);
  ipcMain.handle("output:save", handleSaveOutput);
  ipcMain.handle("output:save-all", handleSaveAllOutputs);

  mainWindow = createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
