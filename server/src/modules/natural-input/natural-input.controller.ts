import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { NaturalInputService } from './natural-input.service';

@ApiTags('Natural Input')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('natural-input')
export class NaturalInputController {
  constructor(private readonly naturalInputService: NaturalInputService) {}

  @Post('parse')
  @ApiOperation({ summary: 'Parse natural Vietnamese language input' })
  async parse(@Req() req, @Body() body: { message: string }) {
    const groupId = req.user.groupId || req.user.familyId;
    return this.naturalInputService.parseWithUser(body.message, groupId, req.user.id);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get natural input history for the group' })
  async getHistory(@Req() req) {
    const groupId = req.user.groupId || req.user.familyId;
    return this.naturalInputService.getHistory(groupId);
  }
}
