const listElement = document.querySelector("#file-list");
const emptyState = document.querySelector("#empty-state");
const searchInput = document.querySelector("#search-input");
const sortSelect = document.querySelector("#sort-select");
const breadcrumbs = document.querySelector("#breadcrumbs");
const folderNav = document.querySelector("#folder-nav");
const allFilesButton = document.querySelector("#all-files-button");
const fileCount = document.querySelector("#file-count");
const pageTitle = document.querySelector("#page-title");
const pageDescription = document.querySelector("#page-description");
const resultsSummary = document.querySelector("#results-summary");
const errorMessage = document.querySelector("#error-message");
const emptyTitle = document.querySelector("#empty-title");
const emptyDescription = document.querySelector("#empty-description");
const manageLink = document.querySelector("#manage-link");
const emptyManageLink = document.querySelector("#empty-manage-link");

const folderIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H10l2 2h7.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/></svg>';
const fileIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.8h6.5L19 9v11.2H7z"/><path d="M13 4v5h5M10 14h6m-6 3h6"/></svg>';
const downloadIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11m-4-4 4 4 4-4M5 17v3h14v-3"/></svg>';

let files = [];
let repository = "";
let branch = "main";
let currentFolder = "";
let searchTerm = "";
let sortMode = "name-asc";

function compareNames(left, right) {
  const leftName = left.name ?? displayPath(left.path).split("/").pop() ?? "";
  const rightName = right.name ?? displayPath(right.path).split("/").pop() ?? "";
  return leftName.localeCompare(rightName, "zh-CN", { numeric: true, sensitivity: "base" });
}

function displayPath(filePath) {
  return filePath.startsWith("storage/") ? filePath.slice("storage/".length) : filePath;
}

function encodePath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function fileUrl(path) {
  return new URL(encodePath(path), new URL("./", window.location.href)).href;
}

function repositoryFolderUrl() {
  if (!repository) return "";
  const [owner, name] = repository.split("/");
  if (!owner || !name) return "";
  return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/tree/${encodeURIComponent(branch)}/storage`;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes;
  let unit = -1;
  do {
    size /= 1024;
    unit += 1;
  } while (size >= 1024 && unit < units.length - 1);
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unit]}`;
}

function fileCategory(name) {
  const extension = name.split(".").pop().toLowerCase();
  if (extension === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"].includes(extension)) return "image";
  if (["mp4", "mov", "mkv", "webm", "avi"].includes(extension)) return "video";
  if (["mp3", "wav", "flac", "aac", "ogg", "m4a"].includes(extension)) return "audio";
  if (["zip", "rar", "7z", "tar", "gz"].includes(extension)) return "archive";
  return "document";
}

function getFolders() {
  const folderNames = new Set();
  for (const file of files) {
    const parts = displayPath(file.path).split("/");
    parts.pop();
    let path = "";
    for (const part of parts) {
      path = path ? `${path}/${part}` : part;
      folderNames.add(path);
    }
  }
  return [...folderNames].sort((left, right) => left.localeCompare(right, "zh-CN", { numeric: true }));
}

function setActiveFolder(folder) {
  currentFolder = folder;
  allFilesButton.classList.toggle("is-active", folder === "");
  for (const button of folderNav.querySelectorAll("[data-folder]")) {
    button.classList.toggle("is-active", button.dataset.folder === folder && folder !== "");
  }
  render();
}

function renderFolderNavigation() {
  const topFolders = getFolders().filter((folder) => !folder.includes("/"));
  folderNav.replaceChildren();
  for (const folder of topFolders) {
    const button = document.createElement("button");
    button.className = "folder-nav-item";
    button.type = "button";
    button.dataset.folder = folder;
    button.innerHTML = `${folderIcon}<span></span>`;
    button.querySelector("span").textContent = folder;
    button.addEventListener("click", () => setActiveFolder(folder));
    folderNav.append(button);
  }
}

function renderBreadcrumbs() {
  breadcrumbs.replaceChildren();
  const segments = currentFolder ? currentFolder.split("/") : [];
  const locations = [{ label: "全部文件", path: "" }];
  segments.forEach((segment, index) => {
    locations.push({ label: segment, path: segments.slice(0, index + 1).join("/") });
  });
  locations.forEach((location, index) => {
    if (index > 0) {
      const separator = document.createElement("span");
      separator.className = "breadcrumb-separator";
      separator.textContent = "/";
      breadcrumbs.append(separator);
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = `breadcrumb${index === locations.length - 1 ? " is-current" : ""}`;
    button.textContent = location.label;
    button.setAttribute("aria-current", index === locations.length - 1 ? "location" : "false");
    button.addEventListener("click", () => setActiveFolder(location.path));
    breadcrumbs.append(button);
  });
}

function makeFolderRow(folder, count) {
  const row = document.createElement("div");
  row.className = "file-row folder-row";
  row.tabIndex = 0;
  row.setAttribute("role", "button");
  row.setAttribute("aria-label", `打开文件夹 ${folder.name}`);
  row.innerHTML = `<div class="file-name-cell"><span class="file-icon">${folderIcon}</span><div class="file-info"><div class="file-name"></div><div class="file-subtitle">文件夹</div></div></div><span class="folder-meta">${count} 个文件</span><span class="row-action"></span>`;
  row.querySelector(".file-name").textContent = folder.name;
  const open = () => setActiveFolder(folder.path);
  row.addEventListener("click", open);
  row.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open();
    }
  });
  return row;
}

