export type RankTier = 'S' | 'A' | 'B';

export interface FeedItem {
  id: string;
  channel: FeedChannel;
  title: string;
  url: string;
  copyUrl?: string;
  publishedDate: string; // YYYY-MM-DD 或空字串
  year: string; // YYYY 或 '—'
  venue: string;
  authors?: string;
  arxivId?: string;
  doi?: string;
  upvotes?: number;
  citations?: number;
  fwci?: number;
  rankTier: RankTier;
  rankLabel: string;
  rankReason: string;
  recommendScore: number; // 0-100
  scoreBreakdown: string;
  abstractEn?: string;
  meta: string;
}

export type FeedChannel = 'hf_papers' | 'biostat_papers' | 'ml_papers';

const ZH_CACHE_KEY = 'qq.studyhub.zhcache.v1';
const MAX_CACHE_ENTRIES = 120;

// 公認頂尖生統、統計與醫學期刊（僅供真實來源名稱比對，不偽造 IF 數值）
const TOP_TIER_VENUES = [
  'new england journal of medicine',
  'nejm',
  'the lancet',
  'lancet',
  'jama',
  'bmj',
  'nature',
  'nature medicine',
  'science',
  'biometrika',
  'biostatistics',
  'biometrics',
  'journal of the american statistical association',
  'annals of statistics',
  'journal of the royal statistical society',
  'statistics in medicine',
  'statistical science',
  'international journal of epidemiology',
  'american journal of epidemiology',
  'epidemiology',
  'clinical trials',
  'journal of clinical epidemiology',
  'statistica sinica',
  'annals of internal medicine',
  'neurips',
  'neural information processing systems',
  'icml',
  'iclr',
  'cvpr',
  'acl',
  'emnlp',
  'journal of machine learning research',
  'ieee transactions on pattern analysis and machine intelligence',
  'nature machine intelligence',
];

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function daysAgo(isoDate?: string): number {
  if (!isoDate) return 180;
  const ts = Date.parse(isoDate);
  if (Number.isNaN(ts)) return 180;
  return Math.max(0, Math.floor((Date.now() - ts) / 86400000));
}

function recencyPoints(isoDate?: string): number {
  const d = daysAgo(isoDate);
  if (d <= 3) return 22;
  if (d <= 14) return 18;
  if (d <= 45) return 14;
  if (d <= 180) return 9;
  if (d <= 365) return 5;
  return 2;
}

/** 將 OpenAlex 的 abstract_inverted_index 還原為正常英文段落 */
export function reconstructOpenAlexAbstract(inverted?: Record<string, number[]> | null): string | undefined {
  if (!inverted || typeof inverted !== 'object') return undefined;
  const pairs: Array<[number, string]> = [];
  for (const [word, positions] of Object.entries(inverted)) {
    if (!Array.isArray(positions)) continue;
    for (const pos of positions) {
      pairs.push([pos, word]);
    }
  }
  if (!pairs.length) return undefined;
  pairs.sort((a, b) => a[0] - b[0]);
  const text = pairs.map(([, w]) => w).join(' ').replace(/\s+/g, ' ').trim();
  return text || undefined;
}

/** 清理過長摘要並保留完整句子 */
function trimAbstract(text?: string, maxLen = 780): string | undefined {
  if (!text) return undefined;
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return undefined;
  if (cleaned.length <= maxLen) return cleaned;
  const cut = cleaned.slice(0, maxLen);
  const lastPeriod = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
  return lastPeriod > maxLen * 0.55 ? cut.slice(0, lastPeriod + 1) : `${cut.trim()}…`;
}

/** 僅從明確的 arXiv ID、arXiv URL 或 arXiv DOI 提取編號，避免誤判期刊 DOI（如 ss.202023.0099） */
function extractArxivId(raw?: string): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  const bareMatch = trimmed.match(/^(\d{4}\.\d{4,5})(?:v\d+)?$/);
  if (bareMatch) return bareMatch[1];
  const explicitMatch = trimmed.match(/(?:arxiv\.org\/(?:abs|pdf|html)\/|arxiv[:./])(\d{4}\.\d{4,5})(?:v\d+)?/i);
  return explicitMatch ? explicitMatch[1] : undefined;
}

