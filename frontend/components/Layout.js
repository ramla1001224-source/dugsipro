import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { useLanguage } from '../context/LanguageContext'
import { getImageUrl } from '../utils/imageHelper'
import Link from 'next/link'
import LockScreen from './LockScreen'
import NotificationBell from './NotificationBell'
import AdBanner from './AdBanner'
import { requestForToken, onMessageListener } from '../utils/firebase'

const Toast = ({ title, body, onClose }) => (
  <div className="fixed top-4 right-4 z-[9999] bg-white rounded-xl shadow-2xl p-4 min-w-[300px] border border-blue-100 flex items-start gap-3 animate-fade-in-down">
    <div className="bg-blue-100 p-2 rounded-full text-blue-600">
      🔔
    </div>
    <div className="flex-1">
      <h4 className="text-sm font-bold text-slate-800">{title}</h4>
      <p className="text-xs text-slate-600 mt-1">{body}</p>
    </div>
    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
  </div>
)

const navConfig = (t) => ({
  admin: [
    { label: `📊 ${t('dashboard')}`, section: 'main', href: '/admin/dashboard' },
    { label: `👤 ${t('profile')}`, section: 'main', href: '/admin/profile' },
    { label: `👨‍🎓 ${t('student_hub')}`, section: 'main', href: '/admin/students' },
    { label: `👨‍👩‍👧 ${t('parents')}`, section: 'main', href: '/admin/parents' },
    { label: `👨‍🏫 ${t('teachers')}`, section: 'main', href: '/admin/teachers' },
    { label: `👥 ${t('staff')}`, section: 'main', href: '/admin/staff' },
    { label: `🏫 ${t('academic')}`, section: 'main', href: '/admin/academic' },
    { label: `📚 ${t('library')}`, section: 'main', href: '/librarian/library' },
    // Attendance and Fees moved into Student Hub
    // { label: `📅 ${t('attendance')}`, section: 'main', href: '/admin/attendance' },
    { label: `📈 ${t('reports')}`, section: 'finance', href: '/admin/reports' },
    // { label: `💰 ${t('fees')}`, section: 'finance', href: '/admin/fees' },
    { label: `💸 ${t('payroll')}`, section: 'finance', href: '/admin/salary' },
    { label: `📉 ${t('expenses')}`, section: 'finance', href: '/admin/expenses' },
    { label: `📝 ${t('exam_center')}`, section: 'academics', href: '/admin/exams' },
    // { label: `🗓️ Jadwalka Imtixaanka`, section: 'academics', href: '/admin/exam-scheduling' },
    { label: `📅 ${t('timetable')}`, section: 'academics', href: '/admin/timetable' },
    { label: `🗓️ ${t('academic_years')}`, section: 'academics', href: '/admin/academic-years' },
    { label: `📚 ${t('homework')}`, section: 'academics', href: '/admin/homework' },
    { label: `🎥 ${t('zoom_live')}`, section: 'academics', href: '/admin/virtual-classes' },
    { label: `📝 ${t('elearning')}`, section: 'academics', href: '/admin/elearning' },
    { label: `🎥 ${t('video_lessons')}`, section: 'academics', href: '/teacher/lessons' },
    // { label: `📊 ${t('marks')}`, section: 'academics', href: '/admin/marks' },
    // { label: `💬 ${t('email_sms')}`, section: 'comm', href: '/admin/results-sms' },
    { label: `📢 ${t('announcements')}`, section: 'comm', href: '/admin/announcements' },
    { label: `💬 SMS Waalidiinta`, section: 'comm', href: '/admin/sms-parents' },
    { label: `🔔 ${t('notifications')}`, section: 'comm', href: '/admin/notifications' },
    { label: `📅 ${t('events')}`, section: 'comm', href: '/admin/events' },
    { label: `⚙️ ${t('settings')}`, section: 'system', href: '/settings' },
  ],
  teacher: [
    { label: `📊 ${t('dashboard')}`, href: '/teacher/dashboard' },
    { label: `📝 ${t('exams')}`, href: '/admin/exams-manage' },
    { label: `📅 ${t('exams_schedule')}`, href: '/teacher/exam-schedule' },
    { label: `📅 ${t('timetable')}`, href: '/teacher/timetable' },
    { label: `📚 ${t('homework')}`, href: '/teacher/homework' },
    { label: `🎥 ${t('zoom_live')}`, href: '/teacher/virtual-classes' },
    { label: `🎥 ${t('video_lessons')}`, href: '/teacher/lessons' },
    { label: `📝 ${t('elearning')}`, href: '/teacher/quizzes' },
    { label: `📢 ${t('announcements')}`, href: '/teacher/announcements' },
    { label: `⚙️ ${t('settings')}`, href: '/settings' },
  ],
  student: [
    { label: `📊 ${t('dashboard')}`, href: '/student/dashboard' },
    { label: `✅ ${t('attendance')}`, href: '/student/attendance' },
    { label: `📅 ${t('timetable')}`, href: '/student/timetable' },
    { label: `📚 ${t('homework')}`, href: '/student/homework' },
    { label: `🎥 ${t('zoom_live')}`, href: '/student/virtual-classes' },
    { label: `🎥 ${t('video_lessons')}`, href: '/student/lessons' },
    { label: `📝 ${t('elearning')}`, href: '/student/quizzes' },
    { label: `📝 ${t('marks')}`, href: '/student/marks' },
    { label: `📅 ${t('exams_schedule')}`, href: '/student/exam-schedule' },
    { label: `📢 ${t('announcements')}`, href: '/student/announcements' },
    { label: `🔔 ${t('notifications')}`, href: '/student/notifications' },
    { label: `⚙️ ${t('settings')}`, href: '/settings' },
  ],
  parent: [
    { label: `📊 ${t('dashboard')}`, href: '/parent/dashboard' },
    { label: `✅ ${t('attendance')}`, href: '/parent/attendance' },
    { label: `📝 ${t('marks')}`, href: '/parent/marks' },
    { label: `💸 ${t('payments')}`, href: '/parent/payments' },
    { label: `📅 ${t('exams_schedule')}`, href: '/parent/exam-schedule' },
    { label: `📢 ${t('announcements')}`, href: '/parent/announcements' },
    { label: `🔔 ${t('notifications')}`, href: '/parent/notifications' },
    { label: `⚙️ ${t('settings')}`, href: '/settings' },
  ],
  accountant: [
    { label: `📊 ${t('dashboard')}`, href: '/accountant/dashboard' },
    { label: `💰 ${t('student_fees')}`, href: '/accountant/payments' },
    { label: `📝 ${t('student_attendance')}`, href: '/accountant/attendance' },
    { label: `📢 ${t('announcements')}`, href: '/admin/announcements' },
    { label: `⚙️ ${t('settings')}`, href: '/settings' },
  ],
    staff: [
    { label: `📊 ${t('dashboard')}`, href: '/staff/dashboard' },
    { label: `👤 ${t('profile')}`, href: '/staff/profile' },
    { label: `📢 ${t('announcements')}`, href: '/admin/announcements' },
    { label: `⚙️ ${t('settings')}`, href: '/settings' },
  ],
  librarian: [
    { label: `📊 ${t('dashboard')}`, href: '/librarian/dashboard' },
    { label: `📚 ${t('library')}`, href: '/librarian/library' },
    { label: `📢 ${t('announcements')}`, href: '/admin/announcements' },
    { label: `⚙️ ${t('settings')}`, href: '/settings' },
  ],
  owner: [
    { label: `⚠️ System Logs`, section: 'main', href: '/owner/errors' },
    { label: `📱 Ads Management`, section: 'main', href: '/owner/ads' },
    { label: `🚀 ${t('dashboard')}`, section: 'main', href: '/owner/dashboard' },
    { label: `🛡️ ${t('manage_super_admins')}`, section: 'main', href: '/owner/admins' },
    { label: `👤 ${t('profile')}`, section: 'main', href: '/admin/profile' },
  ],
  super_admin: [
    { label: `🚀 ${t('dashboard')}`, section: 'main', href: '/super-admin/dashboard' },
    { label: `👤 ${t('profile')}`, section: 'main', href: '/admin/profile' },
  ]
})

