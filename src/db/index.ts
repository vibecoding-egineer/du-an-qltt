import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema.js';

// Add global connection pool caching to persist across hot-reloads
declare global {
  var _mysqlPool: mysql.Pool | undefined;
}

// Function to create or retrieve the connection pool.
export const createPool = (): mysql.Pool => {
  if (!global._mysqlPool) {
    global._mysqlPool = mysql.createPool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      port: process.env.SQL_PORT ? Number(process.env.SQL_PORT) : 3306,

      // BẮT BUỘC: máy chủ MariaDB của hosting đang để mặc định latin1 (cp1252),
      // bảng mã đó KHÔNG chứa được tiếng Việt có dấu. Nếu thiếu dòng này, tên học viên
      // và các chuỗi tiếng Việt sẽ lưu thành ký tự rác mà không báo lỗi gì.
      charset: 'utf8mb4',

      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 15000,
    });
  }
  return global._mysqlPool;
};

// Create or retrieve the pool instance.
const pool = createPool();

// mysql2 tự phát hiện và thay thế kết nối lỗi bên trong pool (khác pg cần tự bắt để
// tránh sập tiến trình), nhưng vẫn lắng nghe để ghi log phục vụ chẩn đoán sự cố.
// Kiểm tra `typeof` trước vì lớp bọc promise của mysql2 không cam kết có sẵn `on`.
const poolEmitter = pool as unknown as { on?: (event: string, listener: (err: unknown) => void) => void };
if (typeof poolEmitter.on === 'function') {
  poolEmitter.on('error', (err: unknown) => {
    console.error('Unexpected error on idle SQL pool connection:', err);
  });
}

// Initialize Drizzle with the pool and schema.
export const db = drizzle(pool, { schema, mode: 'default' });
