import { eq, inArray, type SQL } from 'drizzle-orm';
import type {
  MySqlTable,
  MySqlColumn,
  MySqlInsertValue,
  MySqlUpdateSetSource,
} from 'drizzle-orm/mysql-core';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import * as schema from './schema.js';

/*
 * ============================================================================
 * THAY THẾ CHO `.returning()` CỦA POSTGRESQL
 * ============================================================================
 * MySQL/MariaDB không hỗ trợ mệnh đề RETURNING, và Drizzle bản MySQL cũng không có
 * phương thức `.returning()`. Hai hàm dưới đây làm thay công việc đó.
 *
 * VÌ SAO PHẢI DÙNG HÀM CHUNG THAY VÌ VIẾT TAY TỪNG CHỖ:
 * Cách viết tay tự nhiên nhất là "cập nhật xong rồi truy vấn lại bằng chính điều kiện cũ".
 * Cách đó SAI với các thao tác xóa mềm: sau khi đặt isDeleted = true, truy vấn lại bằng
 * điều kiện có isDeleted = false sẽ KHÔNG tìm thấy gì, khiến API trả về rỗng dù thao tác
 * đã thành công - một lỗi âm thầm, rất khó phát hiện khi test qua loa.
 *
 * `updateReturning` chốt danh sách ID TRƯỚC khi cập nhật. ID không bao giờ thay đổi,
 * nên bước đọc lại luôn tìm thấy bản ghi bất kể lần cập nhật đã làm gì. Nhờ vậy lỗi trên
 * KHÔNG THỂ xảy ra về mặt cấu trúc, thay vì phải trông chờ người viết nhớ cẩn thận.
 * ============================================================================
 */

type Database = MySql2Database<typeof schema>;
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/** Cho phép truyền `db` thông thường, hoặc `tx` khi đang ở trong một transaction. */
export type Executor = Database | Transaction;

/**
 * Mọi bảng trong schema này đều có khóa chính `id` kiểu int, nên các hàm bên dưới
 * yêu cầu bảng truyền vào phải có cột `id`.
 */
type TableWithId = MySqlTable & { id: MySqlColumn };

/**
 * Cập nhật rồi trả về các bản ghi SAU khi cập nhật.
 * Tương đương `db.update(...).set(...).where(...).returning()` của bản PostgreSQL.
 *
 * Trả về mảng rỗng nếu không có bản ghi nào khớp điều kiện - dùng `result.length === 0`
 * để biết "không tìm thấy", giống hệt cách bản PostgreSQL đang kiểm tra.
 */
export async function updateReturning<TTable extends TableWithId>(
  executor: Executor,
  table: TTable,
  values: MySqlUpdateSetSource<TTable>,
  where: SQL | undefined,
): Promise<TTable['$inferSelect'][]> {
  // BƯỚC 1 - Chốt danh sách ID TRƯỚC khi thay đổi bất cứ thứ gì. Đây là mấu chốt an toàn.
  const targets = await executor.select({ id: table.id }).from(table).where(where);
  if (targets.length === 0) return [];

  // Ép kiểu tại đây vì TypeScript không suy luận được kiểu dữ liệu cột qua generic.
  // Giá trị thực tế luôn đúng: mọi bảng trong schema đều khai `id: int(...)`.
  const ids = targets.map((row) => row.id as number);

  // BƯỚC 2 - Cập nhật đúng những bản ghi đã chốt, không dùng lại điều kiện ban đầu.
  await executor.update(table).set(values).where(inArray(table.id, ids));

  // BƯỚC 3 - Đọc lại theo ID. Luôn tìm thấy, kể cả khi bản ghi vừa bị đánh dấu xóa mềm.
  const rows = await executor.select().from(table).where(inArray(table.id, ids));
  return rows as TTable['$inferSelect'][];
}

/**
 * Thêm MỘT bản ghi rồi trả về chính bản ghi vừa tạo (đã có id và các giá trị mặc định
 * do database sinh ra). Tương đương `db.insert(...).values(...).returning()`.
 *
 * CHỈ DÙNG CHO THÊM 1 BẢN GHI. Khi thêm nhiều bản ghi cùng lúc, MySQL chỉ trả về id của
 * bản ghi ĐẦU TIÊN, nên không thể suy ra toàn bộ - trường hợp đó phải xử lý riêng
 * (xem route nhập học viên hàng loạt trong server.ts).
 */
export async function insertReturning<TTable extends TableWithId>(
  executor: Executor,
  table: TTable,
  values: MySqlInsertValue<TTable>,
): Promise<TTable['$inferSelect'] | undefined> {
  const [result] = await executor.insert(table).values(values);
  const rows = await executor.select().from(table).where(eq(table.id, result.insertId));
  return rows[0] as TTable['$inferSelect'] | undefined;
}
