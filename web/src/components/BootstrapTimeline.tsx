import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// --- Data ---

interface Phase {
  id: string;
  label: string;
  startMs: number;
  endMs: number;
  description: string;
  details: string;
}

interface ParallelOp {
  id: string;
  label: string;
  startMs: number;
  endMs: number;
  description: string;
}

const phases: Phase[] = [
  {
    id: "fast-path",
    label: "快速路徑檢查",
    startMs: 0,
    endMs: 5,
    description: "檢查 --version、--help",
    details:
      "如果符合，立即回應並退出。不載入模組，不執行 I/O。這就是為什麼 `claude --version` 能立即返回。",
  },
  {
    id: "module-loading",
    label: "模組載入",
    startMs: 0,
    endMs: 80,
    description: "匯入所有 TypeScript 模組",
    details:
      "模組層級的副作用在求值期間觸發 I/O。這是關鍵洞察：I/O 與 import 解析重疊執行。",
  },
  {
    id: "init",
    label: "init()",
    startMs: 80,
    endMs: 95,
    description: "解析參數、解析設定",
    details:
      "建立信任邊界。決定工作階段類型（REPL vs 單次執行）。設定在此階段後凍結。",
  },
  {
    id: "setup",
    label: "setup()",
    startMs: 95,
    endMs: 130,
    description: "載入命令、代理、鉤子、外掛",
    details:
      "平行 I/O 處理 git 狀態和 CLAUDE.md 讀取。模組層級 I/O 的結果在這裡被等待——它們已經完成了。",
  },
  {
    id: "first-call",
    label: "首次 API 呼叫",
    startMs: 130,
    endMs: 240,
    description: "預熱的 TCP+TLS 連線",
    details:
      "系統提示建構和對模型的第一次請求。TCP+TLS 握手已在模組載入期間完成。",
  },
];

const parallelOps: ParallelOp[] = [
  {
    id: "git-status",
    label: "git status",
    startMs: 10,
    endMs: 60,
    description:
      "在模組求值期間產生的子行程。結果被快取並在 setup() 中等待。",
  },
  {
    id: "claude-md",
    label: "CLAUDE.md 讀取",
    startMs: 15,
    endMs: 40,
    description:
      "作為模組層級副作用觸發的檔案讀取。內容用於系統提示建構。",
  },
  {
    id: "tcp-tls",
    label: "TCP+TLS 預連線",
    startMs: 20,
    endMs: 100,
    description:
      "在模組載入期間預熱與 Anthropic API 的連線。在首次 API 呼叫之前已就緒。",
  },
];

const TOTAL_MS = 240;
const SEQUENTIAL_MS = 800;

// --- Hooks ---

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

interface TooltipData {
  x: number;
  y: number;
  label: string;
  description: string;
  details?: string;
  startMs: number;
  endMs: number;
}

