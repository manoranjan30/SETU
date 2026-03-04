import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CustomDashboard } from './custom-dashboard.entity';

@Entity('dashboard_widget')
export class DashboardWidget {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  dashboardId: number;

  @ManyToOne(() => CustomDashboard, (dashboard) => dashboard.widgets, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'dashboardId' })
  dashboard: CustomDashboard;

  @Column({ type: 'varchar', length: 50 })
  widgetType: string; // KPI, BAR, LINE, PIE, DONUT, TABLE, etc.

  @Column()
  title: string;

  @Column({ type: 'varchar', length: 100 })
  dataSourceKey: string;

  @Column({ type: 'jsonb', nullable: true })
  queryConfig: any; // filters, groupBy, limit

  @Column({ type: 'jsonb', nullable: true })
  displayConfig: any; // colors, labels

  @Column({ type: 'jsonb', nullable: true })
  gridPosition: any; // x, y, w, h

  @Column({ default: 0 })
  refreshIntervalSec: number;

  @Column({ default: 0 })
  sortOrder: number;
}
