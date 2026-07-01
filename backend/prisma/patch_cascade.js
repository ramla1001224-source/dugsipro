const fs = require('fs');
let content = fs.readFileSync('schema.prisma', 'utf8');

// Helper to replace exactly
function addCascade(target, replacement) {
    content = content.split(target).join(replacement);
}

// School relations
addCascade('school        School               @relation(fields: [schoolId], references: [id])', 'school        School               @relation(fields: [schoolId], references: [id], onDelete: Cascade)');
addCascade('school        School               @relation(fields: [schoolId], references: [id], onDelete: Cascade, onUpdate: NoAction)', 'school        School               @relation(fields: [schoolId], references: [id], onDelete: Cascade, onUpdate: NoAction)');

addCascade('school        School?              @relation(fields: [schoolId], references: [id])', 'school        School?              @relation(fields: [schoolId], references: [id], onDelete: Cascade)');
addCascade('school        School               @relation("SuperAdminSchools", fields: [schoolId], references: [id])', 'school        School               @relation("SuperAdminSchools", fields: [schoolId], references: [id], onDelete: Cascade)');

// Variations in spacing:
addCascade('school   School @relation(fields: [schoolId], references: [id])', 'school   School @relation(fields: [schoolId], references: [id], onDelete: Cascade)');
addCascade('school   School? @relation(fields: [schoolId], references: [id])', 'school   School? @relation(fields: [schoolId], references: [id], onDelete: Cascade)');
addCascade('school School @relation(fields: [schoolId], references: [id])', 'school School @relation(fields: [schoolId], references: [id], onDelete: Cascade)');
addCascade('school School? @relation(fields: [schoolId], references: [id])', 'school School? @relation(fields: [schoolId], references: [id], onDelete: Cascade)');
addCascade('school      School   @relation(fields: [schoolId], references: [id])', 'school      School   @relation(fields: [schoolId], references: [id], onDelete: Cascade)');
addCascade('school      School?  @relation(fields: [schoolId], references: [id])', 'school      School?  @relation(fields: [schoolId], references: [id], onDelete: Cascade)');
addCascade('school     School   @relation(fields: [schoolId], references: [id])', 'school     School   @relation(fields: [schoolId], references: [id], onDelete: Cascade)');
addCascade('school       School   @relation(fields: [schoolId], references: [id])', 'school       School   @relation(fields: [schoolId], references: [id], onDelete: Cascade)');
addCascade('school        School    @relation(fields: [schoolId], references: [id])', 'school        School    @relation(fields: [schoolId], references: [id], onDelete: Cascade)');

// SuperAdmin
addCascade('managedBy             User?                  @relation("SuperAdminSchools", fields: [superAdminId], references: [id])', 'managedBy             User?                  @relation("SuperAdminSchools", fields: [superAdminId], references: [id], onDelete: Cascade)');

// AcademicYear
addCascade('academicYear   AcademicYear @relation(fields: [academicYearId], references: [id])', 'academicYear   AcademicYear @relation(fields: [academicYearId], references: [id], onDelete: Cascade)');
addCascade('academicYear AcademicYear @relation(fields: [academicYearId], references: [id])', 'academicYear AcademicYear @relation(fields: [academicYearId], references: [id], onDelete: Cascade)');

// Parent
addCascade('user       User            @relation(fields: [userId], references: [id], onDelete: Cascade)', 'user       User            @relation(fields: [userId], references: [id], onDelete: Cascade)');

// Staff, Teacher, Student, User
addCascade('user            User     @relation(fields: [userId], references: [id])', 'user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)');
addCascade('user           User           @relation(fields: [userId], references: [id])', 'user           User           @relation(fields: [userId], references: [id], onDelete: Cascade)');

// Message
addCascade('receiver   User     @relation("ReceivedMessages", fields: [receiverId], references: [id])', 'receiver   User     @relation("ReceivedMessages", fields: [receiverId], references: [id], onDelete: Cascade)');
addCascade('sender     User     @relation("SentMessages", fields: [senderId], references: [id])', 'sender     User     @relation("SentMessages", fields: [senderId], references: [id], onDelete: Cascade)');

// BookIssue
addCascade('student    Student?  @relation(fields: [studentId], references: [id])', 'student    Student?  @relation(fields: [studentId], references: [id], onDelete: Cascade)');

// Invoice
addCascade('fee        FeeStructure @relation(fields: [feeId], references: [id])', 'fee        FeeStructure @relation(fields: [feeId], references: [id], onDelete: Cascade)');

// Payment
addCascade('invoice         Invoice? @relation(fields: [invoiceId], references: [id])', 'invoice         Invoice? @relation(fields: [invoiceId], references: [id], onDelete: Cascade)');

// Class
addCascade('class          Class?       @relation(fields: [classId], references: [id])', 'class          Class?       @relation(fields: [classId], references: [id], onDelete: Cascade)');
addCascade('clss           Class        @relation(fields: [classId], references: [id])', 'clss           Class        @relation(fields: [classId], references: [id], onDelete: Cascade)');

// Section
addCascade('section        Section?     @relation(fields: [sectionId], references: [id])', 'section        Section?     @relation(fields: [sectionId], references: [id], onDelete: Cascade)');
addCascade('section   Section? @relation(fields: [sectionId], references: [id])', 'section   Section? @relation(fields: [sectionId], references: [id], onDelete: Cascade)');

// ParentStudent (missing parent Cascade)
addCascade('parent    Parent  @relation(fields: [parentId], references: [id])', 'parent    Parent  @relation(fields: [parentId], references: [id], onDelete: Cascade)');

fs.writeFileSync('schema.prisma', content);
console.log("schema.prisma patched.");
