import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

// --- Types ---

type TaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "killed";

type CommunicationPattern = "foreground" | "background" | "coordinator";

interface Transition {
  from: TaskStatus;
  to: TaskStatus;
  label: string;
  trigger: string;
  detail: string;
}

// --- Data ---

const transitions: Transition[] = [
  {
    from: "pending",
    to: "running",
    label: "執行開始",
    trigger: "任務註冊並開始首次執行",
    detail:
      "註冊與首次執行之間的短暫狀態。當代理迴圈或 shell 程序啟動時，任務轉為 running。",
  },
  {
    from: "running",
    to: "completed",
    label: "正常完成",
    trigger: "代理成功完成工作或 shell 以狀態碼 0 退出",
    detail:
      "任務產生了結果。輸出寫入磁碟檔案。當父代理被通知時，notified 旗標翻轉為 true。",
  },
  {
    from: "running",
    to: "failed",
    label: "錯誤",
    trigger: "未處理的例外、API 錯誤或工具失敗",
    detail:
      "錯誤終止了執行。錯誤被擷取到任務輸出檔中，並透過 task-notification XML 回報。",
  },
  {
    from: "running",
    to: "killed",
    label: "中止 / 使用者停止",
    trigger: "使用者按下 ESC、協調者呼叫 TaskStop或中斷信號",
    detail:
      "明確停止。中斷控制器觸發，在 finally 區塊中執行清理。不產生結果。",
  },
];

const statusPositions: Record<TaskStatus, { x: number; y: number }> = {
  pending: { x: 80, y: 100 },
  running: { x: 280, y: 100 },
  completed: { x: 480, y: 40 },
  failed: { x: 480, y: 100 },
  killed: { x: 480, y: 160 },
};

const statusColors: Record<TaskStatus, string> = {
  pending: "#87867f",
  running: "#d97757",
  completed: "#4ade80",
  failed: "#ef4444",
  killed: "#f59e0b",
};

const communicationPatterns: Record<
  CommunicationPattern,
  { title: string; description: string; details: string[] }
> = {
  foreground: {
    title: "前景（同步）",
    description:
      "父代理直接迭代 runAgent() 產生器。訊息向上傳遞至呼叫堆疊。",
    details: [
      "父代理呼叫 runAgent() 並迭代非同步產生器",
      "每則訊息立即 yield 回父代理",
      "共享父代理的中斷控制器（ESC 結束兩者）",
      "可透過 Promise.race 在執行中轉為背景模式",
      "無需磁碟輸出——訊息透過產生器鏈流動",
    ],
  },
  background: {
    title: "背景（非同步）",
    description:
      "三個通道：磁碟輸出檔、task-notification、以及待處理訊息佇列。",
    details: [
      "磁碟：每個任務寫入 outputFile（JSONL 轉錄）",
      "通知：XML <task-notification> 注入父代理的對話中",
      "佇列：SendMessage 透過 pendingMessages 陣列將訊息導向執行中的代理",
      "訊息在工具輪次邊界時消耗（而非執行中途）",
      "notified 旗標防止重複的完成訊息",
    ],
  },
  coordinator: {
    title: "協調者模式",
    description:
      "管理者-工作者階層。協調者僅擁有 3 個工具：Agent、SendMessage、TaskStop。",
    details: [
      "協調者負責思考、規劃、分解——永遠不直接接觸程式碼",
      "工作者獲得完整工具集，但排除協調工具",
      "4 個階段：研究 -> 綜合 -> 實作 -> 驗證",
      "「永遠不委派理解」——協調者綜合研究結果",
      "暑存簿透過檔案系統實現跨工作者的知識共享",
    ],
  },
};

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

function isTerminalStatus(status: TaskStatus): boolean {
  return (
    status === "completed" || status === "failed" || status === "killed"
  );
}

// --- Component ---

interface Props {
  className?: string;
}

