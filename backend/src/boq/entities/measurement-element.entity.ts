import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { EpsNode } from '../../eps/eps.entity';
import { BoqItem } from './boq-item.entity';
import { BoqSubItem } from './boq-sub-item.entity';
import { Activity } from '../../wbs/entities/activity.entity';

@Entity()
export class MeasurementElement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  // Link to Layer 2 (Sub Item Parent)
  @ManyToOne(() => BoqSubItem, (subItem) => subItem.measurements, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  boqSubItem: BoqSubItem;

  @Column({ nullable: true })
  boqSubItemId: number;

  // Link to Layer 1 (Commercial Parent) - Kept for Reference/Queries
  @ManyToOne(() => BoqItem, (boqItem) => boqItem.measurements, {
    onDelete: 'CASCADE',
  })
  boqItem: BoqItem;

  @Column()
  boqItemId: number;

  // Link to Location (Any EPS Level)
  @ManyToOne(() => EpsNode, { onDelete: 'CASCADE' })
  epsNode: EpsNode;

  @Column()
  epsNodeId: number;

  // Link to Activity (Optional - for Granular Tracking)
  // CRITICAL: createForeignKeyConstraints: false used to handle legacy data with orphan IDs
  @ManyToOne(() => Activity, {
    onDelete: 'CASCADE',
    nullable: true,
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'activityId' })
  activity: Activity;

  @Column({ nullable: true })
  activityId: number;

  // Link to Micro Activity (For Micro Schedule Progress Tracking)
  @ManyToOne('MicroScheduleActivity', {
    onDelete: 'SET NULL',
    nullable: true,
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'microActivityId' })
  microActivity: any;

  @Column({ nullable: true })
  microActivityId: number;

  // Technical Data
  @Column({ nullable: true })
  elementId: string; // ID from source (CAD/BIM handle)

  @Column()
  elementName: string;

  @Column({ nullable: true })
  elementCategory: string; // e.g., Wall, Slab

  @Column({ nullable: true })
  elementType: string;

  @Column({ nullable: true })
  grid: string; // "A-1"

  @Column({ nullable: true })
  linkingElement: string; // "Wall-001" (3D Linking)

  @Column({ nullable: true })
  uom: string; // m, m2, m3

  // Dimensions
  @Column('decimal', { precision: 10, scale: 3, default: 0 })
  length: number;

  @Column('decimal', { precision: 10, scale: 3, default: 0 })
  breadth: number;

  @Column('decimal', { precision: 10, scale: 3, default: 0 })
  depth: number;

  @Column('decimal', { precision: 10, scale: 3, default: 0 })
  height: number; // Similar to depth, but sometimes distinct in BIM

  @Column('decimal', { precision: 10, scale: 3, default: 0 })
  bottomLevel: number;

  @Column('decimal', { precision: 10, scale: 3, default: 0 })
  topLevel: number;

  @Column('decimal', { precision: 10, scale: 3, default: 0 })
  perimeter: number;

  @Column('decimal', { precision: 12, scale: 3, default: 0 })
  baseArea: number;

  // Atomic Quantity
  @Column('decimal', { precision: 12, scale: 3 })
  qty: number;

  @Column('decimal', { precision: 12, scale: 3, default: 0 })
  executedQty: number;

  // Visualization
  @Column({ type: 'json', nullable: true })
  baseCoordinates: any; // GeoJSON or coordinate array

  @Column({ type: 'json', nullable: true })
  plineAllLengths: any; // JSON array of segment lengths

  // Flexibility for extra technical columns
  @Column({ type: 'json', nullable: true })
  customAttributes: any;

  // Resource Analysis Link
  @Column({ nullable: true })
  analysisTemplateId: number;

  @ManyToOne('AnalysisTemplate', { nullable: true })
  @JoinColumn({ name: 'analysisTemplateId' })
  analysisTemplate: any;

  // Work Order Integration
  @ManyToOne('WorkOrder', { nullable: true })
  @JoinColumn({ name: 'workOrderId' })
  workOrder: any;

  @Column({ nullable: true })
  workOrderId: number;

  @ManyToOne('WorkOrderItem', { nullable: true })
  @JoinColumn({ name: 'workOrderItemId' })
  workOrderItem: any;

  @Column({ nullable: true })
  workOrderItemId: number;

  @ManyToOne('Vendor', { nullable: true })
  @JoinColumn({ name: 'vendorId' })
  vendor: any;

  @Column({ nullable: true })
  vendorId: number;

  @CreateDateColumn()
  importedOn: Date;
}
