import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles('Admin') // Example
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  // ===== MY PROFILE =====

  @Get('me')
  getProfile(@Request() req) {
    return this.usersService.getProfile(+req.user.id);
  }

  @Put('me')
  updateProfile(@Request() req, @Body() body: any) {
    return this.usersService.updateProfile(+req.user.id, body);
  }

  @Put('me/password')
  changePassword(@Request() req, @Body() body: any) {
    return this.usersService.changePassword(
      +req.user.id,
      body.oldPassword,
      body.newPassword,
    );
  }

  @Get('me/signature')
  getSignature(@Request() req) {
    return this.usersService.getSignature(+req.user.id);
  }

  @Put('me/signature')
  async updateSignature(
    @Request() req,
    @Body() body: { signatureData: string; signatureImageUrl?: string },
  ) {
    const userId = req.user?.id;
    console.log(
      `[UsersController] PUT /me/signature requested by UserID: ${userId}`,
    );

    if (!body.signatureData && !body.signatureImageUrl) {
      console.warn(
        `[UsersController] Rejecting request: No signature data provided.`,
      );
      return { success: false, message: 'No signature data provided' };
    }

    try {
      const result = await this.usersService.updateSignature(
        +userId,
        body.signatureData,
        body.signatureImageUrl,
      );
      console.log(
        `[UsersController] Signature updated successfully for UserID: ${userId}`,
      );
      return result;
    } catch (error) {
      console.error(
        `[UsersController] Failed to update signature for UserID: ${userId}:`,
        error.message,
      );
      throw error;
    }
  }

  // ======================

  @Get('list')
  findAllForList() {
    return this.usersService.findAll();
  }

  @Get()
  @Roles('Admin')
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findById(+id);
  }

  @Put(':id')
  @Roles('Admin')
  update(@Param('id') id: string, @Body() updateUserDto: any) {
    return this.usersService.update(+id, updateUserDto);
  }

  @Post('fcm-token')
  saveFcmToken(@Request() req, @Body() body: { token: string }) {
    return this.usersService.saveFcmToken(+req.user.id, body.token);
  }

  @Delete('fcm-token')
  clearFcmToken(@Request() req) {
    return this.usersService.clearFcmToken(+req.user.id);
  }

  @Delete(':id')
  @Roles('Admin')
  remove(@Param('id') id: string) {
    return this.usersService.remove(+id);
  }
}
