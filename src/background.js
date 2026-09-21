const DEFAULT_API_CONFIG = {
  mode: "openai-compatible",
  baseUrl: "http://127.0.0.1:15721/v1",
  endpointPath: "/chat/completions",
  apiKey: "codemaker-managed",
  model: "glm-5.3-flash",
  useJsonResponseFormat: false,
  extraHeadersJson: "{}",
  customUrl: "",
  customMethod: "POST",
  customHeadersJson: "{}",
  customBodyTemplate:
    '{\n  "model": {{modelJson}},\n  "messages": {{messagesJson}},\n  "temperature": 0\n}',
  customResponsePath: "choices.0.message.content"
};

const PROFILE_SCHEMA_VERSION = 2;
const DEFAULT_PROFILE_V2 = {
  schemaVersion: PROFILE_SCHEMA_VERSION,
  updatedAt: "",
  sections: {},
  customSections: []
};

const STORAGE_KEYS = {
  profileV2: "profileV2",
  apiConfig: "apiConfig",
  updateState: "updateState",
  learnedQA: "learnedQA"
};

const PROFILE_PANEL_STATE_KEY = "OJAF_PROFILE_PANEL_STATE";
const MAX_PROFILE_PANEL_STATE_ITEMS = 20;
const LEARNED_QA_SECTION_KEY = "qa-memory";
const LEARNED_QA_SECTION_TITLE = "问答记忆";
const MAX_LEARNED_QA = 300;
const MAX_RESUME_TEXT_LENGTH = 20000;
const MAX_PARSED_SECTION_ITEMS = 20;
const MAX_PARSED_CUSTOM_SECTIONS = 20;
const PROFILE_VERSIONS_KEY = "profileVersions";
const MAIN_VERSION_NAME = "主简历";
const MAX_PROFILE_VERSIONS = 20;

// 简历解析的内置栏目 schema 兜底（popup 解析当前页时使用；与 options.js 的 STRUCTURED_RESUME_SECTIONS 保持同步）
const DEFAULT_RESUME_SCHEMA_HINT = [
  { key: "basic", title: "基本信息", kind: "simple", fields: ["姓名", "姓", "名", "英文名", "性别", "出生日期", "民族", "国籍（国家或地区）", "电话", "邮箱", "微信号", "QQ", "证件号码类型", "证件号码", "政治面貌", "婚姻状况", "户籍", "籍贯", "生源地", "现居住城市", "现居住详细地址", "通讯地址", "邮政编码", "身高", "体重", "健康状况", "工作年限", "紧急联系人", "紧急联系人电话"] },
  { key: "intention", title: "求职意向", kind: "repeat", fields: ["意向岗位", "预计入职时间", "当前薪资", "期望工作城市", "期望薪资", "面试城市", "是否接受调剂"] },
  { key: "education", title: "教育经历", kind: "repeat", fields: ["开始时间", "结束时间", "学校", "专业", "学制", "城市", "学位", "学历", "学习形式", "学院（院系）", "培养方式", "专业课程", "研究方向", "成绩", "班级排名", "专业排名"] },
  { key: "internship", title: "实习经历", kind: "repeat", fields: ["开始时间", "结束时间", "公司", "部门", "行业", "地点", "职位", "工作内容", "工作成果", "证明人姓名", "证明人联系方式", "离职原因"] },
  { key: "work", title: "工作经历", kind: "repeat", fields: ["开始时间", "结束时间", "公司", "部门", "行业", "地点", "职位", "工作内容", "工作成果", "证明人姓名", "证明人联系方式", "离职原因"] },
  { key: "performance", title: "绩效考核", kind: "repeat", fields: ["考核年度", "绩效考核等级", "年度绩效排名", "绩效证明人", "绩效证明人联系方式", "绩效说明"] },
  { key: "project", title: "项目经历/实践活动", kind: "repeat", fields: ["开始时间", "结束时间", "职位", "项目名称", "项目内容", "本人职责", "项目成果", "项目链接", "证明人姓名", "证明人联系方式"] },
  { key: "student", title: "干部任职经历（在校职务）", kind: "repeat", fields: ["开始时间", "结束时间", "组织名称", "职位", "工作内容", "本人职责"] },
  { key: "awards", title: "奖惩情况", kind: "repeat", fields: ["奖惩时间", "奖惩名称", "颁奖单位", "奖励等级", "奖惩描述", "证明人"] },
  { key: "language", title: "外语能力", kind: "repeat", fields: ["获得时间", "外语种类", "证书名称（技能名称）", "成绩", "掌握程度", "听说能力", "读写能力", "有效期"] },
  { key: "computer", title: "计算机技能（IT技能）", kind: "repeat", fields: ["获得时间", "证书名称（技能名称）", "成绩", "掌握程度"] },
  { key: "certificates", title: "证书", kind: "repeat", fields: ["证书获得时间", "证书名称（技能名称）", "证书编号", "授予单位", "证书说明"] },
  { key: "family", title: "家庭情况", kind: "repeat", fields: ["姓名", "关系", "出生日期", "电话", "公司", "职位", "政治面貌", "联系地址"] },
  { key: "training", title: "培训经历", kind: "repeat", fields: ["开始时间", "结束时间", "培训名称", "培训机构", "培训地点", "培训课程", "培训获得证书", "培训内容"] },
  { key: "papers", title: "论文和著作", kind: "repeat", fields: ["发表时间", "刊物名称", "刊物层级", "论文名称", "论文描述"] },
  { key: "patent", title: "专利", kind: "repeat", fields: ["发表时间", "专利名称", "专利编号", "专利类型", "专利成果"] },
  { key: "self", title: "自我描述", kind: "simple", fields: ["自我描述", "自我评价"] },
  { key: "declarations", title: "有关声明", kind: "simple", fields: ["是否存在亲属在应聘单位工作", "是否患有影响工作的疾病", "是否存在不良行为记录", "是否享有境外长期或永久居留权", "是否同意背景调查", "本人声明以上填写内容与事实完全相符"] },
  { key: "other", title: "其他信息", kind: "simple", fields: ["受到奖励/学术成果", "社会/校园活动", "爱好及专长", "招聘信息来源", "GitHub", "个人主页"] }
];
const UPDATE_ALARM_NAME = "OJAF_CHECK_RELEASE_UPDATE";
const UPDATE_CHECK_INTERVAL_MINUTES = 12 * 60;
const UPDATE_REPOSITORY = "JingW-ui/OpenJobAutofill";
const UPDATE_LATEST_RELEASE_API = `https://api.github.com/repos/${UPDATE_REPOSITORY}/releases/latest`;
const UPDATE_RELEASES_URL = `https://github.com/${UPDATE_REPOSITORY}/releases`;

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get([
    STORAGE_KEYS.profileV2,
    STORAGE_KEYS.apiConfig,
    STORAGE_KEYS.updateState
  ]);
  const next = {};

  if (!existing[STORAGE_KEYS.profileV2]) {
    next[STORAGE_KEYS.profileV2] = DEFAULT_PROFILE_V2;
  }

  if (!existing[STORAGE_KEYS.apiConfig]) {
    next[STORAGE_KEYS.apiConfig] = DEFAULT_API_CONFIG;
  }

  if (!existing[STORAGE_KEYS.updateState]) {
    next[STORAGE_KEYS.updateState] = createDefaultUpdateState();
  }

  if (Object.keys(next).length > 0) {
    await chrome.storage.local.set(next);
  }

  await setupUpdateAlarm().catch(() => undefined);
  await migrateLegacyApiConfig().catch(() => undefined);
  void checkForUpdate({ reason: "installed" }).catch(() => undefined);
});

chrome.runtime.onStartup?.addListener(() => {
  void setupUpdateAlarm().catch(() => undefined);
  void migrateLegacyApiConfig().catch(() => undefined);
  void refreshUpdateBadge().catch(() => undefined);
});

