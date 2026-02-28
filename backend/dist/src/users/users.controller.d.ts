import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    create(createUserDto: CreateUserDto): Promise<import("./user.entity").User>;
    findAll(): Promise<import("./user.entity").User[]>;
    findOne(id: string): Promise<import("./user.entity").User | null>;
    update(id: string, updateUserDto: any): Promise<import("./user.entity").User | null>;
    saveFcmToken(req: any, body: {
        token: string;
    }): Promise<void>;
    remove(id: string): Promise<void>;
}
