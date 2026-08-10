import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  setDoc,
  onSnapshot,
  writeBatch,
} from "firebase/firestore";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  deleteUser,
  updateEmail,
  updatePassword,
} from "firebase/auth";

const TAB_FRAGMENT_FILES = [
  "admin-overview.html",
  "transactors.html",
  "salary.html",
  "assignments.html",
  "documents.html",
  "profile.html",
  "settings.html",
];

async function loadTabFragments() {
  const mount = document.getElementById("tabMount");
  if (!mount) throw new Error("Không tìm thấy #tabMount");

  try {
    const fragments = await Promise.all(
      TAB_FRAGMENT_FILES.map(async (fileName) => {

        const fragmentUrl = new URL(`../tab/${fileName}`, import.meta.url);
        const response = await fetch(fragmentUrl, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`${fileName}: HTTP ${response.status}`);
        }
        return response.text();
      }),
    );
    mount.innerHTML = fragments.join("\n");
    Array.from(mount.querySelectorAll(".modal-overlay")).forEach((modal) => {
      document.body.appendChild(modal);
    });
  } catch (error) {
    console.error("Không thể tải các file tab:", error);
    mount.innerHTML = `
      <div class="card" style="text-align:center;padding:32px;color:var(--danger-neon);">
        <i class="fas fa-triangle-exclamation" style="font-size:30px;display:block;margin-bottom:12px;"></i>
        Không thể tải giao diện tab. Hãy chạy dự án bằng Live Server hoặc <code>npx serve</code>.
      </div>`;
    throw error;
  }
}

await loadTabFragments();

const firebaseConfig = {
  apiKey: "AIzaSyAxMuHOdj8a8c3lDpZG_k8fFUV6tCVkH8w",
  authDomain: "hethongquanlyadichthuatvien.firebaseapp.com",
  databaseURL:
    "https://hethongquanlyadichthuatvien-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "hethongquanlyadichthuatvien",
  storageBucket: "hethongquanlyadichthuatvien.firebasestorage.app",
  messagingSenderId: "78223981328",
  appId: "1:78223981328:web:8667950575d90be2420395",
  measurementId: "G-X6CQJ1PTY9",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const runtimeState = {
  roleReady: false,
  currentEmail: "",
  activeTab: "dashboard",
  dashboardLoaded: false,
};
const collectionCache = new Map();

async function getCollectionRows(collectionName, maxAge = 15000, force = false) {
  const now = Date.now();
  const cached = collectionCache.get(collectionName);
  if (!force && cached?.rows && now - cached.time < maxAge) return cached.rows;
  if (!force && cached?.promise) return cached.promise;
  const promise = getDocs(collection(db, collectionName)).then((snapshot) => {
    const rows = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    collectionCache.set(collectionName, { rows, time: Date.now(), promise: null });
    return rows;
  }).catch((error) => {
    collectionCache.delete(collectionName);
    throw error;
  });
  collectionCache.set(collectionName, { rows: cached?.rows || null, time: cached?.time || 0, promise });
  return promise;
}

function invalidateCollection(collectionName) {
  collectionCache.delete(collectionName);
}

function scheduleUiTask(callback) {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(callback, { timeout: 250 });
  } else {
    window.setTimeout(callback, 0);
  }
}

const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");
const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const mobileSidebarClose = document.getElementById("mobileSidebarClose");
const sidebarBackdrop = document.getElementById("sidebarBackdrop");
const mobileViewport = window.matchMedia("(max-width: 820px)");

function setMobileNavigation(open) {
  const active = Boolean(open && mobileViewport.matches);
  sidebar?.classList.toggle("mobile-open", active);
  document.body.classList.toggle("mobile-nav-open", active);
  mobileMenuBtn?.setAttribute("aria-expanded", String(active));
  sidebarBackdrop?.setAttribute("aria-hidden", String(!active));
}

sidebarToggle?.addEventListener("click", () => {
  if (mobileViewport.matches) {
    setMobileNavigation(!sidebar.classList.contains("mobile-open"));
    return;
  }
  sidebar.classList.toggle("collapsed");
  sidebarToggle.querySelector("i").className = sidebar.classList.contains("collapsed")
    ? "fas fa-chevron-right"
    : "fas fa-chevron-left";
  sidebarToggle.title = sidebar.classList.contains("collapsed")
    ? "Mở rộng sidebar"
    : "Thu gọn sidebar";
});

mobileMenuBtn?.addEventListener("click", () => setMobileNavigation(true));
mobileSidebarClose?.addEventListener("click", () => setMobileNavigation(false));
sidebarBackdrop?.addEventListener("click", () => setMobileNavigation(false));
mobileViewport.addEventListener?.("change", () => setMobileNavigation(false));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.body.classList.contains("mobile-nav-open")) {
    setMobileNavigation(false);
  }
});

const TAB_TITLES = {
  dashboard: "TỔNG QUAN HỆ THỐNG",
  transactors: "QUẢN LÝ DỊCH THUẬT VIÊN",
  salary: "QUẢN LÝ LƯƠNG",
  assignments: "PHÂN CÔNG TASK",
  documents: "KHO TÀI LIỆU",
  profile: "HỒ SƠ CÁ NHÂN",
  settings: "CÀI ĐẶT HỆ THỐNG",
};

function activateTab(tab) {
  const item = document.querySelector(`.nav-item[data-tab="${tab}"]`);
  const targetTab = document.getElementById("tab-" + tab);
  if (!item || !targetTab) return;
  if (window.currentUserIsDTV && item.classList.contains("admin-only")) {
    showToast("Bạn không có quyền truy cập khu vực quản trị này.", "warning");
    return;
  }
  runtimeState.activeTab = tab;
  document.querySelectorAll(".nav-item.active").forEach((nav) => nav.classList.remove("active"));
  document.querySelectorAll(".tab-content.active").forEach((content) => content.classList.remove("active"));
  item.classList.add("active");
  targetTab.classList.add("active");
  if (mobileViewport.matches) {
    setMobileNavigation(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const pageTitle = document.getElementById("pageTitle");
  if (pageTitle) pageTitle.textContent = TAB_TITLES[tab] || "HỆ THỐNG QUẢN LÝ";
  scheduleUiTask(() => {
    if (tab === "dashboard" && !runtimeState.dashboardLoaded) loadDashboardData();
    if (tab === "salary") window.loadSalary?.();
    if (tab === "transactors") window.loadTranslators?.();
    if (tab === "assignments") window.loadAssignments?.();
    if (tab === "documents") window.loadDocuments?.();
    if (tab === "profile") loadProfile();
    if (tab === "settings") loadMaintenanceStatus();
  });
}

window.activateTab = activateTab;
document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", () => activateTab(item.getAttribute("data-tab")));
});

function updateClock() {
  const now = new Date();
  const value = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
  const mainClock = document.getElementById("clockDisplay");
  const dashboardClock = document.getElementById("dashboardClock");
  if (mainClock) mainClock.textContent = value;
  if (dashboardClock) dashboardClock.textContent = value;
}
updateClock();
setInterval(updateClock, 1000);

window.db = db;
window.doc = doc;
window.collection = collection;
window.addDoc = addDoc;
window.setDoc = setDoc;
window.getDoc = getDoc;
window.auth = auth;

const tableCache = {
  translators: [],
  salary: [],
  assignments: [],
  documents: [],
};

const TABLE_PAGE_SIZES = [20, 30, 50, 100];
const TABLE_KEY_BY_BODY = {
  transactorsTableBody: "transactors",
  salaryTableBody: "salary",
  assignmentsTableBody: "assignments",
  documentsTableBody: "documents",
};
const tablePaginationState = new Map();
const tablePaginationSources = new Map();

function getPaginationState(key) {
  if (!tablePaginationState.has(key)) {
    tablePaginationState.set(key, { page: 1, pageSize: 20 });
  }
  return tablePaginationState.get(key);
}

function getPageSequence(currentPage, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const items = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);
  if (start > 2) items.push("ellipsis-start");
  for (let page = start; page <= end; page += 1) items.push(page);
  if (end < totalPages - 1) items.push("ellipsis-end");
  items.push(totalPages);
  return items;
}

function applyResponsiveTableLabels(body) {
  const table = body?.closest("table");
  if (!table) return;
  const labels = Array.from(table.querySelectorAll("thead th")).map((cell) => cell.textContent.trim());
  body.querySelectorAll("tr").forEach((row) => {
    Array.from(row.children).forEach((cell, index) => {
      if (cell.hasAttribute("colspan")) return;
      cell.dataset.label = labels[index] || "Thông tin";
    });
  });
}

function getTablePager(key, body, create = true) {
  const table = body?.closest("table");
  if (!table) return null;
  let pager = table.parentElement?.querySelector(`[data-table-pager="${key}"]`);
  if (!pager && create) {
    pager = document.createElement("div");
    pager.className = "table-pagination";
    pager.dataset.tablePager = key;
    table.insertAdjacentElement("afterend", pager);
  }
  return pager;
}

function hideTablePager(bodyId) {
  const body = document.getElementById(bodyId);
  const key = TABLE_KEY_BY_BODY[bodyId];
  if (!body || !key) return;
  const pager = getTablePager(key, body, false);
  if (pager) pager.hidden = true;
}

function clearTablePager(bodyId) {
  const key = TABLE_KEY_BY_BODY[bodyId];
  if (!key) return;
  tablePaginationSources.delete(key);
  hideTablePager(bodyId);
}

