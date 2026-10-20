/* Fussy_Fran */
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/libs/syapi.ts
var syapi_exports = {};
__export(syapi_exports, {
  addBlockToAttributeView: () => addBlockToAttributeView,
  api: () => api,
  appendBlock: () => appendBlock,
  createDocWithMd: () => createDocWithMd,
  deleteBlock: () => deleteBlock,
  getBlockAttrs: () => getBlockAttrs,
  getChildBlocks: () => getChildBlocks,
  getDailyDocId: () => getDailyDocId,
  listAttributeViews: () => listAttributeViews,
  listDocuments: () => listDocuments,
  lsNotebooks: () => lsNotebooks,
  prependBlock: () => prependBlock,
  renameDoc: () => renameDoc,
  setBlockAttrs: () => setBlockAttrs,
  sql: () => sql,
  todayCompact: () => todayCompact,
  todayStr: () => todayStr,
  updateBlock: () => updateBlock
});
function api(url, data) {
  return new Promise((resolve, reject) => {
    try {
      (0, import_siyuan2.fetchPost)(url, data, (res) => {
        if (res && (res.code === 0 || res.code === void 0)) {
          resolve(res.data ?? res);
        } else {
          reject(new Error(`API ${url} code=${res?.code} msg=${res?.msg}`));
        }
      });
    } catch (e) {
      reject(e);
    }
  });
}
async function lsNotebooks() {
  const data = await api("/api/notebook/lsNotebooks", {});
  const list = data?.notebooks ?? data ?? [];
  return (Array.isArray(list) ? list : []).filter((n) => !n.closed);
}
async function sql(stmt) {
  const data = await api("/api/query/sql", { stmt });
  return Array.isArray(data) ? data : [];
}
async function createDocWithMd(notebook, path, markdown) {
  const data = await api("/api/filetree/createDocWithMd", { notebook, path, markdown });
  return data;
}
async function appendBlock(dataType, data, parentID) {
  return api("/api/block/appendBlock", { dataType, data, parentID });
}
async function prependBlock(dataType, data, parentID) {
  return api("/api/block/prependBlock", { dataType, data, parentID });
}
async function setBlockAttrs(blockID, attrs) {
  await api("/api/attr/setBlockAttrs", { id: blockID, attrs });
}
async function getBlockAttrs(blockID) {
  const attrs = await api("/api/attr/getBlockAttrs", { id: blockID });
  return attrs ?? {};
}
async function getChildBlocks(parentID) {
  const escapedParentID = parentID.replace(/'/g, "''");
  return sql(
    `SELECT id, parent_id, markdown, created FROM blocks WHERE parent_id = '${escapedParentID}' ORDER BY sort ASC`
  );
}
async function listDocuments(limit = 200) {
  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 1e3));
  return sql(
    `SELECT id, box, content, hpath FROM blocks WHERE type = 'd' ORDER BY updated DESC LIMIT ${safeLimit}`
  );
}
async function listAttributeViews() {
  const rows = await sql(
    "SELECT id, box, content FROM blocks WHERE type = 'av' ORDER BY updated DESC"
  );
  return rows.map((row) => ({ ...row, name: row.content || row.id }));
}
async function updateBlock(blockID, dataType, data) {
  await api("/api/block/updateBlock", { id: blockID, dataType, data });
}
async function deleteBlock(blockID) {
  await api("/api/block/deleteBlock", { id: blockID });
}
async function addBlockToAttributeView(attributeViewID, blockID) {
  await api("/api/av/addAttributeViewBlocks", {
    avID: attributeViewID,
    srcs: [{ id: blockID, isDetached: false }]
  });
}
async function renameDoc(box, path, title) {
  await api("/api/filetree/renameDoc", { notebook: box, path, title });
}
async function getDailyDocId(notebookId, dateYYYYMMDD) {
  const rows = await sql(
    `SELECT id FROM blocks WHERE box = '${notebookId}' AND type = 'd' AND (hpath LIKE '/daily note/%${dateYYYYMMDD}%' OR id IN (SELECT root_id FROM attributes WHERE name = 'custom-dailynote-${dateYYYYMMDD}')) LIMIT 1`
  );
  return rows?.[0]?.id ?? null;
}
function todayStr(d = /* @__PURE__ */ new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function todayCompact(d = /* @__PURE__ */ new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}
var import_siyuan2;
var init_syapi = __esm({
  "src/libs/syapi.ts"() {
    "use strict";
    import_siyuan2 = require("siyuan");
  }
});

// src/index.ts
var src_exports = {};
__export(src_exports, {
  default: () => FussyFran
});
module.exports = __toCommonJS(src_exports);
var import_siyuan6 = require("siyuan");

// src/modules/dbBadges.ts
var import_siyuan = require("siyuan");
var DEFAULT_DB = {
  enabled: true,
  hiddenFields: "password,private_info",
  maxLength: 60,
  showFieldNames: true,
  position: "below"
};
var CLS = "ff-db-badges";
var cache = /* @__PURE__ */ new Map();
var pending = /* @__PURE__ */ new Set();
var observer = null;
var scheduled = false;
var boundPlugin = null;
var onStatic = () => boundPlugin && scheduleRefresh(boundPlugin);
var onDynamic = () => boundPlugin && scheduleRefresh(boundPlugin);
var onSwitch = () => boundPlugin && scheduleRefresh(boundPlugin);
var onWs = (e) => {
  if (boundPlugin && e?.detail?.cmd === "transactions") {
    cache.clear();
    scheduleRefresh(boundPlugin);
  }
};
function pickDbConfig(plugin) {
  return { ...DEFAULT_DB, ...plugin.data?.["fussy-config.json"]?.db ?? {} };
}
function initDbBadges(plugin) {
  boundPlugin = plugin;
  plugin.eventBus.on("loaded-protyle-static", onStatic);
  plugin.eventBus.on("loaded-protyle-dynamic", onDynamic);
  plugin.eventBus.on("switch-protyle", onSwitch);
  plugin.eventBus.on("ws-main", onWs);
  if (!observer) {
    observer = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === "attributes" && m.attributeName === "custom-avs") {
          scheduleRefresh(plugin);
          return;
        }
        if (m.type === "childList") {
          for (let i = 0; i < m.addedNodes.length; i++) {
            const n = m.addedNodes[i];
            if (n instanceof HTMLElement && (n.hasAttribute?.("custom-avs") || n.querySelector?.("[custom-avs]"))) {
              scheduleRefresh(plugin);
              return;
            }
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["custom-avs"] });
  }
  scheduleRefresh(plugin);
}
function destroyDbBadges(plugin) {
  plugin.eventBus.off("loaded-protyle-static", onStatic);
  plugin.eventBus.off("loaded-protyle-dynamic", onDynamic);
  plugin.eventBus.off("switch-protyle", onSwitch);
  plugin.eventBus.off("ws-main", onWs);
  boundPlugin = null;
  document.querySelectorAll(`.${CLS}`).forEach((el) => el.remove());
  cache.clear();
  pending.clear();
}
function scheduleRefresh(plugin) {
  if (scheduled) return;
  scheduled = true;
  setTimeout(() => {
    scheduled = false;
    refreshAll(plugin).catch(() => {
    });
  }, 250);
}
async function refreshAll(plugin) {
  const cfg = pickDbConfig(plugin);
  if (!cfg.enabled) {
    document.querySelectorAll(`.${CLS}`).forEach((el) => el.remove());
    return;
  }
  const nodes = document.querySelectorAll("[data-node-id][custom-avs]");
  const list = Array.prototype.slice.call(nodes, 0, 40);
  await Promise.all(list.map((n) => renderNode(plugin, n, cfg)));
}
async function renderNode(plugin, node, cfg) {
  const id = node.dataset.nodeId;
  if (!id || node.closest(".protyle-preview")) return;
  const attrHost = node.querySelector(":scope > .protyle-attr") ?? node.querySelector(".protyle-attr");
  if (!attrHost) return;
  if (node.dataset.type === "NodeAttributeView") return;
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < 3e4) {
    mountHtml(attrHost, hit.html, cfg);
    return;
  }
  if (pending.has(id)) return;
  pending.add(id);
  try {
    const keys = await getKeys(id);
    const html = formatKeys(keys, cfg);
    cache.set(id, { at: Date.now(), html });
    if (document.contains(node)) mountHtml(attrHost, html, cfg);
  } catch {
  } finally {
    pending.delete(id);
  }
}
function getKeys(blockId) {
  return new Promise((resolve, reject) => {
    try {
      (0, import_siyuan.fetchPost)("/api/av/getAttributeViewKeys", { id: blockId }, (res) => {
        if (!res) return reject(new Error("empty"));
        const data = res.code === 0 ? res.data : res;
        const arr = Array.isArray(data) ? data : data?.keys ?? data?.keyValues ?? [];
        resolve(Array.isArray(arr) ? arr : []);
      });
    } catch (e) {
      reject(e);
    }
  });
}
function formatKeys(keys, cfg) {
  const hidden = new Set(cfg.hiddenFields.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
  const items = [];
  for (const k of keys) {
    const name = k?.name ?? k?.keyName ?? k?.key?.name ?? "";
    if (!name || hidden.has(name.toLowerCase())) continue;
    const type = (k?.type ?? k?.keyType ?? k?.key?.type ?? "text").toString();
    const raw = k?.value ?? k?.values ?? k?.keyValues ?? k;
    const text = formatValue(type, raw, cfg.maxLength);
    if (!text) continue;
    items.push(
      `<span class="ff-db-chip" data-ff-type="${escapeAttr(type)}">` + (cfg.showFieldNames ? `<span class="ff-db-name">${escapeHtml(name)}</span>` : "") + `<span class="ff-db-val">${escapeHtml(text)}</span></span>`
    );
  }
  return items.join("");
}
function formatValue(type, v, max) {
  try {
    if (v == null) return "";
    const t = type.toLowerCase();
    const val = v?.value ?? v?.content ?? v;
    if (t.includes("checkbox")) {
      const b = val === true || val === "true" || val?.checked === true || val?.checkbox?.checked;
      return b ? "\u2611" : "\u2610";
    }
    if (t.includes("date")) {
      const s = val?.content ?? val?.start ?? val?.isNotEmpty ?? val;
      const str = typeof s === "string" ? s : JSON.stringify(s);
      return truncate(str.replace("T", " ").slice(0, 16), max);
    }
    if (t.includes("number")) {
      const n = val?.content ?? val?.number?.content ?? val?.number?.formattedContent ?? val;
      return truncate(String(typeof n === "object" ? JSON.stringify(n) : n ?? ""), max);
    }
    if (t.includes("select") || t.includes("rollup") || t.includes("relation")) {
      const arr = val?.mSelect ?? val?.options ?? val;
      if (Array.isArray(arr)) return truncate(arr.map((o) => o?.content ?? o?.name ?? o).join(", "), max);
      if (typeof val === "object" && val?.content) return truncate(String(val.content), max);
    }
    if (typeof val === "string") return truncate(val, max);
    if (typeof val === "number" || typeof val === "boolean") return String(val);
    if (Array.isArray(val)) return truncate(val.map((x) => x?.content ?? x?.text ?? x?.name ?? "").filter(Boolean).join(", "), max);
    if (typeof val === "object") {
      const s = val.content ?? val.text ?? val.value ?? "";
      if (s) return truncate(String(s), max);
      return "";
    }
    return truncate(String(val ?? ""), max);
  } catch {
    return "";
  }
}
function mountHtml(host, inner, cfg) {
  let wrap = host.querySelector(`:scope > .${CLS}`);
  if (!inner) {
    wrap?.remove();
    return;
  }
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = CLS;
    if (cfg.position === "above") host.prepend(wrap);
    else host.append(wrap);
  }
  if (wrap.innerHTML !== inner) wrap.innerHTML = inner;
}
function truncate(s, max) {
  s = (s ?? "").replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max - 1) + "\u2026" : s;
}
function escapeHtml(s) {
  return (s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

// src/modules/quickCapture.ts
var import_siyuan4 = require("siyuan");
init_syapi();

// src/modules/captureStore.ts
init_syapi();
var ATTR = {
  status: "custom-ff-capture-status",
  createdAt: "custom-ff-capture-created",
  sourceUrl: "custom-ff-capture-source",
  tags: "custom-ff-capture-tags",
  targetType: "custom-ff-capture-target-type",
  targetId: "custom-ff-capture-target-id"
};
async function createInboxCapture(inboxDocumentId, content, options = {}) {
  const results = await appendBlock("markdown", content, inboxDocumentId);
  const id = results[0]?.doOperations?.[0]?.id;
  if (!id) throw new Error("SiYuan did not return an ID for the new inbox block");
  const createdAt = Date.now();
  const tags = normalizeTags(options.tags ?? []);
  const attrs = {
    [ATTR.status]: "unsorted",
    [ATTR.createdAt]: String(createdAt),
    [ATTR.tags]: JSON.stringify(tags),
    [ATTR.targetType]: "inbox",
    [ATTR.targetId]: inboxDocumentId
  };
  if (options.sourceUrl) attrs[ATTR.sourceUrl] = options.sourceUrl;
  await setBlockAttrs(id, attrs);
  return {
    id,
    content,
    createdAt,
    sourceUrl: options.sourceUrl,
    tags,
    status: "unsorted",
    targetType: "inbox",
    targetId: inboxDocumentId
  };
}
async function listInboxCaptures(inboxDocumentId) {
  const blocks = await getChildBlocks(inboxDocumentId);
  const captures = await Promise.all(blocks.map(async (block) => {
    const attrs = await getBlockAttrs(block.id);
    const status = attrs[ATTR.status];
    if (status !== "unsorted" && status !== "processed") return null;
    const parsedCreated = Number(attrs[ATTR.createdAt]);
    const createdAt = Number.isFinite(parsedCreated) && parsedCreated > 0 ? parsedCreated : Date.parse(block.created) || Date.now();
    return {
      id: block.id,
      content: block.markdown ?? "",
      createdAt,
      sourceUrl: attrs[ATTR.sourceUrl] || void 0,
      tags: parseTags(attrs[ATTR.tags]),
      status,
      targetType: normalizeTargetType(attrs[ATTR.targetType]),
      targetId: attrs[ATTR.targetId] ?? inboxDocumentId
    };
  }));
  return captures.filter((item) => item !== null).sort((left, right) => right.createdAt - left.createdAt);
}
async function updateCaptureContent(id, content) {
  await updateBlock(id, "markdown", content);
}
async function setCaptureStatus(id, status) {
  await setBlockAttrs(id, { [ATTR.status]: status });
}
async function markCaptureProcessed(id, targetType, targetId) {
  await setBlockAttrs(id, {
    [ATTR.status]: "processed",
    [ATTR.targetType]: targetType,
    [ATTR.targetId]: targetId
  });
}
async function removeCapture(id) {
  await deleteBlock(id);
}
function normalizeTargetType(value) {
  return value === "database" || value === "page" ? value : "inbox";
}
function normalizeTags(tags) {
  return [...new Set(tags.map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean))];
}
function parseTags(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? normalizeTags(parsed.filter((tag) => typeof tag === "string")) : [];
  } catch {
    return [];
  }
}

