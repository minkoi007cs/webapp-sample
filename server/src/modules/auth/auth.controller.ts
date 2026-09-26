import { Controller, Get, Patch, UseGuards, Req, Res, Post, Body, Param, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Get('config')
  @ApiOperation({ summary: 'Get public auth configuration for frontend' })
  getAuthConfig() {
    return this.authService.getAuthConfig();
  }

  @Post('supabase')
  @ApiOperation({ summary: 'Exchange Supabase access token for app session' })
  async loginWithSupabase(@Body('token') token: string) {
    if (!token) {
      throw new BadRequestException('Token Supabase không được để trống');
    }
    return this.authService.validateSupabaseToken(token);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@Req() req) {
    return this.authService.getSessionProfile(req.user.id, req.user.familyId ?? null);
  }

  @Patch('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update own profile (fullName, otherNames)' })
  async updateMe(@Req() req, @Body() data: { fullName?: string; otherNames?: string }) {
    return this.authService.updateMe(req.user.id, data);
  }

  @Get('families')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List families available to current user' })
  async listFamilies(@Req() req) {
    return this.authService.listUserFamilies(req.user.id);
  }

  @Post('switch-family')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Switch active family for the current session' })
  async switchFamily(@Req() req, @Body('familyId') familyId: string) {
    return this.authService.switchActiveFamily(req.user.id, familyId);
  }

  @Post('create-family')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new family and switch to it' })
  async createFamily(@Req() req, @Body('name') name?: string) {
    return this.authService.createNewFamily(req.user.id, name);
  }

  @Post('accept-invite')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Accept a family invite token' })
  async acceptInvite(@Req() req, @Body('token') token: string) {
    return this.authService.acceptInvite(req.user.id, token);
  }

  @Get('invite/:token')
  @ApiOperation({ summary: 'Preview an invite before logging in (public, no auth required)' })
  async previewInvite(@Param('token') token: string) {
    return this.authService.previewInvite(token);
  }
}
