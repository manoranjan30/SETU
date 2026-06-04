import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum QualityCubeTestAge {
  SEVEN_DAY = '7_DAY',
  TWENTY_EIGHT_DAY = '28_DAY',
}

export enum QualityCubeTestStatus {
  PENDING = 'PENDING',
  DUE_TODAY = 'DUE_TODAY',
  OVERDUE = 'OVERDUE',
  TESTED = 'TESTED',
  PASSED = 'PASSED',
  NEEDS_ATTENTION = 'NEEDS_ATTENTION',
  APPROVED = 'APPROVED',
  FAILED = 'FAILED',
}

@Entity('quality_cube_test_register')
@Index(['projectId', 'cubeId'], { unique: true })
@Index(['projectId', 'dueDate'])
@Index(['inspectionId'])
export class QualityCubeTestRegister {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @Column({ type: 'int', nullable: true })
  inspectionId: number | null;

  @Column({ type: 'int', nullable: true })
  pourCardId: number | null;

  @Column({ type: 'int', nullable: true })
  pourEntryIndex: number | null;

  @Column({ length: 80 })
  cubeId: string;

  @Column({ type: 'enum', enum: QualityCubeTestAge })
  testAge: QualityCubeTestAge;

  @Column({ type: 'date' })
  castDate: string;

  @Column({ type: 'date' })
  dueDate: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  projectNameSnapshot: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  activityName: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  elementName: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  goLabel: string | null;

  @Column({ type: 'text', nullable: true })
  goDetails: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  locationText: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  mixIdOrGrade: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  truckNo: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  deliveryChallanNo: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 3, nullable: true })
  quantityM3: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  specimenSize: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 3, nullable: true })
  loadKn: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 3, nullable: true })
  compressiveStrengthMpa: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 3, nullable: true })
  averageStrengthMpa: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 3, nullable: true })
  requiredStrengthMpa: string | null;

  @Column({ type: 'jsonb', nullable: true })
  calculationDetails: Record<string, unknown> | null;

  @Column({
    type: 'enum',
    enum: QualityCubeTestStatus,
    default: QualityCubeTestStatus.PENDING,
  })
  status: QualityCubeTestStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  testedByName: string | null;

  @Column({ type: 'date', nullable: true })
  testedDate: string | null;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'int', nullable: true })
  approvedByUserId: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  witnessedByName: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
