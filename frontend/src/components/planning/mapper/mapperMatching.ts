export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export type SuggestionMatch = {
  tokenMatches: string[];
  segmentMatches: string[];
  locationMatches: string[];
};

export type ActivitySuggestion = {
  activity: any;
  score: number;
  treePath: string;
  branchPath: string;
  confidence: ConfidenceLevel;
  matches: SuggestionMatch;
  learned?: {
    activityPatternHits: number;
    branchPatternHits: number;
    totalBoost: number;
    activityTokens: string[];
    branchTokens: string[];
    activityLocations: string[];
    branchLocations: string[];
  } | null;
};

export type IndexedActivitySuggestionTarget = {
  activity: any;
  treePath: string;
  branchPath: string;
  context: ReturnType<typeof buildMapperContext>;
};

export type LearnedMappingPatternIndex = {
  byActivityId: Map<
    number,
    {
      tokens: Set<string>;
      locations: Set<string>;
      count: number;
    }
  >;
  byBranchPath: Map<
    string,
    {
      tokens: Set<string>;
      locations: Set<string>;
      count: number;
    }
  >;
};

const NUMBER_WORDS: Record<string, number> = {
  ground: 0,
  zeroth: 0,
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
  seventeenth: 17,
  eighteenth: 18,
  nineteenth: 19,
  twentieth: 20,
};

const toOrdinal = (value: number) => {
  if (value === 0) return "ground";
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
};

const canonicalizeConstructionText = (value: string) => {
  let text = ` ${value.toLowerCase()} `;

  const replacements: Array<[RegExp, string]> = [
    [/\bgrnd\b/g, " ground "],
    [/\bgf\b/g, " ground floor "],
    [/\bff\b/g, " first floor "],
    [/\bsf\b/g, " second floor "],
    [/\btf\b/g, " third floor "],
    [/\bflr\b/g, " floor "],
    [/\blvl\b/g, " level "],
    [/\bblk\b/g, " block "],
    [/\btwr\b/g, " tower "],
    [/\bbsm?t\b/g, " basement "],
    [/\bstlt\b/g, " stilt "],
    [/\brcc\b/g, " reinforced cement concrete rcc "],
    [/\bpcc\b/g, " plain cement concrete pcc "],
    [/\brebar\b/g, " reinforcement steel rebar "],
    [/\bfe ?500\b/g, " reinforcement steel fe500 "],
    [/\bshuttering\b/g, " formwork shuttering "],
    [/\bcentering\b/g, " formwork centering "],
    [/\bbrick work\b/g, " brickwork "],
    [/\bblock work\b/g, " blockwork "],
    [/\bwater proofing\b/g, " waterproofing "],
    [/\bmep\b/g, " mechanical electrical plumbing mep "],
    [/\be&m\b/g, " electrical mechanical "],
  ];

  replacements.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });

  Object.entries(NUMBER_WORDS).forEach(([word, number]) => {
    const ordinal = toOrdinal(number);
    text = text.replace(
      new RegExp(`\\b${word}\\s+floor\\b`, "g"),
      ` ${ordinal} floor ${word} floor `,
    );
    text = text.replace(
      new RegExp(`\\bfloor\\s+${word}\\b`, "g"),
      ` ${ordinal} floor ${word} floor `,
    );
    text = text.replace(
      new RegExp(`\\b${word}\\s+level\\b`, "g"),
      ` ${ordinal} floor ${word} level `,
    );
    text = text.replace(
      new RegExp(`\\b${word}\\b`, "g"),
      ` ${word} ${ordinal} `,
    );
  });

  text = text.replace(/\b(\d+)\s*(?:st|nd|rd|th)?\s*fl(?:oor)?\b/g, "$1 floor ");
  text = text.replace(/\b(\d+)\s*(?:st|nd|rd|th)?\s*lvl\b/g, "$1 floor ");
  text = text.replace(/\b(\d+)\s*(?:st|nd|rd|th)?\b/g, (_match, digits) => {
    const valueNumber = Number(digits);
    if (!Number.isFinite(valueNumber)) return digits;
    return ` ${digits} ${toOrdinal(valueNumber)} `;
  });

  return text.replace(/\s+/g, " ").trim();
};

export const normalizeMapperText = (value: string) =>
  canonicalizeConstructionText(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);

