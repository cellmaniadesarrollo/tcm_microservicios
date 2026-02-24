import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { GroupsGuard } from '../guards/groups.guard';
import { FeaturesGuard } from '../guards/features.guard';
export const Auth = () => UseGuards(JwtAuthGuard, GroupsGuard, FeaturesGuard);