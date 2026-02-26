import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ApprovalWorkflowTemplate } from './entities/approval-workflow-template.entity';
import { ApprovalWorkflowNode } from './entities/approval-workflow-node.entity';
import { ApprovalWorkflowEdge } from './entities/approval-workflow-edge.entity';

@Injectable()
export class ApprovalWorkflowService {
    constructor(
        @InjectRepository(ApprovalWorkflowTemplate)
        private readonly templateRepo: Repository<ApprovalWorkflowTemplate>,
        @InjectRepository(ApprovalWorkflowNode)
        private readonly nodeRepo: Repository<ApprovalWorkflowNode>,
        @InjectRepository(ApprovalWorkflowEdge)
        private readonly edgeRepo: Repository<ApprovalWorkflowEdge>,
        private dataSource: DataSource,
    ) { }

    async getWorkflowByProjectId(projectId: number): Promise<ApprovalWorkflowTemplate> {
        const template = await this.templateRepo.findOne({
            where: { projectId },
            relations: ['nodes', 'edges'],
        });

        if (!template) {
            throw new NotFoundException(`No global workflow found for project ${projectId}`);
        }

        return template;
    }

    async saveWorkflow(
        projectId: number,
        data: {
            name: string;
            nodes: (Partial<ApprovalWorkflowNode> & { clientId: string })[]; // Requires clientId from frontend (React Flow node ID)
            edges: { sourceClientId: string; targetClientId: string }[];
        },
        userId: number,
    ): Promise<ApprovalWorkflowTemplate> {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            let template = await queryRunner.manager.findOne(ApprovalWorkflowTemplate, {
                where: { projectId },
                relations: ['nodes', 'edges'],
            });

            if (!template) {
                template = queryRunner.manager.create(ApprovalWorkflowTemplate, {
                    projectId,
                    name: data.name,
                    createdBy: userId,
                    isActive: true,
                });
                template = await queryRunner.manager.save(template);
            } else {
                // Clear old edges and nodes using DELETE to avoid entity tracking issues
                // and ensure a clean slate inside the transaction
                await queryRunner.manager.delete(ApprovalWorkflowEdge, { workflowId: template.id });
                await queryRunner.manager.delete(ApprovalWorkflowNode, { workflowId: template.id });

                template.name = data.name;
                template.nodes = [];
                template.edges = [];
                template = await queryRunner.manager.save(template);
            }

            // Save nodes and keep track of mapping from clientId -> dbId
            const idMap = new Map<string, number>();

            for (const nodeData of data.nodes) {
                const { clientId, ...nodeEntityData } = nodeData;

                const node = queryRunner.manager.create(ApprovalWorkflowNode, {
                    ...nodeEntityData,
                    workflowId: template.id,
                });
                const savedNode = await queryRunner.manager.save(node);
                idMap.set(clientId, savedNode.id);
            }

            // Save edges using the mapped IDs
            for (const edgeData of data.edges) {
                const sourceId = idMap.get(edgeData.sourceClientId);
                const targetId = idMap.get(edgeData.targetClientId);

                if (!sourceId || !targetId) {
                    throw new BadRequestException('Invalid edge connecting to a non-existent node.');
                }

                const edge = queryRunner.manager.create(ApprovalWorkflowEdge, {
                    workflowId: template.id,
                    sourceNodeId: sourceId,
                    targetNodeId: targetId,
                });
                await queryRunner.manager.save(edge);
            }

            await queryRunner.commitTransaction();

            return this.getWorkflowByProjectId(projectId);

        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    async deleteWorkflow(projectId: number): Promise<void> {
        const template = await this.templateRepo.findOne({ where: { projectId } });
        if (!template) {
            throw new NotFoundException(`No global workflow template found for project ${projectId}`);
        }
        await this.templateRepo.remove(template);
    }
}
