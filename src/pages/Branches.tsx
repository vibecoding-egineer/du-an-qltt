import React, { useState, useEffect } from "react";
import { Plus, Building2, MapPin, Phone, Pencil, Save, Upload } from "lucide-react";
import { auth } from "../lib/firebase";

interface Branch {
  id: number;
  name: string;
  code: string;
  phone: string | null;
  address: string | null;
}

export function Branches() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    phone: "",
    address: "",
  });

  const fetchBranches = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/branches", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBranches(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = await auth.currentUser?.getIdToken();
      const isEditing = editingBranch !== null;
      const url = isEditing ? `/api/branches/${editingBranch.id}` : "/api/branches";
      const method = isEditing ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setFormData({ name: "", code: "", phone: "", address: "" });
        setEditingBranch(null);
        setShowModal(false);
        fetchBranches();
      } else {
        alert(isEditing ? "Cập nhật cơ sở thất bại." : "Thêm cơ sở thất bại. Có thể mã cơ sở đã tồn tại.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setFormData({
      name: branch.name,
      code: branch.code,
      phone: branch.phone || "",
      address: branch.address || "",
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingBranch(null);
    setFormData({ name: "", code: "", phone: "", address: "" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Quản lý Cơ sở</h2>
          <p className="mt-1 text-sm text-slate-500">
            Quản lý thông tin các cơ sở của trung tâm.
          </p>
        </div>
        <button 
          onClick={() => {
            setEditingBranch(null);
            setFormData({ name: "", code: "", phone: "", address: "" });
            setShowModal(true);
          }}
          className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500"
        >
          <Plus className="h-4 w-4" />
          Tạo cơ sở
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full py-12 text-center text-sm text-slate-500">
            Đang tải dữ liệu...
          </div>
        ) : branches.length === 0 ? (
          <div className="col-span-full py-12 text-center text-sm text-slate-500">
            Chưa có cơ sở nào.
          </div>
        ) : (
          branches.map((branch) => (
            <div key={branch.id} className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
              <div className="border-b border-slate-100 bg-slate-50 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{branch.name}</h3>
                    <span className="text-xs font-medium text-slate-500">Mã: {branch.code}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleEdit(branch)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                  title="Chỉnh sửa"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-start gap-2 text-sm text-slate-600">
                  <Phone className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  <span>{branch.phone || "Chưa cập nhật"}</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-slate-600">
                  <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{branch.address || "Chưa cập nhật"}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              {editingBranch ? "Chỉnh sửa cơ sở" : "Tạo cơ sở mới"}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Tên cơ sở (*)</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
                  placeholder="Ví dụ: Cơ sở 1 - Hà Nội"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Mã cơ sở (*)</label>
                <input
                  required
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({...formData, code: e.target.value})}
                  className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
                  placeholder="Ví dụ: CS1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Điện thoại</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Địa chỉ</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="rounded-md px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
                >
                  {editingBranch ? "Cập nhật" : "Tạo mới"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