export const splitHierarchySegments = (value: string) =>
  canonicalizeConstructionText(value)
    .split(">")
    .map((segment) => segment.trim().toLowerCase())
    .filter(Boolean);

export const extractLocationPhrases = (value: string) => {
  const text = canonicalizeConstructionText(value);
  const matches = new Set<string>();
  const patterns = [
    /\bblock[\s-]*[a-z0-9]+\b/g,
    /\btower[\s-]*[a-z0-9]+\b/g,
    /\bwing[\s-]*[a-z0-9]+\b/g,
    /\b\d+(?:st|nd|rd|th)?\s+floor\b/g,
    /\bground floor\b/g,
    /\bbasement[\s-]*\d*\b/g,
    /\bstilt\b/g,
    /\bpodium\b/g,
  ];

  patterns.forEach((pattern) => {
    const found = text.match(pattern) || [];
    found.forEach((match) => matches.add(match.trim()));
  });

  return Array.from(matches);
};

export const deriveBranchPath = (treePath: string) => {
  const parts = treePath
    .split(">")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length <= 1) return treePath;

  let lastLocationIndex = -1;
  parts.forEach((part, index) => {
    if (
      /\b(block|tower|wing|floor|ground floor|basement|stilt|podium)\b/i.test(
        canonicalizeConstructionText(part),
      )
    ) {
      lastLocationIndex = index;
    }
  });

  if (lastLocationIndex >= 0) {
    return parts.slice(0, lastLocationIndex + 1).join(" > ");
  }

  return parts.slice(0, Math.max(1, parts.length - 1)).join(" > ");
};

export const buildMapperContext = (parts: Array<string | undefined>) => {
  const fullText = parts.filter(Boolean).join(" > ");
  return {
    fullText,
    tokens: Array.from(new Set(normalizeMapperText(fullText))),
    segments: Array.from(new Set(splitHierarchySegments(fullText))),
    locationPhrases: Array.from(new Set(extractLocationPhrases(fullText))),
  };
};

export const scoreMapperContexts = (
  source: ReturnType<typeof buildMapperContext>,
  target: ReturnType<typeof buildMapperContext>,
): { score: number; matches: SuggestionMatch } => {
  const tokenMatches = source.tokens.filter((token) =>
    target.tokens.includes(token),
  );
  const segmentMatches = source.segments.filter((segment) =>
    target.segments.some(
      (targetSegment) =>
        targetSegment.includes(segment) || segment.includes(targetSegment),
    ),
  );
  const locationMatches = source.locationPhrases.filter((phrase) =>
    target.locationPhrases.some(
      (targetPhrase) =>
        targetPhrase.includes(phrase) || phrase.includes(targetPhrase),
    ),
  );

  const civilsBoost = tokenMatches.filter((token) =>
    [
      "rcc",
      "pcc",
      "reinforcement",
      "steel",
      "formwork",
      "shuttering",
      "blockwork",
      "brickwork",
      "waterproofing",
      "excavation",
      "plaster",
      "column",
      "beam",
      "slab",
      "footing",
      "raft",
      "masonry",
      "concrete",
    ].includes(token),
  ).length;

  let score =
    tokenMatches.length +
    segmentMatches.length * 4 +
    locationMatches.length * 10 +
    civilsBoost * 2;

  if (source.locationPhrases.length > 0 && locationMatches.length === 0) {
    score -= 10;
  }

  return {
    score,
    matches: {
      tokenMatches,
      segmentMatches,
      locationMatches,
    },
  };
};

export const getConfidenceFromSuggestion = (
  score: number,
  matches: SuggestionMatch,
): ConfidenceLevel => {
  if (matches.locationMatches.length >= 2 || score >= 26) return "HIGH";
  if (matches.locationMatches.length >= 1 || score >= 14) return "MEDIUM";
  return "LOW";
};

