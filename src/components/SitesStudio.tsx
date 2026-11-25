import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Check,
  Copy,
  KeyRound,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  RotateCcw,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import {
  DOMAINS,
  type DomainId,
  type SiteOwnership,
  type StudySite,
} from '../data/hubData';

interface SitesStudioProps {
  sites: StudySite[];
  query: string;
  onAddSite: (site: StudySite) => void;
  onUpdateSite: (site: StudySite) => void;
  onDeleteSite: (id: string) => void;
  onTogglePin: (id: string) => void;
  onMoveSite: (id: string, direction: 'up' | 'down') => void;
  onResetDefaults: () => void;
  onOpenVaultForSite: (siteId: string) => void;
  linkedVaultSiteIds: string[];
  onNotify: (msg: string) => void;
  showAddExternalTrigger: number;
}

interface SiteFormState {
  title: string;
  subtitle: string;
  url: string;
  domain: DomainId;
  ownership: SiteOwnership;
  env: 'online' | 'local' | 'github';
  tagsText: string;
  note: string;
  launchCmd: string;
}

const EMPTY_SITE_FORM: SiteFormState = {
  title: '',
  subtitle: '',
  url: '',
  domain: 'stats',
  ownership: 'mine',
  env: 'online',
  tagsText: '',
  note: '',
  launchCmd: '',
};

