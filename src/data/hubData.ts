export type DomainId = 'english' | 'stats' | 'ml' | 'tools';

export interface StudySite {
  id: string;
  title: string;
  subtitle: string;
  url: string;
  domain: DomainId;
  env: 'online' | 'local' | 'github';
  tags: string[];
  note: string;
  pinned?: boolean;
  launchCmd?: string;
}

export interface WordItem {
  word: string;
  pos: string;
  zh: string;
  fallbackDef: string;
  example: string;
}

export interface MicroBite {
  id: string;
  domain: DomainId;
  topic: string;
  question: string;
  hook: string;
  detail: string;
  example: string;
}

export const DOMAINS: { id: DomainId | 'all'; label: string; accent: string }[] = [
  { id: 'all', label: '全部領域', accent: '#f59e0b' },
  { id: 'english', label: '英文 DET', accent: '#38bdf8' },
  { id: 'stats', label: '統計與生統', accent: '#34d399' },
  { id: 'ml', label: '機器學習 & AI', accent: '#a78bfa' },
  { id: 'tools', label: '閱讀 & 工作台', accent: '#fb7185' },
];

export const DEFAULT_SITES: StudySite[] = [
  {
    id: 'quill-quest',
    title: 'Quill & Quest · DET 主戰場',
    subtitle: '15,804 題全題型離線與雲端題庫（目標 120+）',
    url: 'https://quill-quest-ten.vercel.app/',
    domain: 'english',
    env: 'online',
    tags: ['DET', '題庫', 'Vercel'],
    note: '每日 15–25 分鐘：優先刷 Read & Complete、Listen & Type、難度 3–5',
    pinned: true,
  },
  {
    id: 'quill-guides',
    title: 'Quill & Quest · 語法介詞急救包',
    subtitle: '13 張 30 秒直覺圖解卡＋快測（/#/guides）',
    url: 'https://quill-quest-ten.vercel.app/#/guides',
    domain: 'english',
    env: 'online',
    tags: ['介係詞', '時態', '微指南'],
    note: '做錯 Read & Complete / 寫作時隨時翻查',
    pinned: true,
  },
  {
    id: 'quill-grammar-100',
    title: 'Grammar Survival 100 題',
    subtitle: 'B1→B2 核心文法摸底與句型改寫',
    url: 'https://quill-quest-ten.vercel.app/#/custom?bank=grammar-survival-100',
    domain: 'english',
    env: 'online',
    tags: ['文法', '診斷'],
    note: '檢查時態、假設語氣、非限定關係子句弱點',
  },
  {
    id: 'recall-lab',
    title: 'Recall Lab',
    subtitle: 'GitHub Pages 間隔重複記憶實驗室',
    url: 'https://morefoodq.github.io/recall-lab/',
    domain: 'english',
    env: 'online',
    tags: ['SRS', '記憶', 'GitHub Pages'],
    note: '搭配跨領域概念長期複習',
  },
  {
    id: 'det-official',
    title: 'Duolingo English Test 官方站',
    subtitle: '官方免費不限次數模擬考與題型說明',
    url: 'https://englishtest.duolingo.com/',
    domain: 'english',
    env: 'online',
    tags: ['DET', '模考'],
    note: '每週做 1 次官方模考追蹤分數區間',
  },
  {
    id: 'biostat-study',
    title: 'Biostatistics Study · 雙語生統',
    subtitle: 'Applied Biostatistics Chapters 1–8',
    url: 'https://biostatistics-study.vercel.app/login',
    domain: 'stats',
    env: 'online',
    tags: ['生物統計', 'Vercel', '雙語'],
    note: '重點複習假設檢定、迴歸與存活分析',
    pinned: true,
  },
  {
    id: 'seeing-theory',
    title: 'Seeing Theory · Brown Univ.',
    subtitle: '視覺化機率、分佈與統計推論互動教材',
    url: 'https://seeing-theory.brown.edu/',
    domain: 'stats',
    env: 'online',
    tags: ['機率', '視覺化', '互動'],
    note: '貝氏定理、中央極限定理直覺超清楚',
  },
  {
    id: 'statquest',
    title: 'StatQuest with Josh Starmer',
    subtitle: '統計檢定、PCA、梯度提升與深度學習圖解',
    url: 'https://statquest.org/',
    domain: 'stats',
    env: 'online',
    tags: ['統計', 'ML', '圖解'],
    note: '雙重補強生統與機器學習數學直覺',
  },
  {
    id: 'lobe-chat',
    title: 'LobeChat · 私人 AI 對話台',
    subtitle: '日常英文寫作批改、程式與概念討論',
    url: 'https://lobe-chat-rho-seven-22.vercel.app',
    domain: 'ml',
    env: 'online',
    tags: ['AI', 'Vercel'],
    note: '可用來練 DET 口說／寫作潤飾',
  },
  {
    id: 'hf-papers',
    title: 'Hugging Face Daily Papers',
    subtitle: '每日社群精選 AI / LLM 論文與開源程式',
    url: 'https://huggingface.co/papers',
    domain: 'ml',
    env: 'online',
    tags: ['LLM', '論文', '每日更新'],
    note: '複製 arXiv 網址可直接丟進 PaperDesk 雙語翻譯',
    pinned: true,
  },
  {
    id: 'llms-scratch',
    title: 'LLMs from Scratch (PyTorch)',
    subtitle: '從零手寫 Transformer、Attention 與微調',
    url: 'https://github.com/MoreFoodQ/LLMs-from-scratch',
    domain: 'ml',
    env: 'github',
    tags: ['PyTorch', 'LLM', '實作'],
    note: '從 Tokenizer、Self-Attention 到指令微調',
  },
  {
    id: 'tmu-ai-1017',
    title: 'TMU AI 實務與自動化筆記',
    subtitle: 'AI 流程自動化與低程式碼應用實務班',
    url: 'https://github.com/MoreFoodQ/tmu-ai-1017',
    domain: 'ml',
    env: 'github',
    tags: ['Automation', 'Workflow'],
    note: '實作自動化流程參考倉庫',
  },
  {
    id: 'paperdesk',
    title: 'PaperDesk · 地端論文與電子書台',
    subtitle: 'PDF / EPUB 雙語對照、圖片文字翻譯、GPT 問答',
    url: 'https://github.com/MoreFoodQ/PaperDesk',
    domain: 'tools',
    env: 'local',
    tags: ['PDF', 'EPUB', '地端'],
    note: '地端跑 Codex / Claude CLI 省 API 費；筆記可匯出單檔 HTML',
    launchCmd: 'Open-PaperDesk.cmd',
    pinned: true,
  },
  {
    id: 'quill-local',
    title: 'Quill & Quest · 本機開發／離線站',
    subtitle: '本機 127.0.0.1:5180 免登入直接練習',
    url: 'http://127.0.0.1:5180/',
    domain: 'tools',
    env: 'local',
    tags: ['本機', '127.0.0.1'],
    note: '雙擊 Quill-Quest-Portable\\Start-QuillQuest.cmd 啟動',
    launchCmd: 'Start-QuillQuest.cmd',
  },
];

