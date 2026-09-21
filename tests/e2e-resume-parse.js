// 端到端测试：默认内网代理 + glm-5.3-flash 真实解析简历
// 运行：node tests/e2e-resume-parse.js
// 依赖本机 127.0.0.1:15721 代理在线；代理不可达时自动跳过（不影响离线 CI）。

const assert = require("node:assert");

const store = {};
let messageHandler = null;

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

// 空存储 → getSettings 回落到 DEFAULT_API_CONFIG（即内网代理默认配置），真实走一遍解析链路
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

const SCHEMA = [
  { key: "basic", title: "基本信息", kind: "simple", fields: ["姓名", "性别", "电话", "邮箱", "现居住城市"] },
  { key: "education", title: "教育经历", kind: "repeat", fields: ["开始时间", "结束时间", "学校", "专业", "学历"] },
  { key: "internship", title: "实习经历", kind: "repeat", fields: ["开始时间", "结束时间", "公司", "职位", "工作内容"] }
];

const RESUME = `
张三，男，1999年5月出生，现居杭州，联系电话 138-0000-1111，邮箱 zhangsan@example.com。
教育经历：2021年9月至2025年6月，就读于浙江大学计算机科学与技术专业，本科学历。
实习经历：2024年3月至2024年9月，在某某科技公司担任后端开发实习生，主要负责订单系统的接口开发与单元测试。
`;

(async () => {
  // 代理不可达时优雅跳过（任何 HTTP 响应都算在线，连接拒绝才跳过）
  let reachable = false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    await fetch("http://127.0.0.1:15721/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      signal: controller.signal
    });
    clearTimeout(timer);
    reachable = true;
  } catch {
    reachable = false;
  }
  if (!reachable) {
    console.log("⏭️  本机代理 127.0.0.1:15721 不可达，跳过 E2E");
    process.exitCode = 0;
    return;
  }

  const r = await send({ type: "OJAF_PARSE_RESUME", payload: { resumeText: RESUME, schema: SCHEMA } });
  const p = r.profileV2;

  console.log("--- AI 解析结果 ---");
  console.log(JSON.stringify(p, null, 2).slice(0, 1200));

  assert.strictEqual(p.sections?.basic?.values?.["姓名"], "张三", "basic.姓名");
  assert.ok(String(p.sections?.basic?.values?.["电话"] || "").includes("138"), "basic.电话");
  const edu = p.sections?.education?.items?.[0]?.values || {};
  assert.ok(String(edu["学校"] || "").includes("浙江大学"), "education.学校");
  const intern = p.sections?.internship?.items?.[0]?.values || {};
  assert.ok(String(intern["公司"] || "").includes("某某科技"), "internship.公司");
  assert.ok(r.stats.values >= 6, "字段总数合理");

  console.log("✅ E2E 通过：默认代理 + glm-5.3-flash 真实解析简历成功");
  process.exitCode = 0;
})().catch((error) => {
  console.error("❌ E2E 失败:", error);
  process.exitCode = 1;
});
