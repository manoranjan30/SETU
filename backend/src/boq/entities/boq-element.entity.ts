import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { EpsNode } from '../../eps/eps.entity';

@Entity()
export class BoqElement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  // The "Home" of this quantity (e.g., Tower A)
  @ManyToOne(() => EpsNode, { onDelete: 'CASCADE' })
  epsNode: EpsNode;

  @Column()
  boqCode: string; // e.g., "CONC-FTG-001"

  @Column()
  boqName: string; // Renamed from description to match user request

  @Column()
  unitOfMeasure: string;

  @Column('decimal', { precision: 12, scale: 2 })
  totalQuantity: number; // The Budget

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  consumedQuantity: number; // Rolled up from Execution Contexts

  @Column({ nullable: true })
  geometryRefId: string; // For BIM linking
}
