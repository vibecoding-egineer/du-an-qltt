import re

with open('src/pages/Students.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Update handleDeleteStudent
old_delete = "const res = await fetch(`/api/students/${id}`"
new_delete = "const res = await fetch(`/api/students/${id}?classId=${selectedClass}`"
code = code.replace(old_delete, new_delete)

# Disable class select in edit modal
old_select = """<label className="block text-sm font-medium text-slate-700">Lớp học</label>
                <select
                  value={editingStudent.classId}
                  onChange={(e) => setEditingStudent({...editingStudent, classId: parseInt(e.target.value)})}
                  className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
                >"""
new_select = """<label className="block text-sm font-medium text-slate-700">Lớp học</label>
                <select
                  disabled
                  value={editingStudent.classId}
                  onChange={(e) => setEditingStudent({...editingStudent, classId: parseInt(e.target.value)})}
                  className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-500 bg-slate-50 ring-1 ring-inset ring-slate-300 sm:text-sm cursor-not-allowed"
                >"""
code = code.replace(old_select, new_select)

with open('src/pages/Students.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
