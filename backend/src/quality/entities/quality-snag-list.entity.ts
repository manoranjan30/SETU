import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('quality_snag_list')
export class QualitySnagList {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @Column()
  zone: string; // Wing A, Wing B

  @Column()
  floor: string;

  @Column()
  unit: string; // Flat No.

  @Column()
  room: string; // Kitchen, Living, Bed1

  @Column({ type: 'text' })
  defectDescription: string;

  @Column()
  trade: string; // Painting, Flooring, Plumbing

  @Column({ default: 'Open' })
  status: string; // Open, Resolved, Verified, Closed

  @Column({ nullable: true })
  assignedTo: string;

  @Column({ type: 'date', nullable: true })
  completionDate: string;

  @Column({ nullable: true })
  attachmentUrl: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
