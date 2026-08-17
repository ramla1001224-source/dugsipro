const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');
const { authenticateToken } = require('../middleware/auth');
const cacheMiddleware = require('../middleware/cacheMiddleware');


router.post('/login', async (req, res) => {
  const { username, password, schoolCode, schoolId, fcmToken } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Missing credentials' });

  try {
    const normalizedUsername = (username || '').trim().toLowerCase();
    const normalizedSchoolCode = (schoolCode || '').trim().toUpperCase();

    let user = null;

    if (schoolId || normalizedSchoolCode) {
      console.log(`[Auth] Attempting login: schoolCode="${normalizedSchoolCode}", schoolId="${schoolId}", user="${normalizedUsername}"`);
      
      let school = null;

      // 1. Try by ID if provided
      if (schoolId && schoolId !== 'null' && schoolId !== 'undefined') {
        try {
          school = await prisma.school.findUnique({ where: { id: String(schoolId).trim() } });
          if (school) console.log(`[Auth] School found via ID: ${school.name}`);
        } catch (e) {
          console.error(`[Auth] Error looking up school by ID ${schoolId}:`, e.message);
        }
      }

      // 2. Try by shortCode if not found by ID
      if (!school && normalizedSchoolCode && normalizedSchoolCode.length > 0) {
        school = await prisma.school.findFirst({
          where: { shortCode: { equals: normalizedSchoolCode, mode: 'insensitive' } }
        });
        if (school) console.log(`[Auth] School found via shortCode: ${school.name}`);
      }

      // 3. Last resort: Try finding ANY school that might match the code exactly (no sensitivity)
      if (!school && normalizedSchoolCode) {
        school = await prisma.school.findFirst({
          where: { shortCode: normalizedSchoolCode }
        });
      }

      if (school) {
        // ── LOCK CHECK: Block login if school is disabled ──
        if (school.isActive === false) {
          // Also check if the super admin managing it is active
          // Owners bypass this block entirely
          const isOwnerAttempt = false; // owners don't have schoolId
          if (!isOwnerAttempt) {
            // Check if super admin managing the school is also blocked
            let superAdminActive = true;
            if (school.superAdminId) {
              const sa = await prisma.user.findUnique({ where: { id: school.superAdminId }, select: { isActive: true } });
              superAdminActive = sa?.isActive !== false;
            }
            // Block regardless — school itself is locked
            return res.status(403).json({
              locked: true,
              message: 'Nidaamku waa xiran yahay. Fadlan bixi biilka system-ka.'
            });
          }
        }

        // STRICT CHECK: Try finding user only within this school
        user = await prisma.user.findFirst({
          where: {
            username: { equals: normalizedUsername, mode: 'insensitive' },
            schoolId: school.id
          },
          include: { school: { select: { id: true, name: true, logo: true } } }
        });

        // FALLBACK for student_id within THIS school
        if (!user) {
          const student = await prisma.student.findFirst({
            where: {
              student_id: { equals: normalizedUsername, mode: 'insensitive' },
              user: { schoolId: school.id }
            },
            include: { user: { include: { school: { select: { id: true, name: true, logo: true } } } } }
          });
          if (student && student.user) user = student.user;
        }
      }

      // GLOBAL USER FALLBACK (Owners/SuperAdmins can enter any school portal)
      if (!user) {
        const globalUser = await prisma.user.findFirst({
          where: {
            username: { equals: normalizedUsername, mode: 'insensitive' },
            schoolId: null,
            role: { in: ['owner', 'super_admin'], mode: 'insensitive' }
          },
          include: { school: { select: { id: true, name: true, logo: true } } }
        });
        
        if (globalUser) {
          // If a super_admin tries to log in via a specific portal code, verify ownership
          if (globalUser.role.toLowerCase() === 'super_admin') {
            let isAuthorized = false;
            
            if (school) {
               // They entered a branch code. Do they own this branch?
               if (school.superAdminId === globalUser.id) {
                 isAuthorized = true;
               }
            } else if (normalizedSchoolCode) {
               // They entered a code that isn't a branch. Is it their own group code?
               if (globalUser.shortCode && globalUser.shortCode.toUpperCase() === normalizedSchoolCode) {
                 isAuthorized = true;
               }
            } else {
               // No code provided, maybe direct login
               isAuthorized = true; 
            }

            if (!isAuthorized) {
              console.error(`[Auth] DENIED: super_admin "${normalizedUsername}" attempted to access unauthorized portal "${normalizedSchoolCode}"`);
              return res.status(403).json({ message: 'Aad uma lihid inaad gasho portal-kan. Fadlan isticmaal koodhkaaga saxda ah ee lagu siiyay.' });
            }
          }
          user = globalUser;
        }
      }

      if (!user) {
        console.error(`[Auth] DENIED: User "${normalizedUsername}" not found in school "${school?.name || 'Unknown'}"`);
        return res.status(404).json({ 
          message: 'Dugsiga ama qofka la raadinayo lama helin. Hubi inaad branch-ka saxda ah dooratay.',
          debug: { receivedId: schoolId, receivedCode: normalizedSchoolCode } 
        });
      }

      // If we found a global user but school was null, we use the portal's school for context
      if (!user.schoolId && school) {
        user.school = school;
      }
    } else {
      user = await prisma.user.findFirst({
        where: {
          username: { equals: normalizedUsername, mode: 'insensitive' },
          schoolId: null
        },
        include: { school: { select: { id: true, name: true, logo: true } } }
      });

      if (user && !['owner', 'super_admin'].includes(user.role.toLowerCase())) {
        return res.status(403).json({ message: 'Fadlan koodhkaaga gaarka ah isticmaal si aad u gasho.' });
      }
    }

    if (!user) return res.status(401).json({ message: 'Aqoonsigaagu waa khaldan yahay' });

    // ── BRUTE FORCE PROTECTION CHECK (Progressive Timeout) ──
    const fails = user.failedLoginAttempts || 0;
    if (fails >= 3) {
      const group = Math.floor(fails / 3);
      const waitMinutes = group === 1 ? 1 : (group - 1) * 5;
      
      if (user.lastFailedAttempt) {
        const timeDiff = new Date() - new Date(user.lastFailedAttempt);
        const waitMs = waitMinutes * 60 * 1000;
        
        if (timeDiff < waitMs) {
          const remainingMs = waitMs - timeDiff;
          const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));
          return res.status(429).json({ 
            message: `Isku-daygaagu aad buu u badan yahay. Fadlan sug ${remainingMinutes} daqiiqo ka hor intaadan mar kale isku dayin.`,
            lockRemainingMs: remainingMs,
            lockedUntil: new Date(Date.now() + remainingMs).toISOString()
          });
        }
      }
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      const newFails = (user.failedLoginAttempts || 0) + 1;
      
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: newFails,
          lastFailedAttempt: new Date(),
          isLocked: false // Ensure it's never locked
        }
      });

      let warnMessage = 'Aqoonsigaagu waa khaldan yahay.';
      let lockRemainingMs = null;
      let lockedUntil = null;
      if (newFails >= 3) {
         const group = Math.floor(newFails / 3);
         const newWaitMins = group === 1 ? 1 : (group - 1) * 5;
         warnMessage += ` Isku-dayga xad dhaafka ah darteed, waxaa lagu xannibay ${newWaitMins} daqiiqo.`;
         lockRemainingMs = newWaitMins * 60 * 1000;
         lockedUntil = new Date(Date.now() + lockRemainingMs).toISOString();
      } else {
         const remainingAttempts = 3 - newFails;
         warnMessage += ` Waxaa kuu haray ${remainingAttempts} isku-day ka hor inta aan lagu xannibin 1 daqiiqo.`;
      }
      
      return res.status(401).json({ 
        message: warnMessage, 
        ...(lockRemainingMs && { lockRemainingMs, lockedUntil }) 
      });
    }

    // IF CORRECT PASSWORD: Reset failed attempts
    if (user.failedLoginAttempts > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lastFailedAttempt: null,
          isLocked: false
        }
      });
    }

    // ── ACTIVE STATUS CHECK (after password match) ──
    // Owners always bypass this check
    const userRoleCheck = (user.role || '').toLowerCase();
    if (userRoleCheck !== 'owner') {
      // Check if the user themselves is inactive
      if (user.isActive === false) {
        return res.status(403).json({ locked: true, message: 'Nidaamku waa xiran yahay. Fadlan bixi biilka system-ka.' });
      }
      // Check if the school is inactive
      if (user.schoolId) {
        const userSchool = await prisma.school.findUnique({
          where: { id: user.schoolId },
          select: { isActive: true, superAdminId: true }
        });
        if (userSchool?.isActive === false) {
          return res.status(403).json({ locked: true, message: 'Nidaamku waa xiran yahay. Fadlan bixi biilka system-ka si dib loogu furo. Kala xiriir shirkada wixii faahfaahin ah.' });
        }
        // Check if the super admin managing this school is inactive
        if (userSchool?.superAdminId) {
          const sa = await prisma.user.findUnique({ where: { id: userSchool.superAdminId }, select: { isActive: true } });
          if (sa?.isActive === false) {
            return res.status(403).json({ locked: true, message: 'Nidaamku waa xiran yahay. Fadlan bixi biilka system-ka si dib loogu furo. Kala xiriir shirkada wixii faahfaahin ah.' });
          }
        }
      }
    }

    // Build token payload — normalize role to lowercase
    const payload = {
      id: user.id,
      username: user.username,
      role: user.role.toLowerCase(),
      schoolId: user.schoolId || null,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '30d' });

    // Store FCM Token for push notifications if provided
    if (fcmToken) {
      await prisma.user.update({
        where: { id: user.id },
        data: { fcmToken }
      });
    }

    // Fetch profile and enrollment in parallel for students/parents
    let profileId = null;
    const userRole = (user.role || '').toLowerCase();
    
    try {
      if (userRole === 'student') {
        const student = await prisma.student.findUnique({ 
          where: { userId: user.id }, 
          include: { Enrollments: { where: { isCurrent: true }, take: 1, include: { clss: true, section: true, academicYear: true } } }
        });
        profileId = student?.id || null;
        
        if (student && student.Enrollments?.[0]) {
          const currentEnrollment = student.Enrollments[0];
          // Sync student record IF out of sync (don't await - let it happen in background or at least don't block)
          if (currentEnrollment.classId !== student.classId || currentEnrollment.sectionId !== student.sectionId) {
            prisma.student.update({
              where: { id: student.id },
              data: { classId: currentEnrollment.classId, sectionId: currentEnrollment.sectionId }
            }).catch(e => console.error('[Auth Healing] Error:', e.message));
          }

          user._currentEnrollment = {
            id: currentEnrollment.id,
            classId: currentEnrollment.classId,
            sectionId: currentEnrollment.sectionId,
            className: currentEnrollment.clss?.class_name || null,
            sectionName: currentEnrollment.section?.name || null,
            academicYearId: currentEnrollment.academicYearId,
            academicYearName: currentEnrollment.academicYear?.name || null,
          };
        }
      } else if (userRole === 'teacher') {
        const teacher = await prisma.teacher.findUnique({ where: { userId: user.id }, select: { id: true } });
        profileId = teacher?.id || null;
        if (!profileId) {
          // Fallback: create in background to not block login if it somehow got deleted
          prisma.teacher.create({ data: { userId: user.id, subject: 'General', phone: user.phone || null, salary: 0 } }).catch(() => {});
        }
      } else if (userRole === 'parent') {
        const parent = await prisma.parent.findUnique({ 
          where: { userId: user.id }, 
          select: { id: true, Children: { include: { student: { include: { Enrollments: { where: { isCurrent: true }, take: 1 } } } } } } 
        });
        profileId = parent?.id || null;
        
        // Background healing for children
        if (parent?.Children) {
          const updates = parent.Children
            .filter(c => c.student?.Enrollments?.[0] && (c.student.Enrollments[0].classId !== c.student.classId || c.student.Enrollments[0].sectionId !== c.student.sectionId))
            .map(c => prisma.student.update({
              where: { id: c.student.id },
              data: { classId: c.student.Enrollments[0].classId, sectionId: c.student.Enrollments[0].sectionId }
            }).catch(() => {}));
          // Don't await updates, let them finish
        }
      } else if (['accountant', 'librarian', 'staff'].includes(userRole)) {
        const staff = await prisma.staff.findUnique({ where: { userId: user.id }, select: { id: true } });
        profileId = staff?.id || null;
        if (!profileId) {
          prisma.staff.create({ data: { userId: user.id, position: userRole, department: 'General', salary: 0 } }).catch(() => {});
        }
      }
    } catch (err) { 
      console.error('[Auth Recovery] Error:', err);
    }

    res.json({
      token,
      role: user.role.toLowerCase(),
      userId: user.id,
      schoolId: user.schoolId,
      school: user.school,
      name: user.name,
      studentId: userRole === 'student' ? profileId : null,
      teacherId: userRole === 'teacher' ? profileId : null,
      parentId: userRole === 'parent' ? profileId : null,
      staffId: ['accountant', 'librarian', 'staff'].includes(userRole) ? profileId : null,
      // For students: return current enrollment info for immediate use without extra API call
      currentEnrollment: userRole === 'student' ? (user._currentEnrollment || null) : null,
      settings: user.schoolId ? await prisma.schoolSettings.findMany({ where: { schoolId: user.schoolId } }) : []
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /school-info - Get current school's info
router.get('/school-info', authenticateToken, cacheMiddleware(60), async (req, res) => {
  try {
    let schoolId = req.user.schoolId;

    // If token doesn't have schoolId, try to recover from User table
    if (!schoolId && !['owner', 'super_admin'].includes(req.user.role)) {
      const userRecord = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { schoolId: true }
      });
      if (userRecord?.schoolId) {
        schoolId = userRecord.schoolId;
        console.log(`[Auth/school-info] Recovered schoolId for ${req.user.role}: ${schoolId}`);
      }
    }

    if (!schoolId) {
      return res.status(404).json({ message: 'No school associated with this user' });
    }
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      include: { managedBy: { select: { isActive: true } } }
    });
    if (!school) return res.status(404).json({ message: 'School not found' });
    res.json(school);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /profile - Get current user's profile
router.get('/profile', authenticateToken, cacheMiddleware(30), async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        school: { 
          include: { 
            managedBy: { select: { isActive: true } } 
          } 
        },
        Teacher: {
          include: {
            SubjectAssignments: {
              include: { 
                section: { include: { class: true } }, 
                subject: true 
              }
            }
          }
        },
        Student: {
          include: {
            clss: { select: { id: true, class_name: true } },
            section: { select: { id: true, name: true } },
            Enrollments: { 
              where: { isCurrent: true }, 
              include: { clss: true, section: true } 
            }
          }
        },
        Parent: {
          include: {
            Children: {
              include: {
                student: {
                  include: {
                    user: { select: { name: true } },
                    clss: { select: { id: true, class_name: true } },
                    section: { select: { id: true, name: true } },
                    Enrollments: { 
                      where: { isCurrent: true }, 
                      include: { clss: true, section: true } 
                    }
                  }
                }
              }
            }
          }
        },
        Staff: true
      }
    });

    if (!user) return res.status(404).json({ message: 'User not found' });

    // Profile Healing: Auto-create missing student record for student-role users
    if (user.role === 'student' && !user.Student) {
      try {
        const hStudent = await prisma.student.create({
          data: {
            userId: user.id,
            student_id: user.username || `S-${user.id.substring(0, 8)}`,
            status: 'active'
          },
          include: { Enrollments: { where: { isCurrent: true }, include: { clss: true, section: true } } }
        });
        user.Student = hStudent;
      } catch (err) {
        console.error('Profile Healing Error:', err);
      }
    }

    // Get Global Current Academic Year
    const currentYear = user.schoolId 
      ? await prisma.academicYear.findFirst({
          where: { isCurrent: true, schoolId: user.schoolId }
        })
      : null;

    // Profile Healing & Unified Response
    if (user.Student) {
      const current = user.Student.Enrollments?.[0];
      if (current) {
        // Sync legacy fields if out of date
        if (current.classId !== user.Student.classId || current.sectionId !== user.Student.sectionId) {
          await prisma.student.update({
            where: { id: user.Student.id },
            data: { classId: current.classId, sectionId: current.sectionId }
          });
          // Update the object in memory for response
          user.Student.classId = current.classId;
          user.Student.sectionId = current.sectionId;
          user.Student.clss = current.clss;
          user.Student.section = current.section;
        }
        user.currentEnrollment = {
          id: current.id,
          classId: current.classId,
          sectionId: current.sectionId,
          className: current.clss?.class_name,
          sectionName: current.section?.name,
          academicYearId: current.academicYearId,
          isYearCurrent: current.academicYearId === currentYear?.id
        };
      }
    }

    if (user.Parent?.Children) {
      for (const child of user.Parent.Children) {
        const s = child.student;
        const current = s?.Enrollments?.[0];
        if (current) {
          // Sync legacy fields if out of date
          if (current.classId !== s.classId || current.sectionId !== s.sectionId) {
            await prisma.student.update({
              where: { id: s.id },
              data: { classId: current.classId, sectionId: current.sectionId }
            });
            s.classId = current.classId;
            s.sectionId = current.sectionId;
          }
          child.student.currentEnrollment = {
            id: current.id,
            classId: current.classId,
            sectionId: current.sectionId,
            className: current.clss?.class_name,
            sectionName: current.section?.name,
            academicYearId: current.academicYearId,
            isYearCurrent: current.academicYearId === currentYear?.id
          };
        }
      }
    }

    res.json({
      ...user,
      currentYear: currentYear ? { id: currentYear.id, name: currentYear.name } : null
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /profile - Update current user's profile
router.put('/profile', authenticateToken, async (req, res) => {
  const { name, username, password, phone } = req.body;

  try {
    const data = {};
    if (name) data.name = name;
    if (phone) data.phone = phone;

    if (username) {
      const cleanUsername = username.trim().toLowerCase();
      // Check if username is taken by another user in the same context (global if owner/super, or same school)
      const existing = await prisma.user.findFirst({
        where: {
          username: cleanUsername,
          schoolId: req.user.schoolId,
          NOT: { id: req.user.id }
        }
      });
      if (existing) return res.status(400).json({ message: 'Username is already taken' });
      data.username = cleanUsername;
    }

    if (password) {
      if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
      data.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: { id: true, name: true, username: true, role: true }
    });

    res.json({ message: 'Profile updated successfully', user: updatedUser });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /fcm-token - Update current user's FCM token
router.put('/fcm-token', authenticateToken, async (req, res) => {
  const { fcmToken } = req.body;
  if (!fcmToken) return res.status(400).json({ message: 'Missing FCM Token' });

  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { fcmToken }
    });
    res.json({ message: 'FCM Token updated successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
