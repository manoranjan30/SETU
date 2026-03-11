import { chartPalettes, semanticChartColors, type ThemeName } from "./tokens";

export function getChartColors(theme: ThemeName): string[] {
  return chartPalettes[theme] ?? chartPalettes["shadcn-admin"];
}

export function getSemanticColors(theme: ThemeName): Record<string, string> {
  return semanticChartColors[theme] ?? semanticChartColors["shadcn-admin"];
}
