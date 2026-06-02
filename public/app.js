const elements = {
  form: document.querySelector("#analysisForm"),
  zipInput: document.querySelector("#zipInput"),
  usernames: document.querySelector("#usernames"),
  dropzone: document.querySelector("#dropzone"),
  dropTitle: document.querySelector("#dropTitle"),
  dropDescription: document.querySelector("#dropDescription"),
  analyzeButton: document.querySelector("#analyzeButton"),
  resetButton: document.querySelector("#resetButton"),
  errorMessage: document.querySelector("#errorMessage"),
  statusMessage: document.querySelector("#statusMessage"),
  results: document.querySelector("#results"),
  resultFile: document.querySelector("#resultFile"),
  summaryCards: document.querySelector("#summaryCards"),
  downloadButtons: document.querySelector("#downloadButtons"),
  verifiedPanel: document.querySelector("#verifiedPanel"),
  verifiedUsers: document.querySelector("#verifiedUsers"),
  tabs: document.querySelector("#tabs"),
  tableDescription: document.querySelector("#tableDescription"),
  searchInput: document.querySelector("#searchInput"),
  userRows: document.querySelector("#userRows"),
  emptyState: document.querySelector("#emptyState"),
  pagination: document.querySelector("#pagination"),
  previousPage: document.querySelector("#previousPage"),
  nextPage: document.querySelector("#nextPage"),
  pageText: document.querySelector("#pageText"),
  followersFiles: document.querySelector("#followersFiles"),
  followingFiles: document.querySelector("#followingFiles"),
  warningsBox: document.querySelector("#warningsBox"),
  warningsList: document.querySelector("#warningsList"),
};

const listConfiguration = {
  notFollowingBack: {
    description: "Cuentas que sigues, pero que no aparecen en tu lista de seguidores.",
  },
  youDontFollowBack: {
    description: "Cuentas que te siguen, pero no aparecen en tu lista de seguidos.",
  },
  mutual: {
    description: "Cuentas presentes en ambas listas.",
  },
};

const state = {
  selectedFile: null,
  result: null,
  activeList: "notFollowingBack",
  search: "",
  page: 1,
  pageSize: 50,
};

function showMessage(element, message) {
  element.textContent = message;
  element.hidden = false;
}

function hideMessage(element) {
  element.textContent = "";
  element.hidden = true;
}

function resetMessages() {
  hideMessage(elements.errorMessage);
  hideMessage(elements.statusMessage);
}

