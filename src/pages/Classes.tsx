import React, { useEffect, useState } from "react";
import { Plus, GraduationCap, Search, Trash2 } from "lucide-react";
import { auth } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";

interface ClassData {
  id: number;
  branchId: number;
  teacherId: number | null;
  name: string;
  program: string | null;
  tuition: number | null;
  feeMethod: 'per_session' | 'per_course';
  sessionsPerMonth: number | null;
  studentCount?: number;
}

interface Branch {
  id: number;
  name: string;
}

interface User {
  id: number;
  name: string | null;
  role: string;
}

export function Classes() {
  const { dbUser } = useAuth();
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    branchId: "",
    teacherId: "",
    program: "",
    tuition: "",
    feeMethod: "per_session",
    sessionsPerMonth: "",
  });

  const fetchData = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };
      
      const [classesRes, branchesRes, usersRes] = await Promise.all([
        fetch("/api/classes", { headers }),
        fetch("/api/branches", { headers }),
        fetch("/api/users", { headers })
      ]);
      
      if (classesRes.ok) setClasses(await classesRes.json());
      if (branchesRes.ok) setBranches(await branchesRes.json());
      if (usersRes.ok) {
         const users = await usersRes.json();
         setTeachers(users.filter((u: User) => u.role === 'teacher'));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setFormData({ name: "", branchId: "", teacherId: "", program: "", tuition: "", feeMethod: "per_session", sessionsPerMonth: "" });
        setShowModal(false);
        setError(null);
        fetchData();
      } else {
        const data = await res.json();
        setError(data.error || "Tạo lớp học thất bại.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Có lỗi xảy ra");
    }
  };

  const getBranchName = (id: number) => {
    return branches.find(b => b.id === id)?.name || "Không xác định";
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/classes/${editingClass.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(editingClass)
      });
      if (res.ok) {
        setEditingClass(null);
        setError(null);
        fetchData();
      } else {
        const data = await res.json();
        setError(data.error || "Cập nhật lớp học thất bại.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Có lỗi xảy ra");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/classes/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setEditingClass(null);
        setConfirmDelete(false);
        setError(null);
        fetchData();
      } else {
        const data = await res.json();
        setError(data.error || "Không thể xóa lớp học.");
        setConfirmDelete(false);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Đã xảy ra lỗi khi xóa lớp học.");
      setConfirmDelete(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Quản lý Lớp học</h2>
          <p className="mt-1 text-sm text-slate-500">
            Quản lý danh sách các lớp học tại trung tâm.
          </p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500"
        >
          <Plus className="h-4 w-4" />
          Tạo lớp
        </button>
      </div>

      <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="border-b border-slate-200 p-4">
          <div className="relative max-w-md">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              className="block w-full rounded-md border-0 py-1.5 pl-10 pr-3 text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
              placeholder="Tìm kiếm lớp học..."
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Tên lớp</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Cơ sở</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Giáo viên</th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">Sĩ số</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Chương trình học</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Số buổi/tháng</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Hình thức thu</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Học phí</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-sm text-slate-500">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : classes.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-sm text-slate-500">
                    Chưa có lớp học nào.
                  </td>
                </tr>
              ) : (
                classes.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-indigo-100 text-indigo-600">
                          <GraduationCap className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-medium text-slate-900">{c.name}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
                      {getBranchName(c.branchId)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
                      {teachers.find(t => t.id === c.teacherId)?.name || <span className="text-slate-400 italic">Chưa phân công</span>}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-center text-sm font-medium text-slate-700">
                      {c.studentCount || 0}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
                      {c.program || "-"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
                      {c.feeMethod === 'per_session' ? (c.sessionsPerMonth ? `${c.sessionsPerMonth} buổi` : "-") : "-"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
                      {c.feeMethod === 'per_session' ? 'Theo buổi' : 'Theo khóa'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-900">
                      {c.tuition ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(c.tuition) : "-"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                      <button onClick={() => setEditingClass(c)} className="text-blue-600 hover:text-blue-900">Xem chi tiết</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Tạo lớp học mới</h3>
            {error && (
              <div className="mb-4 rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">{error}</h3>
                  </div>
                </div>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Cơ sở (*)</label>
                <select
                  required
                  value={formData.branchId}
                  onChange={(e) => setFormData({...formData, branchId: e.target.value})}
                  className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
                >
                  <option value="">-- Chọn cơ sở --</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Tên lớp (*)</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
                  placeholder="Ví dụ: IELTS (6.5-7.5)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Giáo viên phụ trách</label>
                <select
                  value={formData.teacherId}
                  onChange={(e) => setFormData({...formData, teacherId: e.target.value})}
                  className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
                >
                  <option value="">-- Chọn giáo viên --</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name || 'Chưa cập nhật tên'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Chương trình học</label>
                <input
                  type="text"
                  value={formData.program}
                  onChange={(e) => setFormData({...formData, program: e.target.value})}
                  className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Hình thức thu học phí</label>
                <select
                  value={formData.feeMethod}
                  onChange={(e) => setFormData({...formData, feeMethod: e.target.value as 'per_session' | 'per_course'})}
                  className="mt-1 block w-full rounded-md border-0 py-1.5 pl-3 pr-8 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                >
                  <option value="per_session">Thu theo buổi</option>
                  <option value="per_course">Thu theo khóa</option>
                </select>
              </div>
              {formData.feeMethod === 'per_session' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700">Số buổi học / tháng</label>
                  <input
                    type="number"
                    value={formData.sessionsPerMonth}
                    onChange={(e) => setFormData({...formData, sessionsPerMonth: e.target.value})}
                    className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
                    placeholder="Ví dụ: 12"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700">Học phí (VNĐ)</label>
                <input
                  type="number"
                  value={formData.tuition}
                  onChange={(e) => setFormData({...formData, tuition: e.target.value})}
                  className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
                  placeholder={formData.feeMethod === 'per_course' ? "Ví dụ: 5000000" : "Ví dụ: 100000"}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setError(null);
                  }}
                  className="rounded-md px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
                >
                  Tạo lớp
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Chi tiết lớp học</h3>
            {error && (
              <div className="mb-4 rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">{error}</h3>
                  </div>
                </div>
              </div>
            )}
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Cơ sở (*)</label>
                <select
                  required
                  value={editingClass.branchId}
                  onChange={(e) => setEditingClass({...editingClass, branchId: parseInt(e.target.value)})}
                  disabled={dbUser?.role !== 'admin' && dbUser?.role !== 'manager'}
                  className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                >
                  <option value="">-- Chọn cơ sở --</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Tên lớp (*)</label>
                <input
                  required
                  type="text"
                  value={editingClass.name}
                  onChange={(e) => setEditingClass({...editingClass, name: e.target.value})}
                  disabled={dbUser?.role !== 'admin' && dbUser?.role !== 'manager'}
                  className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Giáo viên phụ trách</label>
                <select
                  value={editingClass.teacherId || ""}
                  onChange={(e) => setEditingClass({...editingClass, teacherId: e.target.value ? parseInt(e.target.value) : null})}
                  disabled={dbUser?.role !== 'admin' && dbUser?.role !== 'manager'}
                  className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                >
                  <option value="">-- Chọn giáo viên --</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name || 'Chưa cập nhật tên'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Chương trình học</label>
                <input
                  type="text"
                  value={editingClass.program || ""}
                  onChange={(e) => setEditingClass({...editingClass, program: e.target.value})}
                  disabled={dbUser?.role !== 'admin' && dbUser?.role !== 'manager'}
                  className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Hình thức thu học phí</label>
                <select
                  value={editingClass.feeMethod || 'per_session'}
                  onChange={(e) => setEditingClass({...editingClass, feeMethod: e.target.value as 'per_session' | 'per_course'})}
                  disabled={dbUser?.role !== 'admin' && dbUser?.role !== 'manager'}
                  className="mt-1 block w-full rounded-md border-0 py-1.5 pl-3 pr-8 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                >
                  <option value="per_session">Thu theo buổi</option>
                  <option value="per_course">Thu theo khóa</option>
                </select>
              </div>
              {editingClass.feeMethod !== 'per_course' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700">Số buổi học / tháng</label>
                  <input
                    type="number"
                    value={editingClass.sessionsPerMonth || ""}
                    onChange={(e) => setEditingClass({...editingClass, sessionsPerMonth: e.target.value ? parseInt(e.target.value) : null})}
                    disabled={dbUser?.role !== 'admin' && dbUser?.role !== 'manager'}
                    className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700">Học phí (VNĐ)</label>
                <input
                  type="number"
                  value={editingClass.tuition || ""}
                  onChange={(e) => setEditingClass({...editingClass, tuition: e.target.value ? parseInt(e.target.value) : null})}
                  disabled={dbUser?.role !== 'admin' && dbUser?.role !== 'manager'}
                  className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                />
              </div>
              <div className="flex justify-between pt-4">
                {(dbUser?.role === 'admin' || dbUser?.role === 'manager') && (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-2 rounded-md bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                  >
                    <Trash2 className="h-4 w-4" />
                    Xóa lớp
                  </button>
                )}
                
                <div className="flex gap-3 ml-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingClass(null);
                      setError(null);
                      setConfirmDelete(false);
                    }}
                    className="rounded-md px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Đóng
                  </button>
                  {(dbUser?.role === 'admin' || dbUser?.role === 'manager') && (
                    <button
                      type="submit"
                      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
                    >
                      Lưu thay đổi
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && editingClass && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Xác nhận xóa</h3>
            <p className="text-sm text-slate-500 mb-6">
              Bạn có chắc chắn muốn xóa lớp học <strong>{editingClass.name}</strong> không? Hành động này không thể hoàn tác.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-md px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => handleDelete(editingClass.id)}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
              >
                Đồng ý xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
