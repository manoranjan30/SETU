import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { ApprovalWorkflowTemplate } from './approval-workflow-template.entity';
import { ApprovalWorkflowNode } from './approval-workflow-node.entity';

@Entity('approval_workflow_edges')
export class ApprovalWorkflowEdge {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  workflowId: number;

  @ManyToOne(() => ApprovalWorkflowTemplate, (template) => template.edges, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'workflowId' })
  workflow: ApprovalWorkflowTemplate;

  @Column()
  sourceNodeId: number;

  @ManyToOne(() => ApprovalWorkflowNode, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sourceNodeId' })
  sourceNode: ApprovalWorkflowNode;

  @Column()
  targetNodeId: number;

  @ManyToOne(() => ApprovalWorkflowNode, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'targetNodeId' })
  targetNode: ApprovalWorkflowNode;

  @CreateDateColumn()
  createdAt: Date;
}
