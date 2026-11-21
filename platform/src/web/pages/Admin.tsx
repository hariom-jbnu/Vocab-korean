import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import type { ModerationStatus } from '../../core/types';
import { api, type QueueItem } from '../api';
import { useSession } from '../session';
import { ErrorNote, Spinner, StatusBadge } from '../components/ui';

/** Admin queue: open reports grouped by what they point at, with Keep / Flag / Hide. */
export function AdminPage() {
  const { user, loading } = useSession();
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => api.reports().then((r) => setItems(r.reports), (e: Error) => setError(e.message));
  useEffect(() => {
    if (user?.role === 'admin') void load();
  }, [user]);

  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login?next=/admin" replace />;
  if (user.role !== 'admin') return <ErrorNote error="Only admins can see reports. Sign in as demo / demo1234 after seeding." />;
  if (error) return <ErrorNote error={error} />;
  if (!items) return <Spinner />;

  const groups = new Map<string, QueueItem[]>();
  for (const r of items) groups.set(`${r.targetType}:${r.targetId}`, [...(groups.get(`${r.targetType}:${r.targetId}`) ?? []), r]);

  async function decide(first: QueueItem, status: ModerationStatus) {
    setError(null);
    try {
      await api.setStatus({ targetType: first.targetType, targetId: first.targetId, status });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Reports</h1>
      <p className="text-sm text-slate-600">3 reports from different people flag a deck or card (“under review”); 10 hide it. Your decision closes its reports.</p>
      {groups.size === 0 && <div className="card text-center text-slate-600">No open reports. 🎉</div>}
      {[...groups.values()].map((list) => {
        const first = list[0];
        return (
          <div key={first.targetId} className="card space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase">{first.targetType}</span>
              <span className="font-semibold">{first.targetTitle}</span>
              <StatusBadge status={first.targetStatus} />
              {first.deckCode && (
                <Link to={`/p/${first.deckCode}`} className="font-mono text-sm text-brand underline">
                  {first.deckCode}
                </Link>
              )}
              <span className="ml-auto text-sm text-slate-500">{list.length} open</span>
            </div>
            <ul className="space-y-1 text-sm text-slate-700">
              {list.map((r) => (
                <li key={r.id}>
                  <b>{r.reason}</b>
                  {r.note ? `: ${r.note}` : ''} <span className="text-slate-400">· {new Date(r.createdAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <button className="btn-ghost" onClick={() => decide(first, 'active')}>
                Keep (active)
              </button>
              <button className="btn-ghost" onClick={() => decide(first, 'flagged')}>
                Mark under review
              </button>
              <button className="btn-danger" onClick={() => decide(first, 'hidden')}>
                Hide
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
