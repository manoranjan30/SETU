# Snagging & De-snagging — Backend + Web Frontend Implementation Plan

**Date:** 2026-03-18
**Depends On:** SNAG_DESNAG_MODULE_PLAN.md (domain model) + SNAG_DESNAG_MODULE_PLAN.md v2 (corrected business rules)
**Scope:** NestJS Backend + React Web Frontend only (Flutter plan is separate)
**Status:** PLAN — Do not implement until approved

---

## Quick Recap of Domain Rules

- **Snag** = Inspector tags defect points room-by-room inside a flat/unit
- **De-snag** = Contractor rectifies items + QC Inspector verifies and closes them
- **3 Rounds**: Each round has two sequential phases — Snag Phase then De-snag Phase
- **De-snag phase is locked** until Snag phase is submitted
- **Next round only opens** after De-snag phase passes multi-level release approval
- **Round 3 released** = Unit stamped Handover Ready
- **Rooms** come from existing `quality_room` table (already linked to `quality_unit`)

---

## Part A — Backend Implementation

### A1. Folder Structure

All snag files live in a dedicated `snag` module. Do NOT scatter into `quality`:

```
backend/src/snag/
├── snag.module.ts
├── snag.controller.ts
├── snag-item.controller.ts           ← separate controller for item-level actions
├── snag-approval.controller.ts       ← approval workflow controller
├── snag.service.ts                   ← list + round management
├── snag-item.service.ts              ← per-item CRUD + phase transitions
├── snag-approval.service.ts          ← multi-level approval workflow
├── dto/
│   ├── create-snag-list.dto.ts
│   ├── create-snag-item.dto.ts
│   ├── update-snag-item.dto.ts
│   ├── rectify-snag-item.dto.ts
│   ├── close-snag-item.dto.ts
│   ├── hold-snag-item.dto.ts
│   ├── submit-snag-phase.dto.ts
│   ├── submit-desnag-approval.dto.ts
│   └── advance-approval.dto.ts
└── entities/
    ├── snag-list.entity.ts
    ├── snag-round.entity.ts
    ├── snag-item.entity.ts
    ├── snag-photo.entity.ts
    ├── snag-release-approval.entity.ts
    └── snag-release-approval-step.entity.ts
```

Migration file:
```
backend/src/migrations/YYYYMMDDHHMMSS-CreateSnagTables.ts
```

---

### A2. Entity Files

#### `snag-list.entity.ts`
```typescript
import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany,
  JoinColumn, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { EpsNode } from '../../eps/eps.entity';
import { QualityUnit } from '../../quality/entities/quality-unit.entity';
import { User } from '../../users/user.entity';
import { SnagRound } from './snag-round.entity';

export enum SnagListStatus {
  SNAGGING       = 'snagging',       // inspector raising snag points (snag phase open)
  DESNAGGING     = 'desnagging',     // contractor rectifying (de-snag phase open)
  RELEASED       = 'released',       // de-snag approved, next round starting
  HANDOVER_READY = 'handover_ready', // all 3 rounds done and released
}

@Entity('snag_list')
export class SnagList {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @Column()
  epsNodeId: number;                  // unit's EPS node

  @Column()
  qualityUnitId: number;              // FK to quality_unit table

  @Column({ length: 100 })
  unitLabel: string;                  // e.g. "A1-F3-103" — denormalised for speed

  @Column({ type: 'int', default: 1 })
  currentRound: number;               // 1 | 2 | 3

  @Column({
    type: 'enum',
    enum: SnagListStatus,
    default: SnagListStatus.SNAGGING,
  })
  overallStatus: SnagListStatus;

  @Column()
  createdById: number;

  @ManyToOne(() => EpsNode)
  @JoinColumn({ name: 'epsNodeId' })
  epsNode: EpsNode;

  @ManyToOne(() => QualityUnit)
  @JoinColumn({ name: 'qualityUnitId' })
  qualityUnit: QualityUnit;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @OneToMany(() => SnagRound, (r) => r.snagList, { cascade: true })
  rounds: SnagRound[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
// UNIQUE INDEX on (projectId, qualityUnitId)
```

#### `snag-round.entity.ts`
```typescript
import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany,
  JoinColumn, CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { SnagList } from './snag-list.entity';
import { SnagItem } from './snag-item.entity';
import { SnagReleaseApproval } from './snag-release-approval.entity';

export enum SnagPhaseStatus {
  OPEN      = 'open',       // inspector still adding snag points
  SUBMITTED = 'submitted',  // inspector submitted; de-snag phase unlocked
}

export enum DesnagPhaseStatus {
  LOCKED            = 'locked',             // waiting for snag phase to submit
  OPEN              = 'open',               // contractor rectifying
  APPROVAL_PENDING  = 'approval_pending',   // all items closed, awaiting approval
  APPROVED          = 'approved',           // released — next round can open
  REJECTED          = 'rejected',           // approval rejected; items need attention
}

@Entity('snag_round')
export class SnagRound {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  snagListId: number;

  @Column({ type: 'int' })
  roundNumber: number;                      // 1 | 2 | 3

  // ── Snag Phase ────────────────────────────────────────────────────────────
  @Column({ type: 'enum', enum: SnagPhaseStatus, default: SnagPhaseStatus.OPEN })
  snagPhaseStatus: SnagPhaseStatus;

  @Column({ type: 'timestamp', nullable: true })
  snagSubmittedAt: Date | null;

  @Column({ nullable: true })
  snagSubmittedById: number | null;

  @Column({ type: 'text', nullable: true })
  snagSubmittedComments: string | null;

  // ── De-snag Phase ─────────────────────────────────────────────────────────
  @Column({ type: 'enum', enum: DesnagPhaseStatus, default: DesnagPhaseStatus.LOCKED })
  desnagPhaseStatus: DesnagPhaseStatus;

  @Column({ type: 'timestamp', nullable: true })
  desnagReleasedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  desnagReleaseComments: string | null;

  @Column()
  initiatedById: number;

  @ManyToOne(() => SnagList, (l) => l.rounds, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'snagListId' })
  snagList: SnagList;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'initiatedById' })
  initiatedBy: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'snagSubmittedById' })
  snagSubmittedBy: User | null;

  @OneToMany(() => SnagItem, (i) => i.snagRound, { cascade: true })
  items: SnagItem[];

  @OneToMany(() => SnagReleaseApproval, (a) => a.snagRound)
  approvals: SnagReleaseApproval[];

  @CreateDateColumn()
  initiatedAt: Date;
}
```

#### `snag-item.entity.ts`
```typescript
import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany,
  JoinColumn, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { QualityRoom } from '../../quality/entities/quality-room.entity';
import { SnagList } from './snag-list.entity';
import { SnagRound } from './snag-round.entity';
import { SnagPhoto } from './snag-photo.entity';

export enum SnagItemCategory {
  CIVIL           = 'civil',
  ELECTRICAL      = 'electrical',
  PLUMBING        = 'plumbing',
  PAINTING        = 'painting',
  CARPENTRY       = 'carpentry',
  TILING          = 'tiling',
  WATERPROOFING   = 'waterproofing',
  FINISHING       = 'finishing',
  DOORS_WINDOWS   = 'doors_windows',
  FALSE_CEILING   = 'false_ceiling',
  SANITARY        = 'sanitary',
  OTHER           = 'other',
}

export enum SnagSeverity {
  CRITICAL = 'critical',
  MAJOR    = 'major',
  MINOR    = 'minor',
}

export enum SnagItemStatus {
  OPEN     = 'open',
  RECTIFIED = 'rectified',
  CLOSED   = 'closed',
  ON_HOLD  = 'on_hold',
}

@Entity('snag_item')
export class SnagItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  snagListId: number;

  @Column()
  snagRoundId: number;

  @Column()
  qualityRoomId: number;              // FK → quality_room.id

  @Column({ length: 100 })
  roomLabel: string;                  // denormalised room name

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'enum', enum: SnagItemCategory })
  category: SnagItemCategory;

  @Column({ type: 'enum', enum: SnagSeverity, default: SnagSeverity.MINOR })
  severity: SnagSeverity;

  @Column({ type: 'enum', enum: SnagItemStatus, default: SnagItemStatus.OPEN })
  status: SnagItemStatus;

  @Column()
  raisedById: number;

  // ── Rectification (Contractor) ────────────────────────────────────────────
  @Column({ type: 'timestamp', nullable: true })
  rectifiedAt: Date | null;

  @Column({ nullable: true })
  rectifiedById: number | null;

  @Column({ type: 'text', nullable: true })
  rectificationRemarks: string | null;

  // ── Close / Verify (QC Inspector) ────────────────────────────────────────
  @Column({ type: 'timestamp', nullable: true })
  closedAt: Date | null;

  @Column({ nullable: true })
  closedById: number | null;

  @Column({ type: 'text', nullable: true })
  closeRemarks: string | null;

  // ── On Hold ───────────────────────────────────────────────────────────────
  @Column({ type: 'text', nullable: true })
  onHoldReason: string | null;

  @Column({ nullable: true })
  carriedFromRound: number | null;    // set if item was on_hold in previous round

  @Column({ type: 'int', default: 0 })
  itemSequence: number;

  @ManyToOne(() => SnagList, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'snagListId' })
  snagList: SnagList;

  @ManyToOne(() => SnagRound, (r) => r.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'snagRoundId' })
  snagRound: SnagRound;

  @ManyToOne(() => QualityRoom)
  @JoinColumn({ name: 'qualityRoomId' })
  room: QualityRoom;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'raisedById' })
  raisedBy: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'rectifiedById' })
  rectifiedBy: User | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'closedById' })
  closedBy: User | null;

  @OneToMany(() => SnagPhoto, (p) => p.snagItem, { cascade: true })
  photos: SnagPhoto[];

  @CreateDateColumn()
  raisedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

#### `snag-photo.entity.ts`
```typescript
import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { SnagItem } from './snag-item.entity';

export enum SnagPhotoType {
  BEFORE    = 'before',     // inspector uploads during snag phase
  AFTER     = 'after',      // contractor uploads during de-snag phase
  REFERENCE = 'reference',  // any supporting reference
}

