import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Building2, Key, ArrowRight, Loader2, LogOut } from 'lucide-react';
import { auth } from '../lib/firebase';

export function Onboarding({ onComplete }: { onComplete: () => void }) {
  const { logout, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'select' | 'join'>('select');
  const [inviteCode, setInviteCode] = useState('');

  const handleCreateTenant = async () => {
    setLoading(true);
    setError('');
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/onboarding/create-tenant', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        onComplete();
      } else {
        const data = await res.json();
        setError(data.error || 'Có lỗi xảy ra khi tạo trung tâm');
      }
    } catch (err) {
      setError('Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    
    setLoading(true);
    setError('');
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/onboarding/join-tenant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ inviteCode: inviteCode.trim().toUpperCase() })
      });
      if (res.ok) {
        onComplete();
      } else {
        const data = await res.json();
        setError(data.error || 'Có lỗi xảy ra khi gia nhập trung tâm');
      }
    } catch (err) {
      setError('Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-900/5">
        <div className="p-8">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Chào mừng, {user?.displayName || 'bạn'}!</h1>
            <p className="mt-2 text-sm text-slate-500">
              Hãy thiết lập tài khoản của bạn để bắt đầu sử dụng hệ thống.
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-600">
              {error}
            </div>
          )}

          {mode === 'select' ? (
            <div className="space-y-4">
              <button
                onClick={handleCreateTenant}
                disabled={loading}
                className="group relative flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-slate-200 bg-white p-6 transition-all hover:border-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-50"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                  {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Building2 className="h-6 w-6" />}
                </div>
                <div className="text-center">
                  <h3 className="text-base font-semibold text-slate-900">Tạo Trung tâm mới</h3>
                  <p className="mt-1 text-xs text-slate-500">Dành cho Giám đốc. Tạo xong sẽ có toàn quyền Admin hệ thống đó.</p>
                </div>
              </button>
              <button
                onClick={() => setMode('join')}
                disabled={loading}
                className="group relative flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-slate-200 bg-white p-6 transition-all hover:border-emerald-600 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 disabled:opacity-50"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
                  <Key className="h-6 w-6" />
                </div>
                <div className="text-center">
                  <h3 className="text-base font-semibold text-slate-900">Tham gia Trung tâm đã có</h3>
                  <p className="mt-1 text-xs text-slate-500">Nhập một "Mã lời mời" do Giám đốc cung cấp để gia nhập hệ thống với tư cách là nhân viên/giáo viên.</p>
                </div>
              </button>
            </div>
          ) : (
            <div>
              <form onSubmit={handleJoinTenant} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium leading-6 text-slate-900">
                    Mã lời mời <span className="text-red-500">*</span>
                  </label>
                  <div className="mt-2">
                    <input
                      type="text"
                      required
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                      placeholder="VD: 4FX9AB"
                      className="block w-full rounded-md border-0 py-2.5 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm sm:leading-6"
                    />
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('select');
                      setError('');
                    }}
                    disabled={loading}
                    className="flex-1 rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Quay lại
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !inviteCode.trim()}
                    className="flex flex-1 items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Xác nhận gia nhập'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="mt-8 border-t border-slate-100 pt-6">
            <button
              onClick={logout}
              className="flex w-full items-center justify-center gap-2 text-sm text-slate-500 hover:text-slate-900"
            >
              <LogOut className="h-4 w-4" />
              Đăng xuất
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
