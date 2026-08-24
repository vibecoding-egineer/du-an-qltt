import re

with open('src/pages/Students.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

old_filter = "const filtered = data.filter((s: Student) => s.name.toLowerCase().includes(sourceSearch.toLowerCase()) || s.studentCode.toLowerCase().includes(sourceSearch.toLowerCase()));"
new_filter = """const searchLower = (sourceSearch || "").toLowerCase();
        const filtered = data.filter((s: Student) => 
          (s.name || "").toLowerCase().includes(searchLower) || 
          (s.studentCode || "").toLowerCase().includes(searchLower)
        );"""
code = code.replace(old_filter, new_filter)

with open('src/pages/Students.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
