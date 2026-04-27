import 'reflect-metadata';
import { DataSource, type LoggerOptions } from 'typeorm';
import { join } from 'path';

const logging =
  ((process.env.TYPEORM_LOGGING?.split(',')
    .map((value) => value.trim())
    .filter(Boolean) as LoggerOptions) ??
    (['error', 'warn', 'schema', 'migration'] as LoggerOptions));

export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USER || 'admin',
  password: process.env.DATABASE_PASSWORD || 'password',
  database: process.env.DATABASE_NAME || 'setu_db',
  entities: [join(__dirname, '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  logging,
  synchronize: false,
});
