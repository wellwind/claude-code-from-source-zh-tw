import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// --- Step Data ---

interface Step {
  id: number;
  title: string;
  shortTitle: string;
  description: string;
  visual: React.ReactNode;
}

function StepVisual({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "rgba(217, 119, 87, 0.08)",
        borderRadius: 8,
        padding: "12px 16px",
        fontFamily: "var(--font-mono)",
        fontSize: 13,
        lineHeight: 1.6,
      }}
    >
      {children}
    </div>
  );
}

const steps: Step[] = [
  {
    id: 1,
    title: "接收輸入",
    shortTitle: "輸入",
    description:
      "當使用者傳送訊息或上一次迭代的工具結果到達時，迴圈就會開始。這些會成為附加到對話歷史中的新訊息。",
    visual: (
      <StepVisual>
        <div style={{ opacity: 0.5, marginBottom: 4 }}>// 新訊息</div>
        <div>
          {"{"} role: <span style={{ color: "#d97757" }}>"user"</span>, content:{" "}
          <span style={{ color: "#d97757" }}>"Read the config file"</span> {"}"}
        </div>
      </StepVisual>
    ),
  },
  {
    id: 2,
    title: "上下文管理",
    shortTitle: "上下文",
    description:
      "在呼叫模型之前，系統會檢查 token 使用量。如果對話太長，壓縮層會啟動：工具結果預算分配、片段壓縮或完整摘要。",
    visual: (
      <StepVisual>
        <div>
          tokens used: <strong>142,800</strong> / 200,000
        </div>
        <div style={{ color: "#22c55e", marginTop: 4 }}>
          低於閾值 (80%)。無需壓縮。
        </div>
      </StepVisual>
    ),
  },
  {
    id: 3,
    title: "串流到模型",
    shortTitle: "串流",
    description:
      "完整的訊息陣列被傳送到 Claude API。回應 token 會即時串流回來。系統在每個區塊到達時進行處理，逐步建構文字和 tool_use 區塊。",
    visual: (
      <StepVisual>
        <div style={{ opacity: 0.5 }}>// 串流回應中...</div>
        <div style={{ marginTop: 4 }}>
          <span style={{ color: "#87867f" }}>{">"}  </span> 讓我幫你讀取那個設定檔
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 16,
              background: "#d97757",
              marginLeft: 2,
              verticalAlign: "middle",
              animation: "blink 1s step-end infinite",
            }}
          />
        </div>
        <style>{`@keyframes blink { 50% { opacity: 0; } }`}</style>
      </StepVisual>
    ),
  },
  {
    id: 4,
    title: "解析回應",
    shortTitle: "解析",
    description:
      "串流完成後，回應會被解析為內容區塊。文字區塊成為可見輸出。tool_use 區塊會連同名稱、ID 和輸入參數一起被提取。",
    visual: (
      <StepVisual>
        <div>
          blocks: [<br />
          &nbsp;&nbsp;{"{"} type:{" "}
          <span style={{ color: "#87867f" }}>"text"</span>, text: "讓我
          讀取..." {"}"},<br />
          &nbsp;&nbsp;{"{"} type:{" "}
          <span style={{ color: "#d97757" }}>"tool_use"</span>, name: "Read",
          <br />
          &nbsp;&nbsp;&nbsp;&nbsp;input: {"{"} file_path: "./config.ts" {"}"}{" "}
          {"}"}
          <br />]
        </div>
      </StepVisual>
    ),
  },
  {
    id: 5,
    title: "執行工具",
    shortTitle: "工具",
    description:
      "工具呼叫透過 14 步管線執行。唯讀工具（Read、Glob、Grep）平行執行。寫入工具（Edit、Write、Bash）序列執行。每個都會經過權限檢查。",
    visual: (
      <StepVisual>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div>
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#22c55e",
                marginRight: 8,
              }}
            />
            Read("./config.ts")
            <span style={{ color: "#22c55e", marginLeft: 8 }}>執行中</span>
          </div>
          <div>
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#22c55e",
                marginRight: 8,
              }}
            />
            Glob("**/*.json")
            <span style={{ color: "#22c55e", marginLeft: 8 }}>執行中</span>
          </div>
          <div style={{ opacity: 0.5, fontSize: 11, marginTop: 2 }}>
            唯讀工具平行執行
          </div>
        </div>
      </StepVisual>
    ),
  },
  {
    id: 6,
    title: "收集結果",
    shortTitle: "結果",
    description:
      "工具輸出會被收集並格式化為 tool_result 訊息。大型輸出會被截斷以符合每則訊息的 token 預算。結果會與其 tool_use ID 配對。",
    visual: (
      <StepVisual>
        <div>
          {"{"} role:{" "}
          <span style={{ color: "#87867f" }}>"tool_result"</span>,
          <br />
          &nbsp;&nbsp;tool_use_id: "toolu_01X...",
          <br />
          &nbsp;&nbsp;content:{" "}
          <span style={{ color: "#d97757" }}>
            "export default {"{"} port: 3001... {"}"}"
          </span>
          <br />
          {"}"}
        </div>
      </StepVisual>
    ),
  },
  {
    id: 7,
    title: "後處理",
    shortTitle: "鉤子",
    description:
      "PostToolUse 鉤子觸發，允許擴充檢查或修改結果。系統檢查停止條件：鉤子是否要求提前終止？模型是否命中停止序列？",
    visual: (
      <StepVisual>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div>
            PostToolUse 鉤子：{" "}
            <span style={{ color: "#22c55e" }}>2 個已註冊</span>
          </div>
          <div>
            &nbsp;&nbsp;block-any-type.ts{" "}
            <span style={{ color: "#22c55e" }}>通過</span>
          </div>
          <div>
            &nbsp;&nbsp;auto-compact.ts{" "}
            <span style={{ color: "#22c55e" }}>通過</span>
          </div>
          <div style={{ marginTop: 4 }}>
            停止條件：{" "}
            <span style={{ color: "#87867f" }}>未觸發</span>
          </div>
        </div>
      </StepVisual>
    ),
  },
  {
    id: 8,
    title: "決策",
    shortTitle: "決策",
    description:
      "模型檢查其回應。如果有待處理的工具呼叫，它會帶著工具結果迴圈回到步驟 1。如果它已有足夠的資訊，就產生最終的文字回應並退出。",
    visual: null, // handled specially
  },
];

