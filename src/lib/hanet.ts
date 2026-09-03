import crypto from 'crypto';

// Cấu trúc payload Hanet gửi kèm mỗi lần gọi webhook. Không phải trường nào cũng có mặt
// ở mọi loại sự kiện - các trường chỉ áp dụng cho data_type = 'log' (check-in) được đánh dấu optional.
export interface HanetWebhookPayload {
  id: string;
  action_type: string;
  data_type: 'log' | 'device' | 'person' | 'place' | string;
  date?: string;
  time?: number | string;
  hash: string;
  keycode?: string;
  placeID?: string;
  placeName?: string;
  deviceID?: string;
  deviceName?: string;
  // Chỉ có khi data_type = 'log'
  personID?: string;
  aliasID?: string;
  personName?: string;
  personTitle?: string;
  personType?: number;
  mask?: number;
  detected_image_url?: string;
}

// personType coi là "đã nhận diện được người, khớp danh sách đã đăng ký".
// Loại trừ: người lạ (2,3,5), body không rõ mặt (4), ảnh chụp thủ công (6), báo cháy (28).
export const HANET_RECOGNIZED_PERSON_TYPES = [0, 1];

/**
 * Xác minh request webhook thực sự đến từ Hanet.
 * Công thức Hanet quy định: hash = MD5(client_secret + id)
 */
export function verifyHanetHash(id: string | undefined, hash: string | undefined, clientSecret: string): boolean {
  if (!id || !hash || !clientSecret) return false;
  const expected = crypto.createHash('md5').update(clientSecret + id).digest('hex');
  return expected.toLowerCase() === hash.toLowerCase();
}

/**
 * Hanet gửi `time` dạng timestamp mili-giây, nhưng để phòng trường hợp gửi dạng chuỗi số,
 * hàm này ép kiểu an toàn. Nếu không parse được, trả về thời điểm hiện tại thay vì crash.
 */
export function parseHanetTime(time: number | string | undefined): Date {
  if (time === undefined || time === null) return new Date();
  const ms = typeof time === 'number' ? time : Number(time);
  const parsed = new Date(ms);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}