@Entity('snag_photo')
export class SnagPhoto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  snagItemId: number;

  @Column({ type: 'enum', enum: SnagPhotoType })
  photoType: SnagPhotoType;

  @Column({ length: 500 })
  fileUrl: string;

  @Column({ length: 500, nullable: true })
  filePath: string | null;

  @Column({ length: 255, nullable: true })
  caption: string | null;

  @Column()
  uploadedById: number;

  @ManyToOne(() => SnagItem, (i) => i.photos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'snagItemId' })
  snagItem: SnagItem;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'uploadedById' })
  uploadedBy: User;

  @CreateDateColumn()
  uploadedAt: Date;
}
```

#### `snag-release-approval.entity.ts`
```typescript
import {
  Entity, PrimaryGeneratedColumn, Column, OneToOne, OneToMany,
  JoinColumn, CreateDateColumn,
} from 'typeorm';
import { SnagRound } from './snag-round.entity';
import { SnagReleaseApprovalStep } from './snag-release-approval-step.entity';

export enum SnagApprovalStatus {
  PENDING  = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('snag_release_approval')
export class SnagReleaseApproval {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  snagRoundId: number;

  @Column({ nullable: true })
  workflowConfigId: number | null;  // FK to existing approval_workflow_configs if used

  @Column({ type: 'enum', enum: SnagApprovalStatus, default: SnagApprovalStatus.PENDING })
  status: SnagApprovalStatus;

  @Column({ type: 'int', default: 1 })
  currentLevel: number;

  @Column({ type: 'int' })
  totalLevels: number;

  @OneToOne(() => SnagRound)
  @JoinColumn({ name: 'snagRoundId' })
  snagRound: SnagRound;

  @OneToMany(() => SnagReleaseApprovalStep, (s) => s.approval, { cascade: true })
  steps: SnagReleaseApprovalStep[];

  @CreateDateColumn()
  createdAt: Date;
}
```

#### `snag-release-approval-step.entity.ts`
```typescript
import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { SnagReleaseApproval } from './snag-release-approval.entity';

export enum SnagStepStatus {
  PENDING   = 'pending',
  APPROVED  = 'approved',
  REJECTED  = 'rejected',
  DELEGATED = 'delegated',
}

@Entity('snag_release_approval_step')
export class SnagReleaseApprovalStep {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  approvalId: number;

  @Column({ type: 'int' })
  level: number;

  @Column({ length: 100 })
  approverRole: string;

  @Column({ nullable: true })
  approverUserId: number | null;

  @Column({ type: 'enum', enum: SnagStepStatus, default: SnagStepStatus.PENDING })
  status: SnagStepStatus;

  @Column({ type: 'text', nullable: true })
  comments: string | null;

  @Column({ type: 'text', nullable: true })
  signatureData: string | null;   // base64 PNG data URI

  @Column({ type: 'timestamp', nullable: true })
  actedAt: Date | null;

  @ManyToOne(() => SnagReleaseApproval, (a) => a.steps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'approvalId' })
  approval: SnagReleaseApproval;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approverUserId' })
  approverUser: User | null;

  @CreateDateColumn()
  createdAt: Date;
}
```

---

### A3. DTOs

#### `create-snag-list.dto.ts`
```typescript
import { IsInt, IsString, MaxLength, IsOptional } from 'class-validator';

export class CreateSnagListDto {
  @IsInt()
  projectId: number;

  @IsInt()
  epsNodeId: number;

  @IsInt()
  qualityUnitId: number;

  @IsString()
  @MaxLength(100)
  unitLabel: string;
}
```

#### `create-snag-item.dto.ts`
```typescript
import { IsInt, IsString, IsEnum, IsOptional, MaxLength } from 'class-validator';
import { SnagItemCategory, SnagSeverity } from '../entities/snag-item.entity';

export class CreateSnagItemDto {
  @IsInt()
  qualityRoomId: number;

  @IsString()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(SnagItemCategory)
  category: SnagItemCategory;

  @IsEnum(SnagSeverity)
  severity: SnagSeverity;
}
```

#### `rectify-snag-item.dto.ts`
```typescript
import { IsOptional, IsString } from 'class-validator';

export class RectifySnagItemDto {
  @IsOptional()
  @IsString()
  rectificationRemarks?: string;
  // Photo uploads handled separately via multipart or photo-upload endpoint
}
```

#### `close-snag-item.dto.ts`
```typescript
import { IsOptional, IsString } from 'class-validator';

export class CloseSnagItemDto {
  @IsOptional()
  @IsString()
  closeRemarks?: string;
}
```

#### `hold-snag-item.dto.ts`
```typescript
import { IsString, MinLength } from 'class-validator';

export class HoldSnagItemDto {
  @IsString()
  @MinLength(5)
  reason: string;   // mandatory — must explain why it is being deferred
}
```

#### `submit-snag-phase.dto.ts`
```typescript
import { IsOptional, IsString } from 'class-validator';

export class SubmitSnagPhaseDto {
  @IsOptional()
  @IsString()
  comments?: string;
}
```

#### `submit-desnag-approval.dto.ts`
```typescript
import { IsOptional, IsString } from 'class-validator';

export class SubmitDesnagApprovalDto {
  @IsOptional()
  @IsString()
  comments?: string;
}
```

#### `advance-approval.dto.ts`
```typescript
import { IsString, IsOptional, MinLength } from 'class-validator';

export class AdvanceApprovalDto {
  @IsOptional()
  @IsString()
  comments?: string;

  @IsOptional()
  @IsString()
  signatureData?: string;   // base64 PNG data URI from signature pad
}

export class RejectApprovalDto {
  @IsString()
  @MinLength(10)
  comments: string;           // rejection reason is mandatory
}
```

---

### A4. Services

#### `snag.service.ts` — Core Logic

```typescript
@Injectable()
export class SnagService {
  constructor(
    @InjectRepository(SnagList)
    private readonly listRepo: Repository<SnagList>,
    @InjectRepository(SnagRound)
    private readonly roundRepo: Repository<SnagRound>,
    @InjectRepository(SnagItem)
    private readonly itemRepo: Repository<SnagItem>,
    @InjectRepository(QualityUnit)
    private readonly unitRepo: Repository<QualityUnit>,
    @InjectRepository(QualityRoom)
    private readonly roomRepo: Repository<QualityRoom>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly approvalService: SnagApprovalService,
    private readonly pushService: PushNotificationService,
  ) {}

  // ── Initiate snagging for a unit ──────────────────────────────────────────
  async initiateSnagList(dto: CreateSnagListDto, userId: number): Promise<SnagList> {
    // 1. Guard: one snag list per unit per project
    const existing = await this.listRepo.findOne({
      where: { projectId: dto.projectId, qualityUnitId: dto.qualityUnitId },
    });
    if (existing) throw new ConflictException('Snag list already exists for this unit');

    // 2. Create snag list
    const list = this.listRepo.create({
      ...dto,
      currentRound: 1,
      overallStatus: SnagListStatus.SNAGGING,
      createdById: userId,
    });
    await this.listRepo.save(list);

    // 3. Create Round 1
    const round = this.roundRepo.create({
      snagListId: list.id,
      roundNumber: 1,
      snagPhaseStatus: SnagPhaseStatus.OPEN,
      desnagPhaseStatus: DesnagPhaseStatus.LOCKED,
      initiatedById: userId,
    });
    await this.roundRepo.save(round);

    return this.getSnagListDetail(list.id);
  }

  // ── Get full snag list detail ─────────────────────────────────────────────
  async getSnagListDetail(snagListId: number): Promise<SnagList> {
    const list = await this.listRepo.findOne({
      where: { id: snagListId },
      relations: ['rounds', 'rounds.items', 'rounds.approvals', 'qualityUnit'],
    });
    if (!list) throw new NotFoundException('Snag list not found');
    return list;
  }

  // ── Get room grid with snag counts for a round ────────────────────────────
  async getRoomGrid(snagListId: number, roundId: number): Promise<RoomSnagGridDto[]> {
    // 1. Fetch the snag list to get qualityUnitId
    const list = await this.listRepo.findOne({ where: { id: snagListId } });
    if (!list) throw new NotFoundException('Snag list not found');

    // 2. Fetch all rooms for this unit
    const rooms = await this.roomRepo.find({
      where: { unitId: list.qualityUnit?.id ?? 0 },
      // Need to join via qualityUnit.id — fetch unit first
    });

    // 3. Fetch snag item counts per room for this round
    const itemCounts = await this.itemRepo
      .createQueryBuilder('item')
      .select('item.qualityRoomId', 'roomId')
      .addSelect('COUNT(*)', 'total')
      .addSelect(`SUM(CASE WHEN item.status = 'open' THEN 1 ELSE 0 END)`, 'openCount')
      .addSelect(`SUM(CASE WHEN item.status = 'rectified' THEN 1 ELSE 0 END)`, 'rectifiedCount')
      .addSelect(`SUM(CASE WHEN item.status = 'closed' THEN 1 ELSE 0 END)`, 'closedCount')
      .addSelect(`SUM(CASE WHEN item.status = 'on_hold' THEN 1 ELSE 0 END)`, 'onHoldCount')
      .addSelect(`SUM(CASE WHEN item.severity = 'critical' AND item.status = 'open' THEN 1 ELSE 0 END)`, 'criticalCount')
      .where('item.snagListId = :snagListId AND item.snagRoundId = :roundId', { snagListId, roundId })
      .groupBy('item.qualityRoomId')
      .getRawMany();

    const countMap = new Map(itemCounts.map((c) => [c.roomId, c]));

    return rooms.map((room) => {
      const counts = countMap.get(room.id) ?? {};
      return {
        qualityRoomId: room.id,
        roomLabel: room.name,
        roomType: room.roomType,
        sequence: room.sequence,
        total: Number(counts['total'] ?? 0),
        openCount: Number(counts['openCount'] ?? 0),
        rectifiedCount: Number(counts['rectifiedCount'] ?? 0),
        closedCount: Number(counts['closedCount'] ?? 0),
        onHoldCount: Number(counts['onHoldCount'] ?? 0),
        criticalCount: Number(counts['criticalCount'] ?? 0),
      };
    });
  }

