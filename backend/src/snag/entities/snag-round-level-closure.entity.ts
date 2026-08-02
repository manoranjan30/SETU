import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { SnagRound } from './snag-round.entity';

@Entity('snag_round_level_closure')
@Unique('UQ_snag_round_level_closure_round_level', [
  'snagRoundId',
  'levelOrder',
])
export class SnagRoundLevelClosure {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'snag_round_id' })
  snagRoundId: number;

  @ManyToOne(() => SnagRound, (round) => round.levelClosures, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'snag_round_id' })
  snagRound: SnagRound;

  @Column({ name: 'level_order', type: 'int' })
  levelOrder: number;

  @Column({ name: 'level_name', type: 'varchar', length: 255 })
  levelName: string;

  @Column({ name: 'closed_by_id', type: 'int', nullable: true })
  closedById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'closed_by_id' })
  closedBy: User | null;

  @Column({ name: 'closed_at', type: 'timestamp', nullable: true })
  closedAt: Date | null;

  @Column({ name: 'signature_data', type: 'text', nullable: true })
  signatureData: string | null;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
