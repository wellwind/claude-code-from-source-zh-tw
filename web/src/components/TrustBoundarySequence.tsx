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

const beforeItems = [
  "TLS socket 預連接",
  "環境變數載入",
  "快速路徑檢查（--version、--help）",
  "子程序產生（git status）",
  "Keychain 讀取",
];

const boundaryItems = [
  "服務條款接受",
  "登入 / 認證",
  "信任裝置提示",
  "設定對話框（共 10 個）",
];

const afterItems = [
  "解析 CLI 參數",
  "解析設定",
  "載入命令、代理、鉤子",
  "初始化 MCP 伺服器",
  "建構系統提示詞",
  "啟動 REPL 或單次執行",
];

interface Props {
  className?: string;
}

export default function TrustBoundarySequence({ className }: Props) {
  const isDark = useDarkMode();

  const colors = {
    text: isDark ? "#f5f4ed" : "#141413",
    textSecondary: "#87867f",
    cardBg: isDark ? "#1e1e1c" : "#ffffff",
    cardBorder: isDark ? "#333" : "#e8e6dc",
    terracotta: "#d97757",
    surfaceBg: isDark ? "#141413" : "#f5f4ed",
  };

  const sectionStyle = (flex: number): React.CSSProperties => ({
    flex,
    padding: "16px 20px",
    background: colors.cardBg,
    borderRadius: 10,
    border: `1px solid ${colors.cardBorder}`,
  });

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    fontFamily: "var(--font-mono)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: colors.textSecondary,
    marginBottom: 12,
  };

  const itemStyle: React.CSSProperties = {
    fontSize: 12,
    color: colors.text,
    padding: "6px 0",
    borderBottom: `1px solid ${colors.cardBorder}`,
    lineHeight: 1.5,
  };

  return (
    <div className={className} style={{ fontFamily: "var(--font-serif)" }}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{
          display: "flex",
          gap: 0,
          alignItems: "stretch",
          width: "100%",
        }}
      >
        {/* Before Trust */}
        <div style={sectionStyle(3)}>
          <div style={labelStyle}>信任之前</div>
          {beforeItems.map((item, i) => (
            <div
              key={i}
              style={{
                ...itemStyle,
                borderBottom:
                  i === beforeItems.length - 1 ? "none" : itemStyle.borderBottom,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: colors.textSecondary,
                  marginRight: 8,
                }}
              >
                {i + 1}.
              </span>
              {item}
            </div>
          ))}
          <div
            style={{
              fontSize: 11,
              color: colors.textSecondary,
              marginTop: 10,
              fontStyle: "italic",
            }}
          >
            尚未存取使用者資料
          </div>
        </div>

        {/* Trust Boundary Divider */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 4px",
            minWidth: 140,
            position: "relative",
          }}
        >
          {/* Vertical line top */}
          <div
            style={{
              width: 2,
              flex: 1,
              background: colors.terracotta,
              opacity: 0.4,
            }}
          />

          {/* Badge */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              background: `${colors.terracotta}15`,
              border: `2px solid ${colors.terracotta}`,
              textAlign: "center",
              margin: "8px 0",
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                fontWeight: 700,
                color: colors.terracotta,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: 4,
              }}
            >
              信任邊界
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {boundaryItems.map((item, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 10,
                    color: colors.textSecondary,
                    fontFamily: "var(--font-mono)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Vertical line bottom */}
          <div
            style={{
              width: 2,
              flex: 1,
              background: colors.terracotta,
              opacity: 0.4,
            }}
          />
        </div>

        {/* After Trust */}
        <div style={sectionStyle(3)}>
          <div style={labelStyle}>信任之後</div>
          {afterItems.map((item, i) => (
            <div
              key={i}
              style={{
                ...itemStyle,
                borderBottom:
                  i === afterItems.length - 1 ? "none" : itemStyle.borderBottom,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: colors.textSecondary,
                  marginRight: 8,
                }}
              >
                {i + 1}.
              </span>
              {item}
            </div>
          ))}
          <div
            style={{
              fontSize: 11,
              color: colors.textSecondary,
              marginTop: 10,
              fontStyle: "italic",
            }}
          >
            進行完整初始化
          </div>
        </div>
      </motion.div>

      {/* Timeline arrow */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.3 }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: 14,
          gap: 8,
        }}
      >
        <svg width="100%" height="12" viewBox="0 0 600 12" preserveAspectRatio="xMidYMid meet" style={{ maxWidth: 600 }}>
          <line x1={20} y1={6} x2={574} y2={6} stroke={colors.textSecondary} strokeWidth={1} strokeDasharray="4,3" />
          <polygon points="574,3 580,6 574,9" fill={colors.textSecondary} />
          <text x={10} y={10} fontSize="8" fill={colors.textSecondary} fontFamily="var(--font-mono)">t=0</text>
        </svg>
      </motion.div>
    </div>
  );
}