export const WORD_OF_DAY_POOL: WordItem[] = [
  { word: 'resilient', pos: 'adj.', zh: '有韌性的；能迅速恢復的', fallbackDef: 'Able to recover quickly from difficulties or adapt well to change.', example: 'Resilient learners treat daily mistakes as diagnostic feedback.' },
  { word: 'mitigate', pos: 'v.', zh: '減輕；緩和', fallbackDef: 'To make something less severe, harmful, or painful.', example: 'Early screening can significantly mitigate long-term health risks.' },
  { word: 'coherent', pos: 'adj.', zh: '連貫的；邏輯清晰的', fallbackDef: 'Logical, consistent, and easy to understand as a whole.', example: 'A coherent essay connects every supporting example back to its claim.' },
  { word: 'empirical', pos: 'adj.', zh: '實證的；經驗驗證的', fallbackDef: 'Based on observation, measurement, or experiment rather than pure theory.', example: 'The team presented empirical evidence from a five-year cohort study.' },
  { word: 'feasible', pos: 'adj.', zh: '可行的；切實可能的', fallbackDef: 'Possible and practical to do easily or conveniently.', example: 'Running the pipeline locally proved more feasible than cloud hosting.' },
  { word: 'substantiate', pos: 'v.', zh: '證實；提供證據支持', fallbackDef: 'To provide evidence to support or prove the truth of a claim.', example: 'You need concrete examples to substantiate your argument in 5 minutes.' },
  { word: 'ubiquitous', pos: 'adj.', zh: '無所不在的；普遍存在的', fallbackDef: 'Present, appearing, or found everywhere.', example: 'Transformer architectures have become ubiquitous across modern NLP.' },
  { word: 'discrepancy', pos: 'n.', zh: '差異；不一致', fallbackDef: 'An unexpected difference between two figures, facts, or accounts.', example: 'Researchers investigated the discrepancy between the two hospital cohorts.' },
  { word: 'robust', pos: 'adj.', zh: '穩健的；強固的', fallbackDef: 'Strong and unlikely to fail or weaken under varied conditions.', example: 'Cross-validation helps ensure the model remains robust on unseen data.' },
  { word: 'prevalent', pos: 'adj.', zh: '普遍的；盛行的', fallbackDef: 'Widespread in a particular area or at a particular time.', example: 'Remote collaboration became increasingly prevalent after 2020.' },
  { word: 'constrain', pos: 'v.', zh: '限制；約束', fallbackDef: 'To severely restrict the scope, extent, or activity of something.', example: 'Limited sample size can constrain the statistical power of a trial.' },
  { word: 'plausible', pos: 'adj.', zh: '看似合理的；可信的', fallbackDef: 'Seeming reasonable or probable.', example: 'Confounding variables offer a plausible explanation for the trend.' },
  { word: 'allocate', pos: 'v.', zh: '分配；撥出', fallbackDef: 'To distribute resources or time for a particular purpose.', example: 'Allocate fifteen minutes daily to timed listening and dictation.' },
  { word: 'derive', pos: 'v.', zh: '推導出；源自', fallbackDef: 'To obtain something from a specified source or deduce logically.', example: 'Many medical English terms derive from Latin and Greek roots.' },
];

