"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_entity_1 = require("./user.entity");
const bcrypt = __importStar(require("bcryptjs"));
let UsersService = class UsersService {
    usersRepository;
    constructor(usersRepository) {
        this.usersRepository = usersRepository;
    }
    async create(createUserDto) {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(createUserDto.password, salt);
        const roles = createUserDto.roles
            ? createUserDto.roles.map((id) => ({ id }))
            : [];
        const user = this.usersRepository.create({
            username: createUserDto.username,
            passwordHash,
            isActive: createUserDto.isActive ?? true,
            roles,
        });
        return this.usersRepository.save(user);
    }
    async findOne(username) {
        return this.usersRepository.findOne({
            where: { username },
            relations: ['roles', 'roles.permissions'],
        });
    }
    async findById(id) {
        return this.usersRepository.findOne({
            where: { id },
            relations: ['roles'],
        });
    }
    async findAll() {
        return this.usersRepository.find({ relations: ['roles'] });
    }
    async update(id, updateUserDto) {
        const user = await this.usersRepository.findOne({
            where: { id },
            relations: ['roles'],
        });
        if (!user)
            return null;
        if (updateUserDto.password) {
            const salt = await bcrypt.genSalt(10);
            user.passwordHash = await bcrypt.hash(updateUserDto.password, salt);
        }
        if (updateUserDto.isActive !== undefined) {
            user.isActive = updateUserDto.isActive;
        }
        if (updateUserDto.roles) {
            user.roles = updateUserDto.roles.map((rId) => ({ id: rId }));
        }
        return this.usersRepository.save(user);
    }
    async getProfile(id) {
        const user = await this.usersRepository.findOne({
            where: { id },
            relations: ['roles'],
        });
        if (!user)
            throw new common_1.ForbiddenException('User not found');
        const { passwordHash, ...safeUser } = user;
        return safeUser;
    }
    async updateProfile(id, updateData) {
        const user = await this.usersRepository.findOneBy({ id });
        if (!user) {
            throw new common_1.NotFoundException(`User with ID ${id} not found`);
        }
        Object.assign(user, updateData);
        return this.usersRepository.save(user);
    }
    async changePassword(id, oldPassword, newPassword) {
        const user = await this.usersRepository.findOneBy({ id });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        if (!user.isFirstLogin && oldPassword) {
            const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
            if (!isMatch)
                throw new common_1.BadRequestException('Incorrect current password');
        }
        user.passwordHash = await bcrypt.hash(newPassword, 10);
        user.isFirstLogin = false;
        return this.usersRepository.save(user);
    }
    async getSignature(id) {
        const user = await this.usersRepository.findOne({ where: { id } });
        if (!user)
            throw new common_1.ForbiddenException('User not found');
        return {
            signatureData: user.signatureData,
            signatureImageUrl: user.signatureImageUrl,
            signatureUpdatedAt: user.signatureUpdatedAt,
        };
    }
    async updateSignature(id, signatureData, signatureImageUrl) {
        console.log(`[UsersService] Updating signature for UserID: ${id}`);
        try {
            const user = await this.usersRepository.findOne({ where: { id } });
            if (!user) {
                console.error(`[UsersService] User not found (ID: ${id})`);
                throw new common_1.ForbiddenException('User not found');
            }
            const updateData = {
                signatureData: signatureData,
                signatureUpdatedAt: new Date(),
            };
            if (signatureImageUrl !== undefined) {
                updateData.signatureImageUrl = signatureImageUrl;
            }
            const updateResult = await this.usersRepository.update(id, updateData);
            console.log(`[UsersService] Database updated rows: ${updateResult.affected}`);
            return { success: true };
        }
        catch (error) {
            console.error(`[UsersService] Database error while updating signature:`, error);
            throw error;
        }
    }
    async saveFcmToken(userId, token) {
        await this.usersRepository.update(userId, { fcmToken: token });
    }
    async remove(id) {
        const user = await this.usersRepository.findOneBy({ id });
        if (user && user.username === 'admin') {
            throw new common_1.ForbiddenException('Cannot delete the Admin user');
        }
        await this.usersRepository.delete(id);
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], UsersService);
//# sourceMappingURL=users.service.js.map