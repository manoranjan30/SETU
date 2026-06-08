import { Body, Controller, Request, Post, UseGuards, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport'; // We will use a custom JwtAuthGuard later, but for login we might use LocalAuthGuard

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @UseGuards(AuthGuard('local')) // Add this guard to use the local strategy
  @Post('login')
  async login(@Request() req) {
    // Passport Local Strategy populates req.user
    return this.authService.login(req.user, {
      ipAddress:
        req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
        req?.ip ||
        req?.socket?.remoteAddress ||
        null,
      userAgent: req?.headers?.['user-agent'] || null,
    });
  }

  @Post('login/verify-otp')
  async verifyOtp(
    @Body() body: { challengeId?: string; otp?: string },
  ) {
    return this.authService.verifyEmailOtp(
      String(body.challengeId || ''),
      String(body.otp || ''),
    );
  }

  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  getProfile(@Request() req) {
    return req.user;
  }
}
