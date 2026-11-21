import type { VocabItem } from '../types';

const TOAST_EVENT = 'vocab:toast';

/** Show a short note at the bottom of the screen (the app renders it). */
export function toast(text: string): void {
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: text }));
}

export function onToast(listener: (text: string) => void): () => void {
  const handler = (e: Event) => listener(String((e as CustomEvent).detail));
  window.addEventListener(TOAST_EVENT, handler);
  return () => window.removeEventListener(TOAST_EVENT, handler);
}

/** A card as plain text. Before the answer is shown, only the question side. */
export function cardText(word: VocabItem, side: 'korean' | 'meaning' | 'full'): string {
  const head = word.rom ? `${word.ko} (${word.rom})` : word.ko;
  const meaning = `${word.en} / ${word.hi}`;
  if (side === 'korean') return word.ko;
  if (side === 'meaning') return meaning;
  const examples = (word.examples ?? []).map((ex) => `${ex.ko} — ${ex.hi}`);
  return [`${head} — ${meaning}`, ...examples].join('\n');
}

/** Copy text and say so. Falls back to a hidden text box where the clipboard API is blocked. */
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const box = document.createElement('textarea');
    box.value = text;
    box.style.position = 'fixed';
    box.style.opacity = '0';
    document.body.appendChild(box);
    box.select();
    const ok = document.execCommand('copy');
    box.remove();
    if (!ok) {
      toast('Copy is blocked in this browser');
      return;
    }
  }
  toast('Copied');
}
