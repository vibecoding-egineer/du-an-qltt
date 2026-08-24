import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Briefcase, UserPlus, Shield, User, X, CheckSquare } from "lucide-react";
import { auth } from "../lib/firebase";
import { navigation } from "../components/Sidebar";

interface Employee {
  id: number;
  uid: string;
  email: string;
  name: string | null;
  employeeCode: string | null;
  phone: string | null;
  role: string;
  permissions: string[] | null;
  branchId: number | null;
  inviteCode: string | null;
  createdAt: string;
}

export function Employees() {
  const { dbUser } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    email: '',
    name: '',
    employeeCode: '',
    role: 'staff',
    branchId: '',
    permissions: [] as string[]
  });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');
  const [branches, setBranches] = useState<any[]>([]);

  const [showPermModal, setShowPermModal] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [tempPerms, setTempPerms] = useState<string[]>([]);

  const fetchData = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const [usersRes, branchesRes] = await Promise.all([
        fetch("/api/users", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/branches", { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      if (usersRes.ok) {
        const data = await usersRes.json();
        setEmployees(data);
      }
      if (branchesRes.ok) {
        const data = await branchesRes.json();
        setBranches(data);
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

  const handleRoleChange = async (id: number, newRole: string) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      });
      
      if (res.ok) {
        fetchData();
      } else {
        alert("Không thể thay đổi quyền. Bạn cần là Quản trị viên.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSavePerms = async () => {
    if (!selectedEmp) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/users/${selectedEmp.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ permissions: tempPerms })
      });
      
      if (res.ok) {
        setShowPermModal(false);
        fetchData();
      } else {
        alert("Cập nhật phân quyền thất bại.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openPermModal = (emp: Employee) => {
    setSelectedEmp(emp);
    setTempPerms(emp.permissions || []);
    setShowPermModal(true);
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoading(true);
    setAddError('');
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/users", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(addForm)
      });
      
      const data = await res.json();
      if (res.ok) {
        setShowAddModal(false);
        setAddForm({ email: '', name: '', employeeCode: '', role: 'staff', branchId: '', permissions: [] });
        fetchData();
      } else {
        setAddError(data.error || "Có lỗi xảy ra");
      }
    } catch (err) {
      console.error(err);
      setAddError("Lỗi kết nối");
    } finally {
      setAddLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-600/20"><Shield className="h-3 w-3" /> Quản trị viên</span>;
      case 'manager':
        return <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20"><Briefcase className="h-3 w-3" /> Quản lý</span>;
      case 'teacher':
        return <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20"><User className="h-3 w-3" /> Giáo viên</span>;
      default:
        return <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-600/20"><User className="h-3 w-3" /> Nhân viên</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Quản lý nhân viên</h2>
          <p className="mt-1 text-sm text-slate-500">
            Quản lý danh sách nhân viên và phân quyền truy cập hệ thống.
          </p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          disabled={dbUser?.role !== 'admin'}
          className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed">
          <UserPlus className="h-4 w-4" />
          Thêm nhân viên
        </button>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Nhân viên</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Mã NV</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Cơ sở</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Trạng thái / Mã lời mời</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Quyền hiện tại</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Vai trò</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Truy cập</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-500">Đang tải dữ liệu...</td>
              </tr>
            ) : employees.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-500">Không có nhân viên nào.</td>
              </tr>
            ) : (
              employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-900">{emp.name || "Chưa cập nhật tên"}</span>
                      <span className="text-sm text-slate-500">{emp.email}</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
                    {emp.employeeCode || <span className="text-slate-400 italic">Chưa có</span>}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
                    {emp.role === 'admin' ? (
                       <span className="text-slate-500">Toàn hệ thống</span>
                    ) : (
                       branches.find(b => b.id === emp.branchId)?.name || <span className="text-slate-400 italic">Chưa phân công</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
                    {emp.inviteCode ? (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                        Chờ xác nhận: <strong className="font-mono ml-1">{emp.inviteCode}</strong>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                        Đã tham gia
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
                    {getRoleBadge(emp.role)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                    <select
                      value={emp.role}
                      onChange={(e) => handleRoleChange(emp.id, e.target.value)}
                      disabled={dbUser?.role !== 'admin' || emp.id === dbUser?.id}
                      className="rounded-md border-0 py-1.5 pl-3 pr-8 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 disabled:bg-slate-50 disabled:text-slate-400"
                    >
                      <option value="staff">Nhân viên</option>
                      <option value="teacher">Giáo viên</option>
                      <option value="manager">Quản lý</option>
                      <option value="admin">Quản trị viên</option>
                    </select>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                    {emp.role !== 'admin' && (
                      <button
                        onClick={() => openPermModal(emp)}
                        disabled={dbUser?.role !== 'admin'}
                        className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:bg-slate-50 disabled:text-slate-400"
                      >
                        <Shield className="h-4 w-4" />
                        Phân quyền
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Thêm nhân viên</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddEmployee} className="space-y-4">
              {addError && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                  {addError}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  required
                  value={addForm.email}
                  onChange={(e) => setAddForm({...addForm, email: e.target.value})}
                  className="block w-full rounded-md border-0 py-1.5 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  placeholder="email@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Họ và tên</label>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm({...addForm, name: e.target.value})}
                  className="block w-full rounded-md border-0 py-1.5 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  placeholder="Nguyễn Văn A"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mã nhân viên</label>
                <input
                  type="text"
                  value={addForm.employeeCode}
                  onChange={(e) => setAddForm({...addForm, employeeCode: e.target.value})}
                  className="block w-full rounded-md border-0 py-1.5 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  placeholder="NV001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Quyền hạn</label>
                <select
                  value={addForm.role}
                  onChange={(e) => setAddForm({...addForm, role: e.target.value})}
                  className="block w-full rounded-md border-0 py-1.5 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                >
                  <option value="staff">Nhân viên</option>
                  <option value="teacher">Giáo viên</option>
                  <option value="manager">Quản lý</option>
                  <option value="admin">Quản trị viên</option>
                </select>
              </div>

              {addForm.role !== 'admin' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cơ sở phụ trách</label>
                  <select
                    value={addForm.branchId}
                    onChange={(e) => setAddForm({...addForm, branchId: e.target.value})}
                    className="block w-full rounded-md border-0 py-1.5 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  >
                    <option value="">-- Tất cả cơ sở --</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {addForm.role !== 'admin' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Phân quyền đặc biệt</label>
                  <div className="space-y-2 border border-slate-200 rounded-md p-3 max-h-40 overflow-y-auto">
                    {navigation.filter(nav => nav.href !== '/').map((nav) => (
                      <label key={`add-perm-${nav.href}`} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={addForm.permissions.includes(nav.href)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAddForm({...addForm, permissions: [...addForm.permissions, nav.href]});
                            } else {
                              setAddForm({...addForm, permissions: addForm.permissions.filter(p => p !== nav.href)});
                            }
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                        />
                        <span className="text-sm text-slate-700">{nav.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-md px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50"
                >
                  {addLoading ? 'Đang thêm...' : 'Xác nhận thêm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {showPermModal && selectedEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Phân quyền: {selectedEmp.name || selectedEmp.email}</h3>
              <button 
                onClick={() => setShowPermModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mt-4 space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              <p className="text-sm text-slate-500 mb-4">Chọn các module mà nhân viên này được phép truy cập:</p>
              
              <div className="space-y-3">
                {navigation.filter(nav => nav.href !== '/').map((nav) => (
                  <label key={nav.href} className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center h-6">
                      <input
                        type="checkbox"
                        checked={tempPerms.includes(nav.href)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setTempPerms([...tempPerms, nav.href]);
                          } else {
                            setTempPerms(tempPerms.filter(p => p !== nav.href));
                          }
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <nav.icon className="h-5 w-5 text-slate-400" />
                      <span className="text-sm font-medium text-slate-900">{nav.name}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowPermModal(false)}
                className="rounded-md px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                onClick={handleSavePerms}
                className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
              >
                Lưu phân quyền
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
