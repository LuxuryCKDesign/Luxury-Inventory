/* Luxury Design → taller: generado de src/core/production.ts (npm run produccion:js). No editar a mano. */
"use strict";
var LDProd = (() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
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

  // src/core/production.ts
  var production_exports = {};
  __export(production_exports, {
    KEY_JOBS: () => KEY_JOBS,
    PROD_VERSION: () => PROD_VERSION,
    STEPS: () => STEPS,
    appendEvent: () => appendEvent,
    applyPartEvent: () => applyPartEvent,
    asManifest: () => asManifest,
    asScanLog: () => asScanLog,
    baseUid: () => baseUid,
    builtKey: () => builtKey,
    doneKey: () => doneKey,
    jobProgress: () => jobProgress,
    jobsWithCode: () => jobsWithCode,
    labelBarcodeText: () => labelBarcodeText,
    labelQrText: () => labelQrText,
    mergeEvents: () => mergeEvents,
    parseLabelBarcode: () => parseLabelBarcode,
    parseLabelQr: () => parseLabelQr,
    partByNumber: () => partByNumber,
    partReady: () => partReady,
    partsKey: () => partsKey,
    scanKey: () => scanKey,
    scanPrefix: () => scanPrefix,
    stepForStation: () => stepForStation,
    upsertJobIndex: () => upsertJobIndex
  });
  var PROD_VERSION = 1;
  var KEY_JOBS = "ld:jobs";
  var partsKey = (jobId) => `ld:parts:${jobId}`;
  var scanPrefix = (jobId) => `ld:scan:${jobId}:`;
  var scanKey = (jobId, dev) => `ld:scan:${jobId}:${dev}`;
  var doneKey = (jobId) => `ld:done:${jobId}`;
  var builtKey = (jobId) => `ld:armado:${jobId}`;
  var STEPS = ["cut", "eb", "dmg", "asm"];
  function parseLabelQr(text) {
    const t = String(text != null ? text : "").trim();
    if (!t.startsWith("LD|")) return null;
    const parts = t.split("|");
    if (parts.length < 4) return null;
    const jobId = parts[1];
    const label = parts[parts.length - 1];
    const raw = parts.slice(2, -1).join("|");
    if (!jobId || !raw) return null;
    const base = baseUid(raw);
    return { jobId, uid: base, label, remake: base !== raw };
  }
  var baseUid = (uid) => uid.replace(/(~rk\d*)+$/, "");
  var labelQrText = (jobId, uid, label) => `LD|${jobId}|${uid}|${label}`;
  function labelBarcodeText(jobCode, label) {
    var _a, _b;
    const n = (_b = (_a = String(label != null ? label : "").match(/\d+/)) == null ? void 0 : _a[0]) != null ? _b : "0";
    return `${jobCode}${n.padStart(4, "0")}`;
  }
  function parseLabelBarcode(text) {
    const t = String(text != null ? text : "").trim().replace(/[\s-]/g, "");
    if (!/^\d{8,10}$/.test(t)) return null;
    const code = t.slice(0, -4);
    const num = String(parseInt(t.slice(-4), 10));
    if (!/^\d{4,}$/.test(code) || num === "0" || num === "NaN") return null;
    return { code, num };
  }
  var jobsWithCode = (index, code) => index.filter((j) => j && j.code === code);
  var partByNumber = (manifest, num) => {
    var _a;
    return (_a = manifest.parts.find((p) => String(parseInt(p.k, 10)) === num)) != null ? _a : null;
  };
  var emptyState = () => ({ cut: false, eb: false, dmg: false });
  function mergeEvents(logs) {
    var _a;
    const all = [];
    for (const lg of logs) {
      if (!lg || !Array.isArray(lg.ev)) continue;
      for (const e of lg.ev) if (e && typeof e.t === "number" && STEPS.includes(e.s)) all.push(__spreadProps(__spreadValues({}, e), { dev: String((_a = lg.dev) != null ? _a : "") }));
    }
    return all.sort((a, b) => a.t - b.t || (a.dev < b.dev ? -1 : a.dev > b.dev ? 1 : 0));
  }
  function applyPartEvent(st, e) {
    var _a, _b;
    const s = __spreadProps(__spreadValues({}, st), { by: (_a = e.w) != null ? _a : st.by, at: e.t });
    if (e.s === "cut") {
      if (e.o) return __spreadProps(__spreadValues({}, s), { cut: false, eb: false, cutAt: void 0, ebAt: void 0 });
      return __spreadProps(__spreadValues({}, s), { cut: true, cutAt: e.t, dmg: false, dmgAt: void 0, dmgNote: void 0 });
    }
    if (e.s === "eb") {
      if (e.o) return __spreadProps(__spreadValues({}, s), { eb: false, ebAt: void 0 });
      return __spreadProps(__spreadValues({}, s), { eb: true, ebAt: e.t, cut: true, cutAt: (_b = st.cutAt) != null ? _b : e.t, dmg: false, dmgAt: void 0, dmgNote: void 0 });
    }
    if (e.s === "dmg") {
      if (e.o) return __spreadProps(__spreadValues({}, s), { dmg: false, dmgAt: void 0, dmgNote: void 0 });
      return __spreadProps(__spreadValues({}, s), { dmg: true, dmgAt: e.t, dmgNote: e.n, cut: false, eb: false, cutAt: void 0, ebAt: void 0 });
    }
    return st;
  }
  var partReady = (p, st) => !!st && st.cut && !st.dmg && (st.eb || !p.eb);
  function jobProgress(manifest, logs) {
    const byUid = new Map(manifest.parts.map((p) => [p.u, p]));
    const parts = {};
    for (const p of manifest.parts) parts[p.u] = emptyState();
    const built = /* @__PURE__ */ new Map();
    let unknown = 0;
    let lastAt = 0;
    for (const e of mergeEvents(logs)) {
      lastAt = Math.max(lastAt, e.t);
      if (e.s === "asm") {
        if (e.c) built.set(e.c, { on: !e.o, at: e.t, by: e.w });
        continue;
      }
      const uid = e.p ? baseUid(e.p) : "";
      if (!byUid.has(uid)) {
        unknown++;
        continue;
      }
      parts[uid] = applyPartEvent(parts[uid], e);
    }
    const cabIds = [...manifest.cabinets.map((c) => c.c)];
    if (manifest.parts.some((p) => !p.c)) cabIds.push("");
    const cabinets = cabIds.map((cid) => {
      var _a, _b;
      const info = manifest.cabinets.find((c) => c.c === cid);
      const list = manifest.parts.filter((p) => p.c === cid);
      const b = built.get(cid);
      const cp = {
        c: cid,
        name: (_a = info == null ? void 0 : info.name) != null ? _a : "",
        room: (_b = info == null ? void 0 : info.room) != null ? _b : "",
        total: list.length,
        cut: list.filter((p) => parts[p.u].cut).length,
        needEb: list.filter((p) => p.eb).length,
        eb: list.filter((p) => p.eb && parts[p.u].eb).length,
        done: list.filter((p) => partReady(p, parts[p.u])).length,
        dmg: list.filter((p) => parts[p.u].dmg).length,
        ready: false,
        built: !!(b == null ? void 0 : b.on),
        builtAt: (b == null ? void 0 : b.on) ? b.at : void 0,
        builtBy: (b == null ? void 0 : b.on) ? b.by : void 0
      };
      cp.ready = cp.total > 0 && cp.done === cp.total;
      return cp;
    });
    const real = cabinets.filter((c) => c.c !== "");
    const total = manifest.parts.length;
    const done = manifest.parts.filter((p) => partReady(p, parts[p.u])).length;
    return {
      parts,
      cabinets,
      total,
      cut: manifest.parts.filter((p) => parts[p.u].cut).length,
      needEb: manifest.parts.filter((p) => p.eb).length,
      eb: manifest.parts.filter((p) => p.eb && parts[p.u].eb).length,
      done,
      dmg: manifest.parts.filter((p) => parts[p.u].dmg).length,
      partsDone: total > 0 && done === total,
      cabsReady: real.filter((c) => c.ready).length,
      cabsBuilt: real.filter((c) => c.built).length,
      allBuilt: real.length > 0 && real.every((c) => c.built),
      damaged: manifest.parts.filter((p) => parts[p.u].dmg),
      unknown,
      lastAt
    };
  }
  function appendEvent(log, dev, e) {
    const ev = log && Array.isArray(log.ev) ? log.ev : [];
    return { v: PROD_VERSION, dev, ev: [...ev, e] };
  }
  function stepForStation(station, part, st) {
    if (station === "armado") return { step: null, why: "armado" };
    if (station === "corte") return (st == null ? void 0 : st.cut) && !st.dmg ? { step: null, why: "already" } : { step: "cut" };
    if (!part.eb) return { step: null, why: "no-eb" };
    return (st == null ? void 0 : st.eb) && !st.dmg ? { step: null, why: "already" } : { step: "eb" };
  }
  function asManifest(v) {
    var _a, _b;
    const o = typeof v === "string" ? safeJson(v) : v;
    if (!o || typeof o !== "object") return null;
    const m = o;
    if (typeof m.jobId !== "string" || !Array.isArray(m.parts) || !Array.isArray(m.cabinets)) return null;
    return __spreadProps(__spreadValues({
      v: Number(m.v) || PROD_VERSION,
      jobId: m.jobId
    }, typeof m.code === "string" && m.code ? { code: m.code } : {}), {
      job: String((_a = m.job) != null ? _a : ""),
      client: String((_b = m.client) != null ? _b : ""),
      at: Number(m.at) || 0,
      cabinets: m.cabinets.filter((c) => c && typeof c.c === "string"),
      parts: m.parts.filter((p) => p && typeof p.u === "string").map((p) => {
        var _a2, _b2;
        return __spreadProps(__spreadValues({}, p), { c: String((_a2 = p.c) != null ? _a2 : ""), eb: !!p.eb, k: String((_b2 = p.k) != null ? _b2 : "") });
      })
    });
  }
  function asScanLog(v) {
    var _a;
    const o = typeof v === "string" ? safeJson(v) : v;
    if (!o || typeof o !== "object" || !Array.isArray(o.ev)) return null;
    return { v: Number(o.v) || PROD_VERSION, dev: String((_a = o.dev) != null ? _a : ""), ev: o.ev };
  }
  function safeJson(s) {
    try {
      return JSON.parse(s);
    } catch (e) {
      return null;
    }
  }
  function upsertJobIndex(list, entry) {
    const cur = Array.isArray(list) ? list.filter((x) => x && typeof x.jobId === "string") : [];
    const i = cur.findIndex((x) => x.jobId === entry.jobId);
    return i >= 0 ? cur.map((x, k) => k === i ? entry : x) : [entry, ...cur];
  }
  return __toCommonJS(production_exports);
})();
