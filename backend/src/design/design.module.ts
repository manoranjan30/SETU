
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DesignController } from './design.controller';
import { DesignService } from './design.service';
import { DrawingCategory } from './entities/drawing-category.entity';
import { DrawingRegister } from './entities/drawing-register.entity';
import { DrawingRevision } from './entities/drawing-revision.entity';
import { User } from '../users/user.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            DrawingCategory,
            DrawingRegister,
            DrawingRevision,
            User // Needed to validate users
        ])
    ],
    controllers: [DesignController],
    providers: [DesignService],
    exports: [DesignService]
})
export class DesignModule { }
