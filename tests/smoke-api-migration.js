// 冒烟测试：旧版默认 API 配置（api.openai.com + 空 Key）自动迁移到内网代理
// 运行：node tests/smoke-api-migration.js
// 通过捕获 onStartup 监听器来触发迁移（模拟浏览器启动）。

const assert = require("node:assert");

const settle = () => new Promise((resolve) => setTimeout(resolve, 80));

function loadBackgroundWith(store) {
  const listeners = {};
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
      onInstalled: { addListener(fn) { listeners.onInstalled = fn; } },
      onStartup: { addListener(fn) { listeners.onStartup = fn; } },
      onMessage: { addListener(fn) { listeners.onMessage = fn; } },
      lastError: null
    },
    alarms: { onAlarm: { addListener() {} } }
  };
  const path = require.resolve("../src/background.js");
  delete require.cache[path];
  require(path);
  return listeners;
}

const LEGACY = {
  mode: "openai-compatible",
  baseUrl: "https://api.openai.com/v1",
  endpointPath: "/chat/completions",
  apiKey: "",
  model: "your-model-name"
};

(async () => {
  // 场景 1：旧默认配置（空 Key + openai.com）→ 应迁移到内网代理
  {
    const store = { apiConfig: { ...LEGACY } };
    const listeners = loadBackgroundWith(store);
    await listeners.onStartup();
    await settle();
    assert.strictEqual(store.apiConfig.baseUrl, "http://127.0.0.1:15721/v1", "baseUrl 应切到内网");
    assert.strictEqual(store.apiConfig.apiKey, "codemaker-managed", "Key 应回填");
    assert.strictEqual(store.apiConfig.model, "glm-5.3-flash", "模型应为 glm-5.3-flash");
    console.log("PASS 场景 1：旧默认配置已迁移");
  }

  // 场景 2：用户自配（有 Key）→ 不动
  {
    const store = { apiConfig: { ...LEGACY, baseUrl: "https://api.deepseek.com/v1", apiKey: "sk-real", model: "deepseek-chat" } };
    const listeners = loadBackgroundWith(store);
    await listeners.onStartup();
    await settle();
    assert.strictEqual(store.apiConfig.baseUrl, "https://api.deepseek.com/v1");
    assert.strictEqual(store.apiConfig.apiKey, "sk-real");
    console.log("PASS 场景 2：用户自配有 Key 配置不动");
  }

  // 场景 3：自定义 endpoint 但没填 Key → 不动（尊重用户自定义）
  {
    const store = { apiConfig: { ...LEGACY, baseUrl: "https://my-own-gateway.com/v1", apiKey: "" } };
    const listeners = loadBackgroundWith(store);
    await listeners.onStartup();
    await settle();
    assert.strictEqual(store.apiConfig.baseUrl, "https://my-own-gateway.com/v1");
    assert.strictEqual(store.apiConfig.apiKey, "");
    console.log("PASS 场景 3：自定义 endpoint 无 Key 不被覆盖");
  }

  // 场景 4：全新安装（无存储）→ 迁移不写，播种由 onInstalled 负责
  {
    const store = {};
    const listeners = loadBackgroundWith(store);
    await listeners.onStartup();
    await settle();
    assert.ok(!("apiConfig" in store), "全新安装时迁移不应写入");
    console.log("PASS 场景 4：全新安装不被迁移干扰");
  }

  console.log("ALL PASS: 迁移场景断言全部通过");
  process.exit(0);
})().catch((error) => {
  console.error("FAIL:", error);
  process.exit(1);
});
