/**
 * Personal Windows build: features stripped from the app.
 *
 * Disabling here hides their UI. The services/plugins are also excluded from the bundle via
 * literal glob negations (import.meta.glob can't read variables) — keep these in sync:
 *   - src/main/core/baseCollection.ts   (main-process services)
 *   - src/preload/pluginManager.ts      (YouTube page plugins: lyrics)
 */
export const PERSONAL_DISABLED = {
	discord: true,
	lastfm: true,
	/** Local API server: OBS embeds, Stream Deck, remote, API auth clients. */
	api: true,
	lyrics: true,
	chromecast: true,
} as const;

export type PersonalFeature = keyof typeof PERSONAL_DISABLED;
export const isFeatureEnabled = (feature: PersonalFeature): boolean => !PERSONAL_DISABLED[feature];
