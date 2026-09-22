// 上游分支验证：夹具 E2E 跑在未含 fork 功能的代码上（PR 证据用）
// 用法：node tests/e2e-fixtures/run-upstream.js <上游扩展目录>
// 与 run.js 的差异：种子用上游单份 profileV2 存储键；不验证问答记忆/只填空白项等 fork 功能。

const assert = require("node:assert");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright");

const EXT_ROOT = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!EXT_ROOT || !fs.existsSync(path.join(EXT_ROOT, "manifest.json"))) {
  console.error("用法: node tests/e2e-fixtures/run-upstream.js <上游扩展目录>");
  process.exit(1);
}
const FIXTURES = __dirname;
const EXT_INCLUDE = ["manifest.json", "src", "icons", "assets", "sample-profile.json"];

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
        "现居住城市": "杭州",
        "最高学历": "硕士"
      },
      custom: []
    },
    self: {
      key: "self",
      title: "自我描述",
      kind: "simple",
      values: { "自我评价": "认真负责，熟悉自动化测试。" },
      custom: []
    },
    intention: {
      key: "intention",
      title: "求职意向",
      kind: "repeat",
      items: [{ title: "求职意向 1", values: { "意向岗位": "测试开发工程师", "期望工作城市": "浙江省杭州市" }, custom: [] }]
    },
    education: {
      key: "education",
      title: "教育经历",
      kind: "repeat",
      items: [
        { title: "教育经历 1", values: { "学校": "浙江大学", "专业": "计算机科学与技术", "开始时间": "2024-09", "结束时间": "2027-06" }, custom: [] },
        { title: "教育经历 2", values: { "学校": "西南科技大学", "专业": "生物医学工程", "开始时间": "2020-09", "结束时间": "2024-06" }, custom: [] }
      ]
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
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), "ojaf-upstream-ext-"));
  for (const item of EXT_INCLUDE) {
    fs.cpSync(path.join(EXT_ROOT, item), path.join(stage, item), { recursive: true });
  }
  const manifestPath = path.join(stage, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.host_permissions = [...(manifest.host_permissions || []), "http://127.0.0.1/*"];
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return stage;
}

async function getTabId(sw, page) {
  return sw.evaluate(async (url) => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find((t) => (t.url || "").includes(url));
    return tab?.id || 0;
  }, page.url());
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
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ojaf-upstream-profile-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${stage}`, `--load-extension=${stage}`, "--no-first-run"]
  });

  try {
    const sw = context.serviceWorkers()[0] || (await context.waitForEvent("serviceworker", { timeout: 15000 }));
    await sw.evaluate(async (profile) => {
      await chrome.storage.local.set({
        profileV2: profile,
        apiConfig: { mode: "openai-compatible", baseUrl: "http://127.0.0.1:9/none", endpointPath: "/chat/completions", apiKey: "", model: "" }
      });
    }, PROFILE_V2);

    const page = await context.newPage();
    page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));

    // 基础表单：字段填充 + 预填值保守
    await page.goto(`http://127.0.0.1:${port}/form-basic.html`, { waitUntil: "domcontentloaded" });
    await startAutofillOnTab(sw, await getTabId(sw, page));
    let v = await page.evaluate(() => ({
      name: document.getElementById("f-name").value,
      phone: document.getElementById("f-phone").value,
      email: document.getElementById("f-email").value,
      gender: document.getElementById("f-gender").value,
      birth: document.getElementById("f-birth").value,
      intro: document.getElementById("f-intro").value,
      city: document.getElementById("f-city").value
    }));
    assert.strictEqual(v.name, "张三");
    assert.strictEqual(v.phone, "13800001111");
    assert.strictEqual(v.email, "zhangsan@test.com");
    assert.strictEqual(v.gender, "male");
    assert.strictEqual(v.birth, "1999-05-12");
    assert.strictEqual(v.intro, "认真负责，熟悉自动化测试。");
    assert.strictEqual(v.city, "成都", "已有值字段低于覆盖阈值，不应被改动");
    console.log("PASS 基础表单");

    // ant-design：下拉 + 级联 + 搜索懒加载
    await page.goto(`http://127.0.0.1:${port}/form-antd.html`, { waitUntil: "domcontentloaded" });
    await startAutofillOnTab(sw, await getTabId(sw, page));
    await page.waitForTimeout(500);
    v = await page.evaluate(() => ({
      name: document.getElementById("f-name").value,
      gender: document.querySelector("#gender-select")?.dataset.selected || "",
      city: document.querySelector("#city-cascader")?.dataset.selected || "",
      job: document.querySelector("#job-select")?.dataset.selected || ""
    }));
    assert.strictEqual(v.name, "张三");
    assert.strictEqual(v.gender, "男");
    assert.ok(v.city.includes("杭州市"), `级联应选到杭州市，实际：${v.city}`);
    assert.strictEqual(v.job, "测试开发工程师");
    console.log("PASS ant-design 控件");

    // 重复块按序
    await page.goto(`http://127.0.0.1:${port}/form-repeat.html`, { waitUntil: "domcontentloaded" });
    await startAutofillOnTab(sw, await getTabId(sw, page));
    v = await page.evaluate(() => ({
      school1: document.querySelector('[name="school1"]').value,
      school2: document.querySelector('[name="school2"]').value,
      start1: document.querySelector('[name="start1"]').value
    }));
    assert.strictEqual(v.school1, "浙江大学");
    assert.strictEqual(v.school2, "西南科技大学");
    assert.strictEqual(v.start1, "2024-09");
    console.log("PASS 重复块按序填充");

    // element-ui
    await page.goto(`http://127.0.0.1:${port}/form-element-ui.html`, { waitUntil: "domcontentloaded" });
    await startAutofillOnTab(sw, await getTabId(sw, page));
    await page.waitForTimeout(400);
    v = await page.evaluate(() => ({
      gender: document.querySelector("#gender-select")?.dataset.selected || "",
      edu: document.querySelector("#edu-select")?.dataset.selected || ""
    }));
    assert.strictEqual(v.gender, "男");
    assert.strictEqual(v.edu, "硕士");
    console.log("PASS element-ui 控件");

    // 多步骤
    await page.goto(`http://127.0.0.1:${port}/form-steps.html`, { waitUntil: "domcontentloaded" });
    await startAutofillOnTab(sw, await getTabId(sw, page));
    assert.strictEqual(await page.evaluate(() => document.getElementById("s1-name").value), "张三");
    await page.click("#next1");
    await startAutofillOnTab(sw, await getTabId(sw, page));
    assert.strictEqual(await page.evaluate(() => document.getElementById("s2-email").value), "zhangsan@test.com");
    console.log("PASS 多步骤表单");

    console.log("ALL PASS: 上游分支夹具验证完成");
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