function renderPaginatedTable(key) {
  const source = tablePaginationSources.get(key);
  if (!source) return;
  const body = document.getElementById(source.bodyId);
  if (!body) return;
  const state = getPaginationState(key);
  const totalRows = source.rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / state.pageSize));
  state.page = Math.min(Math.max(1, state.page), totalPages);
  const startIndex = (state.page - 1) * state.pageSize;
  const endIndex = Math.min(startIndex + state.pageSize, totalRows);
  const visibleRows = source.rows.slice(startIndex, endIndex);
  body.innerHTML = visibleRows
    .map((row, index) => source.rowRenderer(row, startIndex + index))
    .join("");
  Array.from(body.querySelectorAll("tr")).forEach((row, index) => {
    row.style.setProperty("--row-index", String(index));
  });
  applyResponsiveTableLabels(body);

  const pager = getTablePager(key, body, true);
  pager.hidden = false;
  const pageButtons = getPageSequence(state.page, totalPages)
    .map((item) => {
      if (typeof item !== "number") return '<span class="table-page-ellipsis">…</span>';
      return `<button class="table-page-btn${item === state.page ? " active" : ""}" type="button" data-page="${item}" aria-label="Trang ${item}">${item}</button>`;
    })
    .join("");
  const firstVisible = totalRows ? startIndex + 1 : 0;
  pager.innerHTML = `
    <div class="table-pagination-left">
      <label class="table-page-label">
        Hiển thị
        <select class="table-page-size" aria-label="Số dòng mỗi trang">
          ${TABLE_PAGE_SIZES.map((size) => `<option value="${size}"${size === state.pageSize ? " selected" : ""}>${size}</option>`).join("")}
        </select>
        dòng
      </label>
      <span class="table-pagination-info">${firstVisible}–${endIndex} / ${totalRows}</span>
    </div>
    <div class="table-pagination-right">
      <button class="table-page-btn" type="button" data-action="prev" aria-label="Trang trước"${state.page === 1 ? " disabled" : ""}><i class="fas fa-chevron-left"></i></button>
      ${pageButtons}
      <button class="table-page-btn" type="button" data-action="next" aria-label="Trang sau"${state.page === totalPages ? " disabled" : ""}><i class="fas fa-chevron-right"></i></button>
      <span class="table-page-summary">Trang ${state.page} / ${totalPages}</span>
    </div>`;

  pager.querySelector(".table-page-size")?.addEventListener("change", (event) => {
    state.pageSize = Number(event.target.value) || 20;
    state.page = 1;
    renderPaginatedTable(key);
  });
  pager.querySelectorAll("[data-page]").forEach((button) => {
    button.addEventListener("click", () => {
      state.page = Number(button.dataset.page) || 1;
      renderPaginatedTable(key);
      body.closest(".card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
  pager.querySelector('[data-action="prev"]')?.addEventListener("click", () => {
    if (state.page <= 1) return;
    state.page -= 1;
    renderPaginatedTable(key);
    body.closest(".card")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  pager.querySelector('[data-action="next"]')?.addEventListener("click", () => {
    if (state.page >= totalPages) return;
    state.page += 1;
    renderPaginatedTable(key);
    body.closest(".card")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function setPaginatedRows(key, bodyId, rows, rowRenderer, resetPage = false) {
  const state = getPaginationState(key);
  if (resetPage || !tablePaginationSources.has(key)) state.page = 1;
  tablePaginationSources.set(key, { bodyId, rows, rowRenderer });
  renderPaginatedTable(key);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatMoney(value) {
  const number = Number(value) || 0;
  return number.toLocaleString("vi-VN");
}

function formatStoredDate(value) {
  if (!value) return "N/A";

  if (typeof value?.toDate === "function") {
    return value.toDate().toLocaleDateString("vi-VN");
  }

  if (typeof value === "string" && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) {
    return value;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? escapeHtml(value)
    : date.toLocaleDateString("vi-VN");
}

function setTableLoading(bodyId, colspan) {
  const body = document.getElementById(bodyId);
  if (!body) return null;
  hideTablePager(bodyId);
  body.innerHTML = `
    <tr>
      <td colspan="${colspan}" style="text-align:center;padding:30px;color:var(--text-muted);">
        <i class="fas fa-spinner fa-spin" style="margin-right:8px;"></i>
        Đang tải dữ liệu...
      </td>
    </tr>`;
  return body;
}

function setTableEmpty(body, colspan, icon, message) {
  clearTablePager(body.id);
  body.innerHTML = `
    <tr>
      <td colspan="${colspan}" style="text-align:center;padding:30px;color:var(--text-muted);">
        <i class="fas ${icon}" style="display:block;font-size:28px;margin-bottom:10px;"></i>
        ${escapeHtml(message)}
      </td>
    </tr>`;
}

function setTableError(body, colspan, message, retryFunctionName) {
  clearTablePager(body.id);
  body.innerHTML = `
    <tr>
      <td colspan="${colspan}" style="text-align:center;padding:30px;color:var(--danger-neon);">
        <i class="fas fa-triangle-exclamation" style="display:block;font-size:28px;margin-bottom:10px;"></i>
        <div style="margin-bottom:12px;">${escapeHtml(message)}</div>
        <button class="btn" type="button" onclick="window.${retryFunctionName}?.()">
          <i class="fas fa-rotate-right"></i> Thử lại
        </button>
      </td>
    </tr>`;
}

function getTaskStatusText(status) {
  const labels = {
    pending: "Chờ xử lý",
    processing: "Đang thực hiện",
    completed: "Hoàn thành",
    cancelled: "Đã hủy",
  };
  return labels[status] || status || "Chờ xử lý";
}

function currentUserCanDelete() {

  return window.currentUserIsDTV === false;
}

function renderAdminDeleteButton(handlerName, id, title = "Xóa") {
  if (!currentUserCanDelete()) return "";
  return `
    <button
      class="btn-danger admin-delete-action"
      type="button"
      onclick="window.${handlerName}?.('${id}')"
      title="${escapeHtml(title)}"
      style="width: auto; min-height: auto; font-size: 11px; padding: 4px 8px; display: inline-flex; align-items: center; justify-content: center;"
    >
      <i class="fas fa-trash"></i>
    </button>`;
}

async function loadTranslators(force = false) {
  if (window.currentUserIsDTV) return;
  const body = setTableLoading("transactorsTableBody", 5);
  if (!body) return;
  try {
    tableCache.translators = await getCollectionRows("Transactors", 15000, force);
    if (!tableCache.translators.length) {
      setTableEmpty(body, 5, "fa-users", "Chưa có dịch thuật viên nào");
      return;
    }
    setPaginatedRows(
      "transactors",
      "transactorsTableBody",
      tableCache.translators,
      (item) => {
        const active = (item.status || "active") === "active";
        return `<tr>
          <td><strong>${escapeHtml(item.name || "N/A")}</strong></td>
          <td>${escapeHtml(item.email || "N/A")}</td>
          <td>${escapeHtml(item.role || "dtv")}</td>
          <td><span class="badge ${active ? "badge-success" : "badge-warning"}">${active ? "Hoạt động" : "Ngừng hoạt động"}</span></td>
          <td class="admin-only-column">
            <button class="btn-edit admin-edit-action" type="button" onclick="window.openEditTransactor?.('${item.id}')" title="Sửa"><i class="fas fa-edit"></i></button>
            ${renderAdminDeleteButton("deleteTransactorRecord", item.id, "Xóa dịch thuật viên")}
          </td>
        </tr>`;
      },
      force,
    );
  } catch (error) {
    setTableError(body, 5, `Không thể tải DTV: ${error.message}`, "loadTranslators");
  }
}

async function loadSalary(force = false) {
  const isDTV = window.currentUserIsDTV === true;
  const columns = isDTV ? 7 : 8;
  const body = setTableLoading("salaryTableBody", columns);
  if (!body || !runtimeState.roleReady) return;
  try {
    const rows = await getCollectionRows("salary_records", 15000, force);
    const email = runtimeState.currentEmail;
    tableCache.salary = isDTV
      ? rows.filter((item) => String(item.email || item.dtvEmail || "").toLowerCase() === email)
      : rows;
    if (!tableCache.salary.length) {
      setTableEmpty(body, columns, "fa-money-bill-wave", isDTV ? "Chưa có bảng lương của bạn" : "Chưa có bảng lương nào");
      return;
    }
    setPaginatedRows(
      "salary",
      "salaryTableBody",
      tableCache.salary,
      (item) => `<tr>
        <td><strong>${escapeHtml(item.dtvName || item.title || item.name || "N/A")}</strong></td>
        <td>${escapeHtml(item.position || "Dịch thuật viên")}</td>
        <td>${escapeHtml(item.email || "N/A")}</td>
        <td>${formatMoney(item.baseSalary)}</td>
        <td>${formatMoney(item.allowance)}</td>
        <td>${formatMoney(item.bonus)}</td>
        <td>${formatMoney(item.deduction)}</td>
        ${isDTV ? "" : `<td class="admin-only-column">${renderAdminDeleteButton("deleteSalaryRecord", item.id, "Xóa bảng lương")}</td>`}
      </tr>`,
      force,
    );
  } catch (error) {
    setTableError(body, columns, `Không thể tải bảng lương: ${error.message}`, "loadSalary");
  }
}

async function populateDTVSelectOptions() {
  const taskSelect = document.getElementById("taskAssigneeSelect") || document.getElementById("taskAssigneeInput");
  const salarySelect = document.getElementById("salary-email");

  try {
    let translators = tableCache.translators || [];
    if (!translators.length) {
      translators = await getCollectionRows("Transactors", 15000, false);
    }

    if (taskSelect && taskSelect.tagName === "SELECT") {
      taskSelect.innerHTML = '<option value="">-- Chọn Dịch Thuật Viên --</option>';
      if (!translators || translators.length === 0) {
        taskSelect.innerHTML += '<option value="" disabled>Chưa có dịch thuật viên nào</option>';
      } else {
        translators.forEach((dtv) => {
          const email = dtv.email || dtv.dtvCode || "";
          const name = dtv.name || dtv.dtvName || email || "N/A";
          const status = dtv.status || "active";
          const statusLabel = status === "inactive" ? " [Ngừng HD]" : "";
          const option = document.createElement("option");
          option.value = email || name;
          option.dataset.dtvName = name;
          option.textContent = `${name}${email ? ` (${email})` : ""}${statusLabel}`;
          taskSelect.appendChild(option);
        });
      }
    }

    if (salarySelect && salarySelect.tagName === "SELECT") {
      salarySelect.innerHTML = '<option value="">-- Chọn Email DTV --</option>';
      if (!translators || translators.length === 0) {
        salarySelect.innerHTML += '<option value="" disabled>Chưa có dịch thuật viên nào</option>';
      } else {
        translators.forEach((dtv) => {
          const email = dtv.email || dtv.dtvCode || "";
          const name = dtv.name || dtv.dtvName || email || "N/A";
          const status = dtv.status || "active";
          const statusLabel = status === "inactive" ? " [Ngừng HD]" : "";
          if (email) {
            const option = document.createElement("option");
            option.value = email;
            option.dataset.dtvName = name;
            option.textContent = `${email} (${name})${statusLabel}`;
            salarySelect.appendChild(option);
          }
        });
      }

      salarySelect.onchange = () => {
        const selectedOption = salarySelect.options[salarySelect.selectedIndex];
        const dtvNameInput = document.getElementById("ten-dtv");
        if (selectedOption && selectedOption.dataset && selectedOption.dataset.dtvName && dtvNameInput) {
          dtvNameInput.value = selectedOption.dataset.dtvName;
        } else if (dtvNameInput && !salarySelect.value) {
          dtvNameInput.value = "";
        }
      };
    }
  } catch (err) {
    console.error("Lỗi nạp danh sách DTV cho select:", err);
  }
}

async function loadAssignments(force = false) {
  const isDTV = window.currentUserIsDTV === true;
  const columns = 6;
  const body = setTableLoading("assignmentsTableBody", columns);
  populateDTVSelectOptions();
  if (!body || !runtimeState.roleReady) return;
  try {
    const rows = await getCollectionRows("assignments", 15000, force);
    const email = runtimeState.currentEmail;
    tableCache.assignments = isDTV
      ? rows.filter((item) => String(item.dtvCode || item.assigneeEmail || item.email || "").toLowerCase() === email)
      : rows;
    if (!tableCache.assignments.length) {
      setTableEmpty(body, columns, "fa-list-check", isDTV ? "Bạn chưa có task nào" : "Chưa có task nào");
      return;
    }
    setPaginatedRows(
      "assignments",
      "assignmentsTableBody",
      tableCache.assignments,
      (item) => {
        const status = item.status || "pending";
        const progress = typeof item.progress === "number" ? item.progress : (status === "completed" ? 100 : status === "processing" ? 50 : 0);
        let badgeClass = "badge-warning";
        if (status === "completed") badgeClass = "badge-success";
        else if (status === "processing") badgeClass = "badge-info";
        else if (status === "cancelled") badgeClass = "badge-danger";

        const mainNote = item.note || item.desc || "";
        const dtvNote = item.dtvNote || "";
        const noteText = mainNote || dtvNote || "-";
        const hasNote = Boolean(mainNote || dtvNote);
        const fileUrl = item.translationUrl || item.fileUrl || "";
        const truncatedNote = noteText.length > 25 ? noteText.substring(0, 25) + "..." : noteText;

        return `<tr>
          <td><strong>${escapeHtml(item.project || item.title || "N/A")}</strong></td>
          <td>${escapeHtml(item.dtvName || item.dtvCode || "N/A")}</td>
          <td>${formatStoredDate(item.deadline)}</td>
          <td>
            <span class="badge ${badgeClass}">${escapeHtml(getTaskStatusText(status))}</span>
            <div style="font-size: 11px; margin-top: 4px; color: var(--text-muted);">
              <i class="fas fa-tasks"></i> Tiến độ: <strong>${progress}%</strong>
            </div>
          </td>
          <td style="max-width: 220px; font-size: 13px; color: var(--text-muted);" title="${escapeHtml(noteText)}">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
              <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px; display: inline-block;">
                ${escapeHtml(truncatedNote)}
              </span>
              ${hasNote ? `
                <button type="button" class="btn-edit" onclick="window.viewAssignmentNote?.('${item.id}')" style="padding: 2px 7px; font-size: 11px; line-height: 1.3; background: rgba(0, 240, 255, 0.12); color: var(--cyan-neon); border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 4px; cursor: pointer; flex-shrink: 0;" title="Xem chi tiết ghi chú">
                  <i class="fas fa-eye"></i> Xem
                </button>
              ` : ""}
            </div>
            ${fileUrl ? `<div style="margin-top: 4px;"><a href="${escapeHtml(fileUrl)}" target="_blank" rel="noopener noreferrer" style="color: var(--cyan-neon); font-size: 12px; font-weight: bold;"><i class="fas fa-link"></i> Link file dịch</a></div>` : ""}
          </td>
          <td style="white-space: nowrap;">
            ${isDTV ? `
              <button class="btn-submit" type="button" onclick="window.openSubmitFileModal?.('${item.id}')" title="Gửi file dịch thuật cho Admin" style="padding: 4px 10px; font-size: 12px; width: auto; min-height: auto; display: inline-flex; align-items: center; gap: 4px;">
                <i class="fas fa-paperclip"></i> ${fileUrl ? "Sửa File" : "Gửi File"}
              </button>
            ` : `
              ${fileUrl ? `
                <a class="btn-edit" href="${escapeHtml(fileUrl)}" target="_blank" rel="noopener noreferrer" title="Mở file dịch DTV đã gửi" style="background: rgba(0, 255, 135, 0.15); color: var(--success-neon); border: 1px solid rgba(0, 255, 135, 0.4); padding: 4px 8px; font-size: 11px; font-weight: bold; margin-right: 4px; display: inline-flex; align-items: center; gap: 4px; width: auto; min-height: auto; text-decoration: none; border-radius: 4px;">
                  <i class="fas fa-file-export"></i> Xem file
                </a>
              ` : ""}
              <button class="btn-edit admin-edit-action" type="button" onclick="window.openUpdateProgressModal?.('${item.id}')" title="Cập nhật tiến độ" style="padding: 4px 8px; font-size: 11px; width: auto; min-height: auto; display: inline-flex; align-items: center; gap: 4px;">
                <i class="fas fa-chart-line"></i> Tiến độ
              </button>
              ${renderAdminDeleteButton("deleteAssignmentRecord", item.id, "Xóa task")}
            `}
          </td>
        </tr>`;
      },
      force,
    );
  } catch (error) {
    setTableError(body, columns, `Không thể tải task: ${error.message}`, "loadAssignments");
  }
}

async function loadDocuments(force = false) {
  const body = setTableLoading("documentsTableBody", 4);
  if (!body || !runtimeState.roleReady) return;
  try {
    tableCache.documents = await getCollectionRows("documents", 15000, force);
    if (!tableCache.documents.length) {
      setTableEmpty(body, 4, "fa-folder-open", "Chưa có tài liệu nào");
      return;
    }
    setPaginatedRows(
      "documents",
      "documentsTableBody",
      tableCache.documents,
      (item) => {
        const url = item.fileUrl || item.url || "";
        const safeUrl = url.startsWith("https://") || url.startsWith("http://") ? escapeHtml(url) : "";
        return `<tr>
          <td><strong>${escapeHtml(item.tieuDe || item.name || "N/A")}</strong></td>
          <td>${escapeHtml(item.nguoiKy || item.createdBy || "N/A")}</td>
          <td>${formatStoredDate(item.createdAt)}</td>
          <td>
            ${safeUrl ? `<a class="btn-edit" href="${safeUrl}" target="_blank" rel="noopener noreferrer" title="Mở tài liệu"><i class="fas fa-download"></i></a>` : ""}
            ${window.currentUserIsDTV ? "" : renderAdminDeleteButton("deleteDocumentRecord", item.id, "Xóa tài liệu")}
          </td>
        </tr>`;
      },
      force,
    );
  } catch (error) {
    setTableError(body, 4, `Không thể tải tài liệu: ${error.message}`, "loadDocuments");
  }
}

async function confirmAndDelete({ collectionName, id, title, reload }) {
  if (!currentUserCanDelete()) {
    console.warn("Từ chối thao tác xóa: tài khoản hiện tại không phải Admin.");
    if (typeof Swal !== "undefined") {
      await Swal.fire({
        icon: "error",
        title: "Không có quyền",
        text: "Chỉ Admin mới được phép xóa dữ liệu.",
        confirmButtonColor: "#00f0ff",
      });
    } else {
      showToast("⛔ Chỉ Admin mới được phép xóa dữ liệu.", "error");
    }
    return;
  }

  const result = await Swal.fire({
    icon: "warning",
    title,
    text: "Dữ liệu Firestore sẽ bị xóa và không thể hoàn tác.",
    showCancelButton: true,
    confirmButtonText: "Xóa",
    cancelButtonText: "Hủy",
    confirmButtonColor: "#ff3366",
  });
  if (!result.isConfirmed) return;

  try {
    await deleteDoc(doc(db, collectionName, id));
    invalidateCollection(collectionName);
    await reload(true);
    showToast("✅ Đã xóa dữ liệu!", "success");
  } catch (error) {
    console.error(`Lỗi xóa ${collectionName}:`, error);
    showToast(`❌ Không thể xóa: ${error.message}`, "error");
  }
}

window.loadTranslators = loadTranslators;
window.loadSalary = loadSalary;
window.loadAssignments = loadAssignments;
window.loadDocuments = loadDocuments;
window.loadAllManagementTables = async () => {
  await Promise.allSettled([
    loadTranslators(),
    loadSalary(),
    loadAssignments(),
    loadDocuments(),
  ]);
};

window.deleteTransactorRecord = (id) =>
  confirmAndDelete({
    collectionName: "Transactors",
    id,
    title: "Xóa dịch thuật viên?",
    reload: loadTranslators,
  });
window.deleteSalaryRecord = (id) =>
  confirmAndDelete({
    collectionName: "salary_records",
    id,
    title: "Xóa bảng lương?",
    reload: loadSalary,
  });
window.deleteAssignmentRecord = (id) =>
  confirmAndDelete({
    collectionName: "assignments",
    id,
    title: "Xóa task?",
    reload: loadAssignments,
  });
window.deleteDocumentRecord = (id) =>
  confirmAndDelete({
    collectionName: "documents",
    id,
    title: "Xóa tài liệu?",
    reload: loadDocuments,
  });

window.closeModals = () => {
  document
    .querySelectorAll(".modal-overlay")
    .forEach((m) => (m.style.display = "none"));
  document.body.classList.remove("modal-open");
  const addTransName = document.getElementById("addTransName");
  const addTransEmail = document.getElementById("addTransEmail");
  const addTransPass = document.getElementById("addTransPass");
  const addTransRole = document.getElementById("addTransRole");
  const addTransNote = document.getElementById("addTransNote");
  const addTransStatus = document.getElementById("addTransStatus");
  if (addTransName) addTransName.value = "";
  if (addTransEmail) addTransEmail.value = "";
  if (addTransPass) addTransPass.value = "";
  if (addTransRole) addTransRole.value = "dtv";
  if (addTransNote) addTransNote.value = "";
  if (addTransStatus) addTransStatus.value = "active";
  
  const editTransId = document.getElementById("editTransId");
  const editTransName = document.getElementById("editTransName");
  const editTransEmail = document.getElementById("editTransEmail");
  const editTransPass = document.getElementById("editTransPass");
  const editTransRole = document.getElementById("editTransRole");
  if (editTransId) editTransId.value = "";
  if (editTransName) editTransName.value = "";
  if (editTransEmail) editTransEmail.value = "";
  if (editTransPass) editTransPass.value = "";
  if (editTransRole) editTransRole.value = "dtv";
  const editTransStatus = document.getElementById("editTransStatus");
  if (editTransStatus) editTransStatus.value = "active";

  const taskTitleInput = document.getElementById("taskTitleInput");
  const taskAssigneeSelect = document.getElementById("taskAssigneeSelect");
  const taskDeadlineInput = document.getElementById("taskDeadlineInput");
  const taskNoteInput = document.getElementById("taskNoteInput");
  if (taskTitleInput) taskTitleInput.value = "";
  if (taskAssigneeSelect) taskAssigneeSelect.value = "";
  if (taskDeadlineInput) taskDeadlineInput.value = "";
  if (taskNoteInput) taskNoteInput.value = "";

  const progressTaskId = document.getElementById("progressTaskId");
  const progressTaskTitle = document.getElementById("progressTaskTitle");
  const progressTaskAssignee = document.getElementById("progressTaskAssignee");
  const progressTaskStatus = document.getElementById("progressTaskStatus");
  const progressTaskPercentRange = document.getElementById("progressTaskPercentRange");
  const progressTaskPercentNumber = document.getElementById("progressTaskPercentNumber");
  const progressTaskNote = document.getElementById("progressTaskNote");
  if (progressTaskId) progressTaskId.value = "";
  if (progressTaskTitle) progressTaskTitle.value = "";
  if (progressTaskAssignee) progressTaskAssignee.value = "";
  if (progressTaskStatus) progressTaskStatus.value = "pending";
  if (progressTaskPercentRange) progressTaskPercentRange.value = "0";
  if (progressTaskPercentNumber) progressTaskPercentNumber.value = "0";
  if (progressTaskNote) progressTaskNote.value = "";

  const submitFileTaskId = document.getElementById("submitFileTaskId");
  const submitFileTaskTitle = document.getElementById("submitFileTaskTitle");
  const submitFileUrl = document.getElementById("submitFileUrl");
  const submitFileNote = document.getElementById("submitFileNote");
  const submitFileCompleteTask = document.getElementById("submitFileCompleteTask");
  if (submitFileTaskId) submitFileTaskId.value = "";
  if (submitFileTaskTitle) submitFileTaskTitle.value = "";
  if (submitFileUrl) submitFileUrl.value = "";
  if (submitFileNote) submitFileNote.value = "";
  if (submitFileCompleteTask) submitFileCompleteTask.checked = true;
};
function requireAdminPermission(actionLabel = "thao tác này") {
  
  if (window.currentUserIsDTV !== false) {
    showToast(`Bạn không có quyền ${actionLabel}.`, "warning");
    return false;
  }
  return true;
}
window.requireAdminPermission = requireAdminPermission;

window.openSubmitFileModal = (taskId) => {
  const task = (tableCache.assignments || []).find((t) => t.id === taskId);
  if (!task) return showToast("Không tìm thấy thông tin task!", "error");

  const submitFileTaskId = document.getElementById("submitFileTaskId");
  const submitFileTaskTitle = document.getElementById("submitFileTaskTitle");
  const submitFileUrl = document.getElementById("submitFileUrl");
  const submitFileNote = document.getElementById("submitFileNote");

  if (submitFileTaskId) submitFileTaskId.value = task.id;
  if (submitFileTaskTitle) submitFileTaskTitle.value = task.project || task.title || "N/A";
  if (submitFileUrl) submitFileUrl.value = task.translationUrl || task.fileUrl || "";
  if (submitFileNote) submitFileNote.value = task.dtvNote || "";

  document.getElementById("modalSubmitFile").style.display = "flex";
  document.body.classList.add("modal-open");
};

window.openUpdateProgressModal = (taskId) => {
  if (!requireAdminPermission("cập nhật tiến độ task")) return;
  const task = (tableCache.assignments || []).find((t) => t.id === taskId);
  if (!task) return showToast("Không tìm thấy thông tin task!", "error");

  const progressTaskId = document.getElementById("progressTaskId");
  const progressTaskTitle = document.getElementById("progressTaskTitle");
  const progressTaskAssignee = document.getElementById("progressTaskAssignee");
  const progressTaskStatus = document.getElementById("progressTaskStatus");
  const progressTaskPercentRange = document.getElementById("progressTaskPercentRange");
  const progressTaskPercentNumber = document.getElementById("progressTaskPercentNumber");
  const progressTaskNote = document.getElementById("progressTaskNote");
  const progressSubmittedFileContainer = document.getElementById("progressSubmittedFileContainer");

  if (progressTaskId) progressTaskId.value = task.id;
  if (progressTaskTitle) progressTaskTitle.value = task.project || task.title || "N/A";
  if (progressTaskAssignee) progressTaskAssignee.value = `${task.dtvName || "N/A"} (${task.dtvCode || "N/A"})`;
  if (progressTaskStatus) progressTaskStatus.value = task.status || "pending";

  const currentProgress = typeof task.progress === "number" ? task.progress : (task.status === "completed" ? 100 : task.status === "processing" ? 50 : 0);
  if (progressTaskPercentRange) progressTaskPercentRange.value = currentProgress;
  if (progressTaskPercentNumber) progressTaskPercentNumber.value = currentProgress;

  if (progressTaskNote) progressTaskNote.value = task.note || task.desc || "";

  const fileUrl = task.translationUrl || task.fileUrl;
  if (progressSubmittedFileContainer) {
    if (fileUrl) {
      progressSubmittedFileContainer.innerHTML = `
        <label style="color: var(--success-neon); font-weight: bold; display: block; margin-bottom: 4px;">FILE DỊCH TỪ DTV:</label>
        <div>
          <a href="${escapeHtml(fileUrl)}" target="_blank" rel="noopener noreferrer" class="btn-submit" style="background: var(--success-neon); color: #000; text-decoration: none; padding: 6px 12px; font-weight: bold; display: inline-flex; align-items: center; gap: 6px;">
            <i class="fas fa-external-link-alt"></i> Mở File Dịch Thuật
          </a>
        </div>
        ${task.dtvNote ? `<div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Ghi chú DTV: ${escapeHtml(task.dtvNote)}</div>` : ""}
      `;
    } else {
      progressSubmittedFileContainer.innerHTML = `<div style="font-size: 12px; color: var(--text-muted);"><i class="fas fa-info-circle"></i> Chưa có file dịch thuật nào được gửi từ DTV.</div>`;
    }
  }

  document.getElementById("modalProgress").style.display = "flex";
  document.body.classList.add("modal-open");
};

window.viewAssignmentNote = (taskId) => {
  const task = (tableCache.assignments || []).find((t) => t.id === taskId);
  if (!task) return showToast("Không tìm thấy thông tin task!", "error");

  const projectTitle = task.project || task.title || "Nhiệm vụ";
  const mainNote = task.note || task.desc || "";
  const dtvNote = task.dtvNote || "";
  const fileUrl = task.translationUrl || task.fileUrl || "";

  let htmlContent = `
    <div style="text-align: left; background: var(--card-bg, #1e293b); padding: 16px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); font-size: 14px; color: var(--text-muted, #cbd5e1);">
      <div style="margin-bottom: 12px; font-weight: bold; color: var(--cyan-neon, #00f0ff); font-size: 15px;">
        <i class="fas fa-folder"></i> ${escapeHtml(projectTitle)}
      </div>
  `;

  if (mainNote) {
    htmlContent += `
      <div style="margin-bottom: 12px;">
        <div style="font-weight: 600; color: #fff; margin-bottom: 4px; font-size: 13px;">
          <i class="fas fa-sticky-note" style="color: var(--warning-neon, #ffe066);"></i> Ghi chú Admin / Tiến độ:
        </div>
        <div style="white-space: pre-wrap; word-break: break-word; background: rgba(0,0,0,0.25); padding: 10px 12px; border-radius: 6px; line-height: 1.5; color: #f1f5f9; border-left: 3px solid var(--cyan-neon, #00f0ff);">${escapeHtml(mainNote)}</div>
      </div>
    `;
  }

  if (dtvNote) {
    htmlContent += `
      <div style="margin-bottom: 12px;">
        <div style="font-weight: 600; color: #fff; margin-bottom: 4px; font-size: 13px;">
          <i class="fas fa-comment-dots" style="color: var(--success-neon, #00ff87);"></i> Ghi chú từ DTV:
        </div>
        <div style="white-space: pre-wrap; word-break: break-word; background: rgba(0,0,0,0.25); padding: 10px 12px; border-radius: 6px; line-height: 1.5; color: #f1f5f9; border-left: 3px solid var(--success-neon, #00ff87);">${escapeHtml(dtvNote)}</div>
      </div>
    `;
  }

  if (!mainNote && !dtvNote) {
    htmlContent += `
      <div style="font-style: italic; color: #94a3b8; padding: 8px 0;">Không có ghi chú chi tiết cho nhiệm vụ này.</div>
    `;
  }

  if (fileUrl) {
    htmlContent += `
      <div style="margin-top: 12px; padding-top: 10px; border-top: 1px dashed rgba(255,255,255,0.15);">
        <a href="${escapeHtml(fileUrl)}" target="_blank" rel="noopener noreferrer" style="color: var(--cyan-neon, #00f0ff); font-weight: bold; text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
          <i class="fas fa-external-link-alt"></i> Mở Link file dịch
        </a>
      </div>
    `;
  }

  htmlContent += `</div>`;

  if (typeof Swal !== "undefined") {
    Swal.fire({
      title: "Chi tiết Ghi chú",
      html: htmlContent,
      confirmButtonText: "Đóng",
      confirmButtonColor: "#00f0ff",
      background: "#0f172a",
      color: "#ffffff"
    });
  } else {
    alert(`Ghi chú (${projectTitle}):\n\n${mainNote || dtvNote || "Không có ghi chú"}`);
  }
};

document.getElementById("openAddTransactorModal").onclick = () => {
  if (!requireAdminPermission("thêm dịch thuật viên")) return;
  document.getElementById("modalTransactor").style.display = "flex";
};
document.getElementById("openAddSalaryModal").onclick = () => {
  if (!requireAdminPermission("tạo bảng lương")) return;
  populateDTVSelectOptions();
  document.getElementById("modalSalary").style.display = "flex";
};
document.getElementById("openAddTaskModal").onclick = () => {
  if (!requireAdminPermission("phân công task")) return;
  populateDTVSelectOptions();
  document.getElementById("modalTask").style.display = "flex";
};
document.getElementById("openUploadDocModal").onclick = () => {
  if (!requireAdminPermission("tải tài liệu lên")) return;
  document.getElementById("modalDoc").style.display = "flex";
};

async function loadMaintenanceStatus() {
  const toggleInput = document.getElementById("maintenanceToggle");
  if (!toggleInput) return;
  try {
    const docRef = doc(db, "system_settings", "maintenance");
    const docSnap = await getDoc(docRef);
    toggleInput.checked = docSnap.exists()
      ? docSnap.data().isMaintenance
      : false;
  } catch (error) {
    console.error("Lỗi nạp bảo trì:", error);
  }
}

window.toggleMaintenanceMode = async function (element) {
  const isON = element.checked;
  try {
    await setDoc(
      doc(db, "system_settings", "maintenance"),
      { isMaintenance: isON, updatedAt: new Date().toISOString() },
      { merge: true },
    );
    logActivity(isON ? "Bật chế độ Bảo trì" : "Tắt chế độ Bảo trì");
    if (typeof Swal !== "undefined")
      Swal.fire({
        icon: isON ? "warning" : "success",
        title: isON ? "🔴 ĐÃ BẬT!" : "🟢 ĐÃ TẮT!",
        confirmColor: "#00f0ff",
      });
  } catch (err) {
    console.error("Lỗi cập nhật bảo trì:", err);
    element.checked = !isON;
  }
};

function checkAndApplyRole(role, userEmail, userName) {
  const normalizedRole = String(role || "dtv").trim().toLowerCase();
  const normalizedEmail = String(userEmail || "").trim().toLowerCase();
  const isAdmin = normalizedRole === "admin" || normalizedEmail.includes("bqt");
  window.currentUserIsDTV = !isAdmin;
  window.currentUserRole = isAdmin ? "admin" : "dtv";
  runtimeState.roleReady = true;
  if (normalizedEmail) runtimeState.currentEmail = normalizedEmail;

  try {
    localStorage.setItem("cachedUserRole", window.currentUserRole);
    if (normalizedEmail) localStorage.setItem("cachedUserEmail", normalizedEmail);
    if (userName) localStorage.setItem("cachedUserName", userName);
  } catch (err) {}

  const roleDisplay = document.getElementById("userRoleDisplay");
  const nameDisplay = document.getElementById("userNameDisplay");
  const avatarDisplay = document.getElementById("userAvatar");
  const welcomeNameDisplay = document.getElementById("welcomeUserName");

  const displayName = userName || (isAdmin ? "Admin" : "DTV");

  if (roleDisplay) roleDisplay.innerText = isAdmin ? "ADMINISTRATOR" : "DỊCH THUẬT VIÊN";
  if (nameDisplay) nameDisplay.innerText = displayName;
  if (welcomeNameDisplay) welcomeNameDisplay.innerText = displayName;
  if (avatarDisplay) avatarDisplay.innerText = (displayName || userEmail || "A").charAt(0).toUpperCase();

  document.querySelectorAll(".nav-item").forEach((item) => {
    item.style.display = !isAdmin && item.classList.contains("admin-only") ? "none" : "flex";
  });

  document.body.classList.toggle("is-dtv", !isAdmin);
  document.body.classList.toggle("is-admin", isAdmin);

  document.querySelectorAll(".admin-only-action, .admin-only-column, .admin-delete-action, .admin-edit-action").forEach((element) => {
    if (!isAdmin) element.remove();
  });

  const quickActionsWidget = document.getElementById("quickActionsWidget");
  if (quickActionsWidget) quickActionsWidget.style.display = isAdmin ? "block" : "none";

  document.querySelectorAll("#openAddTransactorModal, #openAddSalaryModal, #openAddTaskModal, #openUploadDocModal, #exportSalaryBtn, #exportPersonalSalaryBtn").forEach((button) => {
    button.style.display = isAdmin ? "inline-flex" : "none";
  });

  const salaryTitle = document.getElementById("salaryTitle");
  const salaryNavLabel = document.getElementById("salaryNavLabel");
  if (salaryTitle) salaryTitle.textContent = isAdmin ? "Bảng tính Lương DTV" : "Lương của tôi";
  if (salaryNavLabel) salaryNavLabel.textContent = isAdmin ? "Quản lý Lương" : "Lương của tôi";

  const activeItem = document.querySelector(".nav-item.active");
  if (!activeItem || (!isAdmin && activeItem.classList.contains("admin-only"))) activateTab("dashboard");

  startPresenceHeartbeat();
}

// --- PRESENCE & REALTIME ONLINE TRACKER ---
let presenceInterval = null;
let presenceUnsubscribe = null;

function getSanitizedEmailDocId(email) {
  return String(email || "guest").toLowerCase().replace(/[^a-z0-9]/g, "_");
}

async function sendPresenceHeartbeat() {
  const email = auth.currentUser?.email || runtimeState.currentEmail;
  if (!email) return;
  const docId = getSanitizedEmailDocId(email);
  try {
    await setDoc(doc(db, "user_presence", docId), {
      email: email.toLowerCase(),
      name: document.getElementById("userNameDisplay")?.innerText || email,
      role: window.currentUserRole || "dtv",
      lastActive: Date.now(),
    }, { merge: true });
  } catch (err) {
    console.warn("Presence heartbeat error:", err);
  }
}

async function removeUserPresence() {
  const email = auth.currentUser?.email || runtimeState.currentEmail;
  if (!email) return;
  const docId = getSanitizedEmailDocId(email);
  try {
    await deleteDoc(doc(db, "user_presence", docId));
  } catch (err) {}
}

function startPresenceHeartbeat() {
  sendPresenceHeartbeat();
  if (!presenceInterval) {
    presenceInterval = setInterval(sendPresenceHeartbeat, 30000);
  }

  if (!presenceUnsubscribe) {
    try {
      presenceUnsubscribe = onSnapshot(collection(db, "user_presence"), (snapshot) => {
        const now = Date.now();
        let activeCount = 0;
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.lastActive && (now - Number(data.lastActive)) < 90000) {
            activeCount++;
          }
        });
        if (activeCount === 0 && auth.currentUser) activeCount = 1;

        const activeElement = document.getElementById("statActiveTrans");
        if (activeElement) {
          activeElement.textContent = activeCount;
        }
      }, (err) => console.warn("Presence snapshot listener error:", err));
    } catch (e) {}
  }
}

window.addEventListener("beforeunload", () => {
  removeUserPresence();
});

// Immediate synchronous cached role application on script load
try {
  const cachedRole = localStorage.getItem("cachedUserRole");
  const cachedEmail = localStorage.getItem("cachedUserEmail");
  const cachedName = localStorage.getItem("cachedUserName");
  if (cachedRole && cachedEmail) {
    checkAndApplyRole(cachedRole, cachedEmail, cachedName || "");
  }
} catch (e) {}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    try {
      localStorage.removeItem("cachedUserRole");
      localStorage.removeItem("cachedUserEmail");
      localStorage.removeItem("cachedUserName");
    } catch (e) {}
    window.location.href = "index.html";
    return;
  }
  let userRole = "dtv";
  let userName = user.displayName || user.email.split("@")[0];
  let userStatus = "active";
  let foundInTransactors = false;
  try {
    const transSnap = await getDocs(collection(db, "Transactors"));
    transSnap.forEach((docSnap) => {
      const d = docSnap.data();
      if (d.email && d.email.toLowerCase() === user.email.toLowerCase()) {
        foundInTransactors = true;
        if (d.role) userRole = d.role;
        if (d.name) userName = d.name;
        if (d.status) userStatus = d.status;
      }
    });
    if (!foundInTransactors && user.email) {
      try {
        await setDoc(
          doc(db, "Transactors", user.uid),
          {
            uid: user.uid,
            name: userName,
            email: user.email.toLowerCase(),
            role: userRole,
            status: "active",
            createdAt: new Date().toISOString(),
          },
          { merge: true }
        );
        invalidateCollection("Transactors");
      } catch (autoErr) {
        console.warn("Tự động khôi phục hồ sơ Transactors thất bại:", autoErr);
      }
    }
    const isDTV =
      (userRole && userRole.toLowerCase() === "dtv") ||
      (!userRole && !user.email.includes("bqt"));

    if (
      isDTV &&
      userStatus &&
      userStatus.toLowerCase() !== "active" &&
      userStatus.toLowerCase() !== "hoạt động"
    ) {
      try {
        localStorage.removeItem("cachedUserRole");
        localStorage.removeItem("cachedUserEmail");
        localStorage.removeItem("cachedUserName");
      } catch (e) {}
      await signOut(auth);
      Swal.fire({
        icon: "error",
        title: "⛔ TÀI KHOẢN KHÔNG HOẠT ĐỘNG",
        text: "Tài khoản của bạn hiện không hoạt động. Vui lòng liên hệ Ban Quản Trị!",
        confirmButtonColor: "#ff3366",
      });
      window.location.href = "index.html";
      return;
    }

    if (isDTV) {
      const maintSnap = await getDoc(
        doc(db, "system_settings", "maintenance"),
      );
      if (maintSnap.exists() && maintSnap.data().isMaintenance === true) {
        try {
          localStorage.removeItem("cachedUserRole");
          localStorage.removeItem("cachedUserEmail");
          localStorage.removeItem("cachedUserName");
        } catch (e) {}
        await signOut(auth);
        Swal.fire({
          icon: "warning",
          title: "🔴 BẢO TRÌ",
          text: "Hệ thống đang bảo trì!",
        });
        window.location.href = "index.html";
        return;
      }
    }
    checkAndApplyRole(userRole, user.email, userName);
    activateTab(document.querySelector(".nav-item.active")?.getAttribute("data-tab") || "dashboard");
  } catch (e) {
    console.error("Lỗi kiểm tra quyền:", e);
  }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  try {
    localStorage.removeItem("cachedUserRole");
    localStorage.removeItem("cachedUserEmail");
    localStorage.removeItem("cachedUserName");
    await removeUserPresence();
  } catch (e) {}
  signOut(auth).then(() => {
    window.location.href = "index.html";
  });
});

async function logActivity(action, target = "") {
  try {
    await addDoc(collection(db, "activities"), {
      actorEmail: auth.currentUser?.email || "Admin",
      action: action,
      target: target,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err);
  }
}

let toastContainer = document.getElementById('toastContainer');
if (!toastContainer) {
  toastContainer = document.createElement('div');
  toastContainer.id = 'toastContainer';
  toastContainer.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:10px;pointer-events:none;';
  document.body.appendChild(toastContainer);
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const colors = {
    success: 'border-color:#00ff88;box-shadow:0 0 20px rgba(0,255,136,0.3),inset 0 0 20px rgba(0,255,136,0.05);',
    error: 'border-color:#ff3366;box-shadow:0 0 20px rgba(255,51,102,0.3),inset 0 0 20px rgba(255,51,102,0.05);',
    warning: 'border-color:#ffaa00;box-shadow:0 0 20px rgba(255,170,0,0.3),inset 0 0 20px rgba(255,170,0,0.05);',
    info: 'border-color:#00f0ff;box-shadow:0 0 20px rgba(0,240,255,0.3),inset 0 0 20px rgba(0,240,255,0.05);'
  };
  toast.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;background:rgba(10,11,16,0.95);backdrop-filter:blur(12px);border:1px solid;border-radius:12px;padding:14px 20px;min-width:320px;max-width:420px;pointer-events:auto;${colors[type] || colors.success}animation:toastSlideIn 0.4s cubic-bezier(0.68,-0.55,0.265,1.55);">
      <span style="font-size:22px;flex-shrink:0;">${icons[type] || icons.success}</span>
      <span style="flex:1;color:#e2e8f0;font-size:14px;font-weight:500;font-family:'Roboto',sans-serif;">${message}</span>
      <span style="font-size:16px;cursor:pointer;color:#94a3b8;transition:color 0.2s;" onclick="this.parentElement.parentElement.remove()">&times;</span>
    </div>
  `;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.transition = 'opacity 0.3s,transform 0.3s';
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100px)';
      setTimeout(() => toast.remove(), 300);
    }
  }, 4000);
}

const toastStyle = document.createElement('style');
toastStyle.textContent = `
  @keyframes toastSlideIn {
    from { opacity: 0; transform: translateX(100px) scale(0.9); }
    to { opacity: 1; transform: translateX(0) scale(1); }
  }
`;
document.head.appendChild(toastStyle);

let currentProfileId = null;

function timeAgo(timestamp) {
  if (!timestamp) return "Mới đây";
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec} giây trước`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} giờ trước`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} ngày trước`;
  return date.toLocaleDateString("vi-VN");
}

function getActivityIcon(action, target) {
  const a = (action || "").toLowerCase();
  const t = (target || "").toLowerCase();
  if (a.includes("thêm") || a.includes("add") || a.includes("tạo") || a.includes("create")) return "fas fa-plus-circle";
  if (a.includes("xóa") || a.includes("delete") || a.includes("remove")) return "fas fa-trash-alt";
  if (a.includes("sửa") || a.includes("edit") || a.includes("update") || a.includes("cập nhật")) return "fas fa-edit";
  if (a.includes("xuất") || a.includes("export") || a.includes("bảng lương")) return "fas fa-file-export";
  if (a.includes("tải") || a.includes("upload") || a.includes("tài liệu")) return "fas fa-upload";
  if (a.includes("phân công") || a.includes("task")) return "fas fa-tasks";
  if (a.includes("bảo trì") || a.includes("maintenance")) return "fas fa-shield-alt";
  if (a.includes("backup") || a.includes("sao lưu")) return "fas fa-database";
  return "fas fa-circle";
}

function getActivityIconColor(action) {
  const a = (action || "").toLowerCase();
  if (a.includes("thêm") || a.includes("tạo") || a.includes("upload")) return "green";
  if (a.includes("xóa")) return "red";
  if (a.includes("sửa") || a.includes("cập nhật")) return "cyan";
  if (a.includes("xuất") || a.includes("bảng lương")) return "purple";
  if (a.includes("phân công")) return "orange";
  if (a.includes("bảo trì")) return "orange";
  return "cyan";
}

let dashboardChartInstance = null;

function renderDashboardChart(taskData = null, salaryData = null) {
  const ctx = document.getElementById('dashboardChart');
  if (!ctx) return;
  if (dashboardChartInstance) {
    dashboardChartInstance.destroy();
  }
  
  const taskCounts = taskData || [0,0,0,0,0,0,0,0,0,0,0,0];
  const salaryAmounts = salaryData || [0,0,0,0,0,0,0,0,0,0,0,0];

  dashboardChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'],
      datasets: [
        {
          label: 'Task hoàn thành',
          data: taskCounts,
          borderColor: '#00f0ff',
          backgroundColor: 'rgba(0, 240, 255, 0.1)',
          fill: true,
          tension: 0.25,
          pointBackgroundColor: '#00f0ff',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 2,
          borderWidth: 2,
        },
        {
          label: 'Chi lương (triệu)',
          data: salaryAmounts,
          borderColor: '#7000ff',
          backgroundColor: 'rgba(112, 0, 255, 0.1)',
          fill: true,
          tension: 0.25,
          pointBackgroundColor: '#7000ff',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 2,
          borderWidth: 2,
          yAxisID: 'y1',
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      normalized: true,
      interaction: {
        intersect: false,
        mode: 'index',
      },
      plugins: {
        legend: {
          labels: {
            color: '#94a3b8',
            font: { size: 11 },
            boxWidth: 12,
            padding: 16,
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          titleColor: '#e2e8f0',
          bodyColor: '#94a3b8',
          borderColor: 'rgba(0, 242, 255, 0.2)',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(0, 242, 255, 0.05)', drawBorder: false },
          ticks: { color: '#64748b', font: { size: 10 } }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(0, 242, 255, 0.05)', drawBorder: false },
          ticks: { color: '#64748b', font: { size: 10 } },
          title: {
            display: true,
            text: 'Task',
            color: '#64748b',
            font: { size: 10 }
          }
        },
        y1: {
          position: 'right',
          beginAtZero: true,
          grid: { display: false },
          ticks: { color: '#64748b', font: { size: 10 } },
          title: {
            display: true,
            text: 'Triệu VNĐ',
            color: '#64748b',
            font: { size: 10 }
          }
        }
      }
    }
  });
}

async function loadDashboardData() {
  if (runtimeState.dashboardLoaded || !runtimeState.roleReady) return;
  runtimeState.dashboardLoaded = true;
  try {
    const activityQuery = query(collection(db, "activities"), orderBy("timestamp", "desc"), limit(8));
    const [transRows, allTaskRows, allSalaryRows, activitySnapshot] = await Promise.all([
      getCollectionRows("Transactors"),
      getCollectionRows("assignments"),
      getCollectionRows("salary_records"),
      getDocs(activityQuery),
    ]);
    const email = runtimeState.currentEmail;
    const isDTV = window.currentUserIsDTV === true;
    const userProfile = transRows.find((item) => String(item.email || "").toLowerCase() === email);
    const userDtvCode = String(userProfile?.dtvCode || userProfile?.code || "").toLowerCase();

    const taskRows = isDTV
      ? allTaskRows.filter((item) => {
          const taskEmail = String(item.assigneeEmail || item.email || "").toLowerCase();
          const taskDtvCode = String(item.dtvCode || "").toLowerCase();
          return (
            taskEmail === email ||
            (userDtvCode && taskDtvCode === userDtvCode) ||
            (taskDtvCode && taskDtvCode === email)
          );
        })
      : allTaskRows;

    const salaryRows = isDTV
      ? allSalaryRows.filter((item) => {
          const salEmail = String(item.dtvCode || item.assigneeEmail || item.email || "").toLowerCase();
          const salCode = String(item.dtvCode || "").toLowerCase();
          return salEmail === email || (userDtvCode && salCode === userDtvCode);
        })
      : allSalaryRows;
    let onlineActiveCount = 1;
    try {
      const presenceSnap = await getDocs(collection(db, "user_presence"));
      const now = Date.now();
      let count = 0;
      presenceSnap.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.lastActive && (now - Number(d.lastActive)) < 90000) count++;
      });
      if (count > 0) onlineActiveCount = count;
    } catch (e) {}

    const pendingTasks = taskRows.filter((item) => !["Hoàn thành", "completed"].includes(item.status || item.trangThai || item.state || ""));
    const completedTasks = taskRows.filter((item) => ["Hoàn thành", "completed"].includes(item.status || item.trangThai || item.state || ""));
    const totalSalary = salaryRows.reduce((sum, item) => sum + (Number(item.baseSalary) || 0) + (Number(item.allowance) || 0) + (Number(item.bonus) || 0) - (Number(item.deduction) || 0), 0);
    const activeElement = document.getElementById("statActiveTrans");
    const pendingElement = document.getElementById("statPendingTasks");
    const completedElement = document.getElementById("statDoneTasks");
    const salaryElement = document.getElementById("statTotalSalary");
    if (activeElement) activeElement.textContent = onlineActiveCount;
    if (pendingElement) pendingElement.textContent = pendingTasks.length;
    if (completedElement) completedElement.textContent = completedTasks.length;
    if (salaryElement) salaryElement.textContent = `${formatMoney(totalSalary)} đ`;
    const taskByMonth = new Array(12).fill(0);
    const salaryByMonth = new Array(12).fill(0);
    completedTasks.forEach((item) => {
      const value = item.createdAt || item.timestamp || item.updatedAt || item.ngayTao;
      const date = value?.toDate ? value.toDate() : new Date(value || Date.now());
      const month = date.getMonth();
      if (month >= 0 && month < 12) taskByMonth[month] += 1;
    });
    salaryRows.forEach((item) => {
      const value = item.createdAt || item.timestamp || item.updatedAt || item.ngayTao || item.period || item.thang;
      const date = value?.toDate ? value.toDate() : new Date(value || Date.now());
      const month = date.getMonth();
      const amount = (Number(item.baseSalary) || 0) + (Number(item.allowance) || 0) + (Number(item.bonus) || 0) - (Number(item.deduction) || 0);
      if (month >= 0 && month < 12) salaryByMonth[month] += Math.round(amount / 10000) / 100;
    });
    renderDashboardChart(taskByMonth, salaryByMonth);
    const taskChecklist = document.getElementById("taskChecklist");
    const pendingTaskCount = document.getElementById("pendingTaskCount");
    if (pendingTaskCount) pendingTaskCount.textContent = pendingTasks.length;
    if (taskChecklist) {
      taskChecklist.innerHTML = pendingTasks.length
        ? pendingTasks.slice(0, 5).map((item) => {
            const deadline = item.deadline || "Chưa đặt";
            const urgent = deadline !== "Chưa đặt" && new Date(deadline) < new Date(Date.now() + 259200000);
            const processing = item.status === "processing";
            return `<li class="task-checklist-item"><div class="task-check"><i class="fas fa-check"></i></div><div class="task-info"><div class="task-name">${escapeHtml(item.project || item.title || "N/A")}</div><div class="task-meta"><i class="fas fa-user"></i> ${escapeHtml(item.dtvName || item.dtvCode || "N/A")}<span class="task-deadline ${urgent ? "urgent" : ""}"><i class="fas fa-clock"></i> ${escapeHtml(deadline)}</span><span class="task-badge ${processing ? "processing" : "pending"}">${processing ? "Đang làm" : "Chờ duyệt"}</span></div></div></li>`;
          }).join("")
        : '<li style="color:var(--text-muted);font-size:13px;padding:12px 0">✅ Tất cả task đã hoàn thành!</li>';
    }
    const deadlineRows = taskRows.filter((item) => item.deadline && !["Chưa đặt", "N/A"].includes(item.deadline)).sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
    const deadlineList = document.getElementById("deadlineList");
    const deadlineCount = document.getElementById("deadlineCount");
    if (deadlineCount) deadlineCount.textContent = deadlineRows.length;
    if (deadlineList) {
      deadlineList.innerHTML = deadlineRows.length
        ? deadlineRows.slice(0, 5).map((item) => {
            const diffDays = Math.ceil((new Date(item.deadline) - Date.now()) / 86400000);
            const color = diffDays <= 0 ? "red" : diffDays <= 3 ? "orange" : diffDays <= 7 ? "purple" : "green";
            const label = diffDays <= 0 ? "🔴 QUÁ HẠN" : diffDays <= 7 ? `${item.deadline} (${diffDays} ngày)` : item.deadline;
            return `<li class="deadline-item"><span class="deadline-dot ${color}"></span><div class="deadline-content"><div class="deadline-title">${escapeHtml(item.project || item.title || "N/A")}</div><div class="deadline-sub"><i class="fas fa-user"></i> ${escapeHtml(item.dtvName || item.dtvCode || "N/A")}</div></div><span class="deadline-date">${escapeHtml(label)}</span></li>`;
          }).join("")
        : '<li style="color:var(--text-muted);font-size:13px;padding:12px 0">Không có deadline sắp tới.</li>';
    }
    const activities = activitySnapshot.docs.map((item) => item.data());
    const recentList = document.getElementById("recentActivityList");
    if (recentList) {
      recentList.innerHTML = activities.length
        ? activities.map((item) => {
            const actor = item.actorEmail ? item.actorEmail.split("@")[0] : "Hệ thống";
            return `<li class="activity-feed-item"><div class="activity-feed-avatar">${escapeHtml(actor.charAt(0).toUpperCase())}</div><div class="activity-feed-content"><div><span class="feed-actor">${escapeHtml(actor)}</span><span class="feed-action"> ${escapeHtml(item.action || "")}</span>${item.target ? `<span class="feed-target"> - ${escapeHtml(item.target)}</span>` : ""}</div><div class="feed-time"><i class="far fa-clock"></i> ${escapeHtml(timeAgo(item.timestamp))}</div></div></li>`;
          }).join("")
        : '<li class="activity-empty"><i class="fas fa-inbox"></i><p>Chưa có hoạt động nào.</p></li>';
    }
    const currentUser = auth.currentUser;
    const welcomeName = document.getElementById("welcomeUserName");
    if (currentUser && welcomeName) {
      const profile = transRows.find((item) => String(item.email || "").toLowerCase() === email);
      welcomeName.textContent = profile?.name || currentUser.email.split("@")[0];
    }
    const weatherElement = document.getElementById("welcomeWeather");
    if (weatherElement) {
      const hour = new Date().getHours();
      weatherElement.textContent = hour < 12 ? "Chào buổi sáng ☀️" : hour < 18 ? "Chào buổi chiều 🌤️" : "Chào buổi tối 🌙";
    }
    updateClock();
  } catch (error) {
    runtimeState.dashboardLoaded = false;
    console.error("Dashboard load error:", error);
  }
}
document.getElementById('avatarInput')?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const avatarDiv = document.getElementById('profileAvatar');
    if (avatarDiv) {
      avatarDiv.style.background = `url(${ev.target.result}) center/cover`;
      avatarDiv.style.backgroundImage = `url(${ev.target.result})`;
      const textSpan = document.getElementById('profileAvatarText');
      if (textSpan) textSpan.style.display = 'none';
    }
  };
  reader.readAsDataURL(file);
});

