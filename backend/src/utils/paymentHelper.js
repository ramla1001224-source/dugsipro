/**
 * Selects the most relevant enrollment record for a student based on a specific month/year.
 * Prioritizes the 'isCurrent' enrollment if the queried date is in the current or future year.
 */
function selectEnrollment(enrollments = [], month, year) {
  if (!Array.isArray(enrollments) || enrollments.length === 0) return null;

  const current = enrollments.find(e => e.isCurrent);

  if (month && year) {
    const recordDate = new Date(year, month - 1, 15);
    const now = new Date();

    // Strategy: If a student is promoted (isCurrent points to new year), 
    // prioritize that enrollment for any queries in the current or future calendar years.
    // This allows promotion to take effect immediately in the billing system.
    if (current && recordDate.getFullYear() >= now.getFullYear()) {
      return current;
    }

    const match = enrollments.find(e => {
      if (!e.academicYear || !e.academicYear.startDate || !e.academicYear.endDate) return false;
      const start = new Date(e.academicYear.startDate);
      const end = new Date(e.academicYear.endDate);
      return start <= recordDate && end >= recordDate;
    });
    if (match) return match;
  }

  if (current) return current;
  return enrollments[0] || null;
}

/**
 * Resolves the monthly tuition fee for a specific enrollment record.
 * Takes scholarship into account.
 */
async function resolveTuitionFeeForEnrollment(tx, enrollment, student, preFetchedFees = null) {
  if (!enrollment || !enrollment.classId) {
    console.warn(`[resolveTuitionFeeForEnrollment] No enrollment or classId for student ${student?.id || 'unknown'}`);
    return 0;
  }

  let allFees;
  if (preFetchedFees) {
    // Filter the pre-fetched fees for this specific enrollment
    allFees = preFetchedFees.filter(f => 
      f.schoolId === enrollment.schoolId && 
      f.frequency === 'monthly' && 
      (f.classId === enrollment.classId && (f.sectionId === null || f.sectionId === enrollment.sectionId || !f.sectionId))
    );
  } else {
    allFees = await tx.feeStructure.findMany({
      where: {
        schoolId: enrollment.schoolId,
        frequency: 'monthly',
        OR: [
          { classId: enrollment.classId, sectionId: null },
          { sectionId: enrollment.sectionId }
        ]
      },
      include: { clss: { select: { class_name: true } } }
    });
  }

  if (allFees.length === 0) {
    // console.warn(`[resolveTuitionFeeForEnrollment] No fee found for class ${enrollment.classId} in school ${enrollment.schoolId}`);
    return 0;
  }

  // Pick the most specific fee (Section > Class) or best match by name
  const tuitionFee = allFees.find(f => {
    const n = (f.name || '').toLowerCase();
    const cName = (f.clss?.class_name || '').toLowerCase();
    return n.includes('tuition') || n.includes('fees') || n.includes('waxbarashada') || n.includes('monthly') || (cName && n.includes(cName));
  }) || (allFees.find(f => f.sectionId === enrollment.sectionId) || allFees[0]);

  let amount = tuitionFee.amount || 0;
  
  // Apply scholarship discounts
  if (student?.scholarship === 'full') amount = 0;
  else if (student?.scholarship === 'half') amount /= 2;
  else if (student?.scholarship === 'quarter') amount *= 0.75;

  return amount;
}

/**
 * Public wrapper for resolveTuitionFeeForEnrollment
 */
async function resolveStudentTuitionFee(tx, enrollment, student, preFetchedFees = null) {
  return await resolveTuitionFeeForEnrollment(tx, enrollment, student, preFetchedFees);
}

/**
 * Resolves the tuition fee for a student based purely on their ID and a specific date.
 */
async function resolveStudentTuitionFeeByStudentId(tx, studentId, month, year) {
  if (!studentId) {
    console.warn('[resolveStudentTuitionFeeByStudentId] No studentId provided');
    return 0;
  }

  const student = await tx.student.findUnique({
    where: { id: studentId },
    include: {
      Enrollments: {
        include: { academicYear: true },
        orderBy: [
          { isCurrent: 'desc' },
          { created_at: 'desc' }
        ]
      }
    }
  });

  if (!student) {
    console.warn(`[resolveStudentTuitionFeeByStudentId] Student not found: ${studentId}`);
    return 0;
  }

  // selectEnrollment is now synchronous
  const enrollment = selectEnrollment(student.Enrollments, month, year);
  return await resolveTuitionFeeForEnrollment(tx, enrollment, student);
}

module.exports = {
  resolveStudentTuitionFee,
  resolveStudentTuitionFeeByStudentId,
  selectEnrollment
};
