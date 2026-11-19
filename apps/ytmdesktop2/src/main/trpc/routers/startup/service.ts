import { platform } from "@electron-toolkit/utils";
import { AfterInit, BaseProvider, BeforeStart } from "@main/core/baseProvider";
import { isDevelopment, isProduction } from "@main/infra/devUtils";
import SettingsProvider from "@main/trpc/routers/settings/service";
import { trackService } from "@main/trpc/routers/track";
import { perfProfile } from "@shared/perfProfile";
import { logger } from "@shared/utils/console";
import { App, powerSaveBlocker } from "electron";
import { basename } from "path";

const GTK_VERSION = /^[2-4]+$/.test(process.env.GTK_VERSION ?? "") ? process.env.GTK_VERSION : "3";

export default class StartupProvider extends BaseProvider implements AfterInit, BeforeStart {
	get settingsInstance(): SettingsProvider {
		return this.getProvider("settings");
	}
	get isEnabled() {
		return !!this.settingsInstance.instance?.app?.autostart;
	}
	get isInitialMinimized() {
		return !!this.settingsInstance.instance?.app?.autostartMinimized;
	}
	constructor(private app: App) {
		super("startup");
		const { legacy, v8HeapMb } = perfProfile;
		if (platform.isWindows) {
			app.commandLine.appendSwitch("enable-gpu-rasterization"); // may fix large playlist / ui only hang issue
			// Legacy forced GPU on blocklisted drivers; personal build lets Chromium decide.
			if (legacy) app.commandLine.appendSwitch("ignore-gpu-blocklist");
		}
		if (legacy) {
			// Upstream: keep every renderer off Chromium background/EcoQoS throttling.
			app.commandLine.appendSwitch("disable-renderer-backgrounding");
			app.commandLine.appendSwitch("disable-background-timer-throttling");
			app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");
		}
		// Personal build: the YouTube view opts out per-webContents (backgroundThrottling: false) and
		// audible renderers are never backgrounded, so playback is unaffected; hidden toolbar/tray/
		// settings renderers may now be throttled and moved to efficiency cores (EcoQoS).
		if (v8HeapMb > 0) app.commandLine.appendSwitch("js-flags", `--max-old-space-size=${v8HeapMb}`);
		if (isDevelopment) app.commandLine.appendSwitch("disable-web-security");
		// OS HiDPI / deviceScaleFactor (Retina, Windows 125%/150%). Do not force-device-scale-factor —
		// that freezes layout at 1× and breaks high-DPI. Page zoom for app chrome is locked separately.
		app.commandLine.appendSwitch("high-dpi-support", "1");
		if (platform.isLinux && GTK_VERSION) this.app.commandLine.appendSwitch("gtk-version", GTK_VERSION);
		if (platform.isLinux) this.app.commandLine.appendSwitch("ozone-platform-hint", "auto");
		this.app.commandLine.appendSwitch(
			"enable-features",
			[
				"OverlayScrollbar",
				"FluentOverlayScrollbar",
				"CanvasOopRasterization",
				"SharedArrayBuffer",
				platform.isLinux && ["UseOzonePlatform", "WaylandWindowDecorations", "GlobalShortcutsPortal"],
			]
				.flat()
				.filter(Boolean)
				.join(","),
		);
		this.app.commandLine.appendSwitch(
			"disable-features",
			[
				// Personal build: occlusion detection + EcoQoS allowed (stop painting covered windows,
				// efficiency cores for background renderers). Legacy disabled both.
				legacy && "CalculateNativeWinOcclusion",
				legacy && "UseEcoQoSForBackgroundProcess",
				"IntensiveWakeUpThrottling", // 1 wake-up/min after 5 min hidden is too aggressive for queue logic
				"MediaSessionService", // xosms / OS media keys — keep out of Chromium MediaSession
				!legacy && "SpareRendererForSitePerProcess", // no pre-spawned idle renderer
			]
				.filter(Boolean)
				.join(","),
		);
		logger.info("perf profile", perfProfile);
	}
	async BeforeStart() {
		if (this.settingsInstance.instance.app.disableHardwareAccel) this.app.disableHardwareAcceleration();
	}
	/** Personal build: block system sleep only while audio is playing (was: always while app open). */
	private _sleepBlockerId: number | null = null;
	private _sleepBlockerWired = false;
	private setSleepBlocked(blocked: boolean) {
		if (blocked) {
			if (this._sleepBlockerId !== null && powerSaveBlocker.isStarted(this._sleepBlockerId)) return;
			this._sleepBlockerId = powerSaveBlocker.start("prevent-app-suspension");
		} else if (this._sleepBlockerId !== null) {
			if (powerSaveBlocker.isStarted(this._sleepBlockerId)) powerSaveBlocker.stop(this._sleepBlockerId);
			this._sleepBlockerId = null;
		}
	}
	private wireSleepBlocker() {
		if (platform.isMacOS || this._sleepBlockerWired) return;
		this._sleepBlockerWired = true;
		trackService.onTrackStateChange((state) => this.setSleepBlocked(!!state?.playing), { immediate: true });
		this.app.once("before-quit", () => this.setSleepBlocked(false));
	}
	private get startArgs() {
		return ["--processStart", `"${basename(process.execPath)}"`, "--startup"];
	}
	private _autostartWired = false;
	get isStartupContext() {
		return !!process.argv.find((arg) => arg === "--startup");
	}
	get isMinimizedArg() {
		return !!process.argv.find((arg) => arg === "--minimized");
	}
	async AfterInit() {
		this.wireSleepBlocker();
		if (this._autostartWired) return;
		this._autostartWired = true;
		this.settingsInstance.onSettingChange("app.autostart", (enabled) => void this.onAutoStartToggle("app.autostart", enabled as boolean), {
			debounce: 1000,
		});
		const app = this.settingsInstance.instance.app;
		if (isProduction) {
			if (app.autostart) {
				this.app.setLoginItemSettings({
					openAtLogin: true,
					path: process.execPath,
					args: this.startArgs,
				});
			} else {
				this.app.setLoginItemSettings({
					openAtLogin: false,
					args: this.startArgs,
				});
			}
		}
	}
	private async onAutoStartToggle(key: string, enabled: boolean) {
		if (enabled) {
			this.app.setLoginItemSettings({
				openAtLogin: true,
				path: process.execPath,
				args: this.startArgs,
			});
		} else {
			this.app.setLoginItemSettings({
				openAtLogin: false,
				args: this.startArgs,
			});
		}
	}
}
