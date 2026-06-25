export const QUALITY_OBSERVATION_RATINGS = [
  {
    value: "OFI",
    label: "Opportunity for Improvement",
    shortLabel: "OFI",
    severity: "INFO",
    description:
      "The observation would not affect finished product quality but provides scope for improvement.",
  },
  {
    value: "MINOR",
    label: "Minor",
    shortLabel: "Mi",
    severity: "MINOR",
    description:
      "The observation would not affect finished product quality or achievement of the quality system. Requirements would still be achieved.",
  },
  {
    value: "MODERATE",
    label: "Moderate",
    shortLabel: "Mo",
    severity: "MAJOR",
    description:
      "The observation may affect finished product quality, cause delays, or fail a quality process, while important requirements would still be met.",
  },
  {
    value: "MAJOR",
    label: "Major",
    shortLabel: "Ma",
    severity: "MAJOR",
    description:
      "The observation would fail one or more quality-system processes and may affect finished product quality. Secondary requirements may not be achieved.",
  },
  {
    value: "CRITICAL",
    label: "Critical",
    shortLabel: "C",
    severity: "CRITICAL",
    description:
      "The observation would fail the quality system and affect finished product quality or minimum acceptable requirements. It is automatically registered as an NCR.",
  },
] as const;

export type QualityObservationRating =
  (typeof QUALITY_OBSERVATION_RATINGS)[number]["value"];

export function getQualityObservationRating(value?: string | null) {
  const normalized = String(value || "").toUpperCase();
  return (
    QUALITY_OBSERVATION_RATINGS.find((item) => item.value === normalized) ||
    QUALITY_OBSERVATION_RATINGS[1]
  );
}
