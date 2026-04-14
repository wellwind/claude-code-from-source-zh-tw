import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

// --- Types ---

type Tab = "skills" | "hooks";
type SkillPhase = "startup" | "invoked" | "idle";
type HookFlowStep = "idle" | "pre" | "execute" | "post" | "done";

interface SkillSource {
  id: number;
  name: string;
  priority: number;
  location: string;
  trust: string;
}

interface SkillCard {
  id: string;
  name: string;
  description: string;
  source: string;
  tokens: number;
  loaded: boolean;
}

interface HookType {
  id: string;
  name: string;
  description: string;
  exitCodes: string;
}

// --- Data ---

const skillSources: SkillSource[] = [
  { id: 1, name: "Managed (Policy)", priority: 1, location: "<MANAGED_PATH>/.claude/skills/", trust: "Enterprise" },
  { id: 2, name: "User", priority: 2, location: "~/.claude/skills/", trust: "User" },
  { id: 3, name: "Project", priority: 3, location: ".claude/skills/", trust: "Project" },
  { id: 4, name: "Additional Dirs", priority: 4, location: "<add-dir>/.claude/skills/", trust: "Varies" },
  { id: 5, name: "Legacy Commands", priority: 5, location: ".claude/commands/", trust: "Project" },
  { id: 6, name: "Bundled", priority: 6, location: "Compiled into binary", trust: "Built-in" },
  { id: 7, name: "MCP", priority: 7, location: "MCP server prompts", trust: "Remote" },
];

const sampleSkills: SkillCard[] = [
  { id: "deploy", name: "/deploy", description: "執行部署管線", source: "Project", tokens: 1847, loaded: false },
  { id: "review", name: "/review", description: "程式碼審查清單", source: "Project", tokens: 2103, loaded: false },
  { id: "test", name: "/test", description: "執行測試套件與覆蓋率", source: "User", tokens: 956, loaded: false },
  { id: "db-migrate", name: "/db-migrate", description: "資料庫遷移助手", source: "Project", tokens: 1432, loaded: false },
  { id: "format", name: "/format", description: "格式化與 lint 程式碼", source: "Bundled", tokens: 734, loaded: false },
  { id: "git-pr", name: "/git-pr", description: "建立 Pull Request", source: "Bundled", tokens: 1289, loaded: false },
  { id: "security", name: "/security", description: "安全稽核清單", source: "Managed", tokens: 2456, loaded: false },
  { id: "docs", name: "/docs", description: "產生文件", source: "User", tokens: 1678, loaded: false },
  { id: "refactor", name: "/refactor", description: "重構模式", source: "MCP", tokens: 1923, loaded: false },
  { id: "debug", name: "/debug", description: "除錯工作流程", source: "Bundled", tokens: 867, loaded: false },
  { id: "perf", name: "/perf", description: "效能分析", source: "Project", tokens: 1544, loaded: false },
  { id: "api", name: "/api", description: "API 設計模式", source: "User", tokens: 2011, loaded: false },
  { id: "ci", name: "/ci", description: "CI/CD 設定", source: "Project", tokens: 1156, loaded: false },
  { id: "lint", name: "/lint", description: "自訂 lint 規則", source: "Legacy", tokens: 623, loaded: false },
  { id: "scaffold", name: "/scaffold", description: "專案鷹架", source: "MCP", tokens: 1789, loaded: false },
];

const hookTypes: HookType[] = [
  { id: "pre", name: "PreToolUse", description: "在每次工具執行前觸發。可以阻擋、修改輸入、自動核准或注入上下文。", exitCodes: "deny > ask > allow 優先順序" },
  { id: "post", name: "PostToolUse", description: "在成功執行後觸發。可以注入上下文或替換 MCP 工具輸出。", exitCodes: "僅上下文注入" },
  { id: "stop", name: "Stop", description: "在 Claude 結束前觸發。Exit 2 強制繼續——最強大的整合點。", exitCodes: "Exit 2 = 強制繼續" },
  { id: "notification", name: "Notification", description: "在通知、詢問和工作階段事件時觸發。無法阻擋。", exitCodes: "僅非阻擋性" },
];

// --- Helpers ---

function useDarkMode() {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const check = () =>
      setIsDark(document.documentElement.classList.contains("dark"));
    check();
    window.addEventListener("theme-changed", check);
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => {
      window.removeEventListener("theme-changed", check);
      observer.disconnect();
    };
  }, []);
  return isDark;
}

