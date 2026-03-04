import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import { EpsNode } from '../../eps/eps.entity';
import { ApprovalWorkflowNode } from './approval-workflow-node.entity';
import { ApprovalWorkflowEdge } from './approval-workflow-edge.entity';

@Entity('approval_workflow_templates')
export class ApprovalWorkflowTemplate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  projectId: number;

  @OneToOne(() => EpsNode, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: EpsNode;

  @Column({ length: 255 })
  name: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  createdBy: number;

  @OneToMany(() => ApprovalWorkflowNode, (node) => node.workflow, {
    cascade: true,
  })
  nodes: ApprovalWorkflowNode[];

  @OneToMany(() => ApprovalWorkflowEdge, (edge) => edge.workflow, {
    cascade: true,
  })
  edges: ApprovalWorkflowEdge[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