async function loadProfile() {
  const user = auth.currentUser;
  if (!user || !runtimeState.roleReady) return;
  const email = String(user.email || "");
  const fallbackName = user.displayName || email.split("@")[0] || "Người dùng";
  const roleText = window.currentUserIsDTV ? "Dịch thuật viên" : "Quản trị viên";
  const profileEmail = document.getElementById("profileEmail");
  const profileRole = document.getElementById("profileRole");
  const profileRoleText = document.getElementById("profileRoleText");
  const profileDisplayName = document.getElementById("profileDisplayName");
  const profileAvatarText = document.getElementById("profileAvatarText");
  const profileName = document.getElementById("profileName");
  const profileStatus = document.getElementById("profileStatusField");
  if (profileEmail) profileEmail.value = email;
  if (profileRole) profileRole.value = roleText;
  if (profileRoleText) profileRoleText.textContent = roleText;
  if (profileDisplayName) profileDisplayName.textContent = fallbackName;
  if (profileAvatarText) profileAvatarText.textContent = fallbackName.charAt(0).toUpperCase();
  if (profileName) profileName.value = fallbackName;
  if (profileStatus) profileStatus.value = "Hoạt động";
  try {
    const rows = await getCollectionRows("Transactors");
    const profile = rows.find((item) => String(item.email || "").toLowerCase() === email.toLowerCase());
    if (!profile) return;
    currentProfileId = profile.id;
    const name = profile.name || fallbackName;
    if (profileName) profileName.value = name;
    if (profileDisplayName) profileDisplayName.textContent = name;
    if (profileAvatarText) profileAvatarText.textContent = name.charAt(0).toUpperCase();
  } catch (error) {
    console.error("Lỗi tải hồ sơ:", error);
  }
}

