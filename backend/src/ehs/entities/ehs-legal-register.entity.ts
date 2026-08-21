import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('ehs_legal_registers')
export class EhsLegalRegister {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @Column()
  requirement: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  documentNumber: string | null;

  @Column()
  responsibility: string; // Client, Contractor, etc.

  @Column({ default: 'Valid' })
  status: string; // Valid, Expired, Expiring Soon (Though status might be derived dynamic, storing for snapshot or manual override)
  // Actually, status is best derived, but we'll keep a field if user wants to force it.
  // Ideally, UI calculates it. But let's store it for simple filtering if needed.

  @Column({ type: 'date', nullable: true })
  certifiedDate: string;

  @Column({ type: 'date', nullable: true })
  expiryDate: string;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column({ type: 'text', nullable: true })
  documentUrl: string | null;

  @Column({ type: 'text', nullable: true })
  documentOriginalName: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  documentMimeType: string | null;

  @Column({ type: 'bigint', nullable: true })
  documentSize: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
