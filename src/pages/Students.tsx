import React, { useEffect, useState } from "react";
import { Plus, Users, Search, Calendar, Download, Upload, FileSpreadsheet, X, CheckCircle2 } from "lucide-react";
import * as XLSX from "xlsx";
import { auth } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { format } from "date-fns";

interface Student {
  id: number;
  name: string;
  studentCode: string;
  phone: string | null;
  classId: number;
  tuitionStatus: string;
  tuitionOwed?: number;
  attendedSessionsCount?: number;
  dob?: string | null;
  gender?: string | null;
  entryLevel?: string | null;
  enrollmentDate?: string | null;
  tuitionFee?: number | null;
  parentName?: string | null;
  parentPhone?: string | null;
  address?: string | null;
  note?: string | null;
}

interface ClassData {
  id: number;
  name: string;
  branchId: number;
}

export function Students() {
  const { dbUser } = useAuth();
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [selectedClass, setSelectedClass] = useState<number | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return format(d, "yyyy-MM-dd");
  });
  
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    return format(d, "yyyy-MM-dd");
  });
  
  const [formData, setFormData] = useState({
    name: "",
    studentCode: "",
    phone: "",
    tuitionStatus: "Chưa đóng",
    tuitionOwed: "",
    dob: "",
    gender: "Khác",
    entryLevel: "",
    enrollmentDate: "",
    tuitionFee: "",
    parentName: "",
    parentPhone: "",
    address: "",
    note: ""
  });
  const [addTab, setAddTab] = useState<'manual' | 'import' | 'from_class'>('manual');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<any[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  
  const [sourceClassId, setSourceClassId] = useState<number | null>(null);
  const [sourceSearch, setSourceSearch] = useState("");
  const [sourceStudents, setSourceStudents] = useState<Student[]>([]);
  const [selectedSourceStudents, setSelectedSourceStudents] = useState<number[]>([]);
  const [sourceLoading, setSourceLoading] = useState(false);


  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.studentCode.toLowerCase().includes(searchQuery.toLowerCase())
  );


  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      fetchStudents(selectedClass);
    }
  }, [selectedClass, startDate, endDate]);

  const fetchClasses = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/classes", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setClasses(data);
        if (data.length > 0) {
          setSelectedClass(data[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async (classId: number) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      let url = `/api/students?classId=${classId}`;
      if (startDate && endDate) {
        url += `&startDate=${startDate}&endDate=${endDate}`;
      }
      
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setStudents(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };


  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/students", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ...formData, classId: selectedClass })
      });
      
      if (res.ok) {
        setFormData({ name: "", studentCode: "", phone: "", tuitionStatus: "Chưa đóng", tuitionOwed: "", dob: "", gender: "Khác", entryLevel: "", enrollmentDate: "", tuitionFee: "", parentName: "", parentPhone: "", address: "", note: "" });
        setShowAddModal(false);
        fetchStudents(selectedClass);
      } else {
        alert("Thêm học viên thất bại. Có thể mã học viên đã tồn tại.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary', raw: true });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { raw: false, defval: "" });
      
      const formattedData = data.map((row: any) => {
        let phone = String(row['Điện thoại'] || '').trim();
        let parentPhone = String(row['Điện thoại phụ huynh'] || '').trim();
        
        if (phone.length === 9 && ['3','5','7','8','9'].includes(phone[0])) phone = '0' + phone;
        if (parentPhone.length === 9 && ['3','5','7','8','9'].includes(parentPhone[0])) parentPhone = '0' + parentPhone;
        
        return {
          name: row['Họ tên'] || '',
          dob: row['Ngày sinh'] || '',
          gender: row['Giới tính'] || 'Khác',
          phone: phone,
          entryLevel: row['Trình độ đầu vào'] || '',
          enrollmentDate: row['Ngày nhập học'] || '',
          tuitionFee: row['Số tiền phải nộp'] || '',
          parentName: row['Họ tên phụ huynh'] || '',
          parentPhone: parentPhone,
          address: row['Địa chỉ'] || '',
          note: row['Ghi chú'] || ''
        };
      }).filter((r: any) => r.name !== ''); // Only keep rows with names
      setImportData(formattedData);
    };
    reader.readAsBinaryString(file);
  };

  const handleImportSubmit = async () => {
    if (!selectedClass || importData.length === 0) return;
    setImportLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/students/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ classId: selectedClass, studentsData: importData })
      });
      if (res.ok) {
        setShowAddModal(false);
        setImportData([]);
        setImportFile(null);
        fetchStudents(selectedClass);
        alert("Import thành công!");
      } else {
        alert("Import thất bại.");
      }
    } catch(err) {
      console.error(err);
      alert("Lỗi server khi import");
    } finally {
      setImportLoading(false);
    }
  };


  const handleSearchSourceStudents = async () => {
    if (!sourceClassId) {
       alert("Vui lòng chọn lớp");
       return;
    }
    setSourceLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/students?classId=${sourceClassId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        // optionally filter by name here or server-side
        const searchLower = (sourceSearch || "").toLowerCase();
        const filtered = data.filter((s: Student) => 
          (s.name || "").toLowerCase().includes(searchLower) || 
          (s.studentCode || "").toLowerCase().includes(searchLower)
        );
        setSourceStudents(filtered);
      }
    } catch(err) {
      console.error(err);
    } finally {
      setSourceLoading(false);
    }
  };

  const handleCloneStudents = async () => {
    if (!selectedClass || selectedSourceStudents.length === 0) return;
    setImportLoading(true);
    try {
      const studentsToClone = sourceStudents.filter(s => selectedSourceStudents.includes(s.id));
      const dataToInsert = studentsToClone.map(s => ({
        name: s.name,
        studentCode: s.studentCode, // You might want to generate a new one, but requirement says "thêm sang lớp khác" typically keeping code is fine
        phone: s.phone,
        dob: s.dob,
        gender: s.gender,
        entryLevel: s.entryLevel,
        enrollmentDate: s.enrollmentDate,
        tuitionFee: s.tuitionFee,
        parentName: s.parentName,
        parentPhone: s.parentPhone,
        address: s.address,
        note: s.note
      }));

      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/students/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ classId: selectedClass, studentsData: dataToInsert })
      });
      if (res.ok) {
        setShowAddModal(false);
        setSelectedSourceStudents([]);
        setSourceStudents([]);
        fetchStudents(selectedClass);
        alert("Thêm học viên thành công!");
      } else {
        alert("Thất bại.");
      }
    } catch(err) {
      console.error(err);
    } finally {
      setImportLoading(false);
    }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { 'Họ tên': '', 'Ngày sinh': '', 'Giới tính': 'Khác', 'Điện thoại': '', 'Trình độ đầu vào': '', 'Ngày nhập học': '', 'Số tiền phải nộp': '', 'Họ tên phụ huynh': '', 'Điện thoại phụ huynh': '', 'Địa chỉ': '', 'Ghi chú': '' }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, "Teamplate_Import_HocVien.xlsx");
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent || !selectedClass) return;
    
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/students/${editingStudent.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(editingStudent)
      });
      
      if (res.ok) {
        setShowEditModal(false);
        setEditingStudent(null);
        // If class was changed, they will disappear from current list. We just refetch.
        fetchStudents(selectedClass);
      } else {
        alert("Cập nhật thất bại.");
      }
    } catch (err) {
      console.error(err);
    }
  };

   const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  /**
   * Xóa học viên theo phạm vi người dùng chọn.
   * - 'class'  : chỉ gỡ khỏi lớp đang xem (truyền classId cho server)
   * - 'system' : gỡ khỏi mọi lớp và ẩn khỏi danh sách (không truyền classId)
   * Cả hai đều là xóa mềm - dữ liệu vẫn nằm trong cơ sở dữ liệu và khôi phục được.
   */
  const handleDeleteStudent = async (id: number, scope: 'class' | 'system') => {
    setDeleting(true);
    setDeleteError("");
    try {
      const token = await auth.currentUser?.getIdToken();
      const url = scope === 'class'
        ? `/api/students/${id}?classId=${selectedClass}`
        : `/api/students/${id}`;
      const res = await fetch(url, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setConfirmDelete(null);
        setShowEditModal(false);
        setEditingStudent(null);
        if (selectedClass) fetchStudents(selectedClass);
      } else {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.error || "Xóa thất bại. Vui lòng thử lại.");
      }
    } catch (err) {
      console.error(err);
      setDeleteError("Lỗi kết nối.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
          <h2 className="text-2xl font-bold text-slate-900">Quản lý Học viên</h2>
          <p className="mt-1 text-sm text-slate-500">
            Xem và quản lý danh sách học viên.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {classes.length > 0 && (
            <select
              value={selectedClass || ""}
              onChange={(e) => setSelectedClass(parseInt(e.target.value))}
              className="rounded-md border-0 py-2 pl-3 pr-8 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
            >
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          
          <button 
            onClick={() => setShowAddModal(true)}
            disabled={!selectedClass}
            className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Thêm học viên
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="border-b border-slate-200 p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative max-w-md w-full">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full rounded-md border-0 py-1.5 pl-10 pr-3 text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
              placeholder="Tìm kiếm học viên..."
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-700">Từ</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="block rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700">Đến</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="block rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
              />
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Học viên</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Mã HV</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Điện thoại</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Số buổi đi học</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Học phí</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">
                    {students.length === 0 ? "Chưa có học viên nào trong lớp này." : "Không tìm thấy học viên nào phù hợp."}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => {
                  return (
                    <tr key={student.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                            <Users className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-900">{student.name}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
                        {student.studentCode}
                      </td>
                      
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
                        {student.phone || "-"}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-blue-600">
                        {student.attendedSessionsCount || 0} buổi
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                          student.tuitionStatus === 'Đã đóng' ? 'bg-green-50 text-green-700 ring-green-600/20'
                          : student.tuitionStatus === 'Bảo lưu' ? 'bg-indigo-50 text-indigo-700 ring-indigo-600/20'
                          : student.tuitionStatus === 'Đã nghỉ' ? 'bg-slate-50 text-slate-700 ring-slate-600/20'
                          : 'bg-yellow-50 text-yellow-800 ring-yellow-600/20'
                        }`}>
                          {student.tuitionStatus} {student.tuitionStatus === 'Còn thiếu' && student.tuitionOwed ? `(${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(student.tuitionOwed)})` : ''}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                        <div className="flex items-center justify-end gap-3">
                          <button 
                            onClick={() => {
                              setEditingStudent(student);
                              setShowEditModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-900 font-medium"
                          >
                            Chi tiết
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl flex flex-col">
            <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Thêm học viên mới</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            
            <div className="px-6 py-4 flex gap-4 border-b border-slate-200">
              <button 
                onClick={() => setAddTab('manual')}
                className={`pb-2 font-medium text-sm transition-colors ${addTab === 'manual' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Nhập thủ công
              </button>
              <button 
                onClick={() => setAddTab('import')}
                className={`pb-2 font-medium text-sm transition-colors ${addTab === 'import' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Import từ Excel
              </button>
              <button 
                onClick={() => setAddTab('from_class')}
                className={`pb-2 font-medium text-sm transition-colors ${addTab === 'from_class' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Các lớp khác
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              {addTab === 'manual' && (
                <form id="add-student-form" onSubmit={handleAddStudent} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Họ và tên (*)</label>
                      <input required type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm" placeholder="Ví dụ: Nguyễn Văn A" />
                    </div>
                  <div>
                      <label className="block text-sm font-medium text-slate-700">Mã học viên</label>
                      <input
                        type="text"
                        value={formData.studentCode}
                        onChange={(e) => setFormData({...formData, studentCode: e.target.value.toUpperCase().replace(/\s/g, '')})}
                        className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
                        placeholder="Để trống sẽ tự sinh"
                      />
                      <p className="mt-1 text-xs text-slate-500">Bỏ trống để hệ thống tự sinh mã ngẫu nhiên (dạng HVA7X2K9).</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700">Ngày sinh</label>
                      <input type="date" value={formData.dob} onChange={(e) => setFormData({...formData, dob: e.target.value})} className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Giới tính</label>
                      <select value={formData.gender} onChange={(e) => setFormData({...formData, gender: e.target.value})} className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm">
                        <option value="Nam">Nam</option>
                        <option value="Nữ">Nữ</option>
                        <option value="Khác">Khác</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Điện thoại học viên</label>
                      <input type="text" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Trình độ đầu vào</label>
                      <input type="text" value={formData.entryLevel} onChange={(e) => setFormData({...formData, entryLevel: e.target.value})} className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Ngày nhập học</label>
                      <input type="date" value={formData.enrollmentDate} onChange={(e) => setFormData({...formData, enrollmentDate: e.target.value})} className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Số tiền phải nộp (Khác mặc định)</label>
                      <input type="number" value={formData.tuitionFee} onChange={(e) => setFormData({...formData, tuitionFee: e.target.value})} className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Họ tên phụ huynh</label>
                      <input type="text" value={formData.parentName} onChange={(e) => setFormData({...formData, parentName: e.target.value})} className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Điện thoại phụ huynh</label>
                      <input type="text" value={formData.parentPhone} onChange={(e) => setFormData({...formData, parentPhone: e.target.value})} className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Địa chỉ</label>
                      <input type="text" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Ghi chú</label>
                    <textarea rows={2} value={formData.note} onChange={(e) => setFormData({...formData, note: e.target.value})} className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Tình trạng học phí</label>
                    <select value={formData.tuitionStatus} onChange={(e) => setFormData({...formData, tuitionStatus: e.target.value})} className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm">
                      <option value="Chưa đóng">Chưa đóng</option>
                      <option value="Đã đóng">Đã đóng</option>
                      <option value="Còn thiếu">Còn thiếu</option>
                    </select>
                  </div>
                  {formData.tuitionStatus === 'Còn thiếu' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Số tiền còn thiếu (VNĐ)</label>
                      <input type="number" value={formData.tuitionOwed} onChange={(e) => setFormData({...formData, tuitionOwed: e.target.value})} className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm" />
                    </div>
                  )}
                </form>
              )}

              {addTab === 'import' && (
                <div className="space-y-6">
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <h4 className="font-semibold text-slate-900 mb-2">Hướng dẫn Import</h4>
                    <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
                      <li>Tải file mẫu về và điền thông tin học viên.</li>
                      <li>Số điện thoại phải đúng định dạng, bắt đầu bằng số 0 (Hệ thống sẽ tự động bù số 0 nếu Excel làm mất).</li>
                      <li>Giữ nguyên các cột, không xóa hoặc đổi tên cột.</li>
                    </ul>
                    <button onClick={downloadTemplate} className="mt-4 flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50">
                      <Download className="w-4 h-4" />
                      Tải file Excel mẫu
                    </button>
                  </div>

                  <div>
                    <label className="flex justify-center w-full h-32 px-4 transition bg-white border-2 border-slate-300 border-dashed rounded-md appearance-none cursor-pointer hover:border-slate-400 focus:outline-none">
                        <span className="flex items-center space-x-2">
                            <Upload className="w-6 h-6 text-slate-400" />
                            <span className="font-medium text-slate-600">
                                {importFile ? importFile.name : "Nhấp để chọn file Excel hoặc kéo thả vào đây"}
                            </span>
                        </span>
                        <input type="file" name="file_upload" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                    </label>
                  </div>

                  {importData.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-2">Dữ liệu sẵn sàng ({importData.length} học viên)</h4>
                      <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-md">
                        <table className="min-w-full divide-y divide-slate-200">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Họ tên</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Điện thoại</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">SĐT Phụ huynh</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-slate-200">
                            {importData.map((row, idx) => (
                              <tr key={idx}>
                                <td className="px-3 py-2 text-sm text-slate-900">{row.name}</td>
                                <td className="px-3 py-2 text-sm text-slate-500">{row.phone}</td>
                                <td className="px-3 py-2 text-sm text-slate-500">{row.parentPhone}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {addTab === 'from_class' && (
                <div className="space-y-4">
                  <div className="flex gap-4 items-end">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Chọn lớp nguồn</label>
                      <select 
                        value={sourceClassId || ''} 
                        onChange={(e) => setSourceClassId(parseInt(e.target.value))}
                        className="block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
                      >
                        <option value="">-- Chọn lớp --</option>
                        {classes.filter(c => c.id !== selectedClass).map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Tên / Mã học viên</label>
                      <input 
                        type="text" 
                        value={sourceSearch}
                        onChange={(e) => setSourceSearch(e.target.value)}
                        placeholder="Nhập thông tin tìm kiếm..."
                        className="block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
                      />
                    </div>
                    <button 
                      onClick={handleSearchSourceStudents}
                      disabled={sourceLoading || !sourceClassId}
                      className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      {sourceLoading ? 'Đang tìm...' : 'Tìm kiếm'}
                    </button>
                  </div>

                  {sourceStudents.length > 0 ? (
                    <div className="border border-slate-200 rounded-md max-h-60 overflow-y-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50 sticky top-0 z-10">
                          <tr>
                            <th className="px-3 py-2 text-left">
                              <input 
                                type="checkbox" 
                                checked={selectedSourceStudents.length === sourceStudents.length}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedSourceStudents(sourceStudents.map(s => s.id));
                                  } else {
                                    setSelectedSourceStudents([]);
                                  }
                                }}
                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                              />
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Mã HV</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Họ tên</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Điện thoại</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                          {sourceStudents.map((s) => (
                            <tr key={s.id} className="hover:bg-slate-50">
                              <td className="px-3 py-2">
                                <input 
                                  type="checkbox" 
                                  checked={selectedSourceStudents.includes(s.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedSourceStudents([...selectedSourceStudents, s.id]);
                                    } else {
                                      setSelectedSourceStudents(selectedSourceStudents.filter(id => id !== s.id));
                                    }
                                  }}
                                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                                />
                              </td>
                              <td className="px-3 py-2 text-sm text-slate-500">{s.studentCode}</td>
                              <td className="px-3 py-2 text-sm font-medium text-slate-900">{s.name}</td>
                              <td className="px-3 py-2 text-sm text-slate-500">{s.phone}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    sourceClassId && !sourceLoading && (
                      <div className="text-center py-8 text-sm text-slate-500 border border-slate-200 rounded-md border-dashed">
                        Không tìm thấy học viên nào phù hợp.
                      </div>
                    )
                  )}
                </div>
              )}

            </div>

            <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 rounded-b-xl flex justify-end gap-3">
              <button type="button" onClick={() => { setShowAddModal(false); setImportData([]); setImportFile(null); }} className="rounded-md px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors">
                Hủy bỏ
              </button>
              {addTab === 'manual' && (
                <button type="submit" form="add-student-form" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors">
                  Thêm học viên
                </button>
              )}
              {addTab === 'import' && (
                <button onClick={handleImportSubmit} disabled={importData.length === 0 || importLoading} className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors disabled:opacity-50">
                  <CheckCircle2 className="w-4 h-4" />
                  {importLoading ? "Đang xử lý..." : "Tiếp tục Import"}
                </button>
              )}
              {addTab === 'from_class' && (
                <button onClick={handleCloneStudents} disabled={selectedSourceStudents.length === 0 || importLoading} className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors disabled:opacity-50">
                  <CheckCircle2 className="w-4 h-4" />
                  {importLoading ? "Đang xử lý..." : "Cập nhật"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}


      {showEditModal && editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Chi tiết học viên</h3>
              <button 
                type="button" 
                onClick={() => { setDeleteError(""); setConfirmDelete(editingStudent.id); }}
                className="text-sm font-medium px-2 py-1 rounded text-red-600 hover:text-red-800 hover:bg-red-50 transition-colors"
              >
                Xóa học viên
              </button>
            </div>
            <form onSubmit={handleUpdateStudent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Họ và tên</label>
                <input
                  required
                  type="text"
                  value={editingStudent.name}
                  onChange={(e) => setEditingStudent({...editingStudent, name: e.target.value})}
                  className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Mã học viên (Không đổi)</label>
                <input
                  disabled
                  type="text"
                  value={editingStudent.studentCode}
                  className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-500 bg-slate-50 ring-1 ring-inset ring-slate-300 sm:text-sm cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Điện thoại</label>
                <input
                  type="text"
                  value={editingStudent.phone || ''}
                  onChange={(e) => setEditingStudent({...editingStudent, phone: e.target.value})}
                  className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Lớp học</label>
                <select
                  disabled
                  value={editingStudent.classId}
                  onChange={(e) => setEditingStudent({...editingStudent, classId: parseInt(e.target.value)})}
                  className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-500 bg-slate-50 ring-1 ring-inset ring-slate-300 sm:text-sm cursor-not-allowed"
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Tình trạng học phí</label>
                <select
                  value={editingStudent.tuitionStatus}
                  onChange={(e) => setEditingStudent({...editingStudent, tuitionStatus: e.target.value})}
                  disabled={dbUser?.role !== 'admin' && dbUser?.role !== 'manager'}
                  className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                >
                  <option value="Chưa đóng">Chưa đóng</option>
                  <option value="Đã đóng">Đã đóng</option>
                  <option value="Còn thiếu">Còn thiếu</option>
                  <option value="Bảo lưu">Bảo lưu</option>
                  <option value="Đã nghỉ">Đã nghỉ</option>
                </select>
              </div>
              {editingStudent.tuitionStatus === 'Còn thiếu' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700">Số tiền còn thiếu (VNĐ)</label>
                  <input
                    type="number"
                    value={editingStudent.tuitionOwed || ""}
                    onChange={(e) => setEditingStudent({...editingStudent, tuitionOwed: e.target.value ? parseInt(e.target.value) : undefined})}
                    disabled={dbUser?.role !== 'admin' && dbUser?.role !== 'manager'}
                    className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                    placeholder="Ví dụ: 500000"
                  />
                </div>
              )}
              <div className="flex justify-end items-center pt-4">
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingStudent(null);
                      setConfirmDelete(null);
                    }}
                    className="rounded-md px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
                  >
                    Cập nhật
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
            {confirmDelete !== null && editingStudent && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Xóa học viên</h3>
            <p className="mt-1 text-sm text-slate-600">
              <span className="font-medium text-slate-900">{editingStudent.name}</span>
              {editingStudent.studentCode ? ` (${editingStudent.studentCode})` : ""}
            </p>

            <p className="mt-4 text-sm font-medium text-slate-700">Chọn phạm vi xóa:</p>

            <div className="mt-2 space-y-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => handleDeleteStudent(editingStudent.id, 'class')}
                className="w-full rounded-lg border border-slate-300 p-4 text-left transition-colors hover:border-amber-500 hover:bg-amber-50 disabled:opacity-50"
              >
                <div className="font-medium text-slate-900">Gỡ khỏi lớp hiện tại</div>
                <p className="mt-1 text-xs text-slate-500">
                  Học viên vẫn còn trong hệ thống và các lớp khác (nếu có). Dùng khi học viên
                  chuyển lớp hoặc chỉ nghỉ riêng lớp này.
                </p>
              </button>

              <button
                type="button"
                disabled={deleting}
                onClick={() => handleDeleteStudent(editingStudent.id, 'system')}
                className="w-full rounded-lg border border-slate-300 p-4 text-left transition-colors hover:border-red-500 hover:bg-red-50 disabled:opacity-50"
              >
                <div className="font-medium text-red-700">Xóa khỏi hệ thống</div>
                <p className="mt-1 text-xs text-slate-500">
                  Gỡ khỏi tất cả các lớp và ẩn khỏi danh sách học viên. Dữ liệu điểm danh và
                  học phí vẫn được lưu lại, có thể khôi phục nếu xóa nhầm.
                </p>
              </button>
            </div>

            {deleteError && (
              <p className="mt-3 rounded-md bg-red-50 p-2.5 text-sm text-red-700 ring-1 ring-inset ring-red-600/20">
                {deleteError}
              </p>
            )}

            <div className="mt-5 flex items-center justify-between">
              <span className="text-sm text-slate-500">{deleting ? "Đang xử lý..." : ""}</span>
              <button
                type="button"
                disabled={deleting}
                onClick={() => { setConfirmDelete(null); setDeleteError(""); }}
                className="rounded-md bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-50"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

  );
}
