# CLAUDE.md

## 這個專案是什麼？

「Claude Code from Source」—— 一本分析 Anthropic Claude Code CLI 架構的技術書籍，透過 npm 洩漏的原始碼映射（Source Map）進行逆向工程。以 O'Reilly 技術書風格撰寫。

## 專案結構

```
claude-code-from-source/
  README.md                    # 書籍封面、目錄、關鍵模式
  CLAUDE.md                    # 本檔案
  book/                        # 書籍內容（18 章，Markdown 格式）
    ch01-architecture.md
    ch02-bootstrap.md
    ch03-state.md
    ch04-api-layer.md
    ch05-agent-loop.md
    ch06-tools.md
    ch07-concurrency.md
    ch08-sub-agents.md
    ch09-fork-agents.md
    ch10-coordination.md
    ch11-memory.md
    ch12-extensibility.md
    ch13-terminal-ui.md
    ch14-input-interaction.md
    ch15-mcp.md
    ch16-remote.md
    ch17-performance.md
    ch18-epilogue.md
  prompts/                     # 可重複使用的書籍生成提示詞
  web/                         # 靜態網頁應用程式（Astro —— 未來計畫）
  .reference/                  # 僅本機使用的素材（已加入 gitignore）
    src/                       # 原始原始碼檔案
    analysis-notes/            # 探索階段的原始分析筆記
```

## 關鍵規則

### 內容規則
- **禁止逐字複製原始碼。** 所有程式碼區塊必須是使用不同變數名稱的虛擬碼。本書教的是模式，而非實作。
- **使用 Mermaid 繪製圖表。** 使用 ```mermaid 圍欄程式碼區塊。在 GitHub 和網頁應用程式中均可渲染。
- **每章結構：開場 → 正文 → 「實踐應用」。**「實踐應用」段落恰好包含 5 個可轉移的模式。
- **一個概念，一個歸屬。** 不要在兩個章節中解釋同一件事。改用交叉引用。

### 語氣
- 專家對專家的解說。直接、有主見、無廢話。
- 「這很巧妙，因為……」而非「值得注意的是……」
- 每個句子都在教某些東西，或為下一個要教的東西做鋪墊。

### Git 規則
- `.reference/` 已加入 gitignore —— 永遠不要提交原始碼檔案或原始分析
- 若提交歷史中包含敏感內容，推送前先壓縮（squash）
- 提交訊息：寫明改了什麼以及為什麼，而非列出修改了哪些檔案

## 儲存庫
- GitHub: alejandrobalderas/claude-code-from-source
- 未來網域：待定（考慮 claude-code-from-source.com）

## 技術堆疊（網頁應用程式 —— 未來計畫）
- Astro 用於靜態網站生成
- 需要時使用 React 元件
- Tailwind 用於樣式設計
- Mermaid.js 用於圖表渲染
- GitHub Pages 用於託管

## 書籍統計
- 18 章，7 個部分 + 結語
- 約 6,200 行 Markdown
- 約 400 頁等量內容
- 25+ 張 Mermaid 圖表
- 由 36 個 AI 代理在約 6 小時內完成製作
