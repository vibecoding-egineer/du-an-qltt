import React, { useEffect, useState } from "react";
import { CheckCircle, Users, Save, AlertCircle, ScanFace } from "lucide-react";
import { auth } from "../lib/firebase";
import { FaceScannerModal } from "../components/FaceScannerModal";

interface Student {
  id: number;
  name: string;
  studentCode: string;
  faceDescriptor?: string;
}

interface ClassData {
  id: number;
  name: string;
  branchId: number;
}

interface AttendanceRecord {
  id?: number;
  studentId: number;
  classId: number;
  date: string;
  status: string; // 'present', 'absent_with_permission', 'absent_without_permission'
  homeworkCompleted: number; // 0: No, 1: Yes
  note?: string;
}

export function Attendance() {
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [selectedClass, setSelectedClass] = useState<number | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<number, AttendanceRecord>>({});
  const [loading, setLoading] = useState(true);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  const [showFaceScanner, setShowFaceScanner] = useState(false);

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      fetchStudentsAndAttendance(selectedClass, attendanceDate);
    }
  }, [selectedClass, attendanceDate]);

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

  const fetchStudentsAndAttendance = async (classId: number, date: string) => {
    setLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };
      
      const [studentsRes, attendanceRes] = await Promise.all([
        fetch(`/api/students?classId=${classId}`, { headers }),
        fetch(`/api/attendance?classId=${classId}&date=${date}`, { headers })
      ]);
      
      if (studentsRes.ok && attendanceRes.ok) {
        const studentsData = await studentsRes.json();
        const attendanceData = await attendanceRes.json();
        
        setStudents(studentsData);
        
        const attendanceMap: Record<number, AttendanceRecord> = {};
        attendanceData.forEach((record: AttendanceRecord) => {
          attendanceMap[record.studentId] = record;
        });
        setAttendance(attendanceMap);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAttendance = (studentId: number, field: keyof AttendanceRecord, value: any) => {
    if (!selectedClass) return;
    
    setAttendance(prev => {
      const current = prev[studentId] || {
        studentId,
        classId: selectedClass,
        date: attendanceDate,
        status: 'present',
        homeworkCompleted: 0
      };
      
      return {
        ...prev,
        [studentId]: { ...current, [field]: value }
      };
    });
  };

  const markAllStatus = (status: string) => {
    if (!selectedClass) return;
    const newAttendance = { ...attendance };
    students.forEach(student => {
      const current = newAttendance[student.id] || {
        studentId: student.id,
        classId: selectedClass,
        date: attendanceDate,
        homeworkCompleted: 0
      };
      newAttendance[student.id] = { ...current, status };
    });
    setAttendance(newAttendance);
  };

  const saveAttendance = async () => {
    if (!selectedClass) return;
    setSaving(true);
    
    try {
      const token = await auth.currentUser?.getIdToken();
      
      const recordsToSave = students.map(student => {
        const record = attendance[student.id];
        return record || {
          studentId: student.id,
          classId: selectedClass,
          date: attendanceDate,
          status: 'present',
          homeworkCompleted: 0,
          note: ''
        };
      });

      const promises = recordsToSave.map(record => 
        fetch("/api/attendance", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(record)
        })
      );
      
      await Promise.all(promises);
      alert("Đã lưu điểm danh thành công!");
    } catch (err) {
      console.error(err);
      alert("Lỗi khi lưu điểm danh.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Điểm danh Học viên</h2>
          <p className="mt-1 text-sm text-slate-500">
            Điểm danh và kiểm tra bài tập về nhà theo từng lớp học.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700">Ngày:</label>
            <input
              type="date"
              value={attendanceDate}
              onChange={(e) => setAttendanceDate(e.target.value)}
              className="rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
            />
          </div>
          {classes.length > 0 && (
            <select
              value={selectedClass || ""}
              onChange={(e) => setSelectedClass(parseInt(e.target.value))}
              className="rounded-md border-0 py-1.5 pl-3 pr-8 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
            >
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          
          {selectedClass && (
            <button
              onClick={() => setShowFaceScanner(true)}
              disabled={students.length === 0}
              className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
            >
              <ScanFace className="h-4 w-4" />
              Điểm danh khuôn mặt
            </button>
          )}

          <button 
            onClick={saveAttendance}
            disabled={saving || students.length === 0}
            className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Đang lưu..." : "Lưu điểm danh"}
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="border-b border-slate-200 bg-slate-50 p-4 flex justify-between items-center">
          <h3 className="font-semibold text-slate-800">Danh sách lớp</h3>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-600 font-medium">Đánh dấu tất cả:</span>
            <button onClick={() => markAllStatus('present')} className="text-green-600 hover:text-green-700 font-medium">Có mặt</button>
            <span className="text-slate-300">|</span>
            <button onClick={() => markAllStatus('absent_with_permission')} className="text-yellow-600 hover:text-yellow-700 font-medium">Nghỉ phép</button>
            <span className="text-slate-300">|</span>
            <button onClick={() => markAllStatus('absent_without_permission')} className="text-red-600 hover:text-red-700 font-medium">Không phép</button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-white">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Học viên</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Mã HV</th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">Trạng thái (Đi học)</th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">Bài tập VN</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-500">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-500 flex flex-col items-center justify-center">
                    <AlertCircle className="h-8 w-8 text-slate-400 mb-2" />
                    Chưa có học viên nào trong lớp này.
                  </td>
                </tr>
              ) : (
                students.map((student) => {
                  const record = attendance[student.id];
                  
                  return (
                    <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600 font-bold text-xs border border-blue-100">
                            {student.name.charAt(0)}
                          </div>
                          <span className="text-sm font-medium text-slate-900">{student.name}</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
                        {student.studentCode}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex justify-center gap-4">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input 
                              type="radio" 
                              name={`status-${student.id}`} 
                              checked={!record || record.status === 'present'}
                              onChange={() => handleUpdateAttendance(student.id, 'status', 'present')}
                              className="h-4 w-4 text-green-600 focus:ring-green-600 border-slate-300"
                            />
                            <span className="text-sm font-medium text-green-700">Có mặt</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input 
                              type="radio" 
                              name={`status-${student.id}`} 
                              checked={record?.status === 'absent_with_permission'}
                              onChange={() => handleUpdateAttendance(student.id, 'status', 'absent_with_permission')}
                              className="h-4 w-4 text-yellow-600 focus:ring-yellow-600 border-slate-300"
                            />
                            <span className="text-sm font-medium text-yellow-700">Nghỉ (phép)</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input 
                              type="radio" 
                              name={`status-${student.id}`} 
                              checked={record?.status === 'absent_without_permission'}
                              onChange={() => handleUpdateAttendance(student.id, 'status', 'absent_without_permission')}
                              className="h-4 w-4 text-red-600 focus:ring-red-600 border-slate-300"
                            />
                            <span className="text-sm font-medium text-red-700">Nghỉ (ko phép)</span>
                          </label>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-center">
                        <label className="flex items-center justify-center cursor-pointer">
                          <input 
                            type="checkbox"
                            checked={record?.homeworkCompleted === 1}
                            onChange={(e) => handleUpdateAttendance(student.id, 'homeworkCompleted', e.target.checked ? 1 : 0)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                          />
                        </label>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        <input
                          type="text"
                          value={record?.note || ''}
                          onChange={(e) => handleUpdateAttendance(student.id, 'note', e.target.value)}
                          placeholder="Nhận xét buổi học..."
                          className="block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {showFaceScanner && (
        <FaceScannerModal
          mode="attendance"
          students={students}
          onClose={() => setShowFaceScanner(false)}
          onAttendanceMarked={(studentId) => {
            handleUpdateAttendance(studentId, 'status', 'present');
          }}
        />
      )}
    </div>
  );
}
