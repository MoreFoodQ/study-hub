import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  KeyRound,
  Moon,
  Plus,
  Search,
  Sparkles,
  Sun,
  Timer,
  Upload,
} from 'lucide-react';
import { ArtCanvas, type ArtMode } from './components/ArtCanvas';
import { DailyStudio } from './components/DailyStudio';
import { PapersStudio } from './components/PapersStudio';
import { SitesStudio } from './components/SitesStudio';
import { VaultDrawer } from './components/VaultDrawer';
import {
  DAILY_QUOTES,
  DEFAULT_SITES,
  DEPRECATED_DEFAULT_SITE_IDS,
  MY_DEFAULT_SITE_IDS,
  type SiteOwnership,
  type StudySite,
} from './data/hubData';

const STORAGE_KEY = 'qq.studyhub.v1';
const CLEANUP_VERSION = 2;

type StudioView = 'sites' | 'papers' | 'daily';

interface HubState {
  cleanupVersion?: number;
  theme: 'dark' | 'light';
  artMode: ArtMode;
  sites: StudySite[];
  checkins: Record<string, boolean[]>; // YYYY-MM-DD -> [task0, task1, task2]
  tasks: string[];
  focusCount: number;
}

const DEFAULT_TASKS = ['Quill & Quest 15 分鐘', '統計 / 生統 1 小節', 'PaperDesk / 論文 1 篇'];

const EXTERNAL_DEFAULT_IDS = new Set(['seeing-theory', 'statquest', 'hf-papers', 'det-official']);

function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayIndex(d = new Date()): number {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}

/** 向下相容舊版 localStorage，自動補上欄位並清除已下線／失聯預設項目 */
function normalizeSites(rawSites: unknown, runDeadCleanup: boolean): StudySite[] {
  if (!Array.isArray(rawSites) || !rawSites.length) return DEFAULT_SITES;
  const defaultById = new Map(DEFAULT_SITES.map((s) => [s.id, s]));

  return rawSites
    .filter((s): s is Partial<StudySite> => Boolean(s && typeof s === 'object'))
    .filter((s) => {
      if (!runDeadCleanup) return true;
      const id = typeof s.id === 'string' ? s.id : '';
      const url = typeof s.url === 'string' ? s.url : '';
      if (DEPRECATED_DEFAULT_SITE_IDS.has(id)) return false;
      if (url.includes('lobe-chat-rho-seven-22.vercel.app') || url.includes('127.0.0.1:5180')) return false;
      return true;
    })
    .map((s, idx) => {
      const id = typeof s.id === 'string' && s.id ? s.id : `site-${idx}`;
      const matchedDefault = defaultById.get(id);
      const inferredOwnership: SiteOwnership =
        s.ownership === 'mine' || s.ownership === 'external'
          ? s.ownership
          : EXTERNAL_DEFAULT_IDS.has(id)
            ? 'external'
            : MY_DEFAULT_SITE_IDS.has(id)
              ? 'mine'
              : 'mine';
      const quickLinks = Array.isArray(s.quickLinks)
        ? s.quickLinks.filter((q): q is { label: string; url: string } => Boolean(q && q.label && q.url))
        : matchedDefault?.quickLinks;
      return {
        id,
        title: s.title || '未命名網站',
        subtitle: s.subtitle || s.url || '',
        url: s.url || 'https://github.com/MoreFoodQ',
        domain: s.domain === 'english' || s.domain === 'stats' || s.domain === 'ml' || s.domain === 'tools' ? s.domain : 'tools',
        ownership: inferredOwnership,
        env: s.env === 'local' || s.env === 'github' ? s.env : 'online',
        tags: Array.isArray(s.tags) ? s.tags.filter((t): t is string => typeof t === 'string') : [],
        note: typeof s.note === 'string' ? s.note : '',
        pinned: Boolean(s.pinned),
        launchCmd: typeof s.launchCmd === 'string' && s.launchCmd ? s.launchCmd : undefined,
        quickLinks,
      };
    });
}

