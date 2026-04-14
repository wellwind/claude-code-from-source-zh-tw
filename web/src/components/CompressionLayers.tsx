import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// --- Types ---

interface Message {
  id: string;
  type: "user" | "assistant" | "tool_result";
  label: string;
  tokens: number;
  visible: boolean;
  compressed: boolean;
  summary: boolean;
  height: number; // visual height in px
}

// --- Initial conversation ---

function createConversation(): Message[] {
  return [
    { id: "u1", type: "user", label: "建立專案結構", tokens: 400, visible: true, compressed: false, summary: false, height: 28 },
    { id: "a1", type: "assistant", label: "我會建立目錄和檔案...", tokens: 1200, visible: true, compressed: false, summary: false, height: 36 },
    { id: "t1", type: "tool_result", label: "Bash: mkdir -p src/components (output: 2.1K chars)", tokens: 3800, visible: true, compressed: false, summary: false, height: 44 },
    { id: "t2", type: "tool_result", label: "Write: src/index.ts (output: 4.5K chars)", tokens: 6200, visible: true, compressed: false, summary: false, height: 52 },
    { id: "a2", type: "assistant", label: "現在讓我來設定建構系統...", tokens: 2400, visible: true, compressed: false, summary: false, height: 38 },
    { id: "t3", type: "tool_result", label: "Read: package.json (output: 8.2K chars)", tokens: 12000, visible: true, compressed: false, summary: false, height: 56 },
    { id: "t4", type: "tool_result", label: "Glob: **/*.config.ts (output: 1.8K chars)", tokens: 2800, visible: true, compressed: false, summary: false, height: 40 },
    { id: "u2", type: "user", label: "現在加入帶有 session 的身份驗證", tokens: 600, visible: true, compressed: false, summary: false, height: 28 },
    { id: "a3", type: "assistant", label: "我會使用 better-auth 實作基於 session 的驗證...", tokens: 3200, visible: true, compressed: false, summary: false, height: 42 },
    { id: "t5", type: "tool_result", label: "Read: src/auth/config.ts (output: 12K chars)", tokens: 18000, visible: true, compressed: false, summary: false, height: 62 },
    { id: "t6", type: "tool_result", label: "Write: src/auth/session.ts (output: 6.8K chars)", tokens: 9400, visible: true, compressed: false, summary: false, height: 54 },
    { id: "t7", type: "tool_result", label: "Read: src/database/schema.ts (output: 22K chars)", tokens: 28000, visible: true, compressed: false, summary: false, height: 68 },
    { id: "a4", type: "assistant", label: "驗證已設定完成。讓我加入中介軟體...", tokens: 1800, visible: true, compressed: false, summary: false, height: 36 },
    { id: "t8", type: "tool_result", label: "Write: src/middleware/auth.ts (output: 9.1K chars)", tokens: 14000, visible: true, compressed: false, summary: false, height: 58 },
    { id: "u3", type: "user", label: "為資源加入 CRUD 端點", tokens: 500, visible: true, compressed: false, summary: false, height: 28 },
    { id: "a5", type: "assistant", label: "我會為每個資源建立 tRPC 路由器...", tokens: 4200, visible: true, compressed: false, summary: false, height: 44 },
    { id: "t9", type: "tool_result", label: "Read: src/routers/index.ts (output: 15K chars)", tokens: 22000, visible: true, compressed: false, summary: false, height: 64 },
    { id: "t10", type: "tool_result", label: "Write: src/routers/users.ts (output: 11K chars)", tokens: 16000, visible: true, compressed: false, summary: false, height: 60 },
    { id: "t11", type: "tool_result", label: "Write: src/routers/posts.ts (output: 14K chars)", tokens: 20000, visible: true, compressed: false, summary: false, height: 64 },
    { id: "a6", type: "assistant", label: "路由器已就緒。正在執行型別檢查...", tokens: 1600, visible: true, compressed: false, summary: false, height: 34 },
    { id: "t12", type: "tool_result", label: "Bash: bun run check-types (output: 18K chars)", tokens: 24000, visible: true, compressed: false, summary: false, height: 66 },
    { id: "t13", type: "tool_result", label: "Bash: bun run test (output: 6.2K chars)", tokens: 8400, visible: true, compressed: false, summary: false, height: 52 },
  ];
}