// src/modules/capturePresets.ts
var import_siyuan3 = require("siyuan");
init_syapi();

// src/modules/captureFormat.ts
var DEFAULT_TIMESTAMP_FORMAT = "DD-MM-YY HH:mm";
var DEFAULT_TEMPLATE = "{text}";
function pad2(value) {
  return String(value).padStart(2, "0");
}
function formatTimestamp(date, format = DEFAULT_TIMESTAMP_FORMAT) {
  const pattern = normalizeTimestampFormat(format);
  const values = {
    YYYY: String(date.getFullYear()),
    YY: String(date.getFullYear()).slice(-2),
    MM: pad2(date.getMonth() + 1),
    DD: pad2(date.getDate()),
    HH: pad2(date.getHours()),
    mm: pad2(date.getMinutes()),
    ss: pad2(date.getSeconds())
  };
  return pattern.replace(/YYYY|YY|MM|DD|HH|mm|ss/g, (token) => values[token] ?? token);
}
function normalizeTimestampFormat(value) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return DEFAULT_TIMESTAMP_FORMAT;
  if (!/[Hh]/.test(trimmed)) return trimmed.toUpperCase();
  return trimmed;
}
function buildTemplateContext(text, tags, sourceUrl, date = /* @__PURE__ */ new Date(), timestampFormat = DEFAULT_TIMESTAMP_FORMAT) {
  const clean = text.trim();
  const title = clean.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? "";
  return {
    text: clean,
    title,
    date: formatTimestamp(date, "DD-MM-YY"),
    time: formatTimestamp(date, "HH:mm"),
    datetime: formatTimestamp(date, timestampFormat),
    tags: tags.map((tag) => `#${tag}#`).join(" "),
    source: sourceUrl.trim()
  };
}
function applyTemplate(template, context) {
  const source = (template ?? "").trim() || DEFAULT_TEMPLATE;
  return source.replace(/\{(text|title|date|time|datetime|tags|source)\}/g, (_match, key) => {
    switch (key) {
      case "text":
        return context.text;
      case "title":
        return context.title;
      case "date":
        return context.date;
      case "time":
        return context.time;
      case "datetime":
        return context.datetime;
      case "tags":
        return context.tags;
      case "source":
        return context.source;
      default:
        return _match;
    }
  });
}
function presetUsesTags(preset) {
  return preset.contentMode === "custom" && /\{tags\}/.test(preset.template || "");
}
function buildPresetContent(preset, text, tags, sourceUrl, date = /* @__PURE__ */ new Date()) {
  const clean = text.trim();
  if (preset.contentMode === "task") {
    const stamp = preset.timestamp ? formatTimestamp(date, preset.timestampFormat) : "";
    return clean.split(/\r?\n/).map((line) => {
      const value = line.trim();
      return value ? `- [ ] ${stamp ? `${stamp} ` : ""}${value}` : "";
    }).join("\n");
  }
  if (preset.contentMode === "custom") {
    const rendered = applyTemplate(
      preset.template,
      buildTemplateContext(clean, tags, sourceUrl, date, preset.timestampFormat)
    );
    return rendered.trim() ? rendered : clean;
  }
  return clean;
}

