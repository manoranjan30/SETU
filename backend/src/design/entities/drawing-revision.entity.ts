
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { DrawingRegister } from './drawing-register.entity';
import { User } from '../../users/user.entity';

export enum RevisionStatus {
    DRAFT = 'DRAFT',
    SUBMITTED = 'SUBMITTED',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED'
}

@Entity()
export class DrawingRevision {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    registerId: number;

    @ManyToOne(() => DrawingRegister, (register) => register.revisions)
    @JoinColumn({ name: 'registerId' })
    register: DrawingRegister;

    @Column()
    revisionNumber: string; // e.g., "0", "A", "B", "1"

    @Column()
    filePath: string; // Physical path on disk relative to upload root

    @Column()
    originalFileName: string;

    @Column({ nullable: true })
    fileSize: number; // In bytes

    @Column({ nullable: true })
    fileType: string; // MIME type

    @Column({
        type: 'enum',
        enum: RevisionStatus,
        default: RevisionStatus.DRAFT
    })
    status: RevisionStatus;

    @Column({ nullable: true })
    comments: string;

    @Column()
    uploadedById: number;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'uploadedById' })
    uploadedBy: User;

    @CreateDateColumn()
    uploadedAt: Date;
}
