import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToMany,
  JoinTable,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '../roles/role.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  username: string;

  @Column()
  passwordHash: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  displayName: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  designation: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ type: 'text', nullable: true })
  signatureData: string; // Base64 PNG of drawn signature

  @Column({ type: 'text', nullable: true })
  signatureImageUrl: string; // URL of uploaded image signature

  @Column({ nullable: true })
  signatureUpdatedAt: Date;

  @Column({ nullable: true, type: 'text' })
  fcmToken: string | null;

  @Column({ default: false })
  isTempUser: boolean;

  @Column({ default: false })
  isFirstLogin: boolean;

  @ManyToMany(() => Role, (role) => role.users)
  @JoinTable()
  roles: Role[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