// src/modules/capturePresets.ts
var PRESET_TARGET_TYPES = ["inbox", "daily", "zettel", "page", "database"];
function createPresetId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
function normalizeCapturePresets(value) {
  if (!Array.isArray(value)) return [];
  const presets = [];
  const seenIds = /* @__PURE__ */ new Set();
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const raw = entry;
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (!name) continue;
    const targetType = PRESET_TARGET_TYPES.includes(raw.targetType) ? raw.targetType : "inbox";
    const targetId = typeof raw.targetId === "string" ? raw.targetId : "";
    if ((targetType === "page" || targetType === "database") && !targetId) continue;
    const taskSupported = targetType === "daily" || targetType === "page";
    const requestedMode = raw.contentMode;
    let contentMode = requestedMode === "text" || requestedMode === "task" || requestedMode === "custom" ? requestedMode : raw.asTask === true ? "task" : "text";
    if (contentMode === "task" && !taskSupported) contentMode = "text";
    let id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : createPresetId();
    if (seenIds.has(id)) id = createPresetId();
    seenIds.add(id);
    presets.push({
      id,
      name,
      targetType,
      targetId,
      targetName: typeof raw.targetName === "string" ? raw.targetName : "",
      notebookId: typeof raw.notebookId === "string" ? raw.notebookId : "",
      notebookName: typeof raw.notebookName === "string" ? raw.notebookName : "",
      path: targetType === "zettel" ? normalizeZettelPath(typeof raw.path === "string" ? raw.path : "") : "",
      tags: normalizeTagList(Array.isArray(raw.tags) ? raw.tags : []),
      contentMode,
      timestamp: contentMode === "task" && raw.timestamp === true,
      timestampFormat: normalizeTimestampFormat(
        typeof raw.timestampFormat === "string" ? raw.timestampFormat : ""
      ),
      template: contentMode === "custom" ? typeof raw.template === "string" && raw.template.trim() ? raw.template : DEFAULT_TEMPLATE : ""
    });
  }
  return presets;
}
function normalizeTagList(value) {
  const input = Array.isArray(value) ? value : [];
  const tags = [];
  const seen = /* @__PURE__ */ new Set();
  for (const item of input) {
    if (typeof item !== "string") continue;
    for (const part of item.split(",")) {
      const tag = part.trim().replace(/^#+/, "").replace(/#+$/, "").trim();
      if (!tag) continue;
      const key = tag.toLocaleLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      tags.push(tag);
    }
  }
  return tags;
}
function parseTagInput(value) {
  return normalizeTagList([value]);
}
function presetTargetKey(preset) {
  if (preset.targetType === "page" || preset.targetType === "database") {
    return `${preset.targetType}:${preset.targetId}`;
  }
  return preset.targetType;
}
function presetTargetLabel(preset, i18n) {
  switch (preset.targetType) {
    case "daily":
      return i18n.quickCaptureDaily || "Today's daily note";
    case "zettel":
      return i18n.quickCaptureZettel || "New timestamp note";
    case "page":
      return `${i18n.quickCapturePage || "Page"}: ${preset.targetName || preset.targetId}`;
    case "database":
      return `${i18n.quickCaptureDatabase || "Database"}: ${preset.targetName || preset.targetId}`;
    default:
      return i18n.quickCaptureInbox || "Unsorted inbox";
  }
}
function describePreset(preset, i18n) {
  const parts = [presetTargetLabel(preset, i18n)];
  if ((preset.targetType === "daily" || preset.targetType === "zettel") && preset.notebookName) {
    parts.push(`${i18n.presetNotebook || "Notebook"}: ${preset.notebookName}`);
  }
  if (preset.targetType === "zettel" && preset.path) parts.push(preset.path);
  if (preset.contentMode === "task") {
    parts.push(i18n.presetContentTask || "Task list");
    if (preset.timestamp) parts.push(`${i18n.presetTimestampShort || "Timestamp"} ${preset.timestampFormat}`);
  } else if (preset.contentMode === "custom") {
    parts.push(i18n.presetContentCustom || "Custom format");
  }
  if (preset.tags.length > 0) parts.push(preset.tags.map((tag) => `#${tag}#`).join(" "));
  return parts.join(" \xB7 ");
}
function renderCapturePresetManager(plugin, container, qc) {
  container.replaceChildren();
  const heading = document.createElement("div");
  heading.className = "ff-settings-title";
  heading.style.marginTop = "20px";
  heading.textContent = plugin.i18n.capturePresets || "Capture presets";
  container.appendChild(heading);
  const description = document.createElement("div");
  description.className = "ff-settings-row";
  description.style.fontSize = "12px";
  description.style.color = "var(--b3-theme-on-surface)";
  description.textContent = plugin.i18n.capturePresetsDesc || "Reusable buttons for the capture dialog, each with its own destination, content format, tags, and timestamp settings.";
  container.appendChild(description);
  const list = document.createElement("div");
  list.className = "ff-preset-list";
  container.appendChild(list);
  const render = () => {
    list.replaceChildren();
    const presets = Array.isArray(qc.capturePresets) ? qc.capturePresets : [];
    if (presets.length === 0) {
      const empty = document.createElement("div");
      empty.className = "ff-preset-empty";
      empty.textContent = plugin.i18n.presetEmpty || "No presets yet";
      list.appendChild(empty);
      return;
    }
    for (const preset of presets) {
      list.appendChild(createPresetRow(plugin, preset, qc, render));
    }
  };
  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "b3-button b3-button--outline";
  addButton.textContent = plugin.i18n.presetAdd || "Add preset";
  addButton.addEventListener("click", () => {
    openCapturePresetEditor(plugin, null, (preset) => {
      qc.capturePresets = [...qc.capturePresets || [], preset];
      render();
    });
  });
  const addTodoButton = document.createElement("button");
  addTodoButton.type = "button";
  addTodoButton.className = "b3-button b3-button--outline";
  addTodoButton.textContent = plugin.i18n.presetAddTodo || "Add todo preset";
  addTodoButton.addEventListener("click", () => {
    openCapturePresetEditor(plugin, null, (preset) => {
      qc.capturePresets = [...qc.capturePresets || [], preset];
      render();
    }, {
      targetType: "page",
      contentMode: "task",
      timestamp: true
    });
  });
  const addRow = document.createElement("div");
  addRow.className = "ff-preset-add-row";
  addRow.append(addButton, addTodoButton);
  container.appendChild(addRow);
  render();
}
function createPresetRow(plugin, preset, qc, rerender) {
  const row = document.createElement("div");
  row.className = "ff-preset-row";
  const info = document.createElement("div");
  info.className = "ff-preset-info";
  const name = document.createElement("strong");
  name.textContent = preset.name;
  info.appendChild(name);
  const summary = document.createElement("span");
  summary.className = "ff-preset-summary";
  summary.textContent = describePreset(preset, plugin.i18n);
  info.appendChild(summary);
  const actions = document.createElement("div");
  actions.className = "ff-preset-actions";
  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "b3-button b3-button--small b3-button--outline";
  editButton.textContent = plugin.i18n.presetEdit || "Edit";
  editButton.addEventListener("click", () => {
    openCapturePresetEditor(plugin, preset, (next) => {
      qc.capturePresets = (qc.capturePresets || []).map((item) => item.id === preset.id ? next : item);
      rerender();
    });
  });
  actions.appendChild(editButton);
  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "b3-button b3-button--small b3-button--cancel";
  deleteButton.textContent = plugin.i18n.presetDelete || "Delete";
  deleteButton.addEventListener("click", () => {
    const message = (plugin.i18n.presetDeleteConfirm || 'Delete preset "{name}"?').replace("{name}", preset.name);
    if (!window.confirm(message)) return;
    qc.capturePresets = (qc.capturePresets || []).filter((item) => item.id !== preset.id);
    rerender();
  });
  actions.appendChild(deleteButton);
  row.appendChild(info);
  row.appendChild(actions);
  return row;
}
function openCapturePresetEditor(plugin, existing, onSave, initial = {}) {
  const i18n = plugin.i18n;
  const basePreset = {
    id: createPresetId(),
    name: "",
    targetType: "zettel",
    targetId: "",
    targetName: "",
    notebookId: "",
    notebookName: "",
    path: "/Cards",
    contentMode: "text",
    timestamp: false,
    timestampFormat: DEFAULT_TIMESTAMP_FORMAT,
    template: DEFAULT_TEMPLATE
  };
  const preset = existing ? { ...existing, tags: [...existing.tags] } : {
    ...basePreset,
    ...initial,
    tags: initial.tags ? [...initial.tags] : []
  };
  const targetOptions = PRESET_TARGET_TYPES.map((type) => {
    const labels = {
      inbox: i18n.quickCaptureInbox || "Unsorted inbox",
      daily: i18n.quickCaptureDaily || "Today's daily note",
      zettel: i18n.quickCaptureZettel || "New timestamp note",
      page: i18n.quickCapturePage || "Page",
      database: i18n.quickCaptureDatabase || "Database"
    };
    return `<option value="${type}" ${preset.targetType === type ? "selected" : ""}>${escapeHtml2(labels[type])}</option>`;
  }).join("");
  const dialog = new import_siyuan3.Dialog({
    title: existing ? i18n.presetEditTitle || "Edit preset" : i18n.presetNewTitle || "New preset",
    content: `<div class="ff-preset-editor">
            <p class="ff-preset-intro">${escapeHtml2(i18n.presetEditorHint || "Create a one-click button for the capture dialog. The button applies these settings, then you write the capture.")}</p>

            <div class="ff-preset-grid">
                <label class="ff-preset-field">
                    <span class="ff-preset-label">${escapeHtml2(i18n.presetName || "Preset name")}</span>
                    <input class="b3-text-field fn__block ff-preset-name" value="${escapeHtml2(preset.name)}" placeholder="${escapeHtml2(i18n.presetNamePlaceholder || "e.g. Journal")}"/>
                    <span class="ff-preset-hint">${escapeHtml2(i18n.presetNameHint || "Shown on the button in Quick Capture.")}</span>
                </label>
                <label class="ff-preset-field">
                    <span class="ff-preset-label">${escapeHtml2(i18n.presetDestination || "Destination")}</span>
                    <select class="b3-select fn__block ff-preset-target-type">${targetOptions}</select>
                    <span class="ff-preset-hint">${escapeHtml2(i18n.presetDestinationHint || "Where this preset sends captures.")}</span>
                </label>
            </div>

            <section class="ff-preset-section">
                <div class="ff-preset-section-title">${escapeHtml2(i18n.presetSectionDestination || "Destination details")}</div>
                <div class="ff-preset-grid">
                    <label class="ff-preset-field ff-preset-editor-row ff-preset-notebook-row">
                        <span class="ff-preset-label">${escapeHtml2(i18n.presetNotebook || "Notebook")}</span>
                        <select class="b3-select fn__block ff-preset-notebook"></select>
                        <span class="ff-preset-hint">${escapeHtml2(i18n.presetNotebookHint || "Used for daily notes or timestamp cards.")}</span>
                    </label>
                    <label class="ff-preset-field ff-preset-editor-row ff-preset-path-row">
                        <span class="ff-preset-label">${escapeHtml2(i18n.presetPath || "Storage path")}</span>
                        <input class="b3-text-field fn__block ff-preset-path" value="${escapeHtml2(preset.path || "/Cards")}" placeholder="/Cards"/>
                        <span class="ff-preset-hint">${escapeHtml2(i18n.presetPathHint || "Folder inside the selected notebook.")}</span>
                    </label>
                    <label class="ff-preset-field ff-preset-field--full ff-preset-editor-row ff-preset-entity-row">
                        <span class="ff-preset-label ff-preset-entity-label">${escapeHtml2(i18n.presetEntity || "Page or database")}</span>
                        <select class="b3-select fn__block ff-preset-entity"></select>
                        <span class="ff-preset-hint">${escapeHtml2(i18n.presetEntityHint || "Choose where this preset should capture into.")}</span>
                    </label>
                </div>
                <div class="ff-preset-note ff-preset-inbox-note">${escapeHtml2(i18n.presetInboxNote || "The unsorted inbox needs no extra destination settings.")}</div>
            </section>

            <section class="ff-preset-section">
                <div class="ff-preset-section-title">${escapeHtml2(i18n.presetSectionContent || "Content")}</div>
                <label class="ff-preset-field">
                    <span class="ff-preset-label">${escapeHtml2(i18n.presetContentStyle || "Content style")}</span>
                    <select class="b3-select fn__block ff-preset-content-mode">
                        <option value="text">${escapeHtml2(i18n.presetContentText || "Plain text")}</option>
                        <option value="task">${escapeHtml2(i18n.presetContentTask || "Task list")}</option>
                        <option value="custom">${escapeHtml2(i18n.presetContentCustom || "Custom format")}</option>
                    </select>
                    <span class="ff-preset-hint">${escapeHtml2(i18n.presetContentHint || "Task list turns each line into a checkbox. Use a Page destination for a todo block.")}</span>
                </label>

                <div class="ff-preset-editor-row ff-preset-task-options">
                    <label class="ff-preset-toggle">
                        <input type="checkbox" class="ff-preset-timestamp" ${preset.timestamp ? "checked" : ""}/>
                        <span class="ff-preset-toggle-text">
                            <span class="ff-preset-label">${escapeHtml2(i18n.presetTimestamp || "Add timestamp to each task")}</span>
                            <span class="ff-preset-hint">${escapeHtml2(i18n.presetTimestampHint || "Prefixes each task with the current date and time.")}</span>
                        </span>
                    </label>
                    <div class="ff-preset-preview">
                        <span class="ff-preset-preview-label">${escapeHtml2(i18n.presetPreview || "Preview")}</span>
                        <code class="ff-preset-format-preview ff-preset-task-preview"></code>
                    </div>
                </div>

                <label class="ff-preset-field ff-preset-editor-row ff-preset-timestamp-format-row">
                    <span class="ff-preset-label">${escapeHtml2(i18n.presetTimestampFormat || "Timestamp format")}</span>
                    <input class="b3-text-field fn__block ff-preset-timestamp-format" value="${escapeHtml2(preset.timestampFormat || DEFAULT_TIMESTAMP_FORMAT)}" placeholder="${escapeHtml2(DEFAULT_TIMESTAMP_FORMAT)}"/>
                    <span class="ff-preset-hint">${escapeHtml2(i18n.presetTimestampFormatHint || "Used by {datetime} and task timestamps. Tokens: YYYY, YY, MM, DD, HH, mm, ss.")}</span>
                </label>

                <div class="ff-preset-editor-row ff-preset-custom-options">
                    <label class="ff-preset-field">
                        <span class="ff-preset-label">${escapeHtml2(i18n.presetTemplate || "Format template")}</span>
                        <textarea class="b3-text-field fn__block ff-preset-template" rows="3" spellcheck="false" placeholder="${escapeHtml2(DEFAULT_TEMPLATE)}">${escapeHtml2(preset.template || DEFAULT_TEMPLATE)}</textarea>
                        <span class="ff-preset-hint">${escapeHtml2(i18n.presetTemplateHint || "Use {text}, {title}, {date}, {time}, {datetime}, {tags}, or {source}.")}</span>
                    </label>
                    <div class="ff-preset-tokens">
                        <span class="ff-preset-tokens-label">${escapeHtml2(i18n.presetInsertToken || "Insert token")}</span>
                        ${["{text}", "{title}", "{date}", "{time}", "{datetime}", "{tags}", "{source}"].map(
      (token) => `<button type="button" class="b3-button b3-button--outline b3-button--small ff-preset-token" data-token="${escapeHtml2(token)}">${escapeHtml2(token)}</button>`
    ).join("")}
                    </div>
                    <div class="ff-preset-preview">
                        <span class="ff-preset-preview-label">${escapeHtml2(i18n.presetPreview || "Preview")}</span>
                        <code class="ff-preset-format-preview ff-preset-custom-preview"></code>
                    </div>
                </div>

                <label class="ff-preset-field">
                    <span class="ff-preset-label">${escapeHtml2(i18n.presetTags || "Tags")}</span>
                    <input class="b3-text-field fn__block ff-preset-tags" value="${escapeHtml2(preset.tags.join(", "))}" placeholder="${escapeHtml2(i18n.quickCaptureTagsPlaceholder || "tag, another tag")}"/>
                    <span class="ff-preset-hint">${escapeHtml2(i18n.presetTagsHint || "Comma-separated tags added to every capture from this preset.")}</span>
                </label>
            </section>

            <div class="ff-preset-editor-actions">
                <button type="button" class="b3-button b3-button--cancel ff-preset-cancel">${escapeHtml2(i18n.cancel || "Cancel")}</button>
                <button type="button" class="b3-button b3-button--text ff-preset-confirm">${escapeHtml2(i18n.presetSave || "Save preset")}</button>
            </div>
        </div>`,
    width: "560px"
  });
  const root = dialog.element.querySelector(".ff-preset-editor");
  const nameInput = root.querySelector(".ff-preset-name");
  const typeSelect = root.querySelector(".ff-preset-target-type");
  const notebookRow = root.querySelector(".ff-preset-notebook-row");
  const notebookSelect = root.querySelector(".ff-preset-notebook");
  const pathRow = root.querySelector(".ff-preset-path-row");
  const pathInput = root.querySelector(".ff-preset-path");
  const entityRow = root.querySelector(".ff-preset-entity-row");
  const entityLabel = root.querySelector(".ff-preset-entity-label");
  const entitySelect = root.querySelector(".ff-preset-entity");
  const tagsInput = root.querySelector(".ff-preset-tags");
  const contentModeSelect = root.querySelector(".ff-preset-content-mode");
  const contentTaskOption = contentModeSelect.querySelector('option[value="task"]');
  const taskOptions = root.querySelector(".ff-preset-task-options");
  const timestampInput = root.querySelector(".ff-preset-timestamp");
  const timestampFormatRow = root.querySelector(".ff-preset-timestamp-format-row");
  const timestampFormatInput = root.querySelector(".ff-preset-timestamp-format");
  const taskPreview = root.querySelector(".ff-preset-task-preview");
  const customOptions = root.querySelector(".ff-preset-custom-options");
  const templateInput = root.querySelector(".ff-preset-template");
  const tokenButtons = Array.from(root.querySelectorAll(".ff-preset-token"));
  const customPreview = root.querySelector(".ff-preset-custom-preview");
  const inboxNote = root.querySelector(".ff-preset-inbox-note");
  const cancelButton = root.querySelector(".ff-preset-cancel");
  const confirmButton = root.querySelector(".ff-preset-confirm");
  contentModeSelect.value = preset.contentMode;
  let notebooksLoaded = false;
  const ensureNotebooks = async () => {
    if (notebooksLoaded) return;
    notebooksLoaded = true;
    const selected = notebookSelect.value || preset.notebookId;
    notebookSelect.replaceChildren();
    notebookSelect.add(new Option(i18n.presetChoose || "Choose\u2026", ""));
    try {
      const notebooks = await lsNotebooks();
      for (const notebook of notebooks) {
        notebookSelect.add(new Option(notebook.name, notebook.id));
      }
      if (selected && !notebooks.some((notebook) => notebook.id === selected)) {
        notebookSelect.add(new Option(preset.notebookName || selected, selected));
      }
      notebookSelect.value = selected;
    } catch (error) {
      (0, import_siyuan3.showMessage)(formatError(error));
    }
  };
  const entitySelection = {
    page: preset.targetType === "page" ? preset.targetId : "",
    database: preset.targetType === "database" ? preset.targetId : ""
  };
  const entityCache = {};
  const ensureEntities = async (type) => {
    const selected = entitySelection[type];
    let items = entityCache[type];
    if (!items) {
      entitySelect.replaceChildren();
      entitySelect.add(new Option("\u2026", ""));
      try {
        if (type === "page") {
          const documents = await listDocuments();
          items = documents.map((document2) => ({
            id: document2.id,
            label: document2.hpath || document2.content || document2.id
          }));
        } else {
          const views = await listAttributeViews();
          items = views.map((view) => ({ id: view.id, label: view.name }));
        }
      } catch (error) {
        (0, import_siyuan3.showMessage)(formatError(error));
        items = [];
      }
      entityCache[type] = items;
    }
    if (typeSelect.value !== type) return;
    entitySelect.replaceChildren();
    entitySelect.add(new Option(i18n.presetChoose || "Choose\u2026", ""));
    for (const item of items) {
      entitySelect.add(new Option(item.label, item.id));
    }
    if (selected && !items.some((item) => item.id === selected)) {
      const fallback = preset.targetType === type && preset.targetId === selected ? preset.targetName : "";
      entitySelect.add(new Option(fallback || selected, selected));
    }
    entitySelect.value = selected;
  };
  const supportsTaskContent = (type) => type === "daily" || type === "page";
  const syncContentModeOptions = () => {
    const supported = supportsTaskContent(typeSelect.value);
    contentTaskOption.hidden = !supported;
    contentTaskOption.disabled = !supported;
    if (!supported && contentModeSelect.value === "task") contentModeSelect.value = "text";
  };
  const updatePreview = () => {
    const mode = contentModeSelect.value;
    const format = normalizeTimestampFormat(timestampFormatInput.value);
    if (mode === "task") {
      const stamp = timestampInput.checked ? `${formatTimestamp(/* @__PURE__ */ new Date(), format)} ` : "";
      taskPreview.textContent = `- [ ] ${stamp}Buy milk`;
    } else if (mode === "custom") {
      const context = buildTemplateContext(
        "Buy milk",
        ["inbox"],
        "https://example.com",
        /* @__PURE__ */ new Date(),
        format
      );
      customPreview.textContent = applyTemplate(templateInput.value, context);
    }
  };
  const syncContent = () => {
    const mode = contentModeSelect.value;
    const taskSupported = supportsTaskContent(typeSelect.value);
    const showTask = mode === "task" && taskSupported;
    const showCustom = mode === "custom";
    taskOptions.classList.toggle("is-visible", showTask);
    customOptions.classList.toggle("is-visible", showCustom);
    timestampFormatRow.classList.toggle(
      "is-visible",
      showTask && timestampInput.checked || showCustom
    );
    updatePreview();
  };
  const syncRows = () => {
    const type = typeSelect.value;
    const showNotebook = type === "daily" || type === "zettel";
    const showPath = type === "zettel";
    const showEntity = type === "page" || type === "database";
    const setVisible = (row, visible) => row.classList.toggle("is-visible", visible);
    syncContentModeOptions();
    setVisible(notebookRow, showNotebook);
    setVisible(pathRow, showPath);
    setVisible(entityRow, showEntity);
    notebookRow.classList.toggle("ff-preset-field--full", type === "daily");
    inboxNote.classList.toggle("is-visible", type === "inbox");
    syncContent();
    if (showNotebook) void ensureNotebooks();
    if (showEntity) {
      entityLabel.textContent = type === "database" ? i18n.quickCaptureDatabase || "Database" : i18n.quickCapturePage || "Page";
      void ensureEntities(type);
    }
  };
  contentModeSelect.addEventListener("change", syncContent);
  timestampInput.addEventListener("change", syncContent);
  timestampFormatInput.addEventListener("input", updatePreview);
  templateInput.addEventListener("input", updatePreview);
  for (const button of tokenButtons) {
    button.addEventListener("click", () => {
      const token = button.dataset.token ?? "";
      const start = templateInput.selectionStart ?? templateInput.value.length;
      const end = templateInput.selectionEnd ?? start;
      templateInput.setRangeText(token, start, end, "end");
      templateInput.focus();
      updatePreview();
    });
  }
  typeSelect.addEventListener("change", syncRows);
  entitySelect.addEventListener("change", () => {
    const type = typeSelect.value;
    if (type === "page" || type === "database") entitySelection[type] = entitySelect.value;
  });
  cancelButton.addEventListener("click", () => dialog.destroy());
  confirmButton.addEventListener("click", () => {
    const name = nameInput.value.trim();
    if (!name) {
      (0, import_siyuan3.showMessage)(i18n.presetNameRequired || "Give the preset a name");
      nameInput.focus();
      return;
    }
    const targetType = typeSelect.value;
    let targetId = "";
    let targetName = "";
    let notebookId = "";
    let notebookName = "";
    let path = "";
    if (targetType === "daily" || targetType === "zettel") {
      notebookId = notebookSelect.value;
      if (!notebookId) {
        (0, import_siyuan3.showMessage)(i18n.presetNotebookRequired || "Choose a notebook");
        return;
      }
      notebookName = notebookSelect.selectedOptions[0]?.textContent ?? "";
    }
    if (targetType === "zettel") {
      path = normalizeZettelPath(pathInput.value);
    }
    if (targetType === "page" || targetType === "database") {
      targetId = entitySelect.value;
      if (!targetId) {
        (0, import_siyuan3.showMessage)(i18n.presetTargetRequired || "Choose a page or database");
        return;
      }
      targetName = entitySelect.selectedOptions[0]?.textContent ?? targetId;
    }
    const requestedMode = contentModeSelect.value;
    const contentMode = requestedMode === "task" && !supportsTaskContent(targetType) ? "text" : requestedMode;
    onSave({
      id: preset.id,
      name,
      targetType,
      targetId,
      targetName,
      notebookId,
      notebookName,
      path,
      tags: parseTagInput(tagsInput.value),
      contentMode,
      timestamp: contentMode === "task" && timestampInput.checked,
      timestampFormat: normalizeTimestampFormat(timestampFormatInput.value),
      template: contentMode === "custom" ? templateInput.value.trim() || DEFAULT_TEMPLATE : ""
    });
    dialog.destroy();
  });
  syncRows();
  nameInput.focus();
}
function normalizeZettelPath(value) {
  const trimmed = value.trim() || "/Cards";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}
function formatError(error) {
  return `[Fussy_Fran] ${error instanceof Error ? error.message : String(error)}`;
}
function escapeHtml2(value) {
  return (value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char] ?? char);
}

