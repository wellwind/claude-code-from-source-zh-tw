export interface PartConfig {
  number: number;
  title: string;
  epigraph: string;
  chapters: number[];
}

export interface ChapterConfig {
  number: number;
  slug: string;
  title: string;
  description: string;
}

export const parts: PartConfig[] = [
  {
    number: 1,
    title: '基礎',
    epigraph: '在代理能思考之前，行程必須先存在。',
    chapters: [1, 2, 3, 4],
  },
  {
    number: 2,
    title: '核心迴圈',
    epigraph: '代理的心跳：串流、行動、觀察、重複。',
    chapters: [5, 6, 7],
  },
  {
    number: 3,
    title: '多代理協作',
    epigraph: '一個代理很強大。多個代理協同運作則能帶來變革。',
    chapters: [8, 9, 10],
  },
  {
    number: 4,
    title: '持久化與智慧',
    epigraph: '沒有記憶的代理會永遠犯同樣的錯誤。',
    chapters: [11, 12],
  },
  {
    number: 5,
    title: '介面',
    epigraph: '使用者看到的一切都通過這一層。',
    chapters: [13, 14],
  },
  {
    number: 6,
    title: '連接性',
    epigraph: '代理的觸及範圍超越了 localhost。',
    chapters: [15, 16],
  },
  {
    number: 7,
    title: '效能工程',
    epigraph: '讓一切快到人類察覺不到背後的機制。',
    chapters: [17, 18],
  },
];

export const chapters: ChapterConfig[] = [
  { number: 1, slug: 'ch01-architecture', title: 'AI 代理的架構', description: '六大關鍵抽象、資料流、權限系統、建置系統' },
  { number: 2, slug: 'ch02-bootstrap', title: '快速啟動 —— 啟動引導管線', description: '五階段初始化、模組層級 I/O 並行、信任邊界' },
  { number: 3, slug: 'ch03-state', title: '狀態 —— 雙層架構', description: '啟動引導單例、AppState 儲存、黏性閂鎖、成本追蹤' },
  { number: 4, slug: 'ch04-api-layer', title: '與 Claude 對話 —— API 層', description: '多供應商客戶端、提示快取、串流、錯誤復原' },
  { number: 5, slug: 'ch05-agent-loop', title: '代理迴圈', description: 'query.ts 深入剖析、四層壓縮、錯誤復原、token 預算' },
  { number: 6, slug: 'ch06-tools', title: '工具 —— 從定義到執行', description: '工具介面、14 步管線、權限系統' },
  { number: 7, slug: 'ch07-concurrency', title: '並行工具執行', description: '分割演算法、串流執行器、推測性執行' },
  { number: 8, slug: 'ch08-sub-agents', title: '產生子代理', description: 'AgentTool、15 步 runAgent 生命週期、內建代理類型' },
  { number: 9, slug: 'ch09-fork-agents', title: '分叉代理與提示快取', description: '位元組級相同前綴技巧、快取共享、成本最佳化' },
  { number: 10, slug: 'ch10-coordination', title: '任務、協調與群集', description: '任務狀態機、協調者模式、群集訊息傳遞' },
  { number: 11, slug: 'ch11-memory', title: '記憶 —— 跨對話學習', description: '基於檔案的記憶、四類分類法、LLM 召回、過期處理' },
  { number: 12, slug: 'ch12-extensibility', title: '可擴展性 —— 技能與鉤子', description: '兩階段技能載入、生命週期鉤子、快照安全性' },
  { number: 13, slug: 'ch13-terminal-ui', title: '終端機 UI', description: '自訂 Ink 分支、渲染管線、雙緩衝、物件池' },
  { number: 14, slug: 'ch14-input-interaction', title: '輸入與互動', description: '按鍵解析、按鍵綁定、組合鍵支援、Vim 模式' },
  { number: 15, slug: 'ch15-mcp', title: 'MCP —— 通用工具協定', description: '八種傳輸方式、MCP OAuth、工具包裝' },
  { number: 16, slug: 'ch16-remote', title: '遠端控制與雲端執行', description: 'Bridge v1/v2、CCR、上游代理' },
  { number: 17, slug: 'ch17-performance', title: '效能 —— 每一毫秒與 token 都至關重要', description: '啟動、上下文視窗、提示快取、渲染、搜尋' },
  { number: 18, slug: 'ch18-epilogue', title: '結語 —— 我們學到了什麼', description: '五個架構賭注、可轉移的知識、代理的未來方向' },
];

export function getPartForChapter(chapterNumber: number): PartConfig | undefined {
  return parts.find(p => p.chapters.includes(chapterNumber));
}

export function getChapterNumber(slug: string): number {
  const match = slug.match(/^ch(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

export function getAdjacentChapters(chapterNumber: number) {
  const idx = chapters.findIndex(c => c.number === chapterNumber);
  return {
    prev: idx > 0 ? chapters[idx - 1] : null,
    next: idx < chapters.length - 1 ? chapters[idx + 1] : null,
  };
}

export function isFirstChapterOfPart(chapterNumber: number): boolean {
  return parts.some(p => p.chapters[0] === chapterNumber);
}
