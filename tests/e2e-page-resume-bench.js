// 基准测试：真实代理解析 tests/fixtures-page-resume.txt，计时并输出结果概览
// 运行：node tests/e2e-page-resume-bench.js [model]
// 例：node tests/e2e-page-resume-bench.js glm-5.3-flash
//     node tests/e2e-page-resume-bench.js auto_deepseek_plan

const fs = require("node:fs");
const path = require("node:path");

const model = process.argv[2] || "glm-5.3-flash";
const fixture = path.join(__dirname, "fixtures-page-resume.txt");
if (!fs.existsSync(fixture)) {
  console.log("缺少 fixtures-page-resume.txt（该文件含个人信息，不入库，需本地生成）");
  process.exit(0);
}
const resumeText = fs.readFileSync(fixture, "utf8");

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
      async clear() {}
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

(async () => {
  console.log(`模型: ${model} | 输入 ${resumeText.length} 字符 | 开始 ${new Date().toLocaleTimeString()}`);
  const t0 = Date.now();
  const heartbeat = setInterval(() => {
    console.log(`  ... 已等待 ${Math.round((Date.now() - t0) / 1000)}s`);
  }, 15000);
  try {
    const r = await send({
      type: "OJAF_PARSE_RESUME",
      payload: { resumeText, apiConfig: { parseModel: model } }
    });
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    const sectionKeys = Object.keys(r.profileV2.sections);
    console.log(`完成: ${elapsed}s | sections=${sectionKeys.join(",")} | custom=${r.profileV2.customSections.length} | values=${r.stats.values}`);
    console.log("basic:", JSON.stringify(r.profileV2.sections.basic?.values || {}).slice(0, 300));
    console.log("education items:", (r.profileV2.sections.education?.items || []).length);
    console.log("project items:", (r.profileV2.sections.project?.items || []).length);
    process.exitCode = 0;
  } catch (error) {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.error(`失败(${elapsed}s):`, error.message);
    process.exitCode = 1;
  } finally {
    clearInterval(heartbeat);
  }
})();
