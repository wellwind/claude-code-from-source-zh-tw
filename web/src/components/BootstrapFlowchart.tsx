import { useState, useEffect } from "react";
import { motion } from "framer-motion";

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

interface Step {
  file: string;
  description: string;
  detail: string;
  hasFastPath?: boolean;
  isDestination?: boolean;
}

const steps: Step[] = [
  {
    file: "cli.tsx",
    description: "快速路徑分派",
    detail: "--version、--help 立即退出",
    hasFastPath: true,
  },
  {
    file: "main.tsx",
    description: "模組層級 I/O",
    detail: "子行程產生、金鑰圈讀取、TLS 預連線",
  },
  {
    file: "init.ts",
    description: "解析參數、信任邊界",
    detail: "設定解析、10 個設定對話框、init()",
  },
  {
    file: "setup.ts",
    description: "命令、代理、鉤子、外掛",
    detail: "平行載入並等待 I/O 結果",
  },
  {
    file: "replLauncher.ts",
    description: "七條啟動路徑匯聚",
    detail: "REPL、單次執行、繼續、MCP、管道、eval、協調器",
    isDestination: true,
  },
];

interface Props {
  className?: string;
}

export default function BootstrapFlowchart({ className }: Props) {
  const isDark = useDarkMode();

  const colors = {
    text: isDark ? "#f5f4ed" : "#141413",
    textSecondary: "#87867f",
    cardBg: isDark ? "#1e1e1c" : "#ffffff",
    cardBorder: isDark ? "#333" : "#e8e6dc",
    terracotta: "#d97757",
    surfaceBg: isDark ? "#141413" : "#f5f4ed",
    connector: isDark ? "#555" : "#c2c0b6",
    fastPath: "#ef4444",
  };

  return (
    <div className={className} style={{ fontFamily: "var(--font-serif)" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 0,
        }}
      >
        {steps.map((step, i) => (
          <div
            key={step.file}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            {/* Step card */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.1 }}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: 16,
                width: "100%",
                maxWidth: 520,
              }}
            >
              {/* Step number */}
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: step.isDestination
                    ? colors.terracotta
                    : `${colors.terracotta}18`,
                  border: `1.5px solid ${step.isDestination ? colors.terracotta : `${colors.terracotta}60`}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: "var(--font-mono)",
                  color: step.isDestination ? "#fff" : colors.terracotta,
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </div>

              {/* Card */}
              <div
                style={{
                  flex: 1,
                  background: step.isDestination
                    ? `${colors.terracotta}10`
                    : colors.cardBg,
                  border: `1.5px solid ${step.isDestination ? colors.terracotta : colors.cardBorder}`,
                  borderRadius: 10,
                  padding: "14px 18px",
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      fontFamily: "var(--font-mono)",
                      color: step.isDestination ? colors.terracotta : colors.text,
                    }}
                  >
                    {step.file}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: colors.textSecondary,
                    }}
                  >
                    {step.description}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: colors.textSecondary,
                    marginTop: 4,
                    lineHeight: 1.4,
                  }}
                >
                  {step.detail}
                </div>
              </div>

              {/* Fast path exit branch */}
              {step.hasFastPath && (
                <div
                  style={{
                    position: "absolute",
                    right: -130,
                    top: "50%",
                    transform: "translateY(-50%)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <svg width="40" height="2" viewBox="0 0 40 2">
                    <line
                      x1={0}
                      y1={1}
                      x2={34}
                      y2={1}
                      stroke={colors.fastPath}
                      strokeWidth={1.5}
                      strokeDasharray="3,2"
                    />
                    <polygon points="34,0 40,1 34,2" fill={colors.fastPath} />
                  </svg>
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: "var(--font-mono)",
                      color: colors.fastPath,
                      whiteSpace: "nowrap",
                      fontWeight: 600,
                    }}
                  >
                    exit(0)
                  </span>
                </div>
              )}
            </motion.div>

            {/* Arrow between steps */}
            {i < steps.length - 1 && (
              <svg
                width="20"
                height="24"
                viewBox="0 0 20 24"
                style={{ display: "block" }}
              >
                <line
                  x1={10}
                  y1={0}
                  x2={10}
                  y2={18}
                  stroke={colors.connector}
                  strokeWidth={1.5}
                />
                <polygon points="6,18 10,24 14,18" fill={colors.connector} />
              </svg>
            )}
          </div>
        ))}

        {/* Running REPL label */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.6 }}
          style={{
            marginTop: 14,
            padding: "8px 20px",
            borderRadius: 20,
            background: `${colors.terracotta}15`,
            border: `1px solid ${colors.terracotta}40`,
            fontSize: 13,
            fontFamily: "var(--font-mono)",
            fontWeight: 600,
            color: colors.terracotta,
          }}
        >
          REPL 執行中
        </motion.div>
      </div>
    </div>
  );
}
