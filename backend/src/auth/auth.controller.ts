import {
  Controller,
  Request,
  Post,
  UseGuards,
  Get,
  Body,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport'; // We will use a custom JwtAuthGuard later, but for login we might use LocalAuthGuard
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @UseGuards(AuthGuard('local')) // Add this guard to use the local strategy
  @Post('login')
  async login(@Request() req) {
    // Passport Local Strategy populates req.user
    return this.authService.login(req.user);
  }

  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  getProfile(@Request() req) {
    return req.user;
  }
  @Get('debug')
  async debug() {
    // TEMP DEBUG
    const user = await this.authService.validateUser('admin', 'password123');
    return {
      message: 'Debug Admin Admin',
      valid: !!user,
      user: user ? 'Found' : 'Not Found',
    };
  }
}
