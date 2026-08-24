import re

with open('src/pages/Students.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Add fields to Student interface
student_interface_old = """interface Student {
  id: number;
  name: string;
  studentCode: string;
  phone: string | null;
  classId: number;
  tuitionStatus: string;
  tuitionOwed?: number;
  faceDescriptor?: string | null;
  attendedSessionsCount?: number;
}"""

student_interface_new = """interface Student {
  id: number;
  name: string;
  studentCode: string;
  phone: string | null;
  classId: number;
  tuitionStatus: string;
  tuitionOwed?: number;
  faceDescriptor?: string | null;
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
}"""
code = code.replace(student_interface_old, student_interface_new)

# 2. Add state variables for Tab 3
state_old = """  const [addTab, setAddTab] = useState<'manual' | 'import'>('manual');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<any[]>([]);
  const [importLoading, setImportLoading] = useState(false);"""

state_new = """  const [addTab, setAddTab] = useState<'manual' | 'import' | 'from_class'>('manual');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<any[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  
  const [sourceClassId, setSourceClassId] = useState<number | null>(null);
  const [sourceSearch, setSourceSearch] = useState("");
  const [sourceStudents, setSourceStudents] = useState<Student[]>([]);
  const [selectedSourceStudents, setSelectedSourceStudents] = useState<number[]>([]);
  const [sourceLoading, setSourceLoading] = useState(false);
"""
code = code.replace(state_old, state_new)

# 3. Add handler for tab 3
handler_code = """
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
        const filtered = data.filter((s: Student) => s.name.toLowerCase().includes(sourceSearch.toLowerCase()) || s.studentCode.toLowerCase().includes(sourceSearch.toLowerCase()));
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
"""

code = code.replace("  const downloadTemplate", handler_code + "\n  const downloadTemplate")

# 4. Update the Tab headers
tabs_old = """              <button 
                onClick={() => setAddTab('import')}
                className={`pb-2 font-medium text-sm transition-colors ${addTab === 'import' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Import từ Excel
              </button>
            </div>"""

tabs_new = """              <button 
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
            </div>"""
code = code.replace(tabs_old, tabs_new)

# 5. Add Tab 3 Content
tab3_content = """
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
"""

code = code.replace("            </div>\n\n            <div className=\"border-t border-slate-200 px-6 py-4 bg-slate-50 rounded-b-xl flex justify-end gap-3\">", tab3_content + "\n            </div>\n\n            <div className=\"border-t border-slate-200 px-6 py-4 bg-slate-50 rounded-b-xl flex justify-end gap-3\">")

# 6. Update the Footer Button
footer_old = """              {addTab === 'manual' ? (
                <button type="submit" form="add-student-form" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors">
                  Thêm học viên
                </button>
              ) : (
                <button onClick={handleImportSubmit} disabled={importData.length === 0 || importLoading} className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors disabled:opacity-50">
                  <CheckCircle2 className="w-4 h-4" />
                  {importLoading ? "Đang xử lý..." : "Tiếp tục Import"}
                </button>
              )}"""

footer_new = """              {addTab === 'manual' && (
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
              )}"""
code = code.replace(footer_old, footer_new)


with open('src/pages/Students.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
