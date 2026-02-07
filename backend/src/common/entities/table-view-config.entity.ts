import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/user.entity'; // Adjust path if needed

@Entity('table_view_config')
@Unique(['userId', 'tableId', 'viewName']) // Prevent duplicate view names for same table/user
export class TableViewConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  tableId: string; // e.g., 'MEASUREMENT_TABLE'

  @Column()
  viewName: string; // e.g., 'Default', 'My Summary'

  @Column('jsonb')
  config: any; // { columns: [{ id: 'grid', visible: false, width: 100 }, ...], sort: ... }

  @Column({ default: false })
  isDefault: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
