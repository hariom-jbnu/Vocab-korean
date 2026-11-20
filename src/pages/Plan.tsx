import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { VocabItem } from '../types';
import { getAllCards } from '../lib/db';
import { State } from '../lib/srs';
import { studyDayKey } from '../lib/day';
import {
  buildSchedule,
  dayNumber,
  HEAVY_MINUTES,
  planDate,
  planWordIds,
  PLAN_ORDERS,
  type PlanDay,
  type PlanOrder,
  type StudyPlan,
} from '../lib/plan';

interface PlanProps {
  vocab: VocabItem[];
  plan: StudyPlan | null;
  setPlan: (plan: StudyPlan | null) => void;
  planOrder: string[] | null;
  seed: number;
  speak: (text: string) => void;
}

const MIN_WORDS = 50;
const MAX_DAYS = 365;
const WORD_PRESETS = [500, 1000, 1500, 2000];
const DAY_PRESETS = [30, 45, 60, 90];

const fmtDate = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const fmtNum = (n: number) => n.toLocaleString();

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <section className={`w-full bg-white rounded-[2rem] shadow-xl border border-black/5 p-5 md:p-8 text-gray-900 ${className}`}>{children}</section>
);

const Preset: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all ${active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-black/10 hover:bg-gray-50'}`}
  >
    {children}
  </button>
);

