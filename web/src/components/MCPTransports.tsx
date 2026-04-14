import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// --- Types ---

type View = "grid" | "decision" | "oauth";

interface TransportType {
  id: string;
  name: string;
  category: string;
  categoryColor: string;
  description: string;
  howItWorks: string;
  whenToUse: string;
  connectionFlow: string[];
}

interface DecisionNode {
  id: string;
  question: string;
  options: { label: string; next: string }[];
  result?: string;
  resultTransport?: string;
}

interface OAuthStep {
  id: number;
  title: string;
  description: string;
  detail: string;
}

// --- Data ---

const transports: TransportType[] = [
  {
    id: "stdio",
    name: "stdio",
    category: "Local",
    categoryColor: "#4ade80",
    description: "使用 stdin/stdout 的 JSON-RPC 子行程。未指定 type 時的預設值。",
    howItWorks: "Claude Code 產生一個子行程。JSON-RPC 訊息通過 stdin（用戶端到伺服器）和 stdout（伺服器到用戶端）進行管道傳遞。無網路，無認證。",
    whenToUse: "本機工具：檔案系統存取、資料庫查詢、自訂腳本。最常見的傳輸層。",
    connectionFlow: ["產生子行程", "管道 stdin/stdout", "傳送 tools/list", "就緒"],
  },
  {
    id: "sse",
    name: "SSE (Server-Sent Events)",
    category: "Remote",
    categoryColor: "#60a5fa",
    description: "與舊 HTTP 傳輸層。用戶端透過 POST 傳送請求，伺服器通過 SSE 串流推送回應。",
    howItWorks: "用戶端建立 SSE 連線接收伺服器到用戶端的訊息。用戶端到伺服器的訊息透過 HTTP POST 傳送。廣泛部署但正被取代。",
    whenToUse: "2025 年之前部署的與舊 MCP 伺服器。在生態系中仍然常見。",
    connectionFlow: ["HTTP GET /sse", "建立 SSE 串流", "POST 請求", "SSE 回應"],
  },
  {
    id: "http",
    name: "Streamable HTTP",
    category: "Remote",
    categoryColor: "#60a5fa",
    description: "當前規格建議。POST 搭配可選的 SSE 用於串流回應。",
    howItWorks: "用戶端透過 HTTP POST 傳送 JSON-RPC。伺服器可以以 JSON（簡單）或升級為 SSE 串流（串流）回應。透過工作階段 ID 實現雙向通訊。",
    whenToUse: "新的遠端 MCP 伺服器。當前規格建議。",
    connectionFlow: ["POST /mcp", "回應：JSON 或 SSE", "追蹤工作階段 ID", "-32001 時重試"],
  },
  {
    id: "ws",
    name: "WebSocket",
    category: "Remote",
    categoryColor: "#60a5fa",
    description: "全雙工雙向通訊。實務中較少見。",
    howItWorks: "標準 WebSocket 連線。JSON-RPC 訊息在兩個方向流動。Bun 和 Node 有不同的 WebSocket API — 需要執行環境分支。",
    whenToUse: "當需要伺服器主動發起的雙向通訊時。除了 IDE 整合外很少見。",
    connectionFlow: ["WS 握手", "雙向通道", "JSON-RPC 雙向", "斷開時關閉"],
  },
  {
    id: "sdk",
    name: "SDK Transport",
    category: "In-Process",
    categoryColor: "#a78bfa",
    description: "透過 stdin/stdout 傳遞控制訊息，用於 SDK 嵌入情境。",
    howItWorks: "當 Claude Code 透過 SDK 作為子行程執行時使用。控制訊息（MCP 請求）與代理通訊共用相同的 stdin/stdout 進行多工傳輸。",
    whenToUse: "當透過官方 SDK 在 Claude Code 之上建構時。",
    connectionFlow: ["SDK 產生 Claude Code", "多工控制訊息", "MCP 透過 stdin/stdout", "共享通道"],
  },
  {
    id: "sse-ide",
    name: "IDE stdio",
    category: "IDE",
    categoryColor: "#f472b6",
    description: "VS Code 或 JetBrains 擴充套件透過 stdio 通道通訊。",
    howItWorks: "IDE 擴充套件透過其擴充 API 提供 MCP 伺服器。通訊使用 IDE 內建的 stdio 通道而非網路。",
    whenToUse: "透過 IDE 原生通道暴露 MCP 工具的 VS Code 擴充套件。",
    connectionFlow: ["IDE 擴充載入", "開啟 stdio 通道", "MCP 握手", "工具可用"],
  },
  {
    id: "ws-ide",
    name: "IDE WebSocket",
    category: "IDE",
    categoryColor: "#f472b6",
    description: "IDE 透過 WebSocket 的遠端連線。具有執行環境差異（Bun vs Node）。",
    howItWorks: "通過 WebSocket 連接到遠端執行的 IDE 擴充套件。Bun 的 WebSocket 原生支援 proxy/TLS；Node 需要 ws 套件。",
    whenToUse: "遠端 IDE 連線（例如 JetBrains Gateway、VS Code Remote）。",
    connectionFlow: ["WS 連接 IDE", "執行環境偵測", "Bun 原生 / Node ws", "MCP 就緒"],
  },
  {
    id: "inprocess",
    name: "In-Process",
    category: "In-Process",
    categoryColor: "#a78bfa",
    description: "鏈接傳輸層配對。直接函式呼叫。總共 63 行。",
    howItWorks: "兩個 InProcessTransport 實例作為對等端鏈接。send() 透過 queueMicrotask() 傳遞以避免堪疊深度問題。close() 會級聯到對等端。",
    whenToUse: "同行程 MCP 伺服器：Chrome MCP、Computer Use MCP。零網路開銷。",
    connectionFlow: ["建立鏈接配對", "queueMicrotask 傳遞", "直接函式呼叫", "級聯關閉"],
  },
];