function makeFileRow(file, inSearchResults) {
  const row = document.createElement("div");
  row.className = "file-row";
  const name = file.path.split("/").pop();
  const subtitle = inSearchResults
    ? displayPath(file.path).split("/").slice(0, -1).join("/") || "根目录"
    : "文件";
  const category = fileCategory(name);
  row.innerHTML = `<div class="file-name-cell"><span class="file-icon type-${category}">${fileIcon}</span><div class="file-info"><div class="file-name"></div><div class="file-subtitle"></div></div></div><span class="file-size"></span><span class="row-action"><a class="download-link" download>${downloadIcon}<span>下载</span></a></span>`;
  row.querySelector(".file-name").textContent = name;
  row.querySelector(".file-subtitle").textContent = subtitle;
  row.querySelector(".file-size").textContent = formatSize(file.size);
  const link = row.querySelector(".download-link");
  link.href = fileUrl(file.path);
  link.setAttribute("aria-label", `下载 ${name}`);
  return row;
}

function render() {
  renderBreadcrumbs();
  pageTitle.textContent = currentFolder ? currentFolder.split("/").pop() : "全部文件";
  pageDescription.textContent = searchTerm
    ? `“${searchTerm}” 的搜索结果`
    : currentFolder
      ? "浏览此文件夹中的内容。"
      : "在一个地方浏览和下载共享文件。";

  const normalizedQuery = searchTerm.trim().toLocaleLowerCase();
  const matchingFiles = normalizedQuery
    ? files.filter((file) => displayPath(file.path).toLocaleLowerCase().includes(normalizedQuery))
    : files.filter((file) => {
        const path = displayPath(file.path);
        const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
        return parent === currentFolder;
      });

  const childFolders = [];
  if (!normalizedQuery) {
    for (const folder of getFolders()) {
      const parent = folder.includes("/") ? folder.slice(0, folder.lastIndexOf("/")) : "";
      if (parent !== currentFolder) continue;
      const count = files.filter((file) => displayPath(file.path).startsWith(`${folder}/`)).length;
      childFolders.push({ name: folder.split("/").pop(), path: folder, count });
    }
  }
  childFolders.sort((left, right) => left.name.localeCompare(right.name, "zh-CN", { numeric: true }));
  matchingFiles.sort((left, right) => {
    if (sortMode === "name-desc") return compareNames(right, left);
    if (sortMode === "size-desc") return right.size - left.size || compareNames(left, right);
    return compareNames(left, right);
  });

  listElement.replaceChildren();
  for (const folder of childFolders) listElement.append(makeFolderRow(folder, folder.count));
  for (const file of matchingFiles) listElement.append(makeFileRow(file, Boolean(normalizedQuery)));
  const isEmpty = childFolders.length === 0 && matchingFiles.length === 0;
  emptyState.hidden = !isEmpty;
  if (isEmpty) {
    emptyTitle.textContent = normalizedQuery ? "没有找到匹配的文件" : "这里还没有文件";
    emptyDescription.textContent = normalizedQuery
      ? "试试其他关键词，或检查一下文件名。"
      : "文件管理员可以将文件添加到 GitHub 仓库的 storage 文件夹。";
  }
  const shownCount = matchingFiles.length + childFolders.length;
  resultsSummary.textContent = normalizedQuery
    ? `找到 ${matchingFiles.length} 个文件`
    : `${shownCount} 项内容${currentFolder ? "" : ` · 共 ${files.length} 个文件`}`;
}

async function loadCatalog() {
  try {
    const response = await fetch(new URL("catalog.json", new URL("./", window.location.href)), { cache: "no-store" });
    if (!response.ok) throw new Error(`文件目录加载失败（HTTP ${response.status}）`);
    const catalog = await response.json();
    if (!catalog || !Array.isArray(catalog.files)) throw new Error("文件目录格式无效");
    files = catalog.files.filter((file) => (
      typeof file.path === "string"
      && typeof file.size === "number"
      && file.path.startsWith("storage/")
      && !file.path.split("/").some((part) => part.startsWith("."))
    ));
    repository = typeof catalog.repository === "string" ? catalog.repository : "";
    branch = typeof catalog.branch === "string" && catalog.branch ? catalog.branch : "main";
    files.sort(compareNames);
    fileCount.textContent = String(files.length);
    const managementUrl = repositoryFolderUrl();
    if (managementUrl) {
      manageLink.href = managementUrl;
      emptyManageLink.href = managementUrl;
      manageLink.hidden = false;
    } else {
      manageLink.hidden = true;
      emptyManageLink.hidden = true;
    }
    renderFolderNavigation();
    render();
  } catch (error) {
    errorMessage.textContent = error instanceof Error ? error.message : "无法加载文件目录";
    errorMessage.hidden = false;
    resultsSummary.textContent = "文件目录暂时不可用";
    emptyTitle.textContent = "暂时无法读取文件";
    emptyDescription.textContent = "请稍后刷新页面，或联系文件管理员。";
    emptyState.hidden = false;
  }
}

allFilesButton.addEventListener("click", () => setActiveFolder(""));
searchInput.addEventListener("input", () => {
  searchTerm = searchInput.value;
  render();
});
sortSelect.addEventListener("change", () => {
  sortMode = sortSelect.value;
  render();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "/" && document.activeElement !== searchInput && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    searchInput.focus();
  }
  if (event.key === "Escape" && document.activeElement === searchInput) {
    searchInput.value = "";
    searchTerm = "";
    searchInput.blur();
    render();
  }
});

loadCatalog();
