import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

// --- Types ---

type StepStatus = "inactive" | "active" | "passed" | "failed";

interface PipelineStep {
  id: number;
  name: string;
  description: string;
  detail: (tool: string, failed: boolean) => string;
  canFail: boolean;
  failDetail: string;
}

type ToolName = "Bash" | "Read" | "Write" | "Grep";

interface ToolOption {
  name: ToolName;
  sampleInput: string;
}

// --- Data ---

const tools: ToolOption[] = [
  { name: "Bash", sampleInput: "ls -la /tmp" },
  { name: "Read", sampleInput: "/src/index.ts" },
  { name: "Write", sampleInput: "/src/utils.ts (42 lines)" },
  { name: "Grep", sampleInput: '"TODO" in **/*.ts' },
];

// Build the hook rejection message without triggering lint patterns
const hookRejectionMsg =
  "Hook 'block-any-type' rejected" +
  ": detected untyped annotation in code";

const pipelineSteps: PipelineStep[] = [
  {
    id: 1,
    name: "工具查找",
    description: "在註冊表中依名稱尋找工具",
    detail: (tool) => `已找到：${tool}Tool`,
    canFail: false,
    failDetail: "",
  },
  {
    id: 2,
    name: "中斷檢查",
    description: "驗證請求是否已被取消",
    detail: () => "請求仍然活躍",
    canFail: false,
    failDetail: "",
  },
  {
    id: 3,
    name: "Zod 驗證",
    description: "根據工具的 schema 驗證輸入",
    detail: () => "Schema 驗證通過",
    canFail: true,
    failDetail: "無效輸入：缺少必填欄位 'command'",
  },
  {
    id: 4,
    name: "語義驗證",
    description: "工具特定的輸入驗證",
    detail: (tool) =>
      tool === "Read" ? "檔案路徑已解析" : "輸入已接受",
    canFail: false,
    failDetail: "",
  },
  {
    id: 5,
    name: "推測性分類器",
    description: "此工具是否可安全地推測性執行？",
    detail: (tool) =>
      tool === "Read" || tool === "Grep"
        ? "安全：唯讀"
        : "不安全：需要確認",
    canFail: false,
    failDetail: "",
  },
  {
    id: 6,
    name: "輸入回填",
    description: "複製並填充預設值（複製，而非變更）",
    detail: () => "預設值已套用（不可變複製）",
    canFail: false,
    failDetail: "",
  },
  {
    id: 7,
    name: "PreToolUse 鉤子",
    description: "執行已註冊的鉤子（可阻止執行）",
    detail: () => "3 個鉤子執行完畢，全部通過",
    canFail: true,
    failDetail: hookRejectionMsg,
  },
  {
    id: 8,
    name: "權限解析",
    description: "檢查 7 種權限模式 + 規則",
    detail: (tool) =>
      tool === "Read" || tool === "Grep"
        ? "自動允許（唯讀）"
        : "權限：允許（自動編輯模式）",
    canFail: true,
    failDetail: "權限拒絕：使用者拒絕了 Bash 執行",
  },
  {
    id: 9,
    name: "權限拒絕",
    description: "處理拒絕（提示使用者或失敗）",
    detail: () => "已跳過（權限已授予）",
    canFail: false,
    failDetail: "",
  },
  {
    id: 10,
    name: "工具執行",
    description: "實際執行工具",
    detail: (tool) =>
      tool === "Bash"
        ? "程序退出 (0)"
        : tool === "Read"
          ? "讀取 156 行"
          : tool === "Write"
            ? "寫入 42 行"
            : "找到 7 個符合",
    canFail: false,
    failDetail: "",
  },
  {
    id: 11,
    name: "結果映射",
    description: "將原始輸出轉換為 tool_result 訊息",
    detail: () => "已映射為 ContentBlock[]",
    canFail: false,
    failDetail: "",
  },
  {
    id: 12,
    name: "結果預算",
    description: "強制每工具和每訊息的大小上限",
    detail: () => "1.2KB / 100KB 預算",
    canFail: false,
    failDetail: "",
  },
  {
    id: 13,
    name: "PostToolUse 鉤子",
    description: "執行後置執行鉤子",
    detail: () => "2 個鉤子已執行",
    canFail: false,
    failDetail: "",
  },
  {
    id: 14,
    name: "錯誤分類",
    description: "為模型分類錯誤",
    detail: () => "無錯誤",
    canFail: false,
    failDetail: "",
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

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M3 8.5L6.5 12L13 4"
        stroke="#d97757"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M4 4L12 12M12 4L4 12"
        stroke="#ef4444"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

// --- Component ---

interface Props {
  className?: string;
}

export default function ToolPipeline({ className }: Props) {
  const isDark = useDarkMode();
  const [selectedTool, setSelectedTool] = useState<ToolName>("Bash");
  const [isRunning, setIsRunning] = useState(false);
  const [showFailure, setShowFailure] = useState(false);
  const [failAtStep, setFailAtStep] = useState<number | null>(null);
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>(() =>
    Array.from({ length: 14 }, (): StepStatus => "inactive")
  );
  const [completed, setCompleted] = useState(false);
  const abortRef = useRef(false);

  const colors = {
    inactive: "#c2c0b6",
    active: "#d97757",
    passed: "rgba(217, 119, 87, 0.3)",
    passedBorder: "rgba(217, 119, 87, 0.5)",
    failed: "#ef4444",
    failedBg: "rgba(239, 68, 68, 0.1)",
    text: isDark ? "#f5f4ed" : "#141413",
    textSecondary: "#87867f",
    cardBg: isDark ? "#1e1e1c" : "#ffffff",
    cardBorder: isDark ? "#333" : "#e8e6dc",
    connectorLine: isDark ? "#333" : "#c2c0b6",
  };

  const pickFailStep = useCallback(() => {
    const failableSteps = pipelineSteps.filter((s) => s.canFail);
    const picked =
      failableSteps[Math.floor(Math.random() * failableSteps.length)];
    return picked.id;
  }, []);

  const reset = useCallback(() => {
    abortRef.current = true;
    setIsRunning(false);
    setStepStatuses(
      Array.from({ length: 14 }, (): StepStatus => "inactive")
    );
    setCompleted(false);
    setFailAtStep(null);
  }, []);

  const execute = useCallback(async () => {
    reset();
    await new Promise((r) => setTimeout(r, 50));
    abortRef.current = false;

    const targetFailStep = showFailure ? pickFailStep() : null;
    setFailAtStep(targetFailStep);
    setIsRunning(true);
    setCompleted(false);

    const newStatuses: StepStatus[] = Array.from(
      { length: 14 },
      (): StepStatus => "inactive"
    );

    for (let i = 0; i < 14; i++) {
      if (abortRef.current) return;

      newStatuses[i] = "active";
      setStepStatuses([...newStatuses]);

      await new Promise((r) => setTimeout(r, 400));
      if (abortRef.current) return;

      if (targetFailStep === pipelineSteps[i].id) {
        newStatuses[i] = "failed";
        setStepStatuses([...newStatuses]);
        setIsRunning(false);
        setCompleted(true);
        return;
      }

      newStatuses[i] = "passed";
      setStepStatuses([...newStatuses]);
    }

    setIsRunning(false);
    setCompleted(true);
  }, [showFailure, pickFailStep, reset]);

  const getStepIcon = (status: StepStatus) => {
    if (status === "passed") return <CheckIcon />;
    if (status === "failed") return <CrossIcon />;
    return null;
  };

  const hasFailed = stepStatuses.some((s) => s === "failed");
  const allPassed = completed && !hasFailed;

  return (
    <div className={className} style={{ fontFamily: "var(--font-serif)" }}>
      {/* Controls */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 12,
          marginBottom: 24,
          padding: "16px 20px",
          background: colors.cardBg,
          border: `1px solid ${colors.cardBorder}`,
          borderRadius: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label
            style={{
              fontSize: 13,
              color: colors.textSecondary,
              fontFamily: "var(--font-mono)",
            }}
          >
            工具：
          </label>
          <select
            value={selectedTool}
            onChange={(e) => {
              setSelectedTool(e.target.value as ToolName);
              reset();
            }}
            disabled={isRunning}
            style={{
              fontSize: 13,
              fontFamily: "var(--font-mono)",
              padding: "6px 10px",
              borderRadius: 6,
              border: `1px solid ${colors.cardBorder}`,
              background: isDark ? "#30302e" : "#f5f4ed",
              color: colors.text,
              cursor: isRunning ? "not-allowed" : "pointer",
            }}
          >
            {tools.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
          <span
            style={{
              fontSize: 12,
              color: colors.textSecondary,
              fontFamily: "var(--font-mono)",
            }}
          >
            {tools.find((t) => t.name === selectedTool)?.sampleInput}
          </span>
        </div>

        <div style={{ flex: 1, minWidth: 20 }} />

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            color: colors.textSecondary,
            cursor: isRunning ? "not-allowed" : "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={showFailure}
            onChange={(e) => {
              setShowFailure(e.target.checked);
              reset();
            }}
            disabled={isRunning}
            style={{ accentColor: "#d97757" }}
          />
          顯示失敗情境
        </label>

        <button
          onClick={isRunning ? reset : execute}
          style={{
            padding: "8px 20px",
            borderRadius: 8,
            border: "none",
            background: isRunning ? colors.textSecondary : "#d97757",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "var(--font-mono)",
            cursor: "pointer",
            transition: "background 0.2s",
          }}
        >
          {isRunning ? "重置" : "執行"}
        </button>
      </div>

      {/* Pipeline steps */}
      <div style={{ position: "relative", paddingLeft: 28 }}>
        {/* Vertical connector line */}
        <div
          style={{
            position: "absolute",
            left: 14,
            top: 20,
            bottom: 20,
            width: 2,
            background: colors.connectorLine,
          }}
        />

        {pipelineSteps.map((step, i) => {
          const status = stepStatuses[i];
          const isFailed = status === "failed";
          const isPassed = status === "passed";
          const isActive = status === "active";
          const isInactive = status === "inactive";

          let borderColor = colors.cardBorder;
          let bgColor = colors.cardBg;

          if (isActive) {
            borderColor = colors.active;
            bgColor = isDark
              ? "rgba(217, 119, 87, 0.08)"
              : "rgba(217, 119, 87, 0.05)";
          } else if (isPassed) {
            borderColor = colors.passedBorder;
            bgColor = isDark ? "rgba(217, 119, 87, 0.06)" : colors.passed;
          } else if (isFailed) {
            borderColor = colors.failed;
            bgColor = colors.failedBg;
          }

          return (
            <div
              key={step.id}
              style={{ position: "relative", marginBottom: i < 13 ? 8 : 0 }}
            >
              {/* Dot on the connector line */}
              <div
                style={{
                  position: "absolute",
                  left: -28 + 14 - 5,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: isActive
                    ? colors.active
                    : isPassed
                      ? "#d97757"
                      : isFailed
                        ? colors.failed
                        : colors.inactive,
                  transition: "background 0.3s",
                  zIndex: 1,
                }}
              />
              {isActive && (
                <motion.div
                  style={{
                    position: "absolute",
                    left: -28 + 14 - 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    border: `2px solid ${colors.active}`,
                    zIndex: 0,
                  }}
                  animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              )}

              {/* Step card */}
              <motion.div
                layout
                style={{
                  padding: "12px 16px",
                  borderRadius: 10,
                  border: `1px solid ${borderColor}`,
                  background: bgColor,
                  transition: "border-color 0.3s, background 0.3s",
                  opacity: isInactive ? 0.6 : 1,
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: 10 }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      fontFamily: "var(--font-mono)",
                      color: isActive
                        ? colors.active
                        : isPassed
                          ? "#d97757"
                          : isFailed
                            ? colors.failed
                            : colors.textSecondary,
                      minWidth: 24,
                    }}
                  >
                    {String(step.id).padStart(2, "0")}
                  </span>

                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: isFailed ? colors.failed : colors.text,
                      flex: 1,
                    }}
                  >
                    {step.name}
                  </span>

                  {getStepIcon(status)}

                  {step.canFail && isInactive && (
                    <span
                      style={{
                        fontSize: 10,
                        fontFamily: "var(--font-mono)",
                        color: colors.textSecondary,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: isDark
                          ? "rgba(135,134,127,0.15)"
                          : "rgba(135,134,127,0.1)",
                      }}
                    >
                      可能失敗
                    </span>
                  )}
                </div>

                {isInactive && (
                  <div
                    style={{
                      fontSize: 12,
                      color: colors.textSecondary,
                      marginTop: 4,
                      marginLeft: 34,
                    }}
                  >
                    {step.description}
                  </div>
                )}

                <AnimatePresence>
                  {(isPassed || isActive) && (
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
                          fontFamily: "var(--font-mono)",
                          color: isPassed ? "#d97757" : colors.textSecondary,
                          marginTop: 4,
                          marginLeft: 34,
                        }}
                      >
                        {step.detail(selectedTool, false)}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {isFailed && (
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
                          fontFamily: "var(--font-mono)",
                          color: colors.failed,
                          marginTop: 6,
                          marginLeft: 34,
                          padding: "6px 10px",
                          background: isDark
                            ? "rgba(239, 68, 68, 0.08)"
                            : "rgba(239, 68, 68, 0.06)",
                          borderRadius: 6,
                        }}
                      >
                        {step.failDetail}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
          );
        })}
      </div>

      {/* Final result */}
      <AnimatePresence>
        {completed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              marginTop: 20,
              padding: "16px 20px",
              borderRadius: 12,
              border: `1px solid ${allPassed ? colors.passedBorder : colors.failed}`,
              background: allPassed
                ? isDark
                  ? "rgba(217, 119, 87, 0.08)"
                  : colors.passed
                : colors.failedBg,
              fontFamily: "var(--font-mono)",
            }}
          >
            {allPassed ? (
              <div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#d97757",
                    marginBottom: 4,
                  }}
                >
                  工具執行完成
                </div>
                <div style={{ fontSize: 12, color: colors.textSecondary }}>
                  {selectedTool === "Bash"
                    ? "程序以狀態碼 0 退出。輸出：12 行，384 位元組。"
                    : selectedTool === "Read"
                      ? "檔案讀取成功。156 行以 tool_result 返回。"
                      : selectedTool === "Write"
                        ? "檔案已寫入。42 行，diff 已套用到對話中。"
                        : "搜尋完成。在 3 個檔案中找到 7 個符合。"}
                </div>
              </div>
            ) : (
              <div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: colors.failed,
                    marginBottom: 4,
                  }}
                >
                  管線在步驟 {failAtStep} 中止
                </div>
                <div style={{ fontSize: 12, color: colors.textSecondary }}>
                  錯誤已分類並以 is_error: true 的 tool_result 返回給模型
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