function LockIcon({ size = 14, color = "#d97757" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="3" y="7" width="10" height="7" rx="1.5" stroke={color} strokeWidth="1.5" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon({ color = "#d97757" }: { color?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 8.5L6.5 12L13 4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BlockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="5.5" stroke="#ef4444" strokeWidth="1.5" />
      <path d="M4.5 11.5L11.5 4.5" stroke="#ef4444" strokeWidth="1.5" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 3L14 13H2L8 3Z" stroke="#eab308" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8 7v2.5" stroke="#eab308" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="11" r="0.75" fill="#eab308" />
    </svg>
  );
}

// --- Component ---

interface Props {
  className?: string;
}

export default function SkillsAndHooks({ className }: Props) {
  const isDark = useDarkMode();
  const [activeTab, setActiveTab] = useState<Tab>("skills");

  const colors = {
    accent: "#d97757",
    accentBg: isDark ? "rgba(217, 119, 87, 0.08)" : "rgba(217, 119, 87, 0.05)",
    accentBorder: "rgba(217, 119, 87, 0.5)",
    text: isDark ? "#f5f4ed" : "#141413",
    textSecondary: "#87867f",
    cardBg: isDark ? "#1e1e1c" : "#ffffff",
    cardBorder: isDark ? "#333" : "#e8e6dc",
    surfaceBg: isDark ? "#30302e" : "#f5f4ed",
    green: "#22c55e",
    greenBg: isDark ? "rgba(34, 197, 94, 0.1)" : "rgba(34, 197, 94, 0.08)",
    red: "#ef4444",
    redBg: isDark ? "rgba(239, 68, 68, 0.1)" : "rgba(239, 68, 68, 0.06)",
    yellow: "#eab308",
    yellowBg: isDark ? "rgba(234, 179, 8, 0.1)" : "rgba(234, 179, 8, 0.06)",
  };

  return (
    <div className={className} style={{ fontFamily: "var(--font-serif)" }}>
      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: 0,
          marginBottom: 24,
          borderBottom: `1px solid ${colors.cardBorder}`,
        }}
      >
        {(["skills", "hooks"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "12px 24px",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "var(--font-mono)",
              background: "none",
              border: "none",
              borderBottom: activeTab === tab ? `2px solid ${colors.accent}` : "2px solid transparent",
              color: activeTab === tab ? colors.accent : colors.textSecondary,
              cursor: "pointer",
              transition: "all 0.2s",
              textTransform: "capitalize",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "skills" ? (
          <motion.div
            key="skills"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <SkillsTab colors={colors} isDark={isDark} />
          </motion.div>
        ) : (
          <motion.div
            key="hooks"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <HooksTab colors={colors} isDark={isDark} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Skills Tab ---

interface TabProps {
  colors: Record<string, string>;
  isDark: boolean;
}

function SkillsTab({ colors, isDark }: TabProps) {
  const [phase, setPhase] = useState<SkillPhase>("idle");
  const [skills, setSkills] = useState(sampleSkills);
  const [loadedSkillId, setLoadedSkillId] = useState<string | null>(null);
  const [showSources, setShowSources] = useState(false);
  const [animatingTokens, setAnimatingTokens] = useState(0);
  const animRef = useRef<number | null>(null);

  const runStartup = useCallback(async () => {
    setPhase("startup");
    setLoadedSkillId(null);
    setAnimatingTokens(0);
    setSkills(sampleSkills.map((s) => ({ ...s, loaded: false })));

    // Animate skills appearing one by one
    for (let i = 0; i < sampleSkills.length; i++) {
      await new Promise((r) => setTimeout(r, 80));
      setSkills((prev) => prev.map((s, idx) => (idx <= i ? { ...s, loaded: false } : s)));
    }
    setPhase("idle");
  }, []);

  const invokeSkill = useCallback(
    (skillId: string) => {
      if (phase === "startup") return;
      const skill = sampleSkills.find((s) => s.id === skillId);
      if (!skill) return;

      setLoadedSkillId(skillId);
      setPhase("invoked");
      setAnimatingTokens(0);

      // Animate token count
      const targetTokens = skill.tokens;
      const duration = 800;
      const startTime = performance.now();

      const tick = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setAnimatingTokens(Math.round(eased * targetTokens));
        if (progress < 1) {
          animRef.current = requestAnimationFrame(tick);
        }
      };
      animRef.current = requestAnimationFrame(tick);

      setSkills((prev) =>
        prev.map((s) => (s.id === skillId ? { ...s, loaded: true } : s))
      );
    },
    [phase]
  );

  useEffect(() => {
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  return (
    <div>
      {/* Timeline */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 0,
          marginBottom: 24,
          padding: "16px 20px",
          background: colors.cardBg,
          border: `1px solid ${colors.cardBorder}`,
          borderRadius: 12,
          overflowX: "auto",
        }}
      >
        {[
          { label: "啟動", desc: "僅載入 frontmatter", active: phase === "startup" },
          { label: "使用者輸入 /command", desc: "技能被呼叫", active: phase === "invoked" },
          { label: "執行", desc: "完整內容注入", active: phase === "invoked" && loadedSkillId !== null },
        ].map((step, i) => (
          <div key={step.label} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
            <div style={{ textAlign: "center", flex: 1 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: step.active ? colors.accent : colors.surfaceBg,
                  color: step.active ? "#fff" : colors.textSecondary,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: "var(--font-mono)",
                  transition: "all 0.3s",
                  marginBottom: 6,
                }}
              >
                {i + 1}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: step.active ? colors.accent : colors.text }}>{step.label}</div>
              <div style={{ fontSize: 11, color: colors.textSecondary }}>{step.desc}</div>
            </div>
            {i < 2 && (
              <div style={{ width: 40, height: 2, background: colors.cardBorder, flexShrink: 0 }} />
            )}
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button
          onClick={runStartup}
          disabled={phase === "startup"}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "none",
            background: phase === "startup" ? colors.textSecondary : colors.accent,
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "var(--font-mono)",
            cursor: phase === "startup" ? "not-allowed" : "pointer",
            transition: "background 0.2s",
          }}
        >
          {phase === "startup" ? "載入中..." : "模擬啟動"}
        </button>
        <button
          onClick={() => setShowSources(!showSources)}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: `1px solid ${colors.cardBorder}`,
            background: showSources ? colors.accentBg : "transparent",
            color: showSources ? colors.accent : colors.textSecondary,
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "var(--font-mono)",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          {showSources ? "隱藏" : "顯示"} 7 個來源
        </button>
      </div>

      {/* Sources panel */}
      <AnimatePresence>
        {showSources && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden", marginBottom: 16 }}
          >
            <div
              style={{
                padding: "16px 20px",
                background: colors.cardBg,
                border: `1px solid ${colors.cardBorder}`,
                borderRadius: 12,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: colors.text, marginBottom: 12 }}>
                7 個技能來源（依優先順序）
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                {skillSources.map((src) => (
                  <div
                    key={src.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "8px 12px",
                      borderRadius: 8,
                      background: colors.surfaceBg,
                      fontSize: 12,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontWeight: 700,
                        color: colors.accent,
                        minWidth: 18,
                      }}
                    >
                      {src.priority}
                    </span>
                    <span style={{ fontWeight: 600, color: colors.text, minWidth: 120 }}>{src.name}</span>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        color: colors.textSecondary,
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {src.location}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontFamily: "var(--font-mono)",
                        color: colors.textSecondary,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: isDark ? "rgba(135,134,127,0.15)" : "rgba(135,134,127,0.1)",
                      }}
                    >
                      {src.trust}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Token counter */}
      {loadedSkillId && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            padding: "12px 20px",
            marginBottom: 16,
            borderRadius: 12,
            border: `1px solid ${colors.accentBorder}`,
            background: colors.accentBg,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: colors.textSecondary }}>
            已載入內容：
          </span>
          <span
            style={{
              fontSize: 24,
              fontWeight: 700,
              fontFamily: "var(--font-mono)",
              color: colors.accent,
            }}
          >
            {animatingTokens.toLocaleString()}
          </span>
          <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: colors.textSecondary }}>
            tokens
          </span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: colors.textSecondary }}>
            僅此技能已載入。其他 14 個保持僅 frontmatter（每個約 0 個 token）。
          </span>
        </motion.div>
      )}

      {/* Skills grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 8,
        }}
      >
        {skills.map((skill) => {
          const isLoaded = skill.id === loadedSkillId;
          return (
            <motion.button
              key={skill.id}
              onClick={() => invokeSkill(skill.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: `1px solid ${isLoaded ? colors.accent : colors.cardBorder}`,
                background: isLoaded ? colors.accentBg : colors.cardBg,
                cursor: phase === "startup" ? "not-allowed" : "pointer",
                textAlign: "left",
                transition: "border-color 0.2s, background 0.2s",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Loaded indicator */}
              {isLoaded && (
                <motion.div
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    height: 3,
                    background: colors.accent,
                    borderRadius: "10px 10px 0 0",
                  }}
                />
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--font-mono)", color: isLoaded ? colors.accent : colors.text }}>
                  {skill.name}
                </span>
                {isLoaded && <CheckIcon />}
              </div>
              <div style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 6 }}>
                {skill.description}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                    color: colors.textSecondary,
                    padding: "1px 5px",
                    borderRadius: 4,
                    background: isDark ? "rgba(135,134,127,0.15)" : "rgba(135,134,127,0.1)",
                  }}
                >
                  {skill.source}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                    color: isLoaded ? colors.accent : colors.textSecondary,
                    fontWeight: isLoaded ? 700 : 400,
                  }}
                >
                  {isLoaded ? `${skill.tokens} tok` : "0 tok"}
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Explanation */}
      <div
        style={{
          marginTop: 16,
          padding: "12px 16px",
          borderRadius: 10,
          background: colors.surfaceBg,
          fontSize: 12,
          color: colors.textSecondary,
          lineHeight: 1.6,
        }}
      >
        <strong style={{ color: colors.text }}>兩階段載入：</strong>啟動時僅提取 YAML frontmatter（名稱、描述、whenToUse）——幾乎零 token 成本。
        當被呼叫時，<code style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>getPromptForCommand</code> 載入完整的 markdown 內容，替換變數，並執行內嵌的 shell 指令。
        點擊任一技能卡片來模擬呼叫。
      </div>
    </div>
  );
}

