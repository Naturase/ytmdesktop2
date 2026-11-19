/**
 * Personal build: Chromium/Electron performance profile.
 *
 * Env overrides (useful for A/B measuring with YTMD_METRICS=1):
 *   YTMD_PERF_LEGACY=1     restore the original upstream flags (no throttling anywhere, GPU blocklist ignored, …)
 *   YTMD_THROTTLE_YTM=1    also let the YouTube Music view be throttled while hidden (experimental)
 *   YTMD_V8_HEAP_MB=<n>    renderer V8 old-space limit in MB (default 512, 0 = no limit)
 *   YTMD_ALLOW_MEDIA_DEVICES=1  don't stub navigator.mediaDevices in the YouTube page
 *
 * Read from process.env, so it works in main and in (non-sandboxed) preloads.
 */
const env = (key: string): string | undefined => (typeof process !== "undefined" ? process.env?.[key] : undefined);

export const perfLegacy = env("YTMD_PERF_LEGACY") === "1";

export const perfProfile = {
	legacy: perfLegacy,
	/** Allow Chromium to throttle hidden auxiliary views (toolbar, loading, root window). */
	throttleAuxViews: !perfLegacy,
	/**
	 * YouTube Music view stays unthrottled by default: audible pages are exempt anyway, but track
	 * transitions / queue continuation run on timers while briefly silent.
	 */
	throttleYoutubeView: !perfLegacy && env("YTMD_THROTTLE_YTM") === "1",
	/** Renderer V8 old-space limit (MB). Too low = renderer OOM (white page) on long queues. */
	v8HeapMb: perfLegacy ? 0 : Math.max(0, Number(env("YTMD_V8_HEAP_MB") ?? 512) || 0),
	/** YTM enumerates media devices, which spawns a Chromium "Video Capture" utility process. */
	stubMediaDevices: !perfLegacy && env("YTMD_ALLOW_MEDIA_DEVICES") !== "1",
} as const;
