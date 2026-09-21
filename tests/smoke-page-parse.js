// 冒烟测试：解析当前页为简历的后台编排（状态机、置信度预检、重试、单飞锁）
// 运行：node tests/smoke-page-parse.js

const assert = require("node:assert");

const store = {};
let messageHandler = null;
let executeScriptCalls = 0;
let tabsCreateUrls = [];
let tabMessages = [];
let fetchCalls = 0;
let fetchShouldFail = false;
let extractText = "";

global.chrome = {
  storage: {
    local: {
      async get(keys) {
        const list = Array.isArray(keys) ? keys : [keys];
        const out = {};
        for (const key of list) {
          if (Object.prototype.hasOwnProperty.call(store, key)) {
            out[key] = store[key];
          }
        }
        return out;
      },
      async set(obj) {
        Object.assign(store, obj);
      },
      async clear() {
        for (const key of Object.keys(store)) {
          delete store[key];
        }
      }
    }
  },
  runtime: {
    onInstalled: { addListener() {} },
    onStartup: { addListener() {} },
    onMessage: { addListener(fn) { messageHandler = fn; } },
    lastError: null,
    getURL: (p) => `chrome-extension://test/${p}`
  },
  alarms: { onAlarm: { addListener() {} } },
  scripting: {
    executeScript: async () => { executeScriptCalls += 1; }
  },
  tabs: {
    sendMessage: async (tabId, message) => {
      tabMessages.push(message.type);
      if (message.type === "OJAF_EXTRACT_PAGE_TEXT") {
        return { ok: true, data: { text: extractText, url: "https://resume.example.com/me", title: "我的简历", hostname: "resume.example.com", truncated: false } };
      }
      return { ok: true, data: {} };
    },
    create: async ({ url }) => { tabsCreateUrls.push(url); }
  }
};

const fakeAiResult = {
  sections: {
    basic: { values: { "姓名": "赵六", "电话": "13900002222" } }
  },
  customSections: []
};

global.fetch = async () => {
  fetchCalls += 1;
  if (fetchShouldFail) {
    return { ok: false, status: 500, text: async () => "server boom" };
  }
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify(fakeAiResult) } }] })
  };
};

require("../src/background.js");

function send(message) {
  return new Promise((resolve, reject) => {
    messageHandler(message, null, (response) => {
      if (!response || !response.ok) {
        reject(new Error(response?.error || "empty response"));
        return;
      }
      resolve(response.data);
    });
  });
}

const RESUME_TEXT = "赵六，电话13900002222，邮箱 zhaoliu@example.com。教育经历：2020年至2024年就读于清华大学软件工程专业，本科学历。工作经历：2024年至今在某公司担任前端工程师，负责项目开发。实习经历丰富，项目经验充足。".repeat(2);
const NOT_RESUME_TEXT = "今天天气不错，适合出门散步。推荐几款热门商品给大家，限时优惠不容错过。".repeat(3);

(async () => {
  // 场景 1：低置信度页面 → confirm 状态，不调用 AI，不建版本
  extractText = NOT_RESUME_TEXT;
  const r1 = await send({ type: "OJAF_START_PAGE_PARSE", payload: { tabId: 101 } });
  assert.strictEqual(r1.status, "confirm");
  assert.strictEqual(fetchCalls, 0, "低置信度不应调用 AI");
  assert.ok(!store.profileVersions || store.profileVersions.versions.length <= 1, "不应生成草稿版本");
  assert.ok(tabMessages.includes("OJAF_EXTRACT_PAGE_TEXT"), "应已抽取页面文本");
  console.log("PASS 1 低置信度预检拦截");

  // 场景 2：force 重发 → 复用缓存文本（不重复抽取）→ 完成
  const execBefore = executeScriptCalls;
  const r2 = await send({ type: "OJAF_START_PAGE_PARSE", payload: { tabId: 101, force: true } });
  assert.strictEqual(r2.status, "done");
  assert.strictEqual(executeScriptCalls, execBefore, "force 应复用缓存文本，不重复注入抽取");
  assert.strictEqual(fetchCalls, 1, "AI 应被调用一次");
  assert.strictEqual(tabsCreateUrls.length, 1, "应打开设置页");
  assert.ok(tabsCreateUrls[0].includes("focusVersion="), "设置页 URL 应带 focusVersion");
  const state2 = store.pageParseState;
  assert.strictEqual(state2.status, "done");
  assert.ok(state2.result.versionId && state2.result.versionName.includes("导入-"));
  assert.ok(store.profileVersions.versions.length === 2, "应有主简历 + 草稿两个版本");
  assert.ok(tabMessages.filter((t) => t === "OJAF_PAGE_PARSE_PROGRESS").length >= 2, "应推送过进度");
  console.log("PASS 2 force 解析完成 + 缓存复用 + 设置页打开");

  // 场景 3：AI 失败 → error 状态且文本保留 → retry 成功且不重新抽取
  extractText = RESUME_TEXT;
  fetchShouldFail = true;
  await assert.rejects(() => send({ type: "OJAF_START_PAGE_PARSE", payload: { tabId: 102 } }));
  const state3 = store.pageParseState;
  assert.strictEqual(state3.status, "error");
  assert.ok(state3.text.length >= 100, "失败时应保留已抽取文本供重试");
  fetchShouldFail = false;
  const execBefore2 = executeScriptCalls;
  const r3 = await send({ type: "OJAF_START_PAGE_PARSE", payload: { tabId: 102, retry: true } });
  assert.strictEqual(r3.status, "done");
  assert.strictEqual(executeScriptCalls, execBefore2, "retry 应复用缓存文本");
  console.log("PASS 3 失败保留现场 + retry 复用文本");

  // 场景 4：done 后随意 dismiss
  await send({ type: "OJAF_DISMISS_PAGE_PARSE" });
  assert.strictEqual(store.pageParseState.status, "idle");
  console.log("PASS 4 状态复位");

  console.log("ALL PASS: 页面解析编排断言全部通过");
  process.exit(0);
})().catch((error) => {
  console.error("FAIL:", error);
  process.exit(1);
});
