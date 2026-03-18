import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { EpsNode } from './eps.entity';
import { WorkCalendar } from '../wbs/entities/work-calendar.entity';

@Entity()
export class ProjectProfile {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => EpsNode, { onDelete: 'CASCADE' })
  @JoinColumn()
  epsNode: EpsNode;

  // Removed explicit epsNodeId to avoid TypeORM conflict with JoinColumn definition
  // @Column()
  // epsNodeId: number;

  // --- Core Identity ---
  @Column({ nullable: true })
  projectCode: string;

  // projectName is usually the EpsNode name, but we can store it here too or sync it.
  // The JSON schema has it. Let's keep it nullable or sync it.
  @Column({ nullable: true })
  projectName: string;

  @Column({ nullable: true })
  projectType: string; // Enum: Residential, Commercial, etc.

  @Column({ nullable: true })
  projectCategory: string;

  @Column({ nullable: true })
  projectStatus: string; // Enum: Planned, Active, etc.

  @Column({ nullable: true })
  projectVersion: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  // --- Organization & Governance ---
  @Column({ nullable: true })
  owningCompany: string;

  @Column({ nullable: true })
  businessUnit: string;

  @Column({ nullable: true })
  companyLogoUrl: string;

  @Column({ nullable: true })
  projectLogoUrl: string;

  // User IDs stored as strings/numbers.
  // We can add Relations later if we need strict integrity,
  // but for a flexible property sheet, IDs are often sufficient and avoid circular deps.
  @Column({ nullable: true })
  projectSponsorId: string;

  @Column({ nullable: true })
  projectManagerId: string;

  @Column({ nullable: true })
  planningManagerId: string;

  @Column({ nullable: true })
  costControllerId: string;

  @Column({ nullable: true })
  approvalAuthorityId: string;

  // --- Location & Site ---
  @Column({ nullable: true })
  country: string;

  @Column({ nullable: true })
  state: string;

  @Column({ nullable: true })
  city: string;

  @Column({ type: 'text', nullable: true })
  siteAddress: string;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  longitude: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  landArea: number;

  @Column({ nullable: true })
  landOwnershipType: string;

  @Column({ nullable: true })
  zoningClassification: string;

  // --- Schedule Controls ---
  @Column({ type: 'date', nullable: true })
  plannedStartDate: Date;

  @Column({ type: 'date', nullable: true })
  plannedEndDate: Date;

  @Column({ type: 'date', nullable: true })
  actualStartDate: Date;

  @Column({ type: 'date', nullable: true })
  actualEndDate: Date;

  @ManyToOne(() => WorkCalendar, { nullable: true })
  @JoinColumn({ name: 'calendar_id' })
  calendar: WorkCalendar;

  @Index()
  @Column({ name: 'calendar_id', nullable: true })
  calendarId: number;

  @Column({ nullable: true })
  shiftPattern: string;

  @Column({ nullable: true })
  milestoneStrategy: string;

  // --- Financial & Commercial ---
  @Column({ nullable: true })
  currency: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  estimatedProjectCost: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  approvedBudget: number;

  @Column({ nullable: true })
  fundingType: string;

  @Column({ nullable: true })
  revenueModel: string;

  @Column({ nullable: true })
  taxStructure: string;

  @Column({ default: false })
  escalationClause: boolean;

  // --- Construction & Technical ---
  @Column({ nullable: true })
  constructionTechnology: string;

  @Column({ nullable: true })
  structuralSystem: string;

  @Column({ nullable: true })
  numberOfBuildings: number;

  @Column({ nullable: true })
  typicalFloorCount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  totalBuiltupArea: number;

  @Column({ nullable: true })
  unitMix: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  heightRestriction: number;

  @Column({ nullable: true })
  seismicZone: string;

  // --- Audit & Lifecycle ---
  @Column({ nullable: true })
  lifecycleStage: string;

  @Column({ nullable: true })
  createdBy: string; // User ID/Name

  @CreateDateColumn()
  createdOn: Date;

  @Column({ nullable: true })
  lastUpdatedBy: string;

  @UpdateDateColumn()
  lastUpdatedOn: Date;

  @Column({ type: 'text', nullable: true })
  changeReason: string;
}
