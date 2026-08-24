const fs = require('fs');
let code = fs.readFileSync('src/pages/Students.tsx', 'utf8');

const modalStartRegex = /\{showAddModal && \(\s*<div className="fixed inset-0 z-50 flex items-center justify-center bg-black\/50">\s*<div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">/g;

// Instead of regex, I will just write a new file component `AddStudentModal.tsx` and import it into `Students.tsx`. That is MUCH cleaner!
