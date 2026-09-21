// 冒烟测试：background.js 简历解析链路（OJAF_PARSE_RESUME）
// 运行：node tests/smoke-resume-parse.js
// mock chrome.storage + fetch，验证 prompt 组装、AI 返回归一化、schema 约束、错误分支。

const assert = require("node:assert");

const store = {};
let messageHandler = null;
let lastFetchBody = null;

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
    lastError: null
  },
  alarms: { onAlarm: { addListener() {} } }
};

// 模拟 AI 返回：内置字段 + 额外字段 + repeat 条目 + 未知 customSection + 违禁 qa-memory key
const fakeAiResult = {
  sections: {
    basic: {
      values: { "姓名": "张三", "电话": "13800001111", "AI 多写的字段": "额外值", "空值字段": "  " }
    },
    education: {
      items: [
        { title: "教育经历 1", values: { "学校": "某某大学", "专业": "计算机科学", "开始时间": "2021-09" } },
        { title: "空条目", values: {} }
      ]
    },
    notaknownsection: { values: { "x": "y" } }
  },
  customSections: [
    { key: "skills-extra", title: "技能特长", values: { "篮球": "校队" } },
    { key: "qa-memory", title: "问答记忆", values: { "入侵": "不允许" } },
    { key: "empty-one", title: "空的", values: {} }
  ]
};

global.fetch = async (url, init) => {
  lastFetchBody = JSON.parse(init.body);
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify(fakeAiResult) } }] })
  };
};

require("../src/background.js");
assert.ok(messageHandler, "onMessage 处理器应已注册");

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

const MINI_SCHEMA = [
  { key: "basic", title: "基本信息", kind: "simple", fields: ["姓名", "电话"] },
  { key: "education", title: "教育经历", kind: "repeat", fields: ["学校", "专业", "开始时间"] }
];

const RESUME_TEXT = "张三，电话13800001111，2021年9月入学某某大学计算机科学专业……（此处为超过30字的简历文本）";

(async () => {
  // 1. 显式清空 API Key 时应报错（默认值会被存储值覆盖）
  store.apiConfig = { apiKey: "", model: "" };
  await assert.rejects(
    () => send({ type: "OJAF_PARSE_RESUME", payload: { resumeText: RESUME_TEXT, schema: MINI_SCHEMA } }),
    /API Key/
  );

  // 2. 配置 API 后正常解析
  store.apiConfig = {
    mode: "openai-compatible",
    baseUrl: "https://api.example.com/v1",
    endpointPath: "/chat/completions",
    apiKey: "test-key",
    model: "test-model",
    parseModel: "",
    useJsonResponseFormat: false,
    extraHeadersJson: "{}"
  };
  const r = await send({ type: "OJAF_PARSE_RESUME", payload: { resumeText: RESUME_TEXT, schema: MINI_SCHEMA } });
  const p = r.profileV2;

  assert.strictEqual(p.sections.basic.values["姓名"], "张三");
  assert.strictEqual(p.sections.basic.values["电话"], "13800001111");
  assert.strictEqual(p.sections.basic.values["AI 多写的字段"], "额外值", "section 内额外标签应保留");
  assert.ok(!("空值字段" in p.sections.basic.values), "空值应被剔除");
  assert.ok(!p.sections.notaknownsection, "未知 section key 应被丢弃");
  assert.strictEqual(p.sections.education.items.length, 1, "空条目应被剔除");
  assert.strictEqual(p.sections.education.items[0].values["学校"], "某某大学");
  assert.ok(p.customSections.some((s) => s.key === "skills-extra" && s.values["篮球"] === "校队"));
  assert.ok(!p.customSections.some((s) => s.key === "qa-memory"), "AI 不得占用 qa-memory 保留 key");
  assert.ok(!p.customSections.some((s) => s.key === "empty-one"), "空 customSection 应被剔除");
  assert.ok(r.stats.values >= 5, "stats.values 应统计字段数");

  // 3. prompt 应携带 schema 与简历原文
  const userMsg = lastFetchBody.messages.find((m) => m.role === "user").content;
  assert.ok(userMsg.includes('"basic"'), "prompt 应包含 schema");
  assert.ok(userMsg.includes("张三"), "prompt 应包含简历原文");
  assert.strictEqual(lastFetchBody.model, "test-model");

  // 4. 文本太短应报错
  await assert.rejects(
    () => send({ type: "OJAF_PARSE_RESUME", payload: { resumeText: "太短", schema: MINI_SCHEMA } }),
    /太短/
  );

  // 5. parseModel 覆盖逻辑：默认配置应走 auto_deepseek_plan
  delete store.apiConfig;
  await send({ type: "OJAF_PARSE_RESUME", payload: { resumeText: RESUME_TEXT, schema: MINI_SCHEMA } });
  assert.strictEqual(lastFetchBody.model, "auto_deepseek_plan", "默认配置应使用内置解析模型");

  // 6. 显式 parseModel 优先；留空跟随主模型
  store.apiConfig = { mode: "openai-compatible", baseUrl: "https://api.example.com/v1", endpointPath: "/chat/completions", apiKey: "k", model: "main-model", parseModel: "fast-x", extraHeadersJson: "{}" };
  await send({ type: "OJAF_PARSE_RESUME", payload: { resumeText: RESUME_TEXT, schema: MINI_SCHEMA } });
  assert.strictEqual(lastFetchBody.model, "fast-x", "显式 parseModel 应优先");
  store.apiConfig.parseModel = "";
  await send({ type: "OJAF_PARSE_RESUME", payload: { resumeText: RESUME_TEXT, schema: MINI_SCHEMA } });
  assert.strictEqual(lastFetchBody.model, "main-model", "parseModel 留空应跟随主模型");

  // 7. SSE 流式：逐块组装 + onProgress 回调
  const payloadJson = JSON.stringify({ sections: { basic: { values: { "姓名": "王二" } } } });
  const partLen = Math.ceil(payloadJson.length / 4);
  const sseChunks = [];
  for (let i = 0; i < payloadJson.length; i += partLen) {
    const part = payloadJson.slice(i, i + partLen);
    sseChunks.push(`data: ${JSON.stringify({ choices: [{ delta: { content: part } }] })}\n\n`);
  }
  sseChunks.push("data: [DONE]\n\n");
  const progressEvents = [];
  global.fetch = async () => ({
    ok: true,
    status: 200,
    headers: { get: (h) => (String(h).toLowerCase() === "content-type" ? "text/event-stream" : null) },
    body: new ReadableStream({
      start(controller) {
        for (const chunk of sseChunks) {
          controller.enqueue(new TextEncoder().encode(chunk));
        }
        controller.close();
      }
    })
  });
  const r7 = await send({
    type: "OJAF_PARSE_RESUME",
    payload: { resumeText: RESUME_TEXT, schema: MINI_SCHEMA, onProgress: (chars) => progressEvents.push(chars) }
  });
  assert.strictEqual(r7.profileV2.sections.basic.values["姓名"], "王二", "SSE 流式组装后应正确解析");
  assert.ok(progressEvents.length >= 2, "流式应有多次进度回调");
  assert.ok(progressEvents.every((v, i, a) => i === 0 || v > a[i - 1]), "进度应递增");

  console.log("✅ 全部断言通过：prompt 组装 / 归一化 / schema 约束 / 保留 key 防护 / 错误分支 / parseModel 覆盖 / SSE 流式 均正常");
  process.exit(0);
})().catch((error) => {
  console.error("❌ 冒烟测试失败:", error);
  process.exit(1);
});
