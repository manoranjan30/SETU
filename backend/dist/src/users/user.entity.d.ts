import { Role } from '../roles/role.entity';
export declare class User {
    id: number;
    username: string;
    passwordHash: string;
    isActive: boolean;
    fcmToken: string | null;
    roles: Role[];
    createdAt: Date;
    updatedAt: Date;
}
