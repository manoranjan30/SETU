import {
  Controller,
  Request,
  Post,
  UseGuards,
  Get,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport'; // We will use a custom JwtAuthGuard later, but for login we might use LocalAuthGuard

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
}