document.getElementById("saveProfileBtn").onclick = async () => {
  const name = document.getElementById("profileName").value.trim();

  if (!name) {
    return Swal.fire({
      icon: "warning",
      title: "Thiếu thông tin",
      text: "Vui lòng nhập họ tên!",
    });
  }

  try {
    
    if (currentProfileId) {
      await updateDoc(doc(db, "Transactors", currentProfileId), { name });
      invalidateCollection("Transactors");
    }

    const user = auth.currentUser;
    if (!user) throw new Error("Không tìm thấy người dùng");

    const nameDisplay = document.getElementById("userNameDisplay");
    if (nameDisplay) nameDisplay.innerText = name;
    const avatarDisplay = document.getElementById("userAvatar");
    if (avatarDisplay)
      avatarDisplay.innerText = name.charAt(0).toUpperCase();
    document.getElementById("profileDisplayName").textContent = name;

    Swal.fire({
      icon: "success",
      title: "Đã lưu!",
      text: "Thông tin cá nhân đã được cập nhật.",
      timer: 1500,
      showConfirmButton: false,
    });
  } catch (error) {
    console.error("Lỗi lưu hồ sơ:", error);
    Swal.fire({ icon: "error", title: "Lỗi", text: error.message });
  }
};

document.getElementById("saveTransactorBtn").onclick = async () => {
  if (!requireAdminPermission("thêm dịch thuật viên")) return;
  const name = document.getElementById("addTransName").value.trim();
  const email = document.getElementById("addTransEmail").value.trim();
  const password = document.getElementById("addTransPass").value;
  const role = document.getElementById("addTransRole").value.trim();
  const note = document.getElementById("addTransNote").value.trim();
  const status = document.getElementById("addTransStatus").value.trim();
  if (!name || !email || !password)
    return Swal.fire({
      icon: "warning",
      title: "Thiếu thông tin",
      text: "Vui lòng điền đầy đủ!",
    });

  try {

    const signUpUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`;
    const signUpRes = await fetch(signUpUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email,
        password: password,
        returnSecureToken: false,
      }),
    });
    const signUpData = await signUpRes.json();

    if (signUpData.error) {
      const errMsg = signUpData.error.message;
      if (errMsg === "EMAIL_EXISTS") {
        const normalizedEmail = email.toLowerCase();
        let existingDoc = null;
        try {
          const transSnap = await getDocs(collection(db, "Transactors"));
          transSnap.forEach((docSnap) => {
            const d = docSnap.data();
            if (d.email && String(d.email).trim().toLowerCase() === normalizedEmail) {
              existingDoc = d;
            }
          });
        } catch (err) {
          console.error("Lỗi kiểm tra DTV trong Firestore:", err);
        }

        if (existingDoc) {
          return Swal.fire({
            icon: "warning",
            title: "Email đã có trong danh sách!",
            text: `Email "${email}" đã tồn tại trong Danh sách DTV (${existingDoc.name || "N/A"}). Bạn có thể tìm thấy trong bảng bên dưới.`,
            confirmButtonColor: "#ff3366",
          });
        } else {
          // Email tồn tại trên Auth nhưng CHƯA có trong danh sách DTV (Transactors)!
          let targetUid = null;
          try {
            const signInUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseConfig.apiKey}`;
            const signInRes = await fetch(signInUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: email,
                password: password,
                returnSecureToken: false,
              }),
            });
            const signInData = await signInRes.json();
            if (signInData.localId) {
              targetUid = signInData.localId;
            }
          } catch (signInErr) {
            console.warn("Lỗi xác thực lấy UID:", signInErr);
          }

          if (!targetUid) {
            targetUid = getSanitizedEmailDocId(email);
          }

          await setDoc(doc(db, "Transactors", targetUid), {
            uid: targetUid,
            name,
            email: normalizedEmail,
            password,
            role: role || "dtv",
            note: note ? `${note} (Tự động đồng bộ từ Auth)` : "Tự động đồng bộ từ Auth",
            status: status || "active",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          logActivity("Thêm/Đồng bộ DTV", note ? `${name} - ${note}` : name);
          closeModals();
          invalidateCollection("Transactors");
          await loadTranslators(true);

          return Swal.fire({
            icon: "success",
            title: "Thành công!",
            text: `✅ Email "${email}" đã có tài khoản và hiện đã được bổ sung thành công vào Danh sách DTV!`,
            confirmButtonColor: "#00c853",
          });
        }
      } else if (errMsg === "WEAK_PASSWORD") {
        return Swal.fire({
          icon: "error",
          title: "Mật khẩu yếu",
          text: "Cần ít nhất 6 ký tự!",
        });
      } else {
        return Swal.fire({
          icon: "error",
          title: "Lỗi tạo tài khoản",
          text: errMsg,
        });
      }
    }

    const uid = signUpData.localId;
    
    await setDoc(doc(db, "Transactors", uid), {
      uid,
      name,
      email: email.toLowerCase(),
      password,
      role,
      note,
      status: status || "active",
      createdAt: new Date().toISOString(),
    });
    logActivity("Thêm DTV mới", note ? `${name} - ${note}` : name);
    closeModals();
    invalidateCollection("Transactors");
    await loadTranslators(true);
    Swal.fire({
      icon: "success",
      title: "Thành công!",
      text: "✅ Đã thêm DTV thành công!",
      timer: 2000,
      showConfirmButton: false,
    });
  } catch (error) {
    Swal.fire({
      icon: "error",
      title: "Lỗi hệ thống",
      text: error.message,
    });
  }
};

