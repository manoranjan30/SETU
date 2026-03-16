import { Palette } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { themeLabels, themeNames, type ThemeName } from "../../theme/tokens";

interface ThemePickerProps {
  compact?: boolean;
}

export function ThemePicker({ compact = false }: ThemePickerProps) {
  const { theme, setTheme } = useTheme();

  if (compact) {
    return (
      <div className="w-full">
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
    </div>
  );
}
