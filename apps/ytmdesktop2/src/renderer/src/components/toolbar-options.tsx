import DevIcon from "@/assets/icons/chip.svg?react";
import HomeIcon from "@/assets/icons/home.svg?react";
import { useNavigation } from "@/hooks/use-navigation";
import { useSettingsState } from "@/hooks/use-settings";
import { trpc } from "@/lib/trpc";

/** Personal build: Last.fm, Discord and updater buttons removed. */
export function ToolbarOptions() {
	const { isHome, home, devTools } = useNavigation();
	const [isDev] = useSettingsState<boolean>("app.enableDev", false);
	const { mutateAsync: openWindow } = trpc.app.openWindow.useMutation();

	return (
		<div className="flex flex-row items-center gap-2">
			{!isHome && (
				<button type="button" className="control-button relative size-4" onClick={() => void home()}>
					<HomeIcon />
				</button>
			)}
			{isDev && (
				<button type="button" className="control-button relative size-4" onClick={() => void devTools()}>
					<DevIcon />
				</button>
			)}
			<button type="button" className="control-button" onClick={() => void openWindow("settingsWindow")}>
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
					<path
						fillRule="evenodd"
						d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
						clipRule="evenodd"
					/>
				</svg>
			</button>
		</div>
	);
}