// --- Hooks Tab ---

function HooksTab({ colors, isDark }: TabProps) {
  const [flowStep, setFlowStep] = useState<HookFlowStep>("idle");
  const [selectedHook, setSelectedHook] = useState<string | null>(null);
  const abortRef = useRef(false);

  const runFlow = useCallback(async () => {
    abortRef.current = false;
    setFlowStep("pre");
    await new Promise((r) => setTimeout(r, 1000));
    if (abortRef.current) return;
    setFlowStep("execute");
    await new Promise((r) => setTimeout(r, 800));
    if (abortRef.current) return;
    setFlowStep("post");
    await new Promise((r) => setTimeout(r, 800));
    if (abortRef.current) return;
    setFlowStep("done");
  }, []);

  const resetFlow = useCallback(() => {
    abortRef.current = true;
    setFlowStep("idle");
  }, []);

  const flowSteps: { id: HookFlowStep; label: string; detail: string }[] = [
    { id: "pre", label: "PreToolUse", detail: "3 個鉤子匹配，檢查中..." },
    { id: "execute", label: "工具執行", detail: "執行 Bash: git commit -m 'fix'" },
    { id: "post", label: "PostToolUse", detail: "2 個鉤子已執行，上下文已注入" },
    { id: "done", label: "完成", detail: "結果回傳給模型" },
  ];

  const getFlowIndex = (step: HookFlowStep) => flowSteps.findIndex((s) => s.id === step);
  const currentIndex = getFlowIndex(flowStep);

  return (
    <div>
      {/* Snapshot security model */}
      <div
        style={{
          padding: "16px 20px",
          marginBottom: 20,
          borderRadius: 12,
          border: `1px solid ${colors.cardBorder}`,
          background: colors.cardBg,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <LockIcon size={16} color={colors.accent} />
          <span style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>
            快照安全模型
          </span>
        </div>
        <div style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 1.6 }}>
          鉤子設定在啟動時透過{" "}
          <code style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>captureHooksConfigSnapshot()</code>
          {" "}<strong style={{ color: colors.accent }}>凍結</strong>。
          執行時期對 <code style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>.claude/settings.json</code> 的檔案系統變更會被忽略。
          只有明確的通道（<code style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>/hooks</code> 指令或檔案監控器）
          才能更新快照。
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginTop: 12,
            padding: "10px 14px",
            borderRadius: 8,
            background: colors.surfaceBg,
            fontSize: 11,
            fontFamily: "var(--font-mono)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <LockIcon size={12} color={colors.green} />
            <span style={{ color: colors.green }}>啟動：設定已凍結</span>
          </div>
          <div style={{ color: colors.cardBorder }}>|</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <BlockIcon />
            <span style={{ color: colors.red }}>攻擊者修改 .claude/settings.json</span>
          </div>
          <div style={{ color: colors.cardBorder }}>|</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <LockIcon size={12} color={colors.accent} />
            <span style={{ color: colors.accent }}>executeHooks() 讀取凍結的快照</span>
          </div>
        </div>
      </div>

      {/* Hook flow simulation */}
      <div
        style={{
          padding: "16px 20px",
          marginBottom: 20,
          borderRadius: 12,
          border: `1px solid ${colors.cardBorder}`,
          background: colors.cardBg,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>鉤子執行流程</span>
          <button
            onClick={flowStep === "idle" ? runFlow : resetFlow}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              border: "none",
              background: flowStep === "idle" ? colors.accent : colors.textSecondary,
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "var(--font-mono)",
              cursor: "pointer",
            }}
          >
            {flowStep === "idle" ? "執行工具呼叫" : "重設"}
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
          {flowSteps.map((step, i) => {
            const isActive = step.id === flowStep;
            const isPassed = currentIndex > i;
            return (
              <div key={step.id} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                <div style={{ flex: 1, textAlign: "center" }}>
                  <motion.div
                    animate={{
                      scale: isActive ? 1.1 : 1,
                      background: isActive
                        ? colors.accent
                        : isPassed
                          ? "rgba(217, 119, 87, 0.3)"
                          : colors.surfaceBg,
                    }}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: isActive || isPassed ? "#fff" : colors.textSecondary,
                      fontSize: 12,
                      fontWeight: 700,
                      fontFamily: "var(--font-mono)",
                      marginBottom: 8,
                      transition: "background 0.3s",
                    }}
                  >
                    {isPassed ? <CheckIcon color="#fff" /> : i + 1}
                  </motion.div>
                  {isActive && (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: 40 }}
                      style={{ height: 3, background: colors.accent, borderRadius: 2, margin: "-4px auto 4px" }}
                    />
                  )}
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: isActive ? colors.accent : isPassed ? colors.accent : colors.textSecondary,
                    }}
                  >
                    {step.label}
                  </div>
                  <AnimatePresence>
                    {isActive && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{
                          fontSize: 10,
                          fontFamily: "var(--font-mono)",
                          color: colors.textSecondary,
                          marginTop: 4,
                        }}
                      >
                        {step.detail}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                {i < flowSteps.length - 1 && (
                  <motion.div
                    animate={{
                      background: isPassed ? colors.accent : colors.cardBorder,
                    }}
                    style={{ width: 30, height: 2, flexShrink: 0, transition: "background 0.3s" }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Hook types grid */}
      <div style={{ fontSize: 13, fontWeight: 600, color: colors.text, marginBottom: 12 }}>
        4 種鉤子類型
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 10,
          marginBottom: 20,
        }}
      >
        {hookTypes.map((hook) => {
          const isSelected = selectedHook === hook.id;
          return (
            <motion.button
              key={hook.id}
              onClick={() => setSelectedHook(isSelected ? null : hook.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                padding: "14px 16px",
                borderRadius: 10,
                border: `1px solid ${isSelected ? colors.accent : colors.cardBorder}`,
                background: isSelected ? colors.accentBg : colors.cardBg,
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.2s",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--font-mono)", color: isSelected ? colors.accent : colors.text, marginBottom: 6 }}>
                {hook.name}
              </div>
              <div style={{ fontSize: 11, color: colors.textSecondary, lineHeight: 1.5, marginBottom: 8 }}>
                {hook.description}
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                  color: colors.textSecondary,
                  padding: "3px 6px",
                  borderRadius: 4,
                  background: isDark ? "rgba(135,134,127,0.15)" : "rgba(135,134,127,0.1)",
                  display: "inline-block",
                }}
              >
                {hook.exitCodes}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Exit code semantics */}
      <div
        style={{
          padding: "16px 20px",
          borderRadius: 12,
          border: `1px solid ${colors.cardBorder}`,
          background: colors.cardBg,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: colors.text, marginBottom: 12 }}>
          Exit Code 語義
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {[
            { code: "0", meaning: "成功 -- 若為 JSON 則解析 stdout", color: colors.green, bg: colors.greenBg, icon: <CheckIcon color={colors.green} /> },
            { code: "2", meaning: "阻擋性錯誤 -- stderr 顯示為系統訊息", color: colors.red, bg: colors.redBg, icon: <BlockIcon /> },
            { code: "其他", meaning: "非阻擋性警告 -- 僅顯示給使用者", color: colors.yellow, bg: colors.yellowBg, icon: <WarningIcon /> },
          ].map((ec) => (
            <div
              key={ec.code}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                borderRadius: 8,
                background: ec.bg,
              }}
            >
              {ec.icon}
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: 700,
                  fontSize: 14,
                  color: ec.color,
                  minWidth: 50,
                }}
              >
                {ec.code}
              </span>
              <span style={{ fontSize: 12, color: colors.text }}>{ec.meaning}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 10, lineHeight: 1.5 }}>
          Exit code 2 是刻意選擇的。Exit code 1 太常見了——任何未處理的例外或語法錯誤都會產生 exit 1。
          使用 exit 2 可以防止意外的強制執行。
        </div>
      </div>
    </div>
  );
}
