import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Compass,
  Copy,
  FileText,
  Languages,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { OPEN_SOURCE_PAPER_STACK } from '../data/hubData';
import {
  buildNotebookLMPrompt,
  buildPaperDeskPayload,
  fetchFeed,
  getCachedZhSummary,
  translateToZhTW,
  type FeedChannel,
  type FeedItem,
} from '../services/feeds';

interface PapersStudioProps {
  onNotify: (msg: string) => void;
}

const CHANNEL_TABS: Array<[FeedChannel, string, string]> = [
  ['hf_papers', 'AI / ML 今日論文', 'Hugging Face Daily'],
  ['biostat_papers', '生統最新文獻', 'OpenAlex Live'],
  ['ml_papers', 'ML / LLM 實證期刊', 'OpenAlex Live'],
];

export function PapersStudio({ onNotify }: PapersStudioProps) {
  const [channel, setChannel] = useState<FeedChannel>('hf_papers');
  const [biostatTopic, setBiostatTopic] = useState('biostatistics');
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 中文摘要快取狀態與中/英顯示切換
  const [zhMap, setZhMap] = useState<Record<string, string>>({});
  const [translatingIds, setTranslatingIds] = useState<Record<string, boolean>>({});
  const [showEnIds, setShowEnIds] = useState<Record<string, boolean>>({});
  const [translateFailedIds, setTranslateFailedIds] = useState<Record<string, boolean>>({});

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  const loadFeed = async (ch: FeedChannel, topic: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchFeed(ch, topic);
      setItems(data);
      // 先從 localStorage 立即填入已有中文翻譯快取
      const cached: Record<string, string> = {};
      for (const it of data) {
        const hit = getCachedZhSummary(it.abstractEn);
        if (hit) cached[it.id] = hit;
      }
      setZhMap((prev) => ({ ...prev, ...cached }));
      setTranslateFailedIds({});
    } catch (err) {
      setError(err instanceof Error ? err.message : '暫時無法連線取得即時論文資料');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeed(channel, biostatTopic);
  }, [channel, biostatTopic]);

  // 溫和依序自動翻譯前 6 篇英文摘要為繁體中文（有快取則直接跳過，失敗立即降級原文）
  useEffect(() => {
    if (!items.length) return;
    const controller = new AbortController();
    let active = true;

    const runQueue = async () => {
      const targets = items.filter((it) => it.abstractEn && !getCachedZhSummary(it.abstractEn)).slice(0, 6);
      for (const it of targets) {
        if (!active || controller.signal.aborted || !it.abstractEn) break;
        setTranslatingIds((prev) => ({ ...prev, [it.id]: true }));
        const zh = await translateToZhTW(it.abstractEn, controller.signal);
        if (!active) break;
        setTranslatingIds((prev) => ({ ...prev, [it.id]: false }));
        if (zh) {
          setZhMap((prev) => ({ ...prev, [it.id]: zh }));
        } else {
          setTranslateFailedIds((prev) => ({ ...prev, [it.id]: true }));
          // 若遇到連線失敗或限流，停止後續自動排隊以免重複請求，改由使用者手動點擊重試
          break;
        }
      }
    };

    runQueue();
    return () => {
      active = false;
      controller.abort();
    };
  }, [items]);

  const handleManualTranslate = async (item: FeedItem) => {
    if (!item.abstractEn) return;
    setTranslatingIds((prev) => ({ ...prev, [item.id]: true }));
    setTranslateFailedIds((prev) => ({ ...prev, [item.id]: false }));
    const zh = await translateToZhTW(item.abstractEn);
    setTranslatingIds((prev) => ({ ...prev, [item.id]: false }));
    if (zh) {
      setZhMap((prev) => ({ ...prev, [item.id]: zh }));
      setShowEnIds((prev) => ({ ...prev, [item.id]: false }));
    } else {
      setTranslateFailedIds((prev) => ({ ...prev, [item.id]: true }));
      onNotify('翻譯服務暫時無法連線，已為你保留英文原摘要');
    }
  };

  const handleSendPaperDesk = async (item: FeedItem) => {
    const payload = buildPaperDeskPayload(item, zhMap[item.id]);
    try {
      await navigator.clipboard.writeText(payload);
      setCopiedKey(`pd-${item.id}`);
      onNotify('已複製結構化論文資訊，可直接貼入 PaperDesk 開始雙語精讀');
      window.setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      onNotify('無法存取剪貼簿');
    }
  };

  const handleNotebookLM = async (item: FeedItem) => {
    const prompt = buildNotebookLMPrompt(item);
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedKey(`nlm-${item.id}`);
      onNotify('已複製論文連結＋6 步驟繁中帶讀指令，並為你開啟 NotebookLM');
      window.setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      onNotify('已開啟 NotebookLM（請確認剪貼簿權限）');
    }
    window.open('https://notebooklm.google.com/', '_blank', 'noopener,noreferrer');
  };

  return (
    <section className="studio-section" aria-label="今日論文與開源導讀工作室">
      <div className="editorial-section-head">
        <div className="section-title-col">
          <span className="mono-kicker">RESEARCH RADAR · HONEST SIGNALS &amp; ZH-TW BRIEFINGS</span>
          <h2 className="editorial-heading">
            今日論文工作室 <em>Papers Studio</em>
          </h2>
        </div>

        <div className="papers-head-right">
          <button
            type="button"
            className={`studio-btn sm ${guideOpen ? 'primary' : ''}`}
            onClick={() => setGuideOpen((v) => !v)}
          >
            <Compass size={14} /> 開源文獻導讀框架
            {guideOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            type="button"
            className="icon-square"
            onClick={() => loadFeed(channel, biostatTopic)}
            title="重新整理即時論文"
            aria-label="重新整理"
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* 可收合的開源文獻導讀框架指南 */}
      {guideOpen && (
        <div className="framework-panel">
          <div className="framework-head">
            <div>
              <span className="mono-kicker">OPEN-SOURCE LITERATURE WORKFLOW</span>
              <h3>推薦的 6 套開源／高效論文導讀工具鏈</h3>
            </div>
            <p className="muted-copy">
              快速篩選（alphaXiv）→ 結構解析（MinerU）→ 多篇語音全景（NotebookLM）→ 地端雙語精讀（PaperDesk）→ 文獻庫與引用問答（Zotero / PaperQA2）。
            </p>
          </div>
          <div className="framework-grid">
            {OPEN_SOURCE_PAPER_STACK.map((tool, i) => (
              <a
                key={tool.id}
                href={tool.url}
                target="_blank"
                rel="noopener noreferrer"
                className="framework-card"
              >
                <div className="fw-top">
                  <span className="mono-kicker">{String(i + 1).padStart(2, '0')} · {tool.role}</span>
                  <ArrowUpRight size={14} />
                </div>
                <h4>{tool.name}</h4>
                <p>{tool.summary}</p>
                <span className="fw-best">適用場景：{tool.bestFor}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* 頻道與生統主題切換列 */}
      <div className="filter-bar">
        <div className="domain-strip" role="tablist" aria-label="論文來源頻道">
          {CHANNEL_TABS.map(([id, label, sub]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={channel === id}
              className={`channel-tab ${channel === id ? 'is-active' : ''}`}
              onClick={() => setChannel(id)}
            >
              <span>{label}</span>
              <span className="channel-sub">{sub}</span>
            </button>
          ))}
        </div>

        <div className="view-controls">
          {channel === 'biostat_papers' && (
            <select
              className="studio-select"
              value={biostatTopic}
              onChange={(e) => setBiostatTopic(e.target.value)}
              aria-label="生統文獻主題"
            >
              <option value="biostatistics">Biostatistics（生物統計）</option>
              <option value="survival analysis">Survival Analysis（存活分析）</option>
              <option value="causal inference">Causal Inference（因果推論）</option>
              <option value="clinical trials">Clinical Trials（臨床試驗）</option>
              <option value="epidemiology">Epidemiology（流行病學）</option>
            </select>
          )}
          <span className="rank-legend" title="S/A/B 依據真實來源訊號（HF 票數、OpenAlex 期刊/FWCI/引用、時效）分級，不偽造影響因子">
            RANK 與推薦指數皆依真實 API 訊號計算
          </span>
        </div>
      </div>

      {/* 論文清單 */}
      {error ? (
        <div className="empty-frame">
          <p>暫時無法載入此頻道（{error}），請稍後點擊右上角重試。</p>
        </div>
      ) : loading && items.length === 0 ? (
        <div className="empty-frame">
          <p>正在聚合最新論文與計算推薦訊號...</p>
        </div>
      ) : (
        <div className="papers-grid">
          {items.map((item, idx) => {
            const zhSummary = zhMap[item.id];
            const isTranslating = Boolean(translatingIds[item.id]);
            const showingEn = Boolean(showEnIds[item.id]) || !zhSummary;
            const translateFailed = Boolean(translateFailedIds[item.id]);
            const connectedQuery = encodeURIComponent(item.doi || item.arxivId || item.title);

            return (
              <article key={item.id} className="paper-card">
                {/* 上緣指標列：編號、RANK、日期與年份、推薦指數 */}
                <div className="paper-top">
                  <div className="paper-badges">
                    <span className="ecard-num">{String(idx + 1).padStart(2, '0')}</span>
                    <span className={`rank-badge tier-${item.rankTier}`} title={item.rankReason}>
                      {item.rankLabel}
                    </span>
                    <span className="date-pill" title="發表日期與年份">
                      {item.publishedDate ? `${item.publishedDate}` : item.year}
                      {item.publishedDate && <em className="year-chip">{item.year}</em>}
                    </span>
                  </div>

                  <div className="score-meter" title={`推薦指數計算：${item.scoreBreakdown}`}>
                    <span className="score-label">推薦指數</span>
                    <strong className="score-val">{item.recommendScore}</strong>
                    <span className="score-bar-track" aria-hidden="true">
                      <span className="score-bar-fill" style={{ width: `${item.recommendScore}%` }} />
                    </span>
                  </div>
                </div>

                {/* 標題與來源資訊 */}
                <div className="paper-body">
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="paper-title-link">
                    <h3>{item.title}</h3>
                    <ArrowUpRight size={16} className="paper-ext" />
                  </a>

                  <div className="paper-meta-line">
                    <span>{item.venue}</span>
                    {item.authors && <span>· {item.authors}</span>}
                    <span>· {item.meta}</span>
                  </div>

                  {/* 摘要區塊（預設繁中，可一鍵切回原文） */}
                  {item.abstractEn && (
                    <div className="abstract-box">
                      <div className="abstract-head">
                        <span className="mono-kicker">
                          {showingEn ? 'ORIGINAL ABSTRACT (EN)' : '繁體中文摘要 (AUTO ZH-TW)'}
                        </span>
                        <div className="abstract-ctrls">
                          {isTranslating ? (
                            <span className="trans-status">翻譯繁中摘要中...</span>
                          ) : zhSummary ? (
                            <button
                              type="button"
                              className="lang-toggle-btn"
                              onClick={() => setShowEnIds((p) => ({ ...p, [item.id]: !p[item.id] }))}
                            >
                              <Languages size={12} /> {showingEn ? '顯示中文摘要' : '切換 English 原文'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="lang-toggle-btn"
                              onClick={() => handleManualTranslate(item)}
                            >
                              <Languages size={12} /> {translateFailed ? '重試繁中翻譯' : '翻譯為繁體中文'}
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="abstract-text">{showingEn ? item.abstractEn : zhSummary}</p>
                    </div>
                  )}
                </div>

                {/* 三大行動操作列 */}
                <div className="paper-actions">
                  <div className="paper-primary-acts">
                    <button
                      type="button"
                      className="paper-act-btn primary"
                      onClick={() => handleSendPaperDesk(item)}
                      title="複製論文網址與結構化摘要，直接貼入 PaperDesk"
                    >
                      {copiedKey === `pd-${item.id}` ? <Check size={13} /> : <Copy size={13} />}
                      {copiedKey === `pd-${item.id}` ? '已複製給 PaperDesk' : '送給 PaperDesk'}
                    </button>

                    <button
                      type="button"
                      className="paper-act-btn accent"
                      onClick={() => handleNotebookLM(item)}
                      title="複製連結＋6 步驟繁體中文帶讀指令並開啟 NotebookLM"
                    >
                      {copiedKey === `nlm-${item.id}` ? <Check size={13} /> : <Sparkles size={13} />}
                      {copiedKey === `nlm-${item.id}` ? '已複製帶讀包' : 'NotebookLM 帶讀包'}
                    </button>
                  </div>

                  <div className="paper-helper-links">
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="helper-link">
                      <BookOpen size={12} /> 原文
                    </a>
                    {item.arxivId && (
                      <>
                        <a
                          href={`https://www.alphaxiv.org/abs/${item.arxivId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="helper-link"
                        >
                          alphaXiv
                        </a>
                        <a
                          href={`https://ar5iv.labs.arxiv.org/html/${item.arxivId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="helper-link"
                        >
                          <FileText size={12} /> ar5iv HTML
                        </a>
                      </>
                    )}
                    <a
                      href={`https://www.connectedpapers.com/search?q=${connectedQuery}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="helper-link"
                    >
                      Connected Papers
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
