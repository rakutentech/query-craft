export interface DatabaseConfig {
  type: 'sqlite' | 'mysql';
  mysql?: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
} 
export const databaseConfig: DatabaseConfig = {
  type: process.env.ENABLE_MYSQL === 'true' ? 'mysql' : 'sqlite',
  mysql: process.env.ENABLE_MYSQL === 'true' ? {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || ''
  } : undefined
};
