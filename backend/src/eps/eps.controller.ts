import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EpsService } from './eps.service';
import { CreateEpsNodeDto } from './dto/create-eps-node.dto';
import { UpdateEpsNodeDto } from './dto/update-eps-node.dto';
import { UpdateProjectProfileDto } from './dto/update-project-profile.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('eps')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EpsController {
  constructor(private readonly epsService: EpsService) { }

  @Get(':id/profile')
  getProfile(@Param('id', ParseIntPipe) id: number) {
    return this.epsService.getProfile(id);
  }

  @Patch(':id/profile')
  @Roles('Admin') // Or Project Manager
  updateProfile(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProfileDto: UpdateProjectProfileDto,
    @Request() req,
  ) {
    return this.epsService.updateProfile(id, updateProfileDto, req.user);
  }

  @Post('import')
  @Roles('Admin')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(@UploadedFile() file: Express.Multer.File, @Request() req) {
    return this.epsService.importCsv(file.buffer, req.user);
  }

  @Post()
  @Roles('Admin')
  create(@Body() createEpsDto: CreateEpsNodeDto, @Request() req) {
    return this.epsService.create(createEpsDto, req.user);
  }

  // New Endpoint for Tree
  @Get(':id/tree')
  getProjectTree(@Param('id', ParseIntPipe) id: number) {
    return this.epsService.getProjectTree(id);
  }

  @Get()
  async findAll(@Request() req) {
    try {
      return await this.epsService.findAll(req.user);
    } catch (e) {
      console.error('EPS CONTROLLER ERROR:', e);
      return [];
    }
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.epsService.findOne(id);
  }

  @Patch(':id')
  @Roles('Admin')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEpsDto: UpdateEpsNodeDto,
    @Request() req,
  ) {
    return this.epsService.update(id, updateEpsDto, req.user);
  }

  @Delete(':id')
  @Roles('Admin')
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.epsService.remove(id, req.user);
  }
}