export default function BootstrapTimeline({ className }: Props) {
  const isDark = useDarkMode();
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 1
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const animRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const ANIMATION_DURATION = 2400; // ms for full playback

  const colors = {
    phase: "#d97757",
    phaseLight: isDark ? "#d9775733" : "#d9775722",
    parallel: "rgba(217, 119, 87, 0.4)",
    cursor: "#d97757",
    text: isDark ? "#f5f4ed" : "#141413",
    textSecondary: isDark ? "#87867f" : "#87867f",
    bg: isDark ? "#1e1e1c" : "#ffffff",
    border: isDark ? "#333" : "#c2c0b6",
    gridLine: isDark ? "rgba(135,134,127,0.15)" : "rgba(135,134,127,0.2)",
  };

  const play = useCallback(() => {
    setPlaying(true);
    setProgress(0);
    startTimeRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const p = Math.min(elapsed / ANIMATION_DURATION, 1);
      setProgress(p);
      if (p < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        setPlaying(false);
      }
    };
    animRef.current = requestAnimationFrame(tick);
  }, []);

  const reset = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    setPlaying(false);
    setProgress(0);
  }, []);

  useEffect(() => {
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  const cursorMs = progress * TOTAL_MS;

  // Layout constants
  const LEFT_LABEL_WIDTH = 140;
  const CHART_PADDING_RIGHT = 16;
  const ROW_HEIGHT = 36;
  const PHASE_ROWS = phases.length;
  const GAP_ROW = 0.5;
  const PARALLEL_ROWS = parallelOps.length;
  const HEADER_HEIGHT = 24;

  const totalRows = PHASE_ROWS + GAP_ROW + PARALLEL_ROWS;
  const chartHeight = HEADER_HEIGHT + totalRows * ROW_HEIGHT + 16;

  const barX = (ms: number, chartWidth: number) =>
    LEFT_LABEL_WIDTH + (ms / TOTAL_MS) * (chartWidth - LEFT_LABEL_WIDTH - CHART_PADDING_RIGHT);

  const barWidth = (startMs: number, endMs: number, chartWidth: number) =>
    ((endMs - startMs) / TOTAL_MS) * (chartWidth - LEFT_LABEL_WIDTH - CHART_PADDING_RIGHT);

  const handleBarHover = (
    e: React.MouseEvent,
    item: Phase | ParallelOp,
    isPhase: boolean,
  ) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top - 12,
      label: item.label,
      description: item.description,
      details: isPhase ? (item as Phase).details : undefined,
      startMs: item.startMs,
      endMs: item.endMs,
    });
  };

  const handleBarMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip((prev) =>
      prev
        ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top - 12 }
        : null,
    );
  };

  // Tick marks
  const ticks = [0, 50, 100, 150, 200, 240];

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "relative", fontFamily: "var(--font-serif)" }}
    >
      {/* Comparison badge */}
      <div
        style={{
          display: "flex",
          gap: 12,
          justifyContent: "center",
          marginBottom: 16,
          flexWrap: "wrap",
          fontSize: 13,
        }}
      >
        <span
          style={{
            background: isDark ? "#2a2a28" : "#f0efe8",
            border: `1px solid ${colors.border}`,
            borderRadius: 6,
            padding: "4px 12px",
            color: colors.textSecondary,
          }}
        >
          循序：<span style={{ textDecoration: "line-through" }}>~{SEQUENTIAL_MS}ms</span>
        </span>
        <span
          style={{
            background: isDark ? "rgba(217,119,87,0.15)" : "rgba(217,119,87,0.1)",
            border: `1px solid ${colors.phase}`,
            borderRadius: 6,
            padding: "4px 12px",
            color: colors.phase,
            fontWeight: 600,
          }}
        >
          平行：~{TOTAL_MS}ms{" "}
          <span style={{ fontWeight: 400, opacity: 0.8 }}>
            (快 {Math.round((1 - TOTAL_MS / SEQUENTIAL_MS) * 100)}%)
          </span>
        </span>
      </div>

      {/* Chart */}
      <div
        style={{
          background: colors.bg,
          border: `1px solid ${colors.border}`,
          borderRadius: 8,
          padding: "16px 0 8px 0",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <svg
          width="100%"
          viewBox={`0 0 700 ${chartHeight}`}
          style={{ display: "block" }}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Tick marks */}
          {ticks.map((ms) => {
            const x = barX(ms, 700);
            return (
              <g key={ms}>
                <line
                  x1={x}
                  y1={HEADER_HEIGHT - 4}
                  x2={x}
                  y2={chartHeight - 8}
                  stroke={colors.gridLine}
                  strokeWidth={1}
                  strokeDasharray="3,3"
                />
                <text
                  x={x}
                  y={HEADER_HEIGHT - 8}
                  textAnchor="middle"
                  fontSize={10}
                  fill={colors.textSecondary}
                  fontFamily="var(--font-mono)"
                >
                  {ms}ms
                </text>
              </g>
            );
          })}

          {/* Section label: Phases */}
          <text
            x={8}
            y={HEADER_HEIGHT + 6}
            fontSize={9}
            fill={colors.textSecondary}
            fontFamily="var(--font-mono)"
            textTransform="uppercase"
            letterSpacing={1}
          >
            階段
          </text>

          {/* Phase bars */}
          {phases.map((phase, i) => {
            const y = HEADER_HEIGHT + 12 + i * ROW_HEIGHT;
            const x = barX(phase.startMs, 700);
            const w = barWidth(phase.startMs, phase.endMs, 700);
            const visible =
              progress > 0 &&
              cursorMs >= phase.startMs;
            const fillWidth = visible
              ? Math.min(w, barWidth(phase.startMs, Math.min(cursorMs, phase.endMs), 700))
              : 0;

            return (
              <g
                key={phase.id}
                onMouseEnter={(e) => handleBarHover(e, phase, true)}
                onMouseMove={handleBarMove}
                onMouseLeave={() => setTooltip(null)}
                style={{ cursor: "pointer" }}
              >
                {/* Row label */}
                <text
                  x={LEFT_LABEL_WIDTH - 8}
                  y={y + ROW_HEIGHT / 2 + 1}
                  textAnchor="end"
                  fontSize={12}
                  fill={colors.text}
                  fontFamily="var(--font-serif)"
                  dominantBaseline="middle"
                >
                  {phase.label}
                </text>
                {/* Background bar */}
                <rect
                  x={x}
                  y={y + 4}
                  width={w}
                  height={ROW_HEIGHT - 8}
                  rx={4}
                  fill={colors.phaseLight}
                />
                {/* Animated fill */}
                {progress > 0 && (
                  <rect
                    x={x}
                    y={y + 4}
                    width={fillWidth}
                    height={ROW_HEIGHT - 8}
                    rx={4}
                    fill={colors.phase}
                    opacity={0.85}
                  />
                )}
                {/* Duration label */}
                <text
                  x={x + w + 6}
                  y={y + ROW_HEIGHT / 2 + 1}
                  fontSize={10}
                  fill={colors.textSecondary}
                  fontFamily="var(--font-mono)"
                  dominantBaseline="middle"
                >
                  {phase.endMs - phase.startMs}ms
                </text>
              </g>
            );
          })}

          {/* Section label: Parallel I/O */}
          <text
            x={8}
            y={HEADER_HEIGHT + (PHASE_ROWS + GAP_ROW) * ROW_HEIGHT + 18}
            fontSize={9}
            fill={colors.textSecondary}
            fontFamily="var(--font-mono)"
            textTransform="uppercase"
            letterSpacing={1}
          >
            平行 I/O
          </text>

          {/* Parallel operation bars */}
          {parallelOps.map((op, i) => {
            const y =
              HEADER_HEIGHT +
              12 +
              (PHASE_ROWS + GAP_ROW) * ROW_HEIGHT +
              12 +
              i * ROW_HEIGHT;
            const x = barX(op.startMs, 700);
            const w = barWidth(op.startMs, op.endMs, 700);
            const visible =
              progress > 0 && cursorMs >= op.startMs;
            const fillWidth = visible
              ? Math.min(w, barWidth(op.startMs, Math.min(cursorMs, op.endMs), 700))
              : 0;

            return (
              <g
                key={op.id}
                onMouseEnter={(e) => handleBarHover(e, op, false)}
                onMouseMove={handleBarMove}
                onMouseLeave={() => setTooltip(null)}
                style={{ cursor: "pointer" }}
              >
                {/* Row label */}
                <text
                  x={LEFT_LABEL_WIDTH - 8}
                  y={y + ROW_HEIGHT / 2 + 1}
                  textAnchor="end"
                  fontSize={12}
                  fill={colors.text}
                  fontFamily="var(--font-serif)"
                  dominantBaseline="middle"
                  fontStyle="italic"
                >
                  {op.label}
                </text>
                {/* Background bar */}
                <rect
                  x={x}
                  y={y + 4}
                  width={w}
                  height={ROW_HEIGHT - 8}
                  rx={4}
                  fill={colors.phaseLight}
                />
                {/* Animated fill */}
                {progress > 0 && (
                  <rect
                    x={x}
                    y={y + 4}
                    width={fillWidth}
                    height={ROW_HEIGHT - 8}
                    rx={4}
                    fill={colors.parallel}
                  />
                )}
                {/* Hatching pattern to distinguish from phases */}
                <rect
                  x={x}
                  y={y + 4}
                  width={progress > 0 ? fillWidth : 0}
                  height={ROW_HEIGHT - 8}
                  rx={4}
                  fill="url(#diagonal-hatch)"
                  opacity={0.3}
                />
                {/* Duration label */}
                <text
                  x={x + w + 6}
                  y={y + ROW_HEIGHT / 2 + 1}
                  fontSize={10}
                  fill={colors.textSecondary}
                  fontFamily="var(--font-mono)"
                  dominantBaseline="middle"
                >
                  {op.endMs - op.startMs}ms
                </text>
              </g>
            );
          })}

          {/* Hatching pattern def */}
          <defs>
            <pattern
              id="diagonal-hatch"
              patternUnits="userSpaceOnUse"
              width="6"
              height="6"
            >
              <path
                d="M0,6 l6,-6 M-1,1 l2,-2 M5,7 l2,-2"
                stroke={colors.phase}
                strokeWidth={1}
                opacity={0.5}
              />
            </pattern>
          </defs>

          {/* Cursor line */}
          {progress > 0 && (
            <line
              x1={barX(cursorMs, 700)}
              y1={HEADER_HEIGHT - 4}
              x2={barX(cursorMs, 700)}
              y2={chartHeight - 8}
              stroke={colors.cursor}
              strokeWidth={2}
              opacity={0.9}
            />
          )}
          {progress > 0 && (
            <text
              x={barX(cursorMs, 700)}
              y={chartHeight - 1}
              textAnchor="middle"
              fontSize={10}
              fill={colors.cursor}
              fontFamily="var(--font-mono)"
              fontWeight={600}
            >
              {Math.round(cursorMs)}ms
            </text>
          )}
        </svg>
      </div>

      {/* Controls */}
      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "center",
          marginTop: 12,
        }}
      >
        <button
          onClick={play}
          disabled={playing}
          style={{
            background: playing ? colors.textSecondary : colors.phase,
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "6px 18px",
            fontSize: 13,
            fontFamily: "var(--font-mono)",
            cursor: playing ? "not-allowed" : "pointer",
            opacity: playing ? 0.5 : 1,
            transition: "opacity 0.2s",
          }}
        >
          播放
        </button>
        <button
          onClick={reset}
          style={{
            background: "transparent",
            color: colors.textSecondary,
            border: `1px solid ${colors.border}`,
            borderRadius: 6,
            padding: "6px 18px",
            fontSize: 13,
            fontFamily: "var(--font-mono)",
            cursor: "pointer",
          }}
        >
          重置
        </button>
      </div>

      {/* Tooltip */}
      <AnimatePresence>
        {tooltip && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "absolute",
              left: tooltip.x,
              top: tooltip.y,
              transform: "translate(-50%, -100%)",
              background: colors.bg,
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              padding: "10px 14px",
              maxWidth: 280,
              pointerEvents: "none",
              zIndex: 20,
              boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
            }}
          >
            <div
              style={{
                fontWeight: 600,
                fontSize: 13,
                color: colors.text,
                marginBottom: 2,
                fontFamily: "var(--font-serif)",
              }}
            >
              {tooltip.label}
            </div>
            <div
              style={{
                fontSize: 11,
                color: colors.phase,
                marginBottom: 4,
                fontFamily: "var(--font-mono)",
              }}
            >
              {tooltip.startMs}ms - {tooltip.endMs}ms ({tooltip.endMs - tooltip.startMs}ms)
            </div>
            <div
              style={{
                fontSize: 12,
                color: colors.textSecondary,
                lineHeight: 1.5,
                fontFamily: "var(--font-serif)",
              }}
            >
              {tooltip.details || tooltip.description}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: 16,
          justifyContent: "center",
          marginTop: 10,
          fontSize: 12,
          color: colors.textSecondary,
          fontFamily: "var(--font-serif)",
          flexWrap: "wrap",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 14,
              height: 10,
              borderRadius: 2,
              background: colors.phase,
              display: "inline-block",
              opacity: 0.85,
            }}
          />
          管線階段
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 14,
              height: 10,
              borderRadius: 2,
              background: colors.parallel,
              display: "inline-block",
            }}
          />
          平行 I/O（重疊）
        </span>
        <span>懸停長條查看詳情</span>
      </div>
    </div>
  );
}
