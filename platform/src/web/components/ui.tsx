import { useState, type CSSProperties, type ReactNode } from 'react';
import type { Branding, ReportReason } from '../../core/types';
import { REPORT_REASONS } from '../../core/types';
import { api, mediaUrl } from '../api';

/** Sets the brand color for everything inside. */
export function brandStyle(b: Branding): CSSProperties {
  // Tailwind's bg-brand, text-brand etc. read --color-brand, so overriding it here recolors everything inside.
  return b.color ? ({ '--color-brand': b.color } as CSSProperties) : {};
}

/** The teacher's top bar: logo or initial, title, note and badge. */
export function BrandBar({ branding, fallbackTitle, right }: { branding: Branding; fallbackTitle: string; right?: ReactNode }) {
  const title = branding.title || fallbackTitle;
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-brand px-4 py-3 text-white shadow-sm" style={brandStyle(branding)}>
      {branding.logoMediaId ? (
        <img src={mediaUrl(branding.logoMediaId)} alt="" className="h-10 w-10 rounded-xl bg-white object-cover" />
      ) : (
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/20 text-lg font-bold">{title.slice(0, 1).toUpperCase()}</span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold">{title}</span>
          {branding.badge && <span className="shrink-0 rounded-full bg-white/25 px-2 py-0.5 text-xs font-semibold">{branding.badge}</span>}
        </div>
        {branding.note && <div className="truncate text-sm text-white/85">{branding.note}</div>}
      </div>
      {right}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint, changed }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; changed?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-2">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-slate-300 transition peer-checked:bg-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" />
      <span>
        <span className="font-medium">{label}</span>
        {changed && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">changed</span>}
        {hint && <span className="block text-sm text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}

export function Choice<T extends string>({ value, options, onChange, label, hint, changed }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string; hint?: string; changed?: boolean }) {
  return (
    <div className="py-2">
      <div className="font-medium">
        {label}
        {changed && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">changed</span>}
      </div>
      {hint && <div className="text-sm text-slate-500">{hint}</div>}
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o.value} type="button" onClick={() => onChange(o.value)} className={`rounded-xl border px-3 py-1.5 text-sm ${o.value === value ? 'border-brand bg-brand text-white' : 'border-slate-300 bg-white hover:bg-slate-50'}`}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ErrorNote({ error }: { error?: string | null }) {
  if (!error) return null;
  return <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>;
}

export function StatusBadge({ status }: { status: string }) {
  if (status === 'active') return null;
  const cls = status === 'hidden' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800';
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{status === 'hidden' ? 'Hidden' : 'Under review'}</span>;
}

const REASON_LABEL: Record<ReportReason, string> = {
  spam: 'Spam or advertising',
  offensive: 'Rude or harmful',
  wrong: 'Wrong translation',
  copyright: 'Copied without permission',
  other: 'Something else',
};

/** "Report" button with a small form. Works for guests too. */
export function ReportButton({ targetType, targetId, label = 'Report', className = '' }: { targetType: 'deck' | 'card'; targetId: string; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>('wrong');
  const [note, setNote] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setError(null);
    try {
      const r = await api.report({ targetType, targetId, reason, note: note || undefined });
      setDone(r.status === 'active' ? 'Thanks, we got your report.' : 'Thanks. This is now under review.');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <button type="button" className={`text-sm text-slate-500 underline-offset-2 hover:text-red-700 hover:underline ${className}`} onClick={() => setOpen(true)}>
        ⚑ {label}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">Report this {targetType}</h3>
            {done ? (
              <>
                <p className="mt-3 text-slate-700">{done}</p>
                <button className="btn-primary mt-4 w-full" onClick={() => setOpen(false)}>
                  Close
                </button>
              </>
            ) : (
              <>
                <div className="mt-3 space-y-1">
                  {REPORT_REASONS.map((r) => (
                    <label key={r} className="flex items-center gap-2 py-1">
                      <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} />
                      {REASON_LABEL[r]}
                    </label>
                  ))}
                </div>
                <textarea className="input mt-3" rows={2} maxLength={500} placeholder="Anything to add? (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
                <ErrorNote error={error} />
                <div className="mt-4 flex gap-2">
                  <button className="btn-ghost flex-1" onClick={() => setOpen(false)}>
                    Cancel
                  </button>
                  <button className="btn-primary flex-1" onClick={send}>
                    Send report
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export function Spinner() {
  return <div className="py-16 text-center text-slate-400">Loading…</div>;
}