// --- Component ---

interface Props {
  className?: string;
}

export default function AgentLoopSimulator({ className }: Props) {
  const [currentStep, setCurrentStep] = useState(0); // 0 = not started, 1-8 = steps
  const [decision, setDecision] = useState<"loop" | "exit" | null>(null);
  const [iteration, setIteration] = useState(1);
  const [autoPlay, setAutoPlay] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const autoPlayRef = useRef(autoPlay);
  autoPlayRef.current = autoPlay;

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

  // Auto-play
  useEffect(() => {
    if (!autoPlay) return;
    const interval = setInterval(() => {
      if (!autoPlayRef.current) return;
      setCurrentStep((prev) => {
        if (prev >= 8) {
          setAutoPlay(false);
          return prev;
        }
        return prev + 1;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [autoPlay]);

  const handleNext = useCallback(() => {
    if (currentStep < 8) {
      setCurrentStep((s) => s + 1);
      setDecision(null);
    }
  }, [currentStep]);

  const handlePrev = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((s) => s - 1);
      setDecision(null);
    }
  }, [currentStep]);

  const handleReset = useCallback(() => {
    setCurrentStep(0);
    setDecision(null);
    setIteration(1);
    setAutoPlay(false);
  }, []);

  const handleDecision = useCallback(
    (d: "loop" | "exit") => {
      setDecision(d);
      if (d === "loop") {
        setTimeout(() => {
          setCurrentStep(1);
          setDecision(null);
          setIteration((i) => i + 1);
        }, 1500);
      }
    },
    [],
  );

  const colors = {
    active: "#d97757",
    completed: "rgba(217, 119, 87, 0.3)",
    upcoming: "#c2c0b6",
    text: isDark ? "#f5f4ed" : "#141413",
    textMuted: isDark ? "#87867f" : "#87867f",
    bg: isDark ? "#1e1e1c" : "#ffffff",
    border: isDark ? "#333" : "#c2c0b6",
    panelBg: isDark ? "rgba(30,30,28,0.5)" : "rgba(255,255,255,0.5)",
  };

  const getStepColor = (stepId: number) => {
    if (stepId === currentStep) return colors.active;
    if (stepId < currentStep) return colors.completed;
    return colors.upcoming;
  };

  const getStepTextColor = (stepId: number) => {
    if (stepId === currentStep) return colors.text;
    if (stepId < currentStep) return colors.active;
    return colors.textMuted;
  };

  const activeStep = steps.find((s) => s.id === currentStep);

  return (
    <div className={className} style={{ fontFamily: "var(--font-serif)" }}>
      {/* Iteration badge */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontFamily: "var(--font-mono)",
            color: colors.textMuted,
          }}
        >
          迭代 {iteration}
        </span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              color: colors.textMuted,
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
            }}
          >
            <input
              type="checkbox"
              checked={autoPlay}
              onChange={(e) => {
                setAutoPlay(e.target.checked);
                if (e.target.checked && currentStep === 0) setCurrentStep(1);
              }}
              style={{ accentColor: colors.active }}
            />
            自動播放
          </label>
        </div>
      </div>

      {/* Pipeline */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 0,
          overflowX: "auto",
          padding: "8px 4px",
          marginBottom: 24,
        }}
      >
        {steps.map((step, i) => (
          <div
            key={step.id}
            style={{ display: "flex", alignItems: "center", flexShrink: 0 }}
          >
            {/* Node */}
            <div
              onClick={() => {
                setCurrentStep(step.id);
                setDecision(null);
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                cursor: "pointer",
                gap: 6,
              }}
            >
              <motion.div
                animate={{
                  backgroundColor: getStepColor(step.id),
                  scale: step.id === currentStep ? 1.15 : 1,
                }}
                transition={{ duration: 0.3 }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: step.id <= currentStep ? "#fff" : colors.textMuted,
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: "var(--font-mono)",
                }}
              >
                {step.id}
              </motion.div>
              <span
                style={{
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                  color: getStepTextColor(step.id),
                  fontWeight: step.id === currentStep ? 600 : 400,
                  whiteSpace: "nowrap",
                  transition: "color 0.3s",
                }}
              >
                {step.shortTitle}
              </span>
            </div>
            {/* Connector */}
            {i < steps.length - 1 && (
              <div
                style={{
                  width: 24,
                  height: 2,
                  background:
                    step.id < currentStep ? colors.completed : colors.upcoming,
                  marginInline: 4,
                  marginBottom: 20,
                  transition: "background 0.3s",
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Detail panel */}
      <AnimatePresence mode="wait">
        {currentStep === 0 ? (
          <motion.div
            key="start"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              padding: "32px 24px",
              textAlign: "center",
              background: colors.panelBg,
            }}
          >
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: colors.text,
                marginBottom: 8,
              }}
            >
              代理迴圈
            </div>
            <div
              style={{
                fontSize: 14,
                color: colors.textMuted,
                marginBottom: 20,
                maxWidth: 480,
                marginInline: "auto",
                lineHeight: 1.6,
              }}
            >
              逐步遍歷 Claude Code 核心迴圈的一次迭代。每次迭代接收輸入、呼叫模型、執行工具，並決定是繼續還是回應。
            </div>
            <button
              onClick={() => setCurrentStep(1)}
              style={{
                background: colors.active,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "10px 24px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "var(--font-mono)",
              }}
            >
              開始迴圈
            </button>
          </motion.div>
        ) : activeStep && currentStep !== 8 ? (
          <motion.div
            key={`step-${currentStep}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            style={{
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              padding: 24,
              background: colors.panelBg,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                color: colors.active,
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              步驟 {activeStep.id} / 8
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: colors.text,
                marginBottom: 10,
              }}
            >
              {activeStep.title}
            </div>
            <div
              style={{
                fontSize: 14,
                color: colors.textMuted,
                lineHeight: 1.7,
                marginBottom: 16,
                maxWidth: 600,
              }}
            >
              {activeStep.description}
            </div>
            <div style={{ color: colors.text }}>{activeStep.visual}</div>
          </motion.div>
        ) : currentStep === 8 ? (
          <motion.div
            key="decision"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            style={{
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              padding: 24,
              background: colors.panelBg,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                color: colors.active,
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              步驟 8 / 8
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: colors.text,
                marginBottom: 10,
              }}
            >
              Decision
            </div>
            <div
              style={{
                fontSize: 14,
                color: colors.textMuted,
                lineHeight: 1.7,
                marginBottom: 20,
                maxWidth: 600,
              }}
            >
              {steps[7].description}
            </div>

            {decision === null ? (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button
                  onClick={() => handleDecision("loop")}
                  style={{
                    background: "transparent",
                    border: `2px solid ${colors.active}`,
                    color: colors.active,
                    borderRadius: 8,
                    padding: "10px 20px",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "var(--font-mono)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    style={{ flexShrink: 0 }}
                  >
                    <path
                      d="M2 8a6 6 0 0 1 10.47-4.03L10 6h5V1l-2.11 2.11A7.98 7.98 0 0 0 0 8h2z"
                      fill="currentColor"
                    />
                  </svg>
                  回到迴圈（更多工具呼叫）
                </button>
                <button
                  onClick={() => handleDecision("exit")}
                  style={{
                    background: colors.active,
                    border: `2px solid ${colors.active}`,
                    color: "#fff",
                    borderRadius: 8,
                    padding: "10px 20px",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "var(--font-mono)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    style={{ flexShrink: 0 }}
                  >
                    <path
                      d="M3 8h8m0 0L7 4m4 4L7 12"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  退出（回應使用者）
                </button>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  padding: "16px 20px",
                  borderRadius: 8,
                  background:
                    decision === "loop"
                      ? "rgba(217, 119, 87, 0.1)"
                      : "rgba(34, 197, 94, 0.1)",
                  border: `1px solid ${decision === "loop" ? "rgba(217, 119, 87, 0.3)" : "rgba(34, 197, 94, 0.3)"}`,
                }}
              >
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: colors.text,
                    marginBottom: 4,
                  }}
                >
                  {decision === "loop"
                    ? "迭代完成——回到步驟 1"
                    : "迭代完成——回應使用者"}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: colors.textMuted,
                  }}
                >
                  {decision === "loop"
                    ? `模型需要更多資訊。開始迭代 ${iteration + 1}...`
                    : "模型已收集足夠資訊，正在產生最終回應。"}
                </div>
                {decision === "exit" && (
                  <button
                    onClick={handleReset}
                    style={{
                      marginTop: 12,
                      background: "transparent",
                      border: `1px solid ${colors.border}`,
                      color: colors.textMuted,
                      borderRadius: 6,
                      padding: "6px 14px",
                      fontSize: 13,
                      cursor: "pointer",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    重新開始
                  </button>
                )}
              </motion.div>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Controls */}
      {currentStep > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 16,
          }}
        >
          <button
            onClick={handlePrev}
            disabled={currentStep <= 1}
            style={{
              background: "transparent",
              border: `1px solid ${colors.border}`,
              color: currentStep <= 1 ? colors.upcoming : colors.text,
              borderRadius: 6,
              padding: "8px 16px",
              fontSize: 13,
              cursor: currentStep <= 1 ? "default" : "pointer",
              fontFamily: "var(--font-mono)",
              opacity: currentStep <= 1 ? 0.4 : 1,
            }}
          >
            上一步
          </button>
          <button
            onClick={handleReset}
            style={{
              background: "transparent",
              border: "none",
              color: colors.textMuted,
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            重置
          </button>
          <button
            onClick={handleNext}
            disabled={currentStep >= 8}
            style={{
              background:
                currentStep >= 8 ? colors.upcoming : colors.active,
              border: "none",
              color: "#fff",
              borderRadius: 6,
              padding: "8px 16px",
              fontSize: 13,
              cursor: currentStep >= 8 ? "default" : "pointer",
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
              opacity: currentStep >= 8 ? 0.4 : 1,
            }}
          >
            下一步
          </button>
        </div>
      )}
    </div>
  );
}
