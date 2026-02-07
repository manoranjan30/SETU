import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('labor_excel_mappings')
export class LaborExcelMapping {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @Column()
  mappingName: string; // e.g., "ABC Contractor Format"

  @Column({ type: 'json' })
  columnMappings: any; // { "Carpenter Header": categoryId, ... }

  @CreateDateColumn()
  createdOn: Date;

  @UpdateDateColumn()
  updatedOn: Date;
}