  // ── Submit Snag Phase → unlocks De-snag ───────────────────────────────────
  async submitSnagPhase(
    snagListId: number, roundId: number,
    dto: SubmitSnagPhaseDto, userId: number,
  ): Promise<SnagRound> {
    const round = await this.roundRepo.findOne({
      where: { id: roundId, snagListId },
      relations: ['items'],
    });
    if (!round) throw new NotFoundException('Round not found');
    if (round.snagPhaseStatus !== SnagPhaseStatus.OPEN)
      throw new BadRequestException('Snag phase is not open');
    if (round.items.length === 0)
      throw new BadRequestException('At least one snag point must be raised before submitting');

    await this.roundRepo.update(roundId, {
      snagPhaseStatus: SnagPhaseStatus.SUBMITTED,
      snagSubmittedAt: new Date(),
      snagSubmittedById: userId,
      snagSubmittedComments: dto.comments ?? null,
      desnagPhaseStatus: DesnagPhaseStatus.OPEN,  // ← auto-unlock de-snag
    });

    // Update snag list overall status
    await this.listRepo.update(snagListId, { overallStatus: SnagListStatus.DESNAGGING });

    // Push notification to contractor/site engineer team
    // await this.pushService.notifySnagSubmitted(snagListId, round.roundNumber);

    return this.roundRepo.findOne({ where: { id: roundId } });
  }

  // ── Submit De-snag for multi-level approval ───────────────────────────────
  async submitDesnagForApproval(
    snagListId: number, roundId: number,
    dto: SubmitDesnagApprovalDto, userId: number,
  ): Promise<SnagReleaseApproval> {
    const round = await this.roundRepo.findOne({
      where: { id: roundId, snagListId },
      relations: ['items'],
    });
    if (!round) throw new NotFoundException('Round not found');
    if (round.desnagPhaseStatus !== DesnagPhaseStatus.OPEN)
      throw new BadRequestException('De-snag phase is not open for submission');

    // Guard: no open or rectified items allowed
    const blockingItems = round.items.filter(
      (i) => i.status === SnagItemStatus.OPEN || i.status === SnagItemStatus.RECTIFIED,
    );
    if (blockingItems.length > 0) {
      const openCount = blockingItems.filter((i) => i.status === SnagItemStatus.OPEN).length;
      const rectCount = blockingItems.filter((i) => i.status === SnagItemStatus.RECTIFIED).length;
      throw new BadRequestException(
        `Cannot submit: ${openCount} item(s) still open, ${rectCount} item(s) awaiting QC closure`,
      );
    }

    await this.roundRepo.update(roundId, { desnagPhaseStatus: DesnagPhaseStatus.APPROVAL_PENDING });

    // Create approval record
    return this.approvalService.createReleaseApproval(round, userId, dto.comments);
  }

  // ── Open next round (after de-snag N released) ───────────────────────────
  async openNextRound(snagListId: number, userId: number): Promise<SnagRound> {
    const list = await this.listRepo.findOne({ where: { id: snagListId } });
    if (!list) throw new NotFoundException('Snag list not found');
    if (list.currentRound >= 3)
      throw new BadRequestException('Maximum 3 rounds allowed');

    // Verify current round is released (de-snag approved)
    const currentRound = await this.roundRepo.findOne({
      where: { snagListId, roundNumber: list.currentRound },
      relations: ['items'],
    });
    if (currentRound.desnagPhaseStatus !== DesnagPhaseStatus.APPROVED)
      throw new BadRequestException('Current round de-snag must be released before opening next round');

    const nextRoundNumber = list.currentRound + 1;

    // Carry forward on_hold items
    const onHoldItems = currentRound.items.filter((i) => i.status === SnagItemStatus.ON_HOLD);

    // Create new round
    const newRound = await this.roundRepo.save(this.roundRepo.create({
      snagListId,
      roundNumber: nextRoundNumber,
      snagPhaseStatus: SnagPhaseStatus.OPEN,
      desnagPhaseStatus: DesnagPhaseStatus.LOCKED,
      initiatedById: userId,
    }));

    // Carry forward on_hold items as new open items in new round
    if (onHoldItems.length > 0) {
      const carried = onHoldItems.map((item) => this.itemRepo.create({
        snagListId,
        snagRoundId: newRound.id,
        qualityRoomId: item.qualityRoomId,
        roomLabel: item.roomLabel,
        title: item.title,
        description: item.description,
        category: item.category,
        severity: item.severity,
        status: SnagItemStatus.OPEN,
        raisedById: item.raisedById,
        carriedFromRound: currentRound.roundNumber,
        onHoldReason: null,     // reset on_hold reason
      }));
      await this.itemRepo.save(carried);
    }

    await this.listRepo.update(snagListId, {
      currentRound: nextRoundNumber,
      overallStatus: SnagListStatus.SNAGGING,
    });

    return newRound;
  }

  // ── Get floor unit summaries for the unit grid ────────────────────────────
  async getFloorUnitSummaries(projectId: number, floorId: number): Promise<UnitSnagSummaryDto[]> {
    // 1. Fetch all quality units under this floor (from quality_unit joined via quality_floor_structure)
    // 2. Fetch snag_list summaries for these units
    // 3. Merge and return
    // ... implementation
  }

  // ── Project-level summary for dashboard ──────────────────────────────────
  async getProjectSummary(projectId: number): Promise<ProjectSnagSummaryDto> {
    // Aggregate: total units, by status, critical count, by block
    // ... implementation
  }
}
```

#### `snag-item.service.ts` — Item CRUD + Phase Actions

```typescript
@Injectable()
export class SnagItemService {
  constructor(
    @InjectRepository(SnagItem)
    private readonly itemRepo: Repository<SnagItem>,
    @InjectRepository(SnagRound)
    private readonly roundRepo: Repository<SnagRound>,
    @InjectRepository(SnagPhoto)
    private readonly photoRepo: Repository<SnagPhoto>,
    @InjectRepository(QualityRoom)
    private readonly roomRepo: Repository<QualityRoom>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly fileService: FileService,  // existing file upload service
  ) {}

  async addSnagItem(snagListId: number, roundId: number, dto: CreateSnagItemDto, userId: number) {
    // Validate round exists, snag phase is OPEN
    const round = await this.roundRepo.findOne({ where: { id: roundId, snagListId } });
    if (!round) throw new NotFoundException('Round not found');
    if (round.snagPhaseStatus !== SnagPhaseStatus.OPEN)
      throw new BadRequestException('Snag phase is closed; cannot add new items');

    const room = await this.roomRepo.findOne({ where: { id: dto.qualityRoomId } });
    if (!room) throw new NotFoundException('Room not found');

    return this.itemRepo.save(this.itemRepo.create({
      snagListId,
      snagRoundId: roundId,
      qualityRoomId: dto.qualityRoomId,
      roomLabel: room.name,
      title: dto.title,
      description: dto.description ?? null,
      category: dto.category,
      severity: dto.severity,
      status: SnagItemStatus.OPEN,
      raisedById: userId,
    }));
  }

  async rectifyItem(itemId: number, dto: RectifySnagItemDto, userId: number) {
    const item = await this.getItemOrThrow(itemId);
    // Verify de-snag phase is open
    const round = await this.roundRepo.findOne({ where: { id: item.snagRoundId } });
    if (round.desnagPhaseStatus !== DesnagPhaseStatus.OPEN)
      throw new BadRequestException('De-snag phase is not open');
    if (item.status !== SnagItemStatus.OPEN)
      throw new BadRequestException('Only open items can be marked as rectified');

    await this.itemRepo.update(itemId, {
      status: SnagItemStatus.RECTIFIED,
      rectifiedAt: new Date(),
      rectifiedById: userId,
      rectificationRemarks: dto.rectificationRemarks ?? null,
    });
    return this.getItemOrThrow(itemId);
  }

  async closeItem(itemId: number, dto: CloseSnagItemDto, userId: number) {
    const item = await this.getItemOrThrow(itemId);
    if (item.status !== SnagItemStatus.RECTIFIED)
      throw new BadRequestException('Only rectified items can be closed');

    await this.itemRepo.update(itemId, {
      status: SnagItemStatus.CLOSED,
      closedAt: new Date(),
      closedById: userId,
      closeRemarks: dto.closeRemarks ?? null,
    });
    return this.getItemOrThrow(itemId);
  }

  async reopenItem(itemId: number, userId: number) {
    const item = await this.getItemOrThrow(itemId);
    if (item.status !== SnagItemStatus.RECTIFIED)
      throw new BadRequestException('Only rectified items can be reopened');
    await this.itemRepo.update(itemId, { status: SnagItemStatus.OPEN, rectifiedAt: null, rectifiedById: null });
    return this.getItemOrThrow(itemId);
  }

  async holdItem(itemId: number, dto: HoldSnagItemDto, userId: number) {
    const item = await this.getItemOrThrow(itemId);
    if (item.status === SnagItemStatus.CLOSED)
      throw new BadRequestException('Closed items cannot be put on hold');
    await this.itemRepo.update(itemId, { status: SnagItemStatus.ON_HOLD, onHoldReason: dto.reason });
    return this.getItemOrThrow(itemId);
  }

  async uploadPhoto(itemId: number, photoType: SnagPhotoType, filePath: string, userId: number) {
    const item = await this.getItemOrThrow(itemId);
    // Validate: before photos only during snag phase, after photos only during de-snag
    // ... validation logic

    const round = await this.roundRepo.findOne({ where: { id: item.snagRoundId } });
    if (photoType === SnagPhotoType.BEFORE && round.snagPhaseStatus !== SnagPhaseStatus.OPEN)
      throw new BadRequestException('Before photos can only be added during snag phase');
    if (photoType === SnagPhotoType.AFTER && round.desnagPhaseStatus !== DesnagPhaseStatus.OPEN)
      throw new BadRequestException('After photos can only be added during de-snag phase');

    const resolvedUrl = this.fileService.resolveUrl(filePath);
    return this.photoRepo.save(this.photoRepo.create({
      snagItemId: itemId,
      photoType,
      fileUrl: resolvedUrl,
      filePath,
      uploadedById: userId,
    }));
  }

