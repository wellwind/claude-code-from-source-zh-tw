import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// --- Dark mode hook ---

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

// --- Data ---

type Provider = "direct" | "bedrock" | "vertex";

interface PromptSection {
  id: string;
  label: string;
  tier: "static" | "boundary" | "dynamic";
  description: string;
  tokenEstimate: string;
  cacheScope: string;
  contents: string[];
}

const PROMPT_SECTIONS: PromptSection[] = [
  {
    id: "identity",
    label: "身分與介紹",
    tier: "static",
    description: "系統身分、角色描述和行為基礎",
    tokenEstimate: "~200",
    cacheScope: "global",
    contents: ["你是 Claude Code，一位專家級軟體工程師...", "核心行為規則和安全指引"],
  },
  {
    id: "behavior",
    label: "系統行為規則",
    tier: "static",
    description: "回應格式、安全約束、拒絕模式",
    tokenEstimate: "~500",
    cacheScope: "global",
    contents: ["工具呼叫慣例", "錯誤處理規則", "安全和內容政策"],
  },
  {
    id: "tasks",
    label: "任務執行指引",
    tier: "static",
    description: "如何處理多步驟任務、規劃和驗證",
    tokenEstimate: "~400",
    cacheScope: "global",
    contents: ["任務分解規則", "驗證需求", "何時詢問 vs. 直接執行"],
  },
  {
    id: "actions",
    label: "動作指引",
    tier: "static",
    description: "工具定義、綱要和使用說明",
    tokenEstimate: "~2,000",
    cacheScope: "global",
    contents: ["Read、Write、Edit、Bash、Glob、Grep 工具綱要", "工具選擇啟發法", "檔案操作規則"],
  },
  {
    id: "tools",
    label: "工具使用說明",
    tier: "static",
    description: "每個工具的詳細使用模式和約束",
    tokenEstimate: "~3,000",
    cacheScope: "global",
    contents: ["Git 工作流規則", "先搜尋再建立模式", "檔案編輯最佳實踐"],
  },
  {
    id: "tone",
    label: "語氣與風格",
    tier: "static",
    description: "輸出格式、簡潔規則、溝通風格",
    tokenEstimate: "~300",
    cacheScope: "global",
    contents: ["預設簡潔", "無不必要的前言", "技術精確性"],
  },
  {
    id: "efficiency",
    label: "輸出效率",
    tier: "static",
    description: "最小化 token 輸出同時最大化實用性的規則",
    tokenEstimate: "~200",
    cacheScope: "global",
    contents: ["避免重述問題", "僅顯示相關程式碼", "批次工具呼叫"],
  },
  {
    id: "boundary",
    label: "=== 動態邊界 ===",
    tier: "boundary",
    description: "快取斷點：以上所有內容在所有使用者之間全域共享。以下所有內容是每個工作階段獨立的。將區段移過這個邊界會影響全域快取效能。",
    tokenEstimate: "marker",
    cacheScope: "break",
    contents: ["以下每個條件都是一個執行時位元，否則會使 Blake2b 前綴雜湊變體倍增 (2^N)"],
  },
  {
    id: "session",
    label: "工作階段指引",
    tier: "dynamic",
    description: "工作階段特定的行為覆寫和功能旗標",
    tokenEstimate: "~300",
    cacheScope: "per-session",
    contents: ["當前權限模式", "啟用的功能旗標", "工作階段類型（REPL vs 單次執行）"],
  },
  {
    id: "memory",
    label: "記憶（CLAUDE.md）",
    tier: "dynamic",
    description: "從檔案系統載入的專案特定指令",
    tokenEstimate: "~2,000-50,000",
    cacheScope: "per-session",
    contents: ["使用者的 CLAUDE.md 內容", "專案慣例", "自訂規則和偏好"],
  },
  {
    id: "environment",
    label: "環境資訊",
    tier: "dynamic",
    description: "Git 狀態、工作目錄、作業系統、shell 資訊",
    tokenEstimate: "~500",
    cacheScope: "per-session",
    contents: ["Git 分支、狀態、最近提交", "工作目錄路徑", "作業系統和 shell 版本"],
  },
  {
    id: "language",
    label: "語言偏好",
    tier: "dynamic",
    description: "使用者偏好的回應語言",
    tokenEstimate: "~50",
    cacheScope: "per-session",
    contents: ["以使用者的語言回應"],
  },
  {
    id: "mcp",
    label: "MCP 指令",
    tier: "dynamic",
    description: "危險：使用者特定的 MCP 工具定義。當存在時會停用全域快取範圍，因為 MCP 定義對每個使用者都是唯一的。",
    tokenEstimate: "~1,000-10,000",
    cacheScope: "UNCACHED",
    contents: ["MCP 伺服器工具定義", "每個工具的指令", "伺服器連線詳細資訊"],
  },
  {
    id: "output-style",
    label: "輸出風格",
    tier: "dynamic",
    description: "工作階段特定的輸出格式偏好",
    tokenEstimate: "~100",
    cacheScope: "per-session",
    contents: ["詳細模式設定", "展開檢視偏好"],
  },
];

