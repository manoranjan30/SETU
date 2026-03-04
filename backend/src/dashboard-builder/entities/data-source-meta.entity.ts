import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

// This table mirrors the Data Source Registry to store overrides like Active status, Labels, or Sorting.
// The actual logic is in code (IDataSource classes).
@Entity('data_source_registry')
export class DataSourceMeta {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  key: string;

  @Column()
  label: string;

  @Column()
  module: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 50, default: 'BOTH' })
  scope: 'PROJECT' | 'GLOBAL' | 'BOTH';

  @Column({ type: 'jsonb', nullable: true })
  availableFields: any;

  @Column({ type: 'jsonb', nullable: true })
  availableFilters: any;

  @Column({ type: 'jsonb', nullable: true })
  supportedAggregations: any;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0 })
  sortOrder: number;
}
