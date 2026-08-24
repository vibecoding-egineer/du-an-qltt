import React, { useEffect, useState } from "react";
import { Plus, Search, Percent, DollarSign, Calendar, Edit, Trash2, ShieldAlert } from "lucide-react";
import { auth } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { format } from "date-fns";

interface Promotion {
  id: number;
  name: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  branchIds: number[];
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
}

interface Branch {
  id: number;
  name: string;
}

export function Promotions() {
  const { dbUser } = useAuth();
  const userRole = dbUser?.role;
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    discountType: "percentage",
    discountValue: "",
    branchIds: [] as number[],
    startDate: "",
    endDate: "",
    isActive: true
  });

  useEffect(() => {
    if (userRole === 'admin') {
      fetchData();
    }
  }, [userRole]);

  const fetchData = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };
      
      const [promoRes, branchesRes] = await Promise.all([
        fetch("/api/promotions", { headers }),
        fetch("/api/branches", { headers })
      ]);
      
      if (promoRes.ok) setPromotions(await promoRes.json());
      if (branchesRes.ok) setBranches(await branchesRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const computeStatus = (promo: Promotion) => {
    if (!promo.isActive) return { label: "Đang tạm dừng", color: "bg-red-100 text-red-800" };
    
    // Convert 'now' to a YYYY-MM-DD string matching the local timezone,
    // to compare safely against startDate/endDate (which are stored as YYYY-MM-DD from the input)
    const today = new Date();
    // Use offset to get YYYY-MM-DD correctly for the user's local timezone
    const tzOffset = today.getTimezoneOffset() * 60000; 
    const todayStr = new Date(today.getTime() - tzOffset).toISOString().split('T')[0];

    if (promo.startDate && promo.startDate.split('T')[0] > todayStr) {
      return { label: "Sắp diễn ra", color: "bg-yellow-100 text-yellow-800" };
    }
    
    if (promo.endDate && promo.endDate.split('T')[0] < todayStr) {
      return { label: "Đã hết hạn", color: "bg-gray-100 text-gray-800" };
    }
    
    return { label: "Đang áp dụng", color: "bg-green-100 text-green-800" };
  };

  const handleToggleActive = async (promo: Promotion) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/promotions/${promo.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...promo, isActive: !promo.isActive })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Bạn có chắc muốn xóa ưu đãi này?")) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/promotions/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.branchIds.length === 0) {
      alert("Vui lòng chọn ít nhất 1 cơ sở áp dụng");
      return;
    }
    
    const value = parseInt(formData.discountValue.replace(/,/g, ''));
    if (isNaN(value) || value <= 0) {
      alert("Giá trị ưu đãi không hợp lệ");
      return;
    }
    if (formData.discountType === 'percentage' && value > 100) {
      alert("Phần trăm giảm giá không được vượt quá 100%");
      return;
    }

    try {
      const token = await auth.currentUser?.getIdToken();
      const url = editingId ? `/api/promotions/${editingId}` : "/api/promotions";
      const method = editingId ? "PUT" : "POST";
      
      const payload = {
        ...formData,
        discountValue: value,
        startDate: formData.startDate || null,
        endDate: formData.endDate || null
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        setShowModal(false);
        setEditingId(null);
        fetchData();
      } else {
        alert("Có lỗi xảy ra khi lưu ưu đãi");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openNewModal = () => {
    setFormData({
      name: "",
      discountType: "percentage",
      discountValue: "",
      branchIds: [],
      startDate: "",
      endDate: "",
      isActive: true
    });
    setEditingId(null);
    setShowModal(true);
  };

  const openEditModal = (promo: Promotion) => {
    setFormData({
      name: promo.name,
      discountType: promo.discountType,
      discountValue: promo.discountValue.toString(),
      branchIds: promo.branchIds,
      startDate: promo.startDate ? new Date(promo.startDate).toISOString().split('T')[0] : "",
      endDate: promo.endDate ? new Date(promo.endDate).toISOString().split('T')[0] : "",
      isActive: promo.isActive
    });
    setEditingId(promo.id);
    setShowModal(true);
  };

  const handleBranchToggle = (branchId: number) => {
    setFormData(prev => ({
      ...prev,
      branchIds: prev.branchIds.includes(branchId) 
        ? prev.branchIds.filter(id => id !== branchId)
        : [...prev.branchIds, branchId]
    }));
  };

  const filteredPromotions = promotions.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const isAdmin = userRole === 'admin';
  const hasPromoPerm = dbUser?.permissions?.includes('/promotions');
  
  if (!isAdmin && !hasPromoPerm) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <ShieldAlert className="w-12 h-12 mb-4 text-gray-400" />
        <h2 className="text-xl font-medium">Bạn không có quyền truy cập trang này</h2>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Quản lý ưu đãi</h1>
        <button
          onClick={openNewModal}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Tạo ưu đãi</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Tìm kiếm ưu đãi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tên chương trình</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Giảm giá</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Thời gian áp dụng</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tình trạng</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">Đang tải dữ liệu...</td>
                </tr>
              ) : filteredPromotions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">Không tìm thấy ưu đãi nào</td>
                </tr>
              ) : (
                filteredPromotions.map((promo) => {
                  const status = computeStatus(promo);
                  return (
                    <tr key={promo.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{promo.name}</div>
                        <div className="text-sm text-gray-500 mt-1 truncate max-w-xs">
                          {promo.branchIds.length === branches.length ? "Tất cả cơ sở" : `${promo.branchIds.length} cơ sở`}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-indigo-700 font-medium">
                          {promo.discountType === 'percentage' ? (
                            <><Percent className="w-4 h-4 mr-1" /> {promo.discountValue}%</>
                          ) : (
                            <>{promo.discountValue.toLocaleString('vi-VN')} VNĐ</>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {promo.startDate || promo.endDate ? (
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span>
                              {promo.startDate ? format(new Date(promo.startDate), 'dd/MM/yyyy') : '...'} - 
                              {promo.endDate ? format(new Date(promo.endDate), 'dd/MM/yyyy') : '...'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400">Không giới hạn</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                            {status.label}
                          </span>
                          <button
                            onClick={() => handleToggleActive(promo)}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${promo.isActive ? 'bg-indigo-600' : 'bg-gray-200'}`}
                          >
                            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${promo.isActive ? 'translate-x-5' : 'translate-x-1'}`} />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => openEditModal(promo)}
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(promo.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-xl w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingId ? "Cập nhật ưu đãi" : "Tạo ưu đãi mới"}
              </h2>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên chương trình ưu đãi *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Vd: Back to School 2026"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hình thức *</label>
                  <select
                    value={formData.discountType}
                    onChange={e => setFormData({...formData, discountType: e.target.value as 'percentage'|'fixed', discountValue: ''})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="percentage">Giảm theo %</option>
                    <option value="fixed">Giảm số tiền cố định</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Giá trị ưu đãi *</label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={formData.discountValue}
                      onChange={e => {
                        let val = e.target.value.replace(/[^\d]/g, '');
                        if (formData.discountType === 'fixed' && val) {
                          val = parseInt(val).toLocaleString('vi-VN');
                        }
                        setFormData({...formData, discountValue: val})
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 pr-10"
                      placeholder={formData.discountType === 'percentage' ? "Vd: 10" : "Vd: 500,000"}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                      {formData.discountType === 'percentage' ? '%' : 'VNĐ'}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cơ sở áp dụng *</label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-3 border border-gray-200 rounded-lg bg-gray-50">
                  {branches.map(branch => (
                    <label key={branch.id} className="flex items-center space-x-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.branchIds.includes(branch.id)}
                        onChange={() => handleBranchToggle(branch.id)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{branch.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ngày bắt đầu (Không bắt buộc)</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={e => setFormData({...formData, startDate: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ngày kết thúc (Không bắt buộc)</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={e => setFormData({...formData, endDate: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end space-x-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  {editingId ? "Cập nhật" : "Tạo ưu đãi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