const PROVIDER_INFO: Record<Provider, { label: string; authDesc: string; envVar: string; color: string }> = {
  direct: {
    label: "直接 API",
    authDesc: "API 金鑰或 OAuth token",
    envVar: "ANTHROPIC_API_KEY",
    color: "#d97757",
  },
  bedrock: {
    label: "AWS Bedrock",
    authDesc: "AWS 憑證（IAM 角色 / 存取金鑰）",
    envVar: "ANTHROPIC_BEDROCK_BASE_URL",
    color: "#ff9900",
  },
  vertex: {
    label: "Google Vertex AI",
    authDesc: "Google 驗證（服務帳戶 / ADC）",
    envVar: "ANTHROPIC_VERTEX_PROJECT_ID",
    color: "#4285f4",
  },
};

interface ToggleFeature {
  id: string;
  label: string;
  default: boolean;
  effect: string;
}

const TOGGLE_FEATURES: ToggleFeature[] = [
  { id: "extended-thinking", label: "延伸思考", default: false, effect: "在請求主體加入思考預算——改變快取金鑰" },
  { id: "mcp-tools", label: "MCP 工具", default: false, effect: "加入使用者特定的工具定義——停用全域快取範圍" },
  { id: "auto-mode", label: "自動模式 (AFK)", default: false, effect: "加入 beta 標頭——一旦鎖定，整個工作階段都保持" },
];

// --- Component ---

interface Props {
  className?: string;
}

