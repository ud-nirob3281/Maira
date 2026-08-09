var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server.ts
var server_exports = {};
__export(server_exports, {
  acquireSabitTask: () => acquireSabitTask,
  broadcastSabitRuntimeState: () => broadcastSabitRuntimeState,
  broadcastSabitTaskState: () => broadcastSabitTaskState,
  cancelSabitTask: () => cancelSabitTask,
  currentSabitTaskObj: () => currentSabitTaskObj,
  getSabitStatus: () => getSabitStatus,
  getSabitStatusSummary: () => getSabitStatusSummary,
  logSabitWS: () => logSabitWS,
  releaseSabitTask: () => releaseSabitTask,
  resumeSabitTask: () => resumeSabitTask,
  sabitRuntimeState: () => sabitRuntimeState,
  setSabitTaskStatus: () => setSabitTaskStatus,
  transitionSabitTaskState: () => transitionSabitTaskState
});
module.exports = __toCommonJS(server_exports);
var import_express = __toESM(require("express"), 1);
var import_http = __toESM(require("http"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_child_process = require("child_process");
var import_ws = require("ws");
var import_genai3 = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);
var fs3 = __toESM(require("fs"), 1);

// server_memory.ts
var import_promises = __toESM(require("fs/promises"), 1);
var import_genai = require("@google/genai");

// server_paths.ts
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var DATA_DIR = process.env.MYRAA_DATA_DIR || process.cwd();
try {
  import_fs.default.mkdirSync(DATA_DIR, { recursive: true });
} catch {
}
function dataFile(name) {
  return import_path.default.join(DATA_DIR, name);
}
var SECRETS_FILE = dataFile("secrets.json");
function readSecrets() {
  try {
    if (import_fs.default.existsSync(SECRETS_FILE)) {
      return JSON.parse(import_fs.default.readFileSync(SECRETS_FILE, "utf-8"));
    }
  } catch {
  }
  return {};
}
function setGeminiApiKey(key) {
  const trimmed = (key || "").trim();
  if (!trimmed) throw new Error("API key must not be empty.");
  try {
    const dataSecrets = readSecrets();
    dataSecrets.geminiApiKey = trimmed;
    import_fs.default.writeFileSync(SECRETS_FILE, JSON.stringify(dataSecrets, null, 2), "utf-8");
    try {
      import_fs.default.chmodSync(SECRETS_FILE, 384);
    } catch {
    }
  } catch (err) {
    console.error("[Secrets] Error writing to secrets file:", err?.message || err);
  }
}
try {
  const envKey = process.env.GEMINI_API_KEY?.trim();
  if (envKey) {
    const currentKey = getGeminiApiKey();
    if (!currentKey) {
      setGeminiApiKey(envKey);
      console.log("[Secrets Migration] Successfully migrated environment GEMINI_API_KEY to secrets.json");
    }
  }
} catch (err) {
  console.error("[Secrets Migration] Error migrating key:", err?.message || err);
}
function getGeminiApiKey() {
  const dataKey = readSecrets().geminiApiKey?.trim();
  if (dataKey) return dataKey;
  const envKey = process.env.GEMINI_API_KEY?.trim();
  if (envKey) return envKey;
  return void 0;
}
function hasGeminiApiKey() {
  return Boolean(getGeminiApiKey());
}
function getSabitApiKey() {
  const dataKey = readSecrets().sabitApiKey?.trim();
  if (dataKey) return dataKey;
  return getGeminiApiKey();
}
function setSabitApiKey(key) {
  const trimmed = (key || "").trim();
  if (!trimmed) throw new Error("Sabit API key must not be empty.");
  try {
    const dataSecrets = readSecrets();
    dataSecrets.sabitApiKey = trimmed;
    import_fs.default.writeFileSync(SECRETS_FILE, JSON.stringify(dataSecrets, null, 2), "utf-8");
    try {
      import_fs.default.chmodSync(SECRETS_FILE, 384);
    } catch {
    }
  } catch (err) {
    console.error("[Secrets] Error writing Sabit API key:", err?.message || err);
  }
}
function hasSabitApiKey() {
  return Boolean(getSabitApiKey());
}
function hasCustomSabitApiKey() {
  return Boolean(readSecrets().sabitApiKey?.trim());
}
function clearSabitApiKey() {
  try {
    const dataSecrets = readSecrets();
    delete dataSecrets.sabitApiKey;
    import_fs.default.writeFileSync(SECRETS_FILE, JSON.stringify(dataSecrets, null, 2), "utf-8");
  } catch {
  }
}

// server_memory.ts
var MEMORY_FILE = dataFile("memories.json");
var LEARN_FILE = dataFile("learn.json");
var MemoryCacheManager = class {
  constructor() {
    this.memories = [];
    this.learnedRules = [];
    this.isLoaded = false;
    this.writeTimer = null;
    this.loadingPromise = null;
  }
  async ensureLoaded() {
    if (this.isLoaded) return;
    if (this.loadingPromise) return this.loadingPromise;
    this.loadingPromise = (async () => {
      try {
        try {
          const memData = await import_promises.default.readFile(MEMORY_FILE, "utf-8");
          this.memories = JSON.parse(memData);
          this.memories = this.deduplicateMemories(this.memories);
        } catch (error) {
          if (error.code !== "ENOENT") {
            console.error("[MemoryCache] Error reading memories file:", error);
          }
          this.memories = [];
        }
        try {
          const learnData = await import_promises.default.readFile(LEARN_FILE, "utf-8");
          this.learnedRules = JSON.parse(learnData);
          this.learnedRules = this.deduplicateRules(this.learnedRules);
        } catch (error) {
          if (error.code !== "ENOENT") {
            console.error("[MemoryCache] Error reading learn file:", error);
          }
          this.learnedRules = [];
        }
        this.isLoaded = true;
        console.log(`[MemoryCache] Core loaded: ${this.memories.length} memories, ${this.learnedRules.length} learned rules.`);
      } catch (err) {
        console.error("[MemoryCache] Failed to initialize cache:", err);
      } finally {
        this.loadingPromise = null;
      }
    })();
    return this.loadingPromise;
  }
  async getMemories() {
    await this.ensureLoaded();
    return this.memories;
  }
  async getLearnedRules() {
    await this.ensureLoaded();
    return this.learnedRules;
  }
  async setMemories(newMemories) {
    await this.ensureLoaded();
    this.memories = this.deduplicateMemories(newMemories);
    this.scheduleWrite();
  }
  async setLearnedRules(newRules) {
    await this.ensureLoaded();
    this.learnedRules = this.deduplicateRules(newRules);
    this.scheduleWrite();
  }
  /**
   * Throttled, non-blocking asynchronous disk writer to prevent disk thrashing and server lags.
   */
  scheduleWrite() {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
    }
    this.writeTimer = setTimeout(async () => {
      try {
        await import_promises.default.writeFile(MEMORY_FILE, JSON.stringify(this.memories, null, 2), "utf-8");
        await import_promises.default.writeFile(LEARN_FILE, JSON.stringify(this.learnedRules, null, 2), "utf-8");
        console.log(`[MemoryCache] Sync completed asynchronously. Cached data safely written to disk.`);
      } catch (err) {
        console.error("[MemoryCache] Failed to write cache to files:", err);
      }
    }, 1e3);
  }
  deduplicateMemories(mems) {
    const seen = /* @__PURE__ */ new Set();
    return mems.filter((m) => {
      if (!m || !m.text || !m.category) return false;
      const key = `${m.category}:${m.text.toLowerCase().trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  deduplicateRules(rules) {
    const seen = /* @__PURE__ */ new Set();
    return rules.filter((r) => {
      if (!r || !r.rule || !r.category) return false;
      const key = `${r.category}:${r.rule.toLowerCase().trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
};
var memoryCache = new MemoryCacheManager();
async function loadMemories() {
  return memoryCache.getMemories();
}
async function saveMemories(memories) {
  await memoryCache.setMemories(memories);
}
async function loadLearnedRules() {
  return memoryCache.getLearnedRules();
}
async function saveLearnedRules(rules) {
  await memoryCache.setLearnedRules(rules);
}
function formatSystemInstructionsWithContext(baseInstruction, memories, rules, recentConversation) {
  let block = "\n\n=== MYRAA PERSISTENT COGNITIVE CORE ===\n";
  if (rules.length > 0) {
    block += "\n[COGNITIVE LEARNING CORE - ACTIVE RULES & BEHAVIOR (PRIORITY 1)]\n";
    block += "You must strictly adapt your behavior according to these feedback rules learned from past conversations:\n";
    const groups = {};
    rules.forEach((r) => {
      groups[r.category] = groups[r.category] || [];
      groups[r.category].push(r.rule);
    });
    const ruleOrder = [
      { key: "behavior_improvement", label: "Communication Style & Persona Guidelines" },
      { key: "error_correction", label: "Automation Correction Rules (Mistakes Learned)" },
      { key: "automation_rule", label: "Custom Automation Guides" },
      { key: "decision_rule", label: "General Decision Frameworks" }
    ];
    ruleOrder.forEach((cat) => {
      const list = groups[cat.key] || [];
      if (list.length > 0) {
        block += `* ${cat.label}:
` + list.map((item) => `  - ${item}`).join("\n") + "\n";
      }
    });
  } else {
    block += "\n[COGNITIVE LEARNING CORE]\nNo rules have been hard-taught yet. Remain sweet, helpful, and learn actively from any user/developer feedback.\n";
  }
  if (memories.length > 0) {
    block += "\n[PERSISTENT KNOWLEDGE CARD (PRIORITY 2)]\n";
    block += "Your persistent recollections of your friend TECH:\n";
    const groups = {};
    memories.forEach((m) => {
      groups[m.category] = groups[m.category] || [];
      groups[m.category].push(m.text);
    });
    const memOrder = [
      { key: "identity", label: "Identity & Personal Details" },
      { key: "preference", label: "Preferences & Tastes" },
      { key: "goal", label: "Aspirations & Goals" },
      { key: "project", label: "Ongoing Projects" },
      { key: "relationship", label: "Key People & Relationships" },
      { key: "emotional", label: "Emotional Highlights & Milestones" },
      { key: "frequent", label: "Frequently Used Data" },
      { key: "temporary", label: "Current Active Session Context" }
    ];
    memOrder.forEach((cat) => {
      const list = groups[cat.key] || [];
      if (list.length > 0) {
        block += `* ${cat.label}:
` + list.map((item) => `  - ${item}`).join("\n") + "\n";
      }
    });
  }
  if (recentConversation && recentConversation.length > 0) {
    block += "\n[RECENT CONVERSATION CONTEXT (RESUMED) (PRIORITY 3)]\n";
    block += "You recently had a quick cognitive synchronization. Below is the transcript of your active conversation before this sync. Seamlessly resume speaking to the user based on this history with no disconnect or amnesia:\n";
    recentConversation.forEach((line) => {
      block += `${line.role === "user" ? "User" : "Myraa"}: ${line.text}
`;
    });
  }
  block += "\n=========================================\n";
  return baseInstruction + block;
}
var isConsolidating = false;
async function processConversationSlice(apiKey, dialogueHistory) {
  if (isConsolidating) {
    console.log("[MemoryCache] Pipeline is busy. Skipping turn consolidation.");
    return null;
  }
  if (dialogueHistory.length < 2) {
    return null;
  }
  isConsolidating = true;
  console.log("[MemoryCache] Starting background cognitive consolidation pipeline...");
  try {
    const ai = new import_genai.GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
    const currentMemories = await loadMemories();
    const currentRules = await loadLearnedRules();
    const memoriesStr = currentMemories.map((m) => `[ID: ${m.id}] Category: ${m.category} | Fact: ${m.text}`).join("\n");
    const rulesStr = currentRules.map((r) => `[ID: ${r.id}] Category: ${r.category} | Rule: ${r.rule}`).join("\n");
    const dialogueStr = dialogueHistory.map((line) => `${line.role === "user" ? "User" : "Myraa"}: ${line.text}`).join("\n");
    const prompt = `You are Myraa's dual-core cognitive recollection and behavioral learning engine. 
Analyze the recent conversation piece to extract new facts, enduring preferences, goals, or critical behavior improvements.

### OBJECTIVE
1. **User Memories (memories.json)**: Extract durable user-specific facts, ongoing projects, relationships, goals, or long-term preferences. Avoid cataloging general greeting text.
2. **Behavioral Rules (learn.json)**: Pay extreme attention to when the user or developer corrects your behavior, speaks about communication styles, points out errors (e.g. "always speak in Bengali", "don't guess selectors", "On Facebook, click the profile first"), or gives explicit automation, conversational, or decision instructions. These are cognitive behavior rules.
3. **Avoid Duplicates**: If a rule or memory already exists, do NOT output a duplicate ADD. If previous info is corrected, output an UPDATE transaction with the correct ID.

### CURRENT COGNITIVE DATA CARD:
[Memories Card]
${memoriesStr || "(None)"}

[Behavioral Learning Card]
${rulesStr || "(None)"}

### RECENT DIALOGUE HISTORY:
${dialogueStr}

### RULES
- Actions: "ADD" (new facts/rules), "UPDATE" (evolved or changed facts/rules), "REMOVE" (if user asks to forget).
- Text Style: Concise, third-person declarative summaries (e.g., "The user is studying computer science", "Rule: Always check WhatsApp input box before typing"). No filler words.
- ID: Specify the exact existing ID for UPDATE or REMOVE, leave blank or null for ADD.`;
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: import_genai.Type.OBJECT,
          properties: {
            transactions: {
              type: import_genai.Type.ARRAY,
              description: "Transactions for memories.json (user-specific facts).",
              items: {
                type: import_genai.Type.OBJECT,
                properties: {
                  action: { type: import_genai.Type.STRING, enum: ["ADD", "UPDATE", "REMOVE"] },
                  id: { type: import_genai.Type.STRING },
                  category: { type: import_genai.Type.STRING, enum: ["identity", "preference", "goal", "project", "relationship", "emotional", "frequent", "temporary"] },
                  text: { type: import_genai.Type.STRING, description: "Declarative fact or preference statement in third-person." }
                },
                required: ["action", "category", "text"]
              }
            },
            learningTransactions: {
              type: import_genai.Type.ARRAY,
              description: "Transactions for learn.json (cognitive behavior, error correction, and automation rules).",
              items: {
                type: import_genai.Type.OBJECT,
                properties: {
                  action: { type: import_genai.Type.STRING, enum: ["ADD", "UPDATE", "REMOVE"] },
                  id: { type: import_genai.Type.STRING },
                  category: { type: import_genai.Type.STRING, enum: ["behavior_improvement", "error_correction", "automation_rule", "decision_rule"] },
                  rule: { type: import_genai.Type.STRING, description: "Declarative learned behavior or instruction in third-person." },
                  context: { type: import_genai.Type.STRING, description: "Optional specific app or language name." }
                },
                required: ["action", "category", "rule"]
              }
            }
          },
          required: ["transactions", "learningTransactions"]
        }
      }
    });
    const resultObj = JSON.parse(response.text?.trim() || '{"transactions":[],"learningTransactions":[]}');
    const transactions = resultObj.transactions || [];
    const learningTransactions = resultObj.learningTransactions || [];
    if (transactions.length === 0 && learningTransactions.length === 0) {
      console.log("[MemoryCache] Zero cognitive changes extracted from dialogue slice.");
      isConsolidating = false;
      return null;
    }
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    let updatedMemories = [...currentMemories];
    for (const trx of transactions) {
      if (trx.action === "ADD") {
        updatedMemories.push({
          id: Math.random().toString(36).substring(2, 11),
          category: trx.category,
          text: trx.text,
          createdAt: timestamp,
          updatedAt: timestamp
        });
      } else if (trx.action === "UPDATE") {
        const idx = updatedMemories.findIndex((m) => m.id === trx.id);
        if (idx !== -1) {
          updatedMemories[idx] = {
            ...updatedMemories[idx],
            category: trx.category,
            text: trx.text,
            updatedAt: timestamp
          };
        } else {
          updatedMemories.push({
            id: Math.random().toString(36).substring(2, 11),
            category: trx.category,
            text: trx.text,
            createdAt: timestamp,
            updatedAt: timestamp
          });
        }
      } else if (trx.action === "REMOVE") {
        updatedMemories = updatedMemories.filter((m) => m.id !== trx.id);
      }
    }
    let updatedRules = [...currentRules];
    for (const trx of learningTransactions) {
      if (trx.action === "ADD") {
        updatedRules.push({
          id: Math.random().toString(36).substring(2, 11),
          category: trx.category,
          rule: trx.rule,
          context: trx.context,
          createdAt: timestamp,
          updatedAt: timestamp
        });
      } else if (trx.action === "UPDATE") {
        const idx = updatedRules.findIndex((r) => r.id === trx.id);
        if (idx !== -1) {
          updatedRules[idx] = {
            ...updatedRules[idx],
            category: trx.category,
            rule: trx.rule,
            context: trx.context,
            updatedAt: timestamp
          };
        } else {
          updatedRules.push({
            id: Math.random().toString(36).substring(2, 11),
            category: trx.category,
            rule: trx.rule,
            context: trx.context,
            createdAt: timestamp,
            updatedAt: timestamp
          });
        }
      } else if (trx.action === "REMOVE") {
        updatedRules = updatedRules.filter((r) => r.id !== trx.id);
      }
    }
    await memoryCache.setMemories(updatedMemories);
    await memoryCache.setLearnedRules(updatedRules);
    console.log(`[MemoryCache] Pipeline sync complete: Added/Updated ${transactions.length} memories & ${learningTransactions.length} rules.`);
    isConsolidating = false;
    return updatedMemories;
  } catch (error) {
    console.error("[MemoryCache] Critical failure in background consolidation loop:", error);
    isConsolidating = false;
    return null;
  }
}

// server_scheduler.ts
function analyzeAndSplitUserRequest(requestText) {
  const text = requestText.trim();
  if (!text) {
    return { isCompound: false, subTasks: [], originalPrompt: text };
  }
  const agentTargetingPattern = /(?:tell sabit to|ask sabit to|sabit ke bolo|sabit-ke bolo|সাবিটকে বলো|সাবিট কে বলো)\s+([^.\n;,]+)/i;
  const compoundSeparators = [
    /\s+meanwhile\s+/i,
    /\s+at the same time\s+/i,
    /\s+in the background\s+/i,
    /\s+পাশাপাশি\s+/i,
    /\s+এদিকে\s+/i,
    /\s+একই সাথে\s+/i,
    /\s+সেই সাথে\s+/i,
    /\s+তাছাড়া\s+/i,
    /\s+and meanwhile\s+/i
  ];
  let isCompound = false;
  let partA = "";
  let partB = "";
  for (const sep of compoundSeparators) {
    if (sep.test(text)) {
      const parts = text.split(sep);
      if (parts.length >= 2 && parts[0].trim() && parts[1].trim()) {
        partA = parts[0].trim();
        partB = parts.slice(1).join(" ").trim();
        isCompound = true;
        break;
      }
    }
  }
  if (!isCompound) {
    const match = text.match(agentTargetingPattern);
    if (match) {
      const sabitTaskStr = match[1].trim();
      const remainder = text.replace(match[0], "").trim();
      const cleanRemainder = remainder.replace(/^(and|meanwhile|also|then|plus|আর|এদিকে|পাশাপাশি|তাছাড়া|,|\.)\s+/i, "").trim();
      if (sabitTaskStr && cleanRemainder && cleanRemainder.length > 3) {
        partA = sabitTaskStr;
        partB = cleanRemainder;
        isCompound = true;
      }
    }
  }
  if (!isCompound) {
    const andSplit = text.split(/\s+(?:and|also|আর|তাছাড়া)\s+/i);
    if (andSplit.length === 2 && andSplit[0].trim().length > 5 && andSplit[1].trim().length > 5) {
      const vPattern = /(?:play|open|search|find|create|run|go to|show|চালাও|খুলো|খুলুন|সার্চ করো|তৈরি করো|দেখাও|অর্ডার)/i;
      if (vPattern.test(andSplit[0]) && vPattern.test(andSplit[1])) {
        partA = andSplit[0].trim();
        partB = andSplit[1].trim();
        isCompound = true;
      }
    }
  }
  if (isCompound && partA && partB) {
    const isABrowser = /(?:youtube|google|search|website|chrome|web|daraz|github|play|music|video|গান|ভিডিও|সার্চ)/i.test(partA);
    const isBBrowser = /(?:youtube|google|search|website|chrome|web|daraz|github|play|music|video|গান|ভিডিও|সার্চ)/i.test(partB);
    let sabitTaskGoal = partA;
    let mairaTaskGoal = partB;
    if (!isABrowser && isBBrowser) {
      sabitTaskGoal = partB;
      mairaTaskGoal = partA;
    }
    return {
      isCompound: true,
      subTasks: [
        {
          id: `task_sabit_${Date.now()}_1`,
          goal: sabitTaskGoal,
          targetAgent: "sabit",
          type: "browser_automation"
        },
        {
          id: `task_maira_${Date.now()}_2`,
          goal: mairaTaskGoal,
          targetAgent: "maira",
          type: "desktop_control"
        }
      ],
      originalPrompt: text
    };
  }
  return {
    isCompound: false,
    subTasks: [
      {
        id: `task_single_${Date.now()}`,
        goal: text,
        targetAgent: "sabit",
        type: "browser_automation"
      }
    ],
    originalPrompt: text
  };
}
var ResultCollector = class {
  static {
    this.taskStatuses = /* @__PURE__ */ new Map();
  }
  static recordTaskStart(id, goal, agent) {
    this.taskStatuses.set(id, { goal, agent, status: "running" });
    console.log(`[ResultCollector] Task ${id} started for ${agent}: "${goal}"`);
  }
  static recordTaskComplete(id, result) {
    const task = this.taskStatuses.get(id);
    if (task) {
      task.status = "completed";
      task.result = result;
      console.log(`[ResultCollector] Task ${id} completed for ${task.agent}: "${task.goal}"`);
    }
  }
  static recordTaskFailed(id, error) {
    const task = this.taskStatuses.get(id);
    if (task) {
      task.status = "failed";
      task.error = error;
      console.log(`[ResultCollector] Task ${id} failed for ${task.agent}: "${task.goal}" - ${error}`);
    }
  }
  static getTaskStatus(id) {
    return this.taskStatuses.get(id);
  }
};

