/* eslint-disable prettier/prettier */


import { Injectable, OnModuleDestroy } from '@nestjs/common';
import * as mysql from 'mysql2/promise';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
    private pool: mysql.Pool;

    constructor(private config: ConfigService) {
        this.pool = mysql.createPool({
            host: this.config.get<string>('DB_HOST'),
            user: this.config.get<string>('DB_USER'),
            password: this.config.get<string>('DB_PASSWORD'),
            database: this.config.get<string>('DB_NAME'),

            waitForConnections: true,
            connectionLimit: 20, // 🔥 important
            queueLimit: 100,
            timezone: '+00:00',  // ✅ Tell driver to treat DB times as UTC
            connectTimeout: 10000, // optional safety
        });
    }

    // ✅ Safe query execution
    async query<T = any>(sql: string, params: any[] = []): Promise<T> {
        try {
            // const [result] = await this.pool.execute(sql, params);
            const [result] = params && params.length
                ? await this.pool.execute(sql, params)   // ✅ when params exist
                : await this.pool.query(sql);            // ✅ when no params
            return result as T;
        } catch (error) {
            console.error('❌ DB QUERY ERROR');
            console.error('SQL:', sql);
            console.error('PARAMS:', params);
            console.error('ERROR:', error);
            throw error;
        }
    }

    // ✅ For bulk inserts (supports VALUES ?)
    async bulkQuery<T = any>(sql: string, params: any[] = []): Promise<T> {
        try {
            const [result] = await this.pool.query(sql, params); // ✅ IMPORTANT: query(), not execute()
            return result as T;
        } catch (error) {
            console.error('❌ DB BULK QUERY ERROR');
            console.error('SQL:', sql);
            console.error('PARAMS:', params);
            console.error('ERROR:', error);
            throw error;
        }
    }

    // ⚠️ Use only if you REALLY need manual control (transactions)
    async getConnection(): Promise<mysql.PoolConnection> {
        const connection = await this.pool.getConnection();
        return connection;
    }

    // ✅ Helper for safe transactions (recommended way)
    async transaction<T>(callback: (conn: mysql.PoolConnection) => Promise<T>): Promise<T> {
        const connection = await this.pool.getConnection();

        try {
            await connection.beginTransaction();

            const result = await callback(connection);

            await connection.commit();
            return result;
        } catch (error) {
            await connection.rollback();
            console.error('❌ TRANSACTION ERROR:', error);
            throw error;
        } finally {
            connection.release(); // 🚨 critical
        }
    }

    // ✅ Graceful shutdown
    async onModuleDestroy() {
        if (this.pool) {
            await this.pool.end();
            console.log('MySQL pool closed');
        }
    }
}
