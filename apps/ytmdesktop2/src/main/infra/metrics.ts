import { logger } from "@shared/utils/console";
import { app, webContents } from "electron";

/**
 * Personal build: periodic process metrics for measuring optimizations.
 * Enable with env `YTMD_METRICS=1` (optional `YTMD_METRICS_INTERVAL` in seconds, default 30).
 */
const log = logger.child("metrics");

function labelFor(pid: number): string | undefined {
	const wc = webContents.getAllWebContents().find((w) => !w.isDestroyed() && w.getOSProcessId() === pid);
	if (!wc) return undefined;
	try {
		const url = new URL(wc.getURL());
		return url.hostname || url.hash || url.pathname;
	} catch {
		return wc.getURL().slice(0, 60);
	}
}

export function startMetricsLogging() {
	if (process.env.YTMD_METRICS !== "1") return;
	const intervalSec = Math.max(5, Number(process.env.YTMD_METRICS_INTERVAL) || 30);

	const dump = () => {
		const metrics = app.getAppMetrics();
		let totalWs = 0;
		let totalPrivate = 0;
		let totalCpu = 0;
		const rows = metrics.map((m) => {
			const ws = m.memory.workingSetSize / 1024; // KB -> MB
			const priv = (m.memory.privateBytes ?? 0) / 1024;
			totalWs += ws;
			totalPrivate += priv;
			totalCpu += m.cpu.percentCPUUsage;
			return {
				pid: m.pid,
				type: m.type,
				name: m.name ?? labelFor(m.pid),
				wsMB: Math.round(ws),
				privMB: Math.round(priv),
				cpu: Number(m.cpu.percentCPUUsage.toFixed(1)),
			};
		});
		log.info(
			`procs=${metrics.length} ws=${Math.round(totalWs)}MB private=${Math.round(totalPrivate)}MB cpu=${totalCpu.toFixed(1)}%`,
		);
		for (const r of rows) log.info(`  ${r.type.padEnd(8)} pid=${r.pid} ws=${r.wsMB}MB priv=${r.privMB}MB cpu=${r.cpu}% ${r.name ?? ""}`);
	};

	app.whenReady().then(() => {
		log.info(`metrics logging every ${intervalSec}s`);
		const timer = setInterval(dump, intervalSec * 1000) as unknown as { unref?: () => void };
		timer.unref?.();
	});
}