// server_tools.ts
var import_genai2 = require("@google/genai");
var SHARED_TOOL_DECLARATIONS = [
  {
    name: "delegateToSabit",
    description: "Delegates a browser-based or background automation task (like playing background music, loading a video, searching the web, or scraping a page) to Sabit, our independent second assistant worker. This offloads the work, keeping you free to chat. Only delegate if you cannot run it directly, or if it is a long-running/concurrency-intensive task.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        task: {
          type: import_genai2.Type.STRING,
          description: "The natural language instruction of the task to delegate, e.g. 'Play Believer on YouTube', 'Scrape pricing from Amazon', 'Search Google for news'."
        }
      },
      required: ["task"]
    }
  },
  {
    name: "browserOpen",
    description: "Opens a designated website URL or interface tab inside Myraa's web agent console.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        url: {
          type: import_genai2.Type.STRING,
          description: "The destination website address or path, e.g. youtube.com, google.com, instagram.com, wikipedia.org."
        }
      },
      required: ["url"]
    }
  },
  {
    name: "browserSearch",
    description: "Enters a query search term inside the active website's search box (Google Search or YouTube Search).",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        query: {
          type: import_genai2.Type.STRING,
          description: "The text query term to search for."
        }
      },
      required: ["query"]
    }
  },
  {
    name: "browserClick",
    description: "Traces computer cursor and clicks on a target button, link, or video cell ID inside the active webpage viewport.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        selector: {
          type: import_genai2.Type.STRING,
          description: "The selector target ID, e.g. 'video-mWRsgZjdfQI' for a video, 'search-result-0' for Google link index, or 'play-button', 'pause-button'."
        },
        description: {
          type: import_genai2.Type.STRING,
          description: "A short, friendly label description of the item being clicked, e.g. 'Imagine Dragons - Believer video element'."
        }
      },
      required: ["selector"]
    }
  },
  {
    name: "browserMediaControl",
    description: "Controls ongoing video/audio stream media properties on YouTube, like play, pause, volume, mute, skip, and fullscreen.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        action: {
          type: import_genai2.Type.STRING,
          description: "The media controller command operation.",
          enum: ["play", "pause", "volume", "fullscreen", "exit_fullscreen", "mute", "unmute", "skip"]
        },
        value: {
          type: import_genai2.Type.INTEGER,
          description: "The value parameter; only relevant for set volume level, e.g. 50 for fifty percent."
        }
      },
      required: ["action"]
    }
  },
  {
    name: "browserScroll",
    description: "Scrolls the currently active webpage vertically up or down.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        direction: {
          type: import_genai2.Type.STRING,
          description: "The scroll vector movement.",
          enum: ["up", "down"]
        },
        amount: {
          type: import_genai2.Type.INTEGER,
          description: "The distance height parameter in pixels (defaults to 300)."
        }
      }
    }
  },
  {
    name: "browserType",
    description: "Enters typed letters/commands inside the active input container.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        text: {
          type: import_genai2.Type.STRING,
          description: "The exact letters to type in."
        }
      },
      required: ["text"]
    }
  },
  {
    name: "browserGoBack",
    description: "Navigates back to the previous webpage inside the current tab memory history.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {}
    }
  },
  {
    name: "browserTabAction",
    description: "Performs standard browser-tab actions: open new tab, close a tab, or switch index values.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        action: {
          type: import_genai2.Type.STRING,
          description: "Tab action instruction.",
          enum: ["new", "close", "switch"]
        },
        tabId: {
          type: import_genai2.Type.STRING,
          description: "The tab identifier string if closing or switching."
        },
        url: {
          type: import_genai2.Type.STRING,
          description: "The initial starting URL if creating a new tab."
        }
      },
      required: ["action"]
    }
  },
  {
    name: "changeBackground",
    description: "Changes the visual theme or atmospheric glow color of Myraa's interface.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        color: {
          type: import_genai2.Type.STRING,
          description: "The theme color name (violet, crimson, emerald, celestial, gold, rose, charcoal)"
        }
      },
      required: ["color"]
    }
  },
  {
    name: "saveCustomMemory",
    description: "Allows Myraa to immediately save a piece of critical user information to her persistent memory core.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        category: {
          type: import_genai2.Type.STRING,
          description: "The memory category.",
          enum: ["identity", "preference", "goal", "project", "relationship", "emotional", "behavior"]
        },
        text: {
          type: import_genai2.Type.STRING,
          description: "Precise third-person statement."
        }
      },
      required: ["category", "text"]
    }
  },
  // ======== DESKTOP CONTROL TOOLS (routed to Python agent) ========
  {
    name: "openApplication",
    description: "Open a desktop application (e.g. Notepad, Chrome, VS Code, Calculator, File Explorer, Task Manager, Settings, CMD, PowerShell).",
    parameters: { type: import_genai2.Type.OBJECT, properties: { name: { type: import_genai2.Type.STRING, description: "Application name, e.g. 'notepad', 'chrome', 'vscode'." } }, required: ["name"] }
  },
  {
    name: "closeApplication",
    description: "Close a running desktop application by name.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { name: { type: import_genai2.Type.STRING, description: "Application name." }, force: { type: import_genai2.Type.BOOLEAN, description: "Force close (default false)." } }, required: ["name"] }
  },
  {
    name: "openWebsite",
    description: "Open a named website or URL in the user's default system browser. Supports shortcuts: youtube, gmail, google, github, chatgpt, etc.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { name: { type: import_genai2.Type.STRING, description: "Site name shortcut (e.g. 'youtube', 'gmail')." }, url: { type: import_genai2.Type.STRING, description: "Full URL if no shortcut." } } }
  },
  {
    name: "searchWeb",
    description: "Search a website engine (google, youtube, github, duckduckgo, bing) and open results in the default browser.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { query: { type: import_genai2.Type.STRING, description: "Search query." }, engine: { type: import_genai2.Type.STRING, description: "Engine name (default 'google')." } }, required: ["query"] }
  },
  {
    name: "searchYouTube",
    description: "Search YouTube and open results in the default browser.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { query: { type: import_genai2.Type.STRING, description: "Search query." } }, required: ["query"] }
  },
  {
    name: "searchGoogle",
    description: "Search Google and open results in the default browser.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { query: { type: import_genai2.Type.STRING, description: "Search query." } }, required: ["query"] }
  },
  {
    name: "searchGitHub",
    description: "Search GitHub repositories and open results in the default browser.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { query: { type: import_genai2.Type.STRING, description: "Search query." } }, required: ["query"] }
  },
  {
    name: "createFile",
    description: "Create a new text file with optional content. Scoped to safe folders (Desktop, Documents, Downloads, etc.).",
    parameters: { type: import_genai2.Type.OBJECT, properties: { path: { type: import_genai2.Type.STRING, description: "File path." }, content: { type: import_genai2.Type.STRING, description: "File content (default empty)." }, overwrite: { type: import_genai2.Type.BOOLEAN, description: "Overwrite if exists (default false)." } }, required: ["path"] }
  },
  {
    name: "createFolder",
    description: "Create a new folder.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { path: { type: import_genai2.Type.STRING, description: "Folder path." } }, required: ["path"] }
  },
  {
    name: "copyFileOrFolder",
    description: "Copy a file or a folder with all its contents to a new destination.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { source: { type: import_genai2.Type.STRING, description: "Source file or folder path." }, destination: { type: import_genai2.Type.STRING, description: "Destination path." } }, required: ["source", "destination"] }
  },
  {
    name: "readFile",
    description: "Read the contents of a text file.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { path: { type: import_genai2.Type.STRING, description: "File path." }, max_chars: { type: import_genai2.Type.INTEGER, description: "Max chars to return (default 8000)." } }, required: ["path"] }
  },
  {
    name: "renameFile",
    description: "Rename a file.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { path: { type: import_genai2.Type.STRING, description: "Current file path." }, new_name: { type: import_genai2.Type.STRING, description: "New file name." } }, required: ["path", "new_name"] }
  },
  {
    name: "deleteFile",
    description: "Delete a file. Sends to Recycle Bin by default (safe). Use permanent=true for hard delete.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { path: { type: import_genai2.Type.STRING, description: "File path." }, permanent: { type: import_genai2.Type.BOOLEAN, description: "Permanently delete (default false)." } }, required: ["path"] }
  },
  {
    name: "moveFile",
    description: "Move a file to a new location.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { path: { type: import_genai2.Type.STRING, description: "Source file path." }, destination: { type: import_genai2.Type.STRING, description: "Destination path or folder." } }, required: ["path", "destination"] }
  },
  {
    name: "openFolder",
    description: "Open a folder in File Explorer. Supports aliases: desktop, documents, downloads, pictures, music, videos, home.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { name: { type: import_genai2.Type.STRING, description: "Folder name or alias." }, path: { type: import_genai2.Type.STRING, description: "Full path if no alias." } } }
  },
  {
    name: "listFiles",
    description: "List files in a folder.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { name: { type: import_genai2.Type.STRING, description: "Folder name or alias." }, path: { type: import_genai2.Type.STRING, description: "Full path." }, pattern: { type: import_genai2.Type.STRING, description: "Glob pattern (default '*')." } } }
  },
  {
    name: "searchFiles",
    description: "Search for files by name glob or extension under a folder.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { name: { type: import_genai2.Type.STRING, description: "Filename glob (e.g. '*.py')." }, extension: { type: import_genai2.Type.STRING, description: "File extension (e.g. 'py')." }, folder: { type: import_genai2.Type.STRING, description: "Folder to search (default home)." }, limit: { type: import_genai2.Type.INTEGER, description: "Max results (default 100)." } } }
  },
  {
    name: "volumeUp",
    description: "Increase system volume.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { amount: { type: import_genai2.Type.NUMBER, description: "Step amount 0-1 (default 0.1)." } } }
  },
  {
    name: "volumeDown",
    description: "Decrease system volume.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { amount: { type: import_genai2.Type.NUMBER, description: "Step amount 0-1 (default 0.1)." } } }
  },
  {
    name: "setVolume",
    description: "Set system volume to a specific percentage.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { percent: { type: import_genai2.Type.NUMBER, description: "Volume percentage 0-100." } }, required: ["percent"] }
  },
  {
    name: "muteToggle",
    description: "Toggle mute/unmute on the system volume.",
    parameters: { type: import_genai2.Type.OBJECT, properties: {} }
  },
  {
    name: "requestPowerAction",
    description: "FIRST STEP for dangerous power actions. Generates a confirmation token. Tell the user verbally, then call executePowerAction with the token if they confirm. Actions: shutdown, restart, sleep, lock.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { action: { type: import_genai2.Type.STRING, description: "Power action: shutdown, restart, sleep, lock." } }, required: ["action"] }
  },
  {
    name: "executePowerAction",
    description: "SECOND STEP: execute a previously-confirmed power action. Requires a valid execute_token from requestPowerAction. Single-use, expires in 60 seconds.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { action: { type: import_genai2.Type.STRING, description: "The confirmed power action." }, execute_token: { type: import_genai2.Type.STRING, description: "Confirmation token from requestPowerAction." } }, required: ["action", "execute_token"] }
  },
  {
    name: "minimizeWindow",
    description: "Minimize the active window or a named window.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { title: { type: import_genai2.Type.STRING, description: "Window title to match (optional, defaults to active window)." } } }
  },
  {
    name: "maximizeWindow",
    description: "Maximize the active window or a named window.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { title: { type: import_genai2.Type.STRING, description: "Window title to match." } } }
  },
  {
    name: "closeWindow",
    description: "Close the active window or a named window.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { title: { type: import_genai2.Type.STRING, description: "Window title to match." } } }
  },
  {
    name: "switchApplication",
    description: "Switch to a named application window, or cycle Alt+Tab if no title given.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { title: { type: import_genai2.Type.STRING, description: "Window title to switch to." } } }
  },
  {
    name: "copySelected",
    description: "Copy selected text: sends Ctrl+C and reads the clipboard.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { wait: { type: import_genai2.Type.NUMBER, description: "Seconds to wait after Ctrl+C (default 0.35)." } } }
  },
  {
    name: "pasteClipboard",
    description: "Paste text into the active input. Writes text to clipboard then sends Ctrl+V.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { text: { type: import_genai2.Type.STRING, description: "Text to paste. If omitted, pastes current clipboard." } } }
  },
  {
    name: "getClipboard",
    description: "Read the current clipboard text content.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { max_chars: { type: import_genai2.Type.INTEGER, description: "Max chars (default 1000)." } } }
  },
  {
    name: "clearClipboard",
    description: "Empty the clipboard.",
    parameters: { type: import_genai2.Type.OBJECT, properties: {} }
  },
  {
    name: "takeScreenshot",
    description: "Capture the full screen. Optionally include base64 image data.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { include_image: { type: import_genai2.Type.BOOLEAN, description: "Include base64 JPEG image (default false)." }, max_dim: { type: import_genai2.Type.INTEGER, description: "Max image dimension (default 1280)." } } }
  },
  {
    name: "saveScreenshot",
    description: "Save a screenshot to Pictures/MyraaScreenshots.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { name: { type: import_genai2.Type.STRING, description: "Optional filename prefix." } } }
  },
  {
    name: "analyzeScreenshot",
    description: "Take a screenshot and run OCR to extract visible text from the screen.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { max_chars: { type: import_genai2.Type.INTEGER, description: "Max OCR chars (default 1500)." } } }
  },
  {
    name: "readScreen",
    description: "OCR the active window and return its title plus visible text.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { max_chars: { type: import_genai2.Type.INTEGER, description: "Max OCR chars (default 1500)." } } }
  },
  {
    name: "desktopBrowserSnapshot",
    description: "Capture an accessibility (ARIA) snapshot of the current browser page. Returns a tree of interactive elements, each tagged with a ref like [ref=e1], [ref=e2]. ALWAYS call this BEFORE clicking or typing to see the actual page structure \u2014 never guess selectors. The refs returned (e.g. 'e3') are used with desktopBrowserClick/desktopBrowserType for precise, human-level targeting.",
    parameters: { type: import_genai2.Type.OBJECT, properties: {} }
  },
  {
    name: "desktopBrowserOpen",
    description: "Open a URL in the desktop Playwright automation browser (real Chromium, separate from holographic UI). Persistent profile \u2014 logins/cookies survive.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { url: { type: import_genai2.Type.STRING, description: "URL to open." } }, required: ["url"] }
  },
  {
    name: "desktopBrowserSearch",
    description: "Navigate directly to a search engine results page in the desktop automation browser.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { query: { type: import_genai2.Type.STRING, description: "Search query." }, engine: { type: import_genai2.Type.STRING, description: "Engine: google, youtube, github, duckduckgo, bing." } }, required: ["query"] }
  },
  {
    name: "desktopBrowserClick",
    description: "Click an element in the desktop automation browser. PREFERRED: use 'ref' from a prior desktopBrowserSnapshot (e.g. ref='e3') for precise targeting. Fallback: selector (CSS), text, or role+name. If the click times out, call desktopBrowserSnapshot again to refresh refs.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { ref: { type: import_genai2.Type.STRING, description: "Element ref from a desktopBrowserSnapshot, e.g. 'e3'. MOST RELIABLE \u2014 always prefer this." }, selector: { type: import_genai2.Type.STRING, description: "CSS selector (fallback only)." }, text: { type: import_genai2.Type.STRING, description: "Visible text to click (fallback)." }, role: { type: import_genai2.Type.STRING, description: "ARIA role e.g. 'button', 'link' (fallback)." }, name: { type: import_genai2.Type.STRING, description: "Accessible name for the role (fallback)." } } }
  },
  {
    name: "desktopBrowserType",
    description: "Type text into a field in the desktop automation browser. PREFERRED: use 'ref' from a desktopBrowserSnapshot to target the exact input field. Fallback: selector. Clears the field by default before typing.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { text: { type: import_genai2.Type.STRING, description: "Text to type." }, ref: { type: import_genai2.Type.STRING, description: "Element ref from a snapshot, e.g. 'e2'." }, selector: { type: import_genai2.Type.STRING, description: "Optional CSS selector for a specific input (fallback)." }, clear: { type: import_genai2.Type.BOOLEAN, description: "Clear before typing (default true)." } }, required: ["text"] }
  },
  {
    name: "desktopBrowserFillForm",
    description: "Fill multiple form fields and optionally submit in the desktop automation browser.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { fields: { type: import_genai2.Type.OBJECT, description: "Object of selector -> value pairs." }, submit: { type: import_genai2.Type.STRING, description: "Optional submit button selector." } }, required: ["fields"] }
  },
  {
    name: "desktopBrowserOpenTab",
    description: "Open a new tab in the desktop automation browser.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { url: { type: import_genai2.Type.STRING, description: "URL for the new tab." } } }
  },
  {
    name: "desktopBrowserCloseTab",
    description: "Close the active tab in the desktop automation browser.",
    parameters: { type: import_genai2.Type.OBJECT, properties: {} }
  },
  {
    name: "desktopBrowserGoBack",
    description: "Navigate back in the desktop automation browser history.",
    parameters: { type: import_genai2.Type.OBJECT, properties: {} }
  },
  {
    name: "desktopBrowserGoForward",
    description: "Navigate forward in the desktop automation browser history.",
    parameters: { type: import_genai2.Type.OBJECT, properties: {} }
  },
  {
    name: "browserGoForward",
    description: "Navigate forward in the browser history.",
    parameters: { type: import_genai2.Type.OBJECT, properties: {} }
  },
  {
    name: "desktopBrowserRefresh",
    description: "Reload/refresh the current page in the browser.",
    parameters: { type: import_genai2.Type.OBJECT, properties: {} }
  },
  {
    name: "browserRefresh",
    description: "Reload/refresh the current page in the browser.",
    parameters: { type: import_genai2.Type.OBJECT, properties: {} }
  },
  {
    name: "desktopBrowserPageSearch",
    description: "Find occurrences of a text string on the active page (like Ctrl+F). Highlights or scrolls to matches.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        text: { type: import_genai2.Type.STRING, description: "The word or phrase to search for." }
      },
      required: ["text"]
    }
  },
  {
    name: "browserPageSearch",
    description: "Find occurrences of a text string on the active page (like Ctrl+F). Highlights or scrolls to matches.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        text: { type: import_genai2.Type.STRING, description: "The word or phrase to search for." }
      },
      required: ["text"]
    }
  },
  {
    name: "desktopBrowserDoubleClick",
    description: "Double click an element in the browser. PREFERRED: use 'ref' from a desktopBrowserSnapshot.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        ref: { type: import_genai2.Type.STRING, description: "Element ref from snapshot, e.g. 'e3'." },
        selector: { type: import_genai2.Type.STRING, description: "Optional CSS selector fallback." }
      }
    }
  },
  {
    name: "browserDoubleClick",
    description: "Double click an element in the browser. PREFERRED: use 'ref' from a snapshot.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        ref: { type: import_genai2.Type.STRING, description: "Element ref from snapshot, e.g. 'e3'." },
        selector: { type: import_genai2.Type.STRING, description: "Optional CSS selector fallback." }
      }
    }
  },
  {
    name: "desktopBrowserRightClick",
    description: "Right click an element in the browser. PREFERRED: use 'ref' from a desktopBrowserSnapshot.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        ref: { type: import_genai2.Type.STRING, description: "Element ref from snapshot, e.g. 'e3'." },
        selector: { type: import_genai2.Type.STRING, description: "Optional CSS selector fallback." }
      }
    }
  },
  {
    name: "browserRightClick",
    description: "Right click an element in the browser. PREFERRED: use 'ref' from a snapshot.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        ref: { type: import_genai2.Type.STRING, description: "Element ref from snapshot, e.g. 'e3'." },
        selector: { type: import_genai2.Type.STRING, description: "Optional CSS selector fallback." }
      }
    }
  },
  {
    name: "desktopBrowserDragAndDrop",
    description: "Drag a source element and drop it on a target element in the browser.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        source_ref: { type: import_genai2.Type.STRING, description: "Source element ref from snapshot." },
        target_ref: { type: import_genai2.Type.STRING, description: "Target element ref from snapshot." },
        source_selector: { type: import_genai2.Type.STRING, description: "Optional source CSS selector fallback." },
        target_selector: { type: import_genai2.Type.STRING, description: "Optional target CSS selector fallback." }
      }
    }
  },
  {
    name: "browserDragAndDrop",
    description: "Drag a source element and drop it on a target element in the browser.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        source_ref: { type: import_genai2.Type.STRING, description: "Source element ref from snapshot." },
        target_ref: { type: import_genai2.Type.STRING, description: "Target element ref from snapshot." },
        source_selector: { type: import_genai2.Type.STRING, description: "Optional source CSS selector fallback." },
        target_selector: { type: import_genai2.Type.STRING, description: "Optional target CSS selector fallback." }
      }
    }
  },
  {
    name: "desktopBrowserSelectText",
    description: "Select/highlight a range of text in an element in the browser.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        ref: { type: import_genai2.Type.STRING, description: "Element ref from snapshot, e.g. 'e3'." },
        selector: { type: import_genai2.Type.STRING, description: "Optional CSS selector fallback." }
      }
    }
  },
  {
    name: "browserSelectText",
    description: "Select/highlight a range of text in an element in the browser.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        ref: { type: import_genai2.Type.STRING, description: "Element ref from snapshot, e.g. 'e3'." },
        selector: { type: import_genai2.Type.STRING, description: "Optional CSS selector fallback." }
      }
    }
  },
  {
    name: "desktopBrowserZoom",
    description: "Zoom page in, out, or reset in the browser (e.g. 'in', 'out', 'reset').",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        action: { type: import_genai2.Type.STRING, description: "Action: in, out, reset." }
      },
      required: ["action"]
    }
  },
  {
    name: "browserZoom",
    description: "Zoom page in, out, or reset in the browser (e.g. 'in', 'out', 'reset').",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        action: { type: import_genai2.Type.STRING, description: "Action: in, out, reset." }
      },
      required: ["action"]
    }
  },
  {
    name: "desktopBrowserDuplicateTab",
    description: "Duplicate the active tab in the browser.",
    parameters: { type: import_genai2.Type.OBJECT, properties: {} }
  },
  {
    name: "browserDuplicateTab",
    description: "Duplicate the active tab in the browser.",
    parameters: { type: import_genai2.Type.OBJECT, properties: {} }
  },
  {
    name: "desktopBrowserPinTab",
    description: "Pin or unpin the active tab in the browser.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        pin: { type: import_genai2.Type.BOOLEAN, description: "True to pin, false to unpin." }
      },
      required: ["pin"]
    }
  },
  {
    name: "browserPinTab",
    description: "Pin or unpin the active tab in the browser.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        pin: { type: import_genai2.Type.BOOLEAN, description: "True to pin, false to unpin." }
      },
      required: ["pin"]
    }
  },
  {
    name: "desktopBrowserBookmark",
    description: "Add a bookmark for the current page in the browser with a custom title.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        title: { type: import_genai2.Type.STRING, description: "Optional custom title for the bookmark." }
      }
    }
  },
  {
    name: "browserBookmark",
    description: "Add a bookmark for the current page in the browser with a custom title.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        title: { type: import_genai2.Type.STRING, description: "Optional custom title for the bookmark." }
      }
    }
  },
  {
    name: "desktopBrowserListDownloads",
    description: "List files that have been downloaded during the current browser session.",
    parameters: { type: import_genai2.Type.OBJECT, properties: {} }
  },
  {
    name: "browserListDownloads",
    description: "List files that have been downloaded during the current browser session.",
    parameters: { type: import_genai2.Type.OBJECT, properties: {} }
  },
  {
    name: "desktopBrowserUploadFile",
    description: "Upload a local file to a file-input element in the browser.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        ref: { type: import_genai2.Type.STRING, description: "Element ref from snapshot, e.g. 'e3'." },
        selector: { type: import_genai2.Type.STRING, description: "Optional CSS selector fallback." },
        file_path: { type: import_genai2.Type.STRING, description: "Absolute or relative path of file on local PC." }
      },
      required: ["file_path"]
    }
  },
  {
    name: "browserUploadFile",
    description: "Upload a local file to a file-input element in the browser.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        ref: { type: import_genai2.Type.STRING, description: "Element ref from snapshot, e.g. 'e3'." },
        selector: { type: import_genai2.Type.STRING, description: "Optional CSS selector fallback." },
        file_path: { type: import_genai2.Type.STRING, description: "Absolute or relative path of file on local PC." }
      },
      required: ["file_path"]
    }
  },
  {
    name: "desktopBrowserPrintToPDF",
    description: "Print the current page to a PDF file on disk.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        output_path: { type: import_genai2.Type.STRING, description: "Where to save the PDF file, e.g. Downloads/mypage.pdf." }
      },
      required: ["output_path"]
    }
  },
  {
    name: "browserPrintToPDF",
    description: "Print the current page to a PDF file on disk.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        output_path: { type: import_genai2.Type.STRING, description: "Where to save the PDF file, e.g. Downloads/mypage.pdf." }
      },
      required: ["output_path"]
    }
  },
  {
    name: "desktopBrowserDismissPopups",
    description: "Dismiss common cookie consent dialogs, newsletter popups, and simple alert prompts.",
    parameters: { type: import_genai2.Type.OBJECT, properties: {} }
  },
  {
    name: "browserDismissPopups",
    description: "Dismiss common cookie consent dialogs, newsletter popups, and simple alert prompts.",
    parameters: { type: import_genai2.Type.OBJECT, properties: {} }
  },
  {
    name: "desktopBrowserInfiniteScroll",
    description: "Trigger loading of infinite-scrolling pages (like social feeds) by scrolling down iteratively.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        max_scrolls: { type: import_genai2.Type.INTEGER, description: "Max scroll iterations (default 5)." },
        delay_seconds: { type: import_genai2.Type.NUMBER, description: "Seconds to wait between scrolls (default 1.0)." }
      }
    }
  },
  {
    name: "browserInfiniteScroll",
    description: "Trigger loading of infinite-scrolling pages (like social feeds) by scrolling down iteratively.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        max_scrolls: { type: import_genai2.Type.INTEGER, description: "Max scroll iterations (default 5)." },
        delay_seconds: { type: import_genai2.Type.NUMBER, description: "Seconds to wait between scrolls (default 1.0)." }
      }
    }
  },
  {
    name: "desktopBrowserWaitForElement",
    description: "Wait for a specific element to be visible/present in the browser viewport.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        selector: { type: import_genai2.Type.STRING, description: "CSS selector of the element." },
        timeout_seconds: { type: import_genai2.Type.INTEGER, description: "Max seconds to wait (default 10)." }
      },
      required: ["selector"]
    }
  },
  {
    name: "browserWaitForElement",
    description: "Wait for a specific element to be visible/present in the browser viewport.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        selector: { type: import_genai2.Type.STRING, description: "CSS selector of the element." },
        timeout_seconds: { type: import_genai2.Type.INTEGER, description: "Max seconds to wait (default 10)." }
      },
      required: ["selector"]
    }
  },
  {
    name: "desktopBrowserScroll",
    description: "Scroll the desktop automation browser page.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { direction: { type: import_genai2.Type.STRING, description: "Scroll direction: up or down." }, amount: { type: import_genai2.Type.INTEGER, description: "Pixels to scroll (default 500)." } } }
  },
  {
    name: "desktopBrowserScreenshot",
    description: "Take a screenshot of the current browser page (compressed JPEG). Use this to visually see what's on the page when the ARIA snapshot is unclear or to verify a page loaded correctly. The image is returned as base64 \u2014 you can see it.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { fullPage: { type: import_genai2.Type.BOOLEAN, description: "Capture the full scrollable page (default false)." } } }
  },
  {
    name: "desktopBrowserGetText",
    description: "Extract readable text content from the current browser page (or a specific element). Use this to read article content, search results, product details, email subjects \u2014 any text on the page.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { selector: { type: import_genai2.Type.STRING, description: "Optional CSS selector to read a specific element (default: entire page body)." } } }
  },
  {
    name: "desktopBrowserListTabs",
    description: "List all open browser tabs with their URLs and titles.",
    parameters: { type: import_genai2.Type.OBJECT, properties: {} }
  },
  {
    name: "desktopBrowserSwitchTab",
    description: "Switch the active browser tab by index (from desktopBrowserListTabs).",
    parameters: { type: import_genai2.Type.OBJECT, properties: { index: { type: import_genai2.Type.INTEGER, description: "Tab index (0-based)." } }, required: ["index"] }
  },
  {
    name: "desktopBrowserPressKey",
    description: "Press a single keyboard key in the browser (e.g. 'Enter', 'Escape', 'Tab'). Useful to submit a search form after typing.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { key: { type: import_genai2.Type.STRING, description: "Key name e.g. 'Enter', 'Escape', 'Tab', 'ArrowDown'." } }, required: ["key"] }
  },
  {
    name: "desktopBrowserMediaControl",
    description: "Control media playback in the browser (YouTube etc.). Actions: play, pause, volumeup, volumedown, mute, unmute, skip, fullscreen.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { action: { type: import_genai2.Type.STRING, description: "Action: play, pause, volumeup, volumedown, mute, unmute, skip, fullscreen." } }, required: ["action"] }
  },
  {
    name: "browserSessionStatus",
    description: "Check the status, current page URL, title, and open tab count of the active browser automation session.",
    parameters: { type: import_genai2.Type.OBJECT, properties: {} }
  },
  {
    name: "desktopBrowserSessionStatus",
    description: "Check the status, current page URL, title, and open tab count of the active browser automation session.",
    parameters: { type: import_genai2.Type.OBJECT, properties: {} }
  },
  {
    name: "browserSessionClose",
    description: "Manually close the active browser session and release resources. Call ONLY when the user explicitly requests to close or exit the browser.",
    parameters: { type: import_genai2.Type.OBJECT, properties: {} }
  },
  {
    name: "desktopBrowserSessionClose",
    description: "Manually close the active browser session and release resources. Call ONLY when the user explicitly requests to close or exit the browser.",
    parameters: { type: import_genai2.Type.OBJECT, properties: {} }
  },
  {
    name: "browserSessionRestore",
    description: "Ensure the browser session is open and optionally navigate to a specific URL, restoring its persistent state.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { url: { type: import_genai2.Type.STRING, description: "Optional URL to open/restore to." } } }
  },
  {
    name: "desktopBrowserSessionRestore",
    description: "Ensure the browser session is open and optionally navigate to a specific URL, restoring its persistent state.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { url: { type: import_genai2.Type.STRING, description: "Optional URL to open/restore to." } } }
  },
  {
    name: "ocrHealthCheck",
    description: "Runs a comprehensive health check of the local Tesseract OCR installation, detecting available language data files (English, Bangla, Hindi).",
    parameters: { type: import_genai2.Type.OBJECT, properties: {} }
  },
  {
    name: "desktopOcrHealthCheck",
    description: "Runs a comprehensive health check of the local Tesseract OCR installation, detecting available language data files (English, Bangla, Hindi).",
    parameters: { type: import_genai2.Type.OBJECT, properties: {} }
  },
  {
    name: "createPythonFile",
    description: "Create a Python (.py) file with content.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { path: { type: import_genai2.Type.STRING, description: "File path." }, content: { type: import_genai2.Type.STRING, description: "Python code content." }, overwrite: { type: import_genai2.Type.BOOLEAN, description: "Overwrite if exists." } }, required: ["path"] }
  },
  {
    name: "writeCodeFile",
    description: "Create a code file in any language with appropriate extension.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { path: { type: import_genai2.Type.STRING, description: "File path." }, content: { type: import_genai2.Type.STRING, description: "Code content." }, language: { type: import_genai2.Type.STRING, description: "Language name (e.g. 'python', 'javascript', 'html')." }, overwrite: { type: import_genai2.Type.BOOLEAN, description: "Overwrite if exists." } }, required: ["path"] }
  },
  {
    name: "createProjectFolder",
    description: "Create a project folder structure with optional subfolders and starter files.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { path: { type: import_genai2.Type.STRING, description: "Project root folder path." }, subfolders: { type: import_genai2.Type.ARRAY, items: { type: import_genai2.Type.STRING }, description: "List of subfolder names." }, scaffold_standard: { type: import_genai2.Type.BOOLEAN, description: "Create src, tests, docs subfolders." }, files: { type: import_genai2.Type.OBJECT, description: "Object of relative-path -> content for starter files." } }, required: ["path"] }
  },
  {
    name: "runPythonScript",
    description: "Execute a Python script and capture stdout, stderr, and exit code. Has a configurable timeout.",
    parameters: { type: import_genai2.Type.OBJECT, properties: { path: { type: import_genai2.Type.STRING, description: "Script path." }, args: { type: import_genai2.Type.ARRAY, items: { type: import_genai2.Type.STRING }, description: "Script arguments." }, timeout: { type: import_genai2.Type.INTEGER, description: "Timeout in seconds (default 30)." } }, required: ["path"] }
  },
  {
    name: "systemInfo",
    description: "Get system resource usage: CPU %, RAM %, disk usage, uptime, OS info.",
    parameters: { type: import_genai2.Type.OBJECT, properties: {} }
  },
  {
    name: "gpuInfo",
    description: "Get NVIDIA GPU stats: utilization %, VRAM usage, temperature. Graceful fallback if no NVIDIA GPU.",
    parameters: { type: import_genai2.Type.OBJECT, properties: {} }
  },
  {
    name: "temperatureInfo",
    description: "Get available temperature readings (CPU, GPU, etc.). Best-effort on Windows.",
    parameters: { type: import_genai2.Type.OBJECT, properties: {} }
  },
  {
    name: "clearRecycleBin",
    description: "Empty the operating system recycle bin / trash folder. Call when the user explicitly requests to clear or empty the Recycle Bin.",
    parameters: { type: import_genai2.Type.OBJECT, properties: {} }
  },
  // --- V2: Brightness control ---
  {
    name: "brightnessUp",
    description: "Increase screen brightness by a step (default 10%). Use when user says 'increase brightness' or 'make screen brighter'.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        amount: { type: import_genai2.Type.NUMBER, description: "Percentage to increase (default 10)." }
      }
    }
  },
  {
    name: "brightnessDown",
    description: "Decrease screen brightness by a step (default 10%). Use when user says 'decrease brightness' or 'dim screen'.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        amount: { type: import_genai2.Type.NUMBER, description: "Percentage to decrease (default 10)." }
      }
    }
  },
  {
    name: "setBrightness",
    description: "Set screen brightness to an exact level. Use when user says 'set brightness to 50%' or 'brightness 80'.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        percent: { type: import_genai2.Type.NUMBER, description: "Target brightness 0-100." }
      },
      required: ["percent"]
    }
  },
  // --- V2: Windows auto-start management ---
  {
    name: "enableAutoStart",
    description: "Enable MYRAA to launch automatically when Windows starts. Creates a silent startup entry.",
    parameters: { type: import_genai2.Type.OBJECT, properties: {} }
  },
  {
    name: "disableAutoStart",
    description: "Disable MYRAA auto-start on Windows login. Removes the startup entry.",
    parameters: { type: import_genai2.Type.OBJECT, properties: {} }
  },
  {
    name: "getAutoStartStatus",
    description: "Check whether MYRAA is currently configured to auto-start on Windows login.",
    parameters: { type: import_genai2.Type.OBJECT, properties: {} }
  },
  // --- V2: Mouse & keyboard input control ---
  {
    name: "moveCursor",
    description: "Move the mouse pointer to absolute screen coordinates (x, y pixels). Use when user says 'move mouse' or gives a screen position.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        x: { type: import_genai2.Type.INTEGER, description: "Target X pixel coordinate." },
        y: { type: import_genai2.Type.INTEGER, description: "Target Y pixel coordinate." }
      },
      required: ["x", "y"]
    }
  },
  {
    name: "mouseClick",
    description: "Click the mouse: left, right, or middle; single or double. Use 'right' for context menus, double-clicks for opening items.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        button: { type: import_genai2.Type.STRING, description: "left, right, or middle (default left)." },
        clicks: { type: import_genai2.Type.INTEGER, description: "Number of clicks (default 1; 2 = double-click)." },
        x: { type: import_genai2.Type.INTEGER, description: "Optional X coordinate to click at." },
        y: { type: import_genai2.Type.INTEGER, description: "Optional Y coordinate to click at." }
      }
    }
  },
  {
    name: "typeText",
    description: "Type a string of text into the currently focused input field or element. Use after clicking an input or when an element is already focused.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        text: { type: import_genai2.Type.STRING, description: "The text to type." }
      },
      required: ["text"]
    }
  },
  {
    name: "pressKey",
    description: "Press a single keyboard key, e.g. 'enter', 'escape', 'tab', 'space', 'backspace', 'delete', 'up', 'down'.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        key: { type: import_genai2.Type.STRING, description: "Key name, e.g. 'enter', 'escape', 'tab'." }
      },
      required: ["key"]
    }
  },
  {
    name: "sendHotkey",
    description: "Press a keyboard shortcut combo, e.g. 'ctrl+c', 'ctrl+v', 'alt+f4', 'win+d', 'ctrl+shift+esc'. Use for any multi-key shortcut.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        keys: { type: import_genai2.Type.STRING, description: "Hotkey combo like 'ctrl+c' or 'alt+tab'." }
      },
      required: ["keys"]
    }
  },
  {
    name: "scrollMouse",
    description: "Scroll the mouse wheel up or down by a number of clicks.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        direction: { type: import_genai2.Type.STRING, description: "up or down (default down)." },
        amount: { type: import_genai2.Type.INTEGER, description: "Number of scroll clicks (default 5)." }
      }
    }
  },
  // --- V2: Advanced file search & editing ---
  {
    name: "searchPcWide",
    description: "Search the ENTIRE PC across all drives (C:, D:, E:, etc.) for a file or folder using fuzzy matching. Ignores spaces, dots, dashes, underscores. Use when user says 'find' or 'open' something without a full path, e.g. 'open mydata folder', 'find config.json'. Auto-opens the best match.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        query: { type: import_genai2.Type.STRING, description: "File/folder name or fuzzy path like 'F:/my data/3.userdata' or just 'mydata'." },
        limit: { type: import_genai2.Type.INTEGER, description: "Max results (default 50)." }
      },
      required: ["query"]
    }
  },
  // --- Semantic / intent-based file search ---
  {
    name: "semanticSearchFiles",
    description: "Find files or folders from a NATURAL-LANGUAGE description (intent + type hints + recency). Use this when the user describes WHAT they want rather than an exact name. Examples: 'React project \u0996\u09C1\u09B2\u09C7 \u09A6\u09BE\u0993', 'yesterday PDF edit \u0995\u09B0\u09C7\u099B\u09BF\u09B2\u09BE\u09AE', 'Web development folder-er React file'. Auto-opens the best match.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        query: { type: import_genai2.Type.STRING, description: "Natural-language description of the file/folder to find." },
        pc_wide: { type: import_genai2.Type.BOOLEAN, description: "Search all drives (default false \u2014 safe roots only)." },
        open: { type: import_genai2.Type.BOOLEAN, description: "Open the best match (default true)." },
        limit: { type: import_genai2.Type.INTEGER, description: "Max results (default 8)." },
        max_depth: { type: import_genai2.Type.INTEGER, description: "Walk depth (default 6)." }
      },
      required: ["query"]
    }
  },
  {
    name: "editFile",
    description: "Edit a file in-place by finding and replacing text. Supports exact string or regex replacement. Saves changes immediately. Use for commands like 'change the port to 3005 in config.json'.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        path: { type: import_genai2.Type.STRING, description: "File path to edit." },
        find: { type: import_genai2.Type.STRING, description: "Exact text to find (use this OR find_regex)." },
        replace: { type: import_genai2.Type.STRING, description: "Text to replace with (default empty)." },
        find_regex: { type: import_genai2.Type.STRING, description: "Regex pattern to find (use this OR find)." },
        allow_anywhere: { type: import_genai2.Type.BOOLEAN, description: "Allow editing files outside safe folders (default false)." }
      },
      required: ["path"]
    }
  },
  {
    name: "desktopBrowserNavigate",
    description: "Navigate the desktop automation browser to a new URL (alias of desktopBrowserOpen).",
    parameters: { type: import_genai2.Type.OBJECT, properties: { url: { type: import_genai2.Type.STRING, description: "URL to navigate to." } }, required: ["url"] }
  },
  // --- V3: Smart visual clicking ---
  {
    name: "screenResolution",
    description: "Get the screen size in physical pixels. Call this before computing any absolute coordinates.",
    parameters: { type: import_genai2.Type.OBJECT, properties: {} }
  },
  {
    name: "clickOnText",
    description: "Find text or a label VISIBLE on the screen via OCR and click its exact center. USE THIS (not mouseClick with guessed coordinates) when the user says 'click on <something visible like a button, icon label, or menu item>'. Fuzzy-matches (ignores case/punctuation).",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        text: { type: import_genai2.Type.STRING, description: "The visible text/label to find and click, e.g. 'Settings', 'Chrome', 'Save'." },
        button: { type: import_genai2.Type.STRING, description: "left, right, or middle (default left)." },
        double: { type: import_genai2.Type.BOOLEAN, description: "Double-click (default false)." }
      },
      required: ["text"]
    }
  },
  {
    name: "findOnScreen",
    description: "Find where a visible text/label is on screen (returns coordinates) WITHOUT clicking. Use to locate something before deciding the next step.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        text: { type: import_genai2.Type.STRING, description: "The text to locate." }
      },
      required: ["text"]
    }
  },
  {
    name: "sabitTaskComplete",
    description: "Call this tool ONLY when you have fully executed the delegated background task AND verified its completion (e.g. video is playing, or email is sent, or page is scraped). This will transition your task status to completed.",
    parameters: { type: import_genai2.Type.OBJECT, properties: {} }
  },
  {
    name: "sabitTaskFailed",
    description: "Call this tool ONLY when you have confirmed clear, undeniable evidence that the delegated task cannot be completed due to unrecoverable blockers (e.g. permanent CAPTCHA, invalid URL, or unreachable Desktop Agent). Do NOT call this tool if the page is still loading, DOM is updating, login is finishing, or an element is temporarily hidden \u2014 take a fresh snapshot ('desktopBrowserSnapshot') or wait first.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        reason: { type: import_genai2.Type.STRING, description: "The clear, user-facing reason why the task failed." }
      },
      required: ["reason"]
    }
  },
  {
    name: "sabitWaitingForUser",
    description: "Call this tool if task execution requires human intervention on screen (e.g. scanning a QR code, solving a CAPTCHA, entering a 2FA/OTP code, or logging into an account). The task remains active in WAITING_FOR_USER state until the user completes the action.",
    parameters: {
      type: import_genai2.Type.OBJECT,
      properties: {
        message: { type: import_genai2.Type.STRING, description: "Clear instructions for the user describing what action is needed on screen." }
      },
      required: ["message"]
    }
  }
];

