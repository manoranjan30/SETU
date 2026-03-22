import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CustomerMilestoneTemplate } from './customer-milestone-template.entity';
import { EpsNode } from '../../eps/eps.entity';
import { QualityUnit } from '../../quality/entities/quality-unit.entity';
import { User } from '../../users/user.entity';
import { MilestoneCollectionTranche } from './milestone-collection-tranche.entity';

export enum CustomerMilestoneAchievementStatus {
  NOT_TRIGGERED = 'not_triggered',
  TRIGGERED = 'triggered',
  INVOICE_RAISED = 'invoice_raised',
  COLLECTED = 'collected',
  PARTIALLY_COLLECTED = 'partially_collected',
  WAIVED = 'waived',
}

@Entity('customer_milestone_achievement')
export class CustomerMilestoneAchievement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'template_id' })
  templateId: number;

  @ManyToOne(() => CustomerMilestoneTemplate, (template) => template.achievements, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'template_id' })
  template: CustomerMilestoneTemplate;

  @Column({ name: 'project_id' })
  projectId: number;

  @ManyToOne(() => EpsNode, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: EpsNode;

  @Column({ name: 'eps_node_id', type: 'int', nullable: true })
  epsNodeId: number | null;

  @ManyToOne(() => EpsNode, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'eps_node_id' })
  epsNode: EpsNode | null;

  @Column({ name: 'quality_unit_id', type: 'int', nullable: true })
  qualityUnitId: number | null;

  @ManyToOne(() => QualityUnit, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'quality_unit_id' })
  qualityUnit: QualityUnit | null;

  @Column({ name: 'unit_label', length: 100 })
  unitLabel: string;

  @Column({
    type: 'enum',
    enum: CustomerMilestoneAchievementStatus,
    default: CustomerMilestoneAchievementStatus.NOT_TRIGGERED,
  })
  status: CustomerMilestoneAchievementStatus;

  @Column({ name: 'triggered_at', type: 'timestamp', nullable: true })
  triggeredAt: Date | null;

  @Column({ name: 'planned_completion_date', type: 'date', nullable: true })
  plannedCompletionDate: string | null;

  @Column({ name: 'actual_completion_date', type: 'date', nullable: true })
  actualCompletionDate: string | null;

  @Column({ name: 'completion_source', type: 'varchar', length: 50, nullable: true })
  completionSource: string | null;

  @Column({ name: 'triggered_by', type: 'varchar', length: 255, nullable: true })
  triggeredBy: string | null;

  @Column({
    name: 'trigger_reference',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  triggerReference: string | null;

  @Column({ name: 'collection_pct', type: 'decimal', precision: 5, scale: 2 })
  collectionPct: string;

  @Column({
    name: 'flat_sale_value',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  flatSaleValue: string | null;

  @Column({
    name: 'collection_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  collectionAmount: string | null;

  @Column({ name: 'invoice_number', type: 'varchar', length: 100, nullable: true })
  invoiceNumber: string | null;

  @Column({ name: 'invoice_date', type: 'date', nullable: true })
  invoiceDate: string | null;

  @Column({ name: 'invoice_raised_by_id', type: 'int', nullable: true })
  invoiceRaisedById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'invoice_raised_by_id' })
  invoiceRaisedBy: User | null;

  @Column({
    name: 'amount_received',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  amountReceived: string | null;

  @Column({ name: 'received_date', type: 'date', nullable: true })
  receivedDate: string | null;

  @Column({ name: 'received_by_id', type: 'int', nullable: true })
  receivedById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'received_by_id' })
  receivedBy: User | null;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @OneToMany(() => MilestoneCollectionTranche, (tranche) => tranche.achievement)
  tranches: MilestoneCollectionTranche[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
