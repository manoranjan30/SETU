import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('issue_tracker_attachments')
export class IssueTrackerAttachment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  issueId: number;

  @Column({ type: 'int' })
  projectId: number;

  @Column({ type: 'int', nullable: true })
  stepId: number | null;

  @Column({ type: 'varchar', length: 500 })
  fileUrl: string;

  @Column({ type: 'varchar', length: 255 })
  originalName: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  mimeType: string | null;

  @Column({ type: 'int', nullable: true })
  fileSizeBytes: number | null;

  @Column({ type: 'int' })
  uploadedByUserId: number;

  @Column({ type: 'varchar', length: 150 })
  uploadedByName: string;

  @CreateDateColumn()
  uploadedAt: Date;
}
