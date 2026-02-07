
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';

@Entity()
export class DrawingCategory {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string; // e.g., "Architectural", "Structural"

    @Column({ unique: true })
    code: string; // e.g., "ARCH", "STR"

    // Optional: Global vs Project Specific. For now, let's treat them as global standard lists or scoped by a project relation if needed.
    // Ideally, they are standard across the organization.
    @Column({ default: true })
    isActive: boolean;

    @ManyToOne(() => DrawingCategory, (category) => category.children, { nullable: true })
    parent: DrawingCategory;

    @OneToMany(() => DrawingCategory, (category) => category.parent)
    children: DrawingCategory[];
}