document.getElementById("saveSalaryBtn").onclick = async () => {
  if (!requireAdminPermission("tạo bảng lương")) return;
  const salarySelect = document.getElementById("salary-email");
  const email = salarySelect ? salarySelect.value.trim() : "";
  const dtvNameInput = document.getElementById("ten-dtv");
  let dtvName = dtvNameInput ? dtvNameInput.value.trim() : "";

  if (!dtvName && salarySelect && salarySelect.selectedIndex >= 0) {
    const selectedOption = salarySelect.options[salarySelect.selectedIndex];
    dtvName = selectedOption?.dataset?.dtvName || email;
  }

  const position = document
    .getElementById("salary-position")
    .value.trim();
  const baseSalary =
    Number(document.getElementById("luong-tap").value) || 0;
  const allowance = Number(document.getElementById("phu-cap").value) || 0;
  const bonus = Number(document.getElementById("thuong-tap").value) || 0;
  const deduction =
    Number(document.getElementById("khau-hao").value) || 0;

  if (!email) return showToast("Vui lòng chọn Email DTV!", "warning");
  if (!dtvName) return showToast("Vui lòng nhập họ tên nhân sự!", "warning");
  try {
    await addDoc(collection(db, "salary_records"), {
      title: dtvName,
      dtvName,
      position: position || "Dịch thuật viên",
      email,
      baseSalary,
      allowance,
      bonus,
      deduction,
      createdAt: new Date().toISOString(),
    });
    logActivity("Tạo bảng lương mới", dtvName);
    closeModals();
    invalidateCollection("salary_records");
    await loadSalary(true);
    showToast("✅ Đã lưu bảng lương!", "success");
  } catch (error) {
    console.error("Lỗi tạo lương:", error);
    showToast("❌ Lỗi: " + error.message, "error");
  }
};

