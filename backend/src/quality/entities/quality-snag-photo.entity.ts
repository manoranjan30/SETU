import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, JoinColumn } from 'typeorm';
import { QualityItem } from './quality-item.entity';

export enum SnagPhotoType {
    INITIAL = 'INITIAL',       // Snag creation photo
    RECTIFIED = 'RECTIFIED',   // Contractor rectification photo
    VERIFIED = 'VERIFIED'      // Final verification photo
}

@Entity('quality_snag_photo')
export class QualitySnagPhoto {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    snagId: number;

    @ManyToOne(() => QualityItem, (item) => item.photos, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'snagId' })
    snag: QualityItem; // Keeping property name 'snag' for compatibility with existing queries

    @Column()
    url: string; // S3 or local path

    @Column({
        type: 'enum',
        enum: SnagPhotoType,
        default: SnagPhotoType.INITIAL
    })
    type: SnagPhotoType;

    @Column({ type: 'varchar', nullable: true })
    uploadedBy: string; // User ID or Name

    @CreateDateColumn()
    uploadedAt: Date;
}
