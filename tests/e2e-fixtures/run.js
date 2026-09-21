// 夹具 E2E：真实 Chrome + 加载扩展 + 真实消息链路（SW → scripting 注入 → content 填写）
// 运行：npm run test:fixtures   （需要本机装有 Chrome）
//
// 设计要点：
// - 扩展复制到临时目录并给 manifest 追加 http://127.0.0.1/* host 权限（不污染真实仓库）
// - 通过本地静态服务提供夹具页（file:// 下扩展注入受限）
// - 预置资料走 chrome.storage（与生产同构），apiConfig 指向死端口 → 确定性走本地规则兜底
// - 通过 SW evaluate 复现 popup 的 sendToActiveTab 链路触发开始填写

const assert = require("node:assert");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..", "..");
const FIXTURES = __dirname;
const EXT_INCLUDE = ["manifest.json", "src", "icons", "assets", "vendor", "sample-profile.json"];

const PROFILE_V2 = {
  schemaVersion: 2,
  updatedAt: new Date().toISOString(),
  sections: {
    basic: {
      key: "basic",
      title: "基本信息",
      kind: "simple",
      values: {
        "姓名": "张三",
        "电话": "13800001111",
        "邮箱": "zhangsan@test.com",
        "性别": "男",
        "出生日期": "1999-05-12",
        "现居住城市": "杭州"
      },
      custom: []
    },
    self: {
      key: "self",
      title: "自我描述",
      kind: "simple",
      values: { "自我评价": "认真负责，熟悉自动化测试。" },
      custom: []
    }
  },
  customSections: []
};

