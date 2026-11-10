import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Settings, VocabItem } from '../types';
import type { DailyProgress } from '../hooks/useDailyProgress';
import { getAllCards, getAllReviews } from '../lib/db';
import type { ReviewRecord, WordCard } from '../lib/srs';
import { startOfStudyDay } from '../lib/day';
import { dailyActivity, forecast, hardestWords, KNOWN_DAYS, stageCounts, STAGE_INFO, STAGES, trueRetention, type Stage } from '../lib/stats';

interface StatsProps {
  daily: DailyProgress | null;
  vocab: VocabItem[];
  settings: Settings;
  speak: (text: string) => void;
}

// One hue, light to dark: stages are ordered, so their color steps are too.
const STAGE_COLORS: Record<Stage, string> = {
  new: '#E5E7EB',
  learning: '#C7D2FE',
  young: '#A5B4FC',
  familiar: '#818CF8',
  known: '#4F46E5',
  mastered: '#312E81',
};
const BAR_COLOR = '#6366F1';

const Panel: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <section className="bg-white rounded-[2rem] shadow-xl border border-black/5 p-6 md:p-8 text-gray-900">
    <h2 className="text-lg font-black tracking-tight">{title}</h2>
    {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
    <div className="mt-5">{children}</div>
  </section>
);

const Tile: React.FC<{ label: string; value: string; note?: string }> = ({ label, value, note }) => (
  <div className="bg-white rounded-[1.5rem] shadow-lg border border-black/5 p-5 text-gray-900">
    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">{label}</p>
    <p className="text-3xl md:text-4xl font-black tracking-tight mt-1">{value}</p>
    {note && <p className="text-[11px] text-gray-500 mt-1">{note}</p>}
  </div>
);

interface Bar {
  label: string;
  value: number;
  tip: string;
}