function loadState(): HubState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<HubState>;
      const artMode: ArtMode =
        parsed.artMode === 'flow' || parsed.artMode === 'still' || parsed.artMode === 'constellation'
          ? parsed.artMode
          : 'constellation';
      const needsCleanup = (parsed.cleanupVersion ?? 1) < CLEANUP_VERSION;
      const normalizedSites = normalizeSites(parsed.sites, needsCleanup);
      return {
        cleanupVersion: CLEANUP_VERSION,
        theme: parsed.theme === 'light' ? 'light' : 'dark',
        artMode,
        sites: normalizedSites.length ? normalizedSites : DEFAULT_SITES,
        checkins: parsed.checkins && typeof parsed.checkins === 'object' ? parsed.checkins : {},
        tasks: Array.isArray(parsed.tasks) && parsed.tasks.length === 3 ? parsed.tasks : DEFAULT_TASKS,
        focusCount: typeof parsed.focusCount === 'number' ? parsed.focusCount : 0,
      };
    }
  } catch {
    // 忽略損毀的 localStorage 資料
  }
  return {
    cleanupVersion: CLEANUP_VERSION,
    theme: 'dark',
    artMode: 'constellation',
    sites: DEFAULT_SITES,
    checkins: {},
    tasks: DEFAULT_TASKS,
    focusCount: 0,
  };
}

const ART_MODE_LABELS: Record<ArtMode, string> = {
  constellation: '星軌',
  flow: '流場',
  still: '靜止',
};