const decisionTree: DecisionNode[] = [
  {
    id: "start",
    question: "你的 MCP 伺服器在哪裡？",
    options: [
      { label: "同一台機器（本機行程）", next: "local" },
      { label: "遠端服務（HTTP/WS）", next: "remote" },
      { label: "同一行程（嵌入式）", next: "inprocess" },
      { label: "IDE 擴充套件", next: "ide" },
    ],
  },
  {
    id: "local",
    question: "",
    options: [],
    result: "使用 stdio — 無網路、無認證，只有管道。預設且最常見的傳輸層。",
    resultTransport: "stdio",
  },
  {
    id: "remote",
    question: "伺服器需要串流回應嗎？",
    options: [
      { label: "是，需要串流", next: "remote-stream" },
      { label: "不，簡單的請求/回應", next: "remote-simple" },
      { label: "需要完整雙向通訊", next: "remote-bidi" },
    ],
  },
  {
    id: "remote-stream",
    question: "伺服器是 2025 年之前的與舊部署嗎？",
    options: [
      { label: "是，與舊伺服器", next: "remote-legacy" },
      { label: "不，新伺服器", next: "remote-new" },
    ],
  },
  {
    id: "remote-legacy",
    question: "",
    options: [],
    result: "使用 SSE — 與舊但廣泛部署。伺服器透過 Server-Sent Events 推送回應。",
    resultTransport: "sse",
  },
  {
    id: "remote-new",
    question: "",
    options: [],
    result: "使用 Streamable HTTP — 當前規格建議。POST 搭配可選的 SSE 升級。",
    resultTransport: "http",
  },
  {
    id: "remote-simple",
    question: "",
    options: [],
    result: "使用 Streamable HTTP — 也適用於簡單的 JSON 回應。遠端的規格預設。",
    resultTransport: "http",
  },
  {
    id: "remote-bidi",
    question: "",
    options: [],
    result: "使用 WebSocket — 全雙工雙向。注意：Bun/Node 執行環境對 ws 套件有分支。",
    resultTransport: "ws",
  },
  {
    id: "inprocess",
    question: "伺服器是用 MCP SDK 建構的嗎？",
    options: [
      { label: "是，基於 SDK", next: "inprocess-sdk" },
      { label: "不，同行程中的自訂伺服器", next: "inprocess-linked" },
    ],
  },
  {
    id: "inprocess-sdk",
    question: "",
    options: [],
    result: "使用 SDK 傳輸層 — 在現有的 stdin/stdout 通道上多工傳輸 MCP。",
    resultTransport: "sdk",
  },
  {
    id: "inprocess-linked",
    question: "",
    options: [],
    result: "使用 InProcessTransport — 以 queueMicrotask 傳遞的鏈接配對。僅 63 行。",
    resultTransport: "inprocess",
  },
  {
    id: "ide",
    question: "IDE 是本機還是遠端？",
    options: [
      { label: "本機 IDE（VS Code、JetBrains）", next: "ide-local" },
      { label: "遠端 IDE（Gateway、Remote SSH）", next: "ide-remote" },
    ],
  },
  {
    id: "ide-local",
    question: "",
    options: [],
    result: "使用 IDE stdio — 透過 IDE 內建的擴充通道通訊。",
    resultTransport: "sse-ide",
  },
  {
    id: "ide-remote",
    question: "",
    options: [],
    result: "使用 IDE WebSocket — 遠端連接。處理 Bun/Node 執行環境差異。",
    resultTransport: "ws-ide",
  },
];

