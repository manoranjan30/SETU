import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('labor_categories')
export class LaborCategory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string; // e.g., Carpenter, Barbender, Mason

  @Column({ nullable: true })
  categoryGroup: string; // e.g., Skilled, Semi-Skilled, Unskilled

  @Column({ nullable: true })
  projectId: number; // Nullable for global categories/templates

  @CreateDateColumn()
  createdOn: Date;

  @UpdateDateColumn()
  updatedOn: Date;
}
