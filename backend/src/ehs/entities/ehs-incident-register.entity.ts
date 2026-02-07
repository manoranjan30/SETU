import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('ehs_incidents_register') // different name to avoid conflict with existing basic incident entity if any
export class EhsIncidentRegister {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @Column()
  month: string; // MMM-YY format or Date

  @Column()
  category: string; // Safety, Health, Environment

  @Column()
  incidentType: string; // First Aid, Near Miss, Dangerous Occurrence, Minor, Major, Fatal

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'date', nullable: true })
  date: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
