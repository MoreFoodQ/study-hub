import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Flame,
  Layers,
  Pause,
  Pencil,
  Play,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Timer,
  Volume2,
} from 'lucide-react';
import {
  MICRO_BITES,
  WORD_OF_DAY_POOL,
  type DomainId,
} from '../data/hubData';

interface DailyStudioProps {
  todayKeyStr: string;
  dayIndexNum: number;
  tasks: string[];
  checkins: Record<string, boolean[]>;
  focusCount: number;
  secondsLeft: number;
  timerRunning: boolean;
  pomoMinutes: number;
  onToggleCheck: (idx: number) => void;
  onUpdateTasks: (nextTasks: string[]) => void;
  onToggleTimer: () => void;
  onResetTimer: (minutes?: number) => void;
}

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function DailyStudio({
  todayKeyStr,
  dayIndexNum,
  tasks,
  checkins,
  focusCount,
  secondsLeft,
  timerRunning,
  pomoMinutes,
  onToggleCheck,
  onUpdateTasks,
  onToggleTimer,
  onResetTimer,
}: DailyStudioProps) {
  const [wordOffset, setWordOffset] = useState(0);
  const [biteOffset, setBiteOffset] = useState(0);
  const [biteDomain, setBiteDomain] = useState<DomainId | 'all'>('all');
  const [biteRevealed, setBiteRevealed] = useState(false);

  const [wordExtra, setWordExtra] = useState<{ phonetic?: string; audio?: string; def?: string }>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [editingTasks, setEditingTasks] = useState(false);
  const [draftTasks, setDraftTasks] = useState<string[]>(tasks);

  const activeWord = WORD_OF_DAY_POOL[(dayIndexNum + wordOffset) % WORD_OF_DAY_POOL.length];

  // 從 dictionaryapi.dev 抓取音標與發音檔
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

  const speakWord = () => {
    if (wordExtra.audio) {
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.src = wordExtra.audio;
      audioRef.current.play().catch(() => fallbackSpeech(activeWord.word));
      return;
    }
    fallbackSpeech(activeWord.word);
  };

  const fallbackSpeech = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'en-US';
      utter.rate = 0.92;
      window.speechSynthesis.speak(utter);
    }
  };

  const bitePool = useMemo(
    () => (biteDomain === 'all' ? MICRO_BITES : MICRO_BITES.filter((b) => b.domain === biteDomain)),
    [biteDomain],
  );
  const activeBite = bitePool[(dayIndexNum + biteOffset) % bitePool.length];

  const todayChecks = checkins[todayKeyStr] || [false, false, false];

  const streak = useMemo(() => {
    let count = 0;
    const cur = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(cur);
      d.setDate(cur.getDate() - i);
      const arr = checkins[formatDateKey(d)];
      if (arr && arr.some(Boolean)) count++;
      else if (i > 0) break;
    }
    return count;
  }, [checkins]);

  const heatmapDays = useMemo(() => {
    const arr: { key: string; level: number }[] = [];
    const cur = new Date();
    for (let i = 27; i >= 0; i--) {
      const d = new Date(cur);
      d.setDate(cur.getDate() - i);
      const k = formatDateKey(d);
      const checks = checkins[k] || [];
      arr.push({ key: k, level: checks.filter(Boolean).length });
    }
    return arr;
  }, [checkins]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');
  const totalSec = pomoMinutes * 60;
  const progressPct = Math.max(0, Math.min(100, ((totalSec - secondsLeft) / totalSec) * 100));

  const saveEditedTasks = () => {
    const cleaned = draftTasks.map((t, i) => t.trim() || tasks[i]);
    onUpdateTasks(cleaned);
    setEditingTasks(false);
  };

  return (
    <section className="studio-section" aria-label="每日儀式工作室">
      <div className="editorial-section-head">
        <div className="section-title-col">
          <span className="mono-kicker">DAILY RITUALS · VOCABULARY · ACTIVE RECALL · FOCUS</span>
          <h2 className="editorial-heading">
            每日學習儀式 <em>Daily Studio</em>
          </h2>
        </div>
        <div className="ritual-summary-pills">
          <span className="mono-pill">
            <Flame size={13} /> 連續 {streak} 天
          </span>
          <span className="mono-pill">
            <Timer size={13} /> 累計專注 {focusCount} 回合
          </span>
        </div>
      </div>

      <div className="daily-grid">
        {/* 01 · 今日 DET 核心單字 */}
        <article className="ritual-card">
          <div className="ritual-head">
            <span className="mono-kicker">
              <Sparkles size={13} /> 01 · DET CORE LEXICON
            </span>
            <button type="button" className="ghost-action" onClick={() => setWordOffset((v) => v + 1)}>
              <RefreshCw size={13} /> 換一字
            </button>
          </div>

          <div className="word-showcase">
            <div>
              <h3 className="word-display">{activeWord.word}</h3>
              <div className="word-subline">
                <span className="pos-tag">{activeWord.pos}</span>
                {wordExtra.phonetic && <span className="phonetic-code">{wordExtra.phonetic}</span>}
                <span className="word-zh">{activeWord.zh}</span>
              </div>
            </div>
            <button type="button" className="speak-orb" onClick={speakWord} title="播放真人／語音發音" aria-label="播放發音">
              <Volume2 size={20} />
            </button>
          </div>

          <p className="word-def-text">{wordExtra.def || activeWord.fallbackDef}</p>
          <blockquote className="word-quote">“{activeWord.example}”</blockquote>
        </article>

        {/* 02 · 30 秒跨領域微知識閃卡 */}
        <article className="ritual-card">
          <div className="ritual-head">
            <span className="mono-kicker">
              <Layers size={13} /> 02 · 30S MICRO-BITE · {activeBite.topic}
            </span>
            <div className="bite-ctrls">
              {(['all', 'english', 'stats', 'ml'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`mini-tab ${biteDomain === d ? 'is-on' : ''}`}
                  onClick={() => {
                    setBiteDomain(d);
                    setBiteOffset(0);
                    setBiteRevealed(false);
                  }}
                >
                  {d === 'all' ? '全' : d === 'english' ? '英' : d === 'stats' ? '統' : 'ML'}
                </button>
              ))}
              <button
                type="button"
                className="ghost-action"
                onClick={() => {
                  setBiteOffset((v) => v + 1);
                  setBiteRevealed(false);
                }}
                aria-label="下一題"
              >
                <RefreshCw size={13} />
              </button>
            </div>
          </div>

          <h3 className="bite-question">{activeBite.question}</h3>

          {!biteRevealed ? (
            <button type="button" className="reveal-panel-btn" onClick={() => setBiteRevealed(true)}>
              <span>先在腦中回想 5 秒，點擊揭曉直覺解析</span>
              <span className="mono-kicker">REVEAL →</span>
            </button>
          ) : (
            <div className="bite-answer-box">
              <p className="bite-hook-line">{activeBite.hook}</p>
              <p className="bite-detail-line">{activeBite.detail}</p>
              <code className="bite-code">{activeBite.example}</code>
            </div>
          )}
        </article>

        {/* 03 · 專注番茄鐘 */}
        <article className="ritual-card pomo-card">
          <div className="ritual-head">
            <span className="mono-kicker">
              <Timer size={13} /> 03 · FOCUS CHRONOMETER
            </span>
            <div className="bite-ctrls">
              {[15, 25, 45].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  className={`mini-tab ${pomoMinutes === mins ? 'is-on' : ''}`}
                  onClick={() => onResetTimer(mins)}
                >
                  {mins}m
                </button>
              ))}
            </div>
          </div>

          <div className="pomo-clock-wrap">
            <div className="pomo-big-time" aria-live="polite">
              {mm}
              <span>:</span>
              {ss}
            </div>
            <div className="pomo-progress-track" aria-hidden="true">
              <div className="pomo-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          <div className="pomo-controls">
            <button type="button" className="studio-btn primary" onClick={onToggleTimer}>
              {timerRunning ? <Pause size={15} /> : <Play size={15} />}
              {timerRunning ? '暫停專注' : '開始專注'}
            </button>
            <button type="button" className="studio-btn" onClick={() => onResetTimer(pomoMinutes)}>
              <RotateCcw size={14} /> 重設
            </button>
          </div>
          <p className="muted-copy">計時中可自由切換回「我的網站」或「今日論文」，頂部導覽列會持續顯示倒數。</p>
        </article>

        {/* 04 · 每日打卡與 28 天節奏熱力圖 */}
        <article className="ritual-card">
          <div className="ritual-head">
            <span className="mono-kicker">
              <Flame size={13} /> 04 · HABIT CHECK-IN &amp; 28-DAY HEATMAP
            </span>
            {!editingTasks ? (
              <button
                type="button"
                className="ghost-action"
                onClick={() => {
                  setDraftTasks(tasks);
                  setEditingTasks(true);
                }}
              >
                <Pencil size={12} /> 編輯項目
              </button>
            ) : (
              <button type="button" className="ghost-action is-accent" onClick={saveEditedTasks}>
                <Check size={13} /> 儲存
              </button>
            )}
          </div>

          {editingTasks ? (
            <div className="task-edit-list">
              {draftTasks.map((t, idx) => (
                <input
                  key={idx}
                  value={t}
                  onChange={(e) => setDraftTasks((prev) => prev.map((v, i) => (i === idx ? e.target.value : v)))}
                  placeholder={`每日微習慣 ${idx + 1}`}
                />
              ))}
            </div>
          ) : (
            <ul className="ritual-tasks">
              {tasks.map((label, idx) => (
                <li key={idx}>
                  <label className={`ritual-task-row ${todayChecks[idx] ? 'is-done' : ''}`}>
                    <input
                      type="checkbox"
                      checked={Boolean(todayChecks[idx])}
                      onChange={() => onToggleCheck(idx)}
                    />
                    <span>{label}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          <div className="heatmap-block">
            <div className="heatmap-meta">
              <span className="mono-kicker">LAST 28 DAYS</span>
              <span className="heatmap-legend">
                少 <i className="heat-sq lvl-0" /> <i className="heat-sq lvl-1" /> <i className="heat-sq lvl-2" />{' '}
                <i className="heat-sq lvl-3" /> 多
              </span>
            </div>
            <div className="heatmap-grid" aria-label="近 28 天學習節奏熱力圖">
              {heatmapDays.map((d) => (
                <span
                  key={d.key}
                  className={`heat-sq lvl-${Math.min(3, d.level)}`}
                  title={`${d.key}：完成 ${d.level}/3 項`}
                />
              ))}
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