function isZipFilename(filename) {
  return typeof filename === "string" && filename.toLowerCase().endsWith(".zip");
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function applySelectedFile(file) {
  resetMessages();

  if (!file || !isZipFilename(file.name) || !file.path) {
    state.selectedFile = null;
    elements.analyzeButton.disabled = true;
    elements.dropzone.classList.remove("has-file");
    showMessage(elements.errorMessage, "Selecciona un archivo con extensión .zip.");
    return;
  }

  state.selectedFile = file;
  elements.dropzone.classList.add("has-file");
  elements.dropTitle.textContent = file.name;
  elements.dropDescription.textContent = formatBytes(file.size);
  elements.analyzeButton.disabled = false;
  elements.resetButton.hidden = false;
}

function resetApplication() {
  state.selectedFile = null;
  state.result = null;
  state.activeList = "notFollowingBack";
  state.search = "";
  state.page = 1;
  elements.zipInput.value = "";
  elements.usernames.value = "";
  elements.searchInput.value = "";
  elements.dropzone.classList.remove("has-file", "dragging");
  elements.dropTitle.textContent = "Arrastra tu ZIP o selecciónalo";
  elements.dropDescription.textContent = "Solo se admite un archivo .zip";
  elements.analyzeButton.disabled = true;
  elements.analyzeButton.textContent = "Analizar archivo";
  elements.resetButton.hidden = true;
  elements.results.hidden = true;
  resetMessages();
}

function createTextElement(tagName, text, className) {
  const element = document.createElement(tagName);
  element.textContent = text;

  if (className) {
    element.className = className;
  }

  return element;
}

function renderSummary(totals) {
  const summaries = [
    ["Sigues", totals.following, false],
    ["Te siguen", totals.followers, false],
    ["No te siguen", totals.notFollowingBack, true],
    ["Tú no sigues", totals.youDontFollowBack, false],
    ["Mutuo", totals.mutual, false],
  ];

  elements.summaryCards.replaceChildren();

  for (const [label, value, highlight] of summaries) {
    const card = document.createElement("article");
    card.className = `summary-card${highlight ? " highlight" : ""}`;
    card.append(
      createTextElement("span", String(value), "summary-value"),
      createTextElement("span", label, "summary-label")
    );
    elements.summaryCards.append(card);
  }
}

async function saveOutput(filename) {
  const response = await window.instagramApp.saveOutput(filename);

  if (!response.ok) {
    showMessage(elements.errorMessage, response.error);
    return;
  }

  if (!response.canceled) {
    showMessage(elements.statusMessage, `Archivo guardado: ${response.savedPath}`);
  }
}

async function saveAllOutputs() {
  const response = await window.instagramApp.saveAllOutputs();

  if (!response.ok) {
    showMessage(elements.errorMessage, response.error);
    return;
  }

  if (!response.canceled) {
    showMessage(
      elements.statusMessage,
      `Resultados guardados en: ${response.savedPath}`
    );
  }
}

function renderDownloads() {
  const labels = {
    "personas-que-no-te-siguen.csv": "No te siguen · CSV",
    "personas-que-tu-no-sigues.csv": "Tú no sigues · CSV",
    "seguimiento-mutuo.csv": "Mutuo · CSV",
    "auditoria.json": "Auditoría · JSON",
  };

  elements.downloadButtons.replaceChildren();

  const saveAllButton = createTextElement(
    "button",
    "Guardar todos",
    "download-button primary-download"
  );
  saveAllButton.type = "button";
  saveAllButton.addEventListener("click", () => {
    resetMessages();
    void saveAllOutputs();
  });
  elements.downloadButtons.append(saveAllButton);

  for (const [filename, label] of Object.entries(labels)) {
    const button = createTextElement("button", label, "download-button");
    button.type = "button";
    button.addEventListener("click", () => {
      resetMessages();
      void saveOutput(filename);
    });
    elements.downloadButtons.append(button);
  }
}

function classificationData(classification) {
  const classifications = {
    seguimiento_mutuo: ["Seguimiento mutuo", "success"],
    no_te_sigue_segun_el_zip: ["No te sigue según el ZIP", "danger"],
    te_sigue_pero_tu_no_lo_sigues: ["Tú no lo sigues", "neutral"],
    no_aparece_en_el_zip: ["No aparece en el ZIP", "neutral"],
  };

  return classifications[classification] ?? [classification, "neutral"];
}

function renderVerifiedUsers(users) {
  elements.verifiedUsers.replaceChildren();
  elements.verifiedPanel.hidden = users.length === 0;

  for (const user of users) {
    const card = document.createElement("article");
    card.className = "verified-user";
    const [label, badgeStyle] = classificationData(user.classification);
    const badge = createTextElement("span", label, `badge ${badgeStyle}`);

    card.append(createTextElement("strong", `@${user.username}`), badge);
    elements.verifiedUsers.append(card);
  }
}

function createFileList(target, filenames) {
  target.replaceChildren();

  for (const filename of filenames) {
    target.append(createTextElement("li", filename));
  }
}

function renderAudit(result) {
  createFileList(elements.followersFiles, result.filesProcessed.followers);
  createFileList(elements.followingFiles, result.filesProcessed.following);

  elements.warningsList.replaceChildren();
  elements.warningsBox.hidden = result.warnings.length === 0;

  for (const warning of result.warnings) {
    elements.warningsList.append(createTextElement("li", warning));
  }
}

function getFilteredUsers() {
  const usernames = state.result?.lists[state.activeList] ?? [];
  const search = state.search.toLowerCase().replace(/^@/, "").trim();

  return search
    ? usernames.filter((username) => username.includes(search))
    : usernames;
}

function renderTable() {
  const users = getFilteredUsers();
  const pageCount = Math.max(1, Math.ceil(users.length / state.pageSize));
  state.page = Math.min(state.page, pageCount);
  const start = (state.page - 1) * state.pageSize;
  const visibleUsers = users.slice(start, start + state.pageSize);

  elements.tableDescription.textContent =
    `${listConfiguration[state.activeList].description} ${users.length} resultado${users.length === 1 ? "" : "s"}.`;
  elements.userRows.replaceChildren();
  elements.emptyState.hidden = visibleUsers.length !== 0;

  for (const username of visibleUsers) {
    const row = document.createElement("tr");
    const profileCell = document.createElement("td");
    const profileLink = createTextElement("a", "Abrir perfil", "profile-link");

    profileLink.href = `https://www.instagram.com/${encodeURIComponent(username)}/`;
    profileLink.target = "_blank";
    profileLink.rel = "noopener noreferrer";
    profileCell.append(profileLink);
    row.append(createTextElement("td", `@${username}`), profileCell);
    elements.userRows.append(row);
  }

  elements.pagination.hidden = users.length <= state.pageSize;
  elements.pageText.textContent = `Página ${state.page} de ${pageCount}`;
  elements.previousPage.disabled = state.page === 1;
  elements.nextPage.disabled = state.page === pageCount;
}

function activateTab(listName) {
  state.activeList = listName;
  state.page = 1;

  for (const tab of elements.tabs.querySelectorAll(".tab")) {
    tab.classList.toggle("active", tab.dataset.list === listName);
  }

  renderTable();
}

function renderResults(result) {
  state.result = result;
  elements.resultFile.textContent = result.zipName;
  renderSummary(result.totals);
  renderDownloads();
  renderVerifiedUsers(result.inspectedUsers);
  renderAudit(result);
  activateTab("notFollowingBack");
  elements.results.hidden = false;
  elements.results.scrollIntoView({ behavior: "smooth", block: "start" });
}

elements.dropzone.addEventListener("click", async (event) => {
  if (event.target === elements.zipInput) {
    return;
  }

  event.preventDefault();
  const selection = await window.instagramApp.selectZip();

  if (!selection.canceled) {
    applySelectedFile(selection.file);
  }
});

elements.zipInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];

  if (!file) {
    return;
  }

  let filePath = "";

  try {
    filePath = window.instagramApp.getPathForFile(file);
  } catch {
    filePath = "";
  }

  applySelectedFile({
    path: filePath,
    name: file.name,
    size: file.size,
  });
});