const oauthSteps: OAuthStep[] = [
  {
    id: 1,
    title: "伺服器回傳 401",
    description: "MCP 伺服器要求認證",
    detail: "對 MCP 伺服器的初始請求回傳 HTTP 401 Unauthorized。這會觸發 OAuth 探索鏈。",
  },
  {
    id: 2,
    title: "RFC 9728 探索",
    description: "探測 /.well-known/oauth-protected-resource",
    detail: "對伺服器的 well-known 端點發送 GET 請求。若找到，擷取 authorization_servers[0] 並對該 URL 執行 RFC 8414 探索。",
  },
  {
    id: 3,
    title: "RFC 8414 元資料",
    description: "探索授權伺服器元資料",
    detail: "獲取 OpenID/OAuth 元資料文件。包含：token_endpoint、authorization_endpoint、支援的 scope、PKCE 要求。若找不到則回退到路徑感知探測。",
  },
  {
    id: 4,
    title: "OAuth 2.0 + PKCE 流程",
    description: "基於瀏覽器的授權，搭配代碼驗證器",
    detail: "PKCE（Proof Key for Code Exchange）防止授權碼被攔截。產生 code_verifier，計算 code_challenge，將使用者導向授權頁面，交換代碼取得 token。",
  },
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

// --- Component ---

interface Props {
  className?: string;
}

export default function MCPTransports({ className }: Props) {
  const isDark = useDarkMode();
  const [view, setView] = useState<View>("grid");
  const [selectedTransport, setSelectedTransport] = useState<string | null>(null);
  const [decisionPath, setDecisionPath] = useState<string[]>(["start"]);
  const [activeOAuthStep, setActiveOAuthStep] = useState<number | null>(null);

  const colors = {
    accent: "#d97757",
    accentBg: isDark ? "rgba(217, 119, 87, 0.08)" : "rgba(217, 119, 87, 0.05)",
    accentBorder: "rgba(217, 119, 87, 0.5)",
    text: isDark ? "#f5f4ed" : "#141413",
    textSecondary: "#87867f",
    cardBg: isDark ? "#1e1e1c" : "#ffffff",
    cardBorder: isDark ? "#333" : "#e8e6dc",
    surfaceBg: isDark ? "#30302e" : "#f5f4ed",
    green: "#4ade80",
    greenBg: isDark ? "rgba(74, 222, 128, 0.1)" : "rgba(74, 222, 128, 0.08)",
  };

  const currentDecisionNode = decisionTree.find(
    (n) => n.id === decisionPath[decisionPath.length - 1]
  );

  const advanceDecision = useCallback(
    (nextId: string) => {
      setDecisionPath((prev) => [...prev, nextId]);
    },
    []
  );

  const resetDecision = useCallback(() => {
    setDecisionPath(["start"]);
  }, []);

  const goBackDecision = useCallback(() => {
    setDecisionPath((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  return (
    <div className={className} style={{ fontFamily: "var(--font-serif)" }}>
      {/* View tabs */}
      <div
        style={{
          display: "flex",
          gap: 0,
          marginBottom: 24,
          borderBottom: `1px solid ${colors.cardBorder}`,
        }}
      >
        {([
          { id: "grid" as View, label: "8 種傳輸層" },
          { id: "decision" as View, label: "該用哪一種？" },
          { id: "oauth" as View, label: "OAuth 探索" },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            style={{
              padding: "12px 20px",
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "var(--font-mono)",
              background: "none",
              border: "none",
              borderBottom:
                view === tab.id
                  ? `2px solid ${colors.accent}`
                  : "2px solid transparent",
              color: view === tab.id ? colors.accent : colors.textSecondary,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {view === "grid" && (
          <motion.div
            key="grid"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <TransportGrid
              colors={colors}
              isDark={isDark}
              selectedTransport={selectedTransport}
              setSelectedTransport={setSelectedTransport}
            />
          </motion.div>
        )}
        {view === "decision" && (
          <motion.div
            key="decision"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <DecisionTree
              colors={colors}
              isDark={isDark}
              currentNode={currentDecisionNode!}
              path={decisionPath}
              onAdvance={advanceDecision}
              onReset={resetDecision}
              onBack={goBackDecision}
            />
          </motion.div>
        )}
        {view === "oauth" && (
          <motion.div
            key="oauth"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <OAuthFlow
              colors={colors}
              isDark={isDark}
              activeStep={activeOAuthStep}
              setActiveStep={setActiveOAuthStep}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Transport Grid ---

function TransportGrid({
  colors,
  isDark,
  selectedTransport,
  setSelectedTransport,
}: {
  colors: Record<string, string>;
  isDark: boolean;
  selectedTransport: string | null;
  setSelectedTransport: (id: string | null) => void;
}) {
  const categories = ["Local", "Remote", "In-Process", "IDE"];

  return (
    <div>
      {/* Category legend */}
      <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        {categories.map((cat) => {
          const t = transports.find((tr) => tr.category === cat);
          return (
            <div key={cat} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: t?.categoryColor || "#888",
                }}
              />
              <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: colors.textSecondary }}>
                {cat}
              </span>
            </div>
          );
        })}
      </div>

      {/* Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 10,
          marginBottom: 16,
        }}
      >
        {transports.map((transport) => {
          const isSelected = selectedTransport === transport.id;
          return (
            <motion.button
              key={transport.id}
              onClick={() =>
                setSelectedTransport(isSelected ? null : transport.id)
              }
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                padding: "14px 16px",
                borderRadius: 10,
                border: `1px solid ${isSelected ? transport.categoryColor : colors.cardBorder}`,
                background: isSelected
                  ? `${transport.categoryColor}10`
                  : colors.cardBg,
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.2s",
                position: "relative",
              }}
            >
              {/* Category dot */}
              <div
                style={{
                  position: "absolute",
                  top: 14,
                  right: 14,
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: transport.categoryColor,
                }}
              />

              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: "var(--font-mono)",
                  color: isSelected ? transport.categoryColor : colors.text,
                  marginBottom: 4,
                  paddingRight: 20,
                }}
              >
                {transport.name}
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                  color: transport.categoryColor,
                  marginBottom: 8,
                }}
              >
                {transport.category}
              </div>
              <div style={{ fontSize: 11, color: colors.textSecondary, lineHeight: 1.5 }}>
                {transport.description}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Selected transport detail */}
      <AnimatePresence>
        {selectedTransport && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            {(() => {
              const t = transports.find((tr) => tr.id === selectedTransport);
              if (!t) return null;
              return (
                <div
                  style={{
                    padding: "18px 22px",
                    borderRadius: 12,
                    border: `1px solid ${t.categoryColor}40`,
                    background: `${t.categoryColor}08`,
                  }}
                >
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: colors.text,
                      marginBottom: 16,
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {t.name}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: t.categoryColor,
                          fontFamily: "var(--font-mono)",
                          marginBottom: 6,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        運作方式
                      </div>
                      <div style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 1.6 }}>
                        {t.howItWorks}
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: t.categoryColor,
                          fontFamily: "var(--font-mono)",
                          marginBottom: 6,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        使用時機
                      </div>
                      <div style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 1.6 }}>
                        {t.whenToUse}
                      </div>
                    </div>
                  </div>

                  {/* Connection flow */}
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: t.categoryColor,
                      fontFamily: "var(--font-mono)",
                      marginBottom: 8,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    連線流程
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                    {t.connectionFlow.map((step, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                        <div
                          style={{
                            flex: 1,
                            textAlign: "center",
                            padding: "8px 6px",
                            borderRadius: 8,
                            background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                            fontSize: 11,
                            fontFamily: "var(--font-mono)",
                            color: colors.text,
                          }}
                        >
                          {step}
                        </div>
                        {i < t.connectionFlow.length - 1 && (
                          <svg width="16" height="12" viewBox="0 0 16 12" fill="none" style={{ flexShrink: 0 }}>
                            <path d="M2 6H14M14 6L10 2M14 6L10 10" stroke={t.categoryColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Decision Tree ---

function DecisionTree({
  colors,
  isDark,
  currentNode,
  path,
  onAdvance,
  onReset,
  onBack,
}: {
  colors: Record<string, string>;
  isDark: boolean;
  currentNode: DecisionNode;
  path: string[];
  onAdvance: (id: string) => void;
  onReset: () => void;
  onBack: () => void;
}) {
  const isResult = !!currentNode.result;

  return (
    <div>
      {/* Path breadcrumb */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        {path.map((nodeId, i) => {
          const node = decisionTree.find((n) => n.id === nodeId);
          return (
            <div key={nodeId} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {i > 0 && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M4 2L8 6L4 10" stroke={colors.textSecondary} strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              )}
              <span
                style={{
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  color: i === path.length - 1 ? colors.accent : colors.textSecondary,
                  fontWeight: i === path.length - 1 ? 600 : 400,
                }}
              >
                {node?.result ? "結果" : node?.question?.split("？")[0] || "開始"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Current node */}
      <motion.div
        key={currentNode.id}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
        style={{
          padding: "24px 28px",
          borderRadius: 14,
          border: `1px solid ${isResult ? colors.green : colors.cardBorder}`,
          background: isResult ? colors.greenBg : colors.cardBg,
          marginBottom: 20,
        }}
      >
        {isResult ? (
          <div>
            <div
              style={{
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                fontWeight: 600,
                color: colors.green,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: 8,
              }}
            >
              推薦
            </div>
            <div style={{ fontSize: 15, color: colors.text, lineHeight: 1.6, marginBottom: 16 }}>
              {currentNode.result}
            </div>
            {currentNode.resultTransport && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  borderRadius: 8,
                  background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  fontWeight: 600,
                  color: transports.find((t) => t.id === currentNode.resultTransport)?.categoryColor || colors.accent,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: transports.find((t) => t.id === currentNode.resultTransport)?.categoryColor || colors.accent,
                  }}
                />
                {transports.find((t) => t.id === currentNode.resultTransport)?.name}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: colors.text,
                marginBottom: 20,
              }}
            >
              {currentNode.question}
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {currentNode.options.map((opt) => (
                <motion.button
                  key={opt.next}
                  onClick={() => onAdvance(opt.next)}
                  whileHover={{ scale: 1.01, x: 4 }}
                  whileTap={{ scale: 0.99 }}
                  style={{
                    padding: "14px 18px",
                    borderRadius: 10,
                    border: `1px solid ${colors.cardBorder}`,
                    background: colors.surfaceBg,
                    cursor: "pointer",
                    textAlign: "left",
                    fontSize: 13,
                    color: colors.text,
                    fontWeight: 500,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    transition: "border-color 0.2s",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M6 4L10 8L6 12" stroke={colors.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {opt.label}
                </motion.button>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* Navigation */}
      <div style={{ display: "flex", gap: 8 }}>
        {path.length > 1 && (
          <button
            onClick={onBack}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: `1px solid ${colors.cardBorder}`,
              background: "transparent",
              color: colors.textSecondary,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "var(--font-mono)",
              cursor: "pointer",
            }}
          >
            上一步
          </button>
        )}
        {path.length > 1 && (
          <button
            onClick={onReset}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: `1px solid ${colors.cardBorder}`,
              background: "transparent",
              color: colors.textSecondary,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "var(--font-mono)",
              cursor: "pointer",
            }}
          >
            重新開始
          </button>
        )}
      </div>
    </div>
  );
}

// --- OAuth Flow ---

function OAuthFlow({
  colors,
  isDark,
  activeStep,
  setActiveStep,
}: {
  colors: Record<string, string>;
  isDark: boolean;
  activeStep: number | null;
  setActiveStep: (step: number | null) => void;
}) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: colors.text, marginBottom: 6 }}>
        RFC 9728 + RFC 8414 OAuth 探索鏈
      </div>
      <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 20, lineHeight: 1.5 }}>
        當 MCP 伺服器回傳 401 時，Claude Code 會遍歷多步驟探索鏈來找到授權伺服器。
        點擊每個步驟查看詳細資訊。
      </div>

      <div style={{ position: "relative", paddingLeft: 28 }}>
        {/* Vertical connector */}
        <div
          style={{
            position: "absolute",
            left: 14,
            top: 20,
            bottom: 20,
            width: 2,
            background: colors.cardBorder,
          }}
        />

        {oauthSteps.map((step, i) => {
          const isActive = activeStep === step.id;
          return (
            <div key={step.id} style={{ position: "relative", marginBottom: i < oauthSteps.length - 1 ? 10 : 0 }}>
              {/* Dot */}
              <motion.div
                animate={{
                  background: isActive ? colors.accent : colors.textSecondary,
                  scale: isActive ? 1.3 : 1,
                }}
                style={{
                  position: "absolute",
                  left: -28 + 14 - 5,
                  top: 18,
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  zIndex: 1,
                  transition: "all 0.2s",
                }}
              />

              <motion.button
                onClick={() => setActiveStep(isActive ? null : step.id)}
                whileHover={{ scale: 1.01 }}
                style={{
                  width: "100%",
                  padding: "14px 18px",
                  borderRadius: 10,
                  border: `1px solid ${isActive ? colors.accent : colors.cardBorder}`,
                  background: isActive ? colors.accentBg : colors.cardBg,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.2s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      fontFamily: "var(--font-mono)",
                      color: isActive ? colors.accent : colors.textSecondary,
                      minWidth: 24,
                    }}
                  >
                    {String(step.id).padStart(2, "0")}
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: isActive ? colors.accent : colors.text,
                      flex: 1,
                    }}
                  >
                    {step.title}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: colors.textSecondary,
                    marginTop: 4,
                    marginLeft: 34,
                  }}
                >
                  {step.description}
                </div>

                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ overflow: "hidden" }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          color: colors.textSecondary,
                          marginTop: 10,
                          marginLeft: 34,
                          padding: "10px 14px",
                          borderRadius: 8,
                          background: colors.surfaceBg,
                          lineHeight: 1.6,
                        }}
                      >
                        {step.detail}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            </div>
          );
        })}
      </div>

      {/* Fallback chain */}
      <div
        style={{
          marginTop: 20,
          padding: "14px 18px",
          borderRadius: 12,
          border: `1px solid ${colors.cardBorder}`,
          background: colors.cardBg,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, color: colors.text, marginBottom: 8 }}>
          回退鏈
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 0, flexWrap: "wrap" }}>
          {[
            { label: "RFC 9728", desc: "受保護資源" },
            { label: "RFC 8414", desc: "授權伺服器元資料" },
            { label: "路徑感知探測", desc: "對 MCP 伺服器 URL" },
            { label: "authServerMetadataUrl", desc: "逃生門設定" },
          ].map((step, i) => (
            <div key={step.label} style={{ display: "flex", alignItems: "center" }}>
              <div
                style={{
                  textAlign: "center",
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: colors.surfaceBg,
                  minWidth: 80,
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 600, fontFamily: "var(--font-mono)", color: colors.accent }}>
                  {step.label}
                </div>
                <div style={{ fontSize: 9, color: colors.textSecondary, marginTop: 2 }}>{step.desc}</div>
              </div>
              {i < 3 && (
                <div style={{ padding: "0 4px" }}>
                  <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
                    <path d="M2 6H14M14 6L10 2M14 6L10 10" stroke={colors.textSecondary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 10, lineHeight: 1.5 }}>
          <code style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>authServerMetadataUrl</code> 逃生門的存在是因為某些 OAuth 伺服器未實作任一 RFC。
        </div>
      </div>
    </div>
  );
}