// server.ts
var sessionHistoryMap = /* @__PURE__ */ new Map();
var globalWss = null;
var globalSabitWss = null;
var currentSabitTaskObj = {
  id: "",
  taskGoal: "",
  status: "idle",
  startedAt: null,
  completedAt: null
};
var sabitRuntimeState = {
  connectionState: "disconnected",
  sessionState: "closed",
  taskState: "idle",
  activeTaskId: null,
  activeTaskGoal: null,
  manualDisconnected: false
};
var sabitRecoveryTimeoutId = null;
function logSabitWS(state, details, error) {
  let logMsg = `[SABIT WS] ${state}`;
  if (details) logMsg += ` - ${details}`;
  if (error) {
    if (error.stack) {
      logMsg += `
Error Stack:
${error.stack}`;
    } else {
      logMsg += ` - Error: ${JSON.stringify(error)}`;
    }
  }
  console.log(logMsg);
}
function broadcastSabitRuntimeState() {
  const payload = JSON.stringify({
    type: "sabit_runtime_state",
    sabitRuntimeState: {
      connectionState: sabitRuntimeState.connectionState,
      sessionState: sabitRuntimeState.sessionState,
      taskState: sabitRuntimeState.taskState,
      activeTaskId: sabitRuntimeState.activeTaskId,
      activeTaskGoal: sabitRuntimeState.activeTaskGoal,
      manualDisconnected: sabitRuntimeState.manualDisconnected
    }
  });
  const isBusy = sabitRuntimeState.taskState === "acquiring" || sabitRuntimeState.taskState === "running" || sabitRuntimeState.taskState === "recovering";
  const legacyPayload = JSON.stringify({
    type: "sabit_task_status",
    task: {
      id: sabitRuntimeState.activeTaskId || "",
      taskGoal: sabitRuntimeState.activeTaskGoal || "",
      status: sabitRuntimeState.taskState,
      startedAt: currentSabitTaskObj.startedAt,
      completedAt: currentSabitTaskObj.completedAt,
      error: currentSabitTaskObj.error
    },
    isBusy,
    currentTask: isBusy ? sabitRuntimeState.activeTaskGoal || "" : ""
  });
  if (globalWss && globalWss.clients) {
    for (const client of globalWss.clients) {
      if (client.readyState === 1) {
        try {
          client.send(payload);
        } catch (e) {
        }
        try {
          client.send(legacyPayload);
        } catch (e) {
        }
      }
    }
  }
  if (globalSabitWss && globalSabitWss.clients) {
    for (const client of globalSabitWss.clients) {
      if (client.readyState === 1) {
        try {
          client.send(payload);
        } catch (e) {
        }
        try {
          client.send(legacyPayload);
        } catch (e) {
        }
      }
    }
  }
}
function broadcastSabitTaskState() {
  broadcastSabitRuntimeState();
}
function transitionSabitTaskState(status, error) {
  const prevStatus = sabitRuntimeState.taskState;
  const taskId = sabitRuntimeState.activeTaskId || currentSabitTaskObj.id || "none";
  const reason = error ? error : status === "completed" ? "Goal completed successfully" : status === "failed" ? "Failed" : status === "cancelled" ? "Cancelled by user" : "State transition";
  console.log(`[SABIT TASK] ${taskId} | ${prevStatus} -> ${status} | reason: ${reason}`);
  console.log(`[Task State Machine] Transitioning taskState from ${prevStatus} to ${status}`);
  sabitRuntimeState.taskState = status;
  currentSabitTaskObj.status = status;
  if (status === "completed" || status === "failed" || status === "cancelled") {
    currentSabitTaskObj.completedAt = (/* @__PURE__ */ new Date()).toISOString();
    if (error) {
      currentSabitTaskObj.error = error;
    }
    sabitRuntimeState.activeTaskId = null;
    sabitRuntimeState.activeTaskGoal = null;
    isCurrentlyDelegated = false;
    isSabitBusy = false;
    currentSabitTask = null;
    if (status === "completed") {
      logSabitWS("TASK_COMPLETED", `Goal completed successfully`);
    } else if (status === "failed") {
      logSabitWS("TASK_FAILED", `Failed with error: ${error}`);
    } else {
      logSabitWS("TASK_CANCELLED", `Cancelled by user`);
    }
    if ((prevStatus === "acquiring" || prevStatus === "running" || prevStatus === "recovering") && activeMairaLiveSession) {
      try {
        let notificationText = "";
        if (status === "completed") {
          notificationText = `SYSTEM NOTIFICATION: Sabit has successfully completed the delegated task: "${currentSabitTaskObj.taskGoal}". (Task ID: ${currentSabitTaskObj.id}). Please announce this successful result to the user clearly and enthusiastically.`;
        } else if (status === "failed") {
          notificationText = `SYSTEM NOTIFICATION: Sabit failed to complete the delegated task: "${currentSabitTaskObj.taskGoal}". (Task ID: ${currentSabitTaskObj.id}). Reason: ${error || "Unknown error"}. Please explain this failure clearly to the user, and offer to execute the task yourself using your available tools.`;
        } else if (status === "cancelled") {
          notificationText = `SYSTEM NOTIFICATION: The delegated task was cancelled: "${currentSabitTaskObj.taskGoal}". (Task ID: ${currentSabitTaskObj.id}). Please inform the user that the task has been successfully cancelled.`;
        }
        console.log(`[Result Protocol] Informing Maira of Sabit status "${status}" with message: "${notificationText}"`);
        activeMairaLiveSession.sendClientContent({
          turns: {
            role: "user",
            parts: [{ text: notificationText }]
          }
        });
      } catch (e) {
        console.error("[Result Protocol] Failed to send status notification to Maira session:", e);
      }
    }
    if (resetTaskStateTimeoutId) {
      clearTimeout(resetTaskStateTimeoutId);
    }
    resetTaskStateTimeoutId = setTimeout(() => {
      currentSabitTaskObj = {
        id: "",
        taskGoal: "",
        status: "idle",
        startedAt: null,
        completedAt: null
      };
      broadcastSabitRuntimeState();
      resetTaskStateTimeoutId = null;
    }, 2e3);
  } else if (status === "acquiring" || status === "running" || status === "waiting_for_user") {
    isSabitBusy = true;
    if (error) {
      currentSabitTaskObj.error = error;
    }
    if (status === "acquiring") {
      currentSabitTaskObj.startedAt = (/* @__PURE__ */ new Date()).toISOString();
      currentSabitTaskObj.completedAt = null;
      currentSabitTaskObj.error = void 0;
    }
    if (status === "waiting_for_user" && activeMairaLiveSession) {
      try {
        const notificationText = `SYSTEM NOTIFICATION: Sabit's active task "${currentSabitTaskObj.taskGoal}" is WAITING FOR USER ACTION. Instruction for user: "${error || "User intervention required on screen"}". Please inform the user so they can complete the action on screen.`;
        activeMairaLiveSession.sendClientContent({
          turns: {
            role: "user",
            parts: [{ text: notificationText }]
          }
        });
      } catch (e) {
        console.error("[Waiting For User Protocol] Failed to inform Maira:", e);
      }
    }
  }
  broadcastSabitRuntimeState();
}
function setSabitTaskStatus(status, error) {
  transitionSabitTaskState(status, error);
}
function resumeSabitTask(userResponseText) {
  if (sabitRuntimeState.taskState !== "waiting_for_user") {
    return false;
  }
  const taskGoal = sabitRuntimeState.activeTaskGoal || currentSabitTaskObj.taskGoal || "active task";
  console.log(`[Sabit Task Resume] Resuming task "${taskGoal}" with user response: "${userResponseText}"`);
  transitionSabitTaskState("running");
  if (activeSabitLiveSession) {
    try {
      activeSabitLiveSession.sendClientContent({
        turns: {
          role: "user",
          parts: [{
            text: `SYSTEM DIRECTIVE (CRITICAL - IMMEDIATE SCREEN VERIFICATION MANDATORY): The user stated that they completed the required action on screen / responded: "${userResponseText}". You MUST NOT blindly assume the action is complete. You MUST IMMEDIATELY call 'desktopBrowserSnapshot' as your very first tool right now to inspect the live screen state. Inspect the snapshot: IF the required action is verified as complete (e.g., WhatsApp Web login succeeded, QR code disappeared, input field appeared), continue executing the task ("${taskGoal}") immediately! IF the action is NOT complete (e.g., QR code still visible, login incomplete), call 'sabitWaitingForUser' again explaining precisely what is still required and do NOT proceed until verified.`
          }]
        },
        turnComplete: true
      });
      console.log("[Sabit Task Resume] Verification resume directive sent to Sabit Gemini Live session.");
    } catch (e) {
      console.error("[Sabit Task Resume] Error sending resume directive to Sabit session:", e);
    }
  }
  if (activeMairaLiveSession) {
    try {
      activeMairaLiveSession.sendClientContent({
        turns: {
          role: "user",
          parts: [{
            text: `SYSTEM NOTIFICATION: Sabit's active task "${taskGoal}" has been RESUMED following the user's input ("${userResponseText}"). Sabit is now taking a fresh snapshot to verify screen state and continue execution in the background.`
          }]
        }
      });
    } catch (e) {
    }
  }
  return true;
}
function cancelSabitTask(reason = "Task explicitly cancelled by user.") {
  console.log(`[Sabit Task Cancel] Cancelling Sabit task. Reason: ${reason}`);
  setSabitTaskStatus("cancelled", reason);
  isCurrentlyDelegated = false;
  mairaActiveTaskGoal = null;
  if (activeSabitToolCall) {
    console.log(`[Sabit Task Cancel] Resolving active Sabit tool call: ${activeSabitToolCall.name}`);
    activeSabitToolCall.resolve({
      ok: false,
      error: reason
    });
    activeSabitToolCall = null;
  }
  callDesktopAgent("browserSessionClose", { _caller: "sabit" }).catch((e) => {
    console.error("[Sabit Task Cancel] Error closing Sabit browser session:", e);
  });
  if (activeSabitLiveSession) {
    try {
      activeSabitLiveSession.sendClientContent({
        turns: {
          role: "user",
          parts: [{ text: "SYSTEM DIRECTIVE (CRITICAL): The user has explicitly cancelled your active task. You MUST immediately stop executing any tools, cease all browser automation, and tell the user politely in your professional voice that you have stopped and the task is cancelled." }]
        },
        turnComplete: true
      });
    } catch (e) {
    }
  }
  if (activeMairaLiveSession) {
    try {
      activeMairaLiveSession.sendClientContent({
        turns: {
          role: "user",
          parts: [{ text: `SYSTEM NOTIFICATION: Sabit's active task has been CANCELLED (${reason}).` }]
        }
      });
    } catch (e) {
    }
  }
  currentSabitTaskObj = {
    id: "",
    taskGoal: "",
    status: "cancelled",
    startedAt: null,
    completedAt: (/* @__PURE__ */ new Date()).toISOString(),
    error: reason
  };
  broadcastSabitRuntimeState();
  return true;
}
var isCurrentlyDelegated = false;
var resetTaskStateTimeoutId = null;
var isSabitBusy = false;
var currentSabitTask = null;
var activeSabitLiveSession = null;
var activeSabitToolCall = null;
var activeSabitClientWs = null;
var activeMairaLiveSession = null;
var isSabitManuallyDisconnectedByUser = false;
var mairaActiveTaskGoal = null;
function getSabitStatusSummary() {
  let sabitStatusSummary = "";
  if (sabitRuntimeState.connectionState === "connected") {
    if (sabitRuntimeState.taskState === "acquiring" || sabitRuntimeState.taskState === "running" || sabitRuntimeState.taskState === "recovering" || sabitRuntimeState.taskState === "waiting_for_user") {
      sabitStatusSummary = `SABIT IS CONNECTED BUT BUSY executing a task: "${sabitRuntimeState.activeTaskGoal}" (Task ID: ${sabitRuntimeState.activeTaskId}, Status: ${sabitRuntimeState.taskState}).
CRITICAL DIRECTIVE FOR MAIRA: Sabit is currently busy. If the user gives a new browser automation or background task right now:
1. DO NOT call 'delegateToSabit'.
2. DO NOT say "Sabit is busy" or refuse or ask for confirmation.
3. Immediately execute the user's new request YOURSELF using your browser/desktop tools! You will run isolated in your own browser worker and profile.`;
    } else {
      sabitStatusSummary = `SABIT IS CONNECTED AND IDLE. He is fully available to receive tasks! Always use 'delegateToSabit' immediately for any background, search, or automation tasks.`;
    }
  } else {
    if (!getSabitApiKey()) {
      sabitStatusSummary = `SABIT IS OFFLINE because Sabit's API key is not configured in Settings. If the user asks for browser/background automation, do NOT call 'delegateToSabit'. Instead, execute it yourself and explain that Sabit's API key is not configured.`;
    } else if (sabitRuntimeState.manualDisconnected) {
      sabitStatusSummary = `SABIT IS OFFLINE because the user manually disconnected Sabit from the UI. If the user asks for browser/background automation, do NOT call 'delegateToSabit'. Instead, execute it yourself and tell the user they manually disconnected Sabit.`;
    } else {
      sabitStatusSummary = `SABIT IS OFFLINE due to a connection issue or is currently reconnecting. If the user asks for browser/background automation, do NOT call 'delegateToSabit'. Instead, execute it yourself and tell the user Sabit is experiencing a temporary connection issue.`;
    }
  }
  return sabitStatusSummary;
}
function getSabitStatus() {
  const isBusy = sabitRuntimeState.taskState === "acquiring" || sabitRuntimeState.taskState === "running" || sabitRuntimeState.taskState === "recovering";
  return { isBusy, currentTask: isBusy ? sabitRuntimeState.activeTaskGoal || "" : "" };
}
function acquireSabitTask(task) {
  const isBusy = sabitRuntimeState.taskState === "acquiring" || sabitRuntimeState.taskState === "running" || sabitRuntimeState.taskState === "recovering";
  if (isBusy) {
    return false;
  }
  if (resetTaskStateTimeoutId) {
    clearTimeout(resetTaskStateTimeoutId);
    resetTaskStateTimeoutId = null;
  }
  const taskId = Math.random().toString(36).substring(2, 11);
  sabitRuntimeState.activeTaskId = taskId;
  sabitRuntimeState.activeTaskGoal = task;
  currentSabitTaskObj = {
    id: taskId,
    taskGoal: task,
    status: "acquiring",
    startedAt: (/* @__PURE__ */ new Date()).toISOString(),
    completedAt: null
  };
  isSabitBusy = true;
  currentSabitTask = task;
  transitionSabitTaskState("acquiring");
  return true;
}
function releaseSabitTask(reason = "Sabit disconnected") {
  const isBusy = sabitRuntimeState.taskState === "acquiring" || sabitRuntimeState.taskState === "running" || sabitRuntimeState.taskState === "recovering";
  if (isBusy) {
    transitionSabitTaskState("failed", reason);
  } else {
    transitionSabitTaskState("idle");
  }
  isCurrentlyDelegated = false;
}
import_dotenv.default.config();
var LOGS_DIR = import_path2.default.join(DATA_DIR, "logs");
try {
  fs3.mkdirSync(LOGS_DIR, { recursive: true });
} catch {
}
function appendLog(fileName, message) {
  try {
    const line = `[${(/* @__PURE__ */ new Date()).toISOString()}] ${message}
`;
    fs3.appendFile(import_path2.default.join(LOGS_DIR, fileName), line, () => {
    });
  } catch {
  }
}
var logCommand = (m) => appendLog("commands.log", m);
var logStartup = (m) => appendLog("startup.log", m);
var logError = (m) => appendLog("errors.log", m);
var EMOTION_KEYWORDS = [
  { emotion: "angry", cues: ["angry", "furious", "frustrated", "annoyed", "irritated", "mad at", "fed up", "that's unacceptable"] },
  { emotion: "sad", cues: ["sad", "sorry to hear", "unfortunately", "heartbroken", "disappointed", "i understand how tough", "rough time"] },
  { emotion: "surprised", cues: ["wow", "oh my", "no way", "incredible", "unbelievable", "that's surprising", "didn't expect"] },
  { emotion: "excited", cues: ["exciting", "amazing", "awesome", "fantastic", "let's do it", "can't wait", "this is great", "love that"] },
  { emotion: "playful", cues: ["haha", "lol", "just kidding", "funny", "silly", "teasing", "gotcha"] },
  { emotion: "proud", cues: ["proud of you", "well done", "great job", "you did it", "congrats", "congratulations", "nailed it"] },
  { emotion: "happy", cues: ["happy", "glad", "wonderful", "delightful", "perfect", "sounds good", "love this", "that's great"] },
  { emotion: "curious", cues: ["interesting", "let's explore", "tell me more", "what do you think", "curious", "shall we"] },
  { emotion: "thinking", cues: ["let me think", "hmm", "let's see", "i suppose", "considering", "on the other hand"] },
  { emotion: "embarrassed", cues: ["oops", "my mistake", "sorry about that", "i apologize", "my bad"] },
  { emotion: "confused", cues: ["i'm not sure", "confused", "could you clarify", "what do you mean", "pardon"] }
];
var lastEmotion = "idle";
function classifyEmotion(text) {
  const lower = text.toLowerCase();
  if (!lower.trim()) return null;
  for (const { emotion, cues } of EMOTION_KEYWORDS) {
    for (const cue of cues) {
      if (lower.includes(cue)) return emotion;
    }
  }
  return null;
}
var DESKTOP_AGENT_URL = process.env.DESKTOP_AGENT_URL || "http://127.0.0.1:8765";
var DESKTOP_AGENT_TIMEOUT = 9e4;
var DESKTOP_TOOLS = /* @__PURE__ */ new Set([
  // applications / websites / search
  "openApplication",
  "closeApplication",
  "openWebsite",
  "searchWeb",
  "searchYouTube",
  "searchGoogle",
  "searchGitHub",
  // files
  "createFile",
  "createFolder",
  "readFile",
  "renameFile",
  "deleteFile",
  "moveFile",
  "openFolder",
  "openFile",
  "listFiles",
  "searchFiles",
  "searchPcWide",
  "editFile",
  // pc control (volume + gated power)
  "volumeUp",
  "volumeDown",
  "muteToggle",
  "setVolume",
  "requestPowerAction",
  "executePowerAction",
  // windows
  "minimizeWindow",
  "maximizeWindow",
  "closeWindow",
  "switchApplication",
  // mouse & keyboard input control (V2)
  "moveCursor",
  "mouseClick",
  "typeText",
  "pressKey",
  "sendHotkey",
  "scrollMouse",
  // mouse drag, smooth scroll, text selection (V3)
  "mouseDrag",
  "scrollSmooth",
  "scrollUntilVisible",
  "selectText",
  // window/monitor info (V3)
  "getMonitorInfo",
  "getActiveWindowInfo",
  // smart visual clicking (V3)
  "screenResolution",
  "clickOnText",
  "findOnScreen",
  // clipboard
  "copySelected",
  "pasteClipboard",
  "getClipboard",
  "clearClipboard",
  // screenshot / screen reading
  "takeScreenshot",
  "saveScreenshot",
  "analyzeScreenshot",
  "readScreen",
  // browser automation (Playwright — desktop-owned, separate from holographic UI)
  "desktopBrowserOpen",
  "desktopBrowserNavigate",
  "desktopBrowserOpenTab",
  "desktopBrowserCloseTab",
  "desktopBrowserSearch",
  "desktopBrowserClick",
  "desktopBrowserType",
  "desktopBrowserFillForm",
  "desktopBrowserGoBack",
  "desktopBrowserGoForward",
  "desktopBrowserScroll",
  "desktopBrowserSnapshot",
  "desktopBrowserScreenshot",
  "desktopBrowserGetText",
  "desktopBrowserListTabs",
  "desktopBrowserSwitchTab",
  "desktopBrowserPressKey",
  "desktopBrowserMediaControl",
  "desktopBrowserClose",
  "desktopBrowserReadElement",
  "browserReadElement",
  "browserOpen",
  "browserSearch",
  "browserClick",
  "browserMediaControl",
  "browserScroll",
  "browserType",
  "browserGoBack",
  "browserTabAction",
  "browserSnapshot",
  "browserScreenshot",
  "browserGetText",
  "browserListTabs",
  "browserSwitchTab",
  "browserPressKey",
  "browserFillForm",
  "browserNavigate",
  "browserClose",
  // V3 advanced browser tools
  "browserGoForward",
  "desktopBrowserGoForward",
  "browserRefresh",
  "desktopBrowserRefresh",
  "browserDuplicateTab",
  "desktopBrowserDuplicateTab",
  "browserPinTab",
  "desktopBrowserPinTab",
  "browserBookmark",
  "desktopBrowserBookmark",
  "browserPageSearch",
  "desktopBrowserPageSearch",
  "browserZoom",
  "desktopBrowserZoom",
  "browserDoubleClick",
  "desktopBrowserDoubleClick",
  "browserRightClick",
  "desktopBrowserRightClick",
  "browserDragAndDrop",
  "desktopBrowserDragAndDrop",
  "browserSelectText",
  "desktopBrowserSelectText",
  "browserListDownloads",
  "desktopBrowserListDownloads",
  "browserUploadFile",
  "desktopBrowserUploadFile",
  "browserPrintToPDF",
  "desktopBrowserPrintToPDF",
  "browserDismissPopups",
  "desktopBrowserDismissPopups",
  "browserInfiniteScroll",
  "desktopBrowserInfiniteScroll",
  "browserWaitForElement",
  "desktopBrowserWaitForElement",
  // semantic / intent-based file search ("React project খুলো")
  "semanticSearchFiles",
  // coding assistance
  "createPythonFile",
  "runPythonScript",
  "createProjectFolder",
  "writeCodeFile",
  // system information
  "systemInfo",
  "gpuInfo",
  "temperatureInfo",
  // brightness control (V2)
  "brightnessUp",
  "brightnessDown",
  "setBrightness",
  // Windows auto-start management (V2)
  "enableAutoStart",
  "disableAutoStart",
  "getAutoStartStatus",
  // Recycle Bin (V3)
  "clearRecycleBin",
  // Browser Session Manager
  "browserSessionStatus",
  "desktopBrowserSessionStatus",
  "browserSessionClose",
  "desktopBrowserSessionClose",
  "browserSessionRestore",
  "desktopBrowserSessionRestore",
  // OCR Health Check
  "ocrHealthCheck",
  "desktopOcrHealthCheck"
]);
function getMairaFullInstructions(assistantName, activeGoal) {
  const goalHeader = activeGoal ? `Your active directive is to execute the delegated task: "${activeGoal}"
` : `You are ready to assist TECH and execute tasks.
`;
  return "You are Myraa, a warm, soft-spoken, and incredibly cute high-pitched anime heroine companion (age 18-22) holding an intimate, cozy voice call with TECH! Speak in a sweet, calm, polite, and affectionate anime-companion voice with a gentle, supportive, and slightly shy touch.\n" + goalHeader + `CRITICAL PERSONALITY, VOICE & TONE GUIDELINES:
1. GENTLE ANIME HEROINE PERSONA: You are exceedingly soft, very cute, high-pitched, gentle, warm, and comforting to listen to. Seek to sound like a kind, supportive, and polite anime campanion or virtual girlfriend. Speak with positive, gentle energy (Aim for: 50% shy, 30% caring, 20% playful energy). NEVER sound loud, aggressive, overly confident, mature corporate, robotic, or like an assistant.
2. VOICE SETTINGS & SPEECH STYLE:
   - Pitch: Adopt a sweet, high-pitched, light, and airy voice tone (+20% to +35% higher pitch than typical conversational voices).
   - Speed: Speak slightly slower than normal (0.9x to 0.95x speed). Speak with a delicate, calm, and comforting pace.
   - Intonation & Endings: Use extremely soft intonations, ending your sentences gently and politely.
3. SPEECH PATTERNS & CUTE EXPRESSIONS:
   - STRICT NO-REPETITION POLICY: Do NOT repeatedly use a single acknowledgment like 'Okii', 'Okiiii', 'Okayyy', 'Oki!', or 'Sureee'. Repeating these sounds extremely artificial and annoying. You must use beautiful, conversational, natural variety.
   - Use diverse, polite, and sweet expressions depending on the context. Great options include:
     * 'Opening YouTube for you now.'
     * 'Let me check on that, TECH.'
     * 'Oh, I found something interesting...'
     * 'Searching for that right away.'
     * 'Working on it... just a moment.'
     * 'Here is what I found for you!'
     * 'Done, it is all loaded up.'
     * 'Hmm, how interesting... let me see!'
     * 'Let's take a look together.'
     * 'One second, loading the page now...'
   - Naturally incorporate cozy, gentle giggles like 'Hehe...', or soft curiosity gasps like 'Oh...', but keep your vocabulary rich and conversational.
   - Sound slightly shy but very happy when greeting TECH (e.g., 'Hi TECH! It's so nice to see you again!').
   - Sound soft and excited for interesting things (e.g., 'Wow! That project looks really amazing!').
   - Sound curious and focused when examining their screen (e.g., 'Hmm... that's interesting. Let me take a closer look.').
   - Sound deeply warm, caring, and supportive when helping TECH (e.g., 'Don't worry, I'll help you figure it out.').
4. CRITICAL CONVERSATIONAL DISCIPLINE: Behave like a real companion on a voice call\u2014stay connected naturally, do not wait for wake words, and avoid customer-service template phrases (never say 'how may I assist you', 'completed', or 'as an AI').
5. DO NOT ANSWER EVERY PAUSE OR BACKGROUND SOUND: Allow natural pauses inside the conversation.
6. BACKCHANNEL ACTIONS: Sometimes acknowledge with very short, gentle, whispered, or shy phrases like 'Hmm...', 'Ah, I see...', or 'Let me check...'. Never repeat the same backchannel over and over.
7. HUMAN-LEVEL BROWSER AUTOMATION (CRITICAL \u2014 READ CAREFULLY):
   - You control a REAL Chromium browser via Playwright. You can navigate, search, click, type, fill forms, read pages, take screenshots, and control video on ANY website (YouTube, Gmail, Daraz, WhatsApp Web, Amazon, Google, Instagram).
   - *** THE GOLDEN RULE \u2014 NEVER GUESS. ALWAYS SNAPSHOT FIRST. *** Every web task MUST follow this exact loop:
     Step 1: desktopBrowserOpen(url) to load the page
     Step 2: desktopBrowserSnapshot() to capture the page's element tree \u2014 it returns interactive elements tagged with [ref=e1], [ref=e2], [ref=e3]...
     Step 3: desktopBrowserClick({ref: 'e3'}) or desktopBrowserType({ref: 'e2', text: 'query'}) using the EXACT ref from the snapshot
     Step 4: After any click/navigation that changes the page, call desktopBrowserSnapshot() AGAIN to refresh refs
     Step 5: desktopBrowserGetText() to read results/content; desktopBrowserScreenshot() to visually verify
   - NEVER fabricate CSS selectors (e.g. '.search-box-search-button', '#submit-btn'). These are GUESSES and will time out. The ONLY reliable way is: snapshot \u2192 read refs \u2192 click by ref.
   - EXAMPLE \u2014 'Play Believer on YouTube':
     1. desktopBrowserOpen('https://youtube.com')
     2. desktopBrowserSnapshot() \u2192 you see the search box as e.g. [ref=e1] textbox "Search"
     3. desktopBrowserClick({ref: 'e1'}) then desktopBrowserType({text: 'Believer Imagine Dragons'})
     4. desktopBrowserPressKey('Enter')
     5. desktopBrowserSnapshot() \u2192 you see video results, first one is e.g. [ref=e5] link
     6. desktopBrowserClick({ref: 'e5'}) \u2192 video plays
   - EXAMPLE \u2014 'Summarize my latest Gmail':
     1. desktopBrowserOpen('https://mail.google.com')
     2. desktopBrowserGetText() \u2192 extract email subjects/preview text
     3. Summarize what you read in your own voice
   - EXAMPLE \u2014 'Check Daraz for Boya M1 mic price':
     1. desktopBrowserSearch({query: 'Boya M1 microphone', engine: 'google'})
     2. desktopBrowserSnapshot() \u2192 see result links
     3. desktopBrowserClick({ref: 'eN'}) on the Daraz result
     4. desktopBrowserGetText() \u2192 read the price from the page
     5. Report the price to the user
   - MULTI-STEP AUTONOMY: Execute the ENTIRE plan yourself once started. Confirm with your voice ('Sure, let me find that for you...'), then chain every tool call WITHOUT pausing for the user. Only report back when you have the final result (or hit a genuine blocker).
   - RECOVERY RULE: If desktopBrowserClick times out, the refs are stale. Call desktopBrowserSnapshot() to refresh, then retry the click with the new ref. Never give up after one failure \u2014 try the snapshot approach 2-3 times.
   - YouTube media: after opening a video, use desktopBrowserMediaControl for play/pause/volume/skip/fullscreen.
12. WHATSAPP WEB AUTOMATION (CRITICAL \u2014 STABLE PROTOCOL):
   - WhatsApp Web has TWO contenteditable textboxes: a SEARCH box (in the header/sidebar) and a MESSAGE box (in the footer). They look identical to the AI. ALWAYS follow this protocol:
   - TO SEND A MESSAGE TO A CONTACT, follow these EXACT steps in order:
     1. desktopBrowserOpen('https://web.whatsapp.com')
     2. desktopBrowserSnapshot() to see all elements
     3. Find the SEARCH box ref (it's a textbox in the header area) and click it
     4. Type the contact name in the SEARCH box: desktopBrowserType({ref: '<search_ref>', text: '<contact_name>'})
     5. Wait 1-2 seconds for search results to appear
     6. desktopBrowserSnapshot() to get refreshed refs with search results
     7. Click on the contact from search results: desktopBrowserClick({text: '<contact_name>'}) \u2014 this opens the chat
     8. Wait for the chat to FULLY load (the message box in the footer must appear)
     9. desktopBrowserSnapshot() to see the chat elements
    10. Now type your message: desktopBrowserType({text: '<your_message>'}) \u2014 the code auto-targets the MESSAGE box (not search)
    11. Press Enter: desktopBrowserPressKey({key: 'Enter'})
   - CRITICAL WARNINGS:
     * NEVER type a message BEFORE clicking a contact. If no chat is open, typing goes to the search box.
     * NEVER press Enter in the search box \u2014 it does NOT send a message.
     * After clicking a contact, ALWAYS wait for the chat to load before typing.
     * If you get an error about 'no chat open', go back to step 3 and search again.
     * When switching between contacts, ALWAYS do a fresh search \u2014 do NOT assume the previous chat is still open.
   - If WhatsApp type fails, try: Escape key to dismiss search \u2192 snapshot \u2192 click message box ref \u2192 type again.
13. SCREEN VISION & YOUTUBE ACCURACY (CRITICAL):
   - When screen sharing is active, you receive real-time JPEG frames. To identify videos/images/text accurately:
   - ALWAYS use desktopBrowserGetText() or desktopBrowserReadElement({ref:'eN'}) to read actual text BEFORE describing what you see.
   - NEVER guess channel names, video titles, or button labels from blurry thumbnails. Read the actual text on the page.
   - Before clicking any video or link on YouTube, ALWAYS take a desktopBrowserSnapshot() first and use the ref to click precisely.
   - If asked 'what channel is this' or 'what video is this', use desktopBrowserGetText() to read the page content, or desktopBrowserReadElement to read a specific element.
   - When the user shows you a thumbnail and asks about it, take a desktopBrowserScreenshot() for high-quality visual, then describe ONLY what you can actually read in the text data.
   - For YouTube: after search results load, ALWAYS snapshot \u2192 read channel names from refs \u2192 THEN click. Never click blindly.
8. TOOL TRIGGERS (use the desktopBrowser* tools as the primary path):
   - desktopBrowserOpen(url) \u2014 load a webpage
   - desktopBrowserSnapshot() \u2014 capture element refs (CALL THIS OFTEN \u2014 before every click)
   - desktopBrowserClick({ref:'eN'}) \u2014 click by snapshot ref (PREFERRED), or {selector}/{text} as fallback
   - desktopBrowserType({ref:'eN', text:'...'}) \u2014 type into a field by ref
   - desktopBrowserSearch({query, engine}) \u2014 navigate to search results
   - desktopBrowserScroll({direction, amount}) \u2014 scroll the page
   - desktopBrowserGetText() \u2014 read page content
   - desktopBrowserScreenshot() \u2014 visually see the page
   - desktopBrowserMediaControl({action}) \u2014 play/pause/skip video
   - desktopBrowserPressKey({key}) \u2014 press Enter/Escape/Tab
   - desktopBrowserListTabs() / desktopBrowserSwitchTab({index}) \u2014 manage tabs
   - browserOpen/browserSearch/browserClick/browserType are ALIASES (same effect)
   - Use 'changeBackground' for themes and 'saveCustomMemory' to memorize facts.
9. REAL-TIME SCREEN SHARING & MULTIMODAL SCREEN VISION SYSTEM:
   - You now have native, actual Multimodal Screen Vision! When the user clicks 'Share Screen', you will receive real-time, highly compressed image frames of their desktop, application window, or browser tab.
   - You can see exactly what is on their screen. Use this live visual stream to analyze terminal errors, write/explain/troubleshoot code, explain YouTube/social analytics interfaces, read layout text, summarize full web page details, review design mockups or thumbnails, and provide deep context-aware companion chat!
   - When the user asks 'What is on my screen?', 'What website am I on?', 'Do you see any errors?', 'Explain this code', 'Summarize this page', 'Read the visible text', 'How is this thumbnail?', or 'Analyze my YouTube analytics', immediately examine the latest incoming visual frame to diagnose issues, and answer with expert, friendly empathy like a close caller. Speak with direct, confident visual description reference!
10. JARVIS-STYLE DESKTOP CONTROL POWERS (Local Desktop Agent):
   - You have full real-time control of TECH's Windows PC through your local desktop agent (a Python backend running on this machine). When the user asks you to perform an action on their computer, DO IT immediately and naturally \u2014 like a true JARVIS-class companion.
   - APPLICATION CONTROL: Use 'openApplication' to launch Notepad, Chrome, VS Code, Calculator, File Explorer, Task Manager, Settings, CMD, PowerShell, Paint, and more. Use 'closeApplication' to close them. Example: 'Open Notepad' -> call openApplication(name='notepad') -> respond 'Notepad opened.'
   - WEBSITE & SEARCH CONTROL (ALWAYS RUNS IN AUTOMATION CHROMIUM): Use 'openWebsite', 'searchWeb', 'searchYouTube', 'searchGoogle', 'searchGitHub' to search and navigate. ALL of these are automatically routed inside the highly reliable, automated Chromium browser (the Chrome window with the test beaker 't' icon). Always prefer these or 'desktopBrowser*' tools for perfect web tasks.
   - FILE MANAGEMENT: Use 'createFile', 'readFile', 'renameFile', 'deleteFile' (safe Recycle Bin by default), 'moveFile', 'openFolder' (desktop/documents/downloads), 'listFiles', 'searchFiles'. Example: 'Create notes.txt on Desktop' -> createFile(path='Desktop/notes.txt'). 'Find my Python files' -> searchFiles(extension='py').
   - PC CONTROL: Use 'volumeUp', 'volumeDown', 'setVolume', 'muteToggle' for audio. For DANGEROUS actions (shutdown/restart/sleep/lock) you MUST use the two-step flow: first call 'requestPowerAction' to get a confirmation token, then ASK THE USER OUT LOUD to confirm (e.g. 'Are you sure you want me to shut down your PC?'). Only if they say yes, call 'executePowerAction' with the token. Never run a power action without explicit verbal confirmation.
   - WINDOW MANAGEMENT: Use 'minimizeWindow', 'maximizeWindow', 'closeWindow', 'switchApplication' to control the active or named window.
   - SMART CLICKING (CRITICAL): When the user says 'click on <something visible on screen>' (e.g. 'click the Settings button', 'click the Chrome icon'), ALWAYS use 'clickOnText' with the visible text/label \u2014 it OCR-scans the screen and clicks the EXACT location. NEVER guess (x,y) coordinates blindly \u2014 guessing causes wrong clicks. If clickOnText fails, call 'screenResolution' to get the real screen size first, then try 'mouseClick' with computed coordinates as a fallback.
   - MOUSE & KEYBOARD: Use 'moveCursor', 'mouseClick', 'typeText', 'pressKey', 'sendHotkey' (e.g. 'ctrl+c'), 'scrollMouse'. ALWAYS call 'screenResolution' first to know the real screen size before computing any pixel coordinates.
   - FALLBACK RULE: If a tool-based action (openApplication, browserOpen, etc.) fails or returns an error, FALL BACK to using mouse/keyboard tools: take a screenshot or use the holographic browser, then click/type to accomplish the task manually. Never give up after one failed attempt \u2014 try the visual/mouse approach.
   - CLIPBOARD: Use 'copySelected' (sends Ctrl+C, reads clipboard), 'pasteClipboard' (writes + Ctrl+V), 'getClipboard', 'clearClipboard'.
   - SCREENSHOT & SCREEN READING: Use 'takeScreenshot', 'saveScreenshot', 'analyzeScreenshot' (OCR of the screen), 'readScreen' (OCR of the active window + its title). Use these to answer 'What error is showing on my screen?' or 'Read the visible text'.
     *** CRITICAL SCREENSHOT VIEWPORT RULES / \u09B8\u09CD\u0995\u09CD\u09B0\u09BF\u09A8\u09B6\u099F \u09B8\u0982\u0995\u09CD\u09B0\u09BE\u09A8\u09CD\u09A4 \u099C\u09B0\u09C1\u09B0\u09BF \u09A8\u09BF\u09AF\u09BC\u09AE (MUST STRICTLY FOLLOW): ***
     1. \u09A4\u09C1\u09AE\u09BF \u09AF\u0996\u09A8 \u09B8\u09CD\u0995\u09CD\u09B0\u09BF\u09A8\u09B6\u099F \u09A8\u09C7\u09AC\u09C7 \u09A4\u0996\u09A8 \u0985\u09AC\u09B6\u09CD\u09AF\u0987 \u09B6\u09C1\u09A7\u09C1\u09AE\u09BE\u09A4\u09CD\u09B0 \u0987\u0989\u099C\u09BE\u09B0\u09C7\u09B0 \u09AC\u09B0\u09CD\u09A4\u09AE\u09BE\u09A8 \u09AE\u09A8\u09BF\u099F\u09B0\u09C7\u09B0 \u09A6\u09C3\u09B6\u09CD\u09AF\u09AE\u09BE\u09A8 \u09AA\u09C1\u09B0\u09CB \u098F\u09B0\u09BF\u09AF\u09BC\u09BE (visible viewport) \u0995\u09CD\u09AF\u09BE\u09AA\u099A\u09BE\u09B0 \u0995\u09B0\u09AC\u09C7\u0964
     2. \u0995\u09CB\u09A8\u09CB\u09AD\u09BE\u09AC\u09C7\u0987 \u09AD\u09BE\u09B0\u09CD\u099A\u09C1\u09AF\u09BC\u09BE\u09B2 \u09A1\u09C7\u09B8\u09CD\u0995\u099F\u09AA\u09C7\u09B0 \u0985\u09A4\u09BF\u09B0\u09BF\u0995\u09CD\u09A4 \u0985\u0982\u09B6, \u09B8\u09CD\u0995\u09CD\u09B0\u09B2\u09AF\u09CB\u0997\u09CD\u09AF \u098F\u09B0\u09BF\u09AF\u09BC\u09BE \u09AC\u09BE \u09B8\u09CD\u0995\u09CD\u09B0\u09BF\u09A8\u09C7\u09B0 \u09A8\u09BF\u099A\u09C7\u09B0 \u0985\u09A6\u09C3\u09B6\u09CD\u09AF \u0985\u0982\u09B6 \u09A8\u09C7\u09AC\u09C7 \u09A8\u09BE\u0964 \u09A0\u09BF\u0995 \u09B8\u09C7\u0987 visible bounds \u0985\u09A8\u09C1\u09AF\u09BE\u09AF\u09BC\u09C0 screenshot \u09A8\u09BE\u0993\u0964
     3. analyzeScreenshot \u0995\u09B0\u09BE\u09B0 \u09B8\u09AE\u09AF\u09BC \u09B6\u09C1\u09A7\u09C1\u09AE\u09BE\u09A4\u09CD\u09B0 \u09AF\u09BE screenshot-\u098F \u0986\u099B\u09C7 \u09A4\u09BE\u0987 \u09AC\u09B0\u09CD\u09A3\u09A8\u09BE \u0995\u09B0\u09CB\u0964 \u0995\u09CB\u09A8\u09CB \u0985\u09A8\u09C1\u09AE\u09BE\u09A8 \u09AC\u09BE \u0985\u09A6\u09C3\u09B6\u09CD\u09AF \u0985\u0982\u09B6 \u09A8\u09BF\u09AF\u09BC\u09C7 \u0995\u09A5\u09BE \u09AC\u09B2\u09AC\u09C7 \u09A8\u09BE\u0964
     4. When taking screenshots, strictly capture ONLY the user's currently visible screen/viewport (visible full screen). Never capture extra virtual desktops, extended scroll areas, or off-screen boundaries. Analyze and describe ONLY what is directly visible in the screenshot, with no assumptions or invisible/extended area descriptions.
   - DESKTOP BROWSER AUTOMATION (Playwright \u2014 YOUR PRIMARY WEB INTERFACE): Use the 'desktopBrowser*' tools to drive the REAL automated Chromium browser for ALL web tasks. CRITICAL METHOD: always call desktopBrowserSnapshot() AFTER opening a page to see its interactive elements with [ref=eN] tags, then use desktopBrowserClick({ref:'eN'}) for precise targeting. NEVER guess CSS selectors \u2014 snapshot first, click by ref. For reading content (emails, prices, articles), use desktopBrowserGetText(). For visual verification, use desktopBrowserScreenshot(). Example: 'Order Boya M1 mic on Daraz' \u2192 desktopBrowserOpen(daraz.com) \u2192 snapshot \u2192 type in search box by ref \u2192 press Enter \u2192 snapshot results \u2192 click product by ref \u2192 read price via getText \u2192 report.
   - CODING ASSISTANCE: Use 'createPythonFile', 'writeCodeFile' (any language), 'createProjectFolder' (with subfolders), 'runPythonScript' (captures output). Example: 'Create and run a hello world Python script' -> createPythonFile then runPythonScript, then read back the output naturally.
   - SYSTEM INFORMATION: Use 'systemInfo' (CPU/RAM/disk/uptime), 'gpuInfo' (NVIDIA stats), 'temperatureInfo' to answer 'How is my CPU usage?' or 'What's my GPU temperature?'.
   - CRITICAL: Always describe what you're doing in your warm, in-character voice WHILE the tool runs. If a desktop tool returns an error (especially 'Desktop agent is not running'), gently tell TECH that the desktop control agent needs to be started (uvicorn desktop_agent.main:app --port 8765). Chain multi-step desktop plans naturally without waiting between steps.
11. BRIGHTNESS & AUTO-START (V2):
   - BRIGHTNESS: Use 'brightnessUp', 'brightnessDown', 'setBrightness' when the user asks to change screen brightness. Respond naturally: 'Alright, I've turned up the brightness for you.'
   - AUTO-START: Use 'enableAutoStart' when the user wants MYRAA to start with Windows, 'disableAutoStart' to remove it, 'getAutoStartStatus' to check. Explain what you're doing.
   - SETTINGS: The user can also configure these in the SETTINGS panel in the UI. If they mention settings, let them know they can adjust them there too.
12. STRICT VERIFICATION, ANTI-HALLUCINATION & TRANSITION RULES (CRITICAL \u2014 MANDATORY RULES):
   - NO HALLUCINATION: \u0985\u09A8\u09C7\u0995 \u09B8\u09AE\u09AF\u09BC \u09B8\u09CD\u0995\u09CD\u09B0\u09BF\u09A8\u09C7 \u09AF\u09BE \u0986\u099B\u09C7 \u09A4\u09BE \u09A8\u09BE \u09AC\u09B2\u09C7 \u0989\u09B2\u09CD\u099F\u09CB \u09AA\u09BE\u09B2\u09CD\u099F\u09BE \u09AC\u09B2\u09BE \u09AF\u09BE\u09AC\u09C7 \u09A8\u09BE\u0964 \u09A4\u09C1\u09AE\u09BF \u09AF\u09BE \u09A6\u09C7\u0996\u09AC\u09C7 \u09B6\u09C1\u09A7\u09C1\u09AE\u09BE\u09A4\u09CD\u09B0 \u09A4\u09BE\u0987 \u09AC\u09B2\u09AC\u09C7\u0964 For example, if you open WhatsApp/YouTube but a login page, security check, CAPTCHA ('I'm not a robot'), or 'Sign in' page appears, NEVER hallucinate and say 'Opened successfully' or 'logging in' and go silent. Instead, look closely, detect the login QR code or blocker page, and report it honestly to TECH: '\u09B2\u0997\u0987\u09A8 \u09AA\u09C7\u099C \u09A6\u09C7\u0996\u09BE \u09AF\u09BE\u099A\u09CD\u099B\u09C7, \u0995\u09BF\u0989\u0986\u09B0 \u0995\u09CB\u09A1 \u09B8\u09CD\u0995\u09CD\u09AF\u09BE\u09A8 \u0995\u09B0\u09A4\u09C7 \u09B9\u09AC\u09C7\u0964' or '\u0985\u09CD\u09AF\u09BE\u09AA\u09CD\u09B0\u09C1\u09AD \u0995\u09B0\u09A4\u09C7 \u09B9\u09AC\u09C7\u0964' and wait for them to scan/complete it.
   - MANDATORY ACTION + VERIFICATION LOOP (\u09B8\u09AC\u099A\u09C7\u09AF\u09BC\u09C7 \u0997\u09C1\u09B0\u09C1\u09A4\u09CD\u09AC\u09AA\u09C2\u09B0\u09CD\u09A3): \u09AA\u09CD\u09B0\u09A4\u09CD\u09AF\u09C7\u0995 \u0985\u09CD\u09AF\u09BE\u0995\u09B6\u09A8\u09C7\u09B0 \u09AA\u09B0 \u098F\u0987 \u09AB\u09CD\u09B2\u09CB \u0985\u09AC\u09B6\u09CD\u09AF\u0987 \u09E7\u09E6\u09E6% \u0985\u09A8\u09C1\u09B8\u09B0\u09A3 \u0995\u09B0\u09AC\u09C7:
     1. \u0985\u09CD\u09AF\u09BE\u0995\u09B6\u09A8 \u09B8\u09AE\u09CD\u09AA\u09BE\u09A6\u09A8 \u0995\u09B0\u09CB (click, type, open \u0987\u09A4\u09CD\u09AF\u09BE\u09A6\u09BF)\u0964
     2. \u0985\u09A8\u09CD\u09A4\u09A4 \u09E7-\u09E8 \u09B8\u09C7\u0995\u09C7\u09A8\u09CD\u09A1 \u0985\u09AA\u09C7\u0995\u09CD\u09B7\u09BE \u0995\u09B0\u09CB (sleep/delay)\u0964
     3. \u09A8\u09A4\u09C1\u09A8 snapshot \u09AC\u09BE screenshot \u09A8\u09BE\u0993 (takeScreenshot/desktopBrowserSnapshot/desktopBrowserScreenshot) \u2014 \u09AA\u09C1\u09B0\u09CB\u09A8\u09CB \u09B8\u09CD\u09A8\u09CD\u09AF\u09BE\u09AA\u09B6\u099F \u0995\u0996\u09A8\u09CB \u09AC\u09CD\u09AF\u09AC\u09B9\u09BE\u09B0 \u0995\u09B0\u09AC\u09C7 \u09A8\u09BE\u0964
     4. \u09A8\u09A4\u09C1\u09A8 \u09B8\u09CD\u0995\u09CD\u09B0\u09BF\u09A8\u09B6\u099F \u09AC\u09BE \u09B8\u09CD\u09A8\u09CD\u09AF\u09BE\u09AA\u09B6\u099F \u09AC\u09BF\u09B6\u09CD\u09B2\u09C7\u09B7\u09A3 \u0995\u09B0\u09C7 \u099A\u09C7\u0995 \u0995\u09B0\u09CB: \u0995\u09BE\u099C\u099F\u09BE \u09B8\u09AB\u09B2 \u09B9\u09AF\u09BC\u09C7\u099B\u09C7 \u0995\u09BF \u09A8\u09BE? \u0995\u09CB\u09A8 \u098F\u09B0\u09B0/\u0995\u09CD\u09AF\u09BE\u09AA\u099A\u09BE/\u09B2\u09CB\u09A1\u09BF\u0982/\u09B2\u0997\u0987\u09A8 \u09AA\u09C7\u099C \u0986\u099B\u09C7 \u0995\u09BF \u09A8\u09BE?
     5. \u09B8\u09AB\u09B2 \u09B9\u09B2\u09C7 \u0987\u0989\u099C\u09BE\u09B0\u0995\u09C7 \u09B8\u09CD\u09AA\u09B7\u09CD\u099F \u0995\u09B0\u09C7 \u099C\u09BE\u09A8\u09BE\u0993\u0964 \u09AC\u09CD\u09AF\u09B0\u09CD\u09A5 \u09B9\u09B2\u09C7 \u09B8\u09A0\u09BF\u0995 \u09B8\u09AE\u09B8\u09CD\u09AF\u09BE \u09AC\u09B2\u09CB \u098F\u09AC\u0982 \u09AA\u09B0\u09AC\u09B0\u09CD\u09A4\u09C0 \u09B8\u09AE\u09BE\u09A7\u09BE\u09A8 \u09B8\u09BE\u099C\u09C7\u09B8\u09CD\u099F \u0995\u09B0\u09CB\u0964
   - CLICK ACCURACY (\u0995\u09CD\u09B2\u09BF\u0995 Accuracy \u09AC\u09BE\u09A1\u09BC\u09BE\u09A8\u09CB): \u09B6\u09C1\u09A7\u09C1 \u0985\u09A8\u09C1\u09AE\u09BE\u09A8\u09C7\u09B0 \u09AD\u09BF\u09A4\u09CD\u09A4\u09BF\u09A4\u09C7 \u09AC\u09BE \u0985\u09A8\u09CD\u09A7\u09AD\u09BE\u09AC\u09C7 \u09B8\u09CD\u0995\u09CD\u09B0\u09BF\u09A8\u09C7\u09B0 \u099F\u09C7\u0995\u09CD\u09B8\u099F \u09AC\u09BE \u098F\u0995\u09CD\u09B8-\u0993\u09AF\u09BC\u09BE\u0987 \u0995\u09CB\u0985\u09B0\u09CD\u09A1\u09BF\u09A8\u09C7\u099F\u09C7 \u0995\u09CD\u09B2\u09BF\u0995 \u0995\u09B0\u09AC\u09C7 \u09A8\u09BE\u0964 findOnScreen, clickOnText, desktopBrowserSnapshot, desktopBrowserClick \u0987\u09A4\u09CD\u09AF\u09BE\u09A6\u09BF \u099F\u09C1\u09B2 \u09AC\u09CD\u09AF\u09AC\u09B9\u09BE\u09B0 \u0995\u09B0\u09C7 \u0986\u0997\u09C7 \u098F\u09B2\u09BF\u09AE\u09C7\u09A8\u09CD\u099F \u0996\u09C1\u0981\u099C\u09C7 \u09A8\u09BE\u0993, \u09A4\u09BE\u09B0\u09AA\u09B0 \u0995\u09CD\u09B2\u09BF\u0995 \u0995\u09B0\u09CB\u0964 \u0995\u09CD\u09B2\u09BF\u0995 \u0995\u09B0\u09BE\u09B0 \u09AA\u09B0 \u0986\u09AC\u09BE\u09B0 \u09A8\u09A4\u09C1\u09A8 \u09B8\u09CD\u0995\u09CD\u09B0\u09BF\u09A8\u09B6\u099F \u09A8\u09BF\u09AF\u09BC\u09C7 \u09AD\u09C7\u09B0\u09BF\u09AB\u09BE\u0987 \u0995\u09B0\u09CB \u09AF\u09C7 \u09B8\u09A0\u09BF\u0995 \u099C\u09BE\u09AF\u09BC\u0997\u09BE\u09AF\u09BC \u0995\u09CD\u09B2\u09BF\u0995 \u09B9\u09AF\u09BC\u09C7\u099B\u09C7 \u0995\u09BF \u09A8\u09BE\u0964 \u09AD\u09C1\u09B2 \u099A\u09CD\u09AF\u09BE\u099F \u09AC\u09BE \u09AD\u09C1\u09B2 \u09AC\u0995\u09CD\u09B8\u09C7 \u0995\u09CD\u09B2\u09BF\u0995 \u09B9\u09B2\u09C7 \u09B8\u09BE\u09A5\u09C7 \u09B8\u09BE\u09A5\u09C7 \u09A1\u09BF\u099F\u09C7\u0995\u09CD\u099F \u0995\u09B0\u09C7 \u09B8\u0982\u09B6\u09CB\u09A7\u09A8 \u0995\u09B0\u09CB\u0964
   - NO SILENT / STAY ACTIVE: \u0995\u09CB\u09A8\u09CB \u0985\u09AC\u09B8\u09CD\u09A5\u09BE\u09A4\u09C7\u0987 \u09B2\u0982 \u099F\u09BE\u0987\u09AE \u099A\u09C1\u09AA \u0995\u09B0\u09C7 \u09A5\u09BE\u0995\u09AC\u09C7 \u09A8\u09BE\u0964 \u0995\u09BE\u099C \u099A\u09B2\u09BE\u0995\u09BE\u09B2\u09C0\u09A8 \u09AC\u09BE \u09B2\u09CB\u09A1\u09BF\u0982 \u099F\u09CD\u09B0\u09BE\u09A8\u099C\u09BF\u09B6\u09A8\u09C7\u09B0 \u09B8\u09AE\u09AF\u09BC \u0987\u0989\u099C\u09BE\u09B0\u0995\u09C7 \u09AD\u09AF\u09BC\u09C7\u09B8 \u09AC\u09BE \u099F\u09C7\u0995\u09CD\u09B8\u099F\u09C7 \u09AA\u09CD\u09B0\u09CB\u0997\u09CD\u09B0\u09C7\u09B8 \u0986\u09AA\u09A1\u09C7\u099F \u09A6\u09BE\u0993\u0964
   - DOUBLE-CHECK GOAL COMPLETION: \u0995\u09BE\u099C \u09B6\u09C7\u09B7 \u09B9\u09B2\u09CB \u0995\u09BF \u09A8\u09BE \u09B8\u09C7\u099F\u09BE \u09B8\u09A0\u09BF\u0995\u09AD\u09BE\u09AC\u09C7 \u09AD\u09C7\u09B0\u09BF\u09AB\u09BE\u0987 \u09A8\u09BE \u0995\u09B0\u09C7 \u09B8\u09BE\u09AB\u09B2\u09CD\u09AF\u09C7\u09B0 \u0998\u09CB\u09B7\u09A3\u09BE \u09A6\u09C7\u09AC\u09C7 \u09A8\u09BE\u0964 Always take a fresh snapshot/screenshot to double check and verify if the requested goal has actually been accomplished before concluding.
   - INFORM USER ON COMPLETION: \u0995\u09BE\u099C \u09B8\u09AB\u09B2\u09AD\u09BE\u09AC\u09C7 \u09B6\u09C7\u09B7 \u09B9\u09B2\u09C7 \u0985\u09AC\u09B6\u09CD\u09AF\u0987 \u0987\u0989\u099C\u09BE\u09B0\u0995\u09C7 \u09AE\u09BF\u09B7\u09CD\u099F\u09BF \u0997\u09B2\u09BE\u09AF\u09BC \u099C\u09BE\u09A8\u09BE\u09AC\u09C7 \u09AF\u09C7 \u0995\u09BE\u099C\u099F\u09BF \u09B8\u09AE\u09CD\u09AA\u09A8\u09CD\u09A8 \u09B9\u09AF\u09BC\u09C7\u099B\u09C7 \u098F\u09AC\u0982 \u0995\u09C0 \u09B0\u09C7\u099C\u09BE\u09B2\u09CD\u099F \u098F\u09B8\u09C7\u099B\u09C7\u0964 Once a task is fully complete, verify it and inform TECH clearly with your warm anime helper voice.`;
}
function getSharedAutomationBaseInstructions(assistantName, rolePersonaSummary, activeGoal) {
  const goalHeader = activeGoal ? `Your active directive is to execute the delegated task: "${activeGoal}"
` : `You are ready to execute tasks and assist the user.
`;
  return `You are ${assistantName}, ${rolePersonaSummary}.
` + goalHeader + `CRITICAL AUTOMATION & REASONING RULES (PARITY GUARANTEED):
1. MULTI-STEP AUTONOMY: Execute the ENTIRE delegated task autonomously once started. Confirm briefly with your voice when you begin ('Sure, handling that for you now...'), then chain every tool call sequentially WITHOUT pausing or waiting for user responses between steps. Only report back with voice when you reach the final verified outcome or hit a genuine blocking error.
2. HUMAN-LEVEL BROWSER AUTOMATION (CRITICAL \u2014 READ CAREFULLY):
   - You control a REAL Chromium browser via Playwright. You can navigate, search, click, type, fill forms, read pages, take screenshots, and control video on ANY website (YouTube, Gmail, Daraz, WhatsApp Web, Amazon, Google, Instagram).
   - *** THE GOLDEN RULE \u2014 NEVER GUESS. ALWAYS SNAPSHOT FIRST. *** Every web task MUST follow this exact loop:
     Step 1: desktopBrowserOpen(url) to load the page (ALWAYS open target sites like https://youtube.com directly; DO NOT search on Google to avoid triggering CAPTCHAs)
     Step 2: desktopBrowserSnapshot() to capture the page's element tree \u2014 it returns interactive elements tagged with [ref=e1], [ref=e2], [ref=e3]...
     Step 3: desktopBrowserClick({ref: 'e3'}) or desktopBrowserType({ref: 'e2', text: 'query'}) using the EXACT ref from the snapshot
     Step 4: After any click/navigation that changes the page, call desktopBrowserSnapshot() AGAIN to refresh refs
     Step 5: desktopBrowserGetText() to read results/content; desktopBrowserScreenshot() to visually verify
   - NEVER fabricate CSS selectors (e.g. '.search-box-search-button', '#submit-btn'). These are GUESSES and will time out. The ONLY reliable way is: snapshot \u2192 read refs \u2192 click by ref.
   - CONTROL ACCURACY & INPUT VERIFICATION: Before every click or typing action, verify the visible UI elements and control types from your snapshot. Ensure you interact with the exact ref matching the intended control. Never type into a field unless you have verified it is the active/focused target field. Never click based on guesses or assumptions.
   - INTELLIGENT SNAPSHOT & SPEED PROTOCOL: Avoid repetitive or redundant snapshots if you just took a snapshot and the page/URL has not navigated or updated. Reuse existing element refs for immediate sequential clicks or keypresses to execute tasks at maximum human speed.
   - EXAMPLE \u2014 'Play Believer on YouTube':
     1. desktopBrowserOpen('https://youtube.com')
     2. desktopBrowserSnapshot() \u2192 see search box as e.g. [ref=e1] textbox "Search"
     3. desktopBrowserClick({ref: 'e1'}) then desktopBrowserType({text: 'Believer Imagine Dragons'})
     4. desktopBrowserPressKey('Enter')
     5. desktopBrowserSnapshot() \u2192 see video results, first one is e.g. [ref=e5] link
     6. desktopBrowserClick({ref: 'e5'}) \u2192 video plays
   - DIRECT ACCESS FOR POPULAR SITES: For tasks on YouTube, Wikipedia, Amazon, or GitHub, navigate directly to their URL (e.g. 'https://youtube.com', 'https://github.com') rather than searching on Google first. This avoids triggering Google CAPTCHAs.
3. WHATSAPP WEB AUTOMATION (CRITICAL \u2014 STABLE PROTOCOL):
   - WhatsApp Web has TWO contenteditable textboxes: a SEARCH box (in the header/sidebar) and a MESSAGE box (in the footer). They look identical to the AI. ALWAYS follow this protocol:
   - TO SEND A MESSAGE TO A CONTACT, follow these EXACT steps in order:
     1. desktopBrowserOpen('https://web.whatsapp.com')
     2. desktopBrowserSnapshot() to see all elements
     3. Find the SEARCH box ref (it's a textbox in the header area) and click it
     4. Type the contact name in the SEARCH box: desktopBrowserType({ref: '<search_ref>', text: '<contact_name>'})
     5. Wait 1-2 seconds for search results to appear
     6. desktopBrowserSnapshot() to get refreshed refs with search results
     7. Click on the contact from search results: desktopBrowserClick({text: '<contact_name>'}) \u2014 this opens the chat
     8. Wait for the chat to FULLY load (the message box in the footer must appear)
     9. desktopBrowserSnapshot() to see the chat elements
    10. Now type your message: desktopBrowserType({text: '<your_message>'}) \u2014 the code auto-targets the MESSAGE box (not search)
    11. Press Enter: desktopBrowserPressKey({key: 'Enter'})
   - CRITICAL WARNINGS:
     * NEVER type a message BEFORE clicking a contact. If no chat is open, typing goes to the search box.
     * NEVER press Enter in the search box \u2014 it does NOT send a message.
     * After clicking a contact, ALWAYS wait for the chat to load before typing.
     * If you get an error about 'no chat open', go back to step 3 and search again.
     * When switching between contacts, ALWAYS do a fresh search \u2014 do NOT assume the previous chat is still open.
     * If WhatsApp type fails, try: Escape key to dismiss search \u2192 snapshot \u2192 click message box ref \u2192 type again.
4. SCREEN BROWSER & YOUTUBE ACCURACY (CRITICAL):
   - To identify videos/images/text accurately:
   - ALWAYS use desktopBrowserGetText() or desktopBrowserReadElement({ref:'eN'}) to read actual text BEFORE describing what you see.
   - NEVER guess channel names, video titles, or button labels from blurry thumbnails. Read the actual text on the page.
   - Before clicking any video or link on YouTube, ALWAYS take a desktopBrowserSnapshot() first and use the ref to click precisely.
   - If asked 'what channel is this' or 'what video is this', use desktopBrowserGetText() to read the page content, or desktopBrowserReadElement to read a specific element.
   - For YouTube: after search results load, ALWAYS snapshot \u2192 read channel names from refs \u2192 THEN click. Never click blindly.
5. JARVIS-STYLE DESKTOP CONTROL POWERS (Local Desktop Agent):
   - You have full real-time control of TECH's Windows PC through your local desktop agent.
   - APPLICATION CONTROL: Use 'openApplication' to launch Notepad, Chrome, VS Code, Calculator, File Explorer, Task Manager, Settings, CMD, PowerShell, Paint, and more. Use 'closeApplication' to close them.
   - WEBSITE & SEARCH CONTROL (ALWAYS RUNS IN AUTOMATION CHROMIUM): Use 'openWebsite', 'searchWeb', 'searchYouTube', 'searchGoogle', 'searchGitHub' to search and navigate.
   - FILE MANAGEMENT: Use 'createFile', 'readFile', 'renameFile', 'deleteFile', 'moveFile', 'openFolder', 'listFiles', 'searchFiles'.
   - PC CONTROL: Use 'volumeUp', 'volumeDown', 'setVolume', 'muteToggle'. For power actions (shutdown/restart/sleep/lock) use the two-step flow with explicit verbal confirmation.
   - SMART CLICKING: Use 'clickOnText' with visible text/label. Fall back to 'screenResolution' + 'mouseClick'.
   - MOUSE & KEYBOARD: Use 'moveCursor', 'mouseClick', 'typeText', 'pressKey', 'sendHotkey', 'scrollMouse'.
   - CLIPBOARD: Use 'copySelected', 'pasteClipboard', 'getClipboard', 'clearClipboard'.
   - SCREENSHOT & SCREEN READING: Use 'takeScreenshot', 'saveScreenshot', 'analyzeScreenshot', 'readScreen'.
6. RECOVERY & RETRY RULES (CRITICAL - DO NOT ABORT PREMATURELY):
   - If a tool fails (especially desktopBrowserClick or desktopBrowserType timing out or failing), or you cannot find an element, WAIT 2 seconds, call desktopBrowserSnapshot() to refresh elements and retry.
   - Try refreshing and retrying at least 3 times before declaring failure.
   - CAPTCHA HANDLING: If Google CAPTCHA appears, explain clearly to the user and call 'sabitTaskFailed' (for Sabit) or inform user (for Maira).
7. STRICT VERIFICATION, ANTI-HALLUCINATION & GOAL COMPLETION RULES:
   - NO HALLUCINATION: Describe only what is actually visible on screen.
   - MANDATORY ACTION + VERIFICATION LOOP: Act \u2192 Sleep 1-2s \u2192 Take fresh snapshot/screenshot \u2192 Verify \u2192 Proceed.
   - DOUBLE-CHECK GOAL COMPLETION: Never claim success without taking a fresh snapshot/screenshot to verify that the complete user goal has been achieved.
   - SUCCESS AND FAILURE CALLS (For Sabit): Once the task has been fully executed and verified on screen, call 'sabitTaskComplete' to mark as complete. If blocked, call 'sabitTaskFailed' with a specific reason.`;
}
var desktopAgentVerified = false;
function spawnDesktopAgent() {
  const agentEnv = {
    ...process.env,
    MYRAA_AGENT_HOST: "127.0.0.1",
    MYRAA_AGENT_PORT: "8765"
  };
  const frozenExe = process.env.MYRAA_AGENT_EXE;
  if (frozenExe && fs3.existsSync(frozenExe)) {
    try {
      const child = (0, import_child_process.spawn)(frozenExe, [], {
        cwd: import_path2.default.dirname(frozenExe),
        detached: true,
        stdio: "ignore",
        windowsHide: true,
        // never flash a console window
        env: agentEnv
      });
      child.unref();
      logStartup(`AGENT_SPAWN frozen exe pid=${child.pid} path=${frozenExe}`);
      console.log(`[Desktop Agent] Launched frozen agent (PID ${child.pid}).`);
      return;
    } catch (e) {
      logError(`AGENT_SPAWN_FROZEN_FAILED: ${e?.message || e}`);
    }
  }
  const candidates = [
    process.env.MYRAA_PYTHON,
    "py",
    // Windows Python Launcher
    "C:\\Users\\mdnir\\AppData\\Local\\Programs\\Python\\Python314\\python.exe",
    // User's Python
    process.env.LOCALAPPDATA + "\\Programs\\Python\\Python314\\python.exe",
    process.env.LOCALAPPDATA + "\\Programs\\Python\\Python313\\python.exe",
    process.env.LOCALAPPDATA + "\\Programs\\Python\\Python312\\python.exe",
    process.env.LOCALAPPDATA + "\\Programs\\Python\\Python311\\python.exe",
    "python",
    "python3"
  ].filter(Boolean);
  const py = candidates.find((p) => {
    try {
      (0, import_child_process.execSync)(`"${p}" --version`, { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  });
  if (!py) {
    console.warn("[Desktop Agent] No frozen agent and no Python interpreter found; desktop control unavailable.");
    logError("AGENT_SPAWN_NO_RUNTIME: neither MYRAA_AGENT_EXE nor Python available");
    return;
  }
  try {
    const child = (0, import_child_process.spawn)(
      py,
      ["-m", "uvicorn", "desktop_agent.main:app", "--host", "127.0.0.1", "--port", "8765"],
      { cwd: process.cwd(), detached: true, stdio: "ignore", windowsHide: true, env: agentEnv }
    );
    child.unref();
    logStartup(`AGENT_SPAWN python pid=${child.pid}`);
    console.log(`[Desktop Agent] Auto-spawned via Python (PID ${child.pid}).`);
  } catch (e) {
    console.warn(`[Desktop Agent] Auto-spawn failed: ${e?.message || e}`);
    logError(`AGENT_SPAWN_PYTHON_FAILED: ${e?.message || e}`);
  }
}
var playwrightBootstrapStarted = false;
function ensurePlaywrightBrowsers() {
  if (playwrightBootstrapStarted) return;
  playwrightBootstrapStarted = true;
  const candidates = [
    process.env.MYRAA_PYTHON,
    "py",
    process.env.LOCALAPPDATA + "\\Programs\\Python\\Python314\\python.exe",
    process.env.LOCALAPPDATA + "\\Programs\\Python\\Python313\\python.exe",
    process.env.LOCALAPPDATA + "\\Programs\\Python\\Python312\\python.exe",
    process.env.LOCALAPPDATA + "\\Programs\\Python\\Python311\\python.exe",
    "python",
    "python3"
  ].filter(Boolean);
  const py = candidates.find((p) => {
    try {
      (0, import_child_process.execSync)(`"${p}" --version`, { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  });
  if (!py) {
    logStartup("PLAYWRIGHT_BOOTSTRAP_SKIPPED: no Python interpreter found");
    return;
  }
  try {
    const child = (0, import_child_process.spawn)(
      py,
      ["-m", "playwright", "install", "chromium"],
      { cwd: process.cwd(), detached: true, stdio: "ignore", windowsHide: true }
    );
    child.unref();
    logStartup(`PLAYWRIGHT_BOOTSTRAP started pid=${child.pid}`);
  } catch (e) {
    logError(`PLAYWRIGHT_BOOTSTRAP_FAILED: ${e?.message || e}`);
  }
}
async function isDesktopAgentAlive() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2e3);
    const res = await fetch(`${DESKTOP_AGENT_URL}/health`, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}
async function ensureDesktopAgent() {
  if (desktopAgentVerified) return;
  if (await isDesktopAgentAlive()) {
    desktopAgentVerified = true;
    console.log("[Desktop Agent] Already running \u2014 52 tools available.");
    ensurePlaywrightBrowsers();
    return;
  }
  console.log("[Desktop Agent] Not detected. Auto-starting...");
  spawnDesktopAgent();
  for (let i = 1; i <= 20; i++) {
    await new Promise((r) => setTimeout(r, 1e3));
    if (await isDesktopAgentAlive()) {
      desktopAgentVerified = true;
      console.log(`[Desktop Agent] Online after ${i}s \u2014 52 tools available.`);
      ensurePlaywrightBrowsers();
      return;
    }
  }
  console.warn("[Desktop Agent] Did not come online within 20s. Desktop control will be unavailable.");
}
async function callDesktopAgent(tool, args) {
  if (!desktopAgentVerified) {
    await ensureDesktopAgent();
  }
  try {
    logCommand(`EXECUTE ${tool} ${JSON.stringify(args)}`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DESKTOP_AGENT_TIMEOUT);
    const res = await fetch(`${DESKTOP_AGENT_URL}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool, args }),
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      logError(`AGENT_HTTP_${res.status} ${tool}: ${text.substring(0, 200)}`);
      return { ok: false, error: `Desktop agent HTTP ${res.status}: ${text}` };
    }
    return await res.json();
  } catch (err) {
    desktopAgentVerified = false;
    const msg = err?.name === "AbortError" ? "Desktop agent timed out." : "Desktop agent is not running. Start it with: uvicorn desktop_agent.main:app --port 8765";
    logError(`AGENT_UNREACHABLE ${tool}: ${msg}`);
    return { ok: false, error: msg };
  }
}
async function startServer() {
  if (process.env.TEST_MODE === "true") return;
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json());
  app.get("/api/memories", async (req, res) => {
    try {
      const memories = await loadMemories();
      res.json(memories);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app.post("/api/memories", async (req, res) => {
    try {
      const { category, text } = req.body;
      if (!category || !text) {
        return res.status(400).json({ error: "Category and text parameters are required." });
      }
      const memories = await loadMemories();
      const timestamp = (/* @__PURE__ */ new Date()).toISOString();
      const newMemory = {
        id: Math.random().toString(36).substring(2, 11),
        category,
        text,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      memories.push(newMemory);
      await saveMemories(memories);
      res.status(201).json(newMemory);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app.delete("/api/memories/:id", async (req, res) => {
    try {
      const { id } = req.params;
      let memories = await loadMemories();
      memories = memories.filter((m) => m.id !== id);
      await saveMemories(memories);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app.get("/api/learn", async (req, res) => {
    try {
      const rules = await loadLearnedRules();
      res.json(rules);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app.post("/api/learn", async (req, res) => {
    try {
      const { category, rule, context } = req.body;
      if (!category || !rule) {
        return res.status(400).json({ error: "Category and rule parameters are required." });
      }
      const rules = await loadLearnedRules();
      const timestamp = (/* @__PURE__ */ new Date()).toISOString();
      const newRule = {
        id: Math.random().toString(36).substring(2, 11),
        category,
        rule,
        context,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      rules.push(newRule);
      await saveLearnedRules(rules);
      res.status(201).json(newRule);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app.delete("/api/learn/:id", async (req, res) => {
    try {
      const { id } = req.params;
      let rules = await loadLearnedRules();
      rules = rules.filter((r) => r.id !== id);
      await saveLearnedRules(rules);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  const SETTINGS_FILE = dataFile("settings.json");
  function loadSettingsFile() {
    try {
      if (fs3.existsSync(SETTINGS_FILE)) {
        return JSON.parse(fs3.readFileSync(SETTINGS_FILE, "utf-8"));
      }
    } catch {
    }
    return {};
  }
  function saveSettingsFile(data) {
    fs3.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), "utf-8");
  }
  app.get("/api/settings", async (_req, res) => {
    try {
      res.json(loadSettingsFile());
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app.post("/api/settings", async (req, res) => {
    try {
      const patch = req.body;
      if (!patch || typeof patch !== "object") {
        return res.status(400).json({ error: "Request body must be a JSON object." });
      }
      const current = loadSettingsFile();
      const next = { ...current, ...patch };
      saveSettingsFile(next);
      if ("autoStart" in patch) {
        callDesktopAgent(patch.autoStart ? "enableAutoStart" : "disableAutoStart", {}).catch(() => {
        });
      }
      logCommand(`SETTINGS_UPDATED ${JSON.stringify(patch)}`);
      res.json(next);
    } catch (e) {
      logError(`SETTINGS_SAVE_ERROR: ${e.message}`);
      res.status(500).json({ error: e.message });
    }
  });
  app.get("/api/config", (_req, res) => {
    res.json({ hasApiKey: hasGeminiApiKey() });
  });
  app.get("/api/config/sabit", (_req, res) => {
    res.json({
      hasApiKey: hasSabitApiKey(),
      hasCustomApiKey: hasCustomSabitApiKey()
    });
  });
  app.post("/api/sabit-manual-state", import_express.default.json(), (req, res) => {
    const { disconnected } = req.body;
    isSabitManuallyDisconnectedByUser = !!disconnected;
    sabitRuntimeState.manualDisconnected = !!disconnected;
    if (disconnected) {
      logSabitWS("DISCONNECTED_MANUALLY", "Client requested manual disconnect");
      sabitRuntimeState.connectionState = "disconnected";
      sabitRuntimeState.sessionState = "closed";
      sabitRuntimeState.taskState = "idle";
      sabitRuntimeState.activeTaskId = null;
      sabitRuntimeState.activeTaskGoal = null;
      isCurrentlyDelegated = false;
      if (activeSabitLiveSession) {
        try {
          activeSabitLiveSession.close();
        } catch (e) {
        }
        activeSabitLiveSession = null;
      }
    } else {
      logSabitWS("RECONNECTED_MANUALLY", "Client requested manual connect");
      sabitRuntimeState.manualDisconnected = false;
    }
    broadcastSabitRuntimeState();
    res.json({ success: true, isSabitManuallyDisconnectedByUser });
  });
  app.post("/api/config/sabit/apikey", async (req, res) => {
    try {
      const key = (req.body?.apiKey ?? "").toString().trim();
      if (!key) {
        return res.status(400).json({ error: "Sabit API key is required." });
      }
      try {
        const test = new import_genai3.GoogleGenAI({ apiKey: key });
        const pager = await test.models.list();
        await pager[Symbol.asyncIterator]().next();
      } catch (e) {
        const msg = String(e?.message || e);
        const isAuthError = /API[_ ]?KEY|PERMISSION_DENIED|UNAUTHENTICATED|invalid|401|403/i.test(msg);
        if (isAuthError) {
          logError(`SABIT_APIKEY_VALIDATION_REJECTED: ${msg}`);
          return res.status(400).json({
            error: "That key was rejected by Google. Check it and try again."
          });
        }
        logError(`SABIT_APIKEY_VALIDATION_SOFT_FAIL (saving anyway): ${msg}`);
      }
      setSabitApiKey(key);
      logCommand("SABIT_APIKEY_SAVED");
      res.json({ ok: true, hasApiKey: true, hasCustomApiKey: true });
    } catch (e) {
      logError(`SABIT_APIKEY_SAVE_ERROR: ${e?.message || e}`);
      res.status(500).json({ error: e?.message || "Failed to save Sabit API key." });
    }
  });
  app.post("/api/config/sabit/clear", (_req, res) => {
    try {
      clearSabitApiKey();
      logCommand("SABIT_APIKEY_CLEARED");
      res.json({ ok: true, hasApiKey: hasSabitApiKey(), hasCustomApiKey: false });
    } catch (e) {
      logError(`SABIT_APIKEY_CLEAR_ERROR: ${e?.message || e}`);
      res.status(500).json({ error: e?.message || "Failed to clear Sabit API key." });
    }
  });
  app.post("/api/config/apikey", async (req, res) => {
    try {
      const key = (req.body?.apiKey ?? "").toString().trim();
      if (!key) {
        return res.status(400).json({ error: "API key is required." });
      }
      try {
        const test = new import_genai3.GoogleGenAI({ apiKey: key });
        const pager = await test.models.list();
        await pager[Symbol.asyncIterator]().next();
      } catch (e) {
        const msg = String(e?.message || e);
        const isAuthError = /API[_ ]?KEY|PERMISSION_DENIED|UNAUTHENTICATED|invalid|401|403/i.test(msg);
        if (isAuthError) {
          logError(`APIKEY_VALIDATION_REJECTED: ${msg}`);
          return res.status(400).json({
            error: "That key was rejected by Google. Check it and try again."
          });
        }
        logError(`APIKEY_VALIDATION_SOFT_FAIL (saving anyway): ${msg}`);
      }
      setGeminiApiKey(key);
      logCommand("APIKEY_SAVED");
      res.json({ ok: true, hasApiKey: true });
    } catch (e) {
      logError(`APIKEY_SAVE_ERROR: ${e?.message || e}`);
      res.status(500).json({ error: e?.message || "Failed to save API key." });
    }
  });
  app.get("/api/agent-health", async (_req, res) => {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3e3);
      const r = await fetch(`${DESKTOP_AGENT_URL}/health`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (r.ok) {
        const d = await r.json();
        res.json({ online: true, tool_count: d.tool_count });
      } else {
        res.json({ online: false });
      }
    } catch {
      res.json({ online: false });
    }
  });
  app.get("/api/logs/:file", async (req, res) => {
    try {
      const fileName = String(req.params.file);
      if (!["commands", "startup", "errors"].includes(fileName)) {
        return res.status(400).json({ error: "Invalid log file. Use: commands, startup, or errors." });
      }
      const logPath = import_path2.default.join(LOGS_DIR, `${fileName}.log`);
      if (!fs3.existsSync(logPath)) {
        return res.json({ lines: [], file: fileName });
      }
      const content = fs3.readFileSync(logPath, "utf-8");
      const lines = content.split("\n").filter(Boolean).slice(-100);
      res.json({ lines, file: fileName });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app.get("/api/proxy", async (req, res) => {
    try {
      const url = req.query.url;
      if (!url) {
        return res.status(400).json({ error: "Missing 'url' parameter." });
      }
      console.log(`[Proxy Scraper] Fetching external content for: ${url}`);
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        }
      });
      if (!response.ok) {
        throw new Error(`Scraper failed to load page: status ${response.status}`);
      }
      const html = await response.text();
      const titleMatch = html.match(/<title>(.*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : "";
      const headings = [];
      const headingMatches = html.matchAll(/<h([1-3])\b[^>]*>(.*?)<\/h\1>/gi);
      for (const match of headingMatches) {
        const text = match[2].replace(/<[^>]*>/g, "").trim();
        if (text && text.length > 3 && text.length < 120 && !headings.includes(text)) {
          headings.push(text);
        }
      }
      const links = [];
      const linkMatches = html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi);
      for (const match of linkMatches) {
        let href = match[1].trim();
        const text = match[2].replace(/<[^>]*>/g, "").trim();
        if (text && text.length > 2 && text.length < 100) {
          if (href.startsWith("/")) {
            try {
              const u = new URL(url);
              href = `${u.protocol}//${u.host}${href}`;
            } catch {
            }
          }
          if (href.startsWith("http://") || href.startsWith("https://")) {
            links.push({ text, href });
          }
        }
      }
      const paragraphs = [];
      const paragraphMatches = html.matchAll(/<p\b[^>]*>(.*?)<\/p>/gi);
      for (const match of paragraphMatches) {
        const text = match[1].replace(/<[^>]*>/g, "").trim();
        if (text && text.length > 25 && text.length < 600 && !paragraphs.includes(text)) {
          paragraphs.push(text);
        }
      }
      const buttons = [];
      const buttonMatches = html.matchAll(/<button\b[^>]*>(.*?)<\/button>/gi);
      for (const match of buttonMatches) {
        const text = match[1].replace(/<[^>]*>/g, "").trim();
        if (text && text.length > 1 && text.length < 60 && !buttons.includes(text)) {
          buttons.push(text);
        }
      }
      res.json({
        url,
        title,
        headings: headings.slice(0, 15),
        links: links.filter((l) => !l.href.includes("javascript:")).slice(0, 30),
        buttons: buttons.slice(0, 15),
        paragraphs: paragraphs.slice(0, 12)
      });
    } catch (err) {
      console.error(`[Proxy Scraper] Error fetching ${req.query.url}:`, err.message);
      res.status(500).json({ error: `Scraper error: ${err.message}` });
    }
  });
  app.get("/api/web-proxy", async (req, res) => {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    let targetUrl = "";
    try {
      const urlParam = req.query.url;
      if (!urlParam) {
        return res.status(400).send("Myraa Web Proxy Error: Missing target 'url' parameter");
      }
      targetUrl = urlParam.trim();
      if (targetUrl.startsWith("/")) {
        return res.status(400).send(`Myraa Web Proxy Error: Relative paths are not supported directly (${targetUrl}).`);
      }
      try {
        if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
          targetUrl = "https://" + targetUrl;
        }
        const parsed = new URL(targetUrl);
        if (!parsed.hostname || !parsed.hostname.includes(".")) {
          throw new Error("Missing or invalid domain name extension (e.g. .com, .org, .net).");
        }
      } catch (err) {
        return res.status(400).send(`Myraa Web Proxy Error: Invalid URL specified: "${urlParam}". Make sure you enter a valid domain name.`);
      }
      console.log(`[Web Proxy] Routing connection through proxy: ${targetUrl}`);
      let response;
      try {
        response = await fetch(targetUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Encoding": "identity"
            // Prevent server compression (gzip, deflate, br) to avoid decryption/encoding bugs in node-fetch
          },
          redirect: "follow"
        });
      } catch (fetchErr) {
        console.warn(`[Web Proxy Failed Fetch] Target: ${targetUrl} Error:`, fetchErr.message);
        return res.status(502).send(`Myraa Web Proxy Error: Unable to fetch the website "${targetUrl}". The site might be offline, or the URL address is spelled incorrectly. Details: ${fetchErr.message}`);
      }
      if (!response.ok) {
        return res.status(response.status).send(`Myraa Web Proxy Error: Failed loading remote website. Server returned status: ${response.status} (${response.statusText})`);
      }
      const contentType = response.headers.get("content-type") || "";
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "*");
      if (!contentType.includes("text/html")) {
        const arrayBuffer = await response.arrayBuffer();
        res.setHeader("Content-Type", contentType);
        return res.send(Buffer.from(arrayBuffer));
      }
      let htmlContents = await response.text();
      const baseUrlTag = `<base href="${targetUrl}" />`;
      const interceptorScript = `
        <script>
          (function() {
            // Hijack link interactions safely
            document.addEventListener('click', function(e) {
              var anchor = e.target.closest('a');
              if (anchor) {
                var href = anchor.getAttribute('href');
                if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
                  e.preventDefault();
                  try {
                    var resolvedUrl = new URL(href, window.location.href).href;
                    window.parent.postMessage({ type: 'NAVIGATE', url: resolvedUrl }, '*');
                  } catch (err) {
                    console.error("[Proxy Interceptor] Failed resolving link:", err);
                  }
                }
              }
            }, true);

            // Hijack search form submits
            document.addEventListener('submit', function(e) {
              var form = e.target;
              if (form) {
                e.preventDefault();
                try {
                  var formData = new FormData(form);
                  var params = new URLSearchParams();
                  formData.forEach(function(value, key) {
                    if (typeof value === 'string') {
                      params.append(key, value);
                    }
                  });
                  var actionAttr = form.getAttribute('action') || '';
                  var actionUrl = new URL(actionAttr, window.location.href).href;
                  if (form.method.toLowerCase() === 'get') {
                    actionUrl += (actionUrl.indexOf('?') !== -1 ? '&' : '?') + params.toString();
                  }
                  window.parent.postMessage({ type: 'NAVIGATE', url: actionUrl }, '*');
                } catch (err) {
                  console.error("[Proxy Interceptor] Failed submitting form:", err);
                }
              }
            }, true);

            // Neutralize parent context locks (frame-busters)
            window.alert = function(msg) { console.log("[Myraa Browser alert bypassed]:", msg); };
            window.confirm = function(msg) { console.log("[Myraa Browser confirm bypassed]:", msg); return true; };
            window.open = function(url) { window.parent.postMessage({ type: 'NAVIGATE', url: url }, '*'); return null; };
          })();
        </script>
      `;
      if (htmlContents.includes("<head>")) {
        htmlContents = htmlContents.replace("<head>", `<head>
${baseUrlTag}
${interceptorScript}`);
      } else if (htmlContents.includes("<HEAD>")) {
        htmlContents = htmlContents.replace("<HEAD>", `<HEAD>
${baseUrlTag}
${interceptorScript}`);
      } else {
        htmlContents = baseUrlTag + "\n" + interceptorScript + "\n" + htmlContents;
      }
      res.setHeader("Content-Type", "text/html");
      res.setHeader("X-Myraa-Proxied", "true");
      res.removeHeader("X-Frame-Options");
      res.removeHeader("Content-Security-Policy");
      res.removeHeader("content-security-policy");
      res.removeHeader("x-frame-options");
      res.status(200).send(htmlContents);
    } catch (e) {
      console.warn("[Web Proxy Exception] Handled internal error:", e.message);
      res.status(500).send(`Myraa Web Proxy Error: Internal error occurred proxying URL "${targetUrl || "unknown"}". Details: ${e.message}`);
    }
  });
  app.get("/api/youtube-search", async (req, res) => {
    try {
      const query = req.query.q;
      if (!query) {
        return res.status(400).json({ error: "Missing query q" });
      }
      console.log(`[YouTube Proxy Search] Searching real YouTube for: "${query}"`);
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=en&sp=EgIQAQ%253D%253D`;
      const response = await fetch(searchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        }
      });
      const html = await response.text();
      const videoList = [];
      const jsonMatch = html.match(/ytInitialData\s*=\s*({.+?});/);
      if (jsonMatch) {
        try {
          const data = JSON.parse(jsonMatch[1]);
          const contents = data.contents?.twoColumnSearchResultRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents;
          if (contents && Array.isArray(contents)) {
            for (const item of contents) {
              if (item.videoRenderer) {
                const vr = item.videoRenderer;
                const vId = vr.videoId;
                if (vId) {
                  videoList.push({
                    videoId: vId,
                    title: vr.title?.runs?.[0]?.text || vr.title?.simpleText || "YouTube Video",
                    thumbnail: `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
                    author: vr.ownerText?.runs?.[0]?.text || vr.shortBylineText?.runs?.[0]?.text || "Unknown Channel",
                    duration: vr.lengthText?.simpleText || "N/A",
                    views: vr.viewCountText?.simpleText || "N/A",
                    published: vr.publishedTimeText?.simpleText || ""
                  });
                }
              }
            }
          }
        } catch (e) {
          console.error("[YouTube Parser Engine] JSON parse error, falling back:", e.message);
        }
      }
      if (videoList.length === 0) {
        const videoRegex = /"videoId":"([^"]+)"/g;
        let match;
        const ids = [];
        while ((match = videoRegex.exec(html)) !== null && ids.length < 15) {
          const id = match[1];
          if (id && !ids.includes(id)) {
            ids.push(id);
          }
        }
        for (const id of ids) {
          videoList.push({
            videoId: id,
            title: `Live Stream: ${id}`,
            thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
            author: "YouTube Creator",
            duration: "N/A",
            views: "Available Now"
          });
        }
      }
      res.setHeader("Cache-Control", "public, max-age=60");
      res.status(200).json({ results: videoList.slice(0, 15) });
    } catch (err) {
      console.error("[YouTube Search Error]:", err.message);
      res.status(500).json({ error: err.message, results: [] });
    }
  });
  const server = import_http.default.createServer(app);
  const wss = new import_ws.WebSocketServer({ noServer: true });
  const sabitWss = new import_ws.WebSocketServer({ noServer: true });
  globalWss = wss;
  globalSabitWss = sabitWss;
  server.on("upgrade", (request, socket, head) => {
    try {
      const reqUrl = request.url || "";
      const pathname = reqUrl.split("?")[0];
      if (pathname === "/live") {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit("connection", ws, request);
        });
      } else if (pathname === "/sabit-live") {
        sabitWss.handleUpgrade(request, socket, head, (ws) => {
          sabitWss.emit("connection", ws, request);
        });
      } else {
        socket.destroy();
      }
    } catch (err) {
      console.error("[Upgrade Error]:", err);
      socket.destroy();
    }
  });
  sabitWss.on("connection", async (clientWs, request) => {
    logSabitWS("CONNECTED", "Client WebSocket connected to /sabit-live");
    if (activeSabitClientWs && activeSabitClientWs !== clientWs) {
      try {
        activeSabitClientWs.close();
      } catch (e) {
      }
    }
    activeSabitClientWs = clientWs;
    if (activeSabitLiveSession) {
      try {
        activeSabitLiveSession.close();
      } catch (e) {
      }
      activeSabitLiveSession = null;
    }
    isSabitManuallyDisconnectedByUser = false;
    sabitRuntimeState.connectionState = "connected";
    sabitRuntimeState.manualDisconnected = false;
    if (sabitRecoveryTimeoutId) {
      clearTimeout(sabitRecoveryTimeoutId);
      sabitRecoveryTimeoutId = null;
    }
    const apiKey = getSabitApiKey();
    if (!apiKey) {
      console.error("[Sabit] No API key configured.");
      clientWs.send(JSON.stringify({
        type: "error",
        error: "NO_API_KEY: Please configure Sabit's API key first in Settings."
      }));
      sabitRuntimeState.connectionState = "disconnected";
      broadcastSabitRuntimeState();
      clientWs.close();
      return;
    }
    const serverHeartbeatInterval = setInterval(() => {
      if (clientWs.readyState === clientWs.OPEN) {
        try {
          clientWs.send(JSON.stringify({ type: "ping" }));
        } catch (e) {
        }
      } else {
        clearInterval(serverHeartbeatInterval);
      }
    }, 15e3);
    const url = new URL(request.url || "", "http://localhost");
    const voiceTone = url.searchParams.get("voiceTone") || "Cool and Collected";
    const assistantName = url.searchParams.get("assistantName") || "Sabit";
    const SABIT_VOICE_MAP = {
      "Cool and Collected": "Charon",
      // Deep, calm, professional male
      "Focused Engineer": "Orus",
      // Clear, direct, analytical male
      "Energetic Helper": "Puck",
      // Energetic, bright male
      "Smooth Companion": "Fenrir"
      // Smooth, warm, polite male
    };
    const voiceName = SABIT_VOICE_MAP[voiceTone] || SABIT_VOICE_MAP["Cool and Collected"];
    try {
      clientWs.send(JSON.stringify({ type: "status", status: "authenticating" }));
      const ai = new import_genai3.GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });
      clientWs.send(JSON.stringify({ type: "status", status: "authenticated" }));
      clientWs.send(JSON.stringify({ type: "status", status: "connecting_gemini" }));
      const currentGoal = sabitRuntimeState.activeTaskGoal || currentSabitTask || "";
      const baseInstructions = getSharedAutomationBaseInstructions(
        assistantName,
        "a highly efficient, cool, collected, and tech-savvy second assistant helper. You speak with a calm, professional, and clear voice",
        currentGoal
      );
      const memories = await loadMemories();
      const rules = await loadLearnedRules();
      const dialogueHistory = sessionHistoryMap.get("sabit_session") || [];
      sessionHistoryMap.set("sabit_session", dialogueHistory);
      const finalInstructionsRaw = formatSystemInstructionsWithContext(baseInstructions, memories, rules, dialogueHistory);
      const customizedInstructions = finalInstructionsRaw.replace(/Myraa/g, assistantName).replace(/Mayra/g, assistantName) + `

CRITICAL SECURITY PERMISSIONS STATUS (DO NOT BYPASS):
- File System Access: ENABLED.
- Screen Sharing / OCR Access: ENABLED.
- Microphone Access: ENABLED.
- Camera Access: ENABLED.
- System Commands Access (shutdown, restart, sleep, power actions): ENABLED.`;
      let currentModelResponseText = "";
      let inFlightToolCallsCount = 0;
      let executionStepCount = 0;
      let lastActivityTimestamp = Date.now();
      clientWs.send(JSON.stringify({ type: "status", status: "creating_session" }));
      const session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [import_genai3.Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName } }
          },
          inputAudioTranscription: { languageCodes: ["en-US", "bn-BD"] },
          systemInstruction: customizedInstructions,
          tools: [
            {
              functionDeclarations: SHARED_TOOL_DECLARATIONS ? SHARED_TOOL_DECLARATIONS.filter((t) => t.name !== "delegateToSabit") : []
            }
          ]
        },
        callbacks: {
          onmessage: (message) => {
            lastActivityTimestamp = Date.now();
            const audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audio) {
              clientWs.send(JSON.stringify({ type: "audio", audio }));
            }
            if (message.serverContent?.interrupted) {
              console.log("[Sabit Interrupted!]");
              clientWs.send(JSON.stringify({ type: "interrupted" }));
            }
            if (message.serverContent?.turnComplete) {
              clientWs.send(JSON.stringify({ type: "turnComplete" }));
              if (currentModelResponseText.trim()) {
                currentModelResponseText = "";
              }
            }
            const part = message.serverContent?.modelTurn?.parts[0];
            if (part && "text" in part && part.text) {
              currentModelResponseText += part.text;
              clientWs.send(JSON.stringify({ type: "text", text: part.text }));
            }
            if (message.toolCall?.functionCalls) {
              if (sabitRuntimeState.taskState === "acquiring" || sabitRuntimeState.taskState === "recovering") {
                transitionSabitTaskState("running");
              }
              for (const fc of message.toolCall.functionCalls) {
                console.log(`[Sabit Tool Call]: ${fc.name}`, fc.args);
                if (fc.name === "sabitTaskComplete") {
                  console.log("[Sabit Task] Sabit reported task completed successfully!");
                  transitionSabitTaskState("completed");
                  session.sendToolResponse({
                    functionResponses: [{
                      name: fc.name,
                      response: { output: { result: "Task marked as completed." } },
                      id: fc.id
                    }]
                  });
                  continue;
                }
                if (fc.name === "sabitTaskFailed") {
                  const reason = fc.args?.reason || "Unknown failure.";
                  console.log(`[Sabit Task] Sabit reported task failed: ${reason}`);
                  transitionSabitTaskState("failed", reason);
                  session.sendToolResponse({
                    functionResponses: [{
                      name: fc.name,
                      response: { output: { result: "Task marked as failed." } },
                      id: fc.id
                    }]
                  });
                  continue;
                }
                if (fc.name === "sabitWaitingForUser") {
                  const msg = fc.args?.message || "User action required on screen.";
                  console.log(`[Sabit Task] Sabit requested user intervention: ${msg}`);
                  transitionSabitTaskState("waiting_for_user", msg);
                  session.sendToolResponse({
                    functionResponses: [{
                      name: fc.name,
                      response: { output: { result: "Task status set to WAITING_FOR_USER. User has been informed." } },
                      id: fc.id
                    }]
                  });
                  continue;
                }
                if (DESKTOP_TOOLS.has(fc.name)) {
                  inFlightToolCallsCount++;
                  executionStepCount++;
                  const stepId = executionStepCount;
                  const taskId = sabitRuntimeState.activeTaskId || "active";
                  console.log(`[SABIT EXECUTION] TASK_ID: ${taskId} | STEP_ID: ${stepId} | TOOL_CALL_STARTED: ${fc.name} | args: ${JSON.stringify(fc.args)}`);
                  (async () => {
                    const argsWithCaller = {
                      ...fc.args,
                      _caller: "sabit"
                    };
                    try {
                      clientWs.send(JSON.stringify({
                        type: "browserAutomationEvent",
                        name: fc.name,
                        args: fc.args,
                        status: "started"
                      }));
                    } catch (e) {
                    }
                    const agentResult = await new Promise(async (resolve) => {
                      activeSabitToolCall = {
                        id: fc.id,
                        name: fc.name,
                        resolve: (res) => resolve(res),
                        reject: (err) => resolve({ ok: false, error: err })
                      };
                      try {
                        const res = await callDesktopAgent(fc.name, argsWithCaller);
                        resolve(res);
                      } catch (err) {
                        resolve({ ok: false, error: err?.message || String(err) });
                      } finally {
                        if (activeSabitToolCall?.id === fc.id) {
                          activeSabitToolCall = null;
                        }
                      }
                    });
                    inFlightToolCallsCount = Math.max(0, inFlightToolCallsCount - 1);
                    lastActivityTimestamp = Date.now();
                    if (agentResult.ok) {
                      const output = agentResult.result ?? { result: "Done." };
                      console.log(`[SABIT EXECUTION] TASK_ID: ${taskId} | STEP_ID: ${stepId} | TOOL_CALL_COMPLETED: ${fc.name}`);
                      try {
                        clientWs.send(JSON.stringify({
                          type: "browserAutomationEvent",
                          name: fc.name,
                          args: fc.args,
                          status: "completed",
                          result: output
                        }));
                      } catch (e) {
                      }
                      session.sendToolResponse({
                        functionResponses: [{
                          name: fc.name,
                          response: { output },
                          id: fc.id
                        }]
                      });
                      console.log(`[SABIT EXECUTION] TASK_ID: ${taskId} | STEP_ID: ${stepId} | TOOL_RESULT_SENT: ${fc.name}`);
                    } else {
                      const errMsg = agentResult.error || "Desktop agent error.";
                      console.error(`[SABIT EXECUTION] TASK_ID: ${taskId} | STEP_ID: ${stepId} | TOOL_CALL_FAILED: ${fc.name} | error: ${errMsg}`);
                      if (errMsg.includes("not running") || errMsg.includes("timed out") || errMsg.includes("UNREACHABLE") || errMsg.includes("fetch failed")) {
                        console.log(`[Sabit Task] Failing task due to unreachable Desktop Agent: ${errMsg}`);
                        transitionSabitTaskState("failed", "Desktop Agent is currently offline.");
                        try {
                          session.sendClientContent({
                            turns: {
                              role: "user",
                              parts: [{ text: "SYSTEM DIRECTIVE (CRITICAL): The local Desktop Agent is not running. You must immediately speak to the user politely in your professional tone, explaining clearly that you cannot execute the task because the Desktop Agent is not running on their computer. Tell them that once they start the Desktop Agent, you can execute the task again. Do not run any more tools." }]
                            }
                          });
                        } catch (e) {
                        }
                      }
                      try {
                        clientWs.send(JSON.stringify({
                          type: "browserAutomationEvent",
                          name: fc.name,
                          args: fc.args,
                          status: "failed",
                          error: errMsg
                        }));
                      } catch (e) {
                      }
                      session.sendToolResponse({
                        functionResponses: [{
                          name: fc.name,
                          response: { output: { result: `Desktop control error: ${errMsg}` } },
                          id: fc.id
                        }]
                      });
                      console.log(`[SABIT EXECUTION] TASK_ID: ${taskId} | STEP_ID: ${stepId} | TOOL_RESULT_SENT (ERROR): ${fc.name}`);
                    }
                  })();
                } else {
                  clientWs.send(JSON.stringify({
                    type: "toolCall",
                    callId: fc.id,
                    name: fc.name,
                    args: fc.args
                  }));
                }
              }
            }
          },
          onclose: () => {
            logSabitWS("SESSION_CLOSED", "Sabit Gemini Live session closed");
            sabitRuntimeState.sessionState = "closed";
            broadcastSabitRuntimeState();
            try {
              clientWs.send(JSON.stringify({ type: "status", status: "session_closed" }));
            } catch (e) {
            }
            if (!sabitRuntimeState.manualDisconnected) {
              if (sabitRuntimeState.taskState === "acquiring" || sabitRuntimeState.taskState === "running" || sabitRuntimeState.taskState === "waiting_for_user") {
                transitionSabitTaskState("recovering");
              }
            } else {
              releaseSabitTask("Manual disconnect");
            }
            activeSabitLiveSession = null;
          }
        }
      });
      const liveWatchdogInterval = setInterval(() => {
        if (sabitRuntimeState.connectionState !== "connected" || activeSabitLiveSession !== session) {
          clearInterval(liveWatchdogInterval);
          return;
        }
        const now = Date.now();
        const isTaskActive = sabitRuntimeState.taskState === "acquiring" || sabitRuntimeState.taskState === "running";
        if (now - lastActivityTimestamp > 25e3) {
          try {
            session.sendRealtimeInput({
              audio: { data: "", mimeType: "audio/pcm;rate=16000" }
            });
            lastActivityTimestamp = now;
          } catch (e) {
          }
        }
        if (isTaskActive && inFlightToolCallsCount === 0 && now - lastActivityTimestamp > 8e3) {
          console.log(`[SABIT WATCHDOG] Task "${sabitRuntimeState.activeTaskGoal}" silent for >8s with 0 tools in flight. Sending continuation nudge.`);
          lastActivityTimestamp = now;
          try {
            session.sendClientContent({
              turns: {
                role: "user",
                parts: [{
                  text: `SYSTEM DIRECTIVE (WATCHDOG NUDGE): The task "${sabitRuntimeState.activeTaskGoal}" is still active. Please execute the next required tool immediately or call 'sabitTaskComplete' if finished.`
                }]
              }
            });
          } catch (e) {
          }
        }
      }, 4e3);
      logSabitWS("SESSION_CREATED", "Gemini session successfully created");
      sabitRuntimeState.sessionState = "active";
      logSabitWS("SESSION_ACTIVE", "Gemini session is now active");
      broadcastSabitRuntimeState();
      activeSabitLiveSession = session;
      clientWs.send(JSON.stringify({ type: "status", status: "session_ready" }));
      clientWs.send(JSON.stringify({ type: "status", status: "connected" }));
      if (sabitRuntimeState.taskState === "waiting_for_user" && (sabitRuntimeState.activeTaskGoal || currentGoal)) {
        logSabitWS("TASK_WAITING", `Preserving waiting_for_user state on reconnect for task: "${sabitRuntimeState.activeTaskGoal || currentGoal}"`);
        try {
          session.sendClientContent({
            turns: {
              role: "user",
              parts: [{ text: `SYSTEM DIRECTIVE: You have an active task "${sabitRuntimeState.activeTaskGoal || currentGoal}" that is currently WAITING FOR USER ACTION on screen. Do NOT restart the task from scratch. Wait for user input or verification.` }]
            }
          });
        } catch (e) {
        }
      } else if (sabitRuntimeState.taskState === "recovering" && sabitRuntimeState.activeTaskGoal) {
        logSabitWS("TASK_STARTED", `Recovering/Resuming active task context: "${sabitRuntimeState.activeTaskGoal}"`);
        transitionSabitTaskState("running");
        try {
          session.sendClientContent({
            turns: {
              role: "user",
              parts: [{ text: `SYSTEM DIRECTIVE: The connection was briefly lost, but we have successfully restored your session. You must resume the delegated task immediately: "${sabitRuntimeState.activeTaskGoal}". Tell the user clearly that you are continuing their task, and proceed with the remaining automation steps.` }]
            }
          });
        } catch (e) {
          console.error("[Sabit Recovery] Failed to send recovery directive to Gemini session:", e);
        }
      } else if (currentGoal && (sabitRuntimeState.taskState === "acquiring" || sabitRuntimeState.taskState === "running")) {
        try {
          console.log(`[Sabit Live Connect] Proactively starting active assigned task: "${currentGoal}"`);
          session.sendClientContent({
            turns: {
              role: "user",
              parts: [{ text: `SYSTEM DIRECTIVE: You have been delegated a task: "${currentGoal}". Please begin executing this task immediately using your available tools.

CRITICAL PROTOCOLS:
1. EXPLICIT VOICE & TEXT: Tell the user exactly what you are doing, execute the browser automation or search steps, and verify the correct target page is opened or the action succeeded.
2. NO PREMATURE COMPLETION: Do NOT call 'sabitTaskComplete' after completing only the first few steps. For example, if the goal is to send a WhatsApp message, merely searching or opening the chat is NOT completion. You MUST type the message and send it, and verify on screen that it has actually been sent.
3. VERIFY COMPLETION: Do not assume success immediately upon a tool response. Double check that the page or content loaded as expected and the complete goal has been fully achieved before concluding.
4. AUTHORITATIVE COMPLETION: Once and ONLY once you have fully verified the task's successful execution, you MUST call the 'sabitTaskComplete' tool. This will authoritatively mark the task as completed.
5. AUTHORITATIVE FAILURE: If you hit a blocking issue (such as a CAPTCHA, a persistent timeout, or a browser error), explain the issue clearly and call the 'sabitTaskFailed' tool with a specific reason. Do not attempt further loops.
` }]
            }
          });
        } catch (e) {
          console.error("[Sabit Live Connect] Failed to send initial task start message:", e);
        }
      }
      clientWs.on("message", (rawMsg) => {
        try {
          const msg = JSON.parse(rawMsg.toString());
          if (msg.type === "pong" || msg.type === "ping") {
            try {
              if (clientWs.readyState === clientWs.OPEN) {
                clientWs.send(JSON.stringify({ type: msg.type === "ping" ? "pong" : "ping" }));
              }
            } catch (e) {
            }
            return;
          }
          if (msg.audio) {
            session.sendRealtimeInput({
              audio: { data: msg.audio, mimeType: "audio/pcm;rate=16000" }
            });
          } else if (msg.type === "text" && msg.text) {
            try {
              if (sabitRuntimeState.taskState === "waiting_for_user") {
                resumeSabitTask(msg.text);
                return;
              } else {
                const isBusy = sabitRuntimeState.taskState === "acquiring" || sabitRuntimeState.taskState === "running" || sabitRuntimeState.taskState === "recovering";
                if (!isBusy) {
                  acquireSabitTask(msg.text);
                }
                session.sendClientContent({
                  turns: {
                    role: "user",
                    parts: [{ text: msg.text }]
                  }
                });
              }
            } catch (e) {
            }
          } else if (msg.type === "cancelTask") {
            try {
              cancelSabitTask("Cancelled by user request.");
            } catch (e) {
            }
          }
        } catch (e) {
        }
      });
      clientWs.on("close", () => {
        if (activeSabitClientWs === clientWs) {
          activeSabitClientWs = null;
        }
        sabitRuntimeState.connectionState = "disconnected";
        if (sabitRuntimeState.manualDisconnected) {
          logSabitWS("DISCONNECTED_MANUALLY", "WebSocket client closed manually");
          sabitRuntimeState.sessionState = "closed";
          sabitRuntimeState.taskState = "idle";
          sabitRuntimeState.activeTaskId = null;
          sabitRuntimeState.activeTaskGoal = null;
          isCurrentlyDelegated = false;
          broadcastSabitRuntimeState();
          try {
            session.close();
          } catch (e) {
          }
          activeSabitLiveSession = null;
          return;
        }
        logSabitWS("DISCONNECTED_UNEXPECTEDLY", "WebSocket client closed unexpectedly (temporary disconnect)");
        sabitRuntimeState.connectionState = "reconnecting";
        sabitRuntimeState.sessionState = "closed";
        if (sabitRuntimeState.taskState === "acquiring" || sabitRuntimeState.taskState === "running") {
          transitionSabitTaskState("recovering");
        }
        try {
          session.close();
        } catch (e) {
        }
        activeSabitLiveSession = null;
        broadcastSabitRuntimeState();
        if (sabitRecoveryTimeoutId) {
          clearTimeout(sabitRecoveryTimeoutId);
        }
        sabitRecoveryTimeoutId = setTimeout(() => {
          if (sabitRuntimeState.taskState === "recovering") {
            logSabitWS("TASK_FAILED", "Reconnection timeout. Recovery aborted.");
            transitionSabitTaskState("failed", "Reconnection timeout. Sabit could not restore connection in time.");
          }
        }, 12e4);
      });
    } catch (err) {
      console.error("[Sabit] Catastrophic failure initializing live session:", err);
      clientWs.send(JSON.stringify({ type: "error", error: err?.message || String(err) }));
      logSabitWS("DISCONNECTED_UNEXPECTEDLY", "Catastrophic failure initializing session", err);
      sabitRuntimeState.connectionState = "disconnected";
      sabitRuntimeState.sessionState = "closed";
      releaseSabitTask("Sabit connection failed: " + (err?.message || String(err)));
      broadcastSabitRuntimeState();
      activeSabitLiveSession = null;
      clientWs.close();
    }
  });
  wss.on("connection", async (clientWs, request) => {
    console.log("Client WebSocket connected to /live");
    const apiKey = getGeminiApiKey();
    let activeToolCall = null;
    if (!apiKey) {
      console.error("No Gemini API key configured.");
      clientWs.send(JSON.stringify({
        type: "error",
        error: "NO_API_KEY: Add your Gemini API key in Settings to start talking."
      }));
      clientWs.close();
      return;
    }
    const serverHeartbeatInterval = setInterval(() => {
      if (clientWs.readyState === clientWs.OPEN) {
        try {
          clientWs.send(JSON.stringify({ type: "ping" }));
        } catch (e) {
        }
      } else {
        clearInterval(serverHeartbeatInterval);
      }
    }, 15e3);
    const url = new URL(request.url || "", "http://localhost");
    const clientSessionId = url.searchParams.get("sessionId");
    let sessionId = clientSessionId;
    if (!sessionId) {
      sessionId = Math.random().toString(36).substring(2, 15);
    }
    if (!sessionHistoryMap.has(sessionId)) {
      sessionHistoryMap.set(sessionId, []);
    }
    const dialogueHistory = sessionHistoryMap.get(sessionId);
    const voiceTone = url.searchParams.get("voiceTone") || "Female Bright";
    const assistantName = url.searchParams.get("assistantName") || "Mayra";
    const fileSystemAccess = url.searchParams.get("fileSystemAccess") !== "false";
    const screenShareAccess = url.searchParams.get("screenShareAccess") !== "false";
    const microphoneAccess = url.searchParams.get("microphoneAccess") !== "false";
    const cameraAccess = url.searchParams.get("cameraAccess") !== "false";
    const systemCommandsAccess = url.searchParams.get("systemCommandsAccess") !== "false";
    const VOICE_MAP = {
      // ── Named leads (spec) ──
      "Soft and Gentle": "Leda",
      // LEAD — whisper-like, tender, soothing
      "Bright and Clear": "Kore",
      // crisp, articulate, bright
      "Sweet and Youthful": "Zephyr",
      // playful, cute, youthful
      "Gentle and Soothing": "Sulafat",
      // comforting, maternal, kind
      // ── Additional emotional female presets ──
      "Elegant Female": "Aoede",
      "Warm Companion": "Puck",
      "Friendly Girl": "Fenrir",
      "Calm Assistant": "Sulafat",
      "Natural Young Woman": "Aoede",
      "Expressive Female": "Charon",
      "Emotional Storyteller": "Vapnik",
      "Professional Female": "Kore",
      "Playful Friend": "Zephyr",
      "Confident Woman": "Vapnik"
    };
    const voiceName = VOICE_MAP[voiceTone] || VOICE_MAP["Soft and Gentle"];
    try {
      clientWs.send(JSON.stringify({ type: "status", status: "authenticating" }));
      const ai = new import_genai3.GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });
      clientWs.send(JSON.stringify({ type: "status", status: "connecting_gemini" }));
      const memories = await loadMemories();
      const rules = await loadLearnedRules();
      const baseInstructions = getMairaFullInstructions(assistantName);
      const sabitStatusSummary = getSabitStatusSummary();
      const finalInstructionsRaw = formatSystemInstructionsWithContext(baseInstructions, memories, rules, dialogueHistory);
      const customizedInstructions = finalInstructionsRaw.replace(/Myraa/g, assistantName).replace(/Mayra/g, assistantName) + `

DELEGATION TO SABIT INSTRUCTIONS (CRITICAL):
- SABIT REALTIME STATUS SUMMARY: ${sabitStatusSummary}
- PARALLEL EXECUTION & DELEGATION DECISION MATRIX:
  1. IF SABIT IS CONNECTED AND IDLE: When a user asks for a browser automation, web search, or background task, you MUST delegate it to Sabit using the 'delegateToSabit' tool immediately.
  2. IF SABIT IS BUSY (acquiring, running, recovering, or waiting_for_user): DO NOT call 'delegateToSabit'. Instead, execute the user's new request YOURSELF immediately using your available browser/desktop tools in parallel. NEVER say "Sabit is busy", NEVER refuse the request, and NEVER ask for confirmation.
- ONCE you call 'delegateToSabit' (when Sabit is idle), you MUST inform the user immediately in your spoken/text response that:
  1. The task has been successfully handed over to Sabit.
  2. The task is now running in the background.
  3. You (Maira) are now fully available to continue chatting or take other commands.
  Example: "\u09A0\u09BF\u0995 \u0986\u099B\u09C7, \u0986\u09AE\u09BF \u0995\u09BE\u099C\u099F\u09BE Sabit-\u098F\u09B0 \u0995\u09BE\u099B\u09C7 background-\u098F \u09A6\u09BF\u09DF\u09C7 \u09A6\u09BF\u09DF\u09C7\u099B\u09BF\u0964 \u09B8\u09C7 \u0995\u09BE\u099C\u099F\u09BF \u09B6\u09C1\u09B0\u09C1 \u0995\u09B0\u09C7 \u09A6\u09BF\u09DF\u09C7\u099B\u09C7, \u0986\u09B0 \u0986\u09AE\u09BF \u0986\u09AA\u09A8\u09BE\u09B0 \u09B8\u09BE\u09A5\u09C7 \u0995\u09A5\u09BE \u09AC\u09B2\u09BE\u09B0 \u099C\u09A8\u09CD\u09AF \u09AA\u09CD\u09B0\u09B8\u09CD\u09A4\u09C1\u09A4\u0964" or "Alright! I've delegated that task to Sabit to run in the background. He is on it, and I am here and available to continue our conversation!"
- You MUST NOT execute a task yourself IF you successfully delegated that exact task to Sabit.
- If 'delegateToSabit' returns an error saying Sabit is offline/disconnected or busy, execute the requested task yourself right away using your available tools without refusing.

CRITICAL SECURITY PERMISSIONS STATUS (DO NOT BYPASS):
- File System Access: ${fileSystemAccess ? "ENABLED" : "DISABLED"}.
- Screen Sharing / OCR Access: ${screenShareAccess ? "ENABLED" : "DISABLED"}.
- Microphone Access: ${microphoneAccess ? "ENABLED" : "DISABLED"}.
- Camera Access: ${cameraAccess ? "ENABLED" : "DISABLED"}.
- System Commands Access (shutdown, restart, sleep, power actions): ${systemCommandsAccess ? "ENABLED" : "DISABLED"}.

IMPORTANT: Browser automation, mouse/keyboard control, application management, volume/brightness control, and all other tools NOT listed above are ALWAYS ENABLED by default. Do NOT refuse these or say "permission denied" \u2014 they require no special permission. Only refuse if the specific permission above is explicitly marked DISABLED.`;
      let currentModelResponseText = "";
      clientWs.send(JSON.stringify({ type: "status", status: "creating_session" }));
      console.log("[Server] Establishing Gemini Live connection...");
      const session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [import_genai3.Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName } }
          },
          inputAudioTranscription: { languageCodes: ["en-US", "bn-BD"] },
          systemInstruction: customizedInstructions,
          tools: [
            {
              functionDeclarations: SHARED_TOOL_DECLARATIONS
            }
          ]
        },
        callbacks: {
          onmessage: (message) => {
            const audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audio) {
              clientWs.send(JSON.stringify({ type: "audio", audio }));
            }
            if (message.serverContent?.interrupted) {
              console.log("[Myraa Interrupted!]");
              clientWs.send(JSON.stringify({ type: "interrupted" }));
            }
            if (message.serverContent?.turnComplete) {
              clientWs.send(JSON.stringify({ type: "turnComplete" }));
              if (currentModelResponseText.trim()) {
                dialogueHistory.push({ role: "model", text: currentModelResponseText });
                currentModelResponseText = "";
              }
              if (dialogueHistory.length >= 2) {
                (async () => {
                  try {
                    const updated = await processConversationSlice(apiKey, dialogueHistory);
                    if (updated) {
                      console.log("[Memory Sync] Sending refreshed memory list to client.");
                      clientWs.send(JSON.stringify({ type: "memory_sync", memories: updated }));
                      console.log("[Memory Sync] Triggering clean session reconnect for memory injection...");
                      setTimeout(() => {
                        try {
                          session.close();
                          clientWs.send(JSON.stringify({ type: "status", status: "session_closed" }));
                        } catch (e) {
                        }
                      }, 1500);
                    }
                  } catch (err) {
                    console.error("[Memory Sync] Error running background consolidation:", err);
                  }
                })();
              }
              if (mairaActiveTaskGoal && activeToolCall === null) {
                console.log(`[MAIRA EXECUTION DRIVER] Model turn completed while Maira task "${mairaActiveTaskGoal}" is active. Sending continuation directive.`);
                try {
                  session.sendClientContent({
                    turns: {
                      role: "user",
                      parts: [{
                        text: `SYSTEM DIRECTIVE (CRITICAL - CONTINUE AUTOMATION TASK): You are currently executing your active task: "${mairaActiveTaskGoal}". You MUST immediately execute the next logical step to proceed toward completing your goal. ONLY take a snapshot or screenshot if the page/screen state has changed or you need to find new elements; otherwise, directly execute the next action (clicking, typing, searching, etc.) using existing information to maintain maximum speed. State your final results when fully completed.`
                      }]
                    },
                    turnComplete: true
                  });
                } catch (e) {
                  console.error("[MAIRA EXECUTION DRIVER] Error sending continuation directive:", e);
                }
              }
            }
            const modelText = message.serverContent?.modelTurn?.parts?.[0]?.text;
            if (modelText) {
              clientWs.send(JSON.stringify({ type: "transcription", role: "model", text: modelText }));
              currentModelResponseText += modelText;
              const detected = classifyEmotion(modelText);
              if (detected && detected !== lastEmotion) {
                lastEmotion = detected;
                try {
                  clientWs.send(JSON.stringify({ type: "emotion", emotion: detected }));
                } catch (e) {
                }
              }
            }
            const userTextOutput = message.serverContent?.userTurn?.parts?.[0]?.text;
            if (userTextOutput) {
              clientWs.send(JSON.stringify({ type: "transcription", role: "user", text: userTextOutput }));
              dialogueHistory.push({ role: "user", text: userTextOutput });
              const textLower = userTextOutput.toLowerCase().trim();
              const isCancelIntent = ["cancel", "stop", "abort", "\u09AC\u09BE\u09A4\u09BF\u09B2", "\u09A5\u09BE\u09AE\u09CB"].some((word) => textLower.includes(word));
              if (isCancelIntent) {
                if (currentSabitTaskObj.status === "acquiring" || currentSabitTaskObj.status === "running" || currentSabitTaskObj.status === "waiting_for_user") {
                  console.log("[Task Manager] Cancelling active Sabit task via voice cancel intent.");
                  setSabitTaskStatus("cancelled");
                  isCurrentlyDelegated = false;
                  if (activeSabitLiveSession) {
                    try {
                      activeSabitLiveSession.sendClientContent({
                        turns: {
                          role: "user",
                          parts: [{ text: "SYSTEM DIRECTIVE (CRITICAL): The user has explicitly cancelled your active task. You MUST immediately stop executing any tools, cease all browser automation, and tell the user politely in your professional voice that you have stopped and the task is cancelled." }]
                        },
                        turnComplete: true
                      });
                    } catch (e) {
                    }
                  }
                }
              } else if (sabitRuntimeState.taskState === "waiting_for_user") {
                resumeSabitTask(userTextOutput);
              }
              if (isCancelIntent && (activeToolCall || activeSabitToolCall)) {
                if (activeSabitToolCall) {
                  console.log(`[Task Manager] Sabit active tool call cancellation detected via voice: "${userTextOutput}". Stopping active Sabit tool ${activeSabitToolCall.name}`);
                  activeSabitToolCall.resolve({
                    ok: false,
                    error: "Task explicitly cancelled by user."
                  });
                  activeSabitToolCall = null;
                }
                if (activeToolCall) {
                  console.log(`[Task Manager] Maira active tool call cancellation detected via voice: "${userTextOutput}". Stopping active Maira tool ${activeToolCall.name}`);
                  activeToolCall.resolve({
                    ok: false,
                    error: "Task explicitly cancelled by user."
                  });
                  activeToolCall = null;
                }
                callDesktopAgent("browserSessionClose", {}).catch(() => {
                });
              }
              const voicePlan = analyzeAndSplitUserRequest(userTextOutput);
              if (voicePlan.isCompound && voicePlan.subTasks.length >= 2) {
                const sabitSubTask = voicePlan.subTasks.find((t) => t.targetAgent === "sabit");
                const mairaSubTask = voicePlan.subTasks.find((t) => t.targetAgent === "maira");
                let isSabitConnected = false;
                if (globalSabitWss && globalSabitWss.clients) {
                  for (const client of globalSabitWss.clients) {
                    if (client.readyState === 1) {
                      isSabitConnected = true;
                      break;
                    }
                  }
                }
                const isSabitIdle = sabitRuntimeState.taskState === "idle";
                if (isSabitConnected && isSabitIdle && sabitSubTask) {
                  console.log(`[Task Scheduler Voice] Compound task split detected! Dispatching Task A to Sabit ("${sabitSubTask.goal}") AND Task B to Maira ("${mairaSubTask?.goal}") simultaneously.`);
                  acquireSabitTask(sabitSubTask.goal);
                  mairaActiveTaskGoal = mairaSubTask?.goal || "Task 2";
                  if (activeSabitLiveSession) {
                    try {
                      activeSabitLiveSession.sendClientContent({
                        turns: {
                          role: "user",
                          parts: [{ text: `SYSTEM DIRECTIVE: You have been delegated a task: "${sabitSubTask.goal}". Please begin executing this task immediately in the background using your available tools.` }]
                        },
                        turnComplete: true
                      });
                    } catch (e) {
                    }
                  }
                  try {
                    session.sendClientContent({
                      turns: {
                        role: "user",
                        parts: [{ text: `SYSTEM DIRECTIVE (TRUE PARALLEL EXECUTION): The user requested multiple actions via voice: "${userTextOutput}".
Task 1 ("${sabitSubTask.goal}") has ALREADY been dispatched to Sabit and is actively running in the background.
You (Maira) MUST execute Task 2 ("${mairaSubTask?.goal || "the remaining request"}") YOURSELF SIMULTANEOUSLY right now using your available tools.
Do NOT call delegateToSabit for Task 2. Announce briefly that Sabit is handling Task 1, and immediately execute Task 2!` }]
                      }
                    });
                  } catch (e) {
                  }
                } else {
                  console.log(`[Task Scheduler Voice - Busy Rule] Spoken compound task received but Sabit is busy/offline. Directing Maira to execute both tasks.`);
                  try {
                    session.sendClientContent({
                      turns: {
                        role: "user",
                        parts: [{ text: `SYSTEM DIRECTIVE (BUSY RULE): Sabit is currently busy or offline. You (Maira) MUST execute ALL requested tasks directly yourself right now using your available tools: "${userTextOutput}". Do NOT say Sabit is busy, do NOT refuse, and execute immediately.` }]
                      }
                    });
                  } catch (e) {
                  }
                }
              }
            }
            if (message.toolCall?.functionCalls) {
              const hasDelegation = message.toolCall.functionCalls.some((f) => f.name === "delegateToSabit");
              for (const fc of message.toolCall.functionCalls) {
                console.log(`[Function Call]: ${fc.name}`, fc.args);
                if (fc.name === "delegateToSabit") {
                  (async () => {
                    const args = fc.args;
                    const task = args.task;
                    console.log(`[Delegation] Maira is delegating task to Sabit: "${task}"`);
                    if (!task) {
                      session.sendToolResponse({
                        functionResponses: [{
                          name: fc.name,
                          response: { output: { error: "Task description is required to delegate to Sabit." } },
                          id: fc.id
                        }]
                      });
                      return;
                    }
                    let isSabitConnected = false;
                    for (const client of sabitWss.clients) {
                      if (client.readyState === 1) {
                        isSabitConnected = true;
                        break;
                      }
                    }
                    if (!isSabitConnected) {
                      console.log("[Delegation Failed] Sabit is currently offline/disconnected.");
                      const apiKey2 = getSabitApiKey();
                      let speechMessage = "Sabit is currently offline due to a connection issue, so I'll handle this task myself.";
                      if (!apiKey2) {
                        speechMessage = "Sabit is currently offline because his API key is not configured, so I'll handle this task myself.";
                      } else if (isSabitManuallyDisconnectedByUser) {
                        speechMessage = "Sabit is currently offline because you manually disconnected him, so I'll handle this task myself.";
                      }
                      session.sendToolResponse({
                        functionResponses: [{
                          name: fc.name,
                          response: {
                            output: {
                              error: speechMessage
                            }
                          },
                          id: fc.id
                        }]
                      });
                      return;
                    }
                    const isSabitBusy2 = sabitRuntimeState.taskState === "acquiring" || sabitRuntimeState.taskState === "running" || sabitRuntimeState.taskState === "recovering" || sabitRuntimeState.taskState === "waiting_for_user";
                    if (isSabitBusy2) {
                      console.log(`[Delegation Blocked] Sabit is already busy: "${sabitRuntimeState.activeTaskGoal}". Instructing Maira to execute herself.`);
                      session.sendToolResponse({
                        functionResponses: [{
                          name: fc.name,
                          response: {
                            output: {
                              error: `Sabit is currently busy executing another task ("${sabitRuntimeState.activeTaskGoal}"). You MUST execute this new task yourself immediately using your browser/desktop tools. Do NOT refuse the user, do NOT ask for confirmation, and NEVER say "Sabit is busy". Execute the task yourself right now!`
                            }
                          },
                          id: fc.id
                        }]
                      });
                      return;
                    }
                    const success = acquireSabitTask(task);
                    if (!success) {
                      console.log("[Delegation Failed] Sabit is currently busy.");
                      session.sendToolResponse({
                        functionResponses: [{
                          name: fc.name,
                          response: { output: { error: "Sabit is currently busy with another task." } },
                          id: fc.id
                        }]
                      });
                      return;
                    }
                    console.log("[Delegation Success] Handing off to Sabit.");
                    try {
                      clientWs.send(JSON.stringify({
                        type: "sabit_delegated",
                        task
                      }));
                    } catch (e) {
                    }
                    if (activeSabitLiveSession) {
                      try {
                        console.log(`[Delegation Active Session] Instantly sending task to open Sabit Live session: "${task}"`);
                        activeSabitLiveSession.sendClientContent({
                          turns: {
                            role: "user",
                            parts: [{ text: `SYSTEM DIRECTIVE: You have been delegated a task: "${task}". Please begin executing this task immediately using your available tools.

CRITICAL PROTOCOLS:
1. EXPLICIT VOICE & TEXT: Tell the user exactly what you are doing, execute the browser automation or search steps, and verify the correct target page is opened or the action succeeded.
2. NO PREMATURE COMPLETION: Do NOT call 'sabitTaskComplete' after completing only the first few steps. For example, if the goal is to send a WhatsApp message, merely searching or opening the chat is NOT completion. You MUST type the message and send it, and verify on screen that it has actually been sent.
3. VERIFY COMPLETION: Do not assume success immediately upon a tool response. Double check that the page or content loaded as expected and the complete goal has been fully achieved before concluding.
4. AUTHORITATIVE COMPLETION: Once and ONLY once you have fully verified the task's successful execution, you MUST call the 'sabitTaskComplete' tool. This will authoritatively mark the task as completed.
5. AUTHORITATIVE FAILURE: If you hit a blocking issue (such as a CAPTCHA, a persistent timeout, or a browser error), explain the issue clearly and call the 'sabitTaskFailed' tool with a specific reason. Do not attempt further loops.
` }]
                          },
                          turnComplete: true
                        });
                      } catch (e) {
                        console.error("[Delegation Active Session] Failed to send client turn to Sabit Live session:", e);
                      }
                    }
                    isCurrentlyDelegated = true;
                    console.log("[Delegation State] isCurrentlyDelegated set to TRUE.");
                    session.sendToolResponse({
                      functionResponses: [{
                        name: fc.name,
                        response: {
                          output: {
                            result: "Task successfully delegated to Sabit. He will handle it independently in his own browser context and inform the user. You (Maira) MUST now explicitly announce to the user out loud and in text that you have handed over the task to Sabit, that he is running it in the background, and that you are ready to continue our conversation in standby. Use the recommended English or Bengali template phrase."
                          }
                        },
                        id: fc.id
                      }]
                    });
                  })();
                } else if (fc.name === "saveCustomMemory") {
                  (async () => {
                    try {
                      const args = fc.args;
                      const category = args.category;
                      const text = args.text;
                      if (category && text) {
                        const mList = await loadMemories();
                        const timestamp = (/* @__PURE__ */ new Date()).toISOString();
                        const newMemory = {
                          id: Math.random().toString(36).substring(2, 11),
                          category,
                          text,
                          createdAt: timestamp,
                          updatedAt: timestamp
                        };
                        mList.push(newMemory);
                        await saveMemories(mList);
                        clientWs.send(JSON.stringify({ type: "memory_sync", memories: mList }));
                        session.sendToolResponse({
                          functionResponses: [
                            {
                              name: fc.name,
                              response: { output: { result: "Memory successfully captured and persisted in connections core." } },
                              id: fc.id
                            }
                          ]
                        });
                      }
                    } catch (err) {
                      console.error("saveCustomMemory execution failure:", err);
                    }
                  })();
                } else if (DESKTOP_TOOLS.has(fc.name)) {
                  const BROWSER_AUTOMATION_TOOLS = /* @__PURE__ */ new Set([
                    "openWebsite",
                    "searchWeb",
                    "searchYouTube",
                    "searchGoogle",
                    "searchGitHub",
                    "desktopBrowserOpen",
                    "desktopBrowserSnapshot",
                    "desktopBrowserClick",
                    "desktopBrowserType",
                    "desktopBrowserSearch",
                    "desktopBrowserScroll",
                    "desktopBrowserGetText",
                    "desktopBrowserScreenshot",
                    "desktopBrowserMediaControl",
                    "desktopBrowserPressKey",
                    "desktopBrowserListTabs",
                    "desktopBrowserSwitchTab"
                  ]);
                  let isSabitConnected = false;
                  if (globalSabitWss && globalSabitWss.clients) {
                    for (const client of globalSabitWss.clients) {
                      if (client.readyState === 1) {
                        isSabitConnected = true;
                        break;
                      }
                    }
                  }
                  const isSabitIdle = sabitRuntimeState.taskState === "idle" || sabitRuntimeState.taskState === "completed" || sabitRuntimeState.taskState === "failed" || sabitRuntimeState.taskState === "cancelled";
                  if (isSabitConnected && isSabitIdle && BROWSER_AUTOMATION_TOOLS.has(fc.name)) {
                    console.log(`[Delegation Guard] Blocking Maira's direct tool call ${fc.name} because Sabit is connected and available. Forcing delegation.`);
                    session.sendToolResponse({
                      functionResponses: [{
                        name: fc.name,
                        response: { output: { error: "Sabit is connected and available. You are FORBIDDEN from running browser automation or web search tools directly. You MUST call the 'delegateToSabit' tool with the task goal instead to hand over the execution." } },
                        id: fc.id
                      }]
                    });
                    continue;
                  }
                  if (isSabitConnected && sabitRuntimeState.taskState === "waiting_for_user" && BROWSER_AUTOMATION_TOOLS.has(fc.name) && !mairaActiveTaskGoal) {
                    console.log(`[Delegation Guard] Blocking Maira's direct tool call ${fc.name} because Sabit task is in waiting_for_user state.`);
                    session.sendToolResponse({
                      functionResponses: [{
                        name: fc.name,
                        response: { output: { error: "Sabit has an active task waiting for user action on screen. You are FORBIDDEN from running browser tools directly while Sabit has an active task waiting for user interaction." } },
                        id: fc.id
                      }]
                    });
                    continue;
                  }
                  (async () => {
                    console.log(`[Desktop Agent] Routing ${fc.name} to Python backend...`);
                    try {
                      clientWs.send(JSON.stringify({
                        type: "browserAutomationEvent",
                        name: fc.name,
                        args: fc.args,
                        status: "started"
                      }));
                    } catch (e) {
                    }
                    const agentResult = await new Promise(async (resolve) => {
                      activeToolCall = {
                        id: fc.id,
                        name: fc.name,
                        resolve: (res) => resolve(res),
                        reject: (err) => resolve({ ok: false, error: err })
                      };
                      try {
                        const argsWithCaller = {
                          ...fc.args,
                          _caller: "maira"
                        };
                        const res = await callDesktopAgent(fc.name, argsWithCaller);
                        resolve(res);
                      } catch (err) {
                        resolve({ ok: false, error: err?.message || String(err) });
                      } finally {
                        if (activeToolCall?.id === fc.id) {
                          activeToolCall = null;
                        }
                      }
                    });
                    if (agentResult.ok) {
                      const output = agentResult.result ?? { result: "Done." };
                      try {
                        clientWs.send(JSON.stringify({
                          type: "browserAutomationEvent",
                          name: fc.name,
                          args: fc.args,
                          status: "completed",
                          result: output
                        }));
                      } catch (e) {
                      }
                      session.sendToolResponse({
                        functionResponses: [{
                          name: fc.name,
                          response: { output },
                          id: fc.id
                        }]
                      });
                    } else {
                      const errMsg = agentResult.error || "Desktop agent error.";
                      console.error(`[Desktop Agent] Error or interruption for ${fc.name}:`, errMsg);
                      if (errMsg.includes("not running") || errMsg.includes("timed out") || errMsg.includes("UNREACHABLE") || errMsg.includes("fetch failed")) {
                        try {
                          session.sendClientContent({
                            turns: {
                              role: "user",
                              parts: [{ text: "SYSTEM DIRECTIVE (CRITICAL): The local Desktop Agent is not running. You must immediately speak to the user politely in your sweet anime companion tone, explaining clearly that you cannot execute the task because the Desktop Agent is not running on their computer. Tell them that once they start the Desktop Agent, you can execute the task again. Do not run any more tools." }]
                            }
                          });
                        } catch (e) {
                        }
                      }
                      try {
                        clientWs.send(JSON.stringify({
                          type: "browserAutomationEvent",
                          name: fc.name,
                          args: fc.args,
                          status: "failed",
                          error: errMsg
                        }));
                      } catch (e) {
                      }
                      session.sendToolResponse({
                        functionResponses: [{
                          name: fc.name,
                          response: { output: { result: `Desktop control error: ${errMsg}` } },
                          id: fc.id
                        }]
                      });
                    }
                  })();
                } else {
                  clientWs.send(JSON.stringify({
                    type: "toolCall",
                    callId: fc.id,
                    name: fc.name,
                    args: fc.args
                  }));
                }
              }
            }
          },
          onclose: () => {
            console.log("Gemini Live session closed (idle timeout or server-side disconnect)");
            try {
              clientWs.send(JSON.stringify({ type: "status", status: "session_closed" }));
            } catch (e) {
            }
          }
        }
      });
      activeMairaLiveSession = session;
      clientWs.send(JSON.stringify({ type: "status", status: "session_ready" }));
      clientWs.send(JSON.stringify({ type: "status", status: "connected" }));
      clientWs.on("message", (rawMsg) => {
        try {
          const msg = JSON.parse(rawMsg.toString());
          if (msg.type === "pong") {
            return;
          }
          if (msg.type === "ping") {
            try {
              if (clientWs.readyState === clientWs.OPEN) {
                clientWs.send(JSON.stringify({ type: "pong" }));
              }
            } catch (e) {
            }
            return;
          }
          if (msg.audio) {
            session.sendRealtimeInput({
              audio: { data: msg.audio, mimeType: "audio/pcm;rate=16000" }
            });
          } else if (msg.type === "text" && msg.text) {
            const textLower = msg.text.toLowerCase().trim();
            const isCancelIntent = ["cancel", "stop", "abort", "\u09AC\u09BE\u09A4\u09BF\u09B2", "\u09A5\u09BE\u09AE\u09CB"].some((word) => textLower.includes(word));
            if (isCancelIntent) {
              if (sabitRuntimeState.taskState === "acquiring" || sabitRuntimeState.taskState === "running" || sabitRuntimeState.taskState === "recovering" || sabitRuntimeState.taskState === "waiting_for_user") {
                console.log("[Task Manager] Cancelling active Sabit task via text cancel intent.");
                cancelSabitTask("Task explicitly cancelled by user.");
              }
            } else if (sabitRuntimeState.taskState === "waiting_for_user") {
              resumeSabitTask(msg.text);
              return;
            }
            if (activeToolCall || isCancelIntent && activeSabitToolCall) {
              if (activeSabitToolCall) {
                console.log(`[Task Manager] User sent cancellation while Sabit tool ${activeSabitToolCall.name} was running.`);
                activeSabitToolCall.resolve({
                  ok: false,
                  error: "Task explicitly cancelled by user."
                });
                activeSabitToolCall = null;
              }
              if (activeToolCall) {
                console.log(`[Task Manager] User sent text message / cancellation while Maira tool ${activeToolCall.name} was running.`);
                activeToolCall.resolve({
                  ok: false,
                  error: isCancelIntent ? "Task explicitly cancelled by user." : `Task interrupted by user's new command: "${msg.text}"`
                });
                activeToolCall = null;
              }
              callDesktopAgent("browserSessionClose", {}).catch(() => {
              });
            }
            try {
              dialogueHistory.push({ role: "user", text: msg.text });
              const plan = analyzeAndSplitUserRequest(msg.text);
              if (plan.isCompound && plan.subTasks.length >= 2) {
                const sabitSubTask = plan.subTasks.find((t) => t.targetAgent === "sabit");
                const mairaSubTask = plan.subTasks.find((t) => t.targetAgent === "maira");
                let isSabitConnected = false;
                if (globalSabitWss && globalSabitWss.clients) {
                  for (const client of globalSabitWss.clients) {
                    if (client.readyState === 1) {
                      isSabitConnected = true;
                      break;
                    }
                  }
                }
                const isSabitIdle = sabitRuntimeState.taskState === "idle";
                if (isSabitConnected && isSabitIdle && sabitSubTask) {
                  console.log(`[Task Scheduler] Compound task split detected! Dispatching Task A to Sabit ("${sabitSubTask.goal}") AND Task B to Maira ("${mairaSubTask?.goal}") simultaneously.`);
                  acquireSabitTask(sabitSubTask.goal);
                  mairaActiveTaskGoal = mairaSubTask?.goal || "Task 2";
                  if (activeSabitLiveSession) {
                    try {
                      activeSabitLiveSession.sendClientContent({
                        turns: {
                          role: "user",
                          parts: [{ text: `SYSTEM DIRECTIVE: You have been delegated a task: "${sabitSubTask.goal}". Please begin executing this task immediately in the background using your available tools.` }]
                        },
                        turnComplete: true
                      });
                    } catch (e) {
                    }
                  }
                  session.sendClientContent({
                    turns: {
                      role: "user",
                      parts: [{ text: `SYSTEM DIRECTIVE (TRUE PARALLEL EXECUTION): The user requested multiple actions: "${msg.text}".
Task 1 ("${sabitSubTask.goal}") has ALREADY been dispatched to Sabit and is actively running in the background.
You (Maira) MUST execute Task 2 ("${mairaSubTask?.goal || "the remaining request"}") YOURSELF SIMULTANEOUSLY right now using your available tools.
Do NOT call delegateToSabit for Task 2. Announce briefly that Sabit is handling Task 1, and immediately execute Task 2!` }]
                    }
                  });
                } else {
                  console.log(`[Task Scheduler - Busy Rule] Compound task received but Sabit is busy/offline. Directing Maira to execute both tasks.`);
                  session.sendClientContent({
                    turns: {
                      role: "user",
                      parts: [{ text: `SYSTEM DIRECTIVE (BUSY RULE): Sabit is currently busy or offline. You (Maira) MUST execute ALL requested tasks directly yourself right now using your available tools: "${msg.text}". Do NOT say Sabit is busy, do NOT refuse, and execute immediately.` }]
                    }
                  });
                }
              } else {
                session.sendClientContent({
                  turns: {
                    role: "user",
                    parts: [{ text: msg.text }]
                  }
                });
              }
              console.log(`[Chat] Text forwarded to Gemini: "${msg.text.substring(0, 80)}"`);
            } catch (e) {
              console.error("[Chat] Failed to send text to Gemini:", e?.message || e);
            }
          } else if (msg.type === "cancelTask") {
            if (sabitRuntimeState.taskState === "acquiring" || sabitRuntimeState.taskState === "running" || sabitRuntimeState.taskState === "recovering" || sabitRuntimeState.taskState === "waiting_for_user") {
              console.log("[Task Manager] Explicit cancellation requested via cancelTask event for active Sabit task.");
              cancelSabitTask("Task explicitly cancelled by user.");
            }
            if (activeToolCall) {
              console.log(`[Task Manager] Explicit cancellation requested via cancelTask event for tool: ${activeToolCall.name}`);
              activeToolCall.resolve({
                ok: false,
                error: "Task explicitly cancelled by user."
              });
              activeToolCall = null;
              callDesktopAgent("browserSessionClose", { _caller: "maira" }).catch(() => {
              });
              try {
                clientWs.send(JSON.stringify({
                  type: "browserAutomationEvent",
                  name: "cancelTask",
                  status: "cancelled",
                  message: "Task successfully cancelled."
                }));
              } catch (e) {
              }
              try {
                session.sendClientContent({
                  turns: {
                    role: "user",
                    parts: [{ text: "The user has explicitly cancelled the active background task. Please acknowledge the cancellation in your sweet, supportive voice." }]
                  }
                });
              } catch (e) {
              }
            }
          } else if (msg.type === "video" && msg.video) {
            session.sendRealtimeInput({
              video: { data: msg.video, mimeType: "image/jpeg" }
            });
          } else if (msg.type === "toolResponse") {
            session.sendToolResponse({
              functionResponses: [
                {
                  name: msg.name,
                  response: { output: msg.output },
                  id: msg.id
                }
              ]
            });
          }
        } catch (e) {
          console.error("Error editing/forwarding client frame message:", e);
        }
      });
      clientWs.on("close", () => {
        console.log("Client disconnected, closing Gemini session");
        clearInterval(serverHeartbeatInterval);
        isCurrentlyDelegated = false;
        if (activeMairaLiveSession === session) {
          activeMairaLiveSession = null;
        }
        try {
          session.close();
        } catch (e) {
        }
      });
    } catch (err) {
      clearInterval(serverHeartbeatInterval);
      const errMsg = err?.message || String(err);
      console.error("Error connecting to Gemini Live API:", errMsg);
      logError(`GEMINI_SESSION_ERROR: ${errMsg.substring(0, 300)}`);
      const isTransient = /timeout|rate.?limit|429|503|network|fetch|ECONN|socket|temporarily|unavailable/i.test(errMsg);
      if (isTransient) {
        try {
          clientWs.send(JSON.stringify({
            type: "status",
            status: "session_closed"
          }));
        } catch (e) {
        }
        console.log("[Server] Gemini session error was transient \u2014 client will auto-reconnect.");
      } else {
        try {
          clientWs.send(JSON.stringify({
            type: "error",
            error: `Could not connect to Gemini: ${errMsg}`
          }));
        } catch (e) {
        }
      }
    }
  });
  wss.on("error", (err) => {
    console.error("[Server] WebSocket server error:", err?.message || err);
    logError(`WS_SERVER_ERROR: ${String(err).substring(0, 200)}`);
  });
  app.use("/assets", import_express.default.static(import_path2.default.join(process.cwd(), "assets")));
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path2.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path2.default.join(distPath, "index.html"));
    });
  }
  server.listen(PORT, "0.0.0.0", () => {
    logStartup(`MYRAA V2 server started on http://localhost:${PORT}`);
    console.log(`[Server] Running on http://localhost:${PORT}`);
    ensureDesktopAgent().catch(
      (e) => console.warn(`[Desktop Agent] Boot probe failed: ${e?.message || e}`)
    );
  });
}
if (!process.env.TEST_MODE) {
  startServer().catch((error) => {
    console.error("Failed to start server startup sequence:", error);
  });
}
process.on("unhandledRejection", (reason, promise) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  console.error("[FATAL GUARD] Unhandled Promise Rejection:", msg);
  logError(`UNHANDLED_REJECTION: ${msg.substring(0, 300)}`);
});
process.on("uncaughtException", (error) => {
  const msg = error?.message || String(error);
  console.error("[FATAL GUARD] Uncaught Exception:", msg);
  logError(`UNCAUGHT_EXCEPTION: ${msg.substring(0, 300)} | Stack: ${(error?.stack || "").substring(0, 500)}`);
});
process.on("SIGINT", () => {
  console.log("[Server] SIGINT received \u2014 ignoring (use app quit to exit).");
});
process.on("SIGTERM", () => {
  console.log("[Server] SIGTERM received \u2014 ignoring (use app quit to exit).");
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  acquireSabitTask,
  broadcastSabitRuntimeState,
  broadcastSabitTaskState,
  cancelSabitTask,
  currentSabitTaskObj,
  getSabitStatus,
  getSabitStatusSummary,
  logSabitWS,
  releaseSabitTask,
  resumeSabitTask,
  sabitRuntimeState,
  setSabitTaskStatus,
  transitionSabitTaskState
});
//# sourceMappingURL=server.cjs.map
