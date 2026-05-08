import { Palette } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { themeLabels, themeNames, type ThemeName } from "../../theme/tokens";

interface ThemePickerProps {
  compact?: boolean;
}

export function ThemePicker({ compact = false }: ThemePickerProps) {
  const { theme, setTheme, zoomLevel, setZoomLevel } = useTheme();

  if (compact) {
    return (
      <div className="w-full space-y-3">
        <div>
          <label className="sr-only" htmlFor="theme-picker-compact">
            Theme
          </label>
          <select
            id="theme-picker-compact"
            value={theme}
            onChange={(event) => setTheme(event.target.value as ThemeName)}
            className="w-full rounded-lg border border-border-default bg-surface-card px-3 py-2 text-xs font-medium text-text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {themeNames.map((name) => (
              <option key={name} value={name}>
                {themeLabels[name]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="sr-only" htmlFor="zoom-picker-compact">
            Zoom
          </label>
          <select
            id="zoom-picker-compact"
            value={zoomLevel}
            onChange={(event) => setZoomLevel(Number(event.target.value))}
            className="w-full rounded-lg border border-border-default bg-surface-card px-3 py-2 text-xs font-medium text-text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value={0.8}>80%</option>
            <option value={0.9}>90%</option>
            <option value={1}>100%</option>
          </select>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border-default bg-surface-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Palette className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-text-primary">
          Appearance Theme
        </h3>
      </div>
      <div className="space-y-2">
        {themeNames.map((name) => {
          const selected = name === theme;
          return (
            <button
              key={name}
              onClick={() => setTheme(name)}
              className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                selected
                  ? "border-primary bg-primary-muted text-primary shadow-sm"
                  : "border-border-default bg-surface-card text-text-secondary hover:bg-surface-raised"
              }`}
              type="button"
            >
              <span className="font-medium flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    name === "shadcn-admin"
                      ? "bg-blue-500"
                      : name === "tailadmin"
                        ? "bg-indigo-500"
                        : name === "horizon-ui"
                          ? "bg-violet-500"
                      : name === "berry-dashboard"
                            ? "bg-purple-500"
                            : name === "mantis"
                              ? "bg-green-500"
                              : "bg-cyan-500"
                  }`}
                />
                {themeLabels[name]}
              </span>
              {selected && (
                <span className="text-xs font-semibold">Active</span>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-4 border-t border-border-default pt-4">
        <label
          htmlFor="zoom-picker"
          className="mb-2 block text-sm font-semibold text-text-primary"
        >
          Interface Zoom
        </label>
        <select
          id="zoom-picker"
          value={zoomLevel}
          onChange={(event) => setZoomLevel(Number(event.target.value))}
          className="w-full rounded-xl border border-border-default bg-surface-card px-3 py-2.5 text-sm font-medium text-text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value={0.8}>80% - Compact</option>
          <option value={0.9}>90% - Balanced</option>
          <option value={1}>100% - Standard</option>
        </select>
      </div>
    </div>
  );
}
