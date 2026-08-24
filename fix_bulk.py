import re

with open('server.ts', 'r', encoding='utf-8') as f:
    code = f.read()

# I want to add parseDate and parseMoney helper inside the bulk API, or globally
helpers = """
      const parseDate = (dateStr: any) => {
        if (!dateStr) return null;
        if (typeof dateStr === 'number') {
           // Excel serial date to JS Date
           return new Date(Math.round((dateStr - 25569) * 86400 * 1000));
        }
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) return d;
        if (typeof dateStr === 'string') {
           const parts = dateStr.split(/[-/]/);
           if (parts.length === 3) {
              const day = parseInt(parts[0]);
              const month = parseInt(parts[1]) - 1;
              const year = parseInt(parts[2]);
              const parsed = new Date(year, month, day);
              if (!isNaN(parsed.getTime())) return parsed;
           }
        }
        return null;
      };

      const parseMoney = (money: any) => {
        if (!money) return null;
        if (typeof money === 'number') return money;
        const clean = String(money).replace(/\D/g, '');
        return clean ? parseInt(clean) : null;
      };

      const valuesToInsert = studentsData.map((s: any) => ({
        tenantId,
        classId: parseInt(classId),
        name: s.name,
        studentCode: s.studentCode || `HV${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        phone: s.phone || null,
        dob: parseDate(s.dob),
        gender: s.gender || null,
        entryLevel: s.entryLevel || null,
        enrollmentDate: parseDate(s.enrollmentDate),
        tuitionFee: parseMoney(s.tuitionFee),
        parentName: s.parentName || null,
        parentPhone: s.parentPhone || null,
        address: s.address || null,
        note: s.note || null,
        tuitionStatus: 'Chưa đóng',
        tuitionOwed: 0
      }));
"""

old_block = """      const valuesToInsert = studentsData.map((s: any) => ({
        tenantId,
        classId: parseInt(classId),
        name: s.name,
        studentCode: s.studentCode || `HV${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        phone: s.phone || null,
        dob: s.dob ? new Date(s.dob) : null,
        gender: s.gender || null,
        entryLevel: s.entryLevel || null,
        enrollmentDate: s.enrollmentDate ? new Date(s.enrollmentDate) : null,
        tuitionFee: s.tuitionFee ? parseInt(s.tuitionFee) : null,
        parentName: s.parentName || null,
        parentPhone: s.parentPhone || null,
        address: s.address || null,
        note: s.note || null,
        tuitionStatus: 'Chưa đóng',
        tuitionOwed: 0
      }));"""

code = code.replace(old_block, helpers)

with open('server.ts', 'w', encoding='utf-8') as f:
    f.write(code)
