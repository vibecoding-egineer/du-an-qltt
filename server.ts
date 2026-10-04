/**
 * server.ts — điểm khởi tạo duy nhất.
 *
 * Mỗi nhóm route nằm trong file riêng ở src/routes/. File này chỉ làm 3 việc:
 *   1. Tạo Express app
 *   2. Gọi hàm đăng ký route của từng file
 *   3. Gắn Vite dev server (dev) hoặc phục vụ file tĩnh (production)
 */
import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

// --- Route modules ---
import { registerAuthRoutes } from "./src/routes/auth.js";
import { registerUserRoutes } from "./src/routes/users.js";
import { registerSettingsRoutes } from "./src/routes/settings.js";
import { registerBranchRoutes } from "./src/routes/branches.js";
import { registerShiftRoutes } from "./src/routes/shifts.js";
import { registerClassScheduleRoutes } from "./src/routes/classSchedules.js";
import { registerClassRoutes } from "./src/routes/classes.js";
import { registerStudentRoutes } from "./src/routes/students.js";
import { registerAttendanceRoutes } from "./src/routes/attendance.js";
import { registerHanetRoutes } from "./src/routes/hanetWebhook.js";
import { registerTransactionRoutes } from "./src/routes/transactions.js";
import { registerPromotionRoutes } from "./src/routes/promotions.js";
import { registerStaffShiftRoutes } from "./src/routes/staffShifts.js";
import { registerStaffAttendanceRoutes } from "./src/routes/staffAttendance.js";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

  app.use(express.json());

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Đăng ký route theo đúng thứ tự ưu tiên:
  // - Auth & onboarding trước (cần cho mọi thao tác tiếp theo)
  // - Webhook Hanet là route CÔNG KHAI, không qua requireAuth
  // - Còn lại là các nhóm nghiệp vụ, thứ tự không ảnh hưởng
  registerAuthRoutes(app);
  registerHanetRoutes(app);
  registerUserRoutes(app);
  registerSettingsRoutes(app);
  registerBranchRoutes(app);
  registerShiftRoutes(app);
  registerClassScheduleRoutes(app);
  registerClassRoutes(app);
  registerStudentRoutes(app);
  registerAttendanceRoutes(app);
  registerTransactionRoutes(app);
  registerPromotionRoutes(app);
  registerStaffShiftRoutes(app);
  registerStaffAttendanceRoutes(app);

  // Mock inventory (giữ lại cho tương lai)
  app.get("/api/inventory", (_req, res) => {
    res.json({
      items: [
        { id: "HH01", name: "Giáo trình Tiếng Anh cơ bản", stock: 150, branch: "Cơ sở 1" },
        { id: "HH02", name: "Máy chiếu", stock: 5, branch: "Cơ sở 1" },
        { id: "HH03", name: "Bút lông", stock: 200, branch: "Cơ sở 2" },
      ],
    });
  });

  // --- Vite / Static ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