// 旧版默认配置（api.openai.com + 空 Key）自愈迁移到内置内网代理；用户自定义配置不受影响
async function migrateLegacyApiConfig() {
  const values = await chrome.storage.local.get([STORAGE_KEYS.apiConfig]);
  const stored = values[STORAGE_KEYS.apiConfig];
  if (!stored || typeof stored !== "object") {
    return; // 全新安装由 onInstalled 播种默认配置
  }
  const apiKey = String(stored.apiKey || "").trim();
  if (apiKey) {
    return; // 用户已有可用 Key，尊重
  }
  const baseUrl = String(stored.baseUrl || "").trim();
  const isLegacyDefault = !baseUrl || baseUrl === "https://api.openai.com/v1";
  const isAlreadyNew = baseUrl === DEFAULT_API_CONFIG.baseUrl;
  if (!isLegacyDefault || isAlreadyNew) {
    return; // 自定义了其他 endpoint（没带 Key）也尊重，不覆盖
  }
  await chrome.storage.local.set({
    [STORAGE_KEYS.apiConfig]: { ...DEFAULT_API_CONFIG }
  });
}

chrome.alarms?.onAlarm.addListener((alarm) => {
  if (alarm.name === UPDATE_ALARM_NAME) {
    void checkForUpdate({ reason: "alarm" }).catch(() => undefined);
  }
});

void setupUpdateAlarm().catch(() => undefined);
void migrateLegacyApiConfig().catch(() => undefined);
void refreshUpdateBadge().catch(() => undefined);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== "string" || !message.type.startsWith("OJAF_")) {
    return undefined;
  }

  handleMessage(message)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    });

  return true;
});

