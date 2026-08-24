import re

with open('src/pages/Students.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace handleAddStudent with the updated version that clears all fields
handle_add_student_new = """
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

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { 'Họ tên': '', 'Ngày sinh': '', 'Giới tính': 'Khác', 'Điện thoại': '', 'Trình độ đầu vào': '', 'Ngày nhập học': '', 'Số tiền phải nộp': '', 'Họ tên phụ huynh': '', 'Điện thoại phụ huynh': '', 'Địa chỉ': '', 'Ghi chú': '' }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, "Teamplate_Import_HocVien.xlsx");
  };
"""

code = re.sub(r'  const handleAddStudent = async.*?};\n', handle_add_student_new, code, flags=re.DOTALL)

modal_new = """
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
            </div>

            <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 rounded-b-xl flex justify-end gap-3">
              <button type="button" onClick={() => { setShowAddModal(false); setImportData([]); setImportFile(null); }} className="rounded-md px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors">
                Hủy bỏ
              </button>
              {addTab === 'manual' ? (
                <button type="submit" form="add-student-form" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors">
                  Thêm học viên
                </button>
              ) : (
                <button onClick={handleImportSubmit} disabled={importData.length === 0 || importLoading} className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors disabled:opacity-50">
                  <CheckCircle2 className="w-4 h-4" />
                  {importLoading ? "Đang xử lý..." : "Tiếp tục Import"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
"""

code = re.sub(r'\{showAddModal && \(\s*<div className="fixed inset-0.*?</form>\s*</div>\s*</div>\s*\)\}', modal_new, code, flags=re.DOTALL)

with open('src/pages/Students.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
