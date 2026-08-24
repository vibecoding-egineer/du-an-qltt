import React, { useState, useEffect } from "react";
import { Plus, Wallet, TrendingUp, TrendingDown, Calendar, Search, Trash2 } from "lucide-react";
import { auth } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

interface Transaction {
  id: number;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  date: string;
  note: string | null;
  studentName?: string | null;
}

export function Finance() {
  const { dbUser } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  // Filters
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  
  const [formData, setFormData] = useState({
    type: "income",
    category: "tuition",
    amount: "",
    date: new Date().toISOString().split('T')[0],
    note: "",
  });

  const categories = {
    income: [
      { id: 'tuition', name: 'Học phí' },
      { id: 'other_income', name: 'Thu khác' },
    ],
    expense: [
      { id: 'salary', name: 'Lương nhân viên/Giáo viên' },
      { id: 'infrastructure', name: 'Cơ sở vật chất/Mặt bằng' },
      { id: 'marketing', name: 'Marketing/Quảng cáo' },
      { id: 'other_expense', name: 'Chi khác' },
    ]
  };

  const fetchTransactions = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      
      let queryParams = new URLSearchParams();
      if (filterType !== 'all') queryParams.append('type', filterType);
      if (filterCategory !== 'all') queryParams.append('category', filterCategory);
      
      const res = await fetch(`/api/transactions?${queryParams.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [filterType, filterCategory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setFormData({
          type: "income",
          category: "tuition",
          amount: "",
          date: new Date().toISOString().split('T')[0],
          note: "",
        });
        setShowModal(false);
        fetchTransactions();
      } else {
        alert("Thêm giao dịch thất bại");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Bạn có chắc chắn muốn xóa giao dịch này không?")) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/transactions/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchTransactions();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const balance = totalIncome - totalExpense;

  const getCategoryName = (categoryId: string) => {
    const allCats = [...categories.income, ...categories.expense];
    return allCats.find(c => c.id === categoryId)?.name || categoryId;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Quản lý Thu Chi</h2>
          <p className="mt-1 text-sm text-slate-500">
            Theo dõi dòng tiền, doanh thu và chi phí của cơ sở.
          </p>
        </div>
        {dbUser?.role !== 'teacher' && (
          <button 
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500"
          >
            <Plus className="h-4 w-4" />
            Thêm Giao dịch
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 text-green-600">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Tổng thu</p>
              <p className="text-2xl font-bold text-slate-900">
                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(totalIncome)}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-100 text-red-600">
              <TrendingDown className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Tổng chi</p>
              <p className="text-2xl font-bold text-slate-900">
                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(totalExpense)}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Lợi nhuận gộp</p>
              <p className="text-2xl font-bold text-slate-900">
                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(balance)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="border-b border-slate-200 p-4 sm:flex sm:items-center sm:justify-between">
          <h3 className="text-base font-semibold leading-6 text-slate-900">Lịch sử giao dịch</h3>
          <div className="mt-3 flex gap-4 sm:ml-4 sm:mt-0">
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setFilterCategory("all");
              }}
              className="block w-full rounded-md border-0 py-1.5 pl-3 pr-8 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
            >
              <option value="all">Tất cả loại</option>
              <option value="income">Thu</option>
              <option value="expense">Chi</option>
            </select>
            
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="block w-full rounded-md border-0 py-1.5 pl-3 pr-8 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
            >
              <option value="all">Tất cả danh mục</option>
              {filterType === 'all' || filterType === 'income' ? categories.income.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              )) : null}
              {filterType === 'all' || filterType === 'expense' ? categories.expense.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              )) : null}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-300">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Ngày</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Loại</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Danh mục</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Số tiền</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Ghi chú</th>
                {dbUser?.role !== 'teacher' && <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Thao tác</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-slate-500">Đang tải...</td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-slate-500">Không có giao dịch nào</td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">
                      {format(new Date(tx.date), "dd/MM/yyyy")}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${tx.type === 'income' ? 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20' : 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10'}`}>
                        {tx.type === 'income' ? 'Thu' : 'Chi'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
                      {getCategoryName(tx.category)}
                    </td>
                    <td className={`whitespace-nowrap px-6 py-4 text-sm font-medium ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.type === 'income' ? '+' : '-'} {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(tx.amount)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 max-w-xs truncate" title={tx.note || ""}>
                      {tx.note || "-"}
                      {tx.studentName && <span className="block text-xs text-blue-600 mt-1">HV: {tx.studentName}</span>}
                    </td>
                    {dbUser?.role !== 'teacher' && (
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                        <button
                          onClick={() => handleDelete(tx.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Xóa"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
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
            <h3 className="text-lg font-bold text-slate-900 mb-4">Thêm Giao dịch Mới</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Loại (*)</label>
                  <select
                    value={formData.type}
                    onChange={(e) => {
                      const type = e.target.value as 'income' | 'expense';
                      setFormData({ 
                        ...formData, 
                        type,
                        category: type === 'income' ? 'tuition' : 'salary'
                      });
                    }}
                    className="mt-1 block w-full rounded-md border-0 py-1.5 pl-3 pr-8 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  >
                    <option value="income">Khoản Thu</option>
                    <option value="expense">Khoản Chi</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Ngày (*)</label>
                  <input
                    required
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Danh mục (*)</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  className="mt-1 block w-full rounded-md border-0 py-1.5 pl-3 pr-8 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                >
                  {formData.type === 'income' 
                    ? categories.income.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                    : categories.expense.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                  }
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Số tiền (VNĐ) (*)</label>
                <input
                  required
                  type="number"
                  min="0"
                  step="1000"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
                  placeholder="VD: 5000000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Ghi chú</label>
                <textarea
                  rows={3}
                  value={formData.note}
                  onChange={(e) => setFormData({...formData, note: e.target.value})}
                  className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
                  placeholder="Nội dung chi tiết..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-md px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
                >
                  Lưu giao dịch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
