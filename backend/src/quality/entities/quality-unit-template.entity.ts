import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('quality_unit_template')
export class QualityUnitTemplate {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    projectId: number;

    @Column()
    name: string; // e.g. "2BHK Type A"

    @Column('simple-json')
    structure: {
        rooms: string[]; // List of room names
        attributes?: Record<string, any>; // Custom attributes if needed
    };

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