document.getElementById("saveTaskBtn").onclick = async () => {
  if (!requireAdminPermission("phân công task")) return;
  const project = document.getElementById("taskTitleInput").value.trim();
  const select = document.getElementById("taskAssigneeSelect") || document.getElementById("taskAssigneeInput");
  const dtvCode = select ? select.value.trim() : "";
  const selectedOption = select && select.options && select.selectedIndex >= 0 ? select.options[select.selectedIndex] : null;
  const dtvName = selectedOption?.dataset?.dtvName || (selectedOption?.text ? selectedOption.text.split(" (")[0] : dtvCode);
  const deadline = document.getElementById("taskDeadlineInput").value;
  const note = document.getElementById("taskNoteInput")?.value.trim() || "";

  if (!project) return showToast("Vui lòng nhập tên dự án!", "warning");
  if (!dtvCode) return showToast("Vui lòng chọn Dịch Thuật Viên!", "warning");

  try {
    await addDoc(collection(db, "assignments"), {
      project,
      dtvCode,
      dtvName,
      deadline: deadline || "Chưa đặt",
      status: "pending",
      progress: 0,
      note,
      desc: note,
      createdAt: new Date().toISOString(),
    });
    logActivity("Phân công Task mới", project);
    closeModals();
    invalidateCollection("assignments");
    await loadAssignments(true);
    showToast("✅ Đã phân công task!", "success");
  } catch (error) {
    console.error("Lỗi tạo task:", error);
    showToast("❌ Lỗi: " + error.message, "error");
  }
};

document.getElementById("saveProgressBtn").onclick = async () => {
  if (!requireAdminPermission("cập nhật tiến độ task")) return;
  const taskId = document.getElementById("progressTaskId").value;
  const status = document.getElementById("progressTaskStatus").value;
  const progress = Number(document.getElementById("progressTaskPercentNumber").value) || 0;
  const note = document.getElementById("progressTaskNote").value.trim();

  if (!taskId) return showToast("Thiếu ID task!", "error");

  try {
    await updateDoc(doc(db, "assignments", taskId), {
      status,
      progress,
      note,
      desc: note,
      updatedAt: new Date().toISOString(),
    });
    logActivity("Cập nhật tiến độ Task", `Trạng thái: ${getTaskStatusText(status)}, ${progress}%`);
    closeModals();
    invalidateCollection("assignments");
    await loadAssignments(true);
    showToast("✅ Đã cập nhật tiến độ task!", "success");
  } catch (error) {
    console.error("Lỗi cập nhật tiến độ:", error);
    showToast("❌ Lỗi: " + error.message, "error");
  }
};

document.getElementById("saveSubmitFileBtn").onclick = async () => {
  const taskId = document.getElementById("submitFileTaskId")?.value;
  const fileUrl = document.getElementById("submitFileUrl")?.value.trim();
  const dtvNote = document.getElementById("submitFileNote")?.value.trim() || "";
  const completeTask = document.getElementById("submitFileCompleteTask")?.checked;

  if (!taskId) return showToast("Không tìm thấy ID task!", "error");
  if (!fileUrl) return showToast("Vui lòng nhập Link file dịch thuật!", "warning");

  try {
    const updateData = {
      translationUrl: fileUrl,
      fileUrl: fileUrl,
      dtvNote: dtvNote,
      submittedAt: new Date().toISOString(),
    };
    if (completeTask) {
      updateData.status = "completed";
      updateData.progress = 100;
    }
    await updateDoc(doc(db, "assignments", taskId), updateData);
    logActivity("Gửi file dịch thuật", fileUrl);
    closeModals();
    invalidateCollection("assignments");
    await loadAssignments(true);
    showToast("✅ Đã gửi file dịch thuật cho Admin!", "success");
  } catch (error) {
    console.error("Lỗi gửi file dịch thuật:", error);
    showToast("❌ Lỗi gửi file: " + error.message, "error");
  }
};

document.getElementById("saveDocBtn").onclick = async () => {
  if (!requireAdminPermission("tải tài liệu lên")) return;
  const tieuDe = document.getElementById("addDocName").value.trim();
  const fileUrl = document.getElementById("addDocUrl").value.trim();
  if (!tieuDe) return showToast("Vui lòng nhập tên tài liệu!", "warning");
  if (!fileUrl) return showToast("Vui lòng nhập Link tải!", "warning");
  try {
    await addDoc(collection(db, "documents"), {
      tieuDe,
      fileUrl,
      nguoiKy: auth.currentUser?.email || "Admin",
      createdAt: new Date().toLocaleDateString("vi-VN"),
    });
    logActivity("Tải lên tài liệu mới", tieuDe);
    closeModals();
    invalidateCollection("documents");
    await loadDocuments(true);
    showToast("✅ Đã đăng tài liệu!", "success");
  } catch (error) {
    console.error("Lỗi tải tài liệu:", error);
    showToast("❌ Lỗi: " + error.message, "error");
  }
};

document.getElementById("downloadBackupBtn").onclick = async () => {
  if (!requireAdminPermission("xuất dữ liệu backup")) return;
  const button = document.getElementById("downloadBackupBtn");
  const originalContent = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang tạo file';
  try {
    const collectionsToBackup = ["Transactors", "salary_records", "assignments", "documents", "activities", "system_settings"];
    const snapshots = await Promise.all(collectionsToBackup.map((name) => getDocs(collection(db, name))));
    const backupData = {
      exportDate: new Date().toISOString(),
      exportedBy: auth.currentUser?.email || "Admin",
      data: {},
    };
    collectionsToBackup.forEach((name, index) => {
      backupData.data[name] = snapshots[index].docs.map((item) => ({ id: item.id, ...item.data() }));
    });
    const jsonString = JSON.stringify(backupData, null, 2);
    saveAs(new Blob([jsonString], { type: "application/json" }), `Backup_${new Date().toISOString().slice(0, 10)}.json`);
    logActivity("Xuất file backup hệ thống (.json)");
    showToast("✅ Đã xuất file backup thành công!", "success");
  } catch (error) {
    showToast(`❌ Lỗi khi xuất file backup: ${error.message}`, "error");
  } finally {
    button.disabled = false;
    button.innerHTML = originalContent;
  }
};

let selectedBackupData = null;

function resetBackupImporter() {
  selectedBackupData = null;
  const input = document.getElementById("backupFileInput");
  const preview = document.getElementById("backupPreview");
  const body = document.getElementById("backupPreviewBody");
  const confirmButton = document.getElementById("confirmRestoreBackupBtn");
  const fileName = document.getElementById("backupFileName");
  const progress = document.getElementById("backupRestoreProgress");
  if (input) input.value = "";
  if (preview) preview.style.display = "none";
  if (body) body.innerHTML = "";
  if (confirmButton) confirmButton.disabled = true;
  if (fileName) fileName.textContent = "Chưa chọn file";
  if (progress) {
    progress.style.display = "none";
    progress.querySelector("span").style.width = "0%";
  }
}