// src/modules/quickCapture.ts
var DEFAULT_QC = {
  zettelNotebook: "",
  zettelPath: "/Cards",
  dailyNotebook: "",
  hotkey: "\u21E7\u2318Q",
  inboxDocumentId: "",
  favoriteDatabases: [],
  favoritePages: [],
  recentTargets: [],
  capturePresets: [],
  defaultTarget: "inbox"
};
function pickConfig(plugin) {
  return { ...DEFAULT_QC, ...plugin.data?.["fussy-config.json"]?.quickCapture ?? {} };
}
async function openQuickCapture(plugin, initialText = "") {
  const cfg = pickConfig(plugin);
  const presets = Array.isArray(cfg.capturePresets) ? cfg.capturePresets : [];
  const notebooks = await lsNotebooks().catch(() => []);
  const nbOptions = (sel) => notebooks.map((n) => `<option value="${n.id}" ${n.id === sel ? "selected" : ""}>${escapeHtml3(n.name)}</option>`).join("") || `<option value="">(no notebooks)</option>`;
  const targetOptions = [
    { value: "inbox", label: plugin.i18n.quickCaptureInbox || "Unsorted inbox" },
    { value: "daily", label: plugin.i18n.quickCaptureDaily || "Today's daily note" },
    { value: "zettel", label: plugin.i18n.quickCaptureZettel || "New timestamp note" }
  ];
  const seenTargets = /* @__PURE__ */ new Set();
  for (const target of cfg.favoriteDatabases) {
    if (!target.id || seenTargets.has(`database:${target.id}`)) continue;
    seenTargets.add(`database:${target.id}`);
    targetOptions.push({ value: `database:${target.id}`, label: `${plugin.i18n.quickCaptureDatabase || "Database"}: ${target.name}` });
  }
  for (const target of cfg.favoritePages) {
    if (!target.id || seenTargets.has(`page:${target.id}`)) continue;
    seenTargets.add(`page:${target.id}`);
    targetOptions.push({ value: `page:${target.id}`, label: `${plugin.i18n.quickCapturePage || "Page"}: ${target.name}` });
  }
  for (const target of cfg.recentTargets) {
    const key = `${target.type}:${target.id}`;
    if (!target.id || seenTargets.has(key)) continue;
    seenTargets.add(key);
    targetOptions.push({ value: key, label: `${plugin.i18n.quickCaptureRecent || "Recent"}: ${target.name}` });
  }
  for (const preset of presets) {
    if (preset.targetType !== "page" && preset.targetType !== "database") continue;
    if (!preset.targetId) continue;
    const key = presetTargetKey(preset);
    if (seenTargets.has(key)) continue;
    seenTargets.add(key);
    const typeLabel = preset.targetType === "database" ? plugin.i18n.quickCaptureDatabase || "Database" : plugin.i18n.quickCapturePage || "Page";
    targetOptions.push({
      value: key,
      label: `${typeLabel}: ${preset.targetName || preset.targetId}`
    });
  }
  const defaultTarget = getDefaultTarget(cfg, targetOptions);
  const targetHtml = targetOptions.map(
    (target) => `<option value="${escapeHtml3(target.value)}" ${target.value === defaultTarget ? "selected" : ""}>${escapeHtml3(target.label)}</option>`
  ).join("");
  const presetHtml = presets.length > 0 ? `<div class="ff-qc-presets"><span class="ff-qc-presets-label">${escapeHtml3(plugin.i18n.capturePresets || "Capture presets")}</span>` + presets.map(
    (preset) => `<button type="button" class="b3-button b3-button--outline b3-button--small ff-qc-preset" data-preset-id="${escapeHtml3(preset.id)}" title="${escapeHtml3(describePreset(preset, plugin.i18n))}">${escapeHtml3(preset.name)}</button>`
  ).join("") + `</div>` : "";
  const dlg = new import_siyuan4.Dialog({
    title: plugin.i18n.quickCaptureTitle || "Quick capture",
    content: `<div class="ff-qc" style="padding:12px;display:flex;flex-direction:column;gap:10px;min-width:min(520px,86vw)">` + presetHtml + `<textarea class="b3-text-field fn__block ff-qc-text" rows="4" placeholder="${escapeHtml3(plugin.i18n.quickCapturePlaceholder || "Type it before you forget it\u2026")}">${escapeHtml3(initialText)}</textarea><div class="ff-qc-format-hint"></div><label>${escapeHtml3(plugin.i18n.quickCaptureTarget || "Save to")}<select class="b3-select fn__block ff-qc-target">${targetHtml}</select></label><label class="ff-qc-task-row" style="display:none;align-items:center;gap:6px;margin-top:-4px"><input type="checkbox" class="ff-qc-task"/>${escapeHtml3(plugin.i18n.quickCaptureAsTask || "Add as task block")}</label><div class="ff-qc-row" style="display:flex;gap:8px"><label style="flex:1">${escapeHtml3(plugin.i18n.quickCaptureDailyNb || "Daily notebook")}<select class="b3-select fn__block ff-qc-daily-nb">${nbOptions(cfg.dailyNotebook)}</select></label><label style="flex:1">${escapeHtml3(plugin.i18n.quickCaptureZettelNb || "Cards notebook")}<select class="b3-select fn__block ff-qc-zettel-nb">${nbOptions(cfg.zettelNotebook)}</select></label></div><label class="ff-qc-path-row">${escapeHtml3(plugin.i18n.quickCapturePath || "Cards path")}<input class="b3-text-field fn__block ff-qc-path" value="${escapeHtml3(cfg.zettelPath || "/Cards")}" placeholder="/Cards"/></label><div class="ff-qc-row" style="display:flex;gap:8px"><label style="flex:1">${escapeHtml3(plugin.i18n.quickCaptureTags || "Tags")}<input class="b3-text-field fn__block ff-qc-tags" placeholder="${escapeHtml3(plugin.i18n.quickCaptureTagsPlaceholder || "tag, another tag")}"/></label><label style="flex:1">${escapeHtml3(plugin.i18n.quickCaptureSource || "Source URL")}<input class="b3-text-field fn__block ff-qc-source" type="url"/></label></div><div style="display:flex;gap:8px;justify-content:flex-end"><button class="b3-button b3-button--cancel ff-qc-cancel">${escapeHtml3(plugin.i18n.cancel || "Cancel")}</button><button class="b3-button b3-button--text ff-qc-save">${escapeHtml3(plugin.i18n.save || "Save")} &crarr;</button></div></div>`,
    width: "560px"
  });
  const el = dlg.element.querySelector(".ff-qc");
  const textEl = el.querySelector(".ff-qc-text");
  const cancelBtn = el.querySelector(".ff-qc-cancel");
  const saveBtn = el.querySelector(".ff-qc-save");
  const targetSel = el.querySelector(".ff-qc-target");
  const taskRow = el.querySelector(".ff-qc-task-row");
  const taskInput = el.querySelector(".ff-qc-task");
  const dailyNbSel = el.querySelector(".ff-qc-daily-nb");
  const zettelNbSel = el.querySelector(".ff-qc-zettel-nb");
  const pathRow = el.querySelector(".ff-qc-path-row");
  const pathInput = el.querySelector(".ff-qc-path");
  const tagsInput = el.querySelector(".ff-qc-tags");
  const formatHint = el.querySelector(".ff-qc-format-hint");
  const presetButtons = Array.from(el.querySelectorAll(".ff-qc-preset"));
  let activePreset = null;
  const updatePresetHint = () => {
    if (!activePreset) {
      formatHint.classList.remove("is-visible");
      formatHint.textContent = "";
      return;
    }
    let hint = "";
    if (activePreset.contentMode === "task") {
      hint = activePreset.timestamp ? (plugin.i18n.quickCapturePresetTaskFormat || "Each line becomes a task with timestamp ({format}).").replace("{format}", () => activePreset?.timestampFormat ?? "") : plugin.i18n.quickCapturePresetTask || "Each line becomes a task block.";
    } else if (activePreset.contentMode === "custom") {
      hint = (plugin.i18n.quickCapturePresetFormat || "Preset format: {format}").replace("{format}", () => activePreset?.template ?? "");
    }
    if (!hint) {
      formatHint.classList.remove("is-visible");
      formatHint.textContent = "";
      return;
    }
    formatHint.textContent = hint;
    formatHint.classList.add("is-visible");
  };
  const syncTargetRows = () => {
    const target = targetSel.value;
    const customPreset = activePreset?.contentMode === "custom";
    taskRow.style.display = supportsTaskBlocks(target) && !customPreset ? "flex" : "none";
    pathRow.style.display = target === "zettel" ? "flex" : "none";
    updatePresetHint();
  };
  const setActivePreset = (id) => {
    for (const button of presetButtons) {
      button.classList.toggle("active", button.dataset.presetId === id);
    }
  };
  const clearActivePreset = () => {
    activePreset = null;
    setActivePreset("");
    syncTargetRows();
  };
  const setSelectValue = (select, value, label) => {
    if (!value) return;
    if (!Array.from(select.options).some((option) => option.value === value)) {
      select.add(new Option(label || value, value));
    }
    select.value = value;
  };
  const applyPreset = (preset) => {
    const key = presetTargetKey(preset);
    if (preset.targetType === "page" || preset.targetType === "database") {
      const typeLabel = preset.targetType === "database" ? plugin.i18n.quickCaptureDatabase || "Database" : plugin.i18n.quickCapturePage || "Page";
      setSelectValue(targetSel, key, `${typeLabel}: ${preset.targetName || preset.targetId}`);
    } else {
      setSelectValue(targetSel, key, "");
    }
    if (preset.targetType === "daily") {
      setSelectValue(dailyNbSel, preset.notebookId, preset.notebookName);
    } else if (preset.targetType === "zettel") {
      setSelectValue(zettelNbSel, preset.notebookId, preset.notebookName);
      pathInput.value = preset.path || cfg.zettelPath || "/Cards";
    }
    activePreset = preset;
    tagsInput.value = preset.tags.join(", ");
    taskInput.checked = preset.contentMode === "task" && supportsTaskBlocks(key);
    syncTargetRows();
    setActivePreset(preset.id);
    textEl.focus();
  };
  for (const button of presetButtons) {
    const preset = presets.find((item) => item.id === button.dataset.presetId);
    if (preset) button.addEventListener("click", () => applyPreset(preset));
  }
  targetSel.addEventListener("change", clearActivePreset);
  dailyNbSel.addEventListener("change", clearActivePreset);
  zettelNbSel.addEventListener("change", clearActivePreset);
  pathInput.addEventListener("input", clearActivePreset);
  taskInput.addEventListener("change", clearActivePreset);
  syncTargetRows();
  textEl.focus();
  cancelBtn.addEventListener("click", () => dlg.destroy());
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      saveBtn.click();
    }
    if (e.key === "Escape") dlg.destroy();
  });
  saveBtn.addEventListener("click", async () => {
    const text = textEl.value.trim();
    if (!text) {
      (0, import_siyuan4.showMessage)(plugin.i18n.quickCaptureEmpty || "Nothing to save");
      return;
    }
    const target = targetSel.value;
    const dailyNb = dailyNbSel.value;
    const zettelNb = zettelNbSel.value;
    const tags = parseTagInput(tagsInput.value);
    const sourceUrl = el.querySelector(".ff-qc-source").value.trim();
    const asTask = supportsTaskBlocks(target) && taskInput.checked;
    const active = activePreset;
    const includeTags = !active || !presetUsesTags(active);
    const presetText = active ? buildPresetContent(active, text, tags, sourceUrl) : "";
    const zettelPath = pathInput.value.trim() || cfg.zettelPath;
    const recentTargets = updateRecentTargets(cfg, target);
    plugin.persistNotebookPick?.({ dailyNotebook: dailyNb, zettelNotebook: zettelNb, recentTargets });
    try {
      if (sourceUrl && !isSafeHttpUrl(sourceUrl)) throw new Error("Source URL must use http or https");
      if (target === "daily") {
        const markdown = active ? active.contentMode === "text" ? toDailyMarkdown(presetText) : presetText : asTask ? toTaskMarkdown(text) : toDailyMarkdown(text);
        await saveToDaily(plugin, dailyNb || cfg.dailyNotebook, markdown, tags, includeTags);
      } else if (target === "zettel") {
        const markdown = active ? presetText : text;
        await saveAsZettel(plugin, zettelNb || cfg.zettelNotebook, zettelPath, markdown, tags, includeTags);
      } else if (target === "inbox") {
        if (!cfg.inboxDocumentId) throw new Error(plugin.i18n.quickCaptureNeedInbox || "Choose an inbox page in Quick Capture settings first.");
        await createInboxCapture(cfg.inboxDocumentId, active ? presetText : text, { tags, sourceUrl });
        (0, import_siyuan4.showMessage)(plugin.i18n.quickCaptureSavedInbox || "Saved to the unsorted inbox");
      } else {
        const separator = target.indexOf(":");
        const targetType = target.slice(0, separator);
        const targetId = target.slice(separator + 1);
        if (!targetId || targetType !== "page" && targetType !== "database") throw new Error("Invalid capture destination");
        if (targetType === "page") {
          const markdown = active ? presetText : asTask ? toTaskMarkdown(text) : text;
          await appendBlock("markdown", includeTags ? appendTags(markdown, tags) : markdown, targetId);
          (0, import_siyuan4.showMessage)(plugin.i18n.quickCaptureSavedPage || "Saved to page");
        } else {
          if (!cfg.inboxDocumentId) throw new Error(plugin.i18n.quickCaptureNeedInbox || "Choose an inbox page in Quick Capture settings first.");
          const item = await createInboxCapture(cfg.inboxDocumentId, active ? presetText : text, { tags, sourceUrl });
          await addBlockToAttributeView(targetId, item.id);
          await markCaptureProcessed(item.id, "database", targetId);
          (0, import_siyuan4.showMessage)(plugin.i18n.quickCaptureSavedDatabase || "Added to database");
        }
      }
      dlg.destroy();
    } catch (error) {
      (0, import_siyuan4.showMessage)(`[Fussy_Fran] ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}
function getDefaultTarget(cfg, options) {
  if (options.some((option) => option.value === cfg.defaultTarget)) return cfg.defaultTarget;
  if (cfg.defaultTarget === "page") return cfg.favoritePages[0] ? `page:${cfg.favoritePages[0].id}` : "inbox";
  if (cfg.defaultTarget === "database") return cfg.favoriteDatabases[0] ? `database:${cfg.favoriteDatabases[0].id}` : "inbox";
  return "inbox";
}
function updateRecentTargets(cfg, target) {
  const separator = target.indexOf(":");
  const type = target.slice(0, separator);
  const id = target.slice(separator + 1);
  if (!id || type !== "page" && type !== "database") return cfg.recentTargets;
  const targetType = type;
  const favorites = targetType === "page" ? cfg.favoritePages : cfg.favoriteDatabases;
  const presetName = cfg.capturePresets.find((item) => presetTargetKey(item) === `${targetType}:${id}`)?.targetName;
  const name = favorites.find((item) => item.id === id)?.name || presetName || cfg.recentTargets.find((item) => item.id === id && item.type === targetType)?.name || id;
  return [{ type: targetType, id, name }, ...cfg.recentTargets.filter((item) => item.id !== id || item.type !== targetType)].slice(0, 6);
}
function supportsTaskBlocks(target) {
  return target === "daily" || target.startsWith("page:");
}
function toTaskMarkdown(text) {
  return text.split("\n").map((l) => l.trim() ? `- [ ] ${l}` : "").join("\n") || `- [ ] ${text}`;
}
function toDailyMarkdown(text) {
  return text.split("\n").map((l) => l.trim() ? `- ${l}` : "").join("\n") || `- ${text}`;
}
function appendTags(text, tags) {
  if (tags.length === 0) return text;
  const line = tags.map((tag) => `#${tag}#`).join(" ");
  return `${text.trimEnd()}

${line}`;
}
function isSafeHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
async function saveToDaily(plugin, notebookId, markdown, tags, includeTags = true) {
  if (!notebookId) throw new Error(plugin.i18n.quickCaptureNeedDailyNb || "Pick a daily-note notebook first (Settings \u2192 Fussy_Fran).");
  let docId = await getDailyDocId(notebookId, todayCompact());
  if (!docId) {
    docId = await getDailyDocId(notebookId, todayStr());
  }
  if (!docId) throw new Error(plugin.i18n.quickCaptureNoDaily || "Today's daily note not found \u2014 create it first (Ctrl/Cmd+D).");
  const res = await appendBlock("markdown", includeTags ? appendTags(markdown, tags) : markdown, docId);
  const newId = res[0]?.doOperations?.[0]?.id;
  if (newId) {
    await setBlockAttrs(newId, { "custom-ff-captured": todayStr() }).catch(() => {
    });
  }
  (0, import_siyuan4.showMessage)(plugin.i18n.quickCaptureSavedDaily || "Saved to today's daily note");
}
async function saveAsZettel(plugin, notebookId, basePath, markdown, tags, includeTags = true) {
  if (!notebookId) throw new Error(plugin.i18n.quickCaptureNeedZettelNb || "Pick a cards notebook first (Settings \u2192 Fussy_Fran).");
  const stamp = String(Date.now());
  const rawPath = basePath || "/Cards";
  const dir = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  const id = await createDocWithMd(notebookId, `${dir}/${stamp}`, includeTags ? appendTags(markdown, tags) : markdown);
  if (!id) throw new Error("createDocWithMd failed");
  (0, import_siyuan4.showMessage)(plugin.i18n.quickCaptureSavedZettel || `Card created`);
  const menu = new import_siyuan4.Menu("ff-open-zettel", () => {
  });
  menu.addItem({
    icon: "iconFile",
    label: plugin.i18n.quickCaptureOpen || "Open new card",
    click: () => (0, import_siyuan4.openTab)({ app: plugin.app, doc: { id } })
  });
  menu.open({ x: Math.round(window.innerWidth / 2) - 90, y: Math.round(window.innerHeight / 2), isLeft: false });
}
function escapeHtml3(s) {
  return (s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

// src/modules/refreshButton.ts
var REFRESH_BTN_ID = "ff-refresh-btn";
var observer2 = null;
function pickRefreshEnabled(plugin) {
  return plugin.data?.["fussy-config.json"]?.ui?.exposeRefresh ?? false;
}
function initRefreshButton(plugin) {
  if (!pickRefreshEnabled(plugin)) return;
  injectButton(plugin);
  if (!observer2) {
    observer2 = new MutationObserver(() => {
      if (!document.getElementById(REFRESH_BTN_ID)) {
        injectButton(plugin);
      }
    });
    observer2.observe(document.body, { childList: true, subtree: true });
  }
}
function destroyRefreshButton() {
  const btn = document.getElementById(REFRESH_BTN_ID);
  if (btn) btn.remove();
  if (observer2) {
    observer2.disconnect();
    observer2 = null;
  }
}
function injectButton(plugin) {
  const backBtn = document.getElementById("barBack");
  if (!backBtn || backBtn.parentElement?.querySelector(`#${REFRESH_BTN_ID}`)) return;
  const btn = document.createElement("button");
  btn.id = REFRESH_BTN_ID;
  btn.className = "ariaLabel toolbar__item ff-refresh-btn";
  btn.setAttribute("aria-label", plugin.i18n.refreshButton || "Refresh");
  btn.title = plugin.i18n.refreshButton || "Refresh";
  btn.innerHTML = `<svg><use xlink:href="#iconRefresh"></use></svg>`;
  btn.addEventListener("click", () => {
    window.location.reload();
  });
  backBtn.parentElement.insertBefore(btn, backBtn.nextSibling);
}

// src/modules/triageGallery.ts
var import_siyuan5 = require("siyuan");
init_syapi();
var refreshGallery = null;
function refreshTriageGallery() {
  void refreshGallery?.();
}
function initTriageGallery(plugin, root) {
  let selected = /* @__PURE__ */ new Set();
  const render = async () => {
    const config = pickConfig(plugin);
    if (!config.inboxDocumentId) {
      root.innerHTML = `<div class="ff-triage-empty">${escapeHtml4(plugin.i18n.triageNeedInbox || "Choose an inbox page in Quick Capture settings.")}</div>`;
      return;
    }
    root.innerHTML = `<div class="ff-triage">
            <header class="ff-triage-header">
                <strong>${escapeHtml4(plugin.i18n.triageTitle || "Capture inbox")}</strong>
                <button class="b3-button b3-button--text ff-triage-refresh">${escapeHtml4(plugin.i18n.triageRefresh || "Refresh")}</button>
            </header>
            <div class="ff-triage-bulk">
                <select class="b3-select ff-triage-bulk-target">${routeOptions(config, plugin)}</select>
                <button class="b3-button b3-button--text ff-triage-bulk-route">${escapeHtml4(plugin.i18n.triageRouteSelected || "Route selected")}</button>
                <span class="ff-triage-selected"></span>
            </div>
            <div class="ff-triage-message" role="status"></div>
            <div class="ff-triage-lanes">
                <section class="ff-triage-lane" data-status="unsorted">
                    <h2>${escapeHtml4(plugin.i18n.triageUnsorted || "Unsorted")}</h2>
                    <div class="ff-triage-cards"></div>
                </section>
                <section class="ff-triage-lane" data-status="processed">
                    <h2>${escapeHtml4(plugin.i18n.triageProcessed || "Processed")}</h2>
                    <div class="ff-triage-cards"></div>
                </section>
            </div>
        </div>`;
    const message = root.querySelector(".ff-triage-message");
    const refresh = root.querySelector(".ff-triage-refresh");
    refresh.addEventListener("click", () => void render());
    root.querySelector(".ff-triage-bulk-route").addEventListener("click", async () => {
      const destination = root.querySelector(".ff-triage-bulk-target").value;
      const items2 = await listInboxCaptures(config.inboxDocumentId).catch((error) => {
        showError(message, error);
        return [];
      });
      const chosen = items2.filter((item) => selected.has(item.id));
      for (const item of chosen) {
        try {
          await routeCapture(item, destination);
          selected.delete(item.id);
        } catch (error) {
          showError(message, error);
          break;
        }
      }
      await render();
    });
    const items = await listInboxCaptures(config.inboxDocumentId).catch((error) => {
      showError(message, error);
      return [];
    });
    const existingIds = new Set(items.map((item) => item.id));
    selected = new Set([...selected].filter((id) => existingIds.has(id)));
    renderItems(root, items, config, plugin, selected, render, message);
    updateSelectionLabel(root, selected, plugin);
  };
  refreshGallery = render;
  void render();
}
function renderItems(root, items, config, plugin, selected, refresh, message) {
  for (const status of ["unsorted", "processed"]) {
    const lane = root.querySelector(`.ff-triage-lane[data-status="${status}"] .ff-triage-cards`);
    const laneItems = items.filter((item) => item.status === status);
    lane.innerHTML = laneItems.length ? laneItems.map((item) => renderCard(item, config, plugin, selected)).join("") : `<p class="ff-triage-empty">${escapeHtml4(plugin.i18n.triageEmpty || "No captures")}</p>`;
  }
  root.querySelectorAll(".ff-triage-select").forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) selected.add(input.dataset.id);
      else selected.delete(input.dataset.id);
      updateSelectionLabel(root, selected, plugin);
    });
  });
  root.querySelectorAll(".ff-card-edit").forEach((button) => {
    button.addEventListener("click", () => {
      const item = items.find((candidate) => candidate.id === button.dataset.id);
      if (item) editCapture(item, plugin, refresh, message);
    });
  });
  root.querySelectorAll(".ff-card-route").forEach((button) => {
    button.addEventListener("click", async () => {
      const item = items.find((candidate) => candidate.id === button.dataset.id);
      const target = button.closest(".ff-triage-card")?.querySelector(".ff-card-target")?.value;
      if (!item || !target) return;
      try {
        await routeCapture(item, target);
        (0, import_siyuan5.showMessage)(plugin.i18n.triageRouted || "Capture routed");
        await refresh();
      } catch (error) {
        showError(message, error);
      }
    });
  });
  root.querySelectorAll(".ff-card-archive").forEach((button) => {
    button.addEventListener("click", async () => {
      const item = items.find((candidate) => candidate.id === button.dataset.id);
      if (!item) return;
      try {
        await setCaptureStatus(item.id, item.status === "unsorted" ? "processed" : "unsorted");
        await refresh();
      } catch (error) {
        showError(message, error);
      }
    });
  });
  root.querySelectorAll(".ff-card-delete").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!window.confirm(plugin.i18n.triageConfirmDelete || "Delete this capture permanently?")) return;
      try {
        await removeCapture(button.dataset.id);
        selected.delete(button.dataset.id);
        await refresh();
      } catch (error) {
        showError(message, error);
      }
    });
  });
}
function renderCard(item, config, plugin, selected) {
  const created = new Date(item.createdAt).toLocaleString();
  const tags = item.tags.map((tag) => `<span class="ff-triage-tag">${escapeHtml4(tag)}</span>`).join("");
  const routeTarget = routeOptions(config, plugin);
  const sourceUrl = item.sourceUrl ? renderSourceUrl(item.sourceUrl) : "";
  return `<article class="ff-triage-card">
        <header><input class="ff-triage-select" type="checkbox" data-id="${escapeAttr2(item.id)}" ${selected.has(item.id) ? "checked" : ""}/><time>${escapeHtml4(created)}</time></header>
        <div class="ff-triage-content">${escapeHtml4(item.content).replace(/\r?\n/g, "<br>")}</div>
        ${tags ? `<div class="ff-triage-tags">${tags}</div>` : ""}
        ${sourceUrl}
        <div class="ff-triage-actions">
            <select class="b3-select ff-card-target" data-id="${escapeAttr2(item.id)}">${routeTarget}</select>
            <button class="b3-button b3-button--text ff-card-route" data-id="${escapeAttr2(item.id)}">${escapeHtml4(plugin.i18n.triageRoute || "Send")}</button>
            <button class="b3-button b3-button--text ff-card-edit" data-id="${escapeAttr2(item.id)}">${escapeHtml4(plugin.i18n.triageEdit || "Edit")}</button>
            <button class="b3-button b3-button--text ff-card-archive" data-id="${escapeAttr2(item.id)}">${escapeHtml4(item.status === "unsorted" ? plugin.i18n.triageArchive || "Archive" : plugin.i18n.triageRestore || "Return to inbox")}</button>
            <button class="b3-button b3-button--text ff-card-delete" data-id="${escapeAttr2(item.id)}">${escapeHtml4(plugin.i18n.triageDelete || "Delete")}</button>
        </div>
    </article>`;
}
function routeOptions(config, plugin) {
  const destinations = [
    ...config.favoriteDatabases.map((target) => ({ value: `database:${target.id}`, label: `${plugin.i18n.quickCaptureDatabase || "Database"}: ${target.name}` })),
    ...config.favoritePages.map((target) => ({ value: `page:${target.id}`, label: `${plugin.i18n.quickCapturePage || "Page"}: ${target.name}` }))
  ];
  return destinations.map((target) => `<option value="${escapeAttr2(target.value)}">${escapeHtml4(target.label)}</option>`).join("") || `<option value="">${escapeHtml4(plugin.i18n.triageNoTargets || "Configure a page or database target first")}</option>`;
}
async function routeCapture(item, destination) {
  const separator = destination.indexOf(":");
  const type = destination.slice(0, separator);
  const targetId = destination.slice(separator + 1);
  if (!targetId || type !== "database" && type !== "page") throw new Error("Select a valid destination");
  if (type === "database") {
    await addBlockToAttributeView(targetId, item.id);
    await markCaptureProcessed(item.id, "database", targetId);
    return;
  }
  await appendBlock("markdown", item.content, targetId);
  await markCaptureProcessed(item.id, "page", targetId);
}
function editCapture(item, plugin, refresh, message) {
  const dialog = new import_siyuan5.Dialog({
    title: plugin.i18n.triageEdit || "Edit capture",
    content: `<div class="ff-triage-edit"><textarea class="b3-text-field fn__block" rows="8">${escapeHtml4(item.content)}</textarea><div class="ff-triage-edit-actions"><button class="b3-button b3-button--cancel">${escapeHtml4(plugin.i18n.cancel || "Cancel")}</button><button class="b3-button b3-button--text">${escapeHtml4(plugin.i18n.save || "Save")}</button></div></div>`,
    width: "560px"
  });
  const content = dialog.element.querySelector("textarea");
  const buttons = dialog.element.querySelectorAll("button");
  buttons[0].addEventListener("click", () => dialog.destroy());
  buttons[1].addEventListener("click", async () => {
    try {
      await updateCaptureContent(item.id, content.value.trim());
      dialog.destroy();
      await refresh();
    } catch (error) {
      showError(message, error);
    }
  });
}
function updateSelectionLabel(root, selected, plugin) {
  root.querySelector(".ff-triage-selected").textContent = `${selected.size} ${plugin.i18n.triageSelected || "selected"}`;
}
function showError(message, error) {
  const text = error instanceof Error ? error.message : String(error);
  message.textContent = text;
  (0, import_siyuan5.showMessage)(`[Fussy_Fran] ${text}`);
}
function renderSourceUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return `<a class="ff-triage-source" href="${escapeAttr2(url.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml4(value)}</a>`;
  } catch {
    return "";
  }
}
function escapeAttr2(value) {
  return escapeHtml4(value);
}
function escapeHtml4(value) {
  return (value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character] ?? character);
}

