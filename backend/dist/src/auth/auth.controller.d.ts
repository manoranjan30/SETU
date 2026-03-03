import { AuthService } from './auth.service';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    login(req: any): Promise<{
        access_token: string;
        user: {
            id: any;
            username: any;
            displayName: any;
            roles: any;
            permissions: string[];
            project_ids: number[];
            isTempUser: any;
            isFirstLogin: any;
        };
    }>;
    getProfile(req: any): any;
    debug(): Promise<{
        message: string;
        valid: boolean;
        user: string;
    }>;
}
