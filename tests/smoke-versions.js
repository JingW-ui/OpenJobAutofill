// 冒烟测试：简历版本管理（主/子简历、迁移、CRUD、生效资料合并、QA 归主简历）
// 运行：node tests/smoke-versions.js

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

const LEGACY_PROFILE = {
  schemaVersion: 2,
  updatedAt: "",
  sections: {
    basic: { key: "basic", title: "基本信息", kind: "simple", values: { "姓名": "李四" }, custom: [] }
  },
  customSections: []
};

(async () => {
  // 1. 旧单份资料自动迁移为主简历版本
  store.profileV2 = JSON.parse(JSON.stringify(LEGACY_PROFILE));
  const s1 = await send({ type: "OJAF_GET_SETTINGS" });
  assert.ok(store.profileVersions, "应生成 profileVersions 存储");
  assert.strictEqual(store.profileVersions.versions.length, 1);
  assert.strictEqual(store.profileVersions.versions[0].name, "主简历");
  assert.strictEqual(s1.profileV2.sections.basic.values["姓名"], "李四", "迁移后内容保留");
  assert.strictEqual(s1.versions.activeId, store.profileVersions.mainId);
  console.log("PASS 1 旧资料迁移为主简历");

  const mainId = store.profileVersions.mainId;

  // 2. 新建空白子简历（自动切为 active）
  const c1 = await send({ type: "OJAF_CREATE_VERSION", payload: { name: "后端岗" } });
  assert.strictEqual(store.profileVersions.versions.length, 2);
  const subId = c1.version.id;
  assert.strictEqual(store.profileVersions.activeId, subId, "新建后自动激活");
  assert.strictEqual(c1.versions.list.find((v) => v.id === mainId).isMain, true);
  console.log("PASS 2 新建子简历并激活");

  // 3. 子简历生效资料 = 子简历内容（空白）→ 基本信息应为空
  const s2 = await send({ type: "OJAF_GET_SETTINGS" });
  assert.ok(!s2.profileV2.sections.basic, "空白子简历不应有主简历的内容");
  console.log("PASS 3 子简历与主简历内容隔离");

  // 4. 子简历激活时"记住"问答 → 提升到主简历；子简历生效资料自动并入
  await send({
    type: "OJAF_SAVE_LEARNED_QA",
    payload: { question: "是否接受调剂", normQuestion: "是否接受调剂", answer: "是", hostname: "mokahr.com" }
  });
  const main = store.profileVersions.versions.find((v) => v.id === mainId);
  const sub = store.profileVersions.versions.find((v) => v.id === subId);
  assert.ok(main.profileV2.customSections.some((s) => s.key === "qa-memory"), "QA 应提升到主简历");
  assert.ok(!sub.profileV2.customSections.some((s) => s.key === "qa-memory"), "子简历自身不持有 QA");
  const s3 = await send({ type: "OJAF_GET_SETTINGS" });
  assert.ok(
    s3.profileV2.customSections.some((s) => s.key === "qa-memory" && s.values["是否接受调剂"] === "是"),
    "子简历生效资料应并入主简历的问答记忆"
  );
  console.log("PASS 4 QA 归主简历 + 子简历生效合并");

  // 5. 保存子简历内容（指定 versionId）→ learnedQA 元数据不被误清
  const subProfile = JSON.parse(JSON.stringify(LEGACY_PROFILE));
  subProfile.sections.basic.values["姓名"] = "李四-后端版";
  await send({ type: "OJAF_SAVE_SETTINGS", payload: { profileV2: subProfile, versionId: subId } });
  assert.strictEqual(store.learnedQA.length, 1, "保存子简历不应清理 QA 元数据");
  const s4 = await send({ type: "OJAF_GET_SETTINGS" });
  assert.strictEqual(s4.profileV2.sections.basic.values["姓名"], "李四-后端版");
  console.log("PASS 5 子简历独立保存 + QA 元数据保留");

  // 6. 保存主简历并删掉 QA → learnedQA 元数据同步清理
  const mainEdited = JSON.parse(JSON.stringify(main.profileV2));
  mainEdited.customSections = [];
  await send({ type: "OJAF_SAVE_SETTINGS", payload: { profileV2: mainEdited, versionId: mainId } });
  assert.strictEqual(store.learnedQA.length, 0, "主简历删掉 QA 后元数据应清理");
  console.log("PASS 6 主简历 QA 一致性清理");

  // 7. 复制版本
  const c2 = await send({ type: "OJAF_CREATE_VERSION", payload: { name: "后端岗-副本", fromId: subId } });
  const copyVersion = store.profileVersions.versions.find((v) => v.id === c2.version.id);
  assert.strictEqual(copyVersion.profileV2.sections.basic.values["姓名"], "李四-后端版", "复制应带内容");
  console.log("PASS 7 复制版本");

  // 8. 主简历保护 + 删除 active 回落
  await assert.rejects(() => send({ type: "OJAF_DELETE_VERSION", payload: { id: mainId } }), /主简历不能删除/);
  await send({ type: "OJAF_DELETE_VERSION", payload: { id: c2.version.id } });
  assert.strictEqual(store.profileVersions.activeId, mainId, "删除 active 版本后回落主简历");
  console.log("PASS 8 主简历保护 + 删除回落");

  // 9. 重命名 + 切换 active
  await send({ type: "OJAF_RENAME_VERSION", payload: { id: subId, name: "后端开发-杭州" } });
  await send({ type: "OJAF_SET_ACTIVE_VERSION", payload: { id: subId } });
  const s5 = await send({ type: "OJAF_GET_SETTINGS" });
  assert.strictEqual(s5.versions.activeId, subId);
  assert.strictEqual(s5.versions.list.find((v) => v.id === subId).name, "后端开发-杭州");
  console.log("PASS 9 重命名 + 切换 active");

  // 10. 同名拒绝 + 上限保护
  await assert.rejects(() => send({ type: "OJAF_CREATE_VERSION", payload: { name: "后端开发-杭州" } }), /同名/);
  console.log("PASS 10 同名拒绝");

  // 11. 导入解析草稿：落为新版本、不激活、名称自动去重
  const draftProfile = {
    schemaVersion: 2,
    updatedAt: "",
    sections: { basic: { key: "basic", title: "基本信息", kind: "simple", values: { "姓名": "王五" }, custom: [] } },
    customSections: []
  };
  const imp1 = await send({ type: "OJAF_IMPORT_PARSED_VERSION", payload: { name: "导入-mokahr.com-09-21", profileV2: draftProfile } });
  assert.ok(imp1.version.id, "草稿应有 id");
  assert.strictEqual(store.profileVersions.activeId, subId, "导入草稿不应改变 active 版本");
  const imp2 = await send({ type: "OJAF_IMPORT_PARSED_VERSION", payload: { name: "导入-mokahr.com-09-21", profileV2: draftProfile } });
  assert.strictEqual(imp2.version.name, "导入-mokahr.com-09-21-2", "重名应自动加后缀");
  const s6 = await send({ type: "OJAF_GET_VERSION", payload: { id: imp1.version.id } });
  assert.strictEqual(s6.version.profileV2.sections.basic.values["姓名"], "王五");
  console.log("PASS 11 导入草稿：新版本 + 不激活 + 名称去重");

  // 12. 空解析结果拒绝导入
  await assert.rejects(
    () => send({ type: "OJAF_IMPORT_PARSED_VERSION", payload: { name: "空的", profileV2: { schemaVersion: 2, sections: {}, customSections: [] } } }),
    /为空/
  );
  console.log("PASS 12 空草稿拒绝");

  // 13. fillConfig 只填空白项：默认 true + 可关闭 + 读取回环
  const s7 = await send({ type: "OJAF_GET_SETTINGS" });
  assert.strictEqual(s7.fillConfig.onlyBlank, true, "onlyBlank 默认应为 true");
  await send({ type: "OJAF_SAVE_SETTINGS", payload: { fillConfig: { onlyBlank: false } } });
  const s8 = await send({ type: "OJAF_GET_SETTINGS" });
  assert.strictEqual(s8.fillConfig.onlyBlank, false, "关闭后应读回 false");
  await send({ type: "OJAF_SAVE_SETTINGS", payload: { fillConfig: { onlyBlank: true } } });
  console.log("PASS 13 fillConfig 默认值与读写回环");

  console.log("ALL PASS: 版本管理断言全部通过");
  process.exit(0);
})().catch((error) => {
  console.error("FAIL:", error);
  process.exit(1);
});
