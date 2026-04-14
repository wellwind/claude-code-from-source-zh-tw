import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// --- Dark Mode Hook ---

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

// --- Data Types ---

interface EscalationStep {
  id: number;
  label: string;
  description: string;
  detail: string;
  successCriteria: string;
}

interface ErrorType {
  id: string;
  title: string;
  code: string;
  icon: string;
  steps: EscalationStep[];
}

// --- Error Type Data ---

const errorTypes: ErrorType[] = [
  {
    id: "prompt-too-long",
    title: "提示詞過長",
    code: "413",
    icon: "\u26A0",
    steps: [
      {
        id: 1,
        label: "上下文摺疊排流",
        description:
          "排流已暫存的上下文摺疊——移除已標記為刪除的冗長工具結果和較早的對話區段。",
        detail:
          "上下文管線會主動暫存摺疊。此步驟只是將它們清空。廉價且快速。",
        successCriteria: "token 數量降至模型的上下文視窗以下",
      },
      {
        id: 2,
        label: "反應式壓縮",
        description:
          "透過專用的壓縮子代理進行緊急摘要。將整個對話重寫為濃縮摘要。",
        detail:
          "單次防護：hasAttemptedReactiveCompact 防止無窮迴圈。每種錯誤類型只觸發一次，再也不會重複。",
        successCriteria:
          "壓縮成功且新的 token 數量符合上下文視窗",
      },
      {
        id: 3,
        label: "浮現錯誤並結束",
        description:
          "所有復原措施已耗盡。錯誤最終被浮現給使用者，迴圈終止。",
        detail:
          '回傳 Terminal { reason: "prompt_too_long" }。抑制模式在此結束——這是使用者第一次看到錯誤。',
        successCriteria: "不適用——終止狀態",
      },
    ],
  },
  {
    id: "max-output-tokens",
    title: "最大輸出 Token",
    code: "max_tokens",
    icon: "\u2702",
    steps: [
      {
        id: 1,
        label: "8K → 64K 升級",
        description:
          "預設輸出上限為 8,000 token（p99 輸出為 4,911）。當遞到上限時，透過 maxOutputTokensOverride 升級至 64K。",
        detail:
          "只有 <1% 的請求會遞到 8K 上限。低預設值在船隊規模下節省了大量成本。",
        successCriteria: "回應在 64K token 內完成",
      },
      {
        id: 2,
        label: "多輪復原 (×3)",
        description:
          "在 64K 仍然遞到上限。保留模型的部分回應，並發送繼續請求。最多 3 次嘗試。",
        detail:
          "maxOutputTokensRecoveryCount 追蹤嘗試次數。每次繼續會附加部分輸出並要求模型繼續。",
        successCriteria:
          "模型在 3 次繼續嘗試內完成回應",
      },
      {
        id: 3,
        label: "浮現錯誤並結束",
        description:
          "3 次復原嘗試已耗盡。保留累積的部分輸出，但迴圈結束。",
        detail:
          '回傳 Terminal { reason: "completed" } 並帶有部分輸出。使用者會看到模型成功產生的內容。',
        successCriteria: "不適用——終止狀態",
      },
    ],
  },
  {
    id: "media-size",
    title: "媒體 / 大小錯誤",
    code: "media_error",
    icon: "\uD83D\uDDBC",
    steps: [
      {
        id: 1,
        label: "移除媒體後重試",
        description:
          "從請求中移除媒體附件（圖片、PDF）並重試。使用反應式壓縮重建不含過大內容的上下文。",
        detail:
          "由 ImageSizeError、ImageResizeError 或類似錯誤觸發。單次 hasAttemptedReactiveCompact 防護也適用於此。",
        successCriteria:
          "移除媒體並重新壓縮上下文後請求成功",
      },
      {
        id: 2,
        label: "浮現錯誤並結束",
        description:
          "媒體移除未能解決問題。錯誤被浮現給使用者。",
        detail:
          '回傳 Terminal { reason: "image_error" }。獨立的終止原因讓呼叫者可以顯示媒體專用的引導。',
        successCriteria: "不適用——終止狀態",
      },
    ],
  },
];

// --- Step Status ---

type StepStatus = "idle" | "active" | "success" | "failure";

// --- Component ---