for (const eventName of ["dragenter", "dragover"]) {
  elements.dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropzone.classList.add("dragging");
  });
}

for (const eventName of ["dragleave", "drop"]) {
  elements.dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropzone.classList.remove("dragging");
  });
}

elements.dropzone.addEventListener("drop", (event) => {
  const file = event.dataTransfer.files?.[0];

  if (!file) {
    return;
  }

  let filePath = "";

  try {
    filePath = window.instagramApp.getPathForFile(file);
  } catch {
    filePath = "";
  }

  applySelectedFile({
    path: filePath,
    name: file.name,
    size: file.size,
  });
});

elements.resetButton.addEventListener("click", resetApplication);

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  resetMessages();

  if (!state.selectedFile) {
    showMessage(elements.errorMessage, "Selecciona el ZIP de Instagram.");
    return;
  }

  elements.analyzeButton.disabled = true;
  elements.analyzeButton.textContent = "Analizando…";
  showMessage(elements.statusMessage, "Leyendo seguidores y seguidos del archivo…");

  try {
    const response = await window.instagramApp.analyze({
      zipPath: state.selectedFile.path,
      usernames: elements.usernames.value,
    });

    if (!response.ok) {
      throw new Error(response.error);
    }

    hideMessage(elements.statusMessage);
    renderResults(response.result);
  } catch (error) {
    hideMessage(elements.statusMessage);
    showMessage(elements.errorMessage, error.message);
  } finally {
    elements.analyzeButton.disabled = false;
    elements.analyzeButton.textContent = "Analizar archivo";
  }
});

elements.tabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-list]");

  if (button) {
    activateTab(button.dataset.list);
  }
});

elements.searchInput.addEventListener("input", (event) => {
  state.search = event.target.value;
  state.page = 1;
  renderTable();
});

elements.previousPage.addEventListener("click", () => {
  state.page -= 1;
  renderTable();
});

elements.nextPage.addEventListener("click", () => {
  state.page += 1;
  renderTable();
});