const getSectionLabels = (t) => ({ main: t('management'), academics: t('academic'), finance: t('finance'), comm: t('communications'), ops: t('operations'), system: t('system') })

export default function Layout({ children, title }) {
  const router = useRouter()
  const { language, setLanguage, t } = useLanguage()
  const [role, setRole] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isImpersonating, setIsImpersonating] = useState(false)
  const [isImpersonatingSuper, setIsImpersonatingSuper] = useState(false)
  const [impersonatedSchool, setImpersonatedSchool] = useState('')
  const [schoolInfo, setSchoolInfo] = useState(null)
  const [toastNotification, setToastNotification] = useState(null)
  const [showPushPrompt, setShowPushPrompt] = useState(false)

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'

  useEffect(() => {
    // PERSISTENCE: Recover sidebar state from localStorage
    const savedState = localStorage.getItem('sidebarOpen')
    if (savedState !== null) {
      setSidebarOpen(savedState === 'true')
    } else {
      // Default to closed on mobile, open on desktop
      if (window.innerWidth < 768) setSidebarOpen(false)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('sidebarOpen', sidebarOpen)
  }, [sidebarOpen])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/')
      return
    }
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      console.log('Layout: JWT Payload:', payload);
      const userRole = (payload.role || '').toLowerCase();
      setRole(userRole)
      setIsImpersonating(payload.isImpersonating || false)
      setIsImpersonatingSuper(payload.isImpersonatingSuper || false)
      setImpersonatedSchool(payload.schoolName || '')

      // Fetch school info if applicable
      const schoolId = payload.schoolId
      console.log('Layout: schoolId from payload:', schoolId);
      if (schoolId || userRole === 'super_admin' || userRole === 'admin' || userRole === 'accountant' || userRole === 'librarian' || userRole === 'teacher' || userRole === 'staff' || userRole === 'student' || userRole === 'parent') {
        fetch(`${apiUrl}/api/auth/school-info`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
          .then(async res => {
            const data = await res.json()
            if (res.status === 403 && data.suspended) {
              setSchoolInfo({ isActive: false, id: 'suspended' })
            } else if (data.id) {
              setSchoolInfo(data)
              localStorage.setItem('schoolInfo', JSON.stringify(data))
            }
          })
          .catch(e => console.error('Layout: School Info Error:', e))
      }

      // 🛡️ ROLE PROTECTION:
      if (userRole !== 'owner' && router.pathname.startsWith('/owner')) {
        console.warn('Layout: Unauthorized role on owner page, redirecting...');
        const dashboard = userRole === 'super_admin' ? '/super-admin/dashboard' : '/admin/dashboard';
        router.push(dashboard);
      }
      // Protect /admin/students from non-admins
      if (['teacher', 'accountant', 'staff'].includes(userRole) && router.pathname.startsWith('/admin/students')) {
        router.push('/' + userRole + '/dashboard');
      }

      // NOTE: Push notification token registration is intentionally disabled on web.
      // Mobile app exclusively handles FCM token registration for push notifications.
      // Web users will still see in-app toast notifications via onMessageListener.

    } catch (e) {
      console.error('Layout: Auth Effect Error:', e);
      router.push('/')
    }
  }, [router.pathname])

  useEffect(() => {
    onMessageListener((payload) => {
      setToastNotification({
        title: payload?.notification?.title,
        body: payload?.notification?.body,
      });
      // Auto dismiss after 5 seconds
      setTimeout(() => setToastNotification(null), 5000);
    });
  }, []);

  const links = navConfig(t)[role] || []
  const sections = role === 'admin'
    ? Object.keys(getSectionLabels(t)).filter(s => links.some(l => l.section === s))
    : null

  const logout = () => { 
    // Clear ALL session data to prevent ghost/stale data on next login
    const keysToRemove = ['token', 'role', 'schoolId', 'schoolInfo', 'selectedSchool', 'sidebarOpen',
      'originalSuperAdminToken', 'originalOwnerToken']
    keysToRemove.forEach(k => localStorage.removeItem(k))
    // Clear AI chat histories
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('ai_chat_history_')) localStorage.removeItem(key)
    })
    window.location.href = '/'
  }

  const returnToSuperAdmin = async () => {
    const originalToken = localStorage.getItem('originalSuperAdminToken')
    const originalOwnerToken = localStorage.getItem('originalOwnerToken')

    if (originalToken) {
      // Returning from School -> Super Admin Dashboard
      try {
        const payload = JSON.parse(atob(originalToken.split('.')[1]))
        localStorage.setItem('token', originalToken)
        localStorage.setItem('role', payload.role)
        localStorage.removeItem('originalSuperAdminToken')
        window.location.href = '/super-admin/dashboard'
      } catch (e) {
        logout()
      }
    } else if (originalOwnerToken) {
      // Returning from Super Admin Dashboard -> Owner Dashboard
      try {
        localStorage.setItem('token', originalOwnerToken)
        localStorage.setItem('role', 'owner')
        localStorage.removeItem('originalOwnerToken')
        window.location.href = '/owner/admins'
      } catch (e) {
        logout()
      }
    } else {
      logout()
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col overflow-x-hidden print:block print:min-h-0 print:overflow-visible print:bg-white">
      {toastNotification && (
        <Toast 
          title={toastNotification.title} 
          body={toastNotification.body} 
          onClose={() => setToastNotification(null)} 
        />
      )}
      {/* Push Notification Prompt removed - Mobile app handles push notifications exclusively */}
      {/* Impersonation Banner */}
      {isImpersonating && (
        <div className="bg-slate-900 text-white px-8 py-3 flex items-center justify-between z-[60] border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            <p className="text-xs font-black uppercase tracking-widest">
              {t('viewing_school')}: <span className="text-blue-400">{impersonatedSchool}</span>
            </p>
          </div>
          <button
            onClick={returnToSuperAdmin}
            className="bg-white/10 hover:bg-white/20 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-lg transition-all border border-white/10"
          >
            ⏎ {t('return_to_super')}
          </button>
        </div>
      )}
      <div className="flex-1 flex overflow-x-hidden print:block print:overflow-visible">
        {/* Sidebar Overlay for Mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-0 md:overflow-hidden'} 
        transition-all duration-300 bg-slate-900 h-screen fixed inset-y-0 left-0 z-50 flex flex-col w-64 md:fixed print:hidden
      `}>
          <div className="p-6 border-b border-slate-800 flex items-center gap-3">
            {schoolInfo?.logo ? (
              <div className="w-10 h-10 rounded-xl bg-white/10 p-1 flex-shrink-0">
                <img src={getImageUrl(schoolInfo.logo)} alt="Logo" width="40" height="40" style={{ width: '40px', height: '40px' }} className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center">
                <img src="/logo.svg" alt="Logo" width="40" height="40" style={{ width: '40px', height: '40px' }} className="w-full h-full object-contain drop-shadow-md" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-xl font-black text-white tracking-tight truncate">
                {schoolInfo?.name || 'Dugsi Pro'}<span className="text-blue-400">{schoolInfo?.name ? '' : 'System'}</span>
              </h1>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.3em] mt-1 truncate">
                {schoolInfo?.name ? t('educational_portal') : t('enterprise_edition')}
              </p>
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto py-4 px-3 custom-scrollbar">
            {role === 'admin' && sections ? (
              sections.map(section => (
                <div key={section} className="mb-4">
                  <p className="text-slate-600 text-[10px] font-bold uppercase tracking-[0.2em] px-3 mb-2">{getSectionLabels(t)[section]}</p>
                  {links.filter(l => l.section === section).map(link => (
                    <Link key={link.href} href={link.href}
                      onClick={() => { if (window.innerWidth < 768) setSidebarOpen(false) }}
                      className={`block px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-0.5 ${router.pathname === link.href ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                    >{link.label}</Link>
                  ))}
                </div>
              ))
            ) : (
              links.map(link => (
                <Link key={link.href} href={link.href}
                  onClick={() => { if (window.innerWidth < 768) setSidebarOpen(false) }}
                  className={`block px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-0.5 ${router.pathname === link.href ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                >{link.label}</Link>
              ))
            )}
          </nav>
          <div className="p-4 border-t border-slate-800">
            <button onClick={logout} className="w-full text-slate-500 hover:text-red-400 text-sm font-bold py-2 transition-colors">🚪 {t('logout')}</button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className={`flex-1 min-w-0 transition-all duration-300 print:m-0 print:p-0 print:block print:overflow-visible ${sidebarOpen ? 'md:ml-64' : 'ml-0'}`}>
          <header className="sticky top-0 bg-white/80 backdrop-blur-lg border-b border-gray-100 px-4 md:px-8 py-4 flex items-center justify-between z-30 print:hidden">
            <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-slate-400 hover:text-slate-800 transition-colors p-2 -ml-2 rounded-lg hover:bg-gray-100 flex-shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
              <div className="flex items-center gap-3 min-w-0">
                {schoolInfo?.logo ? (
                  <div className="w-8 h-8 rounded-lg bg-slate-50 p-1 border border-gray-100 hidden sm:flex items-center justify-center flex-shrink-0">
                    <img src={schoolInfo.logo.startsWith('public/') ? `${apiUrl}/${schoolInfo.logo.replace('public/', '')}` : schoolInfo.logo} alt="Logo" width="32" height="32" style={{ width: '32px', height: '32px' }} className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-8 h-8 hidden sm:flex items-center justify-center flex-shrink-0">
                    <img src="/logo.svg" alt="Logo" width="32" height="32" style={{ width: '32px', height: '32px' }} className="w-full h-full object-contain filter drop-shadow-sm" />
                  </div>
                )}
                <h2 className="text-lg md:text-xl font-black text-slate-800 truncate">{title}</h2>
              </div>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
              <NotificationBell />
              <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
                <button
                  onClick={() => setLanguage('en')}
                  className={`px-2 md:px-3 py-1 rounded-lg text-[10px] md:text-xs font-black transition-all ${language === 'en' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >EN</button>
                <button
                  onClick={() => setLanguage('so')}
                  className={`px-2 md:px-3 py-1 rounded-lg text-[10px] md:text-xs font-black transition-all ${language === 'so' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >SO</button>
              </div>
              <span className="hidden sm:block bg-blue-50 text-blue-600 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">{role}</span>
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white text-xs font-black shadow-sm flex-shrink-0">
                {role ? role[0].toUpperCase() : '?'}
              </div>
            </div>
          </header>
          <div className="p-4 md:p-8 print:p-0">
            {schoolInfo && schoolInfo.isActive === false && (role === 'admin' || role === 'super_admin' || role === 'accountant' || role === 'librarian' || role === 'teacher' || role === 'staff') && !isImpersonating && !isImpersonatingSuper ? (
              <LockScreen />
            ) : (
              <>
                {children}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
