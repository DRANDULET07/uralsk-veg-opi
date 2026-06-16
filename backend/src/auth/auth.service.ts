import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DatabaseService } from '../database/database.service';

export type AuthRole = 'owner' | 'worker';

export type AuthUser = {
  id: string;
  email: string;
  role: AuthRole;
};

type AdminProfileRow = {
  id: string;
  email: string | null;
  role: string | null;
};

@Injectable()
export class AuthService {
  private supabase?: SupabaseClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {}

  async verifyToken(token: string): Promise<AuthUser> {
    const { data, error } = await this.getSupabaseClient().auth.getUser(token);

    if (error || !data.user) {
      throw new UnauthorizedException('Invalid authorization token');
    }

    const profile = await this.getAdminProfile(data.user.id);

    return {
      id: data.user.id,
      email: data.user.email ?? profile.email ?? '',
      role: profile.role,
    };
  }

  private getSupabaseClient() {
    if (this.supabase) {
      return this.supabase;
    }

    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const serviceRoleKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

    if (!supabaseUrl || !serviceRoleKey) {
      throw new ServiceUnavailableException('Supabase auth is not configured');
    }

    this.supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    return this.supabase;
  }

  private async getAdminProfile(userId: string) {
    const result = await this.databaseService.query<AdminProfileRow>(
      `
        select id, email, role
        from public.admin_profiles
        where id = $1
        limit 1
      `,
      [userId],
    );
    const profile = result.rows[0];

    if (!profile) {
      throw new ForbiddenException('Admin profile was not found');
    }

    if (!this.isAuthRole(profile.role)) {
      throw new ForbiddenException('Admin role is not allowed');
    }

    return {
      id: profile.id,
      email: profile.email,
      role: profile.role,
    };
  }

  private isAuthRole(role: string | null): role is AuthRole {
    return role === 'owner' || role === 'worker';
  }
}