export async function fetchFeed(channel: FeedChannel, topic = 'biostatistics'): Promise<FeedItem[]> {
  if (channel === 'hf_papers') {
    const res = await fetch('https://huggingface.co/api/daily_papers?limit=12');
    if (!res.ok) throw new Error(`HF API ${res.status}`);
    const data = (await res.json()) as Array<{
      title?: string;
      summary?: string;
      publishedAt?: string;
      numComments?: number;
      paper?: {
        id?: string;
        title?: string;
        summary?: string;
        upvotes?: number;
        publishedAt?: string;
        authors?: Array<{ name?: string }>;
        githubRepo?: string;
        githubStars?: number;
      };
    }>;

    return data.slice(0, 10).map((item, idx) => {
      const pid = item.paper?.id || '';
      const arxivId = extractArxivId(pid);
      const arxivUrl = pid ? `https://arxiv.org/abs/${pid}` : 'https://huggingface.co/papers';
      const hfUrl = pid ? `https://huggingface.co/papers/${pid}` : 'https://huggingface.co/papers';
      const votes = item.paper?.upvotes ?? 0;
      const stars = item.paper?.githubStars ?? 0;
      const date = (item.paper?.publishedAt || item.publishedAt || '').slice(0, 10);
      const year = date ? date.slice(0, 4) : '—';
      const authorNames = (item.paper?.authors || [])
        .map((a) => a.name)
        .filter(Boolean)
        .slice(0, 3)
        .join(', ');

      // 依據 HF 社群票數、名次、是否開源 GitHub 誠實分級
      let rankTier: RankTier = 'B';
      let rankLabel = 'B · 新釋出預印本';
      let rankReason = '依 Hugging Face Daily Papers 即時票數與開源訊號分級';
      if (votes >= 45 || idx < 2 || stars >= 300) {
        rankTier = 'S';
        rankLabel = 'S · HF 當日精選';
        rankReason = `HF 熱榜前段（▲${votes} 票${stars ? ` / ★${stars} GitHub` : ''}）`;
      } else if (votes >= 18 || Boolean(item.paper?.githubRepo)) {
        rankTier = 'A';
        rankLabel = 'A · 社群高訊號';
        rankReason = `HF 票數 ▲${votes}${item.paper?.githubRepo ? ' 且附帶開源程式碼' : ''}`;
      }

      const votePts = Math.min(48, Math.round(Math.log2(votes + 1) * 7.8));
      const repoPts = item.paper?.githubRepo ? 12 : 0;
      const tierPts = rankTier === 'S' ? 18 : rankTier === 'A' ? 12 : 6;
      const recPts = recencyPoints(date);
      const recommendScore = clamp(votePts + repoPts + tierPts + recPts, 42, 99);

      return {
        id: pid || `hf-${idx}`,
        channel,
        title: item.paper?.title || item.title || 'Untitled paper',
        url: hfUrl,
        copyUrl: arxivUrl,
        publishedDate: date,
        year,
        venue: item.paper?.githubRepo ? 'arXiv · HF Daily + Code' : 'arXiv · HF Daily Papers',
        authors: authorNames || undefined,
        arxivId,
        upvotes: votes,
        rankTier,
        rankLabel,
        rankReason,
        recommendScore,
        scoreBreakdown: `社群熱度 ${votePts} + 時效 ${recPts} + 層級 ${tierPts}${repoPts ? ` + 開源碼 ${repoPts}` : ''}`,
        abstractEn: trimAbstract(item.paper?.summary || item.summary),
        meta: `▲ ${votes} 票${stars ? ` · ★ ${stars}` : ''}${date ? ` · ${date}` : ''}`,
      };
    });
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const queryTopic =
    channel === 'ml_papers' ? 'large language models OR machine learning inference' : topic;
  const q = encodeURIComponent(queryTopic);
  const res = await fetch(
    `https://api.openalex.org/works?search=${q}&filter=has_abstract:true,to_publication_date:${todayIso}&sort=publication_date:desc&per-page=10`,
  );
  if (!res.ok) throw new Error(`OpenAlex ${res.status}`);
  const data = (await res.json()) as {
    results?: Array<{
      id?: string;
      doi?: string;
      title?: string;
      publication_date?: string;
      publication_year?: number;
      cited_by_count?: number;
      fwci?: number | null;
      abstract_inverted_index?: Record<string, number[]> | null;
      authorships?: Array<{ author?: { display_name?: string } }>;
      primary_location?: {
        landing_page_url?: string;
        source?: { display_name?: string; type?: string };
      };
    }>;
  };

  return (data.results || []).map((w, idx) => {
    const link = w.doi || w.primary_location?.landing_page_url || w.id || 'https://openalex.org/';
    const venue = w.primary_location?.source?.display_name || 'Journal / Preprint';
    const sourceType = (w.primary_location?.source?.type || '').toLowerCase();
    const venueLower = venue.toLowerCase();
    const date = (w.publication_date || '').slice(0, 10);
    const year = w.publication_year ? String(w.publication_year) : date ? date.slice(0, 4) : '—';
    const cites = w.cited_by_count ?? 0;
    const fwci = typeof w.fwci === 'number' ? Number(w.fwci.toFixed(2)) : undefined;
    const authors = (w.authorships || [])
      .map((a) => a.author?.display_name)
      .filter(Boolean)
      .slice(0, 3)
      .join(', ');

    const isTopVenue = TOP_TIER_VENUES.some((tv) => venueLower.includes(tv));
    const isJournal = sourceType === 'journal';
    const isPreprint = venueLower.includes('arxiv') || venueLower.includes('medrxiv') || venueLower.includes('biorxiv') || sourceType === 'repository';

    // 嚴格依據 OpenAlex 真實欄位（期刊來源 / FWCI / 引用數）給出誠實 RANK
    let rankTier: RankTier = 'B';
    let rankLabel = isPreprint ? 'B · 預印本 / 新文獻' : 'B · 新發表研究';
    let rankReason = '依 OpenAlex 來源類型、FWCI 與引用數分級（無偽造 IF）';

    if (isTopVenue || (fwci !== undefined && fwci >= 2.8) || cites >= 40) {
      rankTier = 'S';
      rankLabel = isTopVenue ? 'S · 領域頂刊 / 頂會' : 'S · 高影響力訊號';
      rankReason = isTopVenue
        ? `收錄於核心頂尖期刊／頂會《${venue}》`
        : `OpenAlex FWCI ${fwci ?? '—'} · 引用 ${cites} 次`;
    } else if (isJournal || (fwci !== undefined && fwci >= 1.1) || cites >= 8) {
      rankTier = 'A';
      rankLabel = 'A · 同儕審查期刊';
      rankReason = `期刊來源《${venue}》${cites ? ` · 引用 ${cites}` : ''}`;
    }

    const venuePts = isTopVenue ? 34 : isJournal ? 24 : 14;
    const impactPts = Math.min(34, Math.round(Math.log2(cites + 1) * 6 + (fwci ? Math.min(18, fwci * 6) : 6)));
    const recPts = recencyPoints(date);
    const abstractEn = trimAbstract(reconstructOpenAlexAbstract(w.abstract_inverted_index));
    const absPts = abstractEn ? 6 : 0;
    const recommendScore = clamp(venuePts + impactPts + recPts + absPts, 38, 98);
    const arxivId = extractArxivId(link) || extractArxivId(w.doi);

    return {
      id: w.id || `oa-${idx}`,
      channel,
      title: w.title || 'Untitled study',
      url: link,
      copyUrl: link,
      publishedDate: date,
      year,
      venue,
      authors: authors || undefined,
      arxivId,
      doi: w.doi,
      citations: cites,
      fwci,
      rankTier,
      rankLabel,
      rankReason,
      recommendScore,
      scoreBreakdown: `來源 ${venuePts} + 學術訊號 ${impactPts} + 時效 ${recPts}${absPts ? ' + 完整摘要 6' : ''}`,
      abstractEn,
      meta: `${venue}${cites ? ` · 引用 ${cites}` : ''}${fwci !== undefined ? ` · FWCI ${fwci}` : ''}`,
    };
  });
}

// ── 繁體中文摘要翻譯服務（含 localStorage 快取與錯誤降級） ──

interface ZhCacheMap {
  [key: string]: { zh: string; ts: number };
}

function readZhCache(): ZhCacheMap {
  try {
    const raw = localStorage.getItem(ZH_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ZhCacheMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeZhCache(cache: ZhCacheMap): void {
  try {
    const entries = Object.entries(cache);
    if (entries.length > MAX_CACHE_ENTRIES) {
      entries.sort((a, b) => b[1].ts - a[1].ts);
      const trimmed = Object.fromEntries(entries.slice(0, MAX_CACHE_ENTRIES));
      localStorage.setItem(ZH_CACHE_KEY, JSON.stringify(trimmed));
      return;
    }
    localStorage.setItem(ZH_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // 忽略瀏覽器儲存空間上限錯誤
  }
}

function hashTextKey(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `zh_${(h >>> 0).toString(36)}_${text.length}`;
}

export function getCachedZhSummary(text?: string): string | null {
  if (!text) return null;
  const cache = readZhCache();
  const hit = cache[hashTextKey(text)];
  return hit ? hit.zh : null;
}

/** 透過免金鑰 Google Translate gtx 端點將英文摘要翻為繁體中文，失敗時回傳 null 讓 UI 優雅降級 */
export async function translateToZhTW(text: string, signal?: AbortSignal): Promise<string | null> {
  const clean = text.trim();
  if (!clean) return null;
  // 若本身已含大量中文字元則直接回傳
  if (/[\u4e00-\u9fff]{8,}/.test(clean)) return clean;

  const key = hashTextKey(clean);
  const cache = readZhCache();
  if (cache[key]?.zh) return cache[key].zh;

  const snippet = clean.slice(0, 900);
  const endpoint = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-TW&dt=t&q=${encodeURIComponent(snippet)}`;

  try {
    const res = await fetch(endpoint, { signal });
    if (!res.ok) return null;
    const json = (await res.json()) as unknown;
    if (!Array.isArray(json) || !Array.isArray(json[0])) return null;
    const translated = (json[0] as unknown[])
      .map((seg) => (Array.isArray(seg) && typeof seg[0] === 'string' ? seg[0] : ''))
      .join('')
      .trim();
    if (!translated) return null;
    cache[key] = { zh: translated, ts: Date.now() };
    writeZhCache(cache);
    return translated;
  } catch {
    return null;
  }
}

/** 組合送給 PaperDesk 的結構化資料 */
export function buildPaperDeskPayload(item: FeedItem, zhSummary?: string): string {
  const lines = [
    `# ${item.title}`,
    `URL: ${item.copyUrl || item.url}`,
    `來源 / 期刊: ${item.venue}`,
    `發表日期: ${item.publishedDate || item.year}  |  等級: ${item.rankLabel}  |  推薦指數: ${item.recommendScore}/100`,
  ];
  if (item.authors) lines.push(`作者: ${item.authors}`);
  if (item.arxivId) lines.push(`arXiv PDF: https://arxiv.org/pdf/${item.arxivId}.pdf`);
  if (zhSummary) {
    lines.push('', '【中文摘要】', zhSummary);
  } else if (item.abstractEn) {
    lines.push('', '【Abstract】', item.abstractEn);
  }
  return lines.join('\n');
}

/** 組合 Google NotebookLM 6 步驟繁體中文帶讀包 */
export function buildNotebookLMPrompt(item: FeedItem): string {
  const sourceUrl = item.copyUrl || item.url;
  return [
    `請使用【繁體中文（台灣用語）】擔任我的資深生統／AI 研究導讀教練，帶讀以下論文：`,
    `標題：${item.title}`,
    `連結：${sourceUrl}`,
    `來源與日期：${item.venue}（${item.publishedDate || item.year}）`,
    '',
    '請嚴格依照以下 6 步驟結構拆解：',
    '1. 【核心問題與研究動機】用白話說明這篇研究想解決什麼痛點？先前方法卡在哪裡？',
    '2. 【方法論與模型／統計設計】拆解資料來源、樣本或基準設定、核心演算法／統計檢定與關鍵公式直覺。',
    '3. 【主要發現與量化證據】整理最關鍵的數據結果（效應值、信賴區間、消融實驗或對照表現）。',
    '4. 【研究限制與潛在偏誤】指出方法假設、資料偏差、樣本外推性或實務落地風險。',
    '5. 【實作與延伸靈感】如果我要在個人專案或研究筆記中重現／借鏡，最值得帶走的 2 個設計是什麼？',
    '6. 【3 題快測＋關鍵術語表】出 3 題檢驗我是否真的讀懂的概念題（附簡答），並列出 5 個必記中英專有名詞。',
  ].join('\n');
}
