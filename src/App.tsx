import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, Sun, Moon, Plus, Star, ExternalLink, Copy, Check, Pencil, Trash2,
  Volume2, RefreshCw, Flame, Play, Pause, RotateCcw, Download, Upload, Sparkles,
  BookOpen, Layers, Rss, Cpu, BarChart3, Languages, Terminal, X,
} from 'lucide-react';
import {
  DAILY_QUOTES, DEFAULT_SITES, DOMAINS, MICRO_BITES, WORD_OF_DAY_POOL,
  type DomainId, type StudySite,
} from './data/hubData';
import { fetchFeed, type FeedChannel, type FeedItem } from './services/feeds';

const STORAGE_KEY = 'qq.studyhub.v1';

interface HubState {
  theme: 'dark' | 'light';
  sites: StudySite[];
  checkins: Record<string, boolean[]>; // YYYY-MM-DD -> [task0, task1, task2]
  tasks: string[];
  focusCount: number;
}

const DEFAULT_TASKS = ['Quill & Quest 15 分鐘', '統計 / 生統 1 小節', 'PaperDesk / 論文 1 篇'];

function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayIndex(d = new Date()): number {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}

function loadState(): HubState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<HubState>;
      return {
        theme: parsed.theme === 'light' ? 'light' : 'dark',
        sites: Array.isArray(parsed.sites) && parsed.sites.length ? parsed.sites : DEFAULT_SITES,
        checkins: parsed.checkins && typeof parsed.checkins === 'object' ? parsed.checkins : {},
        tasks: Array.isArray(parsed.tasks) && parsed.tasks.length === 3 ? parsed.tasks : DEFAULT_TASKS,
        focusCount: typeof parsed.focusCount === 'number' ? parsed.focusCount : 0,
      };
    }
  } catch {
    // ignore corrupted local storage
  }
  return { theme: 'dark', sites: DEFAULT_SITES, checkins: {}, tasks: DEFAULT_TASKS, focusCount: 0 };
}

function domainIcon(d: DomainId) {
  if (d === 'english') return Languages;
  if (d === 'stats') return BarChart3;
  if (d === 'ml') return Cpu;
  return Terminal;
}

