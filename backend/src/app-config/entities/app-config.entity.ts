import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('app_config')
export class AppConfig {
  @PrimaryGeneratedColumn()
  id: number;

  /** 'android' or 'ios' */
  @Column({ default: 'android' })
  platform: string;

  /** The latest published version string, e.g. "1.2.0" */
  @Column({ default: '1.0.0' })
  latestVersion: string;

  /** Minimum supported version — below this triggers a forced update dialog */
  @Column({ default: '1.0.0' })
  minimumVersion: string;

  /** When true, all users are forced to update regardless of version */
  @Column({ default: false })
  forceUpdate: boolean;

  /** Custom message shown in the update dialog */
  @Column({ nullable: true, type: 'text' })
  updateMessage: string | null;

  /** Direct APK download URL or Play Store link */
  @Column({ nullable: true, type: 'text' })
  updateUrl: string | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
