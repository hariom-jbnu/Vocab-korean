import type { Branding } from './types';

/** Creator branding with the deck's own branding on top: a filled deck field wins. */
export function mergeBranding(creator: Branding, deck: Branding): Branding {
  return { ...creator, ...Object.fromEntries(Object.entries(deck).filter(([, v]) => v)) };
}