  private async getItemOrThrow(itemId: number): Promise<SnagItem> {
    const item = await this.itemRepo.findOne({
      where: { id: itemId },
      relations: ['photos'],
    });
    if (!item) throw new NotFoundException('Snag item not found');
    return item;
  }
}
```

#### `snag-approval.service.ts` — Multi-Level Release Approval

```typescript
@Injectable()
export class SnagApprovalService {
  private readonly logger = new Logger(SnagApprovalService.name);

  constructor(
    @InjectRepository(SnagReleaseApproval)
    private readonly approvalRepo: Repository<SnagReleaseApproval>,
    @InjectRepository(SnagReleaseApprovalStep)
    private readonly stepRepo: Repository<SnagReleaseApprovalStep>,
    @InjectRepository(SnagRound)
    private readonly roundRepo: Repository<SnagRound>,
    @InjectRepository(SnagList)
    private readonly listRepo: Repository<SnagList>,
    private readonly pushService: PushNotificationService,
  ) {}

  async createReleaseApproval(
    round: SnagRound, submittedById: number, comments?: string,
  ): Promise<SnagReleaseApproval> {
    // Use a default 2-level approval config:
    // Level 1 = QC_ENGINEER, Level 2 = QC_MANAGER
    // For Round 3, add Level 3 = PROJECT_DIRECTOR
    const totalLevels = round.roundNumber === 3 ? 3 : 2;

    const approval = await this.approvalRepo.save(this.approvalRepo.create({
      snagRoundId: round.id,
      status: SnagApprovalStatus.PENDING,
      currentLevel: 1,
      totalLevels,
    }));

    // Create Level 1 step
    await this.stepRepo.save(this.stepRepo.create({
      approvalId: approval.id,
      level: 1,
      approverRole: 'QC_ENGINEER',
      status: SnagStepStatus.PENDING,
    }));

    // Notify Level 1 approvers
    // await this.pushService.notifySnagApprovalRequired(round.snagListId, 1);

    return approval;
  }

  async advanceApproval(
    roundId: number, dto: AdvanceApprovalDto, userId: number,
  ): Promise<SnagReleaseApproval> {
    const approval = await this.approvalRepo.findOne({
      where: { snagRoundId: roundId },
      relations: ['steps', 'snagRound'],
    });
    if (!approval) throw new NotFoundException('Approval record not found');
    if (approval.status !== SnagApprovalStatus.PENDING)
      throw new BadRequestException('Approval is already resolved');

    const currentStep = approval.steps.find(
      (s) => s.level === approval.currentLevel && s.status === SnagStepStatus.PENDING,
    );
    if (!currentStep) throw new NotFoundException('Current approval step not found');

    // Mark current step approved
    await this.stepRepo.update(currentStep.id, {
      status: SnagStepStatus.APPROVED,
      approverUserId: userId,
      comments: dto.comments ?? null,
      signatureData: dto.signatureData ?? null,
      actedAt: new Date(),
    });

    if (approval.currentLevel < approval.totalLevels) {
      // Advance to next level
      const nextLevel = approval.currentLevel + 1;
      const nextRole = nextLevel === 2 ? 'QC_MANAGER' : 'PROJECT_DIRECTOR';

      await this.stepRepo.save(this.stepRepo.create({
        approvalId: approval.id,
        level: nextLevel,
        approverRole: nextRole,
        status: SnagStepStatus.PENDING,
      }));

      await this.approvalRepo.update(approval.id, { currentLevel: nextLevel });
      // await this.pushService.notifySnagApprovalRequired(snagListId, nextLevel);
    } else {
      // Final level — release the round
      await this.approvalRepo.update(approval.id, { status: SnagApprovalStatus.APPROVED });

      const round = approval.snagRound;
      await this.roundRepo.update(round.id, {
        desnagPhaseStatus: DesnagPhaseStatus.APPROVED,
        desnagReleasedAt: new Date(),
        desnagReleaseComments: dto.comments ?? null,
      });

      // Update snag list status
      if (round.roundNumber === 3) {
        await this.listRepo.update(round.snagListId, { overallStatus: SnagListStatus.HANDOVER_READY });
        // await this.pushService.notifyHandoverReady(round.snagListId);
      } else {
        await this.listRepo.update(round.snagListId, { overallStatus: SnagListStatus.RELEASED });
      }
    }

    return this.approvalRepo.findOne({ where: { id: approval.id }, relations: ['steps'] });
  }

  async rejectApproval(
    roundId: number, dto: RejectApprovalDto, userId: number,
  ): Promise<SnagReleaseApproval> {
    const approval = await this.approvalRepo.findOne({
      where: { snagRoundId: roundId },
      relations: ['steps'],
    });
    if (!approval) throw new NotFoundException('Approval record not found');

    const currentStep = approval.steps.find((s) => s.level === approval.currentLevel);
    await this.stepRepo.update(currentStep.id, {
      status: SnagStepStatus.REJECTED,
      approverUserId: userId,
      comments: dto.comments,
      actedAt: new Date(),
    });

    await this.approvalRepo.update(approval.id, { status: SnagApprovalStatus.REJECTED });
    await this.roundRepo.update(roundId, { desnagPhaseStatus: DesnagPhaseStatus.REJECTED });

    // Notify submitter of rejection
    // await this.pushService.notifySnagApprovalRejected(roundId);

    return this.approvalRepo.findOne({ where: { id: approval.id }, relations: ['steps'] });
  }

