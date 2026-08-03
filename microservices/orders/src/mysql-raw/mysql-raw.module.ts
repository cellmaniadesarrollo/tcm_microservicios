import { Module } from '@nestjs/common';
import { createPool } from 'mysql2/promise';
@Module({
    providers: [
        {
            provide: 'MYSQL_READ_ONLY',
            useFactory: async () => {
                return await createPool({
                    host: process.env.MYSQL_DB_HOST1,     // host.docker.internal
                    user: process.env.MYSQL_DB_USER,
                    password: process.env.MYSQL_DB_PASSWORD,
                    database: process.env.MYSQL_DB_NAME,
                    port: Number(process.env.MYSQL_DB_PORT),
                    waitForConnections: true,
                    connectionLimit: 10,
                });
            },
        },
    ],
    exports: ['MYSQL_READ_ONLY'],
})
export class MysqlRawModule {

}
