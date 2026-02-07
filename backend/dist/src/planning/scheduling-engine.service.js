"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulingEngineService = void 0;
const common_1 = require("@nestjs/common");
const activity_relationship_entity_1 = require("../wbs/entities/activity-relationship.entity");
let SchedulingEngineService = class SchedulingEngineService {
    calculateCPM(activities, relationships, projectStartDate = new Date()) {
        if (activities.length === 0)
            return activities;
        const avMap = new Map();
        activities.forEach((av) => avMap.set(av.activityId, av));
        const successors = new Map();
        const predecessors = new Map();
        activities.forEach((av) => {
            successors.set(av.activityId, []);
            predecessors.set(av.activityId, []);
        });
        relationships.forEach((rel) => {
            const src = rel.predecessor?.id;
            const tgt = rel.successor?.id;
            if (avMap.has(src) && avMap.has(tgt)) {
                successors
                    .get(src)
                    ?.push({ target: tgt, type: rel.relationshipType, lag: rel.lagDays });
                predecessors
                    .get(tgt)
                    ?.push({ source: src, type: rel.relationshipType, lag: rel.lagDays });
            }
        });
        const inDegree = new Map();
        activities.forEach((av) => inDegree.set(av.activityId, predecessors.get(av.activityId)?.length || 0));
        const queue = [];
        inDegree.forEach((count, id) => {
            if (count === 0)
                queue.push(id);
        });
        const sortedOrder = [];
        const projectStartMs = new Date(projectStartDate).setHours(0, 0, 0, 0);
        const earlyStart = new Map();
        const earlyFinish = new Map();
        while (queue.length > 0) {
            const u = queue.shift();
            sortedOrder.push(u);
            const av = avMap.get(u);
            const durationMs = (av.duration || 0) * (24 * 60 * 60 * 1000);
            let maxPredFinish = projectStartMs;
            const preds = predecessors.get(u) || [];
            preds.forEach((edge) => {
                const predEF = earlyFinish.get(edge.source) || projectStartMs;
                const lagMs = edge.lag * (24 * 60 * 60 * 1000);
                if (edge.type === activity_relationship_entity_1.RelationshipType.FS) {
                    if (predEF + lagMs > maxPredFinish)
                        maxPredFinish = predEF + lagMs;
                }
                else if (edge.type === activity_relationship_entity_1.RelationshipType.SS) {
                    const predES = earlyStart.get(edge.source) || projectStartMs;
                    if (predES + lagMs > maxPredFinish)
                        maxPredFinish = predES + lagMs;
                }
            });
            let calcES = maxPredFinish;
            if (av.startDate) {
                const manualStart = new Date(av.startDate).getTime();
                if (manualStart > calcES)
                    calcES = manualStart;
            }
            earlyStart.set(u, calcES);
            earlyFinish.set(u, calcES + durationMs);
            const succs = successors.get(u) || [];
            succs.forEach((edge) => {
                const currentIn = inDegree.get(edge.target) || 0;
                inDegree.set(edge.target, currentIn - 1);
                if (currentIn - 1 === 0)
                    queue.push(edge.target);
            });
        }
        if (sortedOrder.length !== activities.length) {
            console.warn('Cycle detected in schedule! CPM results may be invalid.');
        }
        const lateStart = new Map();
        const lateFinish = new Map();
        let projectFinish = projectStartMs;
        earlyFinish.forEach((ef) => {
            if (ef > projectFinish)
                projectFinish = ef;
        });
        for (let i = sortedOrder.length - 1; i >= 0; i--) {
            const u = sortedOrder[i];
            const av = avMap.get(u);
            const durationMs = (av.duration || 0) * (24 * 60 * 60 * 1000);
            let minSuccStart = projectFinish;
            const succs = successors.get(u) || [];
            if (succs.length === 0) {
                minSuccStart = projectFinish;
            }
            else {
                minSuccStart = Number.MAX_SAFE_INTEGER;
                succs.forEach((edge) => {
                    const succLS = lateStart.get(edge.target);
                    if (succLS !== undefined) {
                        const lagMs = edge.lag * (24 * 60 * 60 * 1000);
                        if (edge.type === activity_relationship_entity_1.RelationshipType.FS) {
                            if (succLS - lagMs < minSuccStart)
                                minSuccStart = succLS - lagMs;
                        }
                    }
                });
                if (minSuccStart === Number.MAX_SAFE_INTEGER)
                    minSuccStart = projectFinish;
            }
            const calcLF = minSuccStart;
            const calcLS = calcLF - durationMs;
            lateFinish.set(u, calcLF);
            lateStart.set(u, calcLS);
        }
        activities.forEach((av) => {
            const es = earlyStart.get(av.activityId);
            const ef = earlyFinish.get(av.activityId);
            const ls = lateStart.get(av.activityId);
            const lf = lateFinish.get(av.activityId);
            if (es !== undefined && ef !== undefined) {
                av.startDate = new Date(es);
                av.finishDate = new Date(ef);
            }
            if (ls !== undefined && es !== undefined) {
                const floatMs = ls - es;
                av.totalFloat = Math.round(floatMs / (24 * 60 * 60 * 1000));
                av.isCritical = av.totalFloat <= 0;
            }
            else {
                av.totalFloat = 0;
                av.isCritical = false;
            }
            const succs = successors.get(av.activityId) || [];
            if (succs.length === 0) {
                av.freeFloat = 0;
            }
            else {
                let minSuccES = Number.MAX_SAFE_INTEGER;
                succs.forEach((edge) => {
                    const sES = earlyStart.get(edge.target);
                    if (sES !== undefined && sES < minSuccES)
                        minSuccES = sES;
                });
                if (minSuccES !== Number.MAX_SAFE_INTEGER && ef !== undefined) {
                    av.freeFloat = Math.round((minSuccES - ef) / (24 * 60 * 60 * 1000));
                }
                else {
                    av.freeFloat = 0;
                }
            }
        });
        return activities;
    }
};
exports.SchedulingEngineService = SchedulingEngineService;
exports.SchedulingEngineService = SchedulingEngineService = __decorate([
    (0, common_1.Injectable)()
], SchedulingEngineService);
//# sourceMappingURL=scheduling-engine.service.js.map