  async getMyPendingApprovals(projectId: number, userId: number) {
    // Return rounds where current user's role matches the current pending step
    // ... join logic
  }
}
```

---

### A5. Controllers

#### `snag.controller.ts`
```typescript
@Controller('snag')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SnagController {
  constructor(
    private readonly snagService: SnagService,
    private readonly itemService: SnagItemService,
  ) {}

  // ── Dashboard / Navigation ────────────────────────────────────────────────
  @Get('project/:projectId/summary')
  @Permissions('SNAG.LIST.READ')
  getProjectSummary(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.snagService.getProjectSummary(projectId);
  }

  @Get('project/:projectId/floor/:floorId')
  @Permissions('SNAG.LIST.READ')
  getFloorUnitSummaries(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('floorId', ParseIntPipe) floorId: number,
  ) {
    return this.snagService.getFloorUnitSummaries(projectId, floorId);
  }

  // ── Snag List ─────────────────────────────────────────────────────────────
  @Post()
  @Permissions('SNAG.LIST.CREATE')
  initiateSnagList(@Body() dto: CreateSnagListDto, @Request() req) {
    return this.snagService.initiateSnagList(dto, req.user.id);
  }

  @Get(':snagListId')
  @Permissions('SNAG.LIST.READ')
  getSnagList(@Param('snagListId', ParseIntPipe) snagListId: number) {
    return this.snagService.getSnagListDetail(snagListId);
  }

  // ── Round + Room Navigation ────────────────────────────────────────────────
  @Get(':snagListId/round/:roundId/rooms')
  @Permissions('SNAG.LIST.READ')
  getRoomGrid(
    @Param('snagListId', ParseIntPipe) snagListId: number,
    @Param('roundId', ParseIntPipe) roundId: number,
  ) {
    return this.snagService.getRoomGrid(snagListId, roundId);
  }

  @Get(':snagListId/round/:roundId/room/:roomId/items')
  @Permissions('SNAG.LIST.READ')
  getRoomItems(
    @Param('snagListId', ParseIntPipe) snagListId: number,
    @Param('roundId', ParseIntPipe) roundId: number,
    @Param('roomId', ParseIntPipe) roomId: number,
  ) {
    return this.itemService.getRoomItems(snagListId, roundId, roomId);
  }

  // ── Snag Phase ─────────────────────────────────────────────────────────────
  @Post(':snagListId/round/:roundId/items')
  @Permissions('SNAG.ITEM.RAISE')
  addSnagItem(
    @Param('snagListId', ParseIntPipe) snagListId: number,
    @Param('roundId', ParseIntPipe) roundId: number,
    @Body() dto: CreateSnagItemDto,
    @Request() req,
  ) {
    return this.itemService.addSnagItem(snagListId, roundId, dto, req.user.id);
  }

  @Post(':snagListId/round/:roundId/submit-snag')
  @Permissions('SNAG.PHASE.SUBMIT')
  submitSnagPhase(
    @Param('snagListId', ParseIntPipe) snagListId: number,
    @Param('roundId', ParseIntPipe) roundId: number,
    @Body() dto: SubmitSnagPhaseDto,
    @Request() req,
  ) {
    return this.snagService.submitSnagPhase(snagListId, roundId, dto, req.user.id);
  }

  // ── De-snag Phase ──────────────────────────────────────────────────────────
  @Post(':snagListId/round/:roundId/submit-desnag')
  @Permissions('SNAG.DESNAG.SUBMIT')
  submitDesnagForApproval(
    @Param('snagListId', ParseIntPipe) snagListId: number,
    @Param('roundId', ParseIntPipe) roundId: number,
    @Body() dto: SubmitDesnagApprovalDto,
    @Request() req,
  ) {
    return this.snagService.submitDesnagForApproval(snagListId, roundId, dto, req.user.id);
  }

  @Post(':snagListId/round/next')
  @Permissions('SNAG.LIST.CREATE')
  openNextRound(
    @Param('snagListId', ParseIntPipe) snagListId: number,
    @Request() req,
  ) {
    return this.snagService.openNextRound(snagListId, req.user.id);
  }

  // ── My Pending ─────────────────────────────────────────────────────────────
  @Get('my-pending')
  @Permissions('SNAG.LIST.READ')
  getMyPending(
    @Query('projectId', ParseIntPipe) projectId: number,
    @Request() req,
  ) {
    return this.snagService.getMyPending(projectId, req.user.id);
  }
}
```

#### `snag-item.controller.ts`
```typescript
@Controller('snag')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SnagItemController {
  constructor(private readonly itemService: SnagItemService) {}

  @Patch(':snagListId/items/:itemId')
  @Permissions('SNAG.ITEM.RAISE')
  updateItem(
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: UpdateSnagItemDto,
    @Request() req,
  ) { return this.itemService.updateItem(itemId, dto, req.user.id); }

  @Delete(':snagListId/items/:itemId')
  @Permissions('SNAG.ITEM.RAISE')
  deleteItem(@Param('itemId', ParseIntPipe) itemId: number, @Request() req) {
    return this.itemService.deleteItem(itemId, req.user.id);
  }

  @Patch(':snagListId/items/:itemId/rectify')
  @Permissions('SNAG.ITEM.RECTIFY')
  rectifyItem(
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: RectifySnagItemDto,
    @Request() req,
  ) { return this.itemService.rectifyItem(itemId, dto, req.user.id); }

  @Patch(':snagListId/items/:itemId/close')
  @Permissions('SNAG.ITEM.CLOSE')
  closeItem(
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: CloseSnagItemDto,
    @Request() req,
  ) { return this.itemService.closeItem(itemId, dto, req.user.id); }

  @Patch(':snagListId/items/:itemId/reopen')
  @Permissions('SNAG.ITEM.CLOSE')
  reopenItem(@Param('itemId', ParseIntPipe) itemId: number, @Request() req) {
    return this.itemService.reopenItem(itemId, req.user.id);
  }

  @Patch(':snagListId/items/:itemId/hold')
  @Permissions('SNAG.ITEM.CLOSE')
  holdItem(
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: HoldSnagItemDto,
    @Request() req,
  ) { return this.itemService.holdItem(itemId, dto, req.user.id); }

  @Post('items/:itemId/photos')
  @Permissions('SNAG.ITEM.RAISE')
  @UseInterceptors(FileInterceptor('file'))
  uploadPhoto(
    @Param('itemId', ParseIntPipe) itemId: number,
    @Query('photoType') photoType: SnagPhotoType,
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) { return this.itemService.uploadPhoto(itemId, photoType, file.path, req.user.id); }

  @Delete('items/:itemId/photos/:photoId')
  @Permissions('SNAG.ITEM.RAISE')
  deletePhoto(
    @Param('itemId', ParseIntPipe) itemId: number,
    @Param('photoId', ParseIntPipe) photoId: number,
    @Request() req,
  ) { return this.itemService.deletePhoto(photoId, req.user.id); }
}
```

#### `snag-approval.controller.ts`
```typescript
@Controller('snag/round')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SnagApprovalController {
  constructor(private readonly approvalService: SnagApprovalService) {}

  @Get(':roundId/approval')
  @Permissions('SNAG.LIST.READ')
  getApproval(@Param('roundId', ParseIntPipe) roundId: number) {
    return this.approvalService.getApprovalDetail(roundId);
  }

  @Post(':roundId/approval/advance')
  @Permissions('SNAG.ROUND.APPROVE')
  advanceApproval(
    @Param('roundId', ParseIntPipe) roundId: number,
    @Body() dto: AdvanceApprovalDto,
    @Request() req,
  ) { return this.approvalService.advanceApproval(roundId, dto, req.user.id); }

  @Post(':roundId/approval/reject')
  @Permissions('SNAG.ROUND.REJECT')
  rejectApproval(
    @Param('roundId', ParseIntPipe) roundId: number,
    @Body() dto: RejectApprovalDto,
    @Request() req,
  ) { return this.approvalService.rejectApproval(roundId, dto, req.user.id); }
}
```

---

### A6. Module Registration

#### `snag.module.ts`
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnagList } from './entities/snag-list.entity';
import { SnagRound } from './entities/snag-round.entity';
import { SnagItem } from './entities/snag-item.entity';
import { SnagPhoto } from './entities/snag-photo.entity';
import { SnagReleaseApproval } from './entities/snag-release-approval.entity';
import { SnagReleaseApprovalStep } from './entities/snag-release-approval-step.entity';
import { QualityUnit } from '../quality/entities/quality-unit.entity';
import { QualityRoom } from '../quality/entities/quality-room.entity';
import { User } from '../users/user.entity';
import { EpsNode } from '../eps/eps.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { SnagService } from './snag.service';
import { SnagItemService } from './snag-item.service';
import { SnagApprovalService } from './snag-approval.service';
import { SnagController } from './snag.controller';
import { SnagItemController } from './snag-item.controller';
import { SnagApprovalController } from './snag-approval.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SnagList,
      SnagRound,
      SnagItem,
      SnagPhoto,
      SnagReleaseApproval,
      SnagReleaseApprovalStep,
      QualityUnit,      // reuse existing entities
      QualityRoom,
      User,
      EpsNode,
    ]),
    NotificationsModule,
  ],
  controllers: [SnagController, SnagItemController, SnagApprovalController],
  providers: [SnagService, SnagItemService, SnagApprovalService],
  exports: [SnagService],  // export for milestone trigger integration later
})
export class SnagModule {}
```

#### `app.module.ts` addition
```typescript
import { SnagModule } from './snag/snag.module';

@Module({
  imports: [
    // ... existing modules
    SnagModule,   // ← add here
  ],
})
export class AppModule {}
```

---

### A7. Database Migration

