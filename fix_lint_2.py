import re

with open('server.ts', 'r', encoding='utf-8') as f:
    code = f.read()

# Fix eq(students.tenantId, tenantId) on line 321
code = code.replace("classEnrollments).where(eq(students.tenantId, tenantId));", "classEnrollments).where(eq(classEnrollments.tenantId, tenantId));")

with open('server.ts', 'w', encoding='utf-8') as f:
    f.write(code)