const TOTAL_CAPACITY = 200000;

// --- Layer definitions ---

interface Layer {
  id: number;
  name: string;
  description: string;
  apply: (messages: Message[]) => Message[];
}

const layers: Layer[] = [
  {
    id: 1,
    name: "工具結果預算",
    description: "強制執行每則訊息的大小限制。裁切大型工具輸出以符合預算。",
    apply: (msgs) =>
      msgs.map((m) => {
        if (m.type === "tool_result" && m.tokens > 10000) {
          return {
            ...m,
            tokens: Math.floor(m.tokens * 0.4),
            compressed: true,
            height: Math.max(32, Math.floor(m.height * 0.5)),
            label: m.label.replace(/output: [\d.]+K chars/, "clipped to budget"),
          };
        }
        return m;
      }),
  },
  {
    id: 2,
    name: "剪裁壓縮",
    description: "從對話中實際移除舊訊息。保留系統提示詞和近期上下文。",
    apply: (msgs) => {
      // Remove first ~30% of visible messages
      const visibleIds = msgs.filter((m) => m.visible).map((m) => m.id);
      const cutoff = Math.floor(visibleIds.length * 0.3);
      const toRemove = new Set(visibleIds.slice(0, cutoff));
      return msgs.map((m) =>
        toRemove.has(m.id) ? { ...m, visible: false } : m,
      );
    },
  },
  {
    id: 3,
    name: "微型壓縮",
    description: "從快取中移除過時的工具結果。保留結構，丟棄舊工具輸出的內容。",
    apply: (msgs) =>
      msgs.map((m) => {
        if (m.type === "tool_result" && m.visible && !m.compressed) {
          return {
            ...m,
            tokens: Math.floor(m.tokens * 0.3),
            compressed: true,
            height: 24,
            label: m.label.replace(/\(output:.*\)/, "(cached: stub)"),
          };
        }
        return m;
      }),
  },
  {
    id: 4,
    name: "上下文摺疊",
    description: "用 AI 生成的摘要取代冗長的訊息區段。",
    apply: (msgs) => {
      const visible = msgs.filter((m) => m.visible);
      if (visible.length <= 4) return msgs;
      // Collapse middle section into a summary
      const middleStart = 2;
      const middleEnd = visible.length - 2;
      const middleIds = new Set(
        visible.slice(middleStart, middleEnd).map((m) => m.id),
      );
      const collapsedTokens = msgs
        .filter((m) => middleIds.has(m.id))
        .reduce((sum, m) => sum + m.tokens, 0);
      const result = msgs.map((m) =>
        middleIds.has(m.id) ? { ...m, visible: false } : m,
      );
      // Insert summary after last visible before middle
      const insertIdx = result.findIndex((m) => m.id === visible[middleStart - 1].id) + 1;
      result.splice(insertIdx, 0, {
        id: "summary-1",
        type: "assistant",
        label: "[摘要] 建立專案、設定驗證、建立路由器、執行檢查",
        tokens: Math.floor(collapsedTokens * 0.08),
        visible: true,
        compressed: false,
        summary: true,
        height: 32,
      });
      return result;
    },
  },
  {
    id: 5,
    name: "自動壓縮",
    description: "緊急全文摘要。以簡潔摘要取代整個對話。斷路器防止重複觸發。",
    apply: (msgs) => {
      const totalTokens = msgs
        .filter((m) => m.visible)
        .reduce((sum, m) => sum + m.tokens, 0);
      return [
        {
          id: "auto-summary",
          type: "assistant" as const,
          label: "[自動壓縮摘要] 完整 session 上下文：專案設定、驗證實作、CRUD 路由器、型別檢查通過、測試通過",
          tokens: Math.min(30000, Math.floor(totalTokens * 0.15)),
          visible: true,
          compressed: false,
          summary: true,
          height: 40,
        },
      ];
    },
  },
];