/** Set a goal (words and days) and see the Day 1 … Day N schedule it makes. */
const Plan: React.FC<PlanProps> = ({ vocab, plan, setPlan, planOrder, seed, speak }) => {
  const maxWords = vocab.length;
  const [draft, setDraft] = useState<StudyPlan>(
    () => plan ?? { totalWords: 2000, days: 30, order: 'mixed', startDay: studyDayKey(new Date()) }
  );
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [openDay, setOpenDay] = useState<number | null>(null);

  // Keep the form in step with a plan saved elsewhere (another tab, a restore).
  useEffect(() => {
    if (plan) setDraft(plan);
  }, [plan]);

  useEffect(() => {
    let alive = true;
    getAllCards()
      .then((cards) => {
        if (!alive) return;
        const ids = new Set<string>();
        for (const c of cards.values()) if (c.state !== State.New) ids.add(c.id);
        setSeen(ids);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const wordsById = useMemo(() => new Map(vocab.map((w) => [w.id, w])), [vocab]);
  const imageCount = useMemo(() => vocab.filter((w) => w.source === 'image').length, [vocab]);
  const total = Math.min(Math.max(MIN_WORDS, draft.totalWords), Math.max(MIN_WORDS, maxWords));
  const days = Math.min(Math.max(1, draft.days), MAX_DAYS);

  const isSaved =
    !!plan &&
    plan.totalWords === total &&
    plan.days === days &&
    plan.order === draft.order &&
    plan.startDay === draft.startDay;

  const order = useMemo(
    () => (isSaved && planOrder ? planOrder : planWordIds(vocab, total, draft.order, seed)),
    [isSaved, planOrder, vocab, total, draft.order, seed]
  );
  const schedule = useMemo(() => buildSchedule(order, days, draft.startDay), [order, days, draft.startDay]);

  const today = dayNumber(draft.startDay, new Date());
  const peak = schedule.reduce((m, d) => Math.max(m, d.minutes), 0);
  const avg = Math.round(schedule.reduce((s, d) => s + d.minutes, 0) / Math.max(1, schedule.length));
  const perDay = Math.ceil(order.length / Math.max(1, days));
  const learned = order.filter((id) => seen.has(id)).length;
  const fromImages = order.filter((id) => wordsById.get(id)?.source === 'image').length;

  useEffect(() => {
    if (openDay === null && today >= 1 && today <= days) setOpenDay(today);
  }, [today, days, openDay]);

  const update = (patch: Partial<StudyPlan>) => setDraft((d) => ({ ...d, ...patch }));
  const save = () => setPlan({ ...draft, totalWords: total, days });

  if (vocab.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-24 animate-pulse">
        <div className="w-16 h-16 border-4 border-black/5 border-t-black rounded-full animate-spin mb-6"></div>
        <p className="font-black opacity-50 uppercase tracking-widest text-[10px]">Loading words...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl flex flex-col gap-5 py-2 animate-fadeIn">
      {plan && isSaved && (
        <Card className="!p-5 md:!p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-500">Your progress</p>
              <p className="text-2xl md:text-3xl font-black tracking-tight mt-1">
                {fmtNum(learned)} <span className="text-gray-400">/ {fmtNum(order.length)} words</span>
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {today < 1
                  ? `Day 1 starts ${fmtDate(planDate(plan.startDay, 1))}.`
                  : today > days
                    ? `The ${days} days are over. Keep reviewing to hold on to every word.`
                    : `Day ${today} of ${days}.`}
              </p>
            </div>
            <Link
              to="/"
              className="px-6 py-4 rounded-2xl bg-gray-900 text-white font-black text-xs tracking-widest uppercase hover:bg-black transition-all"
            >
              Study today
            </Link>
          </div>
          <div className="mt-4 h-2 rounded-full bg-gray-100 overflow-hidden" aria-hidden="true">
            <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${(learned / Math.max(1, order.length)) * 100}%` }} />
          </div>
        </Card>
      )}

      <Card>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight">{plan ? 'Your plan' : 'Make your plan'}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {fmtNum(maxWords)} words are ready: {fmtNum(imageCount)} from your images and {fmtNum(maxWords - imageCount)} common
          everyday words, each with two example sentences.
        </p>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">How many words</span>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="range"
                min={MIN_WORDS}
                max={maxWords}
                step={50}
                value={total}
                onChange={(e) => update({ totalWords: Number(e.target.value) })}
                className="flex-1 accent-indigo-600"
                aria-label="Total words"
              />
              <input
                type="number"
                min={MIN_WORDS}
                max={maxWords}
                value={draft.totalWords}
                onChange={(e) => update({ totalWords: Number(e.target.value) || MIN_WORDS })}
                className="w-20 px-2 py-1.5 rounded-xl border border-black/10 text-center font-black"
                aria-label="Total words, exact"
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {WORD_PRESETS.filter((n) => n <= maxWords).map((n) => (
                <Preset key={n} active={total === n} onClick={() => update({ totalWords: n })}>
                  {fmtNum(n)}
                </Preset>
              ))}
            </div>
          </label>

          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">In how many days</span>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="range"
                min={7}
                max={120}
                value={Math.min(days, 120)}
                onChange={(e) => update({ days: Number(e.target.value) })}
                className="flex-1 accent-indigo-600"
                aria-label="Days"
              />
              <input
                type="number"
                min={1}
                max={MAX_DAYS}
                value={draft.days}
                onChange={(e) => update({ days: Number(e.target.value) || 1 })}
                className="w-20 px-2 py-1.5 rounded-xl border border-black/10 text-center font-black"
                aria-label="Days, exact"
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {DAY_PRESETS.map((n) => (
                <Preset key={n} active={days === n} onClick={() => update({ days: n })}>
                  {n} days
                </Preset>
              ))}
            </div>
          </label>
        </div>

        <fieldset className="mt-6">
          <legend className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Which words first</legend>
          <div className="mt-2 grid gap-2 md:grid-cols-3">
            {(Object.keys(PLAN_ORDERS) as PlanOrder[]).map((o) => (
              <label
                key={o}
                className={`flex flex-col gap-1 p-3 rounded-2xl border cursor-pointer transition-all ${draft.order === o ? 'border-indigo-600 bg-indigo-50' : 'border-black/10 hover:bg-gray-50'}`}
              >
                <span className="flex items-center gap-2 text-sm font-black">
                  <input type="radio" name="order" value={o} checked={draft.order === o} onChange={() => update({ order: o })} className="accent-indigo-600" />
                  {PLAN_ORDERS[o].label}
                </span>
                <span className="text-xs text-gray-500 leading-snug">{PLAN_ORDERS[o].description}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="mt-6 flex flex-wrap items-center gap-3">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Day 1 is</span>
          <input
            type="date"
            value={draft.startDay}
            onChange={(e) => e.target.value && update({ startDay: e.target.value })}
            className="px-3 py-1.5 rounded-xl border border-black/10 font-bold"
          />
        </label>

        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-2xl bg-gray-50 p-3">
            <p className="text-2xl md:text-3xl font-black">{perDay}</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">new words a day</p>
          </div>
          <div className="rounded-2xl bg-gray-50 p-3">
            <p className="text-2xl md:text-3xl font-black">~{avg}</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">minutes a day</p>
          </div>
          <div className="rounded-2xl bg-gray-50 p-3">
            <p className="text-lg md:text-2xl font-black leading-9">{fmtDate(planDate(draft.startDay, days))}</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">last new words</p>
          </div>
        </div>

        {peak > HEAVY_MINUTES && (
          <p className="mt-4 text-sm bg-amber-50 text-amber-900 border border-amber-200 rounded-2xl px-4 py-3 leading-relaxed">
            <i className="bi bi-exclamation-triangle-fill mr-1.5"></i>
            This is a heavy plan: the busiest days need about <b>{peak} minutes</b>, mostly reviews of earlier words. It works if
            you study every day and do reviews first. If that is too much, choose more days: the words stay the same, the load
            drops.
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={save}
            disabled={isSaved}
            className="px-6 py-4 rounded-2xl bg-indigo-600 text-white font-black text-xs tracking-widest uppercase shadow-lg enabled:hover:bg-indigo-700 disabled:opacity-40 transition-all"
          >
            {plan ? (isSaved ? 'Plan saved' : 'Save changes') : 'Start my plan'}
          </button>
          {plan && !isSaved && (
            <button
              type="button"
              onClick={() => setDraft(plan)}
              className="px-6 py-4 rounded-2xl bg-gray-100 text-gray-800 font-black text-xs tracking-widest uppercase hover:bg-gray-200 transition-all"
            >
              Undo changes
            </button>
          )}
          {plan && isSaved && (
            <button
              type="button"
              onClick={() => setPlan(null)}
              className="px-6 py-4 rounded-2xl bg-gray-100 text-gray-800 font-black text-xs tracking-widest uppercase hover:bg-gray-200 transition-all"
              title="Go back to a fixed number of new words a day. Your progress stays."
            >
              Stop plan
            </button>
          )}
        </div>
        <p className="mt-3 text-xs text-gray-500">
          {fmtNum(fromImages)} of the {fmtNum(order.length)} words come from your images. Changing the plan keeps every word you
          have already learned.
        </p>
      </Card>

      <Card>
        <h2 className="text-lg font-black tracking-tight">Day by day</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Each day brings new words and the reviews that are due. If you miss a day, the words left are shared out over the days
          that remain.
        </p>
        <ol className="mt-4 space-y-2">
          {schedule.map((d) => (
            <DayRow
              key={d.day}
              d={d}
              isToday={d.day === today}
              open={openDay === d.day}
              onToggle={() => setOpenDay(openDay === d.day ? null : d.day)}
              wordsById={wordsById}
              seen={seen}
              speak={speak}
            />
          ))}
        </ol>
      </Card>

      <Research />
    </div>
  );
};

const DayRow: React.FC<{
  d: PlanDay;
  isToday: boolean;
  open: boolean;
  onToggle: () => void;
  wordsById: Map<string, VocabItem>;
  seen: Set<string>;
  speak: (text: string) => void;
}> = ({ d, isToday, open, onToggle, wordsById, seen, speak }) => {
  const done = d.wordIds.filter((id) => seen.has(id)).length;
  const complete = d.wordIds.length > 0 && done === d.wordIds.length;
  const heavy = d.minutes > HEAVY_MINUTES;

  return (
    <li className={`rounded-2xl border ${isToday ? 'border-indigo-600 bg-indigo-50/60' : 'border-black/5 bg-gray-50/60'}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="w-full flex items-center gap-3 px-4 py-3 text-left">
        <span
          className={`shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center font-black leading-none ${complete ? 'bg-emerald-600 text-white' : isToday ? 'bg-indigo-600 text-white' : 'bg-white text-gray-800 border border-black/5'}`}
        >
          {complete ? (
            <i className="bi bi-check-lg text-xl"></i>
          ) : (
            <>
              <span className="text-[8px] uppercase tracking-widest opacity-70">Day</span>
              <span className="text-lg">{d.day}</span>
            </>
          )}
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2 text-sm font-black">
            {complete && <span>Day {d.day}</span>}
            {fmtDate(d.date)}
            {isToday && <span className="text-[9px] uppercase tracking-widest bg-indigo-600 text-white px-2 py-0.5 rounded-full">Today</span>}
          </span>
          <span className="block text-xs text-gray-600 mt-0.5">
            +{d.wordIds.length} new · ~{d.reviews} reviews ·{' '}
            <span className={heavy ? 'text-amber-700 font-bold' : ''}>~{d.minutes} min</span>
            {done > 0 && !complete && ` · ${done} learned`}
          </span>
        </span>
        <i className={`bi bi-chevron-down text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}></i>
      </button>
      {open && (
        <ul className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {d.wordIds.map((id) => {
            const w = wordsById.get(id);
            if (!w) return null;
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => speak(w.ko)}
                  title={`${w.en}${w.topic ? ` · ${w.topic}` : ''}`}
                  className={`w-full text-left px-3 py-2 rounded-xl border transition-all hover:shadow-sm ${seen.has(id) ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-black/5'}`}
                >
                  <span lang="ko" className="block font-black text-base leading-tight">
                    {w.ko}
                    {w.source === 'image' && <i className="bi bi-image ml-1.5 text-[10px] text-gray-400" aria-label="from your images"></i>}
                  </span>
                  <span lang="hi" className="block text-xs text-gray-600 font-devanagari truncate">
                    {w.hi}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
};

const FINDINGS: { icon: string; title: string; body: string; source: string; href: string }[] = [
  {
    icon: 'bi-question-circle',
    title: 'Test yourself instead of rereading',
    body: 'Students who kept recalling Swahili–English words remembered about 80% a week later; students who kept rereading them remembered about 35%. Every card here asks you first and shows the answer after.',
    source: 'Karpicke & Roediger, Science, 2008',
    href: 'https://doi.org/10.1126/science.1152408',
  },
  {
    icon: 'bi-calendar-range',
    title: 'Space the reviews out',
    body: 'Memory lasts longer when reviews are spread over days, and the best gap grows with how long you want to remember. The app uses FSRS, a model trained on millions of reviews, to bring each word back just before you would forget it.',
    source: 'Cepeda et al., Psychological Science, 2008; Ye, Su & Cao, KDD 2022',
    href: 'https://doi.org/10.1111/j.1467-9280.2008.02209.x',
  },
  {
    icon: 'bi-arrow-repeat',
    title: 'Relearn until you get it right',
    body: 'A word you miss comes back in the same session until you answer it, and then again on later days. Recalling to that standard over three or more sessions is called successive relearning, and it gives large long-term gains.',
    source: 'Rawson, Dunlosky & Sciartelli, Educational Psychology Review, 2013',
    href: 'https://doi.org/10.1007/s10648-013-9240-4',
  },
  {
    icon: 'bi-shuffle',
    title: 'Mix topics, do not group them',
    body: 'Learning a set of related words together (ten clothing words in a row) causes more mix-ups between them. The plan spreads each image’s topic across the month and mixes it with common words.',
    source: 'Tinkham, System, 1993; Nakata & Suzuki, Studies in Second Language Acquisition, 2019',
    href: 'https://doi.org/10.1017/S0272263118000219',
  },
  {
    icon: 'bi-chat-quote',
    title: 'See each word in a sentence, and say it aloud',
    body: 'Two example sentences show how the word is really used, with a Hindi translation. Tap the speaker and repeat the sentence out loud: saying words aloud makes them easier to remember than reading silently.',
    source: 'Nation, Learning Vocabulary in Another Language, 2013; MacLeod et al., JEP: LMC, 2010',
    href: 'https://doi.org/10.1037/a0018785',
  },
  {
    icon: 'bi-sunrise',
    title: 'A little every day beats a lot once a week',
    body: 'The same study time spread over more sessions is remembered better than one long session, even though the long session feels more productive. Do your reviews first each day, then the new words.',
    source: 'Kornell, Applied Cognitive Psychology, 2009',
    href: 'https://doi.org/10.1002/acp.1537',
  },
];

const Research: React.FC = () => (
  <details className="w-full bg-white rounded-[2rem] shadow-xl border border-black/5 text-gray-900 group" open>
    <summary className="cursor-pointer list-none p-5 md:p-8 flex items-center justify-between gap-3">
      <span>
        <span className="block text-lg font-black tracking-tight">How this plan works</span>
        <span className="block text-xs text-gray-500 mt-0.5">What memory research says about learning words fast, and how the app uses it.</span>
      </span>
      <i className="bi bi-chevron-down text-gray-400 transition-transform group-open:rotate-180"></i>
    </summary>
    <ul className="px-5 md:px-8 pb-6 md:pb-8 grid gap-4 md:grid-cols-2">
      {FINDINGS.map((f) => (
        <li key={f.title} className="flex gap-3">
          <i className={`bi ${f.icon} text-xl text-indigo-600 mt-0.5`}></i>
          <div>
            <h3 className="font-black text-sm">{f.title}</h3>
            <p className="text-sm text-gray-600 leading-relaxed mt-1">{f.body}</p>
            <a href={f.href} target="_blank" rel="noreferrer" className="inline-block text-[11px] font-bold text-indigo-700 hover:underline mt-1">
              {f.source}
            </a>
          </div>
        </li>
      ))}
    </ul>
  </details>
);

export default Plan;