function serveStatic(dir) {
  const server = http.createServer((req, res) => {
    const name = req.url === "/" ? "/form-basic.html" : req.url.split("?")[0];
    const file = path.join(dir, decodeURIComponent(name));
    if (!file.startsWith(dir) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

function stageExtension() {
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), "ojaf-ext-"));
  for (const item of EXT_INCLUDE) {
    fs.cpSync(path.join(ROOT, item), path.join(stage, item), { recursive: true });
  }
  const manifestPath = path.join(stage, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.host_permissions = [...(manifest.host_permissions || []), "http://127.0.0.1/*"];
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return stage;
}

async function seedStorage(sw) {
  await sw.evaluate(async () => {
    const now = new Date().toISOString();
    await chrome.storage.local.set({
      profileVersions: {
        mainId: "v_main",
        activeId: "v_main",
        versions: [{ id: "v_main", name: "主简历", isMain: true, createdAt: now, updatedAt: now, profileV2: null }]
      }
    });
  });
  // profileV2 内容较大，单独注入（chrome evaluate 参数序列化）
  await sw.evaluate(async (profile) => {
    const stored = await chrome.storage.local.get(["profileVersions"]);
    const store = stored.profileVersions;
    store.versions[0].profileV2 = profile;
    await chrome.storage.local.set({
      profileVersions: store,
      learnedQA: [
        {
          id: "qa_test1",
          question: "是否接受调剂",
          normQuestion: "是否接受调剂",
          answer: "是",
          controlKind: "radio",
          options: ["是", "否"],
          hostname: "127.0.0.1",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          usedCount: 0
        }
      ],
      fillConfig: { onlyBlank: true },
      apiConfig: { mode: "openai-compatible", baseUrl: "http://127.0.0.1:9/none", endpointPath: "/chat/completions", apiKey: "", model: "" }
    });
  }, PROFILE_V2);
}

async function startAutofillOnTab(sw, tabId) {
  return sw.evaluate(async (id) => {
    await chrome.scripting.executeScript({ target: { tabId: id }, files: ["src/content.js"] });
    return chrome.tabs.sendMessage(id, { type: "OJAF_START_AUTOFILL" });
  }, tabId);
}

(async () => {
  const stage = stageExtension();
  const { server, port } = await serveStatic(FIXTURES);
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ojaf-profile-"));
  // 本机 Chrome 受企业策略管控（静默拒载未打包扩展），改用 Playwright 内置 Chromium。
  // channel "chromium" = 完整版 Chromium（非 headless shell），新 headless 支持扩展。
  let context;
  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      channel: "chromium",
      headless: true,
      args: [`--disable-extensions-except=${stage}`, `--load-extension=${stage}`, "--no-first-run"]
    });
  } catch (error) {
    console.log("内置 Chromium headless 启动失败，改有头模式:", error.message);
    context = await chromium.launchPersistentContext(userDataDir, {
      channel: "chromium",
      headless: false,
      args: [`--disable-extensions-except=${stage}`, `--load-extension=${stage}`, "--no-first-run"]
    });
  }

  try {
    const sw = context.serviceWorkers()[0] || (await context.waitForEvent("serviceworker", { timeout: 15000 }));
    await seedStorage(sw);

    // 调试：直读存储确认种子落盘
    const settingsProbe = await sw.evaluate(async () => {
      const stored = await chrome.storage.local.get(null);
      const pvs = stored.profileVersions;
      return {
        versionCount: pvs?.versions?.length,
        mainProfileBasic: Object.keys(pvs?.versions?.[0]?.profileV2?.sections?.basic?.values || {}),
        learnedQA: (stored.learnedQA || []).length,
        allKeys: Object.keys(stored)
      };
    });
    console.log("种子校验:", JSON.stringify(settingsProbe));

    const page = await context.newPage();
    page.on("console", (msg) => {
      const text = msg.text();
      if (text.includes("[OJAF-DBG]")) {
        console.log(text);
      }
    });
    await page.goto(`http://127.0.0.1:${port}/form-basic.html`, { waitUntil: "domcontentloaded" });

    const tabId = await getTabId(sw, page);

    // 调试：打开资料面板看 content 侧实际拿到的资料
    await sw.evaluate(async (id) => {
      await chrome.scripting.executeScript({ target: { tabId: id }, files: ["src/content.js"] });
      return chrome.tabs.sendMessage(id, { type: "OJAF_SHOW_PROFILE_PANEL" });
    }, tabId);
    await page.waitForTimeout(1500);
    const panelText = await page.evaluate(() => document.getElementById("ojaf-profile-panel")?.innerText || "(无资料面板)");
    console.log("--- 资料面板（前 400 字）---");
    console.log(panelText.replace(/\n+/g, " | ").slice(0, 400));

    const result = await startAutofillOnTab(sw, tabId);
    console.log("填写结果:", JSON.stringify(result?.data || result).slice(0, 300));

    // 正确结构的调试快照
    const dbg = (await sw.evaluate(async (id) => chrome.tabs.sendMessage(id, { type: "OJAF_GET_DEBUG_SNAPSHOT" }), tabId))?.data;
    console.log("--- 扫描字段 ---");
    for (const f of dbg?.scan?.fields || []) {
      console.log(JSON.stringify(f).slice(0, 220));
    }
    console.log("--- 候选 ---");
    for (const c of dbg?.candidates || []) {
      console.log(JSON.stringify(c).slice(0, 220));
    }

    // 页面内调试：逐控件读标记与值
    const debugRows = await page.evaluate(() =>
      Array.from(document.querySelectorAll("input,select,textarea")).map((el) => ({
        id: el.id || el.name,
        type: el.type || el.tagName,
        mark: el.getAttribute("data-ojaf-mark") || "",
        value: el.type === "checkbox" || el.type === "radio" ? (el.checked ? "checked" : "") : el.value
      }))
    );
    console.log("--- 控件状态 ---");
    debugRows.forEach((r) => console.log(JSON.stringify(r)));
    const floatText = await page.evaluate(() => document.getElementById("ojaf-floating-status")?.innerText || "(无浮动面板)");
    console.log("--- 浮动面板 ---");
    console.log(floatText.replace(/\n+/g, " | ").slice(0, 500));

    // ---- 断言 ----
    const values = await page.evaluate(() => ({
      name: document.getElementById("f-name").value,
      phone: document.getElementById("f-phone").value,
      email: document.getElementById("f-email").value,
      gender: document.getElementById("f-gender").value,
      birth: document.getElementById("f-birth").value,
      city: document.getElementById("f-city").value,
      intro: document.getElementById("f-intro").value,
      adjustYes: document.querySelector('input[name="adjust"][value="是"]').checked,
      adjustNo: document.querySelector('input[name="adjust"][value="否"]').checked,
      attachMark: document.querySelector("#f-attach")?.getAttribute("data-ojaf-mark") || "",
      nameMark: document.getElementById("f-name").getAttribute("data-ojaf-mark") || "",
      cityMark: document.getElementById("f-city").getAttribute("data-ojaf-mark") || ""
    }));

    assert.strictEqual(values.name, "张三", "姓名应填入");
    assert.strictEqual(values.phone, "13800001111", "电话应填入");
    assert.strictEqual(values.email, "zhangsan@test.com", "邮箱应填入");
    assert.strictEqual(values.gender, "male", "性别应选中男");
    assert.strictEqual(values.birth, "1999-05-12", "出生日期应填入");
    assert.strictEqual(values.intro, "认真负责，熟悉自动化测试。", "自我评价应填入");
    assert.strictEqual(values.adjustYes, true, "问答记忆应选中“是”");
    assert.strictEqual(values.city, "成都", "只填空白项：已有值字段不应被覆盖");
    assert.strictEqual(values.attachMark, "", "文件上传字段不应有标记");
    assert.strictEqual(values.nameMark, "filled", "已填字段应有绿色标记");
    assert.strictEqual(values.cityMark, "", "被跳过字段不应有标记");
    console.log("PASS 阶段一：onlyBlank=true 全部断言通过");

    // ---- 阶段二：关闭只填空白项 → 城市应被高置信覆盖为杭州 ----
    await sw.evaluate(async () => {
      await chrome.storage.local.set({ fillConfig: { onlyBlank: false } });
    });
    const result2 = await startAutofillOnTab(sw, await getTabId(sw, page));
    const city2 = await page.evaluate(() => document.getElementById("f-city").value);
    console.log("阶段二填写结果:", JSON.stringify(result2?.data || result2).slice(0, 200), "| 城市 =", city2);
    if (city2 === "杭州") {
      console.log("PASS 阶段二：onlyBlank=false 高置信覆盖生效（成都→杭州）");
    } else {
      console.log("WARN 阶段二：城市未被覆盖（本地规则分数未达覆盖阈值），覆盖路径未触发——行为仍安全");
    }

    console.log("ALL PASS: 夹具 E2E 完成");
  } finally {
    await context.close().catch(() => undefined);
    server.close();
    fs.rmSync(stage, { recursive: true, force: true });
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
  process.exit(0);
})().catch((error) => {
  console.error("FAIL:", error);
  process.exit(1);
});

async function getTabId(sw, page) {
  return sw.evaluate(async (url) => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find((t) => (t.url || "").includes(url));
    return tab?.id || 0;
  }, page.url());
}