export default function ErrorEscalation({
  className = "",
}: {
  className?: string;
}) {
  const isDark = useDarkMode();
  const [selectedError, setSelectedError] = useState<string>("prompt-too-long");
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>(
    {}
  );
  const [recoveryStep, setRecoveryStep] = useState<number>(1);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showWithholding, setShowWithholding] = useState(false);
  const animationRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentError = errorTypes.find((e) => e.id === selectedError)!;
  const maxSteps = currentError.steps.length;

  // Colors
  const colors = {
    bg: isDark ? "#1e1e1c" : "#ffffff",
    surface: isDark ? "#2a2a28" : "#f5f4ed",
    surfaceHover: isDark ? "#333331" : "#e8e6dc",
    text: isDark ? "#f5f4ed" : "#141413",
    textMuted: isDark ? "#87867f" : "#87867f",
    border: isDark ? "#444" : "#c2c0b6",
    terracotta: "#d97757",
    green: "#22c55e",
    red: "#ef4444",
    greenBg: isDark ? "rgba(34, 197, 94, 0.1)" : "rgba(34, 197, 94, 0.08)",
    redBg: isDark ? "rgba(239, 68, 68, 0.1)" : "rgba(239, 68, 68, 0.08)",
    terracottaBg: isDark
      ? "rgba(217, 119, 87, 0.15)"
      : "rgba(217, 119, 87, 0.1)",
    withholdBg: isDark
      ? "rgba(237, 161, 0, 0.12)"
      : "rgba(237, 161, 0, 0.08)",
  };

  const resetAnimation = useCallback(() => {
    if (animationRef.current) clearTimeout(animationRef.current);
    setStepStatuses({});
    setIsAnimating(false);
    setShowWithholding(false);
  }, []);

  // Reset when error type changes
  useEffect(() => {
    resetAnimation();
  }, [selectedError, resetAnimation]);

  const triggerError = useCallback(() => {
    if (isAnimating) return;
    resetAnimation();
    setIsAnimating(true);
    setShowWithholding(true);

    const steps = currentError.steps;
    let delay = 600;

    // Animate through steps
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepKey = `${currentError.id}-${step.id}`;
      const isRecoveryPoint = i + 1 === recoveryStep;
      const isLastStep = i === steps.length - 1;

      // Mark active
      const activateDelay = delay;
      animationRef.current = setTimeout(() => {
        setStepStatuses((prev) => ({ ...prev, [stepKey]: "active" }));
      }, activateDelay);
      delay += 1200;

      // Mark result
      const resultDelay = delay;
      if (isRecoveryPoint && !isLastStep) {
        // Recovery succeeds here
        animationRef.current = setTimeout(() => {
          setStepStatuses((prev) => ({ ...prev, [stepKey]: "success" }));
          setShowWithholding(false);
          setTimeout(() => setIsAnimating(false), 400);
        }, resultDelay);
        break;
      } else if (isLastStep) {
        // Terminal failure
        animationRef.current = setTimeout(() => {
          setStepStatuses((prev) => ({ ...prev, [stepKey]: "failure" }));
          setShowWithholding(false);
          setTimeout(() => setIsAnimating(false), 400);
        }, resultDelay);
      } else {
        // Step fails, escalate
        animationRef.current = setTimeout(() => {
          setStepStatuses((prev) => ({ ...prev, [stepKey]: "failure" }));
        }, resultDelay);
        delay += 600;
      }
    }
  }, [isAnimating, currentError, recoveryStep, resetAnimation]);

  const getStepStatus = (stepId: number): StepStatus => {
    return stepStatuses[`${currentError.id}-${stepId}`] || "idle";
  };

  const statusIcon = (status: StepStatus) => {
    switch (status) {
      case "success":
        return "\u2713";
      case "failure":
        return "\u2717";
      case "active":
        return "\u25CF";
      default:
        return null;
    }
  };

  const statusColor = (status: StepStatus) => {
    switch (status) {
      case "success":
        return colors.green;
      case "failure":
        return colors.red;
      case "active":
        return colors.terracotta;
      default:
        return colors.border;
    }
  };

  const statusBg = (status: StepStatus) => {
    switch (status) {
      case "success":
        return colors.greenBg;
      case "failure":
        return colors.redBg;
      case "active":
        return colors.terracottaBg;
      default:
        return "transparent";
    }
  };

  return (
    <div
      className={className}
      style={{
        fontFamily: "var(--font-serif)",
        color: colors.text,
        maxWidth: 820,
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h3
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            fontWeight: 600,
            margin: "0 0 6px 0",
            color: colors.text,
          }}
        >
          錯誤復原升級階梯
        </h3>
        <p
          style={{
            fontSize: 14,
            color: colors.textMuted,
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          錯誤會被{" "}
          <strong style={{ color: colors.terracotta }}>
            從串流中抑制
          </strong>{" "}
          同時復原嘗試在背後靈靠進行。使用者只有在所有步驟都失敗時才會看到錯誤。
        </p>
      </div>

      {/* Error Type Tabs */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        {errorTypes.map((err) => {
          const isSelected = selectedError === err.id;
          return (
            <button
              key={err.id}
              onClick={() => setSelectedError(err.id)}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: `1px solid ${isSelected ? colors.terracotta : colors.border}`,
                background: isSelected ? colors.terracottaBg : colors.surface,
                color: isSelected ? colors.terracotta : colors.text,
                cursor: "pointer",
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                fontWeight: isSelected ? 600 : 400,
                transition: "all 0.15s ease",
              }}
            >
              <span style={{ marginRight: 6 }}>{err.icon}</span>
              {err.title}
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 11,
                  opacity: 0.6,
                }}
              >
                {err.code}
              </span>
            </button>
          );
        })}
      </div>

      {/* Controls Row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={triggerError}
          disabled={isAnimating}
          style={{
            padding: "8px 20px",
            borderRadius: 8,
            border: "none",
            background: isAnimating ? colors.textMuted : colors.terracotta,
            color: "#fff",
            cursor: isAnimating ? "not-allowed" : "pointer",
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            fontWeight: 600,
            transition: "all 0.15s ease",
          }}
        >
          {isAnimating ? "復原中..." : "觸發錯誤"}
        </button>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            color: colors.textMuted,
          }}
        >
          <label
            style={{
              fontFamily: "var(--font-mono)",
              whiteSpace: "nowrap",
            }}
          >
            復原成功於步驟：
          </label>
          <div style={{ display: "flex", gap: 4 }}>
            {currentError.steps.map((step, i) => {
              const isTerminal = i === currentError.steps.length - 1;
              return (
                <button
                  key={step.id}
                  onClick={() => {
                    if (!isAnimating) {
                      setRecoveryStep(step.id);
                      resetAnimation();
                    }
                  }}
                  disabled={isAnimating}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    border: `1px solid ${recoveryStep === step.id ? colors.terracotta : colors.border}`,
                    background:
                      recoveryStep === step.id
                        ? colors.terracottaBg
                        : colors.surface,
                    color:
                      recoveryStep === step.id
                        ? colors.terracotta
                        : isTerminal
                          ? colors.red
                          : colors.text,
                    cursor: isAnimating ? "not-allowed" : "pointer",
                    fontFamily: "var(--font-mono)",
                    fontSize: 13,
                    fontWeight: recoveryStep === step.id ? 700 : 400,
                  }}
                  title={
                    isTerminal
                      ? "所有復原均失敗"
                      : `復原成功於步驟 ${step.id}`
                  }
                >
                  {isTerminal ? "\u2717" : step.id}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Withholding Banner */}
      <AnimatePresence>
        {showWithholding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              background: colors.withholdBg,
              border: `1px solid rgba(237, 161, 0, 0.3)`,
              borderRadius: 8,
              padding: "10px 16px",
              marginBottom: 16,
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "#eda100",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <motion.span
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              \u25CF
            </motion.span>
            <span>
              錯誤已從串流中抑制——復原進行中。使用者不會看到任何訊息。
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Escalation Ladder */}
      <div
        style={{
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
          overflow: "hidden",
          background: colors.surface,
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentError.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {currentError.steps.map((step, idx) => {
              const status = getStepStatus(step.id);
              const isLast = idx === currentError.steps.length - 1;

              return (
                <div key={step.id}>
                  <motion.div
                    animate={{
                      backgroundColor: statusBg(status),
                    }}
                    transition={{ duration: 0.3 }}
                    style={{
                      padding: "16px 20px",
                      position: "relative",
                    }}
                  >
                    {/* Step Header */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                      }}
                    >
                      {/* Step Number / Status */}
                      <motion.div
                        animate={{
                          borderColor: statusColor(status),
                          color: statusColor(status),
                        }}
                        transition={{ duration: 0.3 }}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          border: `2px solid ${statusColor(status)}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontFamily: "var(--font-mono)",
                          fontSize: 14,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {status === "active" ? (
                          <motion.span
                            animate={{ scale: [1, 1.3, 1] }}
                            transition={{
                              duration: 0.8,
                              repeat: Infinity,
                            }}
                          >
                            {statusIcon(status)}
                          </motion.span>
                        ) : statusIcon(status) ? (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{
                              type: "spring",
                              stiffness: 300,
                              damping: 15,
                            }}
                          >
                            {statusIcon(status)}
                          </motion.span>
                        ) : (
                          step.id
                        )}
                      </motion.div>

                      {/* Step Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "baseline",
                            gap: 8,
                            marginBottom: 4,
                          }}
                        >
                          <span
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: 14,
                              fontWeight: 600,
                              color:
                                status !== "idle"
                                  ? statusColor(status)
                                  : colors.text,
                            }}
                          >
                            {step.label}
                          </span>
                          {status === "success" && (
                            <motion.span
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              style={{
                                fontFamily: "var(--font-mono)",
                                fontSize: 12,
                                color: colors.green,
                                fontWeight: 600,
                              }}
                            >
                              已復原！
                            </motion.span>
                          )}
                          {status === "failure" && isLast && (
                            <motion.span
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              style={{
                                fontFamily: "var(--font-mono)",
                                fontSize: 12,
                                color: colors.red,
                                fontWeight: 600,
                              }}
                            >
                              所有復原已耗盡
                            </motion.span>
                          )}
                        </div>
                        <p
                          style={{
                            fontSize: 13,
                            color: colors.textMuted,
                            margin: "0 0 6px 0",
                            lineHeight: 1.5,
                          }}
                        >
                          {step.description}
                        </p>
                        <div
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 11,
                            color: colors.textMuted,
                            opacity: 0.8,
                            lineHeight: 1.5,
                          }}
                        >
                          {step.detail}
                        </div>

                        {/* Success criteria */}
                        <div
                          style={{
                            marginTop: 8,
                            fontSize: 12,
                            fontFamily: "var(--font-mono)",
                            color:
                              status === "success"
                                ? colors.green
                                : colors.textMuted,
                            opacity: status === "idle" ? 0.5 : 0.9,
                          }}
                        >
                          <span style={{ opacity: 0.6 }}>\u2192 </span>
                          {step.successCriteria}
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Escalation Arrow */}
                  {!isLast && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        paddingLeft: 34,
                        height: 28,
                        position: "relative",
                      }}
                    >
                      <motion.div
                        animate={{
                          opacity:
                            getStepStatus(step.id) === "failure" ? 1 : 0.3,
                          color:
                            getStepStatus(step.id) === "failure"
                              ? colors.red
                              : colors.border,
                        }}
                        transition={{ duration: 0.3 }}
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 12,
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span style={{ fontSize: 16 }}>\u2193</span>
                        <span>
                          {getStepStatus(step.id) === "failure"
                            ? "失敗——正在升級..."
                            : "升級至"}
                        </span>
                      </motion.div>
                    </div>
                  )}
                </div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Death Spiral Guards */}
      <div
        style={{
          marginTop: 16,
          padding: "12px 16px",
          borderRadius: 8,
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          fontSize: 12,
          fontFamily: "var(--font-mono)",
          color: colors.textMuted,
          lineHeight: 1.6,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 6, color: colors.text }}>
          死亡迴圈防護
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span>
            \u2022 <code>hasAttemptedReactiveCompact</code> —— 單次旗標，每個錯誤只觸發一次
          </span>
          <span>
            \u2022 <code>MAX_OUTPUT_TOKENS_RECOVERY_LIMIT = 3</code> —— 繼續次數的硬性上限
          </span>
          <span>
            \u2022 自動壓縮連續失敗 3 次後觸發斷路器
          </span>
          <span>
            \u2022 錯誤回應不執行停止鉤子（防止錯誤 \u2192 鉤子
            \u2192 重試 \u2192 錯誤迴圈）
          </span>
        </div>
      </div>
    </div>
  );
}