export function App() {
  const [hub, setHub] = useState<HubState>(loadState);
  const [domain, setDomain] = useState<DomainId | 'all'>('all');
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // Daily rotation states
  const dIdx = dayIndex();
  const [wordOffset, setWordOffset] = useState(0);
  const [biteOffset, setBiteOffset] = useState(0);
  const [biteDomain, setBiteDomain] = useState<DomainId | 'all'>('all');
  const [biteRevealed, setBiteRevealed] = useState(false);

  // Word audio & live definition
  const [wordExtra, setWordExtra] = useState<{ phonetic?: string; audio?: string; def?: string }>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Pomodoro timer (25 min)
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);

  // Inline note editing & modal add
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSite, setNewSite] = useState({ title: '', subtitle: '', url: '', domain: 'stats' as DomainId, note: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live feed aggregator
  const [feedChannel, setFeedChannel] = useState<FeedChannel>('hf_papers');
  const [biostatTopic, setBiostatTopic] = useState('biostatistics');
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);

  // Persist hub state & theme
  useEffect(() => {
    document.documentElement.dataset.theme = hub.theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', hub.theme === 'dark' ? '#0d1117' : '#f4f6f9');
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(hub));
    } catch {
      // ignore quota error
    }
  }, [hub]);

  // Keyboard shortcut '/' to search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return;
      if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Pomodoro tick
  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          setHub((h) => ({ ...h, focusCount: h.focusCount + 1 }));
          return 25 * 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerRunning]);

  const activeWord = WORD_OF_DAY_POOL[(dIdx + wordOffset) % WORD_OF_DAY_POOL.length];

  // Fetch phonetic audio from dictionaryapi.dev
  useEffect(() => {
    let cancelled = false;
    setWordExtra({});
    fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(activeWord.word)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !Array.isArray(data) || !data[0]) return;
        const entry = data[0];
        const phonetic = entry.phonetic || entry.phonetics?.find((p: { text?: string }) => p.text)?.text;
        const audio = entry.phonetics?.find((p: { audio?: string }) => p.audio)?.audio;
        const def = entry.meanings?.[0]?.definitions?.[0]?.definition;
        setWordExtra({ phonetic, audio, def });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeWord.word]);

  // Fetch live aggregator feed
  const loadFeed = async (ch: FeedChannel, topic: string) => {
    setFeedLoading(true);
    setFeedError(null);
    try {
      const items = await fetchFeed(ch, topic);
      setFeedItems(items);
    } catch (e) {
      setFeedError(e instanceof Error ? e.message : '無法連線取得即時動態');
    } finally {
      setFeedLoading(false);
    }
  };

  useEffect(() => {
    loadFeed(feedChannel, biostatTopic);
  }, [feedChannel, biostatTopic]);

  const bitePool = useMemo(
    () => (biteDomain === 'all' ? MICRO_BITES : MICRO_BITES.filter((b) => b.domain === biteDomain)),
    [biteDomain],
  );
  const activeBite = bitePool[(dIdx + biteOffset) % bitePool.length];
  const quote = DAILY_QUOTES[dIdx % DAILY_QUOTES.length];

  const today = todayKey();
  const todayChecks = hub.checkins[today] || [false, false, false];

  const streak = useMemo(() => {
    let count = 0;
    const cur = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(cur);
      d.setDate(cur.getDate() - i);
      const arr = hub.checkins[todayKey(d)];
      if (arr && arr.some(Boolean)) count++;
      else if (i > 0) break;
    }
    return count;
  }, [hub.checkins]);

  const heatmapDays = useMemo(() => {
    const arr: { key: string; level: number }[] = [];
    const cur = new Date();
    for (let i = 27; i >= 0; i--) {
      const d = new Date(cur);
      d.setDate(cur.getDate() - i);
      const k = todayKey(d);
      const checks = hub.checkins[k] || [];
      arr.push({ key: k, level: checks.filter(Boolean).length });
    }
    return arr;
  }, [hub.checkins]);

  const filteredSites = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...hub.sites]
      .filter((s) => {
        if (domain !== 'all' && s.domain !== domain) return false;
        if (!q) return true;
        return [s.title, s.subtitle, s.note, s.url, ...s.tags].join(' ').toLowerCase().includes(q);
      })
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
  }, [hub.sites, domain, query]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return '早安，QQ';
    if (h < 18) return '午安，QQ';
    return '晚安，QQ';
  }, []);

  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1600);
    } catch {
      // ignore clipboard restrictions
    }
  };

  const toggleCheck = (idx: number) => {
    setHub((h) => {
      const prev = h.checkins[today] || [false, false, false];
      const next = prev.map((v, i) => (i === idx ? !v : v));
      return { ...h, checkins: { ...h.checkins, [today]: next } };
    });
  };

  const togglePin = (id: string) => {
    setHub((h) => ({
      ...h,
      sites: h.sites.map((s) => (s.id === id ? { ...s, pinned: !s.pinned } : s)),
    }));
  };

  const saveNote = (id: string) => {
    setHub((h) => ({
      ...h,
      sites: h.sites.map((s) => (s.id === id ? { ...s, note: draftNote.trim() } : s)),
    }));
    setEditingNoteId(null);
  };

  const deleteSite = (id: string) => {
    setHub((h) => ({ ...h, sites: h.sites.filter((s) => s.id !== id) }));
  };

  const addCustomSite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSite.title.trim() || !newSite.url.trim()) return;
    const url = /^https?:\/\//i.test(newSite.url.trim()) ? newSite.url.trim() : `https://${newSite.url.trim()}`;
    const item: StudySite = {
      id: `custom-${Date.now()}`,
      title: newSite.title.trim(),
      subtitle: newSite.subtitle.trim() || url,
      url,
      domain: newSite.domain,
      env: url.includes('127.0.0.1') || url.includes('localhost') ? 'local' : 'online',
      tags: ['自訂'],
      note: newSite.note.trim(),
      pinned: true,
    };
    setHub((h) => ({ ...h, sites: [item, ...h.sites] }));
    setNewSite({ title: '', subtitle: '', url: '', domain: 'stats', note: '' });
    setShowAddModal(false);
  };

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(hub, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qq-study-hub-${today}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Partial<HubState>;
      if (Array.isArray(parsed.sites)) {
        setHub((h) => ({ ...h, ...parsed, sites: parsed.sites! }));
      }
    } catch {
      // ignore invalid json
    }
    e.target.value = '';
  };

  const playAudio = () => {
    if (!wordExtra.audio) return;
    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.src = wordExtra.audio;
    audioRef.current.play().catch(() => {});
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div className="hub-shell">
      <div className="ambient-glow" aria-hidden="true" />

      <header className="hub-topbar">
        <div className="brand-block">
          <div className="logo-mark" aria-hidden="true">QQ</div>
          <div>
            <h1>{greeting} · 學習中樞</h1>
            <p className="quote-line">“{quote.text}” — <span>{quote.author}</span></p>
          </div>
        </div>

        <div className="top-actions">
          <div className="search-box">
            <Search size={15} aria-hidden />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜尋網站、標籤或筆記（按 /）"
              aria-label="搜尋學習網站"
            />
          </div>

          <div className="pomo-pill" title="25 分鐘專注計時器">
            <span className="pomo-time">{mm}:{ss}</span>
            <button type="button" className="icon-chip" onClick={() => setTimerRunning((r) => !r)} aria-label={timerRunning ? '暫停計時' : '開始計時'}>
              {timerRunning ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button type="button" className="icon-chip" onClick={() => { setTimerRunning(false); setSecondsLeft(25 * 60); }} aria-label="重設計時">
              <RotateCcw size={14} />
            </button>
          </div>

          <button type="button" className="action-btn primary" onClick={() => setShowAddModal(true)}>
            <Plus size={15} /> 新增網站
          </button>

          <button type="button" className="icon-btn" onClick={exportBackup} title="匯出備份 JSON" aria-label="匯出備份">
            <Download size={16} />
          </button>
          <button type="button" className="icon-btn" onClick={() => fileInputRef.current?.click()} title="匯入備份 JSON" aria-label="匯入備份">
            <Upload size={16} />
          </button>
          <input ref={fileInputRef} type="file" accept=".json" hidden onChange={importBackup} />

          <button
            type="button"
            className="icon-btn"
            onClick={() => setHub((h) => ({ ...h, theme: h.theme === 'dark' ? 'light' : 'dark' }))}
            title="切換日/夜間主題"
            aria-label="切換主題"
          >
            {hub.theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      <main className="hub-main">
        {/* Daily Dynamic Bento Row */}
        <section className="bento-grid" aria-label="每日動態學習區">
          {/* 1. Word of the Day */}
          <article className="bento-card word-card">
            <div className="card-kicker">
              <span><Sparkles size={14} /> 今日 DET 核心單字</span>
              <button type="button" className="ghost-mini" onClick={() => setWordOffset((v) => v + 1)}>
                <RefreshCw size={13} /> 換一字
              </button>
            </div>
            <div className="word-head">
              <div>
                <h2 className="word-title">{activeWord.word}</h2>
                <p className="word-meta">
                  <span className="pos-pill">{activeWord.pos}</span>
                  {wordExtra.phonetic && <span className="phonetic">{wordExtra.phonetic}</span>}
                  <span>{activeWord.zh}</span>
                </p>
              </div>
              {wordExtra.audio && (
                <button type="button" className="audio-btn" onClick={playAudio} aria-label="播放發音">
                  <Volume2 size={18} />
                </button>
              )}
            </div>
            <p className="word-def">{wordExtra.def || activeWord.fallbackDef}</p>
            <p className="word-ex">“{activeWord.example}”</p>
          </article>

          {/* 2. Daily Micro-Bite Flashcard */}
          <article className="bento-card bite-card">
            <div className="card-kicker">
              <span><Layers size={14} /> 30 秒跨領域微複習 · {activeBite.topic}</span>
              <div className="mini-pills">
                {(['all', 'english', 'stats', 'ml'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`mini-pill ${biteDomain === d ? 'is-on' : ''}`}
                    onClick={() => { setBiteDomain(d); setBiteOffset(0); setBiteRevealed(false); }}
                  >
                    {d === 'all' ? '全' : d === 'english' ? '英' : d === 'stats' ? '統' : 'ML'}
                  </button>
                ))}
                <button type="button" className="ghost-mini" onClick={() => { setBiteOffset((v) => v + 1); setBiteRevealed(false); }}>
                  <RefreshCw size={13} />
                </button>
              </div>
            </div>
            <h3 className="bite-q">{activeBite.question}</h3>
            {!biteRevealed ? (
              <button type="button" className="reveal-btn" onClick={() => setBiteRevealed(true)}>
                點擊揭曉直覺解析
              </button>
            ) : (
              <div className="bite-ans">
                <p className="bite-hook">{activeBite.hook}</p>
                <p className="bite-detail">{activeBite.detail}</p>
                <code className="bite-ex">{activeBite.example}</code>
              </div>
            )}
          </article>

          {/* 3. Daily Check-in + 28-day Heatmap */}
          <article className="bento-card checkin-card">
            <div className="card-kicker">
              <span><Flame size={14} /> 今日微習慣打卡</span>
              <span className="streak-pill">{streak} 天連續 · 專注 {hub.focusCount} 次</span>
            </div>
            <ul className="task-list">
              {hub.tasks.map((label, idx) => (
                <li key={idx}>
                  <label className={`task-item ${todayChecks[idx] ? 'is-done' : ''}`}>
                    <input type="checkbox" checked={Boolean(todayChecks[idx])} onChange={() => toggleCheck(idx)} />
                    <span>{label}</span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="heatmap-wrap">
              <span className="heat-label">近 28 天節奏</span>
              <div className="heatmap" aria-label="28 天學習打卡圖">
                {heatmapDays.map((d) => (
                  <span key={d.key} className={`heat-cell lvl-${Math.min(3, d.level)}`} title={`${d.key}: 完成 ${d.level}/3`} />
                ))}
              </div>
            </div>
          </article>
        </section>

        {/* Sites Hub */}
        <section className="hub-section" aria-label="學習網站清單">
          <div className="section-head">
            <div className="domain-tabs" role="tablist">
              {DOMAINS.map((d) => {
                const cnt = d.id === 'all' ? hub.sites.length : hub.sites.filter((s) => s.domain === d.id).length;
                return (
                  <button
                    key={d.id}
                    type="button"
                    role="tab"
                    aria-selected={domain === d.id}
                    className={`domain-tab ${domain === d.id ? 'is-active' : ''}`}
                    style={{ '--tab-accent': d.accent } as React.CSSProperties}
                    onClick={() => setDomain(d.id)}
                  >
                    {d.label} <span className="tab-cnt">{cnt}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              className="ghost-mini"
              onClick={() => {
                if (window.confirm('將網站列表恢復為預設清單？（不影響打卡紀錄）')) {
                  setHub((h) => ({ ...h, sites: DEFAULT_SITES }));
                }
              }}
            >
              重設預設網站
            </button>
          </div>

          <div className="sites-grid">
            {filteredSites.map((site) => {
              const Icon = domainIcon(site.domain);
              const isEditing = editingNoteId === site.id;
              return (
                <article key={site.id} className={`site-card domain-${site.domain} ${site.pinned ? 'is-pinned' : ''}`}>
                  <div className="site-top">
                    <span className="site-badge">
                      <Icon size={14} /> {DOMAINS.find((d) => d.id === site.domain)?.label}
                    </span>
                    <div className="site-ctrls">
                      <span className={`env-pill env-${site.env}`}>
                        {site.env === 'local' ? '本機端' : site.env === 'github' ? 'GitHub' : '線上'}
                      </span>
                      <button
                        type="button"
                        className={`icon-chip ${site.pinned ? 'is-star' : ''}`}
                        onClick={() => togglePin(site.id)}
                        title="置頂卡片"
                        aria-label="置頂"
                      >
                        <Star size={14} fill={site.pinned ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        type="button"
                        className="icon-chip"
                        onClick={() => { setEditingNoteId(isEditing ? null : site.id); setDraftNote(site.note); }}
                        title="編輯進度備註"
                        aria-label="編輯備註"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        className="icon-chip danger"
                        onClick={() => deleteSite(site.id)}
                        title="移除網站"
                        aria-label="移除"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <a className="site-link" href={site.url} target="_blank" rel="noopener noreferrer">
                    <h3>{site.title} <ExternalLink size={14} className="ext-icon" /></h3>
                    <p className="site-sub">{site.subtitle}</p>
                  </a>

                  <div className="site-tags">
                    {site.tags.map((tg) => (
                      <span key={tg} className="tag-chip">{tg}</span>
                    ))}
                  </div>

                  {isEditing ? (
                    <div className="note-edit">
                      <input
                        className="note-input"
                        value={draftNote}
                        onChange={(e) => setDraftNote(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveNote(site.id)}
                        placeholder="輸入目前章節進度或提醒..."
                        autoFocus
                      />
                      <button type="button" className="mini-save" onClick={() => saveNote(site.id)}>儲存</button>
                    </div>
                  ) : (
                    site.note && <p className="site-note">{site.note}</p>
                  )}

                  {site.launchCmd && (
                    <button
                      type="button"
                      className="cmd-btn"
                      onClick={() => copyText(site.id, site.launchCmd!)}
                    >
                      {copiedKey === site.id ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copiedKey === site.id ? '已複製啟動檔名' : `複製啟動檔：${site.launchCmd}`}</span>
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        {/* Live Aggregator */}
        <section className="hub-section feed-section" aria-label="跨領域即時內容聚合">
          <div className="section-head">
            <div className="feed-title-wrap">
              <h2><Rss size={18} /> 即時論文與知識聚合流</h2>
              <span className="muted-sm">滑到感興趣的論文可直接複製連結給 PaperDesk 雙語閱讀</span>
            </div>
            <div className="feed-tabs">
              {([
                ['hf_papers', 'AI / ML 今日論文'],
                ['biostat_papers', '生統最新文獻'],
                ['hn_ml', 'ML 技術討論'],
                ['github_repos', 'MoreFoodQ 倉庫動態'],
              ] as [FeedChannel, string][]).map(([ch, label]) => (
                <button
                  key={ch}
                  type="button"
                  className={`feed-tab ${feedChannel === ch ? 'is-active' : ''}`}
                  onClick={() => setFeedChannel(ch)}
                >
                  {label}
                </button>
              ))}
              {feedChannel === 'biostat_papers' && (
                <select
                  className="topic-select"
                  value={biostatTopic}
                  onChange={(e) => setBiostatTopic(e.target.value)}
                  aria-label="生統主題"
                >
                  <option value="biostatistics">Biostatistics</option>
                  <option value="survival analysis">Survival Analysis</option>
                  <option value="causal inference">Causal Inference</option>
                  <option value="clinical trials">Clinical Trials</option>
                </select>
              )}
              <button
                type="button"
                className="icon-chip"
                onClick={() => loadFeed(feedChannel, biostatTopic)}
                title="重新整理"
                aria-label="重新整理"
              >
                <RefreshCw size={14} className={feedLoading ? 'spin' : ''} />
              </button>
            </div>
          </div>

          {feedError ? (
            <div className="feed-empty">暫時無法載入此頻道（{feedError}），請稍後重試。</div>
          ) : feedLoading && !feedItems.length ? (
            <div className="feed-empty">正在聚合最新內容...</div>
          ) : (
            <div className="feed-grid">
              {feedItems.map((item) => (
                <article key={item.id} className="feed-card">
                  <div className="feed-card-body">
                    <p className="feed-meta">{item.meta}</p>
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="feed-link">
                      <h3>{item.title}</h3>
                    </a>
                    {item.summary && <p className="feed-summary">{item.summary}...</p>}
                  </div>
                  <div className="feed-card-foot">
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-act">
                      <BookOpen size={13} /> 閱讀原文
                    </a>
                    {item.copyUrl && (
                      <button type="button" className="text-act" onClick={() => copyText(item.id, item.copyUrl!)}>
                        {copiedKey === item.id ? <Check size={13} /> : <Copy size={13} />}
                        {copiedKey === item.id ? '已複製給 PaperDesk' : '複製給 PaperDesk'}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      {showAddModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="add-site-title">
          <form className="modal-card" onSubmit={addCustomSite}>
            <div className="modal-head">
              <h2 id="add-site-title">新增學習網站</h2>
              <button type="button" className="icon-chip" onClick={() => setShowAddModal(false)} aria-label="關閉">
                <X size={16} />
              </button>
            </div>
            <label>
              網站名稱 *
              <input required value={newSite.title} onChange={(e) => setNewSite({ ...newSite, title: e.target.value })} placeholder="例如：Coursera Machine Learning" />
            </label>
            <label>
              網址 *
              <input required value={newSite.url} onChange={(e) => setNewSite({ ...newSite, url: e.target.value })} placeholder="https://..." />
            </label>
            <label>
              分類領域
              <select value={newSite.domain} onChange={(e) => setNewSite({ ...newSite, domain: e.target.value as DomainId })}>
                <option value="english">英文 DET</option>
                <option value="stats">統計與生統</option>
                <option value="ml">機器學習 & AI</option>
                <option value="tools">閱讀 & 工作台</option>
              </select>
            </label>
            <label>
              簡介
              <input value={newSite.subtitle} onChange={(e) => setNewSite({ ...newSite, subtitle: e.target.value })} placeholder="這個站主要用來練什麼" />
            </label>
            <label>
              個人進度備註（僅存本機瀏覽器）
              <input value={newSite.note} onChange={(e) => setNewSite({ ...newSite, note: e.target.value })} placeholder="例如：第 3 週進度 / 帳號提醒" />
            </label>
            <div className="modal-actions">
              <button type="button" className="action-btn" onClick={() => setShowAddModal(false)}>取消</button>
              <button type="submit" className="action-btn primary">加入首頁</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
