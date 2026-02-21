import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QualityActivity } from './entities/quality-activity.entity';
import { QualitySequenceEdge } from './entities/quality-sequence-edge.entity';

export class NodePositionDto {
    id: number;
    position: { x: number; y: number };
}

export class EdgeDto {
    sourceId: number;
    targetId: number;
    constraintType: 'HARD' | 'SOFT';
    lagMinutes?: number;
}

export class UpdateGraphDto {
    nodes: NodePositionDto[];
    edges: EdgeDto[];
}

@Injectable()
export class QualitySequencerService {
    constructor(
        @InjectRepository(QualityActivity)
        private readonly activityRepo: Repository<QualityActivity>,
        @InjectRepository(QualitySequenceEdge)
        private readonly edgeRepo: Repository<QualitySequenceEdge>,
    ) { }

    async getGraph(listId: number) {
        const activities = await this.activityRepo.find({
            where: { listId },
            relations: ['outgoingEdges', 'outgoingEdges.target', 'incomingEdges'],
        });

        const nodes = activities.map((a) => ({
            id: a.id.toString(),
            type: 'activityNode',
            position: a.position || { x: 0, y: 0 },
            data: {
                label: a.activityName,
                description: a.description,
                sequence: a.sequence,
            },
        }));

        // Extract edges effectively
        const edges: any[] = [];
        const edgeSet = new Set<string>();

        for (const activity of activities) {
            if (activity.outgoingEdges) {
                for (const edge of activity.outgoingEdges) {
                    const edgeId = `${edge.sourceId}-${edge.targetId}`;
                    if (!edgeSet.has(edgeId)) {
                        edges.push({
                            id: `e${edge.sourceId}-${edge.targetId}`,
                            source: edge.sourceId.toString(),
                            target: edge.targetId.toString(),
                            type: edge.constraintType === 'HARD' ? 'default' : 'smoothstep', // Visual mapping
                            animated: edge.constraintType === 'SOFT',
                            style: {
                                stroke: edge.constraintType === 'HARD' ? '#ef4444' : '#eab308',
                                strokeWidth: 2,
                            },
                            data: {
                                constraintType: edge.constraintType,
                                lagMinutes: edge.lagMinutes,
                            },
                        });
                        edgeSet.add(edgeId);
                    }
                }
            }
        }

        return { nodes, edges };
    }

    async saveGraph(listId: number, dto: UpdateGraphDto) {
        // 1. Update Node Positions
        if (dto.nodes && dto.nodes.length > 0) {
            const updates = dto.nodes.map((node) =>
                this.activityRepo.update(node.id, { position: node.position }),
            );
            await Promise.all(updates);
        }

        // 2. Sync Edges
        if (dto.edges) {
            // Fetch existing edges for these activities to know what to delete/update
            // Limitation: complex to find all relevant edges efficiently without specific listId context in Edge entity
            // For now, we delete all edges where source is in this list and recreate them.
            // A better approach would be smart diffing.

            const activities = await this.activityRepo.find({
                where: { listId },
                select: ['id'],
            });
            const activityIds = activities.map(a => a.id);

            if (activityIds.length > 0) {
                // Delete all edges originating from these activities
                await this.edgeRepo.createQueryBuilder()
                    .delete()
                    .from(QualitySequenceEdge)
                    .where('sourceId IN (:...ids)', { ids: activityIds })
                    .execute();
            }

            // Validate cycle (Topological Sort or DFS)
            if (this.detectCycle(dto.edges)) {
                throw new BadRequestException('Cycle detected in the sequence graph');
            }

            // Insert new edges
            const newEdges = dto.edges.map(e => this.edgeRepo.create({
                sourceId: e.sourceId,
                targetId: e.targetId,
                constraintType: e.constraintType,
                lagMinutes: e.lagMinutes,
            }));

            await this.edgeRepo.save(newEdges);

            // 3. Sync legacy previousActivityId for List View consistency
            // We set it to the first predecessor alphabetically or numerically to have a stable single link
            for (const activityId of activityIds) {
                const firstEdge = dto.edges.find(e => e.targetId === activityId);
                await this.activityRepo.update(activityId, {
                    previousActivityId: firstEdge ? firstEdge.sourceId : (null as any)
                });
            }
        }

        return { success: true };
    }

    private detectCycle(edges: EdgeDto[]): boolean {
        const adj = new Map<number, number[]>();

        for (const edge of edges) {
            if (!adj.has(edge.sourceId)) adj.set(edge.sourceId, []);
            adj.get(edge.sourceId)!.push(edge.targetId);
        }

        const visited = new Set<number>();
        const recStack = new Set<number>();

        const hasCycle = (v: number): boolean => {
            visited.add(v);
            recStack.add(v);

            const neighbors = adj.get(v) || [];
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    if (hasCycle(neighbor)) return true;
                } else if (recStack.has(neighbor)) {
                    return true;
                }
            }

            recStack.delete(v);
            return false;
        };

        for (const node of adj.keys()) {
            if (!visited.has(node)) {
                if (hasCycle(node)) return true;
            }
        }

        return false;
    }
}
