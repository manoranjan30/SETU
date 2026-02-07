import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('quality_checklists')
export class QualityChecklist {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @Column()
  checklistName: string; // e.g. Pre-concrete column checklist

  @Column()
  category: string; // Foundations, Structural, MEP, Finishes

  @Column({ type: 'json' })
  items: any; // [{ id: 1, text: "Rebar spacing correct?", checked: true, remarks: "" }, ...]

  @Column({ default: 'Draft' })
  status: string; // Draft, Signed Off, Fail

  @Column({ nullable: true })
  checkedBy: string;

  @Column({ nullable: true })
  approvedBy: string;

  @Column({ type: 'date', nullable: true })
  date: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