export const computeActivitySuggestions = ({
  activities,
  sourceParts,
  getTreePath,
  limit = 8,
}: {
  activities: any[];
  sourceParts: Array<string | undefined>;
  getTreePath: (id?: number) => string;
  limit?: number;
}): ActivitySuggestion[] => {
  const sourceContext = buildMapperContext(sourceParts);
  if (sourceContext.tokens.length === 0) return [];

  return activities
    .map((activity) => {
      const treePath = getTreePath(activity.wbsNode?.id || activity.wbsNodeId);
      const targetContext = buildMapperContext([
        activity.activityCode,
        activity.activityName,
        activity.wbsNode?.wbsCode,
        activity.wbsNode?.wbsName,
        treePath,
      ]);
      const result = scoreMapperContexts(sourceContext, targetContext);
      return {
        activity,
        score: result.score,
        treePath,
        branchPath: deriveBranchPath(treePath),
        confidence: getConfidenceFromSuggestion(result.score, result.matches),
        matches: result.matches,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
};

export const buildActivitySuggestionIndex = ({
  activities,
  getTreePath,
}: {
  activities: any[];
  getTreePath: (id?: number) => string;
}): IndexedActivitySuggestionTarget[] => {
  return activities.map((activity) => {
    const treePath = getTreePath(activity.wbsNode?.id || activity.wbsNodeId);
    return {
      activity,
      treePath,
      branchPath: deriveBranchPath(treePath),
      context: buildMapperContext([
        activity.activityCode,
        activity.activityName,
        activity.wbsNode?.wbsCode,
        activity.wbsNode?.wbsName,
        treePath,
      ]),
    };
  });
};

export const computeActivitySuggestionsFromIndex = ({
  indexedActivities,
  sourceParts,
  limit = 8,
  learnedPatternIndex,
}: {
  indexedActivities: IndexedActivitySuggestionTarget[];
  sourceParts: Array<string | undefined>;
  limit?: number;
  learnedPatternIndex?: LearnedMappingPatternIndex;
}): ActivitySuggestion[] => {
  const sourceContext = buildMapperContext(sourceParts);
  if (sourceContext.tokens.length === 0) return [];

  return indexedActivities
    .map((entry) => {
      const result = scoreMapperContexts(sourceContext, entry.context);
      let learnedBoost = 0;

      if (learnedPatternIndex) {
        const activityPattern = learnedPatternIndex.byActivityId.get(entry.activity.id);
        let activityPatternHits = 0;
        let branchPatternHits = 0;
        let activityTokens: string[] = [];
        let branchTokens: string[] = [];
        let activityLocations: string[] = [];
        let branchLocations: string[] = [];
        if (activityPattern) {
          const tokenMatches = sourceContext.tokens.filter((token) =>
            activityPattern.tokens.has(token),
          );
          const locationMatches = sourceContext.locationPhrases.filter((phrase) =>
            activityPattern.locations.has(phrase),
          );
          const tokenHits = tokenMatches.length;
          const locationHits = locationMatches.length;
          activityPatternHits = tokenHits + locationHits;
          activityTokens = tokenMatches.slice(0, 4);
          activityLocations = locationMatches.slice(0, 3);
          learnedBoost += tokenHits * 2 + locationHits * 8 + Math.min(6, activityPattern.count);
        }

        const branchPattern = learnedPatternIndex.byBranchPath.get(entry.branchPath);
        if (branchPattern) {
          const tokenMatches = sourceContext.tokens.filter((token) =>
            branchPattern.tokens.has(token),
          );
          const locationMatches = sourceContext.locationPhrases.filter((phrase) =>
            branchPattern.locations.has(phrase),
          );
          const tokenHits = tokenMatches.length;
          const locationHits = locationMatches.length;
          branchPatternHits = tokenHits + locationHits;
          branchTokens = tokenMatches.slice(0, 4);
          branchLocations = locationMatches.slice(0, 3);
          learnedBoost += tokenHits + locationHits * 5 + Math.min(4, branchPattern.count);
        }

        const boostedScore = result.score + learnedBoost;
        return {
          activity: entry.activity,
          score: boostedScore,
          treePath: entry.treePath,
          branchPath: entry.branchPath,
          confidence: getConfidenceFromSuggestion(boostedScore, result.matches),
          matches: result.matches,
          learned:
            learnedBoost > 0
              ? {
                  activityPatternHits,
                  branchPatternHits,
                  totalBoost: learnedBoost,
                  activityTokens,
                  branchTokens,
                  activityLocations,
                  branchLocations,
                }
              : null,
        };
      }

      return {
        activity: entry.activity,
        score: result.score + learnedBoost,
        treePath: entry.treePath,
        branchPath: entry.branchPath,
        confidence: getConfidenceFromSuggestion(
          result.score + learnedBoost,
          result.matches,
        ),
        matches: result.matches,
        learned: null,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
};
