import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Activity } from '../wbs/entities/activity.entity';
import { WbsNode } from '../wbs/entities/wbs.entity';
import { EpsNode } from '../eps/eps.entity';
import { PlanningService } from './planning.service';

// ── Public types ──────────────────────────────────────────────────────────────

export interface SuggestionItem {
  epsNodeId: number;
  epsPath: string;
  confidence: number;
  matchedTokens: string[];
  tier: 'STRUCTURAL' | 'TOKEN' | 'BROADCAST';
}

export interface SmartDistributeSuggestion {
  activityId: number;
  activityCode: string;
  activityName: string;
  suggestions: SuggestionItem[];
  status: 'HIGH' | 'MEDIUM' | 'BROADCAST' | 'UNMATCHED';
}

// ── Preview types ─────────────────────────────────────────────────────────────

export interface FloorActivity {
  activityId: number;
  activityCode: string;
  activityName: string;
  // Abbreviated WBS ancestor chain: "Twr Equinox 3F › Super Str Works"
  // Frontend renders: wbsPath › activityName so the user can verify the full
  // ancestry of each activity at a glance.
  wbsPath: string;
  confidence: number;
  tier: string;
}

export interface BasicActivity {
  activityId: number;
  activityCode: string;
  activityName: string;
  wbsPath: string;
}

export interface EpsTreeNode {
  id: number;
  name: string;
  type: string;
  children: EpsTreeNode[];
  matchedActivities: FloorActivity[];
}

export interface PreviewResult {
  epsTree: EpsTreeNode[];
  broadcastActivities: BasicActivity[];
  unmatchedActivities: BasicActivity[];
  allLeafIds: number[];
  stats: { total: number; matched: number; broadcast: number; unmatched: number };
}

// ── Algorithm constants ───────────────────────────────────────────────────────

const BROADCAST_KEYWORDS = [
  'mobilization', 'demobilization', 'site prep', 'site preparation',
  'common work', 'common area', 'general work', 'administrative',
  'project management', 'hoarding', 'boundary wall',
  'temporary facility', 'utilities', 'infrastructure', 'overhead',
];

const STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'for', 'at', 'in', 'on', 'to', 'and', 'or',
  'is', 'are', 'was', 'be', 'with', 'by', 'from', 'as',
  'work', 'works', 'activity', 'activities',
]);

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class SmartDistributeService {
  constructor(
    @InjectRepository(Activity)
    private readonly activityRepo: Repository<Activity>,
    @InjectRepository(EpsNode)
    private readonly epsRepo: Repository<EpsNode>,
    private readonly planningService: PlanningService,
  ) {}

  // ── preview ───────────────────────────────────────────────────────────────
  // Auto-detects the project's EPS floor tree, builds WBS paths for every
  // activity, runs ancestor-aware 3-tier matching, and returns a floor-embedded
  // EPS tree ready for the frontend to render.

  async preview(projectId: number): Promise<PreviewResult> {
    // 1. Load full EPS node map
    const allEpsNodes = await this.epsRepo.find();
    const nodeMap = new Map(allEpsNodes.map((n) => [n.id, n]));

    const childrenMap = new Map<number, number[]>();
    for (const node of allEpsNodes) {
      if (node.parentId) {
        if (!childrenMap.has(node.parentId)) childrenMap.set(node.parentId, []);
        childrenMap.get(node.parentId)!.push(node.id);
      }
    }

    // 2. Load ALL activities for this project (masters + distributed clones)
    //    so we can exclude masters that have already been distributed.
    const activities = await this.activityRepo.find({
      where: { projectId },
      relations: [
        'wbsNode',
        'wbsNode.parent',
        'wbsNode.parent.parent',
        'wbsNode.parent.parent.parent',
        'wbsNode.parent.parent.parent.parent',
      ],
    });

    // Build a set of master IDs that already have at least one distributed clone.
    // A clone is any activity whose masterActivityId is non-null.
    const distributedMasterIds = new Set<number>(
      activities
        .filter((a) => a.masterActivityId != null)
        .map((a) => a.masterActivityId as number),
    );

    // Only surface masters that haven't been distributed yet.
    const masterActivities = activities.filter(
      (a) => !a.masterActivityId && !distributedMasterIds.has(a.id),
    );

    // 3. Collect leaf EPS nodes in this project's subtree
    const leafNodes: EpsNode[] = [];
    const findLeaves = (id: number) => {
      const children = childrenMap.get(id) || [];
      if (children.length === 0) {
        const n = nodeMap.get(id);
        if (n) leafNodes.push(n);
      } else {
        children.forEach((cId) => findLeaves(cId));
      }
    };
    (childrenMap.get(projectId) || []).forEach((cId) => findLeaves(cId));

    // 4. Precompute display path + structural IDs for every EPS leaf node
    //    Structural IDs come only from TOWER/BLOCK-type ancestors so generic
    //    numbers (e.g., "Floor 1") don't pollute the ancestor comparison.
    const epsDisplayPath = new Map<number, string>();
    const epsAncestorIds = new Map<number, Set<string>>();

    for (const leaf of leafNodes) {
      const chain: EpsNode[] = [];
      let cur = nodeMap.get(leaf.id);
      while (cur) {
        chain.unshift(cur);
        if (!cur.parentId) break;
        cur = nodeMap.get(cur.parentId);
      }
      // Display: last 3 levels
      epsDisplayPath.set(
        leaf.id,
        chain.slice(-3).map((n) => n.name).join(' › '),
      );
      // Structural IDs: TOWER only.
      // BLOCK is excluded because all towers in a project share the same block
      // parent (e.g., "1 BLOCK"), so its digit leaks into every tower's ID set
      // and creates false intersection matches across different wings/towers.
      const towerText = chain
        .filter((n) => n.type === 'TOWER')
        .map((n) => n.name)
        .join(' ');
      epsAncestorIds.set(leaf.id, this.extractDigitTokens(towerText));
    }

    // 5. Build WBS info per activity and run matching
    const floorActivityMap = new Map<number, FloorActivity[]>();
    const broadcastActivities: BasicActivity[] = [];
    const unmatchedActivities: BasicActivity[] = [];

    for (const activity of masterActivities) {
      const { displayPath: wbsPath, ancestorIds: wbsIds } =
        this.buildWbsInfo(activity);

      const match = this.matchActivity(
        activity,
        wbsIds,
        leafNodes,
        epsDisplayPath,
        epsAncestorIds,
      );

      if (match.status === 'BROADCAST') {
        broadcastActivities.push({
          activityId: activity.id,
          activityCode: activity.activityCode,
          activityName: activity.activityName,
          wbsPath,
        });
        continue;
      }

      const validSuggestions =
        match.status === 'HIGH'
          ? match.suggestions
          : match.suggestions.filter((s) => s.confidence >= 0.5);

      if (validSuggestions.length === 0) {
        unmatchedActivities.push({
          activityId: activity.id,
          activityCode: activity.activityCode,
          activityName: activity.activityName,
          wbsPath,
        });
        continue;
      }

      for (const suggestion of validSuggestions) {
        if (!floorActivityMap.has(suggestion.epsNodeId)) {
          floorActivityMap.set(suggestion.epsNodeId, []);
        }
        floorActivityMap.get(suggestion.epsNodeId)!.push({
          activityId: activity.id,
          activityCode: activity.activityCode,
          activityName: activity.activityName,
          wbsPath,
          confidence: suggestion.confidence,
          tier: suggestion.tier,
        });
      }
    }

    // 6. Assemble the EPS tree with activities embedded at each node
    const buildTree = (id: number): EpsTreeNode | null => {
      const node = nodeMap.get(id);
      if (!node) return null;
      const children = childrenMap.get(id) || [];
      return {
        id: node.id,
        name: node.name,
        type: node.type as string,
        children: children.map((cId) => buildTree(cId)).filter(Boolean) as EpsTreeNode[],
        matchedActivities: floorActivityMap.get(id) || [],
      };
    };

    const projectRootChildren = childrenMap.get(projectId) || [];
    const epsTree = projectRootChildren
      .map((cId) => buildTree(cId))
      .filter(Boolean) as EpsTreeNode[];

    // Unique matched activity count
    const matchedIds = new Set<number>();
    floorActivityMap.forEach((acts) => acts.forEach((a) => matchedIds.add(a.activityId)));

    return {
      epsTree,
      broadcastActivities,
      unmatchedActivities,
      allLeafIds: leafNodes.map((n) => n.id),
      stats: {
        total: masterActivities.length,
        matched: matchedIds.size,
        broadcast: broadcastActivities.length,
        unmatched: unmatchedActivities.length,
      },
    };
  }

  // ── suggest (kept for compatibility) ─────────────────────────────────────

  async suggest(
    projectId: number,
    targetEpsIds: number[],
  ): Promise<SmartDistributeSuggestion[]> {
    const activities = await this.activityRepo.find({ where: { projectId } });
    const masterActivities = activities.filter((a) => !a.masterActivityId);

    const allEpsNodes = await this.epsRepo.find();
    const nodeMap = new Map(allEpsNodes.map((n) => [n.id, n]));

    const childrenMap = new Map<number, number[]>();
    for (const node of allEpsNodes) {
      if (node.parentId) {
        if (!childrenMap.has(node.parentId)) childrenMap.set(node.parentId, []);
        childrenMap.get(node.parentId)!.push(node.id);
      }
    }

    const leafIds = new Set<number>();
    const findLeaves = (id: number) => {
      const children = childrenMap.get(id) || [];
      if (children.length === 0) leafIds.add(id);
      else children.forEach((cId) => findLeaves(cId));
    };
    targetEpsIds.forEach((id) => findLeaves(id));

    const buildPath = (id: number): string => {
      const parts: string[] = [];
      let current = nodeMap.get(id);
      while (current) {
        parts.unshift(current.name);
        if (!current.parentId) break;
        current = nodeMap.get(current.parentId);
      }
      return parts.join(' › ');
    };

    const leafNodes = [...leafIds].map((id) => nodeMap.get(id)!).filter(Boolean);
    const epsDisplayPath = new Map(leafNodes.map((n) => [n.id, buildPath(n.id)]));
    const epsAncestorIds = new Map<number, Set<string>>();
    for (const leaf of leafNodes) {
      epsAncestorIds.set(leaf.id, this.extractDigitTokens(buildPath(leaf.id)));
    }

    return masterActivities.map((activity) =>
      this.matchActivity(activity, new Set(), leafNodes, epsDisplayPath, epsAncestorIds),
    );
  }

  // ── commit ────────────────────────────────────────────────────────────────

  async commit(
    projectId: number,
    mappings: { activityId: number; epsNodeIds: number[] }[],
    user: any,
  ): Promise<{ created: number; skipped: number }> {
    let totalCreated = 0;
    let totalSkipped = 0;

    for (const mapping of mappings) {
      if (!mapping.epsNodeIds.length) continue;
      const result = await this.planningService.distributeActivitiesToEps(
        [mapping.activityId],
        mapping.epsNodeIds,
        user,
      );
      totalCreated += result.created || 0;
      totalSkipped += result.skipped || 0;
    }

    return { created: totalCreated, skipped: totalSkipped };
  }

  // ── WBS path builder ──────────────────────────────────────────────────────
  // Walks the wbsNode parent chain and returns:
  //   displayPath  — abbreviated ancestor names for UI rendering
  //   ancestorIds  — digit tokens from the top portion of the chain for
  //                  tower/block disambiguation during matching

  private buildWbsInfo(activity: Activity): {
    displayPath: string;
    ancestorIds: Set<string>;
  } {
    if (!activity.wbsNode) return { displayPath: '', ancestorIds: new Set() };

    const ancestors: string[] = [];
    let current: WbsNode | null = activity.wbsNode as WbsNode;
    while (current) {
      ancestors.unshift(current.wbsName);
      current = (current.parent as WbsNode) || null;
    }

    // Display: ALL ancestors, each truncated to 25 chars
    const abbrev = (s: string) =>
      s.length > 25 ? s.slice(0, 24) + '…' : s;
    const displayPath = ancestors.map(abbrev).join(' › ');

    // Matching IDs: skip root (index 0, project name has no useful digit),
    // use levels 1-2 where the wing/tower identifier lives (e.g., "Wing_1")
    const ancestorIds = this.extractDigitTokens(
      ancestors.slice(1, 3).join(' '),
    );

    return { displayPath, ancestorIds };
  }

  // ── Core matching ─────────────────────────────────────────────────────────

  private matchActivity(
    activity: Activity,
    wbsAncestorIds: Set<string>,
    targetNodes: EpsNode[],
    epsDisplayPath: Map<number, string>,
    epsAncestorIds: Map<number, Set<string>>,
  ): SmartDistributeSuggestion {
    const name = activity.activityName.toLowerCase();

    // Tier 3: Broadcast keywords → every floor
    if (BROADCAST_KEYWORDS.some((kw) => name.includes(kw))) {
      return {
        activityId: activity.id,
        activityCode: activity.activityCode,
        activityName: activity.activityName,
        suggestions: targetNodes.map((node) => ({
          epsNodeId: node.id,
          epsPath: epsDisplayPath.get(node.id) || node.name,
          confidence: 0.3,
          matchedTokens: [],
          tier: 'BROADCAST' as const,
        })),
        status: 'BROADCAST',
      };
    }

    // Tier 1: Structural match (activity name contains floor name) with
    //         ancestor-aware disambiguation
    const structural: SuggestionItem[] = [];
    for (const node of targetNodes) {
      const baseConf = this.structuralMatch(activity.activityName, node.name);
      if (baseConf >= 0.85) {
        const floorEpsIds = epsAncestorIds.get(node.id) || new Set();
        const multiplier = this.ancestorMultiplier(wbsAncestorIds, floorEpsIds);
        const finalConf = baseConf * multiplier;
        if (finalConf >= 0.5) {
          structural.push({
            epsNodeId: node.id,
            epsPath: epsDisplayPath.get(node.id) || node.name,
            confidence: finalConf,
            matchedTokens: [node.name],
            tier: 'STRUCTURAL',
          });
        }
      }
    }

    if (structural.length > 0) {
      return {
        activityId: activity.id,
        activityCode: activity.activityCode,
        activityName: activity.activityName,
        suggestions: structural.sort((a, b) => b.confidence - a.confidence),
        status: 'HIGH',
      };
    }

    // Tier 2: Token overlap (Jaccard)
    const token: SuggestionItem[] = [];
    for (const node of targetNodes) {
      const { score, matched } = this.jaccardSimilarity(
        activity.activityName,
        node.name,
      );
      if (score >= 0.25) {
        const floorEpsIds = epsAncestorIds.get(node.id) || new Set();
        const multiplier = this.ancestorMultiplier(wbsAncestorIds, floorEpsIds);
        const finalConf = score * multiplier;
        if (finalConf >= 0.25) {
          token.push({
            epsNodeId: node.id,
            epsPath: epsDisplayPath.get(node.id) || node.name,
            confidence: finalConf,
            matchedTokens: matched,
            tier: 'TOKEN',
          });
        }
      }
    }

    if (token.length > 0) {
      const top5 = token.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
      return {
        activityId: activity.id,
        activityCode: activity.activityCode,
        activityName: activity.activityName,
        suggestions: top5,
        status: top5[0].confidence >= 0.5 ? 'MEDIUM' : 'UNMATCHED',
      };
    }

    return {
      activityId: activity.id,
      activityCode: activity.activityCode,
      activityName: activity.activityName,
      suggestions: [],
      status: 'UNMATCHED',
    };
  }

  // ── Ancestor multiplier ───────────────────────────────────────────────────
  // Compares digit tokens extracted from the WBS ancestor chain against those
  // from the EPS TOWER/BLOCK ancestors.
  //
  // Rules:
  //  • Any common token  → 1.0  (same tower confirmed — keep confidence)
  //  • Distinct tokens and at least one side is "tower-style" (e.g. "T3", "3F")
  //                      → 0.05 (different tower — kill the match)
  //  • No info on either side → 1.0 (single-tower project — neutral)

  private ancestorMultiplier(
    wbsIds: Set<string>,
    epsIds: Set<string>,
  ): number {
    // No digit tokens on either side → can't disambiguate → neutral
    if (wbsIds.size === 0 || epsIds.size === 0) return 1.0;

    // Shared token (e.g. both have "1" from "Wing 1" / "Wing_1") → same tower
    const intersection = [...wbsIds].filter((id) => epsIds.has(id));
    if (intersection.length > 0) return 1.0;

    // Both sides carry distinct numeric/alphanumeric identifiers → different tower/wing
    // Applies to pure numerics ("1","2"), alphanumeric ("T3","3F"), and mixed
    return 0.05;
  }

  // ── Name matching helpers ─────────────────────────────────────────────────

  private structuralMatch(activityName: string, nodeName: string): number {
    const aLow = activityName.toLowerCase();
    const nLow = nodeName.toLowerCase();

    if (nLow.length >= 2 && aLow.includes(nLow)) return 0.95;

    // Single-digit floor names ("1"–"9"): match ordinal suffixes and prevent
    // adjacent-digit false positives (so "1" ≠ "10", "11", "21" etc.)
    if (nLow.length === 1 && /\d/.test(nLow)) {
      const re = new RegExp(`(?<!\\d)${nLow}(?:st|nd|rd|th)?(?!\\d)`, 'i');
      if (re.test(aLow)) return 0.9;
    }

    const patterns = [
      /block[- _]?([a-z0-9]+)/g,
      /tower[- _]?([a-z0-9]+)/g,
      /floor[- _]?([a-z0-9]+)/g,
      /\bt([0-9]+)\b/g,
      /\bf([0-9]+)\b/g,
      /\bb([0-9]+)\b/g,
    ];

    for (const re of patterns) {
      const actTokens = [...aLow.matchAll(re)].map((m) => m[1]);
      const nodeTokens = [...nLow.matchAll(re)].map((m) => m[1]);
      if (
        actTokens.length > 0 &&
        nodeTokens.length > 0 &&
        actTokens.some((t) => nodeTokens.includes(t))
      ) {
        return 0.9;
      }
    }
    return 0;
  }

  private jaccardSimilarity(
    text1: string,
    text2: string,
  ): { score: number; matched: string[] } {
    const t1 = this.tokenize(text1);
    const t2 = this.tokenize(text2);
    if (!t1.size || !t2.size) return { score: 0, matched: [] };
    const intersection = [...t1].filter((t) => t2.has(t));
    const union = new Set([...t1, ...t2]);
    return { score: intersection.length / union.size, matched: intersection };
  }

  private tokenize(text: string): Set<string> {
    return new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        // Allow single-digit pure numbers ("1"–"9") so Jaccard handles short floor names
        .filter((t) => (t.length >= 2 || /^\d$/.test(t)) && !STOPWORDS.has(t)),
    );
  }

  // Splits text into tokens that contain at least one digit.
  // Alphanumeric combos like "3f", "3a", "t3" are kept as-is and the bare
  // number is NOT extracted.  "3a" and "3f" are DIFFERENT towers that share
  // the same base digit — stripping the letter would create a false "3"↔"3"
  // intersection.  Pure-numeric tokens ("1", "2", "10") are already their own
  // bare number and are added directly.
  // Examples: "Wing 1"          → {"1"}
  //           "Tower Equinox 3F"→ {"3f"}
  //           "3A"              → {"3a"}
  private extractDigitTokens(text: string): Set<string> {
    const tokens = text.toLowerCase().split(/[^a-z0-9]+/);
    const result = new Set<string>();
    for (const token of tokens) {
      if (/\d/.test(token)) {
        result.add(token);
      }
    }
    return result;
  }
}