/** Single-series column chart with a hover tooltip on each column. */
const BarChart: React.FC<{ bars: Bar[]; ariaLabel: string }> = ({ bars, ariaLabel }) => {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...bars.map((b) => b.value));
  const tickIdx = new Set([0, Math.floor((bars.length - 1) / 2), bars.length - 1]);
  return (
    <figure aria-label={ariaLabel}>
      <div className="flex items-end justify-between text-[10px] text-gray-500 mb-1">
        <span>{max}</span>
      </div>
      <div className="relative h-32 flex items-end gap-[2px] border-b border-gray-200" onMouseLeave={() => setHover(null)}>
        {bars.map((b, i) => (
          <div
            key={i}
            className="relative flex-1 h-full flex items-end cursor-default"
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            tabIndex={0}
            aria-label={b.tip}
          >
            <div
              className="w-full rounded-t-[4px] transition-opacity"
              style={{
                height: b.value ? `${Math.max(3, (b.value / max) * 100)}%` : 0,
                backgroundColor: BAR_COLOR,
                opacity: hover === null || hover === i ? 1 : 0.45,
              }}
            />
            {hover === i && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10 whitespace-nowrap rounded-lg bg-gray-900 text-white text-[11px] font-bold px-2.5 py-1.5 shadow-lg pointer-events-none">
                {b.tip}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-[2px] mt-1.5 text-[10px] text-gray-500">
        {bars.map((b, i) => (
          <span key={i} className="flex-1 text-center whitespace-nowrap overflow-visible">
            {tickIdx.has(i) ? b.label : ''}
          </span>
        ))}
      </div>
    </figure>
  );
};

const shortDate = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

const Stats: React.FC<StatsProps> = ({ daily, vocab, settings, speak }) => {
  const [data, setData] = useState<{ cards: Map<string, WordCard>; reviews: ReviewRecord[] } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    Promise.all([getAllCards(), getAllReviews()])
      .then(([cards, reviews]) => setData({ cards, reviews }))
      .catch(() => setFailed(true));
  }, []);

  const view = useMemo(() => {
    if (!data) return null;
    const now = new Date();
    const ids = vocab.map((w) => w.id);
    const counts = stageCounts(ids, data.cards);
    const known = counts.known + counts.mastered;
    const started = ids.length - counts.new;
    const retention = trueRetention(data.reviews, new Date(now.getTime() - 30 * 86_400_000));
    const todayStart = startOfStudyDay(now).getTime();
    const today = data.reviews.filter((r) => r.review.getTime() >= todayStart).length;
    const due = forecast(data.cards.values(), now, 14);
    const activity = dailyActivity(data.reviews, now, 30);
    const hardest = hardestWords(data.cards.values(), 8);
    return { counts, known, started, retention, today, due, activity, hardest, total: ids.length, now };
  }, [data, vocab]);

  if (failed) {
    return <p className="font-bold">This browser is not letting the app read saved progress.</p>;
  }
  if (!view) {
    return <div className="w-16 h-16 border-4 border-black/5 border-t-black rounded-full animate-spin" aria-label="Loading" />;
  }

  const wordsById = new Map(vocab.map((w) => [w.id, w]));
  const target = Math.round(settings.retention * 100);

  if (view.started === 0) {
    return (
      <div className="w-full max-w-xl bg-white rounded-[2.5rem] shadow-xl p-10 text-center text-gray-900 animate-fadeIn">
        <h1 className="text-3xl font-black tracking-tight mb-2">No progress yet</h1>
        <p className="text-gray-500 mb-6">Your stats appear here after your first review session.</p>
        <Link to="/" className="inline-block px-6 py-4 rounded-2xl bg-gray-900 text-white font-black text-xs tracking-widest uppercase">
          Start reviewing
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl flex flex-col gap-4 py-2 animate-fadeIn">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label="Words known" value={String(view.known)} note={`of ${view.total}, remembered ${KNOWN_DAYS}+ days`} />
        <Tile
          label="Day streak"
          value={String(daily?.streak.current ?? 0)}
          note={daily?.streak.frozen.length ? `${daily.streak.frozen.length} missed day forgiven` : 'one missed day a week is forgiven'}
        />
        <Tile
          label="Recall, 30 days"
          value={view.retention.rate === null ? '–' : `${Math.round(view.retention.rate * 100)}%`}
          note={view.retention.count ? `target ${target}%, ${view.retention.count} reviews` : 'needs a few reviews'}
        />
        <Tile label="Answers today" value={`${view.today}/${settings.dailyGoal}`} note={`${view.due[0]} still due today`} />
      </div>

      <Panel title="Word stages" subtitle="Stages follow how long the scheduler expects you to remember each word.">
        <p className="text-[11px] font-bold text-gray-500 mb-2">
          {view.started} words started, {view.total - view.started} still new
        </p>
        <div className="flex h-5 w-full gap-[2px] rounded-[4px] overflow-hidden" role="img" aria-label="Started words by stage">
          {STAGES.filter((s) => s !== 'new').map((s) =>
            view.counts[s] ? (
              <div key={s} title={`${STAGE_INFO[s].label}: ${view.counts[s]}`} style={{ flexGrow: view.counts[s], backgroundColor: STAGE_COLORS[s] }} />
            ) : null
          )}
        </div>
        <ul className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 mt-5">
          {STAGES.map((s) => (
            <li key={s} className="flex items-start gap-2.5">
              <span className="mt-1 w-3 h-3 rounded-[3px] shrink-0 border border-black/5" style={{ backgroundColor: STAGE_COLORS[s] }} />
              <span>
                <span className="block text-sm font-black">
                  {STAGE_INFO[s].label} <span className="font-bold text-gray-500">{view.counts[s]}</span>
                </span>
                <span className="block text-[11px] text-gray-500">{STAGE_INFO[s].hint}</span>
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="grid md:grid-cols-2 gap-4">
        <Panel title="Upcoming reviews" subtitle={`Tomorrow: ${view.due[1]} · next 7 days: ${view.due.slice(1, 8).reduce((a, b) => a + b, 0)}`}>
          <BarChart
            ariaLabel="Reviews due per day for the next 14 days"
            bars={view.due.map((n, i) => {
              const d = new Date(view.now.getTime() + i * 86_400_000);
              const label = i === 0 ? 'Today' : i === 1 ? 'Tmrw' : shortDate(d);
              return { label, value: n, tip: `${i === 0 ? 'Today' : shortDate(d)}: ${n} due` };
            })}
          />
        </Panel>
        <Panel title="Last 30 days" subtitle={`${view.activity.filter((d) => d.count > 0).length} active days`}>
          <BarChart
            ariaLabel="Answers per day for the last 30 days"
            bars={view.activity.map((d, i) => {
              const date = new Date(`${d.day}T12:00:00`);
              return { label: i === view.activity.length - 1 ? 'Today' : shortDate(date), value: d.count, tip: `${shortDate(date)}: ${d.count} answers` };
            })}
          />
        </Panel>
      </div>

      <Panel title="Hardest words" subtitle="Words you forget most often. Tap one to hear it.">
        {view.hardest.length === 0 ? (
          <p className="text-sm text-gray-500">No troublesome words yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {view.hardest.map((c) => {
              const w = wordsById.get(c.id);
              if (!w) return null;
              return (
                <li key={c.id}>
                  <button onClick={() => speak(w.ko)} className="w-full flex items-center gap-4 py-3 text-left hover:bg-gray-50 rounded-xl px-2">
                    <span lang="ko" className="text-2xl font-black w-28 shrink-0">{w.ko}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-bold truncate">{w.en}</span>
                      <span lang="hi" className="block text-sm text-gray-500 truncate font-devanagari">{w.hi}</span>
                    </span>
                    <span className="text-[11px] font-bold text-gray-500 shrink-0">
                      {c.lapses ? `forgotten ${c.lapses}×` : 'hard'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
};

export default Stats;