export const MICRO_BITES: MicroBite[] = [
  {
    id: 'bite-on-surface',
    domain: 'english',
    topic: '介係詞直覺',
    question: '為什麼天花板與牆壁用 on，而且 depend 也配 on？',
    hook: 'on 的本質是「貼附接觸面」或「重量／責任靠在身上」。',
    detail: '不論水平、垂直或倒掛，貼著表面都用 on（on the wall / on the ceiling）；抽象延伸為依賴（depend on）與承擔買單（It\'s on me.）。',
    example: 'Higher DET scores rely heavily on consistent daily output.',
  },
  {
    id: 'bite-have-state',
    domain: 'english',
    topic: '完成式本質',
    question: '怎麼一眼分開過去簡單式（wrote）跟完成式（have written）？',
    hook: '不要背「已經」：have + V-pp 是「目前擁有這個已完成狀態」。',
    detail: '過去式只報告過去動作發生並結束（配 yesterday / in 2020）；have + p.p. 強調截至該時間點「擁有」某結果狀態。強動詞如 gone / written / broken 不可寫成 went / wrote / broke。',
    example: 'When I checked my desk, my notebook was gone.',
  },
  {
    id: 'bite-to-for',
    domain: 'english',
    topic: 'to vs for',
    question: '「用來做某事」什麼時候寫 to，什麼時候寫 for？',
    hook: 'to + 原形動詞表「動作目標」；for + 名詞／V-ing 表「物品用途或對象」。',
    detail: '人去做下一步動作接 to + V；說明某個工具或物體的用途屬性接 for + N / V-ing。',
    example: 'I opened the app to review cards designed for learning prepositions.',
  },
  {
    id: 'bite-which-comma',
    domain: 'english',
    topic: '非限定從句',
    question: '逗號後面要補充說明前面那份報告，能寫 ", that was..." 嗎？',
    hook: '不行！逗號隔開的非限定補充說明只能用 which（事物）或 who（人）。',
    detail: 'DET 寫作與 Read & Complete 常考逗號後的關係代名詞，看到逗號先排除 that。',
    example: 'The report, which was published last month, highlights three trends.',
  },
  {
    id: 'bite-by-with',
    domain: 'english',
    topic: 'by vs with',
    question: '「用相機在湖邊拍照」與「被動句執行者」怎麼配？',
    hook: 'by 帶出主導方法、交通主體或被動施事者；with 帶出手中工具或伴隨資源。',
    detail: '人搭公車、透過某手段（by reading）、被某人完成用 by；拿在手上的相機／筆／協助資源用 with。',
    example: 'The dataset was cleaned by the analyst with a Python script.',
  },
  {
    id: 'bite-pvalue-ci',
    domain: 'stats',
    topic: '推論統計核心',
    question: '為什麼生統論文越來越強調「95% 信賴區間（CI）」而不只看 p-value？',
    hook: 'p-value 只回答「假設無效下出現此差異有多罕見」，CI 才告訴你「效應大小與精確度」。',
    detail: '樣本數極大時，極微小毫無臨床意義的差異也可能拿到 p < 0.001；95% CI 若同時給出估計區間寬度，更能判斷臨床實質意義與統計不確定性。',
    example: 'HR = 0.78 (95% CI: 0.64–0.95, p = 0.014)',
  },
  {
    id: 'bite-censoring',
    domain: 'stats',
    topic: '存活分析',
    question: 'Kaplan-Meier 曲線裡的右設限（Right Censoring）代表什麼？',
    hook: '代表追蹤結束、失聯或研究截止前，事件「尚未發生」，並不是無效樣本。',
    detail: '在存活分析中，設限個案在退出風險集（at-risk set）之前都真實貢獻了「沒有發生事件的時間」，不能直接當成缺失值刪掉或算成未發病比例。',
    example: 'Non-informative censoring assumes drop-out risk is independent of event risk.',
  },
  {
    id: 'bite-type1-power',
    domain: 'stats',
    topic: '檢定力與誤差',
    question: '樣本數太小最直接會傷害哪一個指標：Alpha 還是 Power？',
    hook: '樣本太小會讓 Statistical Power（1 - β）下降，也就是「真有差異卻驗不出來（Type II Error）」。',
    detail: '增加樣本數 n 能縮小標準誤 SE = σ / √n，進而提升檢定力，避免偽陰性結論。',
    example: 'Power = 0.80 means an 80% chance of detecting a true target effect.',
  },
  {
    id: 'bite-bias-variance',
    domain: 'ml',
    topic: '模型泛化',
    question: '訓練集誤差極低、驗證集誤差很高，該往 Bias 還是 Variance 調？',
    hook: '這是 High Variance（過擬合 Overfitting），重點在降複雜度或加正則／更多資料。',
    detail: '可嘗試：增加訓練資料量、Weight Decay (L2)、Dropout、Early Stopping 或減少特徵維度；相反地兩者都高才是 High Bias（Underfitting）。',
    example: 'Regularization trades a slight increase in bias for a larger drop in variance.',
  },
  {
    id: 'bite-attention-scale',
    domain: 'ml',
    topic: 'Transformer 核心',
    question: 'Self-Attention 為什麼要除以 √d_k 再做 Softmax？',
    hook: '防止 Q·Kᵀ 內積隨維度 d_k 變大而暴衝，導致 Softmax 進入梯度趨近於零的飽和區。',
    detail: '若 Q 與 K 各分量為均值 0、變異數 1 的獨立變數，內積變異數會放大成 d_k；除以 √d_k 能把變異數拉回 1，維持穩定梯度流。',
    example: 'Attention(Q, K, V) = softmax(QK^T / sqrt(d_k)) V',
  },
  {
    id: 'bite-lora',
    domain: 'ml',
    topic: '高效微調',
    question: 'LoRA 為什麼能用極少參數微調大模型，且推論時零額外延遲？',
    hook: '凍結原權重 W，只學兩個低秩矩陣 ΔW = B·A；部署時可直接把 B·A 加回 W。',
    detail: '假設權重更新落在低內在維度（rank r ≪ d），顯著降低優化器狀態與梯度顯存需求；推論合併後架構與原模型完全一致。',
    example: 'W_merged = W_0 + (alpha / r) * B @ A',
  },
];

export const DAILY_QUOTES: { text: string; author: string }[] = [
  { text: 'Consistency beats intensity: twenty focused minutes every day compounds faster than weekend marathons.', author: 'Daily Study Principle' },
  { text: 'All models are wrong, but some are useful.', author: 'George E. P. Box' },
  { text: 'In language, understanding a pattern in context is worth ten memorized translation tables.', author: 'Comprehensible Input' },
  { text: 'What you do not recall actively, you only recognize passively.', author: 'Active Recall' },
  { text: 'If you cannot explain a statistical test simply, check the sampling distribution first.', author: 'Statistical Intuition' },
  { text: 'Good writing is clear thinking made visible through concrete detail.', author: 'Writing Craft' },
];