```typescript
// backend/src/migrations/YYYYMMDD-CreateSnagTables.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSnagTables1710905000000 implements MigrationInterface {
  name = 'CreateSnagTables1710905000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // snag_list_status enum
    await queryRunner.query(`
      CREATE TYPE snag_list_status_enum AS ENUM
      ('snagging','desnagging','released','handover_ready')
    `);
    // snag_phase_status enum
    await queryRunner.query(`
      CREATE TYPE snag_phase_status_enum AS ENUM ('open','submitted')
    `);
    // desnag_phase_status enum
    await queryRunner.query(`
      CREATE TYPE desnag_phase_status_enum AS ENUM
      ('locked','open','approval_pending','approved','rejected')
    `);
    // snag_item_category enum
    await queryRunner.query(`
      CREATE TYPE snag_item_category_enum AS ENUM
      ('civil','electrical','plumbing','painting','carpentry','tiling',
       'waterproofing','finishing','doors_windows','false_ceiling','sanitary','other')
    `);
    // snag_severity enum
    await queryRunner.query(`
      CREATE TYPE snag_severity_enum AS ENUM ('critical','major','minor')
    `);
    // snag_item_status enum
    await queryRunner.query(`
      CREATE TYPE snag_item_status_enum AS ENUM ('open','rectified','closed','on_hold')
    `);
    // snag_approval_status enum
    await queryRunner.query(`
      CREATE TYPE snag_approval_status_enum AS ENUM ('pending','approved','rejected')
    `);
    // snag_step_status enum
    await queryRunner.query(`
      CREATE TYPE snag_step_status_enum AS ENUM ('pending','approved','rejected','delegated')
    `);
    // snag_photo_type enum
    await queryRunner.query(`
      CREATE TYPE snag_photo_type_enum AS ENUM ('before','after','reference')
    `);

    // snag_list table
    await queryRunner.query(`
      CREATE TABLE snag_list (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL,
        eps_node_id INTEGER NOT NULL REFERENCES eps_node(id),
        quality_unit_id INTEGER NOT NULL REFERENCES quality_unit(id),
        unit_label VARCHAR(100) NOT NULL,
        current_round INTEGER NOT NULL DEFAULT 1,
        overall_status snag_list_status_enum NOT NULL DEFAULT 'snagging',
        created_by_id INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(project_id, quality_unit_id)
      )
    `);

    // snag_round table
    await queryRunner.query(`
      CREATE TABLE snag_round (
        id SERIAL PRIMARY KEY,
        snag_list_id INTEGER NOT NULL REFERENCES snag_list(id) ON DELETE CASCADE,
        round_number INTEGER NOT NULL,
        snag_phase_status snag_phase_status_enum NOT NULL DEFAULT 'open',
        snag_submitted_at TIMESTAMP,
        snag_submitted_by_id INTEGER REFERENCES users(id),
        snag_submitted_comments TEXT,
        desnag_phase_status desnag_phase_status_enum NOT NULL DEFAULT 'locked',
        desnag_released_at TIMESTAMP,
        desnag_release_comments TEXT,
        initiated_by_id INTEGER NOT NULL REFERENCES users(id),
        initiated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // snag_item table
    await queryRunner.query(`
      CREATE TABLE snag_item (
        id SERIAL PRIMARY KEY,
        snag_list_id INTEGER NOT NULL REFERENCES snag_list(id) ON DELETE CASCADE,
        snag_round_id INTEGER NOT NULL REFERENCES snag_round(id) ON DELETE CASCADE,
        quality_room_id INTEGER NOT NULL REFERENCES quality_room(id),
        room_label VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        category snag_item_category_enum NOT NULL,
        severity snag_severity_enum NOT NULL DEFAULT 'minor',
        status snag_item_status_enum NOT NULL DEFAULT 'open',
        raised_by_id INTEGER NOT NULL REFERENCES users(id),
        rectified_at TIMESTAMP,
        rectified_by_id INTEGER REFERENCES users(id),
        rectification_remarks TEXT,
        closed_at TIMESTAMP,
        closed_by_id INTEGER REFERENCES users(id),
        close_remarks TEXT,
        on_hold_reason TEXT,
        carried_from_round INTEGER,
        item_sequence INTEGER NOT NULL DEFAULT 0,
        raised_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // snag_photo table
    await queryRunner.query(`
      CREATE TABLE snag_photo (
        id SERIAL PRIMARY KEY,
        snag_item_id INTEGER NOT NULL REFERENCES snag_item(id) ON DELETE CASCADE,
        photo_type snag_photo_type_enum NOT NULL,
        file_url VARCHAR(500) NOT NULL,
        file_path VARCHAR(500),
        caption VARCHAR(255),
        uploaded_by_id INTEGER NOT NULL REFERENCES users(id),
        uploaded_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // snag_release_approval table
    await queryRunner.query(`
      CREATE TABLE snag_release_approval (
        id SERIAL PRIMARY KEY,
        snag_round_id INTEGER NOT NULL UNIQUE REFERENCES snag_round(id) ON DELETE CASCADE,
        workflow_config_id INTEGER,
        status snag_approval_status_enum NOT NULL DEFAULT 'pending',
        current_level INTEGER NOT NULL DEFAULT 1,
        total_levels INTEGER NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // snag_release_approval_step table
    await queryRunner.query(`
      CREATE TABLE snag_release_approval_step (
        id SERIAL PRIMARY KEY,
        approval_id INTEGER NOT NULL REFERENCES snag_release_approval(id) ON DELETE CASCADE,
        level INTEGER NOT NULL,
        approver_role VARCHAR(100) NOT NULL,
        approver_user_id INTEGER REFERENCES users(id),
        status snag_step_status_enum NOT NULL DEFAULT 'pending',
        comments TEXT,
        signature_data TEXT,
        acted_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Indexes for performance
    await queryRunner.query(`CREATE INDEX idx_snag_list_project ON snag_list(project_id)`);
    await queryRunner.query(`CREATE INDEX idx_snag_item_list ON snag_item(snag_list_id)`);
    await queryRunner.query(`CREATE INDEX idx_snag_item_round ON snag_item(snag_round_id)`);
    await queryRunner.query(`CREATE INDEX idx_snag_item_room ON snag_item(quality_room_id)`);
    await queryRunner.query(`CREATE INDEX idx_snag_item_status ON snag_item(status)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS snag_release_approval_step`);
    await queryRunner.query(`DROP TABLE IF EXISTS snag_release_approval`);
    await queryRunner.query(`DROP TABLE IF EXISTS snag_photo`);
    await queryRunner.query(`DROP TABLE IF EXISTS snag_item`);
    await queryRunner.query(`DROP TABLE IF EXISTS snag_round`);
    await queryRunner.query(`DROP TABLE IF EXISTS snag_list`);
    // Drop enums
    await queryRunner.query(`DROP TYPE IF EXISTS snag_list_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS snag_phase_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS desnag_phase_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS snag_item_category_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS snag_severity_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS snag_item_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS snag_approval_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS snag_step_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS snag_photo_type_enum`);
  }
}
```

---

## Part B — React Web Frontend Implementation

### B1. Folder Structure

```
frontend/src/
├── types/
│   └── snag.types.ts                 ← all TypeScript interfaces
├── services/
│   └── snag.service.ts               ← all API calls
└── views/
    └── snag/
        ├── SnagProjectDashboard.tsx   ← project-level stats + block cards
        ├── SnagFloorPage.tsx          ← floor-level unit grid
        ├── UnitSnagPage.tsx           ← unit detail: round stepper + two tabs
        ├── SnagRoomGridPage.tsx       ← room grid for snag phase
        ├── RoomItemsPage.tsx          ← per-room item list
        ├── SnagItemDetailPage.tsx     ← single item full detail
        ├── SnagApprovalsPage.tsx      ← rounds pending my approval
        └── components/
            ├── SnagStatusBadge.tsx
            ├── SnagSeverityBadge.tsx
            ├── UnitSnagCard.tsx
            ├── RoomSnagTile.tsx
            ├── SnagItemRow.tsx
            ├── SnagPhotoGrid.tsx
            ├── AddSnagItemModal.tsx
            ├── RectifyItemModal.tsx
            ├── CloseItemModal.tsx
            ├── HoldItemModal.tsx
            ├── SnagRoundStepper.tsx
            └── ReleaseApprovalModal.tsx
```

---

### B2. TypeScript Types

#### `frontend/src/types/snag.types.ts`
```typescript
// ── Enums ─────────────────────────────────────────────────────────────────

export type SnagListStatus = 'snagging' | 'desnagging' | 'released' | 'handover_ready';
export type SnagPhaseStatus = 'open' | 'submitted';
export type DesnagPhaseStatus = 'locked' | 'open' | 'approval_pending' | 'approved' | 'rejected';
export type SnagItemStatus = 'open' | 'rectified' | 'closed' | 'on_hold';
export type SnagSeverity = 'critical' | 'major' | 'minor';
export type SnagApprovalStatus = 'pending' | 'approved' | 'rejected';
export type SnagPhotoType = 'before' | 'after' | 'reference';

export type SnagItemCategory =
  | 'civil' | 'electrical' | 'plumbing' | 'painting'
  | 'carpentry' | 'tiling' | 'waterproofing' | 'finishing'
  | 'doors_windows' | 'false_ceiling' | 'sanitary' | 'other';

// ── Data Models ───────────────────────────────────────────────────────────

export interface SnagPhoto {
  id: number;
  photoType: SnagPhotoType;
  fileUrl: string;
  caption?: string;
  uploadedAt: string;
  uploadedBy?: { name: string };
}

export interface SnagItem {
  id: number;
  snagListId: number;
  snagRoundId: number;
  qualityRoomId: number;
  roomLabel: string;
  title: string;
  description?: string;
  category: SnagItemCategory;
  severity: SnagSeverity;
  status: SnagItemStatus;
  carriedFromRound?: number;
  onHoldReason?: string;
  rectificationRemarks?: string;
  closeRemarks?: string;
  photos: SnagPhoto[];
  raisedAt: string;
  rectifiedAt?: string;
  closedAt?: string;
  raisedBy?: { name: string };
  rectifiedBy?: { name: string };
  closedBy?: { name: string };
}

export interface SnagReleaseApprovalStep {
  id: number;
  level: number;
  approverRole: string;
  status: 'pending' | 'approved' | 'rejected' | 'delegated';
  comments?: string;
  actedAt?: string;
  approverUser?: { id: number; name: string };
}

export interface SnagReleaseApproval {
  id: number;
  status: SnagApprovalStatus;
  currentLevel: number;
  totalLevels: number;
  steps: SnagReleaseApprovalStep[];
}

export interface SnagRound {
  id: number;
  snagListId: number;
  roundNumber: 1 | 2 | 3;
  snagPhaseStatus: SnagPhaseStatus;
  snagSubmittedAt?: string;
  snagSubmittedComments?: string;
  desnagPhaseStatus: DesnagPhaseStatus;
  desnagReleasedAt?: string;
  initiatedAt: string;
  items?: SnagItem[];
  approvals?: SnagReleaseApproval[];
  // Computed counts (from API)
  totalItems: number;
  openCount: number;
  rectifiedCount: number;
  closedCount: number;
  onHoldCount: number;
  criticalCount: number;
}

export interface SnagList {
  id: number;
  projectId: number;
  epsNodeId: number;
  qualityUnitId: number;
  unitLabel: string;
  currentRound: 1 | 2 | 3;
  overallStatus: SnagListStatus;
  rounds: SnagRound[];
}

// ── Navigation / Summary Models ───────────────────────────────────────────

export interface RoomSnagSummary {
  qualityRoomId: number;
  roomLabel: string;
  roomType?: string;
  sequence: number;
  total: number;
  openCount: number;
  rectifiedCount: number;
  closedCount: number;
  onHoldCount: number;
  criticalCount: number;
}

export interface UnitSnagSummary {
  epsNodeId: number;
  qualityUnitId: number;
  unitLabel: string;
  currentRound: number;
  overallStatus: SnagListStatus;
  openCount: number;
  criticalCount: number;
  hasSnagList: boolean;
  snagListId?: number;
}

export interface FloorSnagSummary {
  floorId: number;
  floorLabel: string;
  totalUnits: number;
  unitsHandoverReady: number;
  unitsSnagging: number;
  unitsDesnagging: number;
  unitsNotStarted: number;
  criticalOpenCount: number;
}

export interface BlockSnagSummary {
  epsNodeId: number;
  blockName: string;
  towerName?: string;
  totalUnits: number;
  handoverReady: number;
  snagging: number;
  desnagging: number;
  notStarted: number;
  criticalCount: number;
  floors: FloorSnagSummary[];
}

export interface ProjectSnagSummary {
  projectId: number;
  totalUnits: number;
  handoverReady: number;
  snagging: number;
  desnagging: number;
  notStarted: number;
  criticalOpenItems: number;
  blocks: BlockSnagSummary[];
}

// ── Form DTOs ─────────────────────────────────────────────────────────────

export interface CreateSnagListDto {
  projectId: number;
  epsNodeId: number;
  qualityUnitId: number;
  unitLabel: string;
}

export interface CreateSnagItemDto {
  qualityRoomId: number;
  title: string;
  description?: string;
  category: SnagItemCategory;
  severity: SnagSeverity;
}
```

---

### B3. Service Layer

#### `frontend/src/services/snag.service.ts`
```typescript
import api from '../api/axios';
import type {
  SnagList, SnagRound, SnagItem, SnagReleaseApproval,
  RoomSnagSummary, UnitSnagSummary, ProjectSnagSummary,
  CreateSnagListDto, CreateSnagItemDto,
} from '../types/snag.types';

export const snagService = {
  // ── Dashboard ─────────────────────────────────────────────────────────────
  getProjectSummary: async (projectId: number): Promise<ProjectSnagSummary> => {
    const res = await api.get(`/snag/project/${projectId}/summary`);
    return res.data;
  },

  getFloorUnitSummaries: async (projectId: number, floorId: number): Promise<UnitSnagSummary[]> => {
    const res = await api.get(`/snag/project/${projectId}/floor/${floorId}`);
    return res.data;
  },

  // ── Snag List ─────────────────────────────────────────────────────────────
  initiateSnagList: async (dto: CreateSnagListDto): Promise<SnagList> => {
    const res = await api.post('/snag', dto);
    return res.data;
  },

  getSnagList: async (snagListId: number): Promise<SnagList> => {
    const res = await api.get(`/snag/${snagListId}`);
    return res.data;
  },

  // ── Room Grid ─────────────────────────────────────────────────────────────
  getRoomGrid: async (snagListId: number, roundId: number): Promise<RoomSnagSummary[]> => {
    const res = await api.get(`/snag/${snagListId}/round/${roundId}/rooms`);
    return res.data;
  },

  getRoomItems: async (snagListId: number, roundId: number, roomId: number): Promise<SnagItem[]> => {
    const res = await api.get(`/snag/${snagListId}/round/${roundId}/room/${roomId}/items`);
    return res.data;
  },

  // ── Snag Phase ────────────────────────────────────────────────────────────
  addSnagItem: async (snagListId: number, roundId: number, dto: CreateSnagItemDto): Promise<SnagItem> => {
    const res = await api.post(`/snag/${snagListId}/round/${roundId}/items`, dto);
    return res.data;
  },

  updateSnagItem: async (snagListId: number, itemId: number, dto: Partial<CreateSnagItemDto>): Promise<SnagItem> => {
    const res = await api.patch(`/snag/${snagListId}/items/${itemId}`, dto);
    return res.data;
  },

  deleteSnagItem: async (snagListId: number, itemId: number): Promise<void> => {
    await api.delete(`/snag/${snagListId}/items/${itemId}`);
  },

  submitSnagPhase: async (snagListId: number, roundId: number, comments?: string): Promise<SnagRound> => {
    const res = await api.post(`/snag/${snagListId}/round/${roundId}/submit-snag`, { comments });
    return res.data;
  },

  // ── De-snag Phase ─────────────────────────────────────────────────────────
  rectifyItem: async (snagListId: number, itemId: number, remarks?: string): Promise<SnagItem> => {
    const res = await api.patch(`/snag/${snagListId}/items/${itemId}/rectify`, { rectificationRemarks: remarks });
    return res.data;
  },

  closeItem: async (snagListId: number, itemId: number, remarks?: string): Promise<SnagItem> => {
    const res = await api.patch(`/snag/${snagListId}/items/${itemId}/close`, { closeRemarks: remarks });
    return res.data;
  },

  reopenItem: async (snagListId: number, itemId: number): Promise<SnagItem> => {
    const res = await api.patch(`/snag/${snagListId}/items/${itemId}/reopen`);
    return res.data;
  },

  holdItem: async (snagListId: number, itemId: number, reason: string): Promise<SnagItem> => {
    const res = await api.patch(`/snag/${snagListId}/items/${itemId}/hold`, { reason });
    return res.data;
  },

  submitDesnagForApproval: async (snagListId: number, roundId: number, comments?: string): Promise<SnagReleaseApproval> => {
    const res = await api.post(`/snag/${snagListId}/round/${roundId}/submit-desnag`, { comments });
    return res.data;
  },

  openNextRound: async (snagListId: number): Promise<SnagRound> => {
    const res = await api.post(`/snag/${snagListId}/round/next`);
    return res.data;
  },

  // ── Photos ────────────────────────────────────────────────────────────────
  uploadPhoto: async (
    itemId: number, photoType: string, file: File,
  ): Promise<{ id: number; fileUrl: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post(`/snag/items/${itemId}/photos?photoType=${photoType}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  deletePhoto: async (itemId: number, photoId: number): Promise<void> => {
    await api.delete(`/snag/items/${itemId}/photos/${photoId}`);
  },

  // ── Approvals ─────────────────────────────────────────────────────────────
  getApproval: async (roundId: number): Promise<SnagReleaseApproval> => {
    const res = await api.get(`/snag/round/${roundId}/approval`);
    return res.data;
  },

  advanceApproval: async (roundId: number, comments?: string, signatureData?: string): Promise<SnagReleaseApproval> => {
    const res = await api.post(`/snag/round/${roundId}/approval/advance`, { comments, signatureData });
    return res.data;
  },

  rejectApproval: async (roundId: number, comments: string): Promise<SnagReleaseApproval> => {
    const res = await api.post(`/snag/round/${roundId}/approval/reject`, { comments });
    return res.data;
  },

  getMyPending: async (projectId: number) => {
    const res = await api.get(`/snag/my-pending?projectId=${projectId}`);
    return res.data;
  },
};
```

---

### B4. React Pages

#### `SnagProjectDashboard.tsx` — Entry point page
```typescript
// Key sections:
// - useParams to get projectId
// - useEffect to fetch snagService.getProjectSummary(projectId)
// - Stats row: 4 stat boxes (Not Started grey / Snagging blue / De-snagging orange / Handover Ready green)
// - Overall progress bar (handoverReady / totalUnits × 100)
// - Block cards list using BlockSnagCard component
// - Each block card: tap → navigate to SnagFloorPage

export default function SnagProjectDashboard() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<ProjectSnagSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    snagService.getProjectSummary(Number(projectId))
      .then(setSummary).finally(() => setLoading(false));
  }, [projectId]);

  // Render: header → stat boxes → progress bar → block cards
}
```

#### `SnagFloorPage.tsx` — Block floor grid
```typescript
// - useParams: projectId, blockId (epsNodeId of block)
// - State: list of FloorSnagSummary
// - Grid of floor tiles (3-col) colour-coded by floor status
// - Each floor tile: label, unit count, critical badge
// - Tap → navigate to SnagUnitGridPage with floorId
```

#### `UnitSnagPage.tsx` — THE CENTRAL UNIT SCREEN
```typescript
// This is the most complex screen
// - useParams: projectId, snagListId (or qualityUnitId if initiating)
// - Tabs: two tabs per active round — "Snag" (blue) and "De-snag" (orange)
// - Top: SnagRoundStepper component showing all rounds + phase statuses
// - Tab 1 content: SnagRoomGridPage (embedded or navigated)
// - Tab 2 content: De-snag items list grouped by room (locked if phase locked)
// - Bottom action bar changes based on phase + role

export default function UnitSnagPage() {
  const { projectId, snagListId } = useParams<{ projectId: string; snagListId: string }>();
  const { user } = useAuth();
  const [snagList, setSnagList] = useState<SnagList | null>(null);
  const [activeTab, setActiveTab] = useState<'snag' | 'desnag'>('snag');
  const [loading, setLoading] = useState(true);

  const activeRound = useMemo(
    () => snagList?.rounds.find(r => r.roundNumber === snagList.currentRound),
    [snagList],
  );

  const isDesnagLocked = activeRound?.desnagPhaseStatus === 'locked';

  // ... render
}
```

#### `SnagRoomGridPage.tsx` — Room-by-room snag tagging
```typescript
// Key elements:
// - Grid of room tiles (2-col or 3-col)
// - Each tile: room name, icon, item count, colour by status
// - Tap room tile → open RoomItemsPage (or slide panel)
// - "Add Snag Point" FAB → AddSnagItemModal
// - Only visible/interactive during snag phase

// Room tile colours:
//   No items: grey.100
//   Has open critical: red.50 + red border
//   Has open (non-critical): orange.50
//   All rectified: blue.50
//   All closed: green.50
```

#### `RoomItemsPage.tsx` — Per-room items
```typescript
// - Shows all snag items for a specific room in the active round
// - Sectioned by status during de-snag: Open | Rectified | On Hold | Closed
// - During snag phase: flat list with "Add" button
// - Each item row: SnagItemRow component
// - Item actions depend on phase and role:
//   Snag phase + inspector: Edit, Delete, Hold
//   De-snag phase + contractor: "Mark Rectified" → RectifyItemModal
//   De-snag phase + QC inspector: "Close ✓" / "Reopen ✗" → CloseItemModal
```

---

### B5. Key Component Designs

#### `SnagStatusBadge.tsx`
```typescript
// Reusable pill badge for SnagListStatus, SnagItemStatus, DesnagPhaseStatus
const statusConfig: Record<string, { label: string; className: string }> = {
  snagging:         { label: 'Snagging',       className: 'bg-blue-100 text-blue-700' },
  desnagging:       { label: 'De-snagging',    className: 'bg-orange-100 text-orange-700' },
  released:         { label: 'Released',        className: 'bg-teal-100 text-teal-700' },
  handover_ready:   { label: 'Handover Ready',  className: 'bg-green-100 text-green-700' },
  open:             { label: 'Open',            className: 'bg-red-100 text-red-700' },
  rectified:        { label: 'Rectified',       className: 'bg-blue-100 text-blue-700' },
  closed:           { label: 'Closed',          className: 'bg-green-100 text-green-700' },
  on_hold:          { label: 'On Hold',         className: 'bg-gray-100 text-gray-600' },
  approval_pending: { label: 'Awaiting Approval', className: 'bg-amber-100 text-amber-700' },
  approved:         { label: 'Released',        className: 'bg-green-100 text-green-700' },
  rejected:         { label: 'Rejected',        className: 'bg-red-100 text-red-700' },
  locked:           { label: 'Locked',          className: 'bg-gray-100 text-gray-400' },
};
```

#### `SnagSeverityBadge.tsx`
```typescript
const severityConfig = {
  critical: { label: 'Critical', className: 'bg-red-100 text-red-700 border border-red-200' },
  major:    { label: 'Major',    className: 'bg-orange-100 text-orange-700 border border-orange-200' },
  minor:    { label: 'Minor',    className: 'bg-amber-100 text-amber-700 border border-amber-200' },
};
```

#### `SnagRoundStepper.tsx`
```typescript
// Horizontal stepper showing all rounds
// Each round shows:
//   Round number pill (S1 / S2 / S3) + colour by status
//   Two sub-rows: "Snag: ●open / ✓submitted" + "De-snag: 🔒locked / ●open / ⏳approval / ✓released"
// Locked future rounds show grey dimmed state
// Active round has a blue outline ring
```

#### `AddSnagItemModal.tsx`
```typescript
// Uses existing Modal.tsx component (size="large")
// Form fields:
//   - Room selector dropdown (pre-filled if opened from room page)
//   - Title text input (required)
//   - Description textarea (optional)
//   - Category select (12 options with icons)
//   - Severity radio chips: Minor | Major | Critical
//   - Photo upload area: drag-drop or click, previews thumbnails
//     (at least 1 photo required — before photo)
// Submit → calls snagService.addSnagItem + snagService.uploadPhoto per file
```

#### `RectifyItemModal.tsx`
```typescript
// Uses Modal.tsx (size="large")
// For contractor to mark item as rectified
// Fields:
//   - Remarks textarea (optional but encouraged)
//   - After-photo upload (required — at least 1)
//     Shows existing after-photos if any already uploaded
// Submit → calls snagService.rectifyItem
```

#### `ReleaseApprovalModal.tsx`
```typescript
// Uses Modal.tsx (size="large")
// Two modes based on user role:
//   Mode A — Submitter (QC Inspector submitting de-snag for approval):
//     Shows round summary (X items all closed, Y on hold)
//     Comments field
//     [Submit for Approval] button
//   Mode B — Approver (QC Manager/Director reviewing):
//     Shows submitter info + comments
//     Approval level indicator "Level 1 of 2"
//     Signature pad (canvas-based, same as existing SignatureModal pattern)
//     Comments field
//     [Approve] and [Reject] buttons
```

#### `SnagPhotoGrid.tsx`
```typescript
// Reusable photo grid — shows up to 4 photos in 2x2 then "+N more" overlay
// Props: photos, photoType ('before' | 'after'), onAdd?, onDelete?
// Lightbox on tap for full-screen view
// Upload area shown if onAdd prop is provided (role-gated by parent)
```

---

### B6. Routing

In `frontend/src/App.tsx`, add routes inside the protected routes block:

```typescript
// Snag module routes
<Route path="/projects/:projectId/snag" element={<SnagProjectDashboard />} />
<Route path="/projects/:projectId/snag/floor/:floorId" element={<SnagFloorPage />} />
<Route path="/projects/:projectId/snag/unit/:snagListId" element={<UnitSnagPage />} />
<Route path="/projects/:projectId/snag/unit/:snagListId/round/:roundId/room/:roomId" element={<RoomItemsPage />} />
<Route path="/projects/:projectId/snag/item/:itemId" element={<SnagItemDetailPage />} />
<Route path="/projects/:projectId/snag/approvals" element={<SnagApprovalsPage />} />
```

---

### B7. Menu Integration

In `frontend/src/config/menu.ts`, add to the Quality section:

```typescript
{
  label: 'Snagging & De-snagging',
  icon: ShieldCheck,            // lucide-react icon
  path: `/projects/${projectId}/snag`,
  permission: 'SNAG.LIST.READ',
  description: 'Room-wise punch list, rectification, 3-round release',
  color: '#7C3AED',             // purple
}
```

---

## Part C — Implementation Order (Step-by-Step)

### Step 1 — Backend Entities + Migration (Day 1-2)
1. Create all 6 entity files in `backend/src/snag/entities/`
2. Write migration file
3. Register migration — run `npm run migration:run`
4. Verify tables created correctly in DB

### Step 2 — Backend DTOs (Day 2)
1. Create all 9 DTO files
2. Add `class-validator` decorators
3. No testing at this stage — just files

### Step 3 — Backend Services — Core Logic (Day 3-5)
1. `snag.service.ts` — `initiateSnagList`, `getSnagListDetail`, `getRoomGrid`, `submitSnagPhase`, `submitDesnagForApproval`, `openNextRound`, `getFloorUnitSummaries`, `getProjectSummary`
2. `snag-item.service.ts` — `addSnagItem`, `updateItem`, `deleteItem`, `getRoomItems`, `rectifyItem`, `closeItem`, `reopenItem`, `holdItem`, `uploadPhoto`, `deletePhoto`
3. `snag-approval.service.ts` — `createReleaseApproval`, `advanceApproval`, `rejectApproval`, `getApprovalDetail`, `getMyPendingApprovals`

### Step 4 — Backend Controllers + Module (Day 6)
1. Create 3 controller files
2. Create `snag.module.ts`
3. Import `SnagModule` in `app.module.ts`
4. Test all endpoints via Postman/Insomnia:
   - POST `/snag` — initiate list
   - GET `/snag/:id` — get detail
   - GET `/snag/:id/round/:roundId/rooms` — room grid
   - POST `/snag/:id/round/:roundId/items` — add item
   - POST `/snag/:id/round/:roundId/submit-snag` — submit snag phase
   - PATCH `/snag/:id/items/:itemId/rectify` — mark rectified
   - PATCH `/snag/:id/items/:itemId/close` — close item
   - POST `/snag/:id/round/:roundId/submit-desnag` — submit for approval
   - POST `/snag/round/:roundId/approval/advance` — approve

### Step 5 — Frontend Types + Service (Day 7)
1. Create `snag.types.ts`
2. Create `snag.service.ts`
3. Test service calls from browser console (temporary)

### Step 6 — Frontend Shared Components (Day 8)
1. `SnagStatusBadge.tsx`
2. `SnagSeverityBadge.tsx`
3. `SnagPhotoGrid.tsx`
4. `SnagRoundStepper.tsx`
5. `SnagItemRow.tsx`

### Step 7 — Frontend Modals (Day 9)
1. `AddSnagItemModal.tsx` (with photo upload)
2. `RectifyItemModal.tsx` (with after-photo upload)
3. `CloseItemModal.tsx`
4. `HoldItemModal.tsx`
5. `ReleaseApprovalModal.tsx` (with signature pad)

### Step 8 — Frontend Pages (Day 10-13)
1. `SnagProjectDashboard.tsx` — project summary
2. `SnagFloorPage.tsx` — floor grid
3. Unit grid page (embedded in SnagFloorPage as panel or separate route)
4. `UnitSnagPage.tsx` — central unit screen with tabs
5. `SnagRoomGridPage.tsx` — room grid (snag phase)
6. `RoomItemsPage.tsx` — per-room item list
7. `SnagItemDetailPage.tsx` — full item detail
8. `SnagApprovalsPage.tsx` — pending approvals

### Step 9 — Routing + Menu (Day 14)
1. Add routes in `App.tsx`
2. Add menu entry in `menu.ts`
3. Add permission checks throughout

### Step 10 — End-to-End Testing (Day 15)
Full workflow test:
1. Initiate snag list for a unit
2. Navigate to room grid → add snag points in each room with photos
3. Submit snag phase → verify de-snag tab unlocks
4. Mark items as rectified (upload after-photos)
5. QC closes items
6. Submit de-snag for approval → approval record created
7. Level 1 approver approves
8. Level 2 approver approves → round released
9. Open Round 2 → verify on-hold items carried forward
10. Complete Round 3 → verify unit shows Handover Ready

---

## Part D — Files to Create / Modify Summary

### New Files (Backend) — 19 files
```
backend/src/snag/snag.module.ts
backend/src/snag/snag.controller.ts
backend/src/snag/snag-item.controller.ts
backend/src/snag/snag-approval.controller.ts
backend/src/snag/snag.service.ts
backend/src/snag/snag-item.service.ts
backend/src/snag/snag-approval.service.ts
backend/src/snag/dto/create-snag-list.dto.ts
backend/src/snag/dto/create-snag-item.dto.ts
backend/src/snag/dto/update-snag-item.dto.ts
backend/src/snag/dto/rectify-snag-item.dto.ts
backend/src/snag/dto/close-snag-item.dto.ts
backend/src/snag/dto/hold-snag-item.dto.ts
backend/src/snag/dto/submit-snag-phase.dto.ts
backend/src/snag/dto/submit-desnag-approval.dto.ts
backend/src/snag/dto/advance-approval.dto.ts
backend/src/snag/entities/snag-list.entity.ts
backend/src/snag/entities/snag-round.entity.ts
backend/src/snag/entities/snag-item.entity.ts
backend/src/snag/entities/snag-photo.entity.ts
backend/src/snag/entities/snag-release-approval.entity.ts
backend/src/snag/entities/snag-release-approval-step.entity.ts
backend/src/migrations/YYYYMMDD-CreateSnagTables.ts
```

### Modified Files (Backend) — 1 file
```
backend/src/app.module.ts       → add SnagModule import
```

### New Files (Frontend) — 22 files
```
frontend/src/types/snag.types.ts
frontend/src/services/snag.service.ts
frontend/src/views/snag/SnagProjectDashboard.tsx
frontend/src/views/snag/SnagFloorPage.tsx
frontend/src/views/snag/UnitSnagPage.tsx
frontend/src/views/snag/SnagRoomGridPage.tsx
frontend/src/views/snag/RoomItemsPage.tsx
frontend/src/views/snag/SnagItemDetailPage.tsx
frontend/src/views/snag/SnagApprovalsPage.tsx
frontend/src/views/snag/components/SnagStatusBadge.tsx
frontend/src/views/snag/components/SnagSeverityBadge.tsx
frontend/src/views/snag/components/UnitSnagCard.tsx
frontend/src/views/snag/components/RoomSnagTile.tsx
frontend/src/views/snag/components/SnagItemRow.tsx
frontend/src/views/snag/components/SnagPhotoGrid.tsx
frontend/src/views/snag/components/AddSnagItemModal.tsx
frontend/src/views/snag/components/RectifyItemModal.tsx
frontend/src/views/snag/components/CloseItemModal.tsx
frontend/src/views/snag/components/HoldItemModal.tsx
frontend/src/views/snag/components/SnagRoundStepper.tsx
frontend/src/views/snag/components/ReleaseApprovalModal.tsx
frontend/src/views/snag/components/SnagPhotoGrid.tsx
```

### Modified Files (Frontend) — 2 files
```
frontend/src/App.tsx         → add 6 new routes
frontend/src/config/menu.ts  → add Snagging menu entry
```

---

## Part E — Estimated Effort

| # | Phase | Scope | Days |
|---|-------|-------|------|
| 1 | Backend entities + migration | 6 entity files + migration SQL | 2 |
| 2 | Backend DTOs | 9 DTO files | 0.5 |
| 3 | Backend services | snag.service + item.service + approval.service | 3 |
| 4 | Backend controllers + module | 3 controllers + module + app.module update | 1 |
| 5 | Backend API testing | Postman E2E all endpoints | 1 |
| 6 | Frontend types + service | snag.types.ts + snag.service.ts | 0.5 |
| 7 | Frontend shared components | 6 small components | 1 |
| 8 | Frontend modals | 5 modals (add, rectify, close, hold, approval) | 2 |
| 9 | Frontend pages | 8 pages | 4 |
| 10 | Routing + menu | App.tsx + menu.ts | 0.5 |
| 11 | Full E2E test | All 10 workflow steps | 1 |
| **Total** | | | **~16.5 days** |
