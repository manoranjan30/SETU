import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { DrawingRegister } from './drawing-register.entity';
import { User } from '../../users/user.entity';

@Entity()
@Unique(['registerId', 'userId'])
export class DrawingOpenReceipt {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  registerId: number;

  @ManyToOne(() => DrawingRegister, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'registerId' })
  register: DrawingRegister;

  @Column()
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'int', nullable: true })
  lastOpenedRevisionId: number | null;

  @UpdateDateColumn()
  openedAt: Date;
}
