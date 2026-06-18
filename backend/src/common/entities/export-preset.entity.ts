import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity('export_presets')
@Unique(['userId', 'module', 'tableKey', 'name'])
export class ExportPreset {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column({ type: 'text' })
  module: string;

  @Column({ type: 'text' })
  tableKey: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  filters: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
