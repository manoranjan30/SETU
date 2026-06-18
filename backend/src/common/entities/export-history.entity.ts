import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type ExportHistoryStatus = 'SUCCESS' | 'FAILED' | 'SKIPPED';

@Entity('export_history')
export class ExportHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  module: string;

  @Column({ type: 'text' })
  exportType: string;

  @Column({ type: 'int', nullable: true })
  projectId: number | null;

  @Column({ type: 'text' })
  status: ExportHistoryStatus;

  @Column({ type: 'int', default: 0 })
  recipientCount: number;

  @Column({ type: 'text', nullable: true })
  fileName: string | null;

  @Column({ type: 'date', nullable: true })
  dateFrom: string | null;

  @Column({ type: 'date', nullable: true })
  dateTo: string | null;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;
}