export function SitesStudio({
  sites,
  query,
  onAddSite,
  onUpdateSite,
  onDeleteSite,
  onTogglePin,
  onMoveSite,
  onResetDefaults,
  onOpenVaultForSite,
  linkedVaultSiteIds,
  onNotify,
  showAddExternalTrigger,
}: SitesStudioProps) {
  const [ownershipTab, setOwnershipTab] = useState<SiteOwnership | 'all'>('mine');
  const [domain, setDomain] = useState<DomainId | 'all'>('all');
  const [viewMode, setViewMode] = useState<'gallery' | 'index'>('gallery');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 新增／編輯視窗狀態
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [form, setForm] = useState<SiteFormState>(EMPTY_SITE_FORM);
  const [lastTrigger, setLastTrigger] = useState(showAddExternalTrigger);

  if (showAddExternalTrigger !== lastTrigger) {
    setLastTrigger(showAddExternalTrigger);
    setEditingSiteId(null);
    setForm({
      ...EMPTY_SITE_FORM,
      ownership: ownershipTab === 'external' ? 'external' : 'mine',
    });
    setModalOpen(true);
  }

  const counts = useMemo(() => {
    const mine = sites.filter((s) => s.ownership === 'mine').length;
    const external = sites.filter((s) => s.ownership === 'external').length;
    return { mine, external, all: sites.length };
  }, [sites]);

  const scopedSites = useMemo(() => {
    if (ownershipTab === 'all') return sites;
    return sites.filter((s) => s.ownership === ownershipTab);
  }, [sites, ownershipTab]);

  const filteredSites = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...scopedSites]
      .filter((s) => {
        if (domain !== 'all' && s.domain !== domain) return false;
        if (!q) return true;
        return [s.title, s.subtitle, s.note, s.url, ...s.tags].join(' ').toLowerCase().includes(q);
      })
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
  }, [scopedSites, domain, query]);

  const openAddModal = (defaultOwnership: SiteOwnership = 'mine') => {
    setEditingSiteId(null);
    setForm({ ...EMPTY_SITE_FORM, ownership: defaultOwnership });
    setModalOpen(true);
  };

  const openEditModal = (site: StudySite) => {
    setEditingSiteId(site.id);
    setForm({
      title: site.title,
      subtitle: site.subtitle,
      url: site.url,
      domain: site.domain,
      ownership: site.ownership,
      env: site.env,
      tagsText: site.tags.join(', '),
      note: site.note,
      launchCmd: site.launchCmd || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.url.trim()) return;
    const rawUrl = form.url.trim();
    const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    const tags = form.tagsText
      .split(/[,，\s]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    const inferredEnv: 'online' | 'local' | 'github' =
      form.env ||
      (url.includes('127.0.0.1') || url.includes('localhost')
        ? 'local'
        : url.includes('github.com')
          ? 'github'
          : 'online');

    if (editingSiteId) {
      const existing = sites.find((s) => s.id === editingSiteId);
      if (existing) {
        onUpdateSite({
          ...existing,
          title: form.title.trim(),
          subtitle: form.subtitle.trim() || url,
          url,
          domain: form.domain,
          ownership: form.ownership,
          env: inferredEnv,
          tags: tags.length ? tags : existing.tags,
          note: form.note.trim(),
          launchCmd: form.launchCmd.trim() || undefined,
        });
        onNotify(`已更新「${form.title.trim()}」`);
      }
    } else {
      const created: StudySite = {
        id: `site-${Date.now()}`,
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || url,
        url,
        domain: form.domain,
        ownership: form.ownership,
        env: inferredEnv,
        tags: tags.length ? tags : [form.ownership === 'mine' ? '自建' : '外部精選'],
        note: form.note.trim(),
        pinned: form.ownership === 'mine',
        launchCmd: form.launchCmd.trim() || undefined,
      };
      onAddSite(created);
      setOwnershipTab(form.ownership);
      onNotify(`已收錄「${created.title}」`);
    }
    setModalOpen(false);
  };

  const copyCmd = async (site: StudySite) => {
    if (!site.launchCmd) return;
    try {
      await navigator.clipboard.writeText(site.launchCmd);
      setCopiedId(site.id);
      onNotify(`已複製啟動檔名：${site.launchCmd}`);
      window.setTimeout(() => setCopiedId(null), 1600);
    } catch {
      onNotify('無法存取剪貼簿');
    }
  };

  const handleCardPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    e.currentTarget.style.setProperty('--mx', `${x}px`);
    e.currentTarget.style.setProperty('--my', `${y}px`);
  };

  return (
    <section className="studio-section" aria-label="網站索引工作台">
      {/* 標題與擁有權分層切換 */}
      <div className="editorial-section-head">
        <div className="section-title-col">
          <span className="mono-kicker">
            {ownershipTab === 'mine'
              ? 'CURATED PORTFOLIO · MY DIGITAL WORKSPACE'
              : ownershipTab === 'external'
                ? 'EXTERNAL REFERENCES · SELECTED RESOURCES'
                : 'COMPLETE ARCHIVE · ALL BOOKMARKS'}
          </span>
          <h2 className="editorial-heading">
            {ownershipTab === 'mine' ? (
              <>
                我的核心網站 <em>&amp; 自建實驗室</em>
              </>
            ) : ownershipTab === 'external' ? (
              <>
                外部精選資源 <em>&amp; 參考站</em>
              </>
            ) : (
              <>
                全部收錄索引 <em>Index</em>
              </>
            )}
          </h2>
        </div>

        <div className="ownership-switcher" role="tablist" aria-label="站點歸屬分類">
          <button
            type="button"
            role="tab"
            aria-selected={ownershipTab === 'mine'}
            className={`owner-pill ${ownershipTab === 'mine' ? 'is-active' : ''}`}
            onClick={() => setOwnershipTab('mine')}
          >
            我的網站 <span className="mono-count">{String(counts.mine).padStart(2, '0')}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={ownershipTab === 'external'}
            className={`owner-pill ${ownershipTab === 'external' ? 'is-active' : ''}`}
            onClick={() => setOwnershipTab('external')}
          >
            外部精選資源 <span className="mono-count">{String(counts.external).padStart(2, '0')}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={ownershipTab === 'all'}
            className={`owner-pill ${ownershipTab === 'all' ? 'is-active' : ''}`}
            onClick={() => setOwnershipTab('all')}
          >
            全部 <span className="mono-count">{String(counts.all).padStart(2, '0')}</span>
          </button>
        </div>
      </div>

      {/* 領域篩選列＋檢視模式切換 */}
      <div className="filter-bar">
        <div className="domain-strip" role="tablist" aria-label="領域篩選">
          {DOMAINS.map((d) => {
            const cnt = d.id === 'all' ? scopedSites.length : scopedSites.filter((s) => s.domain === d.id).length;
            return (
              <button
                key={d.id}
                type="button"
                role="tab"
                aria-selected={domain === d.id}
                className={`domain-chip ${domain === d.id ? 'is-active' : ''}`}
                style={{ '--chip-accent': d.accent } as React.CSSProperties}
                onClick={() => setDomain(d.id)}
              >
                <span className="domain-dot" aria-hidden="true" />
                <span>{d.label}</span>
                <span className="mono-count">{cnt}</span>
              </button>
            );
          })}
        </div>

        <div className="view-controls">
          <div className="segmented-toggle" role="group" aria-label="排列模式">
            <button
              type="button"
              className={viewMode === 'gallery' ? 'is-active' : ''}
              onClick={() => setViewMode('gallery')}
              title="畫廊卡片檢視"
            >
              <LayoutGrid size={14} /> 畫廊
            </button>
            <button
              type="button"
              className={viewMode === 'index' ? 'is-active' : ''}
              onClick={() => setViewMode('index')}
              title="精簡目錄索引（適合 20–50+ 站點）"
            >
              <List size={14} /> 目錄
            </button>
          </div>

          <button
            type="button"
            className="ghost-action"
            onClick={onResetDefaults}
            title="重設為預設網站清單"
          >
            <RotateCcw size={13} /> 重設預設
          </button>
        </div>
      </div>

      {/* 空狀態 */}
      {filteredSites.length === 0 ? (
        <div className="empty-frame">
          <p>目前篩選條件下沒有網站。</p>
          <button type="button" className="studio-btn primary sm" onClick={() => openAddModal(ownershipTab === 'external' ? 'external' : 'mine')}>
            <Plus size={14} /> 新增第一個網站
          </button>
        </div>
      ) : viewMode === 'gallery' ? (
        /* 畫廊卡片檢視（編輯部畫廊風格，無 AI Bento 堆疊感） */
        <div className="gallery-grid">
          {filteredSites.map((site, index) => {
            const domainMeta = DOMAINS.find((d) => d.id === site.domain);
            const hasVault = linkedVaultSiteIds.includes(site.id);
            const idxStr = String(index + 1).padStart(2, '0');
            return (
              <article
                key={site.id}
                className={`editorial-card domain-${site.domain} ${site.pinned ? 'is-pinned' : ''}`}
                onPointerMove={handleCardPointerMove}
              >
                <div className="card-spotlight" aria-hidden="true" />

                <div className="ecard-top">
                  <div className="ecard-index-group">
                    <span className="ecard-num">{idxStr}</span>
                    <span className="ecard-domain">
                      <i className="domain-dot" aria-hidden="true" />
                      {domainMeta?.short || 'LAB'}
                    </span>
                    <span className={`env-tag env-${site.env}`}>
                      {site.env === 'local' ? 'LOCAL' : site.env === 'github' ? 'REPO' : 'LIVE'}
                    </span>
                    {ownershipTab === 'all' && site.ownership === 'external' && (
                      <span className="ext-origin-tag">外部精選</span>
                    )}
                  </div>

                  <div className="ecard-actions">
                    <button
                      type="button"
                      className={`micro-btn ${site.pinned ? 'is-pinned' : ''}`}
                      onClick={() => onTogglePin(site.id)}
                      title={site.pinned ? '取消置頂' : '置頂卡片'}
                      aria-label="置頂"
                    >
                      <Star size={13} fill={site.pinned ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      type="button"
                      className="micro-btn"
                      onClick={() => onMoveSite(site.id, 'up')}
                      title="往前移"
                      aria-label="往前移"
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      type="button"
                      className="micro-btn"
                      onClick={() => onMoveSite(site.id, 'down')}
                      title="往後移"
                      aria-label="往後移"
                    >
                      <ArrowDown size={13} />
                    </button>
                    <button
                      type="button"
                      className={`micro-btn ${hasVault ? 'is-vault' : ''}`}
                      onClick={() => onOpenVaultForSite(site.id)}
                      title={hasVault ? '開啟已關聯帳密' : '於帳密金庫建立此站憑證'}
                      aria-label="開啟帳密金庫"
                    >
                      <KeyRound size={13} />
                    </button>
                    <button
                      type="button"
                      className="micro-btn"
                      onClick={() => openEditModal(site)}
                      title="編輯網站資訊與備註"
                      aria-label="編輯"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      className="micro-btn danger"
                      onClick={() => {
                        if (window.confirm(`確定要移除「${site.title}」？`)) onDeleteSite(site.id);
                      }}
                      title="移除網站"
                      aria-label="移除"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <a className="ecard-main-link" href={site.url} target="_blank" rel="noopener noreferrer">
                  <div className="ecard-title-row">
                    <h3>{site.title}</h3>
                    <span className="arrow-circle" aria-hidden="true">
                      <ArrowUpRight size={15} />
                    </span>
                  </div>
                  <p className="ecard-subtitle">{site.subtitle}</p>
                </a>

                {site.note && <p className="ecard-note">{site.note}</p>}

                <div className="ecard-foot">
                  <div className="ecard-tags">
                    {site.tags.slice(0, 4).map((t) => (
                      <span key={t} className="hairline-tag">
                        #{t}
                      </span>
                    ))}
                  </div>
                  {site.launchCmd && (
                    <button type="button" className="cmd-pill" onClick={() => copyCmd(site)}>
                      {copiedId === site.id ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedId === site.id ? '已複製' : site.launchCmd}</span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        /* 精簡目錄索引檢視（專為累積 20–50+ 網站打造，極致俐落） */
        <div className="index-table">
          {filteredSites.map((site, index) => {
            const domainMeta = DOMAINS.find((d) => d.id === site.domain);
            const hasVault = linkedVaultSiteIds.includes(site.id);
            return (
              <div key={site.id} className={`index-row domain-${site.domain}`}>
                <span className="index-num">{String(index + 1).padStart(2, '0')}</span>
                <span className="index-domain">
                  <i className="domain-dot" aria-hidden="true" /> {domainMeta?.short}
                </span>
                <a className="index-link" href={site.url} target="_blank" rel="noopener noreferrer">
                  <strong>{site.title}</strong>
                  <span>{site.subtitle}</span>
                </a>
                <span className="index-note" title={site.note}>
                  {site.note || '—'}
                </span>
                <div className="index-ctrls">
                  {site.launchCmd && (
                    <button type="button" className="micro-btn" onClick={() => copyCmd(site)} title={`複製 ${site.launchCmd}`}>
                      {copiedId === site.id ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                  )}
                  <button
                    type="button"
                    className={`micro-btn ${site.pinned ? 'is-pinned' : ''}`}
                    onClick={() => onTogglePin(site.id)}
                    title="置頂"
                  >
                    <Star size={13} fill={site.pinned ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    type="button"
                    className={`micro-btn ${hasVault ? 'is-vault' : ''}`}
                    onClick={() => onOpenVaultForSite(site.id)}
                    title="帳密金庫"
                  >
                    <KeyRound size={13} />
                  </button>
                  <button type="button" className="micro-btn" onClick={() => openEditModal(site)} title="編輯">
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    className="micro-btn danger"
                    onClick={() => {
                      if (window.confirm(`確定移除「${site.title}」？`)) onDeleteSite(site.id);
                    }}
                    title="移除"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 當位於「我的網站」時，於底部優雅導引外部精選資源，絕不喧賓奪主 */}
      {ownershipTab === 'mine' && counts.external > 0 && (
        <div className="external-bridge">
          <div>
            <span className="mono-kicker">CURATED EXTERNAL REFERENCES</span>
            <p>
              另有 <strong>{counts.external}</strong> 個外部精選學習網站（Seeing Theory、StatQuest、HF Daily Papers、DET 官方站）已獨立收納。
            </p>
          </div>
          <button type="button" className="studio-btn sm" onClick={() => setOwnershipTab('external')}>
            切換至外部精選資源 <ArrowUpRight size={14} />
          </button>
        </div>
      )}

      {/* 新增 / 編輯網站 Modal */}
      {modalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="site-modal-title" onClick={() => setModalOpen(false)}>
          <form className="studio-modal" onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <span className="mono-kicker">{editingSiteId ? 'EDIT ENTRY' : 'NEW ENTRY'}</span>
                <h3 id="site-modal-title">{editingSiteId ? '編輯網站項目' : '新增學習網站'}</h3>
              </div>
              <button type="button" className="icon-square" onClick={() => setModalOpen(false)} aria-label="關閉">
                <X size={16} />
              </button>
            </div>

            <div className="form-grid-2">
              <label className="field-label">
                歸屬分類
                <select
                  value={form.ownership}
                  onChange={(e) => setForm({ ...form, ownership: e.target.value as SiteOwnership })}
                >
                  <option value="mine">我的網站（自建／主戰場）</option>
                  <option value="external">外部精選資源</option>
                </select>
              </label>
              <label className="field-label">
                領域標籤
                <select value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value as DomainId })}>
                  <option value="english">英文 DET</option>
                  <option value="stats">統計與生統</option>
                  <option value="ml">機器學習 &amp; AI</option>
                  <option value="tools">閱讀 &amp; 工作台</option>
                </select>
              </label>
            </div>

            <label className="field-label">
              網站名稱 *
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="例如：My Biostatistics Visualizer"
              />
            </label>

            <label className="field-label">
              網址 *
              <input
                required
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://..."
              />
            </label>

            <label className="field-label">
              一句話簡介
              <input
                value={form.subtitle}
                onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                placeholder="這個網站主要用來解決什麼學習需求"
              />
            </label>

            <div className="form-grid-2">
              <label className="field-label">
                部署環境
                <select
                  value={form.env}
                  onChange={(e) => setForm({ ...form, env: e.target.value as 'online' | 'local' | 'github' })}
                >
                  <option value="online">線上站點 (LIVE)</option>
                  <option value="github">GitHub 倉庫 (REPO)</option>
                  <option value="local">本機服務 (LOCAL)</option>
                </select>
              </label>
              <label className="field-label">
                標籤（以逗號分隔）
                <input
                  value={form.tagsText}
                  onChange={(e) => setForm({ ...form, tagsText: e.target.value })}
                  placeholder="Vercel, 生統, 視覺化"
                />
              </label>
            </div>

            <label className="field-label">
              個人進度備註（僅存本機）
              <input
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="例如：目前看到第 4 章存活分析"
              />
            </label>

            <label className="field-label">
              本機啟動檔名（選填，例如 Open-PaperDesk.cmd）
              <input
                value={form.launchCmd}
                onChange={(e) => setForm({ ...form, launchCmd: e.target.value })}
                placeholder="留空則不顯示複製指令鈕"
              />
            </label>

            <div className="modal-actions">
              <button type="button" className="studio-btn sm" onClick={() => setModalOpen(false)}>
                取消
              </button>
              <button type="submit" className="studio-btn primary sm">
                {editingSiteId ? '儲存修改' : '加入索引'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