window.openBackupRestoreModal = function () {
  if (!requireAdminPermission("khôi phục dữ liệu backup")) return;
  resetBackupImporter();
  const modal = document.getElementById("modalBackupRestore");
  modal.style.display = "flex";
  document.body.classList.add("modal-open");
};

window.closeBackupRestoreModal = function () {
  document.getElementById("modalBackupRestore").style.display = "none";
  document.body.classList.remove("modal-open");
  resetBackupImporter();
};

async function parseBackupFile(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".json")) throw new Error("Chỉ chấp nhận file .json");
  if (file.size > 25 * 1024 * 1024) throw new Error("File backup không được lớn hơn 25 MB");
  const parsed = JSON.parse(await file.text());
  if (!parsed || typeof parsed !== "object" || !parsed.data || typeof parsed.data !== "object") {
    throw new Error("Cấu trúc file backup không hợp lệ");
  }
  const allowed = new Set(["Transactors", "salary_records", "assignments", "documents", "activities", "system_settings"]);
  const entries = Object.entries(parsed.data).filter(([name, rows]) => allowed.has(name) && Array.isArray(rows));
  if (!entries.length) throw new Error("File không chứa collection hợp lệ");
  selectedBackupData = { ...parsed, data: Object.fromEntries(entries) };
  const total = entries.reduce((sum, [, rows]) => sum + rows.length, 0);
  document.getElementById("backupFileName").textContent = `${file.name} · ${formatMoney(file.size)} bytes`;
  document.getElementById("backupMeta").textContent = `${parsed.exportDate ? formatStoredDate(parsed.exportDate) : "Không rõ ngày"} · ${total} bản ghi`;
  const previewBody = document.getElementById("backupPreviewBody");
  previewBody.innerHTML = entries.map(([name, rows]) => `<tr><td><strong>${escapeHtml(name)}</strong></td><td>${rows.length}</td></tr>`).join("");
  applyResponsiveTableLabels(previewBody);
  document.getElementById("backupPreview").style.display = "block";
  document.getElementById("confirmRestoreBackupBtn").disabled = false;
}

async function acceptBackupFile(file) {
  try {
    await parseBackupFile(file);
  } catch (error) {
    resetBackupImporter();
    showToast(`❌ ${error.message}`, "error");
  }
}

const backupInput = document.getElementById("backupFileInput");
const backupDropZone = document.getElementById("backupDropZone");
backupInput?.addEventListener("change", (event) => acceptBackupFile(event.target.files?.[0]));
backupDropZone?.addEventListener("click", () => backupInput?.click());
backupDropZone?.addEventListener("dragover", (event) => {
  event.preventDefault();
  backupDropZone.classList.add("dragging");
});
backupDropZone?.addEventListener("dragleave", () => backupDropZone.classList.remove("dragging"));
backupDropZone?.addEventListener("drop", (event) => {
  event.preventDefault();
  backupDropZone.classList.remove("dragging");
  acceptBackupFile(event.dataTransfer?.files?.[0]);
});

document.getElementById("modalBackupRestore")?.addEventListener("click", (event) => {
  if (event.target.id === "modalBackupRestore") window.closeBackupRestoreModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.getElementById("modalBackupRestore")?.style.display === "flex") {
    window.closeBackupRestoreModal();
  }
});

window.restoreBackup = async function () {
  if (!requireAdminPermission("khôi phục dữ liệu backup") || !selectedBackupData) return;
  const result = await Swal.fire({
    icon: "warning",
    title: "Khôi phục dữ liệu?",
    text: "Dữ liệu có cùng mã sẽ được ghi đè. Hành động này không thể hoàn tác.",
    showCancelButton: true,
    confirmButtonText: "Khôi phục",
    cancelButtonText: "Hủy",
    confirmButtonColor: "#ff3366",
  });
  if (!result.isConfirmed) return;
  const confirmButton = document.getElementById("confirmRestoreBackupBtn");
  const progress = document.getElementById("backupRestoreProgress");
  const progressBar = progress.querySelector("span");
  confirmButton.disabled = true;
  progress.style.display = "block";
  const collections = Object.entries(selectedBackupData.data);
  let completed = 0;
  try {
    for (const [collectionName, rows] of collections) {
      for (let offset = 0; offset < rows.length; offset += 450) {
        const batch = writeBatch(db);
        rows.slice(offset, offset + 450).forEach((item) => {
          const { id, ...data } = item || {};
          const reference = id ? doc(db, collectionName, String(id)) : doc(collection(db, collectionName));
          batch.set(reference, data);
        });
        await batch.commit();
      }
      invalidateCollection(collectionName);
      completed += 1;
      progressBar.style.width = `${Math.round(completed / collections.length * 100)}%`;
    }
    logActivity("Khôi phục dữ liệu từ file JSON");
    showToast("✅ Khôi phục dữ liệu thành công!", "success");
    window.closeBackupRestoreModal();
    runtimeState.dashboardLoaded = false;
    activateTab(runtimeState.activeTab);
  } catch (error) {
    confirmButton.disabled = false;
    showToast(`❌ Lỗi khôi phục: ${error.message}`, "error");
  }
};

window.exportSalaryToExcel = async function () {
  if (!requireAdminPermission("xuất toàn bộ bảng lương")) return;
  try {
    const snapshot = await getDocs(collection(db, "salary_records"));
    if (snapshot.empty) {
      return Swal.fire({
        icon: "info",
        title: "Không có dữ liệu",
        text: "Chưa có bảng lương nào để xuất.",
      });
    }

    const monthMap = {};
    snapshot.forEach((docSnap) => {
      const d = docSnap.data();
      const title = d.title || "Không có tiêu đề";
      const dtvName = d.dtvName || title;
      const email = d.email || "";
      const base = Number(d.baseSalary) || 0;
      const allowance = Number(d.allowance) || 0;
      const bonus = Number(d.bonus) || 0;
      const deduction = Number(d.deduction) || 0;
      const total = base + allowance + bonus - deduction;

      let month = "";
      let year = "";
      const mMatch = title.match(/tháng\s*(\d+)/i);
      if (mMatch) month = mMatch[1];
      const yMatch = title.match(/năm\s*(\d{4})/i);
      if (yMatch) year = yMatch[1];
      const key = month ? `Tháng ${month}` : "Khác";

      if (!monthMap[key]) monthMap[key] = [];
      monthMap[key].push({
        dtvName,
        email,
        base,
        allowance,
        bonus,
        deduction,
        total,
        month,
        year,
      });
    });

    const {
      Document,
      Packer,
      Paragraph,
      TextRun,
      Table,
      TableRow,
      TableCell,
      WidthType,
      AlignmentType,
      BorderStyle,
    } = docx;

    const border = {
      style: BorderStyle.SINGLE,
      size: 1,
      color: "000000",
    };

    const cell = (text, opts = {}) => {
      const runs = [
        new TextRun({
          text: String(text),
          font: "Times New Roman",
          size: 22,
          bold: opts.bold || false,
          ...(opts.runOpts || {}),
        }),
      ];
      return new TableCell({
        children: [
          new Paragraph({
            children: runs,
            alignment: opts.alignment || AlignmentType.CENTER,
            spacing: { before: 40, after: 40 },
          }),
        ],
        width: opts.width
          ? { size: opts.width, type: WidthType.DXA }
          : undefined,
        verticalAlign: "center",
        borders: {
          top: border,
          bottom: border,
          left: border,
          right: border,
        },
        ...(opts.cellOpts || {}),
      });
    };

    const children = [];

    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
            font: "Times New Roman",
            size: 24,
            bold: true,
          }),
        ],
      }),
    );
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: "Độc lập – Tự do – Hạnh phúc",
            font: "Times New Roman",
            size: 22,
            bold: false,
            italics: true,
          }),
        ],
      }),
    );

    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: "─".repeat(50),
            font: "Times New Roman",
            size: 20,
          }),
        ],
      }),
    );

    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: "NHÓM DỊCH THUẬT DORAEMON FANSUB VIỆT NAM",
            font: "Times New Roman",
            size: 22,
            bold: true,
            color: "000000",
          }),
        ],
      }),
    );
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: "TRỰC THUỘC DORAFANCLUB VIỆT NAM",
            font: "Times New Roman",
            size: 22,
            bold: true,
            color: "000000",
          }),
        ],
      }),
    );

    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: "─".repeat(50),
            font: "Times New Roman",
            size: 20,
          }),
        ],
      }),
    );

    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        children: [
          new TextRun({
            text: "BAN QUẢN TRỊ",
            font: "Times New Roman",
            size: 22,
            bold: true,
          }),
        ],
      }),
    );

    const now = new Date();
    const day = now.getDate();
    const monthNum = now.getMonth() + 1;
    const yearNum = now.getFullYear();
    children.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: `Đức Nhuận, ngày ${day} tháng ${monthNum} năm ${yearNum}`,
            font: "Times New Roman",
            size: 22,
            italics: true,
          }),
        ],
      }),
    );

    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: `BẢNG LƯƠNG THÁNG ${monthNum}/${yearNum}`,
            font: "Times New Roman",
            size: 28,
            bold: true,
            underline: { type: "single" },
          }),
        ],
      }),
    );

    const tableRows = [];

    tableRows.push(
      new TableRow({
        tableHeader: true,
        children: [
          cell("STT", { bold: true, width: 800 }),
          cell("Họ và tên nhân sự", { bold: true, width: 2500 }),
          cell("Vị trí", { bold: true, width: 1500 }),
          cell("Lương tập (VNĐ)", { bold: true, width: 1800 }),
          cell("Phụ cấp (VNĐ)", { bold: true, width: 1500 }),
          cell("Thưởng (VNĐ)", { bold: true, width: 1500 }),
          cell("Khấu hao (VNĐ)", { bold: true, width: 1500 }),
          cell("Tổng cộng", { bold: true, width: 1500 }),
        ],
      }),
    );

    let stt = 1;
    let grandTotal = 0;
    const allRecords = [];
    Object.values(monthMap).forEach((records) => {
      records.forEach((r) => allRecords.push(r));
    });

    allRecords.forEach((r) => {
      grandTotal += r.total;
      tableRows.push(
        new TableRow({
          children: [
            cell(stt++, { width: 800 }),
            cell(r.dtvName, {
              alignment: AlignmentType.LEFT,
              width: 2500,
            }),
            cell("Dịch thuật viên", { width: 1500 }),
            cell(r.base.toLocaleString("vi-VN"), { width: 1800 }),
            cell(r.allowance.toLocaleString("vi-VN"), { width: 1500 }),
            cell(r.bonus.toLocaleString("vi-VN"), { width: 1500 }),
            cell(r.deduction.toLocaleString("vi-VN"), { width: 1500 }),
            cell(r.total.toLocaleString("vi-VN"), {
              bold: true,
              width: 1500,
            }),
          ],
        }),
      );
    });

    tableRows.push(
      new TableRow({
        children: [
          cell("", { width: 800 }),
          cell("TỔNG CỘNG", {
            bold: true,
            alignment: AlignmentType.RIGHT,
            width: 2500,
          }),
          cell("", { width: 1500 }),
          cell("", { width: 1800 }),
          cell("", { width: 1500 }),
          cell("", { width: 1500 }),
          cell("", { width: 1500 }),
          cell(grandTotal.toLocaleString("vi-VN"), {
            bold: true,
            width: 1500,
          }),
        ],
      }),
    );

    const dataTable = new Table({
      rows: tableRows,
      width: { size: 100, type: WidthType.PERCENTAGE },
    });
    children.push(dataTable);

    children.push(
      new Paragraph({ spacing: { before: 400 }, children: [] }),
    );

    children.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: "TM. BQT DORA FANCLUB VIỆT NAM",
            font: "Times New Roman",
            size: 22,
            bold: true,
          }),
        ],
      }),
    );
    children.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: "Nguyễn Tuấn Khải",
            font: "Times New Roman",
            size: 22,
            bold: true,
          }),
        ],
      }),
    );

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1440,
                bottom: 1440,
                left: 1440,
                right: 1440,
              },
            },
          },
          children: children,
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `BangLuong_Thang${monthNum}_${yearNum}.docx`);

    logActivity("Xuất bảng lương ra file Word");

    Swal.fire({
      icon: "success",
      title: "Xuất thành công!",
      text: `Đã tải file BangLuong_Thang${monthNum}_${yearNum}.docx`,
      timer: 2000,
      showConfirmButton: false,
    });
  } catch (error) {
    console.error("Lỗi xuất Word:", error);
    Swal.fire({
      icon: "error",
      title: "Lỗi xuất file",
      text: error.message,
    });
  }
};

