import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { JwtModule } from './common/jwt/jwt.module';
import { SyncModule } from './sync/sync.module';

@Module({
  imports: [SyncModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
