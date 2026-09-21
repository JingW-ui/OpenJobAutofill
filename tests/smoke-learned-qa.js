// 冒烟测试：background.js 问答记忆存储逻辑（learnedQA + customSections 双写提升）
// 运行：node tests/smoke-learned-qa.js
// 用最小 chrome mock 加载 background.js，捕获 onMessage 处理器直接驱动消息流。

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

require("../src/background.js");

assert.ok(messageHandler, "onMessage 处理器应已注册");

function send(message) {
  return new Promise((resolve, reject) => {
    const keepOpen = messageHandler(message, null, (response) => {
      if (!response || !response.ok) {
        reject(new Error(response?.error || "empty response"));
        return;
      }
      resolve(response.data);
    });
    assert.strictEqual(keepOpen, true, "处理器应返回 true 保持异步通道");
  });
}

(async () => {
  // 1. 保存第一条记忆并验证双写提升
  const r1 = await send({
    type: "OJAF_SAVE_LEARNED_QA",
    payload: {
      question: "是否接受调剂",
      normQuestion: "是否接受调剂",
      answer: "是",
      controlKind: "radio",
      options: ["是", "否"],
      hostname: "mokahr.com"
    }
  });
  assert.ok(r1.saved && r1.qa.id, "首次保存应返回 qa");
  assert.strictEqual(r1.learnedCount, 1);
  let profile = store.profileVersions.versions.find((v) => v.id === store.profileVersions.mainId).profileV2;
  let section = profile.customSections.find((s) => s.key === "qa-memory");
  assert.ok(section, "应提升到 customSections[qa-memory]");
  assert.strictEqual(section.values["是否接受调剂"], "是");
  assert.strictEqual(section.title, "问答记忆");

  // 2. 同 normQuestion 再保存 → 更新而不是新增
  const r2 = await send({
    type: "OJAF_SAVE_LEARNED_QA",
    payload: { question: "是否接受调剂", normQuestion: "是否接受调剂", answer: "否", hostname: "mokahr.com" }
  });
  assert.strictEqual(r2.qa.id, r1.qa.id, "同问题应更新同一条");
  assert.strictEqual(r2.learnedCount, 1);
  assert.strictEqual(store.learnedQA[0].answer, "否");
  profile = store.profileVersions.versions.find((v) => v.id === store.profileVersions.mainId).profileV2;
  section = profile.customSections.find((s) => s.key === "qa-memory");
  assert.strictEqual(section.values["是否接受调剂"], "否");

  // 3. 保存第二条
  await send({
    type: "OJAF_SAVE_LEARNED_QA",
    payload: { question: "期望工作地点", normQuestion: "期望工作地点", answer: "上海", hostname: "mokahr.com" }
  });
  assert.strictEqual(store.learnedQA.length, 2);

  // 4. touch 增加使用次数
  const t = await send({ type: "OJAF_TOUCH_LEARNED_QA", payload: { id: r1.qa.id } });
  assert.ok(t.touched);
  assert.strictEqual(store.learnedQA.find((q) => q.id === r1.qa.id).usedCount, 1);

  // 5. GET_SETTINGS 应携带 learnedQA
  const settings = await send({ type: "OJAF_GET_SETTINGS" });
  assert.ok(Array.isArray(settings.learnedQA) && settings.learnedQA.length === 2, "settings 应含 learnedQA");
  assert.ok(settings.profileV2.customSections.some((s) => s.key === "qa-memory"));

  // 6. 删除并验证 customSections 同步清理
  const d = await send({ type: "OJAF_DELETE_LEARNED_QA", payload: { id: r1.qa.id } });
  assert.ok(d.deleted);
  assert.strictEqual(d.learnedCount, 1);
  profile = store.profileVersions.versions.find((v) => v.id === store.profileVersions.mainId).profileV2;
  section = profile.customSections.find((s) => s.key === "qa-memory");
  assert.ok(!section.values["是否接受调剂"], "删除后 qa-memory 不应再有该问题");
  assert.strictEqual(section.values["期望工作地点"], "上海");

  // 7. 空答案拒绝
  await assert.rejects(() => send({
    type: "OJAF_SAVE_LEARNED_QA",
    payload: { question: "x", normQuestion: "x", answer: " " }
  }), /答案为空/);

  // 8. 设置页保存主简历（删掉 qa-memory 里的问题）→ learnedQA 元数据应被同步清理
  const profileAfterDelete = JSON.parse(
    JSON.stringify(store.profileVersions.versions.find((v) => v.id === store.profileVersions.mainId).profileV2)
  );
  profileAfterDelete.customSections = profileAfterDelete.customSections.filter((s) => s.key !== "qa-memory");
  await send({ type: "OJAF_SAVE_SETTINGS", payload: { profileV2: profileAfterDelete } });
  assert.strictEqual(store.learnedQA.length, 0, "qa-memory 被清空后 learnedQA 应同步清空");

  console.log("✅ 全部 8 组断言通过：learnedQA 保存/去重/提升/touch/携带/删除/校验/一致性清理 均正常");
  process.exit(0);
})().catch((error) => {
  console.error("❌ 冒烟测试失败:", error);
  process.exit(1);
});