async function handleMessage(message) {
  switch (message.type) {
    case "OJAF_GET_SETTINGS":
      return getSettings();
    case "OJAF_OPEN_OPTIONS":
      await chrome.runtime.openOptionsPage();
      return {};
    case "OJAF_SAVE_SETTINGS":
      return saveSettings(message.payload || {});
    case "OJAF_CLEAR_SETTINGS":
      return clearSettings();
    case "OJAF_MAP_FIELDS":
      return mapFields(message.payload || {});
    case "OJAF_ANALYZE_PAGE_STRUCTURE":
      return analyzePageStructure(message.payload || {});
    case "OJAF_SAVE_PROFILE_PANEL_STATE":
      return saveProfilePanelState(message.payload || {});
    case "OJAF_GET_PROFILE_PANEL_STATE":
      return getProfilePanelState(message.payload || {});
    case "OJAF_LIST_LEARNED_QA":
      return listLearnedQA();
    case "OJAF_SAVE_LEARNED_QA":
      return saveLearnedQA(message.payload || {});
    case "OJAF_DELETE_LEARNED_QA":
      return deleteLearnedQA(message.payload || {});
    case "OJAF_TOUCH_LEARNED_QA":
      return touchLearnedQA(message.payload || {});
    case "OJAF_PARSE_RESUME":
      return parseResume(message.payload || {});
    case "OJAF_GET_DEFAULT_API_CONFIG":
      return { apiConfig: { ...DEFAULT_API_CONFIG } };
    case "OJAF_LIST_VERSIONS":
      return getProfileVersions().then((store) => ({ versions: summarizeVersions(store) }));
    case "OJAF_GET_VERSION":
      return getVersionDetail(message.payload || {});
    case "OJAF_CREATE_VERSION":
      return createVersion(message.payload || {});
    case "OJAF_RENAME_VERSION":
      return renameVersion(message.payload || {});
    case "OJAF_DELETE_VERSION":
      return deleteVersion(message.payload || {});
    case "OJAF_SET_ACTIVE_VERSION":
      return setActiveVersion(message.payload || {});
    case "OJAF_IMPORT_PARSED_VERSION":
      return importParsedVersion(message.payload || {});
    case "OJAF_LIST_MODELS":
      return listModels(message.payload || {});
    case "OJAF_TEST_CONNECTION":
      return testApi(message.payload || {});
    case "OJAF_GET_UPDATE_STATUS":
      return getUpdateState();
    case "OJAF_CHECK_FOR_UPDATE":
      return checkForUpdate({ reason: message.payload?.reason || "manual" });
    case "OJAF_OPEN_UPDATE_PAGE":
      return openUpdatePage(message.payload || {});
    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}

async function getSettings() {
  const [values, versionStore] = await Promise.all([
    chrome.storage.local.get([STORAGE_KEYS.apiConfig, STORAGE_KEYS.learnedQA]),
    getProfileVersions()
  ]);
  return {
    profileV2: resolveEffectiveProfileV2(versionStore),
    apiConfig: { ...DEFAULT_API_CONFIG, ...(values[STORAGE_KEYS.apiConfig] || {}) },
    learnedQA: Array.isArray(values[STORAGE_KEYS.learnedQA]) ? values[STORAGE_KEYS.learnedQA] : [],
    versions: summarizeVersions(versionStore)
  };
}

async function saveSettings(payload) {
  const savedKeys = [];

  if (payload.profileV2) {
    const store = await getProfileVersions();
    const target = findVersion(store, String(payload.versionId || "")) || getActiveVersion(store);
    target.profileV2 = normalizeProfileV2(payload.profileV2);
    target.updatedAt = new Date().toISOString();
    await chrome.storage.local.set({ [PROFILE_VERSIONS_KEY]: store });
    savedKeys.push(`${PROFILE_VERSIONS_KEY}:${target.id}`);

    // 问答记忆一致性：仅保存主简历时校验——设置页删除/改名后，同步清理 learnedQA 元数据
    if (target.id === store.mainId) {
      const items = await listLearnedQA();
      if (items.length > 0) {
        const section = target.profileV2.customSections.find(
          (entry) => entry && entry.key === LEARNED_QA_SECTION_KEY
        );
        const kept = items.filter(
          (qa) => section && section.values && Object.prototype.hasOwnProperty.call(section.values, qa?.question)
        );
        if (kept.length !== items.length) {
          await chrome.storage.local.set({ [STORAGE_KEYS.learnedQA]: kept });
          savedKeys.push(STORAGE_KEYS.learnedQA);
        }
      }
    }
  }

  if (payload.apiConfig) {
    await chrome.storage.local.set({
      [STORAGE_KEYS.apiConfig]: { ...DEFAULT_API_CONFIG, ...payload.apiConfig }
    });
    savedKeys.push(STORAGE_KEYS.apiConfig);
  }

  return { saved: savedKeys };
}

async function clearSettings() {
  await chrome.storage.local.clear();
  return { cleared: true };
}

// ---- 问答记忆：把"简历里没有、手动填过一次"的答案持久化，并提升到 customSections 让既有匹配链路自动复用 ----

async function listLearnedQA() {
  const values = await chrome.storage.local.get([STORAGE_KEYS.learnedQA]);
  const items = values[STORAGE_KEYS.learnedQA];
  return Array.isArray(items) ? items : [];
}

async function saveLearnedQA(payload) {
  const question = String(payload?.question ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  const answer = String(payload?.answer ?? "").trim().slice(0, 500);
  if (!question) {
    throw new Error("记住失败：问题为空");
  }
  if (!answer) {
    throw new Error("记住失败：答案为空，请先在页面上填写该字段");
  }
  const normQuestion = String(payload?.normQuestion || "").trim() || question;

  const items = await listLearnedQA();
  const now = Date.now();
  let qa = normQuestion ? items.find((item) => item && item.normQuestion === normQuestion) : null;
  if (qa) {
    qa.question = question;
    qa.answer = answer;
    qa.controlKind = String(payload?.controlKind || qa.controlKind || "");
    qa.options = Array.isArray(payload?.options) ? payload.options.slice(0, 40).map(String) : (qa.options || []);
    qa.hostname = String(payload?.hostname || qa.hostname || "").slice(0, 120);
    qa.updatedAt = now;
    qa.promoted = true;
  } else {
    qa = {
      id: `qa_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      question,
      normQuestion,
      answer,
      controlKind: String(payload?.controlKind || ""),
      options: Array.isArray(payload?.options) ? payload.options.slice(0, 40).map(String) : [],
      hostname: String(payload?.hostname || "").slice(0, 120),
      createdAt: now,
      updatedAt: now,
      usedCount: 0,
      promoted: true
    };
    items.push(qa);
  }

  // 容量上限：超出时淘汰最久未更新的
  items.sort((a, b) => Number(b?.updatedAt || 0) - Number(a?.updatedAt || 0));
  const trimmed = items.slice(0, MAX_LEARNED_QA);

  // 提升到主简历的 customSections["qa-memory"]：问答记忆全局共属于主简历，
  // 子简历生效时会自动并入该模块（见 resolveEffectiveProfileV2），AI/本地匹配链路零改动复用
  const store = await getProfileVersions();
  const main = getMainVersion(store);
  const mainProfile = normalizeProfileV2(main.profileV2 || DEFAULT_PROFILE_V2);
  let section = mainProfile.customSections.find((entry) => entry && entry.key === LEARNED_QA_SECTION_KEY);
  if (!section) {
    section = {
      key: LEARNED_QA_SECTION_KEY,
      title: LEARNED_QA_SECTION_TITLE,
      kind: "simple",
      values: {},
      custom: []
    };
    mainProfile.customSections.push(section);
  }
  section.values[question] = answer;
  mainProfile.updatedAt = new Date(now).toISOString();
  main.profileV2 = mainProfile;
  main.updatedAt = new Date(now).toISOString();

  await chrome.storage.local.set({
    [STORAGE_KEYS.learnedQA]: trimmed,
    [PROFILE_VERSIONS_KEY]: store
  });

  return { saved: true, qa, learnedCount: trimmed.length };
}

async function deleteLearnedQA(payload) {
  const id = String(payload?.id || "");
  if (!id) {
    throw new Error("缺少要删除的记忆 id");
  }
  const items = await listLearnedQA();
  const target = items.find((item) => item && item.id === id);
  const next = items.filter((item) => item && item.id !== id);

  if (target) {
    const store = await getProfileVersions();
    const main = getMainVersion(store);
    const mainProfile = normalizeProfileV2(main.profileV2 || DEFAULT_PROFILE_V2);
    const section = mainProfile.customSections.find((entry) => entry && entry.key === LEARNED_QA_SECTION_KEY);
    if (section && section.values && Object.prototype.hasOwnProperty.call(section.values, target.question)) {
      delete section.values[target.question];
    }
    mainProfile.updatedAt = new Date().toISOString();
    main.profileV2 = mainProfile;
    main.updatedAt = new Date().toISOString();
    await chrome.storage.local.set({
      [STORAGE_KEYS.learnedQA]: next,
      [PROFILE_VERSIONS_KEY]: store
    });
  } else {
    await chrome.storage.local.set({ [STORAGE_KEYS.learnedQA]: next });
  }

  return { deleted: Boolean(target), learnedCount: next.length };
}

async function touchLearnedQA(payload) {
  const id = String(payload?.id || "");
  if (!id) {
    return { touched: false };
  }
  const items = await listLearnedQA();
  const target = items.find((item) => item && item.id === id);
  if (!target) {
    return { touched: false };
  }
  target.usedCount = Number(target.usedCount || 0) + 1;
  target.lastUsedAt = Date.now();
  await chrome.storage.local.set({ [STORAGE_KEYS.learnedQA]: items });
  return { touched: true };
}

// ---- 简历版本管理：主简历（全量 + 问答记忆）+ 子简历（岗位变体），填写时生效 = active 版本 + 主简历问答记忆 ----

function createVersionId() {
  return `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function isValidVersionStore(store) {
  return Boolean(
    store &&
      typeof store === "object" &&
      Array.isArray(store.versions) &&
      store.versions.length > 0 &&
      store.versions.every((version) => version && version.id && version.profileV2)
  );
}

function migrateToVersionStore(legacyProfileV2) {
  const now = new Date().toISOString();
  const id = createVersionId();
  return {
    mainId: id,
    activeId: id,
    versions: [
      {
        id,
        name: MAIN_VERSION_NAME,
        isMain: true,
        createdAt: now,
        updatedAt: now,
        profileV2: normalizeProfileV2(legacyProfileV2 || DEFAULT_PROFILE_V2)
      }
    ]
  };
}

async function getProfileVersions() {
  const values = await chrome.storage.local.get([PROFILE_VERSIONS_KEY, STORAGE_KEYS.profileV2]);
  const store = values[PROFILE_VERSIONS_KEY];
  if (isValidVersionStore(store)) {
    return store;
  }
  // 旧单份资料自动迁移为"主简历"版本
  const migrated = migrateToVersionStore(values[STORAGE_KEYS.profileV2]);
  await chrome.storage.local.set({ [PROFILE_VERSIONS_KEY]: migrated });
  return migrated;
}

function findVersion(store, id) {
  return store.versions.find((version) => version.id === id) || null;
}

function getMainVersion(store) {
  return findVersion(store, store.mainId) || store.versions[0];
}

function getActiveVersion(store) {
  return findVersion(store, store.activeId) || getMainVersion(store);
}

function summarizeVersions(store) {
  return {
    mainId: store.mainId,
    activeId: store.activeId,
    list: store.versions.map((version) => ({
      id: version.id,
      name: version.name,
      isMain: version.id === store.mainId || Boolean(version.isMain),
      updatedAt: version.updatedAt || ""
    }))
  };
}

// 生效资料 = active 版本内容；若 active 是子简历，则把主简历的"问答记忆"并入（子简历自身不持有 qa-memory）
function resolveEffectiveProfileV2(store) {
  const active = getActiveVersion(store);
  const main = getMainVersion(store);
  const profile = JSON.parse(JSON.stringify(active.profileV2 || DEFAULT_PROFILE_V2));

  if (active.id !== main.id) {
    const mainQa = (Array.isArray(main.profileV2?.customSections) ? main.profileV2.customSections : []).find(
      (section) => section && section.key === LEARNED_QA_SECTION_KEY
    );
    if (mainQa && Object.keys(mainQa.values || {}).length > 0) {
      profile.customSections = (Array.isArray(profile.customSections) ? profile.customSections : []).filter(
        (section) => section && section.key !== LEARNED_QA_SECTION_KEY
      );
      profile.customSections.push({
        key: LEARNED_QA_SECTION_KEY,
        title: LEARNED_QA_SECTION_TITLE,
        kind: "simple",
        values: { ...mainQa.values },
        custom: []
      });
    }
  }

  return normalizeProfileV2(profile);
}

async function getVersionDetail(payload) {
  const store = await getProfileVersions();
  const version = findVersion(store, String(payload?.id || "")) || getActiveVersion(store);
  return {
    version: {
      id: version.id,
      name: version.name,
      isMain: version.id === store.mainId,
      profileV2: version.profileV2
    },
    versions: summarizeVersions(store)
  };
}

async function createVersion(payload) {
  const store = await getProfileVersions();
  if (store.versions.length >= MAX_PROFILE_VERSIONS) {
    throw new Error(`版本数量已达上限（${MAX_PROFILE_VERSIONS} 个）`);
  }
  const name = String(payload?.name || "").trim().slice(0, 40);
  if (!name) {
    throw new Error("版本名称不能为空");
  }
  if (store.versions.some((version) => version.name === name)) {
    throw new Error("已存在同名版本，请换个名称");
  }

  const source = payload?.fromId
    ? findVersion(store, String(payload.fromId))
    : null;
  const now = new Date().toISOString();
  const version = {
    id: createVersionId(),
    name,
    createdAt: now,
    updatedAt: now,
    profileV2: source
      ? JSON.parse(JSON.stringify(source.profileV2))
      : { ...DEFAULT_PROFILE_V2, sections: {}, customSections: [] }
  };
  store.versions.push(version);
  store.activeId = version.id;
  await chrome.storage.local.set({ [PROFILE_VERSIONS_KEY]: store });
  return { version: { id: version.id, name: version.name }, versions: summarizeVersions(store) };
}

async function renameVersion(payload) {
  const store = await getProfileVersions();
  const version = findVersion(store, String(payload?.id || ""));
  if (!version) {
    throw new Error("版本不存在");
  }
  const name = String(payload?.name || "").trim().slice(0, 40);
  if (!name) {
    throw new Error("版本名称不能为空");
  }
  version.name = name;
  version.updatedAt = new Date().toISOString();
  await chrome.storage.local.set({ [PROFILE_VERSIONS_KEY]: store });
  return { versions: summarizeVersions(store) };
}

async function deleteVersion(payload) {
  const store = await getProfileVersions();
  const id = String(payload?.id || "");
  const version = findVersion(store, id);
  if (!version) {
    throw new Error("版本不存在");
  }
  if (id === store.mainId) {
    throw new Error("主简历不能删除");
  }
  store.versions = store.versions.filter((item) => item.id !== id);
  if (store.activeId === id) {
    store.activeId = store.mainId;
  }
  await chrome.storage.local.set({ [PROFILE_VERSIONS_KEY]: store });
  return { versions: summarizeVersions(store) };
}

async function setActiveVersion(payload) {
  const store = await getProfileVersions();
  const id = String(payload?.id || "");
  if (!findVersion(store, id)) {
    throw new Error("版本不存在");
  }
  store.activeId = id;
  await chrome.storage.local.set({ [PROFILE_VERSIONS_KEY]: store });
  return { versions: summarizeVersions(store) };
}

// 把 AI 解析结果存为新版本草稿（不激活，待用户在设置页复核保存后再切换）
async function importParsedVersion(payload) {
  const profileV2 = normalizeProfileV2(payload?.profileV2);
  const hasContent =
    Object.values(profileV2.sections).some(
      (section) =>
        Object.keys(section?.values || {}).length > 0 ||
        (Array.isArray(section?.items) && section.items.length > 0)
    ) || profileV2.customSections.length > 0;
  if (!hasContent) {
    throw new Error("解析结果为空，没有可导入的内容");
  }

  const store = await getProfileVersions();
  if (store.versions.length >= MAX_PROFILE_VERSIONS) {
    throw new Error(`版本数量已达上限（${MAX_PROFILE_VERSIONS} 个）`);
  }

  const baseName = String(payload?.name || "导入简历").trim().slice(0, 40) || "导入简历";
  let name = baseName;
  let suffix = 2;
  while (store.versions.some((version) => version.name === name)) {
    name = `${baseName}-${suffix}`;
    suffix += 1;
  }

  const now = new Date().toISOString();
  const version = { id: createVersionId(), name, createdAt: now, updatedAt: now, profileV2 };
  store.versions.push(version);
  await chrome.storage.local.set({ [PROFILE_VERSIONS_KEY]: store });
  return { version: { id: version.id, name: version.name }, versions: summarizeVersions(store) };
}

async function setupUpdateAlarm() {
  if (!chrome.alarms?.create) {
    return;
  }

  const existing = chrome.alarms.get
    ? await chrome.alarms.get(UPDATE_ALARM_NAME)
    : null;
  if (existing) {
    return;
  }

  await chrome.alarms.create(UPDATE_ALARM_NAME, {
    delayInMinutes: 5,
    periodInMinutes: UPDATE_CHECK_INTERVAL_MINUTES
  });
}

function createDefaultUpdateState(patch = {}) {
  return {
    status: "unknown",
    currentVersion: getCurrentVersion(),
    latestVersion: "",
    latestTag: "",
    releaseName: "",
    releaseUrl: UPDATE_RELEASES_URL,
    publishedAt: "",
    checkedAt: 0,
    error: "",
    reason: "",
    ...patch
  };
}

async function getUpdateState() {
  const values = await chrome.storage.local.get([STORAGE_KEYS.updateState]);
  const state = reconcileUpdateState({
    ...createDefaultUpdateState(),
    ...(values[STORAGE_KEYS.updateState] || {}),
    currentVersion: getCurrentVersion()
  });
  await applyUpdateBadge(state);
  return state;
}

async function checkForUpdate(options = {}) {
  const reason = options.reason || "manual";
  const currentVersion = getCurrentVersion();

  try {
    const response = await fetch(UPDATE_LATEST_RELEASE_API, {
      method: "GET",
      headers: {
        accept: "application/vnd.github+json"
      },
      cache: "no-store"
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`GitHub Release 暂时不可用（HTTP ${response.status}）`);
    }

    const release = safeJsonParse(text);
    const latestTag = String(release?.tag_name || "").trim();
    const latestVersion = normalizeVersion(latestTag || release?.name || "");
    if (!latestVersion) {
      throw new Error("GitHub Release 没有返回有效版本号。");
    }

    const updateAvailable = compareVersions(latestVersion, currentVersion) > 0;
    const state = createDefaultUpdateState({
      status: updateAvailable ? "available" : "current",
      currentVersion,
      latestVersion,
      latestTag,
      releaseName: String(release?.name || latestTag || latestVersion),
      releaseUrl: String(release?.html_url || UPDATE_RELEASES_URL),
      publishedAt: String(release?.published_at || ""),
      checkedAt: Date.now(),
      error: "",
      reason
    });
    await saveUpdateState(state);
    return state;
  } catch (error) {
    const previous = await getUpdateState();
    const errorMessage = formatUpdateCheckError(error);
    const state = createDefaultUpdateState({
      ...previous,
      status: previous.status === "available" ? "available" : "error",
      currentVersion,
      checkedAt: Date.now(),
      error: errorMessage,
      reason
    });
    await saveUpdateState(state);
    return state;
  }
}

async function saveUpdateState(state) {
  await chrome.storage.local.set({ [STORAGE_KEYS.updateState]: state });
  await applyUpdateBadge(state);
}

async function refreshUpdateBadge() {
  const state = await getUpdateState();
  await applyUpdateBadge(state);
}

async function applyUpdateBadge(state) {
  if (!chrome.action) {
    return;
  }

  if (state?.status === "available") {
    await chrome.action.setBadgeText({ text: "NEW" });
    await chrome.action.setBadgeBackgroundColor({ color: "#c37a18" });
    return;
  }

  await chrome.action.setBadgeText({ text: "" });
}

async function openUpdatePage(payload = {}) {
  const state = await getUpdateState();
  const url = String(payload.url || state.releaseUrl || UPDATE_RELEASES_URL);
  await chrome.tabs.create({ url });
  return { opened: true, url };
}

function getCurrentVersion() {
  return chrome.runtime.getManifest().version || "0.0.0";
}

function normalizeVersion(value) {
  const match = String(value || "").trim().match(/v?(\d+(?:\.\d+){0,3}(?:[-+][0-9A-Za-z.-]+)?)/);
  return match ? match[1] : "";
}

function compareVersions(left, right) {
  const leftParts = normalizeVersion(left).split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = normalizeVersion(right).split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(leftParts.length, rightParts.length, 3);
  for (let index = 0; index < length; index += 1) {
    const diff = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (diff !== 0) {
      return diff > 0 ? 1 : -1;
    }
  }
  return 0;
}

function reconcileUpdateState(state) {
  if (!state.latestVersion) {
    return state;
  }

  const comparison = compareVersions(state.latestVersion, state.currentVersion);
  if (comparison > 0) {
    return { ...state, status: "available" };
  }
  if (state.status === "available") {
    return { ...state, status: "current", error: "" };
  }
  return state;
}

function formatUpdateCheckError(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return "暂时无法连接 GitHub Release，请稍后重试。";
  }
  return message || "检查更新失败，请稍后重试。";
}

async function saveProfilePanelState(payload) {
  const pageKey = normalizeProfilePanelStateKey(payload.pageKey || "");
  if (!pageKey || !chrome.storage.session) {
    return { saved: false };
  }

  const patch = isPlainObject(payload.patch) ? payload.patch : {};
  const result = await chrome.storage.session.get(PROFILE_PANEL_STATE_KEY);
  const allStates = result[PROFILE_PANEL_STATE_KEY] || {};
  allStates[pageKey] = {
    ...(allStates[pageKey] || {}),
    pageKey,
    ...patch,
    updatedAt: Date.now()
  };

  const entries = Object.entries(allStates)
    .sort((left, right) => Number(right[1]?.updatedAt || 0) - Number(left[1]?.updatedAt || 0))
    .slice(0, MAX_PROFILE_PANEL_STATE_ITEMS);
  await chrome.storage.session.set({ [PROFILE_PANEL_STATE_KEY]: Object.fromEntries(entries) });
  return { saved: true };
}

async function getProfilePanelState(payload) {
  const pageKey = normalizeProfilePanelStateKey(payload.pageKey || "");
  if (!pageKey || !chrome.storage.session) {
    return null;
  }

  const result = await chrome.storage.session.get(PROFILE_PANEL_STATE_KEY);
  return result[PROFILE_PANEL_STATE_KEY]?.[pageKey] || null;
}

function normalizeProfilePanelStateKey(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 800);
}

async function mapFields(payload) {
  const { scan } = payload;
  if (!scan || !Array.isArray(scan.fields)) {
    throw new Error("Missing scan result. Scan the current form first.");
  }

  const settings = await getSettings();
  const apiConfig = { ...settings.apiConfig, ...(payload.apiConfig || {}) };
  const profileCatalog = normalizeProvidedProfileCatalog(payload.profileCatalog);
  if (!profileCatalog) {
    throw new Error("Missing profile field catalog.");
  }

  const compactScan = {
    url: scan.url,
    hostname: scan.hostname,
    title: scan.title,
    fields: scan.fields.map(compactField)
  };

  const messages = buildMessages(profileCatalog, compactScan);
  const rawContent = await callAi(apiConfig, messages, {
    profile: profileCatalog,
    profileCatalog,
    scan: compactScan
  });
  const parsed = parseJsonFromText(rawContent);
  const mappings = annotateMappingsWithCatalog(normalizeAiMappings(parsed, compactScan.fields), profileCatalog);
  return {
    mappings,
    notes: Array.isArray(parsed?.notes) ? parsed.notes : [],
    raw: parsed
  };
}

async function analyzePageStructure(payload) {
  const { scan } = payload;
  if (!scan || !Array.isArray(scan.fields)) {
    throw new Error("Missing scan result. Scan the current form first.");
  }

  const settings = await getSettings();
  const apiConfig = { ...settings.apiConfig, ...(payload.apiConfig || {}) };
  const compactScan = {
    url: scan.url,
    hostname: scan.hostname,
    title: scan.title,
    siteAdapter: scan.siteAdapter || null,
    fields: scan.fields.map(compactField)
  };

  const messages = buildPageStructureMessages(compactScan);
  const rawContent = await callAi(apiConfig, messages, {
    profile: { fields: [] },
    profileCatalog: { fields: [] },
    scan: compactScan
  });
  const parsed = parseJsonFromText(rawContent);
  return normalizePageStructureAnalysis(parsed, compactScan.fields);
}

async function testApi(payload) {
  const settings = await getSettings();
  const apiConfig = { ...settings.apiConfig, ...(payload.apiConfig || {}) };
  const fakeProfile = {
    sections: [
      {
        key: "basic",
        title: "基本信息",
        fields: [
          {
            path: "profileV2.sections.basic.values[0]",
            label: "基本信息 / 姓名",
            aliases: ["姓名", "真实姓名", "基本信息"]
          }
        ]
      }
    ],
    fields: [
      {
        path: "profileV2.sections.basic.values[0]",
        label: "基本信息 / 姓名",
        aliases: ["姓名", "真实姓名", "基本信息"]
      }
    ]
  };
  const fakeScan = {
    url: "https://example.test/job",
    hostname: "example.test",
    title: "Test Form",
    fields: [
      {
        fieldId: "test_name",
        type: "text",
        label: "姓名",
        placeholder: "",
        required: true,
        section: "基本信息",
        nearbyText: "基本信息 姓名",
        options: []
      }
    ]
  };
  const messages = buildMessages(fakeProfile, fakeScan);
  const rawContent = await callAi(apiConfig, messages, {
    profile: fakeProfile,
    profileCatalog: fakeProfile,
    scan: fakeScan
  });
  const parsed = parseJsonFromText(rawContent);
  return {
    parsed,
    contentPreview: typeof rawContent === "string" ? rawContent.slice(0, 800) : String(rawContent).slice(0, 800)
  };
}

async function listModels(payload) {
  const settings = await getSettings();
  const apiConfig = { ...settings.apiConfig, ...(payload.apiConfig || {}) };
  const url = resolveModelListUrl(apiConfig);
  if (!url) {
    throw new Error(apiConfig.mode === "custom" ? "Custom API URL is required." : "API base URL is required.");
  }

  const headers = buildRequestHeaders({
    apiConfig,
    headerJson: apiConfig.mode === "custom" ? apiConfig.customHeadersJson : apiConfig.extraHeadersJson,
    includeContentType: false
  });

  const response = await fetch(url, {
    method: "GET",
    headers
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Model list request failed ${response.status}: ${text.slice(0, 500)}`);
  }

  const data = safeJsonParse(text);
  const source = extractModelListSource(data);
  const models = normalizeModelList(source);

  return {
    url,
    models
  };
}

function compactField(field) {
  return {
    fieldId: field.fieldId,
    type: field.type,
    label: sanitizePromptText(field.label, 220),
    placeholder: sanitizePromptText(field.placeholder, 160),
    name: sanitizeAttributeText(field.name),
    id: sanitizeAttributeText(field.id),
    required: field.required,
    disabled: field.disabled,
    readOnly: field.readOnly,
    canFill: field.canFill,
    section: sanitizePromptText(field.section, 220),
    nearbyText: sanitizePromptText(field.nearbyText, 420),
    groupText: sanitizePromptText(field.groupText, 360),
    cssPath: sanitizeAttributeText(field.cssPath),
    siteAdapterId: sanitizeAttributeText(field.siteAdapterId),
    siteAdapterName: sanitizePromptText(field.siteAdapterName, 120),
    hasCurrentValue: Boolean(field.hasCurrentValue),
    options: Array.isArray(field.options) ? field.options.slice(0, 50).map(compactOption) : []
  };
}

function compactOption(option) {
  return {
    value: sanitizePromptText(option?.value, 120),
    label: sanitizePromptText(option?.label, 120)
  };
}

function normalizeProvidedProfileCatalog(profileCatalog) {
  if (!isPlainObject(profileCatalog) || !Array.isArray(profileCatalog.fields)) {
    return null;
  }

  const fields = profileCatalog.fields
    .map((field) => ({
      path: sanitizeAttributeText(field?.path || ""),
      label: sanitizePromptText(field?.label || "", 180),
      aliases: Array.isArray(field?.aliases)
        ? field.aliases.map((alias) => sanitizePromptText(alias, 120)).filter(Boolean).slice(0, 12)
        : []
    }))
    .filter((field) => field.path && field.label)
    .slice(0, 300);

  const sections = Array.isArray(profileCatalog.sections)
    ? profileCatalog.sections
        .map((section) => {
          const sectionFields = Array.isArray(section?.fields)
            ? section.fields
                .map((field) => fields.find((item) => item.path === sanitizeAttributeText(field?.path || "")))
                .filter(Boolean)
            : [];

          return {
            key: sanitizeAttributeText(section?.key || ""),
            title: sanitizePromptText(section?.title || "", 120),
            fields: sectionFields
          };
        })
        .filter((section) => section.title && section.fields.length > 0)
    : [];

  return {
    sections,
    fields
  };
}

function sanitizeAttributeText(value) {
  return sanitizePromptText(value, 120);
}

function sanitizePromptText(value, maxLength = 220) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
  return redactPersonalValues(text, maxLength);
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

// ---- 简历解析导入：AI 把简历原文结构化为 profileV2（此功能是隐私例外，原文发往用户自配 AI） ----

async function parseResume(payload) {
  const settings = await getSettings();
  const apiConfig = { ...settings.apiConfig, ...(payload.apiConfig || {}) };
  if (!String(apiConfig.apiKey || "").trim()) {
    throw new Error("简历解析需要 AI：请先在 API 设置中填写 API Key。");
  }
  if (!String(apiConfig.model || "").trim() && apiConfig.mode !== "custom") {
    throw new Error("简历解析需要 AI：请先在 API 设置中填写模型名。");
  }

  const resumeText = String(payload.resumeText || "").trim().slice(0, MAX_RESUME_TEXT_LENGTH);
  if (resumeText.length < 30) {
    throw new Error("简历内容太短，无法解析。");
  }

  const schema = Array.isArray(payload.schema) && payload.schema.length > 0 ? payload.schema : DEFAULT_RESUME_SCHEMA_HINT;
  const messages = buildResumeParseMessages(resumeText, schema);
  const rawContent = await callAi(apiConfig, messages, { profile: { fields: [] }, scan: { fields: [] } });
  const parsed = parseJsonFromText(rawContent);
  const profileV2 = normalizeParsedResume(parsed, schema);

  const filledSections = Object.keys(profileV2.sections).length + profileV2.customSections.length;
  if (filledSections === 0) {
    throw new Error("AI 返回的结果没有可用内容，请检查简历文本或更换模型后重试。");
  }

  return {
    profileV2,
    stats: {
      sections: filledSections,
      values: countProfileV2Values(profileV2)
    }
  };
}

function countProfileV2Values(profileV2) {
  let count = 0;
  for (const section of Object.values(profileV2?.sections || {})) {
    if (section?.kind === "repeat") {
      for (const item of section.items || []) {
        count += Object.keys(item?.values || {}).length;
      }
    } else {
      count += Object.keys(section?.values || {}).length;
    }
  }
  for (const section of profileV2?.customSections || []) {
    count += Object.keys(section?.values || {}).length;
  }
  return count;
}

function buildResumeParseMessages(resumeText, schema) {
  const systemPrompt = [
    "You are a resume structuring engine for Chinese job application profiles.",
    "Convert the resume text into strict JSON matching the requested profile schema.",
    "Return strict JSON only. No prose, no markdown fences, no explanations.",
    "Never invent information that is not present in the resume text. Omit unknown fields entirely.",
    "Normalize dates to YYYY-MM or YYYY-MM-DD when possible; keep the original wording when ambiguous.",
    "For yes/no declaration fields, fill 是/否 only when the resume states it explicitly; otherwise omit.",
    "Information that fits no known section goes into customSections."
  ].join("\n");

  const userPrompt = [
    "Known profile sections schema (key / title / kind / suggested field labels):",
    JSON.stringify(schema, null, 2),
    "",
    "Return JSON with this shape:",
    JSON.stringify(
      {
        sections: {
          "<section key from schema>": {
            values: { "<field label>": "<value>" },
            items: [{ title: "<entry title>", values: { "<field label>": "<value>" } }]
          }
        },
        customSections: [{ key: "english-key", title: "中文标题", values: { "<label>": "<value>" } }]
      },
      null,
      2
    ),
    "",
    "Rules:",
    "- Use only section keys listed in the schema.",
    "- kind=simple sections: return values only. kind=repeat sections: return items, one item per experience entry, sorted most recent first.",
    "- Prefer the suggested field labels; you may add a new label inside a section when the resume clearly has the info but no suggested label fits.",
    "- Omit empty or uncertain values.",
    "",
    "Resume text:",
    resumeText
  ].join("\n");

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ];
}

function normalizeParsedResume(parsed, schema) {
  const profileV2 = {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    sections: {},
    customSections: []
  };
  if (!isPlainObject(parsed)) {
    return profileV2;
  }

  const schemaByKey = new Map(
    (Array.isArray(schema) ? schema : [])
      .filter((section) => section && section.key)
      .map((section) => [String(section.key), section])
  );
  const rawSections = isPlainObject(parsed.sections) ? parsed.sections : {};

  for (const [key, raw] of Object.entries(rawSections)) {
    const config = schemaByKey.get(key);
    if (!config || !isPlainObject(raw)) {
      continue;
    }
    const title = sanitizePromptText(config.title || key, 120);

    if (config.kind === "repeat") {
      const items = (Array.isArray(raw.items) ? raw.items : [])
        .map((item, index) => ({
          title: sanitizePromptText(item?.title || `${title} ${index + 1}`, 120),
          values: normalizeProfileV2Values(item?.values),
          custom: []
        }))
        .filter((item) => Object.keys(item.values).length > 0)
        .slice(0, MAX_PARSED_SECTION_ITEMS);
      if (items.length > 0) {
        profileV2.sections[key] = { key, title, kind: "repeat", items };
      }
      continue;
    }

    const values = normalizeProfileV2Values(isPlainObject(raw.values) ? raw.values : raw);
    if (Object.keys(values).length > 0) {
      profileV2.sections[key] = { key, title, kind: "simple", values, custom: [] };
    }
  }

  const rawCustomSections = Array.isArray(parsed.customSections) ? parsed.customSections : [];
  for (const raw of rawCustomSections.slice(0, MAX_PARSED_CUSTOM_SECTIONS)) {
    if (!isPlainObject(raw)) {
      continue;
    }
    const values = normalizeProfileV2Values(raw.values);
    if (Object.keys(values).length === 0) {
      continue;
    }
    const fallbackKey = `custom-${profileV2.customSections.length + 1}`;
    const key = sanitizeAttributeText(raw.key || fallbackKey) || fallbackKey;
    if (key === LEARNED_QA_SECTION_KEY || profileV2.customSections.some((section) => section.key === key)) {
      continue;
    }
    profileV2.customSections.push({
      key,
      title: sanitizePromptText(raw.title || key, 120),
      kind: "simple",
      values,
      custom: []
    });
  }

  return profileV2;
}

function normalizeProfileV2(profileV2) {
  if (!isPlainObject(profileV2)) {
    return DEFAULT_PROFILE_V2;
  }

  const sections = isPlainObject(profileV2.sections) ? profileV2.sections : {};
  const normalizedSections = {};
  for (const [key, section] of Object.entries(sections)) {
    if (!isPlainObject(section)) {
      continue;
    }
    const cleanKey = sanitizeAttributeText(key || section.key || "");
    const title = sanitizePromptText(section.title || cleanKey, 120);
    if (!cleanKey || !title) {
      continue;
    }

    normalizedSections[cleanKey] = section.kind === "repeat"
      ? {
          key: cleanKey,
          title,
          kind: "repeat",
          items: Array.isArray(section.items)
            ? section.items.map(normalizeProfileV2Item).filter((item) => Object.keys(item.values).length > 0 || item.custom.length > 0)
            : []
        }
      : {
          key: cleanKey,
          title,
          kind: "simple",
          values: normalizeProfileV2Values(section.values),
          custom: normalizeProfileV2CustomRows(section.custom)
        };
  }

  return {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    updatedAt: sanitizePromptText(profileV2.updatedAt || "", 80),
    sections: normalizedSections,
    customSections: Array.isArray(profileV2.customSections)
      ? profileV2.customSections.map(normalizeProfileV2CustomSection).filter((section) => Object.keys(section.values).length > 0 || section.custom.length > 0)
      : []
  };
}

function normalizeProfileV2Item(item = {}) {
  return {
    title: sanitizePromptText(item.title || "", 120),
    values: normalizeProfileV2Values(item.values),
    custom: normalizeProfileV2CustomRows(item.custom)
  };
}

function normalizeProfileV2CustomSection(section = {}) {
  return {
    key: sanitizeAttributeText(section.key || "custom"),
    title: sanitizePromptText(section.title || "自定义资料", 120),
    kind: "simple",
    values: normalizeProfileV2Values(section.values),
    custom: normalizeProfileV2CustomRows(section.custom)
  };
}

function normalizeProfileV2Values(values) {
  const normalized = {};
  if (!isPlainObject(values)) {
    return normalized;
  }

  for (const [label, value] of Object.entries(values)) {
    const cleanLabel = sanitizePromptText(label, 120);
    const cleanValue = String(value == null ? "" : value).trim();
    if (cleanLabel && cleanValue) {
      normalized[cleanLabel] = cleanValue;
    }
  }
  return normalized;
}

function normalizeProfileV2CustomRows(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((row) => ({
      label: sanitizePromptText(row?.label || "", 80),
      value: String(row?.value == null ? "" : row.value).trim()
    }))
    .filter((row) => row.label && row.value);
}

function redactPersonalValues(text, maxLength = 220) {
  if (!text) {
    return "";
  }

  const labelPatterns = [
    /((?:姓名|手机号码|手机号|联系电话|电话|电子邮箱|邮箱|邮件|证件号码|身份证号|出生日期|出生时间|毕业院校|专业|学历|学位|工作单位|实习\/实践单位|组织名称|职务|岗位|学校|籍贯|户口|居住地|地址|联系人|证书号|学历证书号|奖惩名称|奖惩单位|奖惩原因|自我评价|招聘信息来源|备注|高考所在地|高考分数|身高|体重|期望年收入|分数)(?:[^:：]{0,8})[：:]\s*)([^|；;，,\n]+)/g,
    /((?:是否[^:：\n]{0,40}[：:]\s*))([^\n]+)/g
  ];

  let redacted = text;
  for (const pattern of labelPatterns) {
    redacted = redacted.replace(pattern, (match, prefix) => {
      return `${prefix}【已隐藏】`;
    });
  }

  redacted = redacted.replace(/\b(?:\d{11}|\d{15,18}[Xx]?)\b/g, "【已隐藏】");
  redacted = redacted.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "【已隐藏】");
  redacted = redacted.replace(/\b\d{4,}\b/g, (match) => (match.length >= 6 ? "【已隐藏】" : match));

  return redacted.length > maxLength ? `${redacted.slice(0, maxLength)}...` : redacted;
}

function buildMessages(profileCatalog, scan) {
  const systemPrompt = [
    "You are a form-field mapping engine for job application forms.",
    "Your task is to produce the primary field mappings for the current page.",
    "Local fallback rules will handle any remaining unmatched fields.",
    "Return strict JSON only. Do not include prose or explanations outside JSON.",
    "Privacy rule: you are not given the user's actual resume values, and you must not ask for, infer, copy, or output personal values.",
    "The profile field catalog contains sourcePath names and field labels only. All real values are withheld and will be resolved locally in the browser.",
    "Do not map file upload fields. Do not decide to submit the form.",
    "Prefer sourcePath. Use value only for non-personal constants when no sourcePath applies.",
    "If options are provided for a select/combobox, map to the relevant sourcePath; local code will match the user's value to the page option."
  ].join("\n");

  const userPrompt = [
    "Map fields from the current job application page to the local resume profile field catalog.",
    "",
    "Return JSON with this schema:",
    JSON.stringify(
      {
        mappings: [
          {
            fieldId: "field id from fields list",
            sourcePath: "exact path from local profile field catalog",
            value: "optional non-personal literal only when sourcePath is not enough",
            confidence: 0.95,
            reason: "short reason"
          }
        ],
        notes: ["optional warnings"]
      },
      null,
      2
    ),
    "",
    "Rules:",
    "- Use only fieldId values that exist in fields.",
    "- Set confidence from 0 to 1.",
    "- Precision is more important than coverage. If context is ambiguous, omit the mapping instead of guessing.",
    "- Required fields deserve careful mapping, but uncertainty must lower confidence.",
    "- For repeated sections like family father/mother, performance review rows, or education entries, use section, nearbyText, and groupText to select the right profile path.",
    "- In Chinese job application forms, generic labels such as 姓名、电话、工作单位、职务、地址 must follow their context: family member, emergency contact, reference/prover, performance review, current residence, hukou, native place, source place, or mailing address.",
    "- Do not map family/emergency/reference generic fields to the applicant's own basic information unless the page context is clearly the applicant profile.",
    "- For Chinese recruitment forms, common mappings include 姓名 -> 姓名, 手机号码 -> 手机号码/电话, 电子邮箱 -> 邮箱/电子邮箱, 毕业院校 -> 学校/毕业院校, 证书名称 -> 证书名称（技能名称）.",
    "- For user-defined fields, inspect customFields.* items by label and key. If a custom field matches, use sourcePath like customFields.basic[0].value.",
    "- For declarations asking yes/no questions, use declarations.* only if the question meaning clearly matches.",
    "- Do not output copied page values, existing field values, names, phone numbers, email addresses, ID numbers, schools, employers, addresses, or experience descriptions.",
    "",
    "Local profile field catalog. Values are intentionally omitted:",
    JSON.stringify(profileCatalog, null, 2),
    "",
    "Detected page fields JSON. Existing field values are intentionally omitted/redacted:",
    JSON.stringify(scan, null, 2)
  ].join("\n");

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ];
}

function buildPageStructureMessages(scan) {
  const systemPrompt = [
    "You are a page-structure analyzer for job application forms.",
    "Your task is to normalize noisy detected web form metadata into readable form-field hints.",
    "Return strict JSON only. Do not include prose or explanations outside JSON.",
    "Privacy rule: the page may already contain user-entered values in nearby text, so never copy, infer, or output personal values.",
    "Only output structural labels, section names, control kind hints, and short non-sensitive notes.",
    "Do not decide to submit the form and do not map to a resume profile."
  ].join("\n");

  const userPrompt = [
    "Analyze the current job application page fields.",
    "",
    "Return JSON with this schema:",
    JSON.stringify(
      {
        siteType: "generic | zhiye | hotjob | ats | ant-design | element-ui | custom",
        confidence: 0.8,
        fieldHints: [
          {
            fieldId: "field id from fields list",
            label: "normalized visible label, no personal value",
            section: "normalized section name",
            controlKind: "text | textarea | select | search-select | radio | checkbox | date | file | unknown",
            confidence: 0.9,
            note: "short structural note"
          }
        ],
        notes: ["optional warnings"]
      },
      null,
      2
    ),
    "",
    "Rules:",
    "- Use only fieldId values that exist in fields.",
    "- If nearbyText contains a label and value, output only the label.",
    "- Prefer Chinese field labels when the page is Chinese.",
    "- For repeated sections, keep section names such as 基本信息、教育经历、实习经历、工作经历、绩效考核、专业资格、项目经历、家庭信息、附加问题.",
    "- If a field is a custom select/search input, set controlKind to search-select or select.",
    "- Do not output names, phone numbers, email addresses, ID numbers, schools, employers, addresses, dates of birth, or experience descriptions.",
    "",
    "Detected page fields JSON. Existing field values are omitted/redacted:",
    JSON.stringify(scan, null, 2)
  ].join("\n");

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ];
}

async function callAi(apiConfig, messages, context) {
  if (apiConfig.mode === "custom") {
    return callCustomApi(apiConfig, messages, context);
  }
  return callOpenAiCompatible(apiConfig, messages);
}

async function callOpenAiCompatible(apiConfig, messages) {
  if (!apiConfig.baseUrl) {
    throw new Error("API base URL is required.");
  }
  if (!apiConfig.model) {
    throw new Error("Model name is required.");
  }

  const url = joinUrl(apiConfig.baseUrl, apiConfig.endpointPath || "/chat/completions");
  const headers = buildRequestHeaders({ apiConfig, headerJson: apiConfig.extraHeadersJson });

  const body = {
    model: apiConfig.model,
    messages,
    temperature: 0
  };

  if (apiConfig.useJsonResponseFormat) {
    body.response_format = { type: "json_object" };
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`API request failed ${response.status}: ${text.slice(0, 500)}`);
  }

  const data = safeJsonParse(text);
  if (!data) {
    return text;
  }

  const content = data?.choices?.[0]?.message?.content;
  if (Array.isArray(content)) {
    return content.map((item) => item.text || item.content || "").join("");
  }
  if (typeof content === "string") {
    return content;
  }

  return JSON.stringify(data);
}

async function callCustomApi(apiConfig, messages, context) {
  if (!apiConfig.customUrl) {
    throw new Error("Custom API URL is required.");
  }

  const headers = buildRequestHeaders({ apiConfig, headerJson: apiConfig.customHeadersJson });

  const body = renderTemplate(apiConfig.customBodyTemplate || DEFAULT_API_CONFIG.customBodyTemplate, {
    model: apiConfig.model || "",
    messages,
    systemPrompt: messages.find((message) => message.role === "system")?.content || "",
    userPrompt: messages.find((message) => message.role === "user")?.content || "",
    profile: context.profile,
    scan: context.scan
  });

  const response = await fetch(apiConfig.customUrl, {
    method: apiConfig.customMethod || "POST",
    headers,
    body
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Custom API request failed ${response.status}: ${text.slice(0, 500)}`);
  }

  const data = safeJsonParse(text);
  if (!data) {
    return text;
  }

  const content = apiConfig.customResponsePath ? getByPath(data, apiConfig.customResponsePath) : data;
  if (typeof content === "string") {
    return content;
  }
  return JSON.stringify(content);
}

function buildRequestHeaders({ apiConfig, headerJson, includeContentType = true }) {
  const headers = parseJsonObject(headerJson, "request headers");
  if (includeContentType && !Object.keys(headers).some((key) => key.toLowerCase() === "content-type")) {
    headers["content-type"] = "application/json";
  }
  if (apiConfig.apiKey && !Object.keys(headers).some((key) => key.toLowerCase() === "authorization")) {
    headers.authorization = `Bearer ${apiConfig.apiKey}`;
  }
  return headers;
}

function resolveModelListUrl(apiConfig) {
  if (apiConfig.mode === "openai-compatible") {
    return apiConfig.baseUrl ? joinUrl(apiConfig.baseUrl, "/models") : "";
  }

  const derived = deriveModelListUrl(apiConfig.customUrl || "");
  return derived;
}

function deriveModelListUrl(sourceUrl) {
  if (!sourceUrl) {
    return "";
  }

  try {
    const url = new URL(sourceUrl);
    if (url.pathname.endsWith("/chat/completions")) {
      url.pathname = url.pathname.replace(/\/chat\/completions$/, "/models");
      return url.toString();
    }
    if (url.pathname.endsWith("/completions")) {
      url.pathname = url.pathname.replace(/\/completions$/, "/models");
      return url.toString();
    }
    if (url.pathname.endsWith("/responses")) {
      url.pathname = url.pathname.replace(/\/responses$/, "/models");
      return url.toString();
    }
    if (!url.pathname || url.pathname === "/") {
      url.pathname = "/models";
      return url.toString();
    }
    url.pathname = "/models";
    return url.toString();
  } catch {
    return "";
  }
}

function extractModelListSource(data) {
  if (Array.isArray(data)) {
    return data;
  }
  if (Array.isArray(data?.data)) {
    return data.data;
  }
  if (Array.isArray(data?.models)) {
    return data.models;
  }
  if (Array.isArray(data?.items)) {
    return data.items;
  }
  if (Array.isArray(data?.result)) {
    return data.result;
  }
  if (Array.isArray(data?.choices)) {
    return data.choices;
  }
  if (data && typeof data === "object") {
    for (const key of ["data", "models", "items", "result", "list"]) {
      if (Array.isArray(data[key])) {
        return data[key];
      }
    }
  }

  throw new Error("Could not find a model array in the response.");
}

function normalizeModelList(source) {
  const items = Array.isArray(source) ? source : [];
  return items
    .map((item) => normalizeModelItem(item))
    .filter(Boolean);
}

function normalizeModelItem(item) {
  if (typeof item === "string") {
    const id = item.trim();
    return id ? { id, name: id } : null;
  }

  if (!item || typeof item !== "object") {
    return null;
  }

  const id = String(item.id || item.model || item.name || item.slug || item.value || "").trim();
  if (!id) {
    return null;
  }

  return {
    id,
    name: String(item.display_name || item.name || item.id || id).trim() || id
  };
}

function joinUrl(baseUrl, path) {
  const normalizedBase = String(baseUrl).replace(/\/+$/, "");
  const normalizedPath = String(path || "").replace(/^\/?/, "/");
  return `${normalizedBase}${normalizedPath}`;
}

function parseJsonObject(value, label) {
  if (!value || !String(value).trim()) {
    return {};
  }

  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return parsed;
}

function renderTemplate(template, values) {
  const replacements = {
    model: values.model,
    modelJson: JSON.stringify(values.model),
    messagesJson: JSON.stringify(values.messages),
    systemPrompt: values.systemPrompt,
    systemPromptJson: JSON.stringify(values.systemPrompt),
    userPrompt: values.userPrompt,
    userPromptJson: JSON.stringify(values.userPrompt),
    prompt: values.userPrompt,
    promptJson: JSON.stringify(values.userPrompt),
    profileJson: JSON.stringify(values.profile),
    profileCatalogJson: JSON.stringify(values.profileCatalog || values.profile),
    fieldsJson: JSON.stringify(values.scan.fields),
    scanJson: JSON.stringify(values.scan)
  };

  return String(template).replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    if (!Object.prototype.hasOwnProperty.call(replacements, key)) {
      throw new Error(`Unknown custom API template variable: ${key}`);
    }
    return replacements[key];
  });
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function parseJsonFromText(text) {
  if (typeof text !== "string") {
    return text;
  }

  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  const direct = safeJsonParse(cleaned);
  if (direct) {
    return direct;
  }

  const jsonCandidate = extractFirstJson(cleaned);
  const parsed = jsonCandidate ? safeJsonParse(jsonCandidate) : null;
  if (!parsed) {
    throw new Error(`AI response is not valid JSON: ${cleaned.slice(0, 500)}`);
  }

  return parsed;
}

function normalizePageStructureAnalysis(parsed, fields) {
  const validFieldIds = new Set(fields.map((field) => field.fieldId));
  const fieldHintsSource = Array.isArray(parsed?.fieldHints)
    ? parsed.fieldHints
    : Array.isArray(parsed?.fields)
      ? parsed.fields
      : [];

  const fieldHints = fieldHintsSource
    .filter((hint) => hint && validFieldIds.has(String(hint.fieldId || "")))
    .map((hint) => ({
      fieldId: String(hint.fieldId),
      label: sanitizePromptText(hint.label || hint.normalizedLabel || "", 120),
      section: sanitizePromptText(hint.section || hint.group || "", 120),
      controlKind: sanitizeAttributeText(hint.controlKind || hint.type || "unknown"),
      confidence: clampConfidence(hint.confidence),
      note: sanitizePromptText(hint.note || hint.reason || "", 160)
    }))
    .filter((hint) => hint.label || hint.section || hint.controlKind !== "unknown");

  return {
    siteType: sanitizeAttributeText(parsed?.siteType || parsed?.type || "generic"),
    confidence: clampConfidence(parsed?.confidence),
    fieldHints,
    notes: Array.isArray(parsed?.notes)
      ? parsed.notes.map((note) => sanitizePromptText(note, 160)).filter(Boolean).slice(0, 8)
      : [],
    raw: parsed
  };
}

function extractFirstJson(text) {
  const start = text.search(/[\[{]/);
  if (start < 0) {
    return "";
  }

  const opener = text[start];
  const closer = opener === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === opener) {
      depth += 1;
    } else if (char === closer) {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return "";
}

function normalizeAiMappings(parsed, fields) {
  let mappings = [];

  if (Array.isArray(parsed)) {
    mappings = parsed;
  } else if (Array.isArray(parsed?.mappings)) {
    mappings = parsed.mappings;
  } else if (parsed && typeof parsed === "object") {
    mappings = Object.entries(parsed).map(([fieldId, value]) => ({
      fieldId,
      ...(value && typeof value === "object" ? value : { value })
    }));
  }

  const validFieldIds = new Set(fields.map((field) => field.fieldId));
  return mappings
    .filter((mapping) => mapping && validFieldIds.has(mapping.fieldId))
    .map((mapping) => {
      const normalized = {
        fieldId: String(mapping.fieldId),
        sourcePath: mapping.sourcePath || mapping.source || mapping.path || "",
        confidence: clampConfidence(mapping.confidence),
        reason: String(mapping.reason || "")
      };

      if (
        !normalized.sourcePath &&
        Object.prototype.hasOwnProperty.call(mapping, "value") &&
        mapping.value !== undefined
      ) {
        normalized.value = mapping.value;
      }

      return normalized;
    });
}

function annotateMappingsWithCatalog(mappings, profileCatalog) {
  const catalogFields = Array.isArray(profileCatalog?.fields) ? profileCatalog.fields : [];
  const sections = Array.isArray(profileCatalog?.sections) ? profileCatalog.sections : [];
  const fieldByPath = new Map(catalogFields.map((field) => [field.path, field]));
  const sectionByPath = new Map();

  for (const section of sections) {
    const fields = Array.isArray(section.fields) ? section.fields : [];
    for (const field of fields) {
      sectionByPath.set(field.path, section.title || "");
    }
  }

  return mappings.map((mapping) => {
    const catalogField = fieldByPath.get(mapping.sourcePath);
    if (!catalogField) {
      return mapping;
    }

    return {
      ...mapping,
      sourceLabel: catalogField.label || "",
      sourceSection: sectionByPath.get(mapping.sourcePath) || ""
    };
  });
}

function clampConfidence(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0.5;
  }
  return Math.max(0, Math.min(1, number));
}

function getByPath(source, path) {
  const parts = String(path)
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);

  let current = source;
  for (const part of parts) {
    if (current == null) {
      return undefined;
    }
    current = current[part];
  }
  return current;
}
