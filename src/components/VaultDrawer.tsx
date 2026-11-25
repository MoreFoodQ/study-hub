import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Unlock,
  Upload,
  X,
} from 'lucide-react';
import type { StudySite } from '../data/hubData';
import {
  clearEncryptedVault,
  decryptVaultEntries,
  encryptVaultEntries,
  generateStrongPassword,
  isWebCryptoAvailable,
  loadEncryptedVault,
  saveEncryptedVault,
  validateVaultEnvelope,
  type EncryptedVaultEnvelope,
  type VaultEntry,
} from '../services/vaultCrypto';

interface VaultDrawerProps {
  open: boolean;
  onClose: () => void;
  sites: StudySite[];
  initialSiteId?: string | null;
  onVaultStatusChange: (meta: { initialized: boolean; unlocked: boolean; linkedSiteIds: string[] }) => void;
  onNotify: (msg: string) => void;
}

const EMPTY_FORM = {
  service: '',
  siteId: '',
  loginUrl: '',
  username: '',
  password: '',
  note: '',
};

export function VaultDrawer({
  open,
  onClose,
  sites,
  initialSiteId,
  onVaultStatusChange,
  onNotify,
}: VaultDrawerProps) {
  const [envelope, setEnvelope] = useState<EncryptedVaultEnvelope | null>(() => loadEncryptedVault());
  const [passphrase, setPassphrase] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [unlockedKey, setUnlockedKey] = useState<string | null>(null);
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [search, setSearch] = useState('');
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showFormPwd, setShowFormPwd] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cryptoOk = isWebCryptoAvailable();

  // 同步金庫狀態給外部（例如卡片上顯示已關聯金庫標記）
  useEffect(() => {
    const linkedSiteIds = unlockedKey
      ? Array.from(new Set(entries.map((e) => e.siteId).filter((v): v is string => Boolean(v))))
      : [];
    onVaultStatusChange({
      initialized: Boolean(envelope),
      unlocked: Boolean(unlockedKey),
      linkedSiteIds,
    });
  }, [envelope, unlockedKey, entries, onVaultStatusChange]);

  // 若從特定網站卡片點擊「帳密金庫」，自動帶入篩選或新增表單
  useEffect(() => {
    if (!open || !initialSiteId || !unlockedKey) return;
    const matched = entries.find((e) => e.siteId === initialSiteId);
    const site = sites.find((s) => s.id === initialSiteId);
    if (matched) {
      setSearch(matched.service);
      setShowForm(false);
    } else if (site) {
      setSearch('');
      setEditingId(null);
      setForm({
        service: site.title.split('·')[0].trim(),
        siteId: site.id,
        loginUrl: site.url,
        username: '',
        password: '',
        note: '',
      });
      setShowForm(true);
    }
  }, [open, initialSiteId, unlockedKey, entries, sites]);

  // ESC 鍵關閉抽屜
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) =>
      [e.service, e.username, e.loginUrl, e.note].join(' ').toLowerCase().includes(q),
    );
  }, [entries, search]);

  const persistEntries = async (nextEntries: VaultEntry[], key: string) => {
    setBusy(true);
    try {
      const nextEnv = await encryptVaultEntries(nextEntries, key);
      saveEncryptedVault(nextEnv);
      setEnvelope(nextEnv);
      setEntries(nextEntries);
    } finally {
      setBusy(false);
    }
  };

  const handleInitVault = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (passphrase.length < 6) {
      setError('主密碼至少需 6 個字元，建議混合英數與符號。');
      return;
    }
    if (passphrase !== confirmPass) {
      setError('兩次輸入的主密碼不一致。');
      return;
    }
    setBusy(true);
    try {
      const env = await encryptVaultEntries([], passphrase);
      saveEncryptedVault(env);
      setEnvelope(env);
      setUnlockedKey(passphrase);
      setEntries([]);
      setPassphrase('');
      setConfirmPass('');
      onNotify('已在本機建立 AES-256-GCM 加密帳密金庫');
    } catch (err) {
      setError(err instanceof Error ? err.message : '初始化失敗');
    } finally {
      setBusy(false);
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!envelope) return;
    setError(null);
    setBusy(true);
    try {
      const list = await decryptVaultEntries(envelope, passphrase);
      setEntries(list);
      setUnlockedKey(passphrase);
      setPassphrase('');
      onNotify(`已解鎖金庫（共 ${list.length} 筆加密憑證）`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '無法解鎖金庫');
    } finally {
      setBusy(false);
    }
  };

  const handleLock = () => {
    setUnlockedKey(null);
    setEntries([]);
    setRevealedIds({});
    setShowForm(false);
    setEditingId(null);
    setSearch('');
    onNotify('帳密金庫已上鎖並清除記憶體明文');
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockedKey) return;
    if (!form.service.trim() || !form.username.trim()) {
      setError('請填寫服務名稱與帳號。');
      return;
    }
    setError(null);
    const now = new Date().toISOString();
    let next: VaultEntry[];
    if (editingId) {
      next = entries.map((item) =>
        item.id === editingId
          ? {
              ...item,
              service: form.service.trim(),
              siteId: form.siteId || undefined,
              loginUrl: form.loginUrl.trim(),
              username: form.username.trim(),
              password: form.password,
              note: form.note.trim(),
              updatedAt: now,
            }
          : item,
      );
    } else {
      const created: VaultEntry = {
        id: `cred-${Date.now()}`,
        service: form.service.trim(),
        siteId: form.siteId || undefined,
        loginUrl: form.loginUrl.trim(),
        username: form.username.trim(),
        password: form.password,
        note: form.note.trim(),
        updatedAt: now,
      };
      next = [created, ...entries];
    }
    await persistEntries(next, unlockedKey);
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
    setShowFormPwd(false);
    onNotify(editingId ? '已更新加密憑證' : '已新增並加密儲存至本機金庫');
  };

  const handleDeleteEntry = async (id: string) => {
    if (!unlockedKey) return;
    if (!window.confirm('確定要從本機金庫永久刪除此筆帳密？')) return;
    const next = entries.filter((item) => item.id !== id);
    await persistEntries(next, unlockedKey);
    onNotify('已刪除該筆憑證');
  };

  const handleCopy = async (key: string, value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(key);
      onNotify(`已複製${label}`);
      window.setTimeout(() => setCopiedId(null), 1600);
    } catch {
      onNotify('無法存取剪貼簿，請手動選取複製');
    }
  };

  const handleExportEncrypted = () => {
    if (!envelope) return;
    const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `qq-vault-${stamp}.qqvault.json`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify('已匯出 AES-256 加密金庫檔（.qqvault.json）');
  };

  const handleImportEncrypted = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      if (!validateVaultEnvelope(parsed)) {
        setError('檔案格式不正確，請選擇有效的 .qqvault.json 加密金庫檔。');
      } else {
        saveEncryptedVault(parsed);
        setEnvelope(parsed);
        setUnlockedKey(null);
        setEntries([]);
        onNotify('已匯入加密金庫檔，請輸入主密碼解鎖');
      }
    } catch {
      setError('無法讀取 JSON 檔案。');
    }
    e.target.value = '';
  };

  const handleResetVault = () => {
    if (!window.confirm('確定要清空本機加密金庫？清空後原資料無法復原（除非你曾匯出 .qqvault.json 備份）。')) {
      return;
    }
    clearEncryptedVault();
    setEnvelope(null);
    setUnlockedKey(null);
    setEntries([]);
    setPassphrase('');
    setConfirmPass('');
    setError(null);
    onNotify('已重置本機金庫');
  };

  const handleSiteLinkChange = (siteId: string) => {
    const site = sites.find((s) => s.id === siteId);
    setForm((prev) => ({
      ...prev,
      siteId,
      service: prev.service || (site ? site.title.split('·')[0].trim() : ''),
      loginUrl: prev.loginUrl || (site ? site.url : ''),
    }));
  };

  if (!open) return null;

  return (
    <div className="drawer-backdrop" role="dialog" aria-modal="true" aria-labelledby="vault-title" onClick={onClose}>
      <aside className="vault-drawer" onClick={(e) => e.stopPropagation()}>
        <header className="vault-head">
          <div className="vault-title-group">
            <span className="mono-kicker">LOCAL ENCRYPTED VAULT · AES-256-GCM</span>
            <h2 id="vault-title">
              <KeyRound size={20} /> 帳密安全蒐集庫
            </h2>
          </div>
          <div className="vault-head-actions">
            {unlockedKey && (
              <button type="button" className="studio-btn sm" onClick={handleLock} title="立即上鎖">
                <Lock size={14} /> 上鎖
              </button>
            )}
            <button type="button" className="icon-square" onClick={onClose} aria-label="關閉金庫">
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="vault-security-banner">
          <ShieldCheck size={16} className="banner-icon" />
          <p>
            <strong>零雲端、純本機加密：</strong>所有帳密僅使用瀏覽器內建 Web Crypto（PBKDF2 21 萬次 + AES-256-GCM）加密儲存在本機{' '}
            <code>localStorage</code>，絕不會寫入原始碼或推送至公開 GitHub 倉庫。
          </p>
        </div>

        {!cryptoOk && (
          <div className="vault-error">
            <ShieldAlert size={16} /> 目前連線環境未啟用 Web Crypto API，請透過 HTTPS（GitHub Pages）或 localhost 開啟。
          </div>
        )}

        {error && (
          <div className="vault-error">
            <ShieldAlert size={15} /> {error}
          </div>
        )}

        {/* 狀態 A：尚未建立金庫 */}
        {!envelope && (
          <form className="vault-auth-box" onSubmit={handleInitVault}>
            <h3>設定你的主密碼（Master Passphrase）</h3>
            <p className="muted-copy">
              這組主密碼僅用於衍生 AES-256 金鑰，不會被系統儲存。請妥善記住，或隨時匯出加密備份檔。
            </p>
            <label className="field-label">
              主密碼（至少 6 字元）
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="輸入高強度主密碼..."
                autoComplete="new-password"
                required
              />
            </label>
            <label className="field-label">
              再次確認主密碼
              <input
                type="password"
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                placeholder="再次輸入主密碼..."
                autoComplete="new-password"
                required
              />
            </label>
            <div className="vault-auth-actions">
              <button type="submit" className="studio-btn primary" disabled={busy || !cryptoOk}>
                <Lock size={15} /> {busy ? '加密建立中...' : '建立本機加密金庫'}
              </button>
              <button
                type="button"
                className="studio-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={15} /> 匯入既有 .qqvault.json
              </button>
            </div>
          </form>
        )}

        {/* 狀態 B：已建立但上鎖 */}
        {envelope && !unlockedKey && (
          <form className="vault-auth-box" onSubmit={handleUnlock}>
            <div className="vault-lock-badge">
              <Lock size={22} />
              <div>
                <strong>金庫已加密鎖定</strong>
                <span className="mono-sub">最後更新：{envelope.updatedAt.slice(0, 16).replace('T', ' ')}</span>
              </div>
            </div>
            <label className="field-label">
              輸入主密碼解鎖
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="輸入 Master Passphrase..."
                autoComplete="current-password"
                autoFocus
                required
              />
            </label>
            <div className="vault-auth-actions">
              <button type="submit" className="studio-btn primary" disabled={busy || !cryptoOk}>
                <Unlock size={15} /> {busy ? '解密中...' : '解鎖金庫'}
              </button>
              <button type="button" className="studio-btn" onClick={handleExportEncrypted}>
                <Download size={14} /> 備份密文檔
              </button>
              <button type="button" className="studio-btn" onClick={() => fileInputRef.current?.click()}>
                <Upload size={14} /> 匯入密文檔
              </button>
            </div>
            <button type="button" className="text-danger-link" onClick={handleResetVault}>
              忘記主密碼？重置本機金庫
            </button>
          </form>
        )}

        {/* 狀態 C：已解鎖 */}
        {envelope && unlockedKey && (
          <div className="vault-unlocked">
            <div className="vault-toolbar">
              <input
                type="search"
                className="vault-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜尋服務名稱、帳號或備註..."
              />
              <button
                type="button"
                className="studio-btn primary sm"
                onClick={() => {
                  setEditingId(null);
                  setForm(EMPTY_FORM);
                  setShowForm((s) => !s);
                }}
              >
                <Plus size={14} /> {showForm ? '收合表單' : '新增帳密'}
              </button>
            </div>

            {showForm && (
              <form className="vault-entry-form" onSubmit={handleSaveEntry}>
                <div className="form-grid-2">
                  <label className="field-label">
                    關聯學習網站（選填）
                    <select value={form.siteId} onChange={(e) => handleSiteLinkChange(e.target.value)}>
                      <option value="">— 自訂服務（如 Vercel / Supabase / DET）—</option>
                      {sites.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field-label">
                    服務名稱 *
                    <input
                      required
                      value={form.service}
                      onChange={(e) => setForm({ ...form, service: e.target.value })}
                      placeholder="例如：Biostatistics Study / Vercel"
                    />
                  </label>
                </div>

                <label className="field-label">
                  登入網址
                  <input
                    value={form.loginUrl}
                    onChange={(e) => setForm({ ...form, loginUrl: e.target.value })}
                    placeholder="https://..."
                  />
                </label>

                <div className="form-grid-2">
                  <label className="field-label">
                    帳號 / Email *
                    <input
                      required
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                      placeholder="name@example.com"
                    />
                  </label>
                  <label className="field-label">
                    密碼
                    <div className="pwd-input-row">
                      <input
                        type={showFormPwd ? 'text' : 'password'}
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        placeholder="留空或點右側自動產生"
                      />
                      <button
                        type="button"
                        className="icon-square sm"
                        onClick={() => setShowFormPwd((v) => !v)}
                        title={showFormPwd ? '隱藏密碼' : '顯示密碼'}
                      >
                        {showFormPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button
                        type="button"
                        className="icon-square sm"
                        onClick={() => {
                          setForm({ ...form, password: generateStrongPassword(18) });
                          setShowFormPwd(true);
                        }}
                        title="產生高強度隨機密碼"
                      >
                        <RefreshCw size={14} />
                      </button>
                    </div>
                  </label>
                </div>

                <label className="field-label">
                  備註（例如 Google 登入 / 2FA 提示）
                  <input
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    placeholder="例如：使用 GitHub OAuth 或個人 Gmail 登入"
                  />
                </label>

                <div className="vault-form-foot">
                  <button
                    type="button"
                    className="studio-btn sm"
                    onClick={() => {
                      setShowForm(false);
                      setEditingId(null);
                    }}
                  >
                    取消
                  </button>
                  <button type="submit" className="studio-btn primary sm" disabled={busy}>
                    {editingId ? '儲存變更' : '加密儲存'}
                  </button>
                </div>
              </form>
            )}

            <div className="vault-list">
              {filteredEntries.length === 0 ? (
                <div className="vault-empty">
                  {entries.length === 0
                    ? '金庫目前是空的。點擊上方「新增帳密」收集各站登入方式（如 Biostatistics Study、Vercel、Supabase、DET）。'
                    : '找不到符合搜尋條件的項目。'}
                </div>
              ) : (
                filteredEntries.map((item) => {
                  const revealed = Boolean(revealedIds[item.id]);
                  const linkedSite = item.siteId ? sites.find((s) => s.id === item.siteId) : undefined;
                  return (
                    <article key={item.id} className="vault-item">
                      <div className="vault-item-top">
                        <div>
                          <h4>{item.service}</h4>
                          {linkedSite && <span className="vault-link-tag">關聯：{linkedSite.title}</span>}
                        </div>
                        <div className="vault-item-ctrls">
                          <button
                            type="button"
                            className="icon-square sm"
                            title="編輯"
                            onClick={() => {
                              setEditingId(item.id);
                              setForm({
                                service: item.service,
                                siteId: item.siteId || '',
                                loginUrl: item.loginUrl,
                                username: item.username,
                                password: item.password,
                                note: item.note,
                              });
                              setShowForm(true);
                            }}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            className="icon-square sm danger"
                            title="刪除"
                            onClick={() => handleDeleteEntry(item.id)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      <div className="vault-cred-row">
                        <span className="cred-label">帳號</span>
                        <code className="cred-val">{item.username}</code>
                        <button
                          type="button"
                          className="mini-copy-btn"
                          onClick={() => handleCopy(`${item.id}-u`, item.username, '帳號')}
                        >
                          {copiedId === `${item.id}-u` ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                      </div>

                      {item.password && (
                        <div className="vault-cred-row">
                          <span className="cred-label">密碼</span>
                          <code className="cred-val">{revealed ? item.password : '••••••••••••••'}</code>
                          <button
                            type="button"
                            className="mini-copy-btn"
                            onClick={() => setRevealedIds((r) => ({ ...r, [item.id]: !r[item.id] }))}
                            title={revealed ? '隱藏' : '顯示'}
                          >
                            {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                          <button
                            type="button"
                            className="mini-copy-btn"
                            onClick={() => handleCopy(`${item.id}-p`, item.password, '密碼')}
                          >
                            {copiedId === `${item.id}-p` ? <Check size={13} /> : <Copy size={13} />}
                          </button>
                        </div>
                      )}

                      {item.note && <p className="vault-note">{item.note}</p>}
                    </article>
                  );
                })
              )}
            </div>

            <footer className="vault-footer">
              <button type="button" className="studio-btn sm" onClick={handleExportEncrypted}>
                <Download size={14} /> 匯出加密備份 (.qqvault.json)
              </button>
              <button type="button" className="studio-btn sm" onClick={() => fileInputRef.current?.click()}>
                <Upload size={14} /> 匯入備份
              </button>
            </footer>
          </div>
        )}

        <input ref={fileInputRef} type="file" accept=".json,.qqvault.json" hidden onChange={handleImportEncrypted} />
      </aside>
    </div>
  );
}
