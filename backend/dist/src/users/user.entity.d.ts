import { Role } from '../roles/role.entity';
export declare class User {
    id: number;
    username: string;
    passwordHash: string;
    isActive: boolean;
    displayName: string;
    email: string;
    designation: string;
    phone: string;
    signatureData: string;
    signatureImageUrl: string;
    signatureUpdatedAt: Date;
    fcmToken: string | null;
    isTempUser: boolean;
    isFirstLogin: boolean;
    roles: Role[];
    createdAt: Date;
    updatedAt: Date;
}
