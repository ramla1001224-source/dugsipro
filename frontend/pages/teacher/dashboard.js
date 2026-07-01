import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import axios from 'axios'
import { StatSkeleton, TableSkeleton, LoadingOverlay } from '../../components/DashboardSkeleton'
import { useLanguage } from '../../context/LanguageContext'

export default function TeacherDashboard() {
  const { t } = useLanguage()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [announcements, setAnnouncements] = useState([])

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
    if (!token) return window.location.href = '/'

    // Role Guard: Only teachers can access this page
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      if (payload.role !== 'teacher') {
        const d = { owner: '/owner/dashboard', super_admin: '/super-admin/dashboard', admin: '/admin/dashboard', student: '/student/dashboard', parent: '/parent/dashboard', accountant: '/accountant/dashboard', staff: '/staff/dashboard', librarian: '/librarian/dashboard' }
        return window.location.href = d[payload.role] || '/'
      }
    } catch (e) { return window.location.href = '/' }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = { Authorization: `Bearer ${token}` }
    const fetchStats = axios.get(`${apiUrl}/api/dashboard/teacher-stats`, { headers }).catch(e => ({ data: {} }))
    const fetchAnnouncements = axios.get(`${apiUrl}/api/announcements`, { headers }).catch(e => ({ data: [] }))

    Promise.all([fetchStats, fetchAnnouncements])
      .then(([statsRes, annRes]) => {
        setStats(statsRes.data)
        setAnnouncements(Array.isArray(annRes.data) ? annRes.data.slice(0, 3) : [])
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [])

  const classes = stats?.assignedClasses || []

  return (
    <Layout title={t('teacher_dashboard')}>
      {loading && <LoadingOverlay />}
      
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">{t('welcome_teacher')}</h2>
          <p className="text-gray-400 text-sm font-medium uppercase tracking-widest">{t('teacher_subtitle')}</p>
        </div>
        {stats?.currentYear && (
            <div className="bg-indigo-50 border border-indigo-100 px-5 py-2.5 rounded-2xl flex flex-col items-end shadow-sm">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-0.5">{t('academic_year')}</span>
                <span className="text-sm font-black text-indigo-600 tracking-tight">{stats.currentYear.name}</span>
            </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {loading ? (
            <>
                <StatSkeleton />
                <StatSkeleton />
                <StatSkeleton />
                <StatSkeleton />
            </>
        ) : (
          <>
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all hover:-translate-y-1">
              <div className="flex flex-col">
                <h3 className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-2">{t('my_classes')}</h3>
                <p className="text-3xl font-black text-slate-800 tracking-tighter">{stats?.myClasses || 0}</p>
                <p className="text-[9px] text-gray-400 font-bold mt-1 uppercase tracking-widest">{t('assigned_groups')}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl shadow-inner">📚</div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all hover:-translate-y-1">
              <div className="flex flex-col">
                <h3 className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-2">{t('my_students')}</h3>
                <p className="text-3xl font-black text-slate-800 tracking-tighter">{stats?.myStudents || 0}</p>
                <p className="text-[9px] text-gray-400 font-bold mt-1 uppercase tracking-widest">{t('total_number')}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl shadow-inner">👥</div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all hover:-translate-y-1">
              <div className="flex flex-col">
                <h3 className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-2">{t('homeworks')}</h3>
                <p className="text-3xl font-black text-slate-800 tracking-tighter">{stats?.pendingHomework || 0}</p>
                <p className="text-[9px] text-gray-400 font-bold mt-1 uppercase tracking-widest">{t('pending')}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl shadow-inner">📝</div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all hover:-translate-y-1">
              <div className="flex flex-col">
                <h3 className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-2">{t('attendance')}</h3>
                <p className="text-3xl font-black text-slate-800 tracking-tighter">{stats?.todayAttendance || 0}</p>
                <p className="text-[9px] text-gray-400 font-bold mt-1 uppercase tracking-widest">{t('marked_today') || 'Marked Today'}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-xl shadow-inner">📅</div>
            </div>
          </>
        )}
      </div>

      {/* Announcements Widget */}
      {!loading && announcements.length > 0 && (
        <div className="mb-8 bg-gradient-to-r from-emerald-600 to-teal-700 rounded-[2.5rem] p-8 shadow-xl shadow-emerald-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl group-hover:scale-110 transition-all duration-700"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-xl">📢</div>
                <div>
                  <h3 className="text-white font-black uppercase tracking-widest text-sm">{t('announcements')}</h3>
                  <p className="text-emerald-100 text-[10px] font-bold uppercase tracking-tight">Farriimaha Maamulka</p>
                </div>
              </div>
              <Link href="/teacher/announcements">
                <span className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer backdrop-blur-sm">
                  View All →
                </span>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {announcements.map(a => (
                <div key={a.id} className="bg-white/10 backdrop-blur-md border border-white/10 p-5 rounded-2xl hover:bg-white/20 transition-all cursor-default group/item">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${a.priority === 'urgent' ? 'bg-red-400 animate-pulse' : a.priority === 'high' ? 'bg-amber-400' : 'bg-emerald-300'}`}></span>
                    <span className="text-[9px] font-black text-emerald-100 uppercase tracking-widest">
                      {new Date(a.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="text-white font-bold text-sm line-clamp-1 group-hover/item:text-emerald-200 transition-colors">{a.title}</h4>
                  <p className="text-emerald-100/70 text-xs mt-1 line-clamp-2 leading-relaxed">{a.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {loading ? <TableSkeleton /> : (
        <div className="bg-white rounded-[3rem] shadow-sm border border-gray-100 overflow-hidden group hover:shadow-md transition-all">
          <div className="px-10 py-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
            <div>
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">{t('active_sessions')}</h2>
              <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase">{t('work_schedule')}</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-white text-gray-400 text-[9px] uppercase tracking-[0.2em] font-black border-b border-gray-50">
                <tr>
                  <th className="px-10 py-5 font-black">{t('class_section')}</th>
                  <th className="px-8 py-5 font-black text-center">{t('subject')}</th>
                  <th className="px-8 py-5 font-black text-center">{t('time')}</th>
                  <th className="px-10 py-5 font-black text-right">{t('action')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-xs font-bold text-slate-600">
                {classes.map((cls) => (
                  <tr key={cls.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-10 py-6">
                        <div className="flex flex-col">
                            <span className="text-slate-800 font-black uppercase tracking-tight text-sm">{cls.class_name}</span>
                            <span className="text-[10px] text-indigo-600 uppercase font-black tracking-widest">{t('section_label')} {cls.section}</span>
                        </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <span className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl text-[10px] uppercase font-black border border-indigo-100 shadow-sm">{cls.subject?.name || '---'}</span>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <span className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl shadow-sm ${
                        cls.shift === 'morning' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                        cls.shift === 'night' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' :
                        'bg-amber-50 text-amber-600 border border-amber-100'
                      }`}>
                        {cls.shift === 'morning' ? t('subax_am') : cls.shift === 'night' ? t('habeen_night') || '🌙 Habeen' : t('galab_pm')}
                      </span>
                    </td>
                    <td className="px-10 py-6 text-right">
                      <button className="text-white hover:bg-slate-900 bg-slate-800 font-black uppercase text-[9px] tracking-widest px-5 py-2.5 rounded-2xl transition-all shadow-lg hover:shadow-indigo-200">{t('view_session')}</button>
                    </td>
                  </tr>
                ))}
                {classes.length === 0 && (
                  <tr>
                    <td colSpan="4" className="px-10 py-16 text-center text-gray-400 font-bold uppercase tracking-widest italic opacity-60">{t('no_sessions_assigned')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Layout>
  )
}