window.exportPersonalSalaryToWord = async function () {
  if (!requireAdminPermission("xuất lương cá nhân")) return;

  try {
    // Load DTV list from transactors
    const transSnapshot = await getDocs(collection(db, "Transactors"));
    const dtvList = [];
    transSnapshot.forEach((docSnap) => {
      const d = docSnap.data();
      dtvList.push({
        id: docSnap.id,
        name: d.name || "Chưa có tên",
        email: (d.email || "").toLowerCase().trim(),
      });
    });

    if (dtvList.length === 0) {
      return Swal.fire({
        icon: "info",
        title: "Danh sách rỗng",
        text: "Chưa có DTV nào trong hệ thống.",
      });
    }

    // Build HTML options for the dropdown
    const optionsHtml = dtvList
      .map(
        (dtv, idx) =>
          `<option value="${idx}">${dtv.name} (${dtv.email})</option>`
      )
      .join("");

    const selectResult = await Swal.fire({
      title: "Chọn Dịch thuật viên",
      html: `<label style="color:#fff;display:block;margin-bottom:8px;font-size:15px;">Chọn DTV để xuất bảng lương cá nhân:</label>
             <select id="swal-dtv-select" style="width:100%;padding:10px;border-radius:8px;border:1px solid #334155;background:#1e293b;color:#fff;font-size:14px;box-sizing:border-box;">
               ${optionsHtml}
             </select>`,
      confirmButtonText: "Xuất lương",
      cancelButtonText: "Hủy",
      showCancelButton: true,
      confirmButtonColor: "#00ff88",
      cancelButtonColor: "#6b7280",
      background: "#0f172a",
      color: "#ffffff",
      customClass: {
        popup: "swal-mobile-optimized",
        htmlContainer: "swal-html-container-mobile",
      },
      preConfirm: () => {
        const sel = document.getElementById("swal-dtv-select");
        if (!sel) return Swal.showValidationMessage("Lỗi giao diện");
        const idx = parseInt(sel.value, 10);
        if (isNaN(idx) || idx < 0 || idx >= dtvList.length)
          return Swal.showValidationMessage("Vui lòng chọn DTV");
        return dtvList[idx];
      },
    });

    if (!selectResult.isConfirmed || !selectResult.value) return;
    const selectedDTV = selectResult.value;

    // Query salary_records for the selected DTV
    const snapshot = await getDocs(collection(db, "salary_records"));
    if (snapshot.empty) {
      return Swal.fire({
        icon: "info",
        title: "Không có dữ liệu",
        text: "Chưa có bảng lương nào được ghi nhận.",
      });
    }

    const records = [];
    snapshot.forEach((docSnap) => {
      const d = docSnap.data();
      const recordEmail = (d.email || "").toLowerCase().trim();
      const recordName = (d.dtvName || "").toLowerCase().trim();
      const targetEmail = selectedDTV.email;
      const targetName = selectedDTV.name.toLowerCase().trim();

      if (
        recordEmail === targetEmail ||
        recordName === targetName ||
        recordName.includes(targetName)
      ) {
        // Avoid duplicates by title
        const exists = records.some(
          (r) => r.title === (d.title || "Không có tiêu đề")
        );
        if (!exists) {
          records.push({
            title: d.title || "Không có tiêu đề",
            base: Number(d.baseSalary) || 0,
            allowance: Number(d.allowance) || 0,
            bonus: Number(d.bonus) || 0,
            deduction: Number(d.deduction) || 0,
          });
        }
      }
    });

    if (records.length === 0) {
      return Swal.fire({
        icon: "info",
        title: "Không tìm thấy",
        text: `Không tìm thấy bảng lương nào cho "${selectedDTV.name}".`,
      });
    }

    // Calculate totals
    let totalBase = 0,
      totalAllowance = 0,
      totalBonus = 0,
      totalDeduction = 0,
      grandTotal = 0;
    records.forEach((r) => {
      totalBase += r.base;
      totalAllowance += r.allowance;
      totalBonus += r.bonus;
      totalDeduction += r.deduction;
      grandTotal += r.base + r.allowance + r.bonus - r.deduction;
    });

    const {
      Document,
      Packer,
      Paragraph,
      TextRun,
      Table,
      TableRow,
      TableCell,
      WidthType,
      AlignmentType,
      BorderStyle,
    } = docx;

    const border = {
      style: BorderStyle.SINGLE,
      size: 1,
      color: "000000",
    };

    const cell = (text, opts = {}) => {
      const runs = [
        new TextRun({
          text: String(text),
          font: "Times New Roman",
          size: 22,
          bold: opts.bold || false,
          ...(opts.runOpts || {}),
        }),
      ];
      return new TableCell({
        children: [
          new Paragraph({
            children: runs,
            alignment: opts.alignment || AlignmentType.CENTER,
            spacing: { before: 40, after: 40 },
          }),
        ],
        width: opts.width
          ? { size: opts.width, type: WidthType.DXA }
          : undefined,
        verticalAlign: "center",
        borders: {
          top: border,
          bottom: border,
          left: border,
          right: border,
        },
        ...(opts.cellOpts || {}),
      });
    };

    const children = [];

    // Header: Republic
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
            font: "Times New Roman",
            size: 24,
            bold: true,
          }),
        ],
      })
    );
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: "Độc lập – Tự do – Hạnh phúc",
            font: "Times New Roman",
            size: 22,
            bold: false,
            italics: true,
          }),
        ],
      })
    );
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: "─".repeat(50),
            font: "Times New Roman",
            size: 20,
          }),
        ],
      })
    );
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: "NHÓM DỊCH THUẬT DORAEMON FANSUB VIỆT NAM",
            font: "Times New Roman",
            size: 22,
            bold: true,
            color: "000000",
          }),
        ],
      })
    );
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: "TRỰC THUỘC DORAFANCLUB VIỆT NAM",
            font: "Times New Roman",
            size: 22,
            bold: true,
            color: "000000",
          }),
        ],
      })
    );
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: "─".repeat(50),
            font: "Times New Roman",
            size: 20,
          }),
        ],
      })
    );

    // Title
    const now = new Date();
    const day = now.getDate();
    const monthNum = now.getMonth() + 1;
    const yearNum = now.getFullYear();

    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        children: [
          new TextRun({
            text: "BẢNG LƯƠNG CÁ NHÂN",
            font: "Times New Roman",
            size: 28,
            bold: true,
            underline: { type: "single" },
          }),
        ],
      })
    );

    // User info
    children.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: `Họ và tên: `,
            font: "Times New Roman",
            size: 22,
            bold: true,
          }),
          new TextRun({
            text: selectedDTV.name,
            font: "Times New Roman",
            size: 22,
          }),
        ],
      })
    );
    children.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: `Email: `,
            font: "Times New Roman",
            size: 22,
            bold: true,
          }),
          new TextRun({
            text: selectedDTV.email || "Chưa có email",
            font: "Times New Roman",
            size: 22,
          }),
        ],
      })
    );
    children.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: `Vai trò: `,
            font: "Times New Roman",
            size: 22,
            bold: true,
          }),
          new TextRun({
            text: "Dịch thuật viên",
            font: "Times New Roman",
            size: 22,
          }),
        ],
      })
    );
    children.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: `Đức Nhuận, ngày ${day} tháng ${monthNum} năm ${yearNum}`,
            font: "Times New Roman",
            size: 22,
            italics: true,
          }),
        ],
      })
    );

    // Data table
    const tableRows = [];

    tableRows.push(
      new TableRow({
        tableHeader: true,
        children: [
          cell("STT", { bold: true, width: 800 }),
          cell("Tháng", { bold: true, width: 2000 }),
          cell("Lương tập (VNĐ)", { bold: true, width: 2000 }),
          cell("Phụ cấp (VNĐ)", { bold: true, width: 1800 }),
          cell("Thưởng (VNĐ)", { bold: true, width: 1800 }),
          cell("Khấu hao (VNĐ)", { bold: true, width: 1800 }),
          cell("Tổng cộng", { bold: true, width: 1800 }),
        ],
      })
    );

    records.forEach((r, idx) => {
      const total = r.base + r.allowance + r.bonus - r.deduction;
      tableRows.push(
        new TableRow({
          children: [
            cell(idx + 1, { width: 800 }),
            cell(r.title, {
              alignment: AlignmentType.LEFT,
              width: 2000,
            }),
            cell(r.base.toLocaleString("vi-VN"), { width: 2000 }),
            cell(r.allowance.toLocaleString("vi-VN"), { width: 1800 }),
            cell(r.bonus.toLocaleString("vi-VN"), { width: 1800 }),
            cell(r.deduction.toLocaleString("vi-VN"), { width: 1800 }),
            cell(total.toLocaleString("vi-VN"), {
              bold: true,
              width: 1800,
            }),
          ],
        })
      );
    });

    // Summary row
    tableRows.push(
      new TableRow({
        children: [
          cell("", { width: 800 }),
          cell("TỔNG CỘNG", {
            bold: true,
            alignment: AlignmentType.RIGHT,
            width: 2000,
          }),
          cell(totalBase.toLocaleString("vi-VN"), {
            bold: true,
            width: 2000,
          }),
          cell(totalAllowance.toLocaleString("vi-VN"), {
            bold: true,
            width: 1800,
          }),
          cell(totalBonus.toLocaleString("vi-VN"), {
            bold: true,
            width: 1800,
          }),
          cell(totalDeduction.toLocaleString("vi-VN"), {
            bold: true,
            width: 1800,
          }),
          cell(grandTotal.toLocaleString("vi-VN"), {
            bold: true,
            width: 1800,
          }),
        ],
      })
    );

    const dataTable = new Table({
      rows: tableRows,
      width: { size: 100, type: WidthType.PERCENTAGE },
    });
    children.push(dataTable);

    // Signature
    children.push(
      new Paragraph({ spacing: { before: 400 }, children: [] })
    );
    children.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: "TM. BQT DORA FANCLUB VIỆT NAM",
            font: "Times New Roman",
            size: 22,
            bold: true,
          }),
        ],
      })
    );
    children.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: "Nguyễn Tuấn Khải",
            font: "Times New Roman",
            size: 22,
            bold: true,
          }),
        ],
      })
    );

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1440,
                bottom: 1440,
                left: 1440,
                right: 1440,
              },
            },
          },
          children: children,
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const safeName = selectedDTV.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "_");
    saveAs(
      blob,
      `LuongCaNhan_${safeName}_Thang${monthNum}_${yearNum}.docx`
    );

    logActivity(`Xuất lương cá nhân cho DTV: ${selectedDTV.name}`);

    Swal.fire({
      icon: "success",
      title: "Xuất thành công!",
      text: `Đã tải file LuongCaNhan_${safeName}_Thang${monthNum}_${yearNum}.docx`,
      timer: 2000,
      showConfirmButton: false,
    });
  } catch (error) {
    console.error("Lỗi xuất lương cá nhân:", error);
    Swal.fire({
      icon: "error",
      title: "Lỗi xuất file",
      text: error.message,
    });
  }
};

window.openEditTransactor = async function (id) {
  try {
    const docSnap = await getDoc(doc(db, "Transactors", id));
    if (!docSnap.exists()) {
      Swal.fire({
        icon: "error",
        title: "Không tìm thấy",
        text: "DTV này không tồn tại hoặc đã bị xóa.",
      });
      return;
    }
    const d = docSnap.data();

    document.getElementById("editTransId").value = id;
    document.getElementById("editTransName").value = d.name || "";
    document.getElementById("editTransEmail").value = d.email || "";
    document.getElementById("editTransPass").value = ""; 
    document.getElementById("editTransRole").value = d.role || "dtv";
    document.getElementById("editTransStatus").value =
      d.status || "active";

    document.getElementById("modalEditTransactor").style.display = "flex";
  } catch (error) {
    console.error("Lỗi mở modal sửa:", error);
    Swal.fire({
      icon: "error",
      title: "Lỗi hệ thống",
      text: error.message,
    });
  }
};

document.getElementById("updateTransactorBtn").onclick = async () => {
  const id = document.getElementById("editTransId").value;
  const name = document.getElementById("editTransName").value.trim();
  const email = document.getElementById("editTransEmail").value.trim();
  const password = document.getElementById("editTransPass").value;
  const role = document.getElementById("editTransRole").value.trim();

  if (!id) return;
  if (!name || !email) {
    return Swal.fire({
      icon: "warning",
      title: "Thiếu thông tin",
      text: "Tên và Email không được để trống.",
    });
  }

  try {
    const docSnap = await getDoc(doc(db, "Transactors", id));
    if (!docSnap.exists()) {
      return Swal.fire({
        icon: "error",
        title: "Không tìm thấy",
        text: "DTV này không còn tồn tại.",
      });
    }
    const oldData = docSnap.data();

    const newStatus = document
      .getElementById("editTransStatus")
      .value.trim();
    await updateDoc(doc(db, "Transactors", id), {
      name,
      email,
      role,
      status: newStatus || "active",
      updatedAt: new Date().toISOString(),
    });

    if (oldData.email && oldData.email !== email) {
      try {
        const user = auth.currentUser;
        if (user && user.uid === id) {
          await updateEmail(user, email);
        } else {

          console.warn(
            "Không thể đổi email Auth của DTV khác khi đang đăng nhập bằng tài khoản admin.",
          );
        }
      } catch (authErr) {
        console.error("Lỗi đổi email Auth:", authErr);
        Swal.fire({
          icon: "warning",
          title: "Đã lưu Firestore",
          text:
            "Đã cập nhật dữ liệu, nhưng không đổi được email đăng nhập: " +
            authErr.message,
        });
      }
    }

    if (password) {
      try {
        const user = auth.currentUser;
        if (user && user.uid === id) {
          await updatePassword(user, password);
        } else {
          console.warn(
            "Không thể đổi mật khẩu Auth của DTV khác khi đang đăng nhập bằng tài khoản admin.",
          );
        }
      } catch (authErr) {
        console.error("Lỗi đổi mật khẩu Auth:", authErr);
        Swal.fire({
          icon: "warning",
          title: "Đã lưu Firestore",
          text:
            "Đã cập nhật dữ liệu, nhưng không đổi được mật khẩu đăng nhập: " +
            authErr.message,
        });
      }
    }

    logActivity("Sửa thông tin DTV", name);
    closeModals();
    invalidateCollection("Transactors");
    await loadTranslators(true);
    Swal.fire({
      icon: "success",
      title: "Thành công!",
      text: "✅ Đã cập nhật thông tin DTV!",
      timer: 2000,
      showConfirmButton: false,
    });
  } catch (error) {
    console.error("Lỗi cập nhật DTV:", error);
    Swal.fire({
      icon: "error",
      title: "Lỗi hệ thống",
      text: error.message,
    });
  }
};