// --- Component ---

interface Props {
  className?: string;
}

export default function CompressionLayers({ className }: Props) {
  const [messages, setMessages] = useState<Message[]>(createConversation);
  const [appliedLayers, setAppliedLayers] = useState(0);
  const [savedPerLayer, setSavedPerLayer] = useState<number[]>([]);
  const [isDark, setIsDark] = useState(false);

  // Dark mode detection
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

  const totalTokens = messages
    .filter((m) => m.visible)
    .reduce((sum, m) => sum + m.tokens, 0);
  const usagePercent = (totalTokens / TOTAL_CAPACITY) * 100;

  const getTokenColor = () => {
    if (usagePercent < 50) return "#22c55e";
    if (usagePercent < 80) return "#eab308";
    return "#ef4444";
  };

  const getMessageColor = (msg: Message) => {
    if (msg.summary) return "#eda100";
    if (msg.type === "user") return "#d97757";
    if (msg.type === "assistant") return isDark ? "#87867f" : "#87867f";
    return isDark ? "#555" : "#c2c0b6";
  };

  const handleApplyLayer = useCallback(() => {
    if (appliedLayers >= 5) return;
    const layer = layers[appliedLayers];
    const tokensBefore = messages
      .filter((m) => m.visible)
      .reduce((sum, m) => sum + m.tokens, 0);
    const newMessages = layer.apply(messages);
    const tokensAfter = newMessages
      .filter((m) => m.visible)
      .reduce((sum, m) => sum + m.tokens, 0);
    setMessages(newMessages);
    setSavedPerLayer((prev) => [...prev, tokensBefore - tokensAfter]);
    setAppliedLayers((prev) => prev + 1);
  }, [appliedLayers, messages]);

  const handleReset = useCallback(() => {
    setMessages(createConversation());
    setAppliedLayers(0);
    setSavedPerLayer([]);
  }, []);

  const colors = {
    text: isDark ? "#f5f4ed" : "#141413",
    textMuted: isDark ? "#87867f" : "#87867f",
    border: isDark ? "#333" : "#c2c0b6",
    panelBg: isDark ? "rgba(30,30,28,0.5)" : "rgba(255,255,255,0.5)",
    barBg: isDark ? "#2a2a28" : "#e8e7e3",
  };

  const formatTokens = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n);
  };

  return (
    <div className={className} style={{ fontFamily: "var(--font-serif)" }}>
      {/* Token counter */}
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontFamily: "var(--font-mono)",
              color: colors.text,
              fontWeight: 600,
            }}
          >
            Used:{" "}
            <motion.span
              key={totalTokens}
              initial={{ opacity: 0.5 }}
              animate={{ opacity: 1 }}
              style={{ color: getTokenColor() }}
            >
              {formatTokens(totalTokens)}
            </motion.span>{" "}
            / {formatTokens(TOTAL_CAPACITY)} token
          </span>
          <span
            style={{
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              color: colors.textMuted,
            }}
          >
            {usagePercent.toFixed(0)}% 容量
          </span>
        </div>
        <div
          style={{
            height: 8,
            borderRadius: 4,
            background: colors.barBg,
            overflow: "hidden",
          }}
        >
          <motion.div
            animate={{ width: `${Math.min(100, usagePercent)}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            style={{
              height: "100%",
              borderRadius: 4,
              background: getTokenColor(),
            }}
          />
        </div>
      </div>

      {/* Main layout: messages + layers */}
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        {/* Message stack */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            padding: 16,
            background: colors.panelBg,
            maxHeight: 420,
            overflowY: "auto",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: colors.textMuted,
              marginBottom: 12,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            對話 ({messages.filter((m) => m.visible).length} 則訊息)
          </div>
          <AnimatePresence>
            {messages.map(
              (msg) =>
                msg.visible && (
                  <motion.div
                    key={msg.id}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{
                      opacity: 1,
                      height: msg.height,
                    }}
                    exit={{
                      opacity: 0,
                      height: 0,
                      marginBottom: 0,
                    }}
                    transition={{ duration: 0.4, ease: "easeInOut" }}
                    style={{
                      borderRadius: 6,
                      marginBottom: 6,
                      overflow: "hidden",
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      paddingInline: 12,
                      background: msg.summary
                        ? "rgba(237, 161, 0, 0.12)"
                        : msg.compressed
                          ? isDark
                            ? "rgba(255,255,255,0.03)"
                            : "rgba(0,0,0,0.02)"
                          : isDark
                            ? "rgba(255,255,255,0.05)"
                            : "rgba(0,0,0,0.03)",
                      borderLeft: `3px solid ${getMessageColor(msg)}`,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          color: msg.summary ? "#eda100" : colors.text,
                          fontFamily: "var(--font-mono)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          fontWeight: msg.summary ? 600 : 400,
                        }}
                      >
                        {msg.label}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        fontFamily: "var(--font-mono)",
                        color: colors.textMuted,
                        marginLeft: 8,
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      {formatTokens(msg.tokens)}
                    </div>
                  </motion.div>
                ),
            )}
          </AnimatePresence>
        </div>

        {/* Layer controls */}
        <div style={{ width: 220, flexShrink: 0 }}>
          <div
            style={{
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: colors.textMuted,
              marginBottom: 12,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            壓縮層
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {layers.map((layer, i) => {
              const isNext = i === appliedLayers;
              const isApplied = i < appliedLayers;
              return (
                <div key={layer.id}>
                  <button
                    onClick={isNext ? handleApplyLayer : undefined}
                    disabled={!isNext}
                    title={layer.description}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      background: isApplied
                        ? "rgba(217, 119, 87, 0.1)"
                        : isNext
                          ? isDark
                            ? "rgba(255,255,255,0.05)"
                            : "rgba(0,0,0,0.03)"
                          : "transparent",
                      border: isNext
                        ? `2px solid #d97757`
                        : `1px solid ${isApplied ? "rgba(217, 119, 87, 0.3)" : colors.border}`,
                      borderRadius: 8,
                      padding: "10px 12px",
                      cursor: isNext ? "pointer" : "default",
                      opacity: !isNext && !isApplied ? 0.4 : 1,
                      transition: "all 0.2s",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        fontFamily: "var(--font-mono)",
                        color: isApplied ? "#d97757" : isNext ? colors.text : colors.textMuted,
                        marginBottom: 2,
                      }}
                    >
                      {layer.id}. {layer.name}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: colors.textMuted,
                        lineHeight: 1.4,
                      }}
                    >
                      {isApplied && savedPerLayer[i] !== undefined
                        ? `節省了 ${formatTokens(savedPerLayer[i])} token`
                        : isNext
                          ? "點擊套用"
                          : layer.description.slice(0, 50) + "..."}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Reset */}
          <button
            onClick={handleReset}
            style={{
              marginTop: 16,
              width: "100%",
              background: "transparent",
              border: `1px solid ${colors.border}`,
              color: colors.textMuted,
              borderRadius: 6,
              padding: "8px 12px",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
            }}
          >
            重置對話
          </button>

          {/* Total saved */}
          {savedPerLayer.length > 0 && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 12px",
                borderRadius: 8,
                background: "rgba(34, 197, 94, 0.08)",
                border: "1px solid rgba(34, 197, 94, 0.2)",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontFamily: "var(--font-mono)",
                  color: "#22c55e",
                  fontWeight: 600,
                }}
              >
                總共節省：{" "}
                {formatTokens(savedPerLayer.reduce((a, b) => a + b, 0))} token
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