export function App() {
  const [hub, setHub] = useState<HubState>(loadState);
  const [view, setView] = useState<StudioView>('sites');
  const [query, setQuery] = useState('');
  const [addSiteTrigger, setAddSiteTrigger] = useState(0);

  // 帳密金庫抽屜狀態
  const [vaultOpen, setVaultOpen] = useState(false);
  const [vaultSiteId, setVaultSiteId] = useState<string | null>(null);
  const [vaultStatus, setVaultStatus] = useState<{
    initialized: boolean;
    unlocked: boolean;
    linkedSiteIds: string[];
  }>({ initialized: false, unlocked: false, linkedSiteIds: [] });

  // 番茄鐘全域狀態（跨分頁持續計時）
  const [pomoMinutes, setPomoMinutes] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);

  // 提示氣泡 Toast
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  // 持久化設定與主題
  useEffect(() => {
    document.documentElement.dataset.theme = hub.theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', hub.theme === 'dark' ? '#0a0a0b' : '#f5f2eb');
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(hub));
    } catch {
      // 忽略瀏覽器儲存空間錯誤
    }
  }, [hub]);

  // 快捷鍵 '/' 聚焦搜尋框
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return;
      if (e.key === '/') {
        e.preventDefault();
        setView('sites');
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 番茄鐘倒數計時器
  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          setHub((h) => ({ ...h, focusCount: h.focusCount + 1 }));
          notify('完成一個專注回合！休息一下再出發');
          return pomoMinutes * 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerRunning, pomoMinutes, notify]);

  const dIdx = dayIndex();
  const today = todayKey();
  const quote = DAILY_QUOTES[dIdx % DAILY_QUOTES.length];

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return '早安，QQ';
    if (h < 18) return '午安，QQ';
    return '晚安，QQ';
  }, []);

  const dateLabel = useMemo(() => {
    const now = new Date();
    const weekdays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} · ${weekdays[now.getDay()]}`;
  }, []);

  const mySiteCount = useMemo(() => hub.sites.filter((s) => s.ownership === 'mine').length, [hub.sites]);
  const todayDoneCount = (hub.checkins[today] || []).filter(Boolean).length;

  // 網站 CRUD 與排序
  const handleAddSite = (site: StudySite) => {
    setHub((h) => ({ ...h, sites: [site, ...h.sites] }));
  };

  const handleUpdateSite = (updated: StudySite) => {
    setHub((h) => ({ ...h, sites: h.sites.map((s) => (s.id === updated.id ? updated : s)) }));
  };

  const handleDeleteSite = (id: string) => {
    setHub((h) => ({ ...h, sites: h.sites.filter((s) => s.id !== id) }));
    notify('已移除網站');
  };

  const handleTogglePin = (id: string) => {
    setHub((h) => ({
      ...h,
      sites: h.sites.map((s) => (s.id === id ? { ...s, pinned: !s.pinned } : s)),
    }));
  };

  const handleMoveSite = (id: string, direction: 'up' | 'down') => {
    setHub((h) => {
      const idx = h.sites.findIndex((s) => s.id === id);
      if (idx === -1) return h;
      const target = h.sites[idx];
      // 在同一個 ownership 群組中尋找相鄰項目交換，確保視覺順序直覺
      const step = direction === 'up' ? -1 : 1;
      let swapIdx = idx + step;
      while (swapIdx >= 0 && swapIdx < h.sites.length) {
        if (h.sites[swapIdx].ownership === target.ownership) break;
        swapIdx += step;
      }
      if (swapIdx < 0 || swapIdx >= h.sites.length) return h;
      const next = [...h.sites];
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return { ...h, sites: next };
    });
  };

  const handleResetDefaults = () => {
    if (window.confirm('將網站列表恢復為預設清單？（不影響打卡紀錄與帳密金庫）')) {
      setHub((h) => ({ ...h, sites: DEFAULT_SITES }));
      notify('已恢復預設網站清單');
    }
  };

  const handleToggleCheck = (idx: number) => {
    setHub((h) => {
      const prev = h.checkins[today] || [false, false, false];
      const next = prev.map((v, i) => (i === idx ? !v : v));
      return { ...h, checkins: { ...h.checkins, [today]: next } };
    });
  };

  const handleUpdateTasks = (nextTasks: string[]) => {
    setHub((h) => ({ ...h, tasks: nextTasks }));
    notify('已更新每日微習慣項目');
  };

  const handleResetTimer = (minutes?: number) => {
    const nextMins = minutes ?? pomoMinutes;
    setPomoMinutes(nextMins);
    setTimerRunning(false);
    setSecondsLeft(nextMins * 60);
  };

  const cycleArtMode = () => {
    const order: ArtMode[] = ['constellation', 'flow', 'still'];
    const next = order[(order.indexOf(hub.artMode) + 1) % order.length];
    setHub((h) => ({ ...h, artMode: next }));
    notify(`背景畫布切換為：${ART_MODE_LABELS[next]}模式`);
  };

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(hub, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qq-study-hub-${today}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify('已匯出網站與學習紀錄備份 JSON（不含帳密明文）');
  };

  const importBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Partial<HubState>;
      if (Array.isArray(parsed.sites)) {
        setHub((h) => ({
          ...h,
          cleanupVersion: CLEANUP_VERSION,
          theme: parsed.theme === 'light' || parsed.theme === 'dark' ? parsed.theme : h.theme,
          sites: normalizeSites(parsed.sites, (parsed.cleanupVersion ?? 1) < CLEANUP_VERSION),
          checkins: parsed.checkins && typeof parsed.checkins === 'object' ? parsed.checkins : h.checkins,
          tasks: Array.isArray(parsed.tasks) && parsed.tasks.length === 3 ? parsed.tasks : h.tasks,
          focusCount: typeof parsed.focusCount === 'number' ? parsed.focusCount : h.focusCount,
        }));
        notify('已匯入學習中樞備份檔');
      }
    } catch {
      notify('備份檔格式不正確');
    }
    e.target.value = '';
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div className="studio-shell">
      {/* 互動式 60fps 數位藝術畫布與細緻紙感顆粒層 */}
      <ArtCanvas theme={hub.theme} mode={hub.artMode} />
      <div className="grain-overlay" aria-hidden="true" />

      {/* 頂部編輯部導覽列 */}
      <header className="studio-topbar">
        <div className="topbar-inner">
          <div className="brand-cluster">
            <button
              type="button"
              className="brand-monogram"
              onClick={() => setView('sites')}
              title="回到我的網站首頁"
            >
              <span className="mono-qq">QQ</span>
              <span className="mono-dot" aria-hidden="true" />
            </button>
            <div className="brand-copy">
              <div className="brand-eyebrow">
                <span>{dateLabel}</span>
                <span className="sep">/</span>
                <span>{greeting}</span>
              </div>
              <h1 className="brand-title">
                STUDY <em>Atelier</em>
              </h1>
            </div>
          </div>

          {/* 核心工作室分頁切換（保持單頁俐落、絕不雜亂） */}
          <nav className="studio-nav" aria-label="主要工作區切換">
            <button
              type="button"
              className={`nav-tab ${view === 'sites' ? 'is-active' : ''}`}
              onClick={() => setView('sites')}
            >
              <span className="nav-idx">01</span>
              <span>我的網站</span>
              <span className="nav-badge">{mySiteCount}</span>
            </button>
            <button
              type="button"
              className={`nav-tab ${view === 'papers' ? 'is-active' : ''}`}
              onClick={() => setView('papers')}
            >
              <span className="nav-idx">02</span>
              <span>今日論文</span>
            </button>
            <button
              type="button"
              className={`nav-tab ${view === 'daily' ? 'is-active' : ''}`}
              onClick={() => setView('daily')}
            >
              <span className="nav-idx">03</span>
              <span>每日儀式</span>
              <span className="nav-badge">{todayDoneCount}/3</span>
            </button>
          </nav>

          {/* 右側快速工具列 */}
          <div className="topbar-tools">
            <div className="search-field">
              <Search size={14} aria-hidden="true" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (view !== 'sites') setView('sites');
                }}
                placeholder="搜尋網站、標籤…"
                aria-label="搜尋網站"
              />
              <kbd className="kbd-hint">/</kbd>
            </div>

            {timerRunning && (
              <button
                type="button"
                className="live-pomo-chip"
                onClick={() => setView('daily')}
                title="前往番茄鐘控制"
              >
                <Timer size={13} /> {mm}:{ss}
              </button>
            )}

            <button
              type="button"
              className="studio-btn primary sm"
              onClick={() => {
                setView('sites');
                setAddSiteTrigger((n) => n + 1);
              }}
            >
              <Plus size={14} /> 新增網站
            </button>

            <button
              type="button"
              className={`studio-btn sm vault-trigger ${vaultStatus.unlocked ? 'is-unlocked' : ''}`}
              onClick={() => {
                setVaultSiteId(null);
                setVaultOpen(true);
              }}
              title="本機加密帳密金庫（PBKDF2 + AES-256-GCM）"
            >
              <KeyRound size={14} />
              <span>金庫</span>
              <i className={`vault-dot ${vaultStatus.unlocked ? 'on' : vaultStatus.initialized ? 'locked' : ''}`} />
            </button>

            <button
              type="button"
              className="studio-btn sm art-cycle-btn"
              onClick={cycleArtMode}
              title="切換互動背景畫布模式（星軌 / 流場 / 靜止）"
            >
              <Sparkles size={13} />
              <span>{ART_MODE_LABELS[hub.artMode]}</span>
            </button>

            <button type="button" className="icon-square" onClick={exportBackup} title="匯出網站備份 JSON" aria-label="匯出備份">
              <Download size={15} />
            </button>
            <button
              type="button"
              className="icon-square"
              onClick={() => fileInputRef.current?.click()}
              title="匯入網站備份 JSON"
              aria-label="匯入備份"
            >
              <Upload size={15} />
            </button>
            <input ref={fileInputRef} type="file" accept=".json" hidden onChange={importBackup} />

            <button
              type="button"
              className="icon-square"
              onClick={() => setHub((h) => ({ ...h, theme: h.theme === 'dark' ? 'light' : 'dark' }))}
              title={hub.theme === 'dark' ? '切換至宣紙晨光主題' : '切換至墨韻暗室主題'}
              aria-label="切換深淺主題"
            >
              {hub.theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </div>
      </header>

      {/* 極簡每日格言細帶 */}
      <div className="maxim-strip">
        <div className="maxim-inner">
          <span className="mono-kicker">DAILY NOTE</span>
          <p>
            “{quote.text}” <span className="maxim-author">— {quote.author}</span>
          </p>
        </div>
      </div>

      {/* 主舞台：依所選工作區渲染，保有充裕留白與高聚焦度 */}
      <main className="studio-main">
        {view === 'sites' && (
          <SitesStudio
            sites={hub.sites}
            query={query}
            onAddSite={handleAddSite}
            onUpdateSite={handleUpdateSite}
            onDeleteSite={handleDeleteSite}
            onTogglePin={handleTogglePin}
            onMoveSite={handleMoveSite}
            onResetDefaults={handleResetDefaults}
            onOpenVaultForSite={(siteId) => {
              setVaultSiteId(siteId);
              setVaultOpen(true);
            }}
            linkedVaultSiteIds={vaultStatus.linkedSiteIds}
            onNotify={notify}
            showAddExternalTrigger={addSiteTrigger}
          />
        )}

        {view === 'papers' && <PapersStudio onNotify={notify} />}

        {view === 'daily' && (
          <DailyStudio
            todayKeyStr={today}
            dayIndexNum={dIdx}
            tasks={hub.tasks}
            checkins={hub.checkins}
            focusCount={hub.focusCount}
            secondsLeft={secondsLeft}
            timerRunning={timerRunning}
            pomoMinutes={pomoMinutes}
            onToggleCheck={handleToggleCheck}
            onUpdateTasks={handleUpdateTasks}
            onToggleTimer={() => setTimerRunning((r) => !r)}
            onResetTimer={handleResetTimer}
          />
        )}
      </main>

      <footer className="studio-footer">
        <div className="footer-inner">
          <span>QQ STUDY ATELIER · 個人學習、論文雷達與加密金庫</span>
          <span>按 / 快速搜尋 · 點擊畫布觸發波紋 · 帳密與備註均僅存於本機瀏覽器</span>
        </div>
      </footer>

      {/* 側滑式本機加密帳密金庫 */}
      <VaultDrawer
        open={vaultOpen}
        onClose={() => setVaultOpen(false)}
        sites={hub.sites}
        initialSiteId={vaultSiteId}
        onVaultStatusChange={setVaultStatus}
        onNotify={notify}
      />

      {/* 輕量操作回饋氣泡 */}
      {toast && (
        <div className="studio-toast" role="status" aria-live="polite">
          <span className="toast-dot" aria-hidden="true" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