// src/index.ts
init_syapi();
var CONF_KEY = "fussy-config.json";
var DEFAULTS = {
  quickCapture: { ...DEFAULT_QC },
  db: { ...DEFAULT_DB },
  ui: { exposeRefresh: false }
};
function normalizeConfig(value) {
  const saved = value && typeof value === "object" ? value : {};
  const quickCapture = saved.quickCapture ?? {};
  const allowedTargets = ["inbox", "daily", "zettel", "database", "page"];
  const defaultTarget = allowedTargets.includes(quickCapture.defaultTarget) ? quickCapture.defaultTarget : DEFAULT_QC.defaultTarget;
  return {
    quickCapture: {
      ...DEFAULT_QC,
      ...quickCapture,
      favoriteDatabases: normalizeFavorites(quickCapture.favoriteDatabases),
      favoritePages: normalizeFavorites(quickCapture.favoritePages),
      recentTargets: Array.isArray(quickCapture.recentTargets) ? quickCapture.recentTargets : [],
      capturePresets: normalizeCapturePresets(quickCapture.capturePresets),
      defaultTarget,
      hotkey: typeof quickCapture.hotkey === "string" ? quickCapture.hotkey : DEFAULT_QC.hotkey
    },
    db: { ...DEFAULT_DB, ...saved.db ?? {} },
    ui: { ...DEFAULTS.ui, ...saved.ui ?? {} }
  };
}
function normalizeFavorites(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (target) => Boolean(target) && typeof target.id === "string" && typeof target.name === "string"
  );
}
function cloneConfig(config) {
  return JSON.parse(JSON.stringify(config));
}
var FussyFran = class extends import_siyuan6.Plugin {
  constructor() {
    super(...arguments);
    this.topbarEl = null;
    this.setting = null;
  }
  async onload() {
    this.data[CONF_KEY] = normalizeConfig(this.data[CONF_KEY]);
    this.addIcons(`<symbol id="iconFFBolt" viewBox="0 0 32 32"><path d="M18 2 L6 18 h7 l-2 12 L26 14 h-7 z"></path></symbol>`);
    this.topbarEl = this.addTopBar({
      icon: "iconFFBolt",
      title: this.i18n.addTopBarIcon || "Fussy_Fran",
      position: "right",
      callback: () => openQuickCapture(this)
    });
    this.addDock({
      config: {
        position: "RightBottom",
        size: { width: 360, height: 0 },
        icon: "iconInbox",
        title: this.i18n.triageTitle || "Capture inbox"
      },
      data: {},
      type: "ff-triage-gallery",
      init: (dock) => initTriageGallery(this, dock.element)
    });
    this.initSetting();
    console.log("[Fussy_Fran] loaded");
  }
  async onLayoutReady() {
    await this.loadData(CONF_KEY).then(
      (d) => {
        this.data[CONF_KEY] = normalizeConfig(d ?? this.data[CONF_KEY]);
      },
      () => {
      }
    );
    const config = this.data[CONF_KEY];
    this.addCommand({
      langKey: "quickCapture",
      hotkey: config.quickCapture.hotkey || "\u21E7\u2318Q",
      globalCallback: () => openQuickCapture(this),
      callback: () => openQuickCapture(this)
    });
    refreshTriageGallery();
    initDbBadges(this);
    initRefreshButton(this);
  }
  async onunload() {
    destroyDbBadges(this);
    destroyRefreshButton();
    console.log("[Fussy_Fran] unloaded");
  }
  showTopbarMenu() {
    const rect = this.topbarEl?.getBoundingClientRect();
    const menu = new import_siyuan6.Menu("ff-topbar", () => {
    });
    menu.addItem({
      icon: "iconEdit",
      label: this.i18n.quickCapture || "Quick capture",
      accelerator: this.data[CONF_KEY].quickCapture.hotkey || "\u21E7\u2318Q",
      click: () => openQuickCapture(this)
    });
    menu.addItem({
      icon: "iconSettings",
      label: this.i18n.settingsButton || "Settings",
      click: () => this.openSettingsDialog()
    });
    if (rect && rect.width > 0) {
      menu.open({ x: rect.right, y: rect.bottom, isLeft: true });
    } else {
      menu.open({ x: window.innerWidth - 200, y: 40, isLeft: true });
    }
  }
  openSetting() {
    this.openSettingsDialog();
  }
  openSettingsDialog() {
    const cfg = this.data[CONF_KEY];
    const draft = cloneConfig(cfg);
    const dialog = new import_siyuan6.Dialog({
      title: `Fussy Fran \u2014 ${this.i18n.settingsButton || "Settings"}`,
      content: `<div class="ff-settings-container">
                <div class="ff-settings-tabs">
                    <div class="ff-tab active" data-tab="ui">${this.i18n.tabUI || "UI / Base"}</div>
                    <div class="ff-tab" data-tab="quickcapture">${this.i18n.tabQuickCapture || "Quick Capture"}</div>
                    <div class="ff-tab" data-tab="database">${this.i18n.tabDatabase || "Database"}</div>
                    <div class="ff-tab" data-tab="calendar">${this.i18n.tabCalendar || "Calendar / Kanban"}</div>
                    <div class="ff-tab" data-tab="dashboard">${this.i18n.tabDashboard || "Dashboard"}</div>
                </div>
                <div class="ff-settings-content">
                    <div class="ff-tab-panel active" data-panel="ui">
                        <div class="ff-settings-title">${this.i18n.tabUI || "UI / Base Siyuan Adjustments"}</div>
                        <div class="ff-settings-row">
                            <label class="ff-settings-check">${this.i18n.setExposeRefresh || "Expose refresh button"}
                                <input type="checkbox" class="b3-switch ff-ui-refresh" ${draft.ui.exposeRefresh ? "checked" : ""}/>
                            </label>
                        </div>
                        <div class="ff-settings-placeholder" style="margin-top:16px">${this.i18n.workingOnIt || "More UI settings coming soon..."}</div>
                    </div>
                    <div class="ff-tab-panel" data-panel="quickcapture">
                        <div class="ff-settings-title">${this.i18n.tabQuickCapture || "Quick Capture"}</div>
                        <div class="ff-settings-row">
                            <label>${this.i18n.setZettelPath || "Cards path"}<input class="b3-text-field fn__block ff-qc-path" value="${(draft.quickCapture.zettelPath || "").replace(/"/g, "&quot;")}" placeholder="/Cards"/></label>
                        </div>
                        <div class="ff-settings-row">
                            <label>${this.i18n.setDefaultTarget || "Default target"}
                                <select class="b3-select fn__block ff-qc-target">
                                    <option value="inbox" ${draft.quickCapture.defaultTarget === "inbox" ? "selected" : ""}>${this.i18n.quickCaptureInbox || "Unsorted inbox"}</option>
                                    <option value="daily" ${draft.quickCapture.defaultTarget === "daily" ? "selected" : ""}>${this.i18n.quickCaptureDaily || "Daily note"}</option>
                                    <option value="zettel" ${draft.quickCapture.defaultTarget === "zettel" ? "selected" : ""}>${this.i18n.quickCaptureZettel || "Timestamp note"}</option>
                                    <option value="database" ${draft.quickCapture.defaultTarget === "database" ? "selected" : ""}>${this.i18n.quickCaptureDatabase || "Favorite database"}</option>
                                    <option value="page" ${draft.quickCapture.defaultTarget === "page" ? "selected" : ""}>${this.i18n.quickCapturePage || "Favorite page"}</option>
                                </select>
                            </label>
                        </div>
                        <div class="ff-preset-manager"></div>
                    </div>
                    <div class="ff-tab-panel" data-panel="database">
                        <div class="ff-settings-title">${this.i18n.tabDatabase || "Database Badges"}</div>
                        <div class="ff-settings-row">
                            <label class="ff-settings-check">${this.i18n.setDbEnabled || "Enable database badges"}
                                <input type="checkbox" class="b3-switch ff-db-enabled" ${draft.db.enabled ? "checked" : ""}/>
                            </label>
                        </div>
                        <div class="ff-settings-row">
                            <label>${this.i18n.setDbHidden || "Hidden fields"}<input class="b3-text-field fn__block ff-db-hidden" value="${(draft.db.hiddenFields || "").replace(/"/g, "&quot;")}"/></label>
                        </div>
                        <div class="ff-settings-row">
                            <label class="ff-settings-check">${this.i18n.setDbNames || "Show field names"}
                                <input type="checkbox" class="b3-switch ff-db-names" ${draft.db.showFieldNames ? "checked" : ""}/>
                            </label>
                        </div>
                        <div class="ff-settings-row">
                            <label>${this.i18n.setDbMax || "Max value length"}<input type="number" min="1" class="b3-text-field fn__block ff-db-max" value="${draft.db.maxLength}"/></label>
                        </div>
                        <div class="ff-settings-row">
                            <label>${this.i18n.setDbPosition || "Badge position"}
                                <select class="b3-select fn__block ff-db-pos">
                                    <option value="below" ${draft.db.position === "below" ? "selected" : ""}>Below</option>
                                    <option value="above" ${draft.db.position === "above" ? "selected" : ""}>Above</option>
                                </select>
                            </label>
                        </div>
                    </div>
                    <div class="ff-tab-panel" data-panel="calendar">
                        <div class="ff-settings-title">${this.i18n.tabCalendar || "Calendar / Kanban / Reminders"}</div>
                        <div class="ff-settings-placeholder">${this.i18n.workingOnIt || "Working on it..."}</div>
                    </div>
                    <div class="ff-tab-panel" data-panel="dashboard">
                        <div class="ff-settings-title">${this.i18n.tabDashboard || "Home Dashboard"}</div>
                        <div class="ff-settings-placeholder">${this.i18n.workingOnIt || "Working on it..."}</div>
                    </div>
                    <div style="display:flex;justify-content:flex-end;margin-top:16px;gap:8px">
                        <button class="b3-button b3-button--cancel ff-settings-cancel">${this.i18n.cancel || "Cancel"}</button>
                        <button class="b3-button b3-button--text ff-settings-save">${this.i18n.save || "Save"}</button>
                    </div>
                </div>
            </div>`,
      width: "720px",
      height: "560px"
    });
    const root = dialog.element.querySelector(".ff-settings-container");
    const presetManager = root.querySelector(".ff-preset-manager");
    if (presetManager) renderCapturePresetManager(this, presetManager, draft.quickCapture);
    root.querySelectorAll(".ff-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        const tabId = tab.dataset.tab;
        root.querySelectorAll(".ff-tab").forEach((t) => t.classList.remove("active"));
        root.querySelectorAll(".ff-tab-panel").forEach((p) => p.classList.remove("active"));
        tab.classList.add("active");
        root.querySelector(`.ff-tab-panel[data-panel="${tabId}"]`)?.classList.add("active");
      });
    });
    root.querySelector(".ff-settings-cancel").addEventListener("click", () => dialog.destroy());
    root.querySelector(".ff-settings-save").addEventListener("click", async () => {
      const pathInput = root.querySelector(".ff-qc-path");
      const targetSel = root.querySelector(".ff-qc-target");
      const dbEnabled = root.querySelector(".ff-db-enabled");
      const dbHidden = root.querySelector(".ff-db-hidden");
      const dbNames = root.querySelector(".ff-db-names");
      const dbMax = root.querySelector(".ff-db-max");
      const dbPos = root.querySelector(".ff-db-pos");
      const uiRefresh = root.querySelector(".ff-ui-refresh");
      draft.quickCapture.zettelPath = pathInput.value;
      draft.quickCapture.defaultTarget = targetSel.value;
      draft.db.enabled = dbEnabled.checked;
      draft.db.hiddenFields = dbHidden.value;
      draft.db.showFieldNames = dbNames.checked;
      draft.db.maxLength = Math.max(1, parseInt(dbMax.value, 10) || DEFAULT_DB.maxLength);
      draft.db.position = dbPos.value === "above" ? "above" : "below";
      draft.ui.exposeRefresh = uiRefresh.checked;
      this.data[CONF_KEY] = draft;
      await this.saveConfig();
      destroyDbBadges(this);
      initDbBadges(this);
      if (draft.ui.exposeRefresh) {
        initRefreshButton(this);
      } else {
        destroyRefreshButton();
      }
      dialog.destroy();
    });
  }
  initSetting() {
    const setting = new import_siyuan6.Setting({
      confirmCallback: () => this.saveConfig()
    });
    const cfg = () => this.data[CONF_KEY];
    setting.addItem({
      title: this.i18n.setQuickSection || "Quick capture",
      description: this.i18n.setQuickSectionDesc || "Unified inbox: timestamp cards + daily-note appends."
    });
    setting.addItem({
      title: this.i18n.setInboxDocument || "Unsorted inbox page",
      description: this.i18n.setInboxDocumentDesc || "Choose the SiYuan document used to persist unsorted captures.",
      createActionElement: async () => {
        const select = document.createElement("select");
        select.className = "b3-select fn__block";
        const empty = new Option(this.i18n.setChoosePage || "Choose a page", "");
        select.add(empty);
        select.value = cfg().quickCapture.inboxDocumentId;
        void listDocuments().then((documents) => {
          for (const target of documents) {
            const option = new Option(target.hpath || target.content || target.id, target.id);
            option.selected = target.id === cfg().quickCapture.inboxDocumentId;
            select.add(option);
          }
        }).catch((error) => (0, import_siyuan6.showMessage)(`[Fussy_Fran] ${error instanceof Error ? error.message : String(error)}`));
        select.addEventListener("change", () => {
          cfg().quickCapture.inboxDocumentId = select.value;
        });
        return select;
      }
    });
    setting.addItem({
      title: this.i18n.setFavoriteDatabases || "Favorite databases",
      description: this.i18n.setFavoriteDatabasesDesc || "Select attribute views offered as capture targets.",
      createActionElement: async () => {
        const select = document.createElement("select");
        select.multiple = true;
        select.size = 5;
        select.className = "b3-select fn__block";
        void listAttributeViews().then((targets) => {
          const favorites = new Set(cfg().quickCapture.favoriteDatabases.map((target) => target.id));
          for (const target of targets) {
            const option = new Option(target.name, target.id);
            option.selected = favorites.has(target.id);
            select.add(option);
          }
        }).catch((error) => (0, import_siyuan6.showMessage)(`[Fussy_Fran] ${error instanceof Error ? error.message : String(error)}`));
        select.addEventListener("change", () => {
          cfg().quickCapture.favoriteDatabases = Array.from(select.selectedOptions).map((option) => ({
            id: option.value,
            name: option.textContent ?? option.value
          }));
        });
        return select;
      }
    });
    setting.addItem({
      title: this.i18n.setFavoritePages || "Favorite pages",
      description: this.i18n.setFavoritePagesDesc || "Select pages offered as capture destinations.",
      createActionElement: async () => {
        const select = document.createElement("select");
        select.multiple = true;
        select.size = 5;
        select.className = "b3-select fn__block";
        void listDocuments().then((targets) => {
          const favorites = new Set(cfg().quickCapture.favoritePages.map((target) => target.id));
          for (const target of targets) {
            const label = target.hpath || target.content || target.id;
            const option = new Option(label, target.id);
            option.selected = favorites.has(target.id);
            select.add(option);
          }
        }).catch((error) => (0, import_siyuan6.showMessage)(`[Fussy_Fran] ${error instanceof Error ? error.message : String(error)}`));
        select.addEventListener("change", () => {
          cfg().quickCapture.favoritePages = Array.from(select.selectedOptions).map((option) => ({
            id: option.value,
            name: option.textContent ?? option.value
          }));
        });
        return select;
      }
    });
    setting.addItem({
      title: this.i18n.setCaptureHotkey || "Quick capture shortcut",
      description: this.i18n.setCaptureHotkeyDesc || "The shortcut takes effect after restarting the plugin.",
      createActionElement: async () => {
        const input = document.createElement("input");
        input.className = "b3-text-field fn__block";
        input.value = cfg().quickCapture.hotkey;
        input.placeholder = "\u21E7\u2318Q";
        input.addEventListener("input", () => {
          cfg().quickCapture.hotkey = input.value.trim();
        });
        return input;
      }
    });
    setting.addItem({
      title: this.i18n.setZettelPath || "Cards storage path",
      description: this.i18n.setZettelPathDesc || "Subpath in the cards notebook, e.g. /Cards",
      createActionElement: async () => {
        const zettelPath = cfg().quickCapture.zettelPath;
        const zettelNotebook = cfg().quickCapture.zettelNotebook;
        if (!zettelPath) {
          const container = document.createElement("div");
          container.style.display = "flex";
          container.style.flexDirection = "column";
          container.style.gap = "8px";
          const prompt = document.createElement("div");
          prompt.style.fontSize = "13px";
          prompt.style.color = "var(--b3-theme-on-surface)";
          prompt.textContent = this.i18n.setZettelPathPrompt || "No cards directory set \u2014 pick a notebook and path to create one:";
          container.appendChild(prompt);
          const nbRow = document.createElement("div");
          nbRow.style.display = "flex";
          nbRow.style.gap = "8px";
          const nbLabel = document.createElement("label");
          nbLabel.style.flex = "1";
          nbLabel.style.display = "flex";
          nbLabel.style.flexDirection = "column";
          nbLabel.style.gap = "4px";
          nbLabel.style.fontSize = "13px";
          nbLabel.textContent = this.i18n.quickCaptureZettelNb || "Cards notebook";
          const nbSelect = document.createElement("select");
          nbSelect.className = "b3-select fn__block";
          nbSelect.add(new Option(this.i18n.setChoosePage || "Choose a notebook", ""));
          nbLabel.appendChild(nbSelect);
          nbRow.appendChild(nbLabel);
          const pathLabel = document.createElement("label");
          pathLabel.style.flex = "1";
          pathLabel.style.display = "flex";
          pathLabel.style.flexDirection = "column";
          pathLabel.style.gap = "4px";
          pathLabel.style.fontSize = "13px";
          pathLabel.textContent = this.i18n.setZettelPath || "Cards storage path";
          const pathInput = document.createElement("input");
          pathInput.className = "b3-text-field fn__block";
          pathInput.placeholder = "/Cards";
          pathInput.value = "/Cards";
          pathLabel.appendChild(pathInput);
          nbRow.appendChild(pathLabel);
          container.appendChild(nbRow);
          const createBtn = document.createElement("button");
          createBtn.className = "b3-button b3-button--text";
          createBtn.style.alignSelf = "flex-start";
          createBtn.textContent = this.i18n.setZettelPathCreate || "Create directory";
          createBtn.addEventListener("click", async () => {
            const nbId = nbSelect.value;
            const path = pathInput.value.startsWith("/") ? pathInput.value : "/" + pathInput.value;
            if (!nbId) {
              (0, import_siyuan6.showMessage)(this.i18n.quickCaptureNeedZettelNb || "Pick a cards notebook first (Settings -> Fussy_Fran).");
              return;
            }
            try {
              const { createDocWithMd: createDocWithMd2 } = await Promise.resolve().then(() => (init_syapi(), syapi_exports));
              await createDocWithMd2(nbId, path + "/.ff-init", "");
              cfg().quickCapture.zettelNotebook = nbId;
              cfg().quickCapture.zettelPath = path;
              await this.saveConfig();
              const msg = (this.i18n.setZettelPathCreated || "Cards directory set to {path} in notebook {name}").replace("{path}", path).replace("{name}", nbSelect.options[nbSelect.selectedIndex]?.text || nbId);
              (0, import_siyuan6.showMessage)(msg);
              this.initSetting();
              this.openSettingsDialog();
            } catch (e) {
              (0, import_siyuan6.showMessage)("[Fussy_Fran] " + (e instanceof Error ? e.message : String(e)));
            }
          });
          container.appendChild(createBtn);
          const { lsNotebooks: lsNotebooks2 } = await Promise.resolve().then(() => (init_syapi(), syapi_exports));
          try {
            const notebooks = await lsNotebooks2();
            for (const nb of notebooks) {
              const opt = new Option(nb.name, nb.id);
              opt.selected = nb.id === zettelNotebook;
              nbSelect.add(opt);
            }
          } catch (e) {
            (0, import_siyuan6.showMessage)("[Fussy_Fran] " + (e instanceof Error ? e.message : String(e)));
          }
          return container;
        }
        const input = document.createElement("input");
        input.className = "b3-text-field fn__block";
        input.value = zettelPath;
        input.placeholder = "/Cards";
        input.addEventListener("input", () => {
          cfg().quickCapture.zettelPath = input.value;
        });
        return input;
      }
    });
    setting.addItem({
      title: this.i18n.setDefaultTarget || "Default capture target",
      description: this.i18n.setDefaultTargetDesc || "Which radio is preselected in the dialog.",
      createActionElement: async () => {
        const sel = document.createElement("select");
        sel.className = "b3-select fn__block";
        sel.add(new Option(this.i18n.quickCaptureInbox || "Unsorted inbox", "inbox"));
        sel.add(new Option(this.i18n.quickCaptureDaily || "Daily note", "daily"));
        sel.add(new Option(this.i18n.quickCaptureZettel || "Timestamp note", "zettel"));
        sel.add(new Option(this.i18n.quickCaptureDatabase || "Favorite database", "database"));
        sel.add(new Option(this.i18n.quickCapturePage || "Favorite page", "page"));
        sel.value = cfg().quickCapture.defaultTarget;
        sel.addEventListener("change", () => {
          cfg().quickCapture.defaultTarget = sel.value;
        });
        return sel;
      }
    });
    setting.addItem({
      title: this.i18n.setDbSection || "Database badges",
      description: this.i18n.setDbSectionDesc || "Compact read-only mirror of database attrs on blocks."
    });
    setting.addItem({
      title: this.i18n.setDbEnabled || "Enable badges",
      createActionElement: async () => {
        const btn = document.createElement("input");
        btn.type = "checkbox";
        btn.className = "b3-switch";
        btn.checked = cfg().db.enabled;
        btn.addEventListener("change", () => {
          cfg().db.enabled = btn.checked;
        });
        return btn;
      }
    });
    setting.addItem({
      title: this.i18n.setDbHidden || "Hidden fields",
      description: this.i18n.setDbHiddenDesc || "Comma-separated field names to hide.",
      createActionElement: async () => {
        const input = document.createElement("input");
        input.className = "b3-text-field fn__block";
        input.value = cfg().db.hiddenFields;
        input.addEventListener("input", () => {
          cfg().db.hiddenFields = input.value;
        });
        return input;
      }
    });
    setting.addItem({
      title: this.i18n.setDbNames || "Show field names",
      createActionElement: async () => {
        const btn = document.createElement("input");
        btn.type = "checkbox";
        btn.className = "b3-switch";
        btn.checked = cfg().db.showFieldNames;
        btn.addEventListener("change", () => {
          cfg().db.showFieldNames = btn.checked;
        });
        return btn;
      }
    });
    setting.addItem({
      title: this.i18n.setNbIds || "Notebook IDs",
      description: this.i18n.setNbIdsDesc || "Set via capture dialog dropdowns; IDs persist automatically."
    });
    setting.addItem({
      title: this.i18n.setExposeRefresh || "Expose refresh UI (top-left button)",
      description: this.i18n.setExposeRefreshDesc || "Show a refresh button next to the back arrow.",
      createActionElement: async () => {
        const btn = document.createElement("input");
        btn.type = "checkbox";
        btn.className = "b3-switch";
        btn.checked = cfg().ui.exposeRefresh;
        btn.addEventListener("change", () => {
          cfg().ui.exposeRefresh = btn.checked;
          if (btn.checked) {
            initRefreshButton(this);
          } else {
            destroyRefreshButton();
          }
        });
        return btn;
      }
    });
    setting.addItem({
      title: this.i18n.setPlaceholderCalendar || "Calendar / Kanban / Reminders",
      description: this.i18n.workingOnIt || "Working on it..."
    });
    setting.addItem({
      title: this.i18n.setPlaceholderUI || "UI simplification",
      description: this.i18n.workingOnIt || "Working on it..."
    });
    setting.addItem({
      title: this.i18n.setPlaceholderHome || "Home dashboard",
      description: this.i18n.workingOnIt || "Working on it..."
    });
    this.setting = setting;
  }
  async saveConfig() {
    try {
      await this.saveData(CONF_KEY, this.data[CONF_KEY]);
    } catch (e) {
      (0, import_siyuan6.showMessage)(`[Fussy_Fran] save failed: ${e?.message ?? e}`);
    }
  }
  /** Called by quickCapture dialog to persist notebook picks. */
  persistNotebookPick(patch) {
    Object.assign(this.data[CONF_KEY].quickCapture, patch);
    this.saveConfig();
  }
};