export default function APICallLifecycle({ className }: Props) {
  const isDark = useDarkMode();
  const [selectedProvider, setSelectedProvider] = useState<Provider>("direct");
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);
  const [features, setFeatures] = useState<Record<string, boolean>>({
    "extended-thinking": false,
    "mcp-tools": false,
    "auto-mode": false,
  });

  const colors = {
    terracotta: "#d97757",
    text: isDark ? "#f5f4ed" : "#141413",
    textSecondary: isDark ? "#87867f" : "#87867f",
    bg: isDark ? "#1e1e1c" : "#ffffff",
    bgCard: isDark ? "#2a2a28" : "#f8f7f2",
    border: isDark ? "#333" : "#c2c0b6",
    // Cache tiers
    staticBg: isDark ? "rgba(34,197,94,0.1)" : "rgba(34,197,94,0.06)",
    staticBorder: isDark ? "rgba(34,197,94,0.3)" : "rgba(34,197,94,0.2)",
    staticAccent: "#22c55e",
    boundaryBg: isDark ? "rgba(217,119,87,0.15)" : "rgba(217,119,87,0.08)",
    boundaryBorder: isDark ? "rgba(217,119,87,0.5)" : "rgba(217,119,87,0.4)",
    dynamicBg: isDark ? "rgba(245,158,11,0.1)" : "rgba(245,158,11,0.06)",
    dynamicBorder: isDark ? "rgba(245,158,11,0.3)" : "rgba(245,158,11,0.2)",
    dynamicAccent: "#f59e0b",
    uncachedBg: isDark ? "rgba(239,68,68,0.1)" : "rgba(239,68,68,0.06)",
    uncachedBorder: isDark ? "rgba(239,68,68,0.3)" : "rgba(239,68,68,0.2)",
    uncachedAccent: "#ef4444",
  };

  const toggleFeature = useCallback((id: string) => {
    setFeatures((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // Compute effective sections based on features
  const effectiveSections = PROMPT_SECTIONS.filter((section) => {
    if (section.id === "mcp" && !features["mcp-tools"]) return false;
    return true;
  });

  // Calculate total tokens for static vs dynamic
  const staticTokens = effectiveSections
    .filter((s) => s.tier === "static")
    .reduce((sum, s) => {
      const match = s.tokenEstimate.match(/[\d,]+/);
      return sum + (match ? parseInt(match[0].replace(",", "")) : 0);
    }, 0);

  const hasMcp = features["mcp-tools"];
  const globalCacheDisabled = hasMcp;

  const getSectionBackground = (section: PromptSection) => {
    if (section.tier === "boundary") return colors.boundaryBg;
    if (section.tier === "static") return colors.staticBg;
    if (section.id === "mcp") return colors.uncachedBg;
    return colors.dynamicBg;
  };

  const getSectionBorder = (section: PromptSection) => {
    if (section.tier === "boundary") return colors.boundaryBorder;
    if (section.tier === "static") return colors.staticBorder;
    if (section.id === "mcp") return colors.uncachedBorder;
    return colors.dynamicBorder;
  };

  const getSectionAccent = (section: PromptSection) => {
    if (section.tier === "boundary") return colors.terracotta;
    if (section.tier === "static") return colors.staticAccent;
    if (section.id === "mcp") return colors.uncachedAccent;
    return colors.dynamicAccent;
  };

  const getCacheScopeLabel = (section: PromptSection) => {
    if (section.tier === "boundary") return "BREAK";
    if (section.tier === "static") {
      return globalCacheDisabled ? "per-session (MCP present)" : "global";
    }
    if (section.id === "mcp") return "UNCACHED";
    return "per-session";
  };

  return (
    <div className={className} style={{ fontFamily: "var(--font-serif)" }}>
      {/* Provider selector */}
      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "center",
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: 12,
            color: colors.textSecondary,
            fontFamily: "var(--font-mono)",
            alignSelf: "center",
          }}
        >
          提供者：
        </span>
        {(Object.keys(PROVIDER_INFO) as Provider[]).map((provider) => {
          const info = PROVIDER_INFO[provider];
          const isActive = selectedProvider === provider;
          return (
            <button
              key={provider}
              onClick={() => setSelectedProvider(provider)}
              style={{
                background: isActive ? info.color : "transparent",
                color: isActive ? "#fff" : colors.textSecondary,
                border: `1px solid ${isActive ? info.color : colors.border}`,
                borderRadius: 6,
                padding: "4px 12px",
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {info.label}
            </button>
          );
        })}
      </div>

      {/* Provider info strip */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedProvider}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.2 }}
          style={{
            textAlign: "center",
            marginBottom: 16,
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            color: colors.textSecondary,
          }}
        >
          Auth: {PROVIDER_INFO[selectedProvider].authDesc} -- env: <code style={{ fontSize: 11, padding: "1px 4px", borderRadius: 3, background: isDark ? "#333" : "#e8e6dc" }}>{PROVIDER_INFO[selectedProvider].envVar}</code>
          <div style={{ fontSize: 11, marginTop: 2, opacity: 0.7 }}>
            所有提供者透過型別抹除被轉換為 <code style={{ fontSize: 10, padding: "1px 4px", borderRadius: 3, background: isDark ? "#333" : "#e8e6dc" }}>Anthropic</code> —— 消費者永遠不會對提供者分支。
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Main layout: prompt stack + details */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 280px",
          gap: 16,
          background: colors.bg,
          border: `1px solid ${colors.border}`,
          borderRadius: 8,
          padding: 16,
        }}
      >
        {/* Left: Prompt section stack */}
        <div>
          <div
            style={{
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              textTransform: "uppercase",
              letterSpacing: 1,
              color: colors.textSecondary,
              marginBottom: 10,
            }}
          >
            系統提示結構
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {effectiveSections.map((section) => {
              const isHovered = hoveredSection === section.id;
              const accent = getSectionAccent(section);
              const isBoundary = section.tier === "boundary";

              return (
                <motion.div
                  key={section.id}
                  onMouseEnter={() => setHoveredSection(section.id)}
                  onMouseLeave={() => setHoveredSection(null)}
                  animate={{
                    scale: isHovered ? 1.01 : 1,
                    borderColor: isHovered ? accent : getSectionBorder(section),
                  }}
                  transition={{ duration: 0.15 }}
                  style={{
                    background: getSectionBackground(section),
                    border: `1px solid ${getSectionBorder(section)}`,
                    borderRadius: isBoundary ? 0 : 6,
                    padding: isBoundary ? "8px 12px" : "8px 12px",
                    cursor: "pointer",
                    position: "relative",
                    borderLeft: isBoundary ? `3px solid ${colors.terracotta}` : `3px solid ${accent}`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: isBoundary ? 11 : 12,
                        fontFamily: "var(--font-mono)",
                        fontWeight: isBoundary ? 700 : 500,
                        color: isBoundary ? colors.terracotta : colors.text,
                        letterSpacing: isBoundary ? 1 : 0,
                      }}
                    >
                      {section.label}
                    </span>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {!isBoundary && (
                        <span
                          style={{
                            fontSize: 10,
                            fontFamily: "var(--font-mono)",
                            color: colors.textSecondary,
                            opacity: 0.8,
                          }}
                        >
                          {section.tokenEstimate}
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: 9,
                          fontFamily: "var(--font-mono)",
                          padding: "1px 6px",
                          borderRadius: 3,
                          background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                          color: accent,
                          fontWeight: 600,
                        }}
                      >
                        {getCacheScopeLabel(section)}
                      </span>
                    </div>
                  </div>

                  {/* Expanded on hover */}
                  <AnimatePresence>
                    {isHovered && !isBoundary && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.15 }}
                        style={{ overflow: "hidden" }}
                      >
                        <div
                          style={{
                            marginTop: 6,
                            fontSize: 11,
                            color: colors.textSecondary,
                            lineHeight: 1.5,
                          }}
                        >
                          {section.description}
                        </div>
                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 10,
                            fontFamily: "var(--font-mono)",
                            color: colors.textSecondary,
                            opacity: 0.8,
                          }}
                        >
                          {section.contents.map((c, i) => (
                            <div key={i} style={{ paddingLeft: 8, borderLeft: `1px solid ${accent}40`, marginBottom: 2 }}>
                              {c}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                    {isHovered && isBoundary && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.15 }}
                        style={{ overflow: "hidden" }}
                      >
                        <div
                          style={{
                            marginTop: 6,
                            fontSize: 11,
                            color: colors.terracotta,
                            lineHeight: 1.5,
                          }}
                        >
                          {section.description}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Right: Info panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Cache indicator */}
          <div
            style={{
              background: colors.bgCard,
              borderRadius: 6,
              padding: "12px 14px",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                textTransform: "uppercase",
                letterSpacing: 1,
                color: colors.textSecondary,
                marginBottom: 8,
              }}
            >
              快取狀態
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 6,
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: globalCacheDisabled ? colors.dynamicAccent : colors.staticAccent,
                }}
              />
              <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: colors.text }}>
                {globalCacheDisabled ? "全域快取已停用" : "全域快取已啟用"}
              </span>
            </div>
            <div style={{ fontSize: 11, color: colors.textSecondary, lineHeight: 1.5 }}>
              {globalCacheDisabled
                ? "MCP 工具定義是使用者特定的。它們會將全域快取碎片化為數百萬個唯一前綴。"
                : `靜態區段（約 ${staticTokens.toLocaleString()} 個 token）在所有 Claude Code 使用者、工作階段和組織之間快取。`}
            </div>
          </div>

          {/* Feature toggles */}
          <div
            style={{
              background: colors.bgCard,
              borderRadius: 6,
              padding: "12px 14px",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                textTransform: "uppercase",
                letterSpacing: 1,
                color: colors.textSecondary,
                marginBottom: 8,
              }}
            >
              功能開關
            </div>

            {TOGGLE_FEATURES.map((feature) => {
              const isOn = features[feature.id];
              return (
                <div key={feature.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <button
                      onClick={() => toggleFeature(feature.id)}
                      style={{
                        width: 36,
                        height: 20,
                        borderRadius: 10,
                        border: "none",
                        cursor: "pointer",
                        position: "relative",
                        background: isOn ? colors.terracotta : (isDark ? "#444" : "#ccc"),
                        transition: "background 0.2s",
                        flexShrink: 0,
                      }}
                    >
                      <motion.div
                        animate={{ x: isOn ? 16 : 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          background: "#fff",
                          position: "absolute",
                          top: 2,
                          left: 2,
                          boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                        }}
                      />
                    </button>
                    <span style={{ fontSize: 12, color: colors.text }}>{feature.label}</span>
                  </div>
                  <AnimatePresence>
                    {isOn && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.15 }}
                        style={{
                          fontSize: 10,
                          fontFamily: "var(--font-mono)",
                          color: colors.terracotta,
                          paddingLeft: 44,
                          lineHeight: 1.4,
                          overflow: "hidden",
                        }}
                      >
                        {feature.effect}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          {/* 2^N explanation */}
          <div
            style={{
              background: isDark ? "rgba(217,119,87,0.08)" : "rgba(217,119,87,0.05)",
              border: `1px solid ${isDark ? "rgba(217,119,87,0.2)" : "rgba(217,119,87,0.15)"}`,
              borderRadius: 6,
              padding: "10px 12px",
              fontSize: 11,
              color: colors.textSecondary,
              lineHeight: 1.6,
            }}
          >
            <div style={{ fontWeight: 600, color: colors.terracotta, marginBottom: 4, fontFamily: "var(--font-mono)", fontSize: 10 }}>
              2^N 問題
            </div>
            邊界之前的每個條件都會使唯一全域快取條目數量倍增。
            {Object.values(features).filter(Boolean).length > 0 && (
              <span style={{ color: colors.terracotta, fontWeight: 600 }}>
                {" "}當前啟用的開關：{Object.values(features).filter(Boolean).length} = {Math.pow(2, Object.values(features).filter(Boolean).length)} 個快取變體。
              </span>
            )}
            {" "}靜態區段刻意設計為無條件，以防止快取碎片化。
          </div>

          {/* Legend */}
          <div
            style={{
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: colors.textSecondary,
              lineHeight: 1.8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 2, background: colors.staticBg, border: `1px solid ${colors.staticBorder}` }} />
              <span>靜態（全域快取）</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 2, background: colors.boundaryBg, border: `1px solid ${colors.boundaryBorder}` }} />
              <span>動態邊界</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 2, background: colors.dynamicBg, border: `1px solid ${colors.dynamicBorder}` }} />
              <span>動態（每工作階段）</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 2, background: colors.uncachedBg, border: `1px solid ${colors.uncachedBorder}` }} />
              <span>未快取（危險）</span>
            </div>
          </div>

          {/* Hover hint */}
          <div
            style={{
              textAlign: "center",
              fontSize: 11,
              color: colors.textSecondary,
              fontStyle: "italic",
            }}
          >
            滑鼠懸停區段查看詳情
          </div>
        </div>
      </div>

      {/* DANGEROUS naming convention callout */}
      <div
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}
      >
        <div
          style={{
            background: colors.bgCard,
            borderRadius: 6,
            padding: "10px 12px",
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            color: colors.textSecondary,
            lineHeight: 1.6,
          }}
        >
          <div style={{ fontWeight: 600, color: colors.staticAccent, marginBottom: 4 }}>
            systemPromptSection()
          </div>
          安全。內容放在邊界之前。全域快取。不允許執行時條件。
        </div>
        <div
          style={{
            background: colors.bgCard,
            borderRadius: 6,
            padding: "10px 12px",
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            color: colors.textSecondary,
            lineHeight: 1.6,
          }}
        >
          <div style={{ fontWeight: 600, color: colors.uncachedAccent, marginBottom: 4 }}>
            DANGEROUS_uncachedSystemPromptSection(_reason)
          </div>
          破壞快取。需要提供原因字串。_reason 參數在原始碼中是強制性文件。
        </div>
      </div>
    </div>
  );
}