export default function TaskStateMachine({ className }: Props) {
  const isDark = useDarkMode();
  const [currentStatus, setCurrentStatus] = useState<TaskStatus>("pending");
  const [activeTransition, setActiveTransition] = useState<Transition | null>(
    null
  );
  const [selectedPattern, setSelectedPattern] =
    useState<CommunicationPattern>("foreground");
  const animatingRef = useRef(false);

  const colors = {
    text: isDark ? "#f5f4ed" : "#141413",
    textSecondary: "#87867f",
    cardBg: isDark ? "#1e1e1c" : "#ffffff",
    cardBorder: isDark ? "#333" : "#e8e6dc",
    terracotta: "#d97757",
    terracottaBg: isDark
      ? "rgba(217, 119, 87, 0.12)"
      : "rgba(217, 119, 87, 0.08)",
    surfaceBg: isDark ? "#141413" : "#f5f4ed",
    connectorLine: isDark ? "#444" : "#c2c0b6",
  };

  const performTransition = useCallback(
    (transition: Transition) => {
      if (animatingRef.current) return;
      if (transition.from !== currentStatus) return;

      animatingRef.current = true;
      setActiveTransition(transition);

      setTimeout(() => {
        setCurrentStatus(transition.to);
        setTimeout(() => {
          setActiveTransition(null);
          animatingRef.current = false;
        }, 300);
      }, 600);
    },
    [currentStatus]
  );

  const reset = useCallback(() => {
    setCurrentStatus("pending");
    setActiveTransition(null);
    animatingRef.current = false;
  }, []);

  const availableTransitions = transitions.filter(
    (t) => t.from === currentStatus
  );

  return (
    <div className={className} style={{ fontFamily: "var(--font-serif)" }}>
      {/* State Machine Diagram */}
      <div
        style={{
          padding: "20px",
          background: colors.cardBg,
          border: `1px solid ${colors.cardBorder}`,
          borderRadius: 12,
          marginBottom: 20,
        }}
      >
        {/* SVG State Diagram */}
        <svg
          viewBox="0 0 580 210"
          style={{ width: "100%", height: "auto", display: "block" }}
        >
          {/* Transition arrows */}
          {transitions.map((t) => {
            const from = statusPositions[t.from];
            const to = statusPositions[t.to];
            const isActive = activeTransition === t;
            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2;
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const offsetX = (dx / len) * 50;
            const offsetY = (dy / len) * 50;

            return (
              <g key={`${t.from}-${t.to}`}>
                <defs>
                  <marker
                    id={`arrow-${t.from}-${t.to}`}
                    markerWidth="8"
                    markerHeight="8"
                    refX="8"
                    refY="4"
                    orient="auto"
                  >
                    <path
                      d="M0,0 L8,4 L0,8"
                      fill={isActive ? colors.terracotta : colors.connectorLine}
                    />
                  </marker>
                </defs>
                <line
                  x1={from.x + offsetX}
                  y1={from.y + offsetY}
                  x2={to.x - offsetX}
                  y2={to.y - offsetY}
                  stroke={isActive ? colors.terracotta : colors.connectorLine}
                  strokeWidth={isActive ? 2.5 : 1.5}
                  markerEnd={`url(#arrow-${t.from}-${t.to})`}
                  style={{ transition: "stroke 0.3s, stroke-width 0.3s" }}
                />
                <text
                  x={midX}
                  y={midY - 10}
                  textAnchor="middle"
                  fill={isActive ? colors.terracotta : colors.textSecondary}
                  fontSize="10"
                  fontFamily="var(--font-mono)"
                  style={{ transition: "fill 0.3s" }}
                >
                  {t.label}
                </text>
              </g>
            );
          })}

          {/* State nodes */}
          {(Object.keys(statusPositions) as TaskStatus[]).map((status) => {
            const pos = statusPositions[status];
            const isCurrent = currentStatus === status;
            const isTarget = activeTransition?.to === status;
            const nodeColor = statusColors[status];
            const isTerminal = isTerminalStatus(status);

            return (
              <g key={status}>
                {/* Glow for current */}
                {isCurrent && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={38}
                    fill="none"
                    stroke={nodeColor}
                    strokeWidth="2"
                    opacity="0.3"
                  >
                    <animate
                      attributeName="r"
                      values="38;44;38"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.3;0.1;0.3"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}

                {/* Node circle */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={32}
                  fill={
                    isCurrent
                      ? isDark
                        ? `${nodeColor}20`
                        : `${nodeColor}15`
                      : colors.cardBg
                  }
                  stroke={isCurrent || isTarget ? nodeColor : colors.cardBorder}
                  strokeWidth={isCurrent ? 2.5 : 1.5}
                  style={{ transition: "all 0.4s" }}
                />

                {/* Terminal state double circle */}
                {isTerminal && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={27}
                    fill="none"
                    stroke={
                      isCurrent || isTarget ? nodeColor : colors.cardBorder
                    }
                    strokeWidth={1}
                    opacity={0.5}
                    style={{ transition: "all 0.4s" }}
                  />
                )}

                <text
                  x={pos.x}
                  y={pos.y + 4}
                  textAnchor="middle"
                  fill={isCurrent ? nodeColor : colors.text}
                  fontSize="11"
                  fontWeight={isCurrent ? "700" : "500"}
                  fontFamily="var(--font-mono)"
                  style={{ transition: "fill 0.3s" }}
                >
                  {status}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Controls + Transition Info */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 20,
        }}
      >
        {/* Transition buttons */}
        <div
          style={{
            padding: "16px 20px",
            background: colors.cardBg,
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: 12,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              color: colors.textSecondary,
              marginBottom: 12,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            可用轉換
          </div>

          {availableTransitions.length > 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {availableTransitions.map((t) => (
                <button
                  key={`${t.from}-${t.to}`}
                  onClick={() => performTransition(t)}
                  disabled={animatingRef.current}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 8,
                    border: `1px solid ${statusColors[t.to]}40`,
                    background: `${statusColors[t.to]}10`,
                    color: statusColors[t.to],
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: "var(--font-mono)",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.2s",
                  }}
                >
                  {t.label}
                  <span
                    style={{
                      float: "right",
                      opacity: 0.6,
                      fontSize: 11,
                    }}
                  >
                    {t.from} -&gt; {t.to}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: colors.textSecondary }}>
              已到達終端狀態。
              <button
                onClick={reset}
                style={{
                  display: "block",
                  marginTop: 10,
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: colors.terracotta,
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "var(--font-mono)",
                  cursor: "pointer",
                }}
              >
                重置為 pending
              </button>
            </div>
          )}
        </div>

        {/* Transition detail */}
        <div
          style={{
            padding: "16px 20px",
            background: colors.cardBg,
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: 12,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              color: colors.textSecondary,
              marginBottom: 12,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            轉換詳情
          </div>

          <AnimatePresence mode="wait">
            {activeTransition ? (
              <motion.div
                key={`${activeTransition.from}-${activeTransition.to}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: "var(--font-mono)",
                    color: colors.terracotta,
                    marginBottom: 8,
                  }}
                >
                  {activeTransition.from} -&gt; {activeTransition.to}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: colors.text,
                    marginBottom: 4,
                  }}
                >
                  觸發條件：
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: colors.textSecondary,
                    marginBottom: 10,
                  }}
                >
                  {activeTransition.trigger}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: colors.textSecondary,
                    lineHeight: 1.6,
                  }}
                >
                  {activeTransition.detail}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div style={{ fontSize: 13, color: colors.textSecondary }}>
                  點擊轉換以查看詳情並動畫呈現狀態變化。
                </div>
                <div
                  style={{
                    marginTop: 10,
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: colors.surfaceBg,
                    fontSize: 12,
                    fontFamily: "var(--font-mono)",
                    color: colors.textSecondary,
                  }}
                >
                  isTerminalTaskStatus({currentStatus}) ={" "}
                  <span
                    style={{
                      color: isTerminalStatus(currentStatus)
                        ? statusColors.completed
                        : colors.terracotta,
                      fontWeight: 600,
                    }}
                  >
                    {String(isTerminalStatus(currentStatus))}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Communication Patterns */}
      <div
        style={{
          padding: "16px 20px",
          background: colors.cardBg,
          border: `1px solid ${colors.cardBorder}`,
          borderRadius: 12,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            color: colors.textSecondary,
            marginBottom: 14,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
            通訊模式
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: 4,
            marginBottom: 16,
            padding: 3,
            background: colors.surfaceBg,
            borderRadius: 8,
            border: `1px solid ${colors.cardBorder}`,
          }}
        >
          {(Object.keys(communicationPatterns) as CommunicationPattern[]).map(
            (pattern) => {
              const isActive = selectedPattern === pattern;
              return (
                <button
                  key={pattern}
                  onClick={() => setSelectedPattern(pattern)}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "none",
                    background: isActive ? colors.cardBg : "transparent",
                    color: isActive ? colors.terracotta : colors.textSecondary,
                    fontSize: 12,
                    fontWeight: isActive ? 600 : 400,
                    fontFamily: "var(--font-mono)",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    boxShadow: isActive
                      ? isDark
                        ? "0 1px 3px rgba(0,0,0,0.3)"
                        : "0 1px 3px rgba(0,0,0,0.1)"
                      : "none",
                  }}
                >
                  {communicationPatterns[pattern].title}
                </button>
              );
            }
          )}
        </div>

        {/* Pattern content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedPattern}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: colors.text,
                marginBottom: 8,
              }}
            >
              {communicationPatterns[selectedPattern].description}
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {communicationPatterns[selectedPattern].details.map(
                (detail, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      padding: "8px 12px",
                      borderRadius: 8,
                      background: colors.surfaceBg,
                      border: `1px solid ${colors.cardBorder}`,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontFamily: "var(--font-mono)",
                        fontWeight: 700,
                        color: colors.terracotta,
                        minWidth: 18,
                        marginTop: 1,
                      }}
                    >
                      {i + 1}.
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color: colors.text,
                        lineHeight: 1.5,
                      }}
                    >
                      {detail}
                    </span>
                  </div>
                )
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
