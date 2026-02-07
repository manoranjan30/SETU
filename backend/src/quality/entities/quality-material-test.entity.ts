import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('quality_material_tests')
export class QualityMaterialTest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @Column()
  materialName: string;

  @Column()
  batchNumber: string;

  @Column()
  supplier: string;

  @Column({ type: 'date' })
  receivedDate: string;

  @Column({ type: 'date' })
  testDate: string;

  @Column()
  testType: string; // Cube test, Steel test, Sieve analysis, etc.

  @Column()
  result: string; // Pass, Fail

  @Column({ type: 'text', nullable: true })
  testParameters: string; // Details of the test

  @Column({ default: 'Approved' })
  status: string; // Approved, Rejected, Quarantined

  @Column({ nullable: true })
  reportUrl: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
