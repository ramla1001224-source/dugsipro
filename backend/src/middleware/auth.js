const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  let token = (authHeader && authHeader.split(' ')[1]) || req.query.token;
  
  // Robust token cleaning: remove quotes and trim
  if (token) {
    token = token.trim().replace(/^["']|["']$/g, '');
  }

  if (!token || token === 'null' || token === 'undefined') {
    return res.status(401).json({ message: 'Missing token' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'dev-secret', async (err, user) => {
    if (err) {
      console.error('[Auth] Token verification failed:', err.message);
      return res.status(403).json({ message: 'Invalid token' });
    }
    req.user = user; // { id, username, role, schoolId }
    if (req.user && req.user.role) {
      req.user.role = req.user.role.toLowerCase();
    }

    // Check for school suspension if user belongs to a school
    // Only 'owner' bypasses school suspension checks
    if (user.schoolId && !['owner'].includes(user.role)) {
      try {
        const prisma = require('../prisma');
        
        // Fetch school including its Super Admin manager
        const school = await prisma.school.findUnique({
          where: { id: user.schoolId },
          include: { managedBy: { select: { isActive: true } } }
        });

        // If the Super Admin who manages this school is inactive, block access for admins
        if (school && school.managedBy && !school.managedBy.isActive) {
          if (['super_admin', 'admin'].includes(user.role)) {
            return res.status(403).json({ 
              message: 'Fadlan bixi biilka Bisha',
              suspended: true 
            });
          }
        }
      } catch (dbErr) {
        console.error('Middleware: Error checking school status:', dbErr);
      }
    }

    next();
  });
}

function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
    const userRole = (req.user.role || '').toLowerCase();
    if (!roles.some(r => r.toLowerCase() === userRole)) return res.status(403).json({ message: 'Forbidden' });
    next();
  };
}

/**
 * Ensures the user belongs to the same school or has authorized access (siblings).
 * @param {boolean} allowSiblings - If true, allows admins of schools sharing the same superAdminId (owner).
 */
function requireSchoolAccess(allowSiblings = false) {
  return async (req, res, next) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
      
      const role = (req.user.role || '').toLowerCase();
      const userSchoolId = req.user.schoolId;
      const prisma = require('../prisma');

      // 1. Global Managers (super_admin OR owner without a restricted schoolId)
      const isGlobalManager = role === 'super_admin' || (role === 'owner' && !userSchoolId);
      if (isGlobalManager) return next();

      const requestedSchoolId = req.query.schoolId || req.body.schoolId || req.params.schoolId;

      // 2. No specific school requested: ensure user has an assigned school
      if (!requestedSchoolId) {
          if (!userSchoolId) return res.status(403).json({ message: 'Ma lihid fasax iskuul (No school assigned)' });
          return next();
      }

      // 3. Direct Match: accessing their own assigned school
      if (requestedSchoolId === userSchoolId) return next();

      // 4. Sibling-Aware Isolation
      // Allows Admins to interact with branches/schools owned by their same manager
      if (allowSiblings && userSchoolId) {
          const [reqSchool, userSchool] = await Promise.all([
              prisma.school.findUnique({ where: { id: requestedSchoolId }, select: { superAdminId: true } }),
              prisma.school.findUnique({ where: { id: userSchoolId }, select: { superAdminId: true } })
          ]);
          
          if (reqSchool && userSchool && reqSchool.superAdminId && reqSchool.superAdminId === userSchool.superAdminId) {
              return next();
          }
      }

      // 5. Unauthorized Access
      return res.status(403).json({ 
        message: 'Fadlan ma lihid fasax aad xogta iskuulkan ku akhriso ama ku bedesho (Access Denied: Cross-school isolation)' 
      });
    } catch (err) {
      console.error('[AuthMiddleware] reqSchoolAccess Error:', err);
      return res.status(500).json({ message: 'Cillad ayaa dhacday intii la hubinayay fasaxa iskuulka' });
    }
  };
}

/**
 * Ensures the user has a specific permission defined in SchoolSettings.
 * Admins, Super Admins, and Owners have all permissions.
 * Other roles must have the permission key set to 'true' in the database.
 */
function authorizePermission(permissionKey) {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
    
    let { role, schoolId } = req.user;

    // Admin, Super Admin, and Owner bypass permission checks
    if (['admin', 'super_admin', 'owner'].includes((role || '').toLowerCase())) {
      return next();
    }

    const prisma = require('../prisma');

    // Robust schoolId recovery for non-admin staff
    if (!schoolId) {
      try {
        const staff = await prisma.staff.findFirst({
          where: { userId: req.user.id }
        });
        if (staff) schoolId = staff.schoolId;
      } catch (err) {
        console.error('Middleware: SchoolId recovery error:', err);
      }
    }

    if (!schoolId) {
      return res.status(403).json({ message: 'No school assigned to this user' });
    }

    try {
      const setting = await prisma.schoolSettings.findUnique({
        where: {
          key_schoolId: {
            key: permissionKey,
            schoolId: schoolId
          }
        }
      });

      // Permissions are stored as strings 'true' or 'false'
      if (setting && setting.value === 'true') {
        req.user.schoolId = schoolId; // Attach recovered schoolId for later use
        return next();
      }

      return res.status(403).json({ 
        message: `Fasax uma lihid falkan (${permissionKey}). Fadlan la xiriir maamulka.`,
        permissionRequired: permissionKey
      });
    } catch (err) {
      console.error('Permission check error:', err);
      res.status(500).json({ message: 'Error checking permissions' });
    }
  };
}

module.exports = { authenticateToken, authorizeRoles, requireSchoolAccess, authorizePermission };
