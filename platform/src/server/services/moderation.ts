/**
 * Light guardrails: anyone (guests too) can report a deck or card; enough
 * reports from different people flag it, more hide it until an admin looks.
 *
 *   active  -> normal
 *   flagged -> still works, shows "under review", appears in the admin queue
 *   hidden  -> gone for learners (its code says "not found")
 */
import { REPORT_REASONS, type ModerationStatus, type ReportTarget } from '../../core/types';
import type { CreatorStore, DeckStore, ModerationService, RateLimiter, ReportStore } from '../ports';

/** Open reports from different people that flag a target. */
export const FLAG_AT = 3;
/** Open reports from different people that hide a target until an admin reviews it. */
export const HIDE_AT = 10;
export const REPORT_LIMIT = { count: 20, windowMs: 60 * 60 * 1000 };

export class ModerationError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 429 = 400
  ) {
    super(message);
    this.name = 'ModerationError';
  }
}

export function createModerationService(deps: { decks: DeckStore; creators: CreatorStore; reports: ReportStore; limiter: RateLimiter }): ModerationService {
  const { decks, reports, limiter } = deps;

  async function target(type: ReportTarget, id: string) {
    if (type === 'deck') {
      const deck = await decks.getById(id);
      return deck ? { deckId: deck.id, status: deck.moderationStatus, title: deck.title, code: deck.code } : null;
    }
    const card = await decks.getCard(id);
    if (!card) return null;
    const deck = await decks.getById(card.deckId);
    return { deckId: card.deckId, status: card.moderationStatus, title: `${card.term} — ${card.meaning}`, code: deck?.code };
  }

  async function setStatus(type: ReportTarget, id: string, status: ModerationStatus) {
    if (type === 'deck') await decks.update(id, { moderationStatus: status });
    else await decks.setCardStatus(id, status);
  }

  return {
    async report({ targetType, targetId, reason, note, reporterId, reporterKey }) {
      if (!REPORT_REASONS.includes(reason)) throw new ModerationError('Pick a reason.');
      const found = await target(targetType, targetId);
      if (!found) throw new ModerationError('Nothing to report here.', 404);
      const limit = await limiter.hit(`report:${reporterKey}`, REPORT_LIMIT.count, REPORT_LIMIT.windowMs);
      if (!limit.ok) throw new ModerationError('Too many reports. Try again later.', 429);

      const report = await reports.create({ targetType, targetId, deckId: found.deckId, reason, note: note?.trim().slice(0, 500) || undefined, reporterId });
      // Count people, not clicks: one person reporting twice counts once.
      const open = await reports.countOpen(targetType, targetId);
      let status = found.status;
      if (status !== 'hidden' && open >= HIDE_AT) status = 'hidden';
      else if (status === 'active' && open >= FLAG_AT) status = 'flagged';
      if (status !== found.status) await setStatus(targetType, targetId, status);
      return { report, status };
    },

    async setStatus(targetType, targetId, status) {
      if (!(await target(targetType, targetId))) throw new ModerationError('Not found.', 404);
      await setStatus(targetType, targetId, status);
      // A decision closes the open reports, so the count starts fresh.
      await reports.resolveForTarget(targetType, targetId);
    },

    async queue() {
      const open = await reports.listOpen();
      const out = [];
      for (const r of open) {
        const t = await target(r.targetType, r.targetId);
        if (t) out.push({ ...r, targetTitle: t.title, deckCode: t.code, targetStatus: t.status });
      }
      return out;
    },
  };
}
