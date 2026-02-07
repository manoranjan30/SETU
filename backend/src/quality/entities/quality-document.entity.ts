import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('quality_documents')
export class QualityDocument {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @Column()
  documentType: string; // Shop Drawing, RFI, Method Statement, Approval

  @Column()
  documentName: string;

  @Column()
  referenceNumber: string;

  @Column({ nullable: true })
  revision: string;

  @Column({ type: 'date', nullable: true })
  submissionDate: string;

  @Column({ type: 'date', nullable: true })
  approvalDate: string;

  @Column({ default: 'Approved' })
  status: string; // Under Review, Approved, Approved with comments, Rejected

  @Column({ nullable: true })
  fileUrl: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
