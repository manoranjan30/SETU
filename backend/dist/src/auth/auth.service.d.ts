import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ProjectAssignmentService } from '../projects/project-assignment.service';
export declare class AuthService {
    private usersService;
    private jwtService;
    private assignmentService;
    constructor(usersService: UsersService, jwtService: JwtService, assignmentService: ProjectAssignmentService);
    validateUser(username: string, pass: string): Promise<any>;
    login(user: any): Promise<{
        access_token: string;
        user: {
            id: any;
            username: any;
            roles: any;
            permissions: string[];
            project_ids: number[];
            isTempUser: any;
            isFirstLogin: any;
        };
    }>;
}
