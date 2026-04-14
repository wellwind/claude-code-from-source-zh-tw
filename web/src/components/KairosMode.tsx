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
  label: string;
  detail: string;
}

const standardSteps: Step[] = [
  { label: "模型觀察", detail: "在對話中偵測到模式、修正或重要事實" },
  { label: "建立記憶檔案", detail: "立即寫入分類好的 .md 檔案（user_、feedback_、project_）" },
  { label: "更新 MEMORY.md 索引", detail: "將參考連結加入始終載入的索引檔案" },
];

const kairosSteps: Step[] = [
  { label: "模型觀察", detail: "相同的偵測，但延遲結構化儲存" },
  { label: "附加到每日日誌", detail: "快速附加到今天的原始日誌 — 對流程的干擾最小" },
  { label: "夜間 /dream 整合", detail: "批次處理：去重、分類、修剪、更新索引" },
];

interface Props {
  className?: string;
}

export default function KairosMode({ className }: Props) {
  const isDark = useDarkMode();

  const colors = {
    text: isDark ? "#f5f4ed" : "#141413",
    textSecondary: "#87867f",
    cardBg: isDark ? "#1e1e1c" : "#ffffff",
    cardBorder: isDark ? "#333" : "#e8e6dc",
    terracotta: "#d97757",
    surfaceBg: isDark ? "#141413" : "#f5f4ed",
    connector: isDark ? "#555" : "#c2c0b6",
    kairosAccent: "#a78bfa",
    standardAccent: "#60a5fa",
  };

  const renderColumn = (
    title: string,
    subtitle: string,
    steps: Step[],
    accent: string,
    icon: React.ReactNode,
    delay: number
  ) => (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      style={{
        flex: 1,
        background: colors.cardBg,
        border: `1.5px solid ${colors.cardBorder}`,
        borderRadius: 12,
        padding: "20px",
        minWidth: 260,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 6,
        }}
      >
        {icon}
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: accent,
            fontFamily: "var(--font-mono)",
          }}
        >
          {title}
        </div>
      </div>
      <div
        style={{
          fontSize: 12,
          color: colors.textSecondary,
          marginBottom: 20,
        }}
      >
        {subtitle}
      </div>

      {/* Steps */}
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {steps.map((step, i) => (
          <div key={step.label}>
            {/* Step card */}
            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              {/* Step indicator */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: `${accent}18`,
                    border: `1.5px solid ${accent}50`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: "var(--font-mono)",
                    color: accent,
                  }}
                >
                  {i + 1}
                </div>
              </div>

              {/* Content */}
              <div style={{ paddingBottom: 4 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: colors.text,
                    marginBottom: 3,
                  }}
                >
                  {step.label}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: colors.textSecondary,
                    lineHeight: 1.5,
                  }}
                >
                  {step.detail}
                </div>
              </div>
            </div>

            {/* Connector line between steps */}
            {i < steps.length - 1 && (
              <div
                style={{
                  marginLeft: 13,
                  width: 2,
                  height: 16,
                  background: `${accent}30`,
                  borderRadius: 1,
                }}
              />
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );

  // Sun icon for Standard
  const sunIcon = (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke={colors.standardAccent}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );

  // Moon icon for KAIROS
  const moonIcon = (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke={colors.kairosAccent}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );

  return (
    <div className={className} style={{ fontFamily: "var(--font-serif)" }}>
      <div
        style={{
          display: "flex",
          gap: 20,
          alignItems: "stretch",
          flexWrap: "wrap",
        }}
      >
        {renderColumn(
          "標準模式",
          "即時、結構化寫入",
          standardSteps,
          colors.standardAccent,
          sunIcon,
          0
        )}

        {/* VS divider */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            alignSelf: "center",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: colors.surfaceBg,
              border: `1.5px solid ${colors.cardBorder}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 700,
              fontFamily: "var(--font-mono)",
              color: colors.textSecondary,
            }}
          >
            vs
          </div>
        </motion.div>

        {renderColumn(
          "KAIROS",
          "延遲、批次整合",
          kairosSteps,
          colors.kairosAccent,
          moonIcon,
          0.15
        )}
      </div>

      {/* Comparison note */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.3 }}
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}
      >
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            background: `${colors.standardAccent}08`,
            border: `1px solid ${colors.standardAccent}25`,
            fontSize: 11,
            color: colors.textSecondary,
            textAlign: "center",
            fontFamily: "var(--font-mono)",
          }}
        >
          優點：即時整理。缺點：打斷流程，可能過度索引
        </div>
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            background: `${colors.kairosAccent}08`,
            border: `1px solid ${colors.kairosAccent}25`,
            fontSize: 11,
            color: colors.textSecondary,
            textAlign: "center",
            fontFamily: "var(--font-mono)",
          }}
        >
          優點：低摩擦，自然修剪。缺點：需要 /dream 的紀律
        </div>
      </motion.div>
    </div>
  );
}
