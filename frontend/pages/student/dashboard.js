import { useState, useEffect } from 'react'
import axios from 'axios'
import Link from 'next/link'
import Layout from '../../components/Layout'
import { useLanguage } from '../../context/LanguageContext'
import { StatSkeleton, TableSkeleton, LoadingOverlay } from '../../components/DashboardSkeleton'
export default function StudentDashboard() {
  const { t } = useLanguage()
  const [stats, setStats] = useState(null)
  const [grades, setGrades] = useState([])
  const [gradingScales, setGradingScales] = useState([])
  const [examSummary, setExamSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [announcements, setAnnouncements] = useState([])

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
    if (!token) return window.location.href = '/'

    // Role Guard: Only students can access this page
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      if (payload.role !== 'student') {
        const dashboards = {
          owner: '/owner/dashboard', super_admin: '/super-admin/dashboard',
          admin: '/admin/dashboard', teacher: '/teacher/dashboard',
          parent: '/parent/dashboard', accountant: '/accountant/dashboard',
          staff: '/staff/dashboard', librarian: '/librarian/dashboard',
        }
        return window.location.href = dashboards[payload.role] || '/'
      }
    } catch (e) {
      return window.location.href = '/'
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = { Authorization: `Bearer ${token}` }

    const fetchStats = axios.get(`${apiUrl}/api/dashboard/student-stats`, { headers }).catch(e => ({ data: {} }))
    const fetchGrade = axios.get(`${apiUrl}/api/exams/student-results`, { headers }).catch(e => ({ data: [] }))
    const fetchAnnouncements = axios.get(`${apiUrl}/api/announcements`, { headers }).catch(e => ({ data: [] }))

    Promise.all([fetchStats, fetchGrade, fetchAnnouncements])
      .then(([statsRes, gradeRes, annRes]) => {
        setStats(statsRes.data || {})

        const rawData = gradeRes.data?.data || gradeRes.data;
        const gData = rawData?.results || (Array.isArray(rawData) ? rawData : []);
        setGrades(gData)
        setGradingScales(rawData?.gradingScales || [])
        // Store exam summary for dashboard stats
        if (rawData && rawData.grandTotal !== undefined) {
          const avg = rawData.average !== undefined
            ? rawData.average
            : (rawData.grandMax > 0 ? parseFloat(((rawData.grandTotal / rawData.grandMax) * 100).toFixed(1)) : 0)
          setExamSummary({
            grandTotal: rawData.grandTotal,
            grandMax: rawData.grandMax,
            average: avg,
            status: rawData.status || (avg >= 50 ? 'Pass' : 'Fail'),
            classPosition: rawData.classPosition || null,
            totalStudentsInClass: rawData.totalStudentsInClass || 0,
          })
        }
        setAnnouncements(Array.isArray(annRes.data) ? annRes.data.slice(0, 3) : [])

        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [])

  const calculateGrade = (marks, totalMarks) => {
    if (!totalMarks || isNaN(marks)) return 'F';
    const percentage = Math.round((marks / totalMarks) * 100)

    // Robust dynamic scale matching (DESC sort ensures correct priority)
    if (gradingScales && gradingScales.length > 0) {
      const sortedScales = [...gradingScales]
        .filter(s => s && s.minScore !== undefined)
        .sort((a, b) => (Number(b.minScore) || 0) - (Number(a.minScore) || 0));
        
      for (const scale of sortedScales) {
        if (percentage >= (Number(scale.minScore) || 0)) {
          return scale.grade
        }
      }
    }

    // Standard Somali Fallback
    if (percentage >= 90) return 'A+'
    if (percentage >= 85) return 'B++'
    if (percentage >= 80) return 'B-'
    if (percentage >= 75) return 'C+'
    if (percentage >= 70) return 'C'
    if (percentage >= 60) return 'D'
    return 'F'
  }

  const attendance = stats?.recentAttendance || []
  const payments = stats?.recentPayments || []

  return (
    <Layout title={t('student_dashboard')}>
      {loading && <LoadingOverlay />}

      {/* Stats Cards */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div className="flex flex-col">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">{t('welcome_student_name').replace('{name}', stats?.name || t('student'))}</h2>
          <p className="text-gray-400 font-medium text-xs uppercase tracking-widest mt-1">{stats?.currentYear?.name || t('current_academic_year')}</p>
        </div>
        
        <div className="flex gap-4">
            <div className="bg-indigo-50 border border-indigo-100 px-5 py-2.5 rounded-2xl flex flex-col items-end shadow-sm">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-0.5">{t('your_class_info')}</span>
                <span className="text-sm font-black text-indigo-600 tracking-tight">
                  {stats?.status?.toLowerCase() === 'graduated' 
                    ? stats?.status 
                    : (stats?.class_name && stats.class_name !== 'N/A' ? `${stats.class_name}${stats.section_name && stats.section_name !== 'N/A' ? ' - ' + stats.section_name : ''}` : t('not_assigned'))}
                </span>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {loading ? (
          <>
            <StatSkeleton /><StatSkeleton /><StatSkeleton />
          </>
        ) : (
          <>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all">
              <div className="flex flex-col">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{t('payment_status')}</p>
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${stats?.currentStatus === 'paid' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]'} animate-pulse`}></div>
                  <p className={`text-xl font-black ${stats?.currentStatus === 'paid' ? 'text-emerald-600' : 'text-rose-600'} tracking-tight`}>
                    {stats?.currentStatus === 'paid' ? t('paid_status') : t('unpaid_status')}
                  </p>
                </div>
                <p className="text-[9px] text-gray-400 font-bold mt-1 uppercase tracking-widest">{new Date().toLocaleString('default', { month: 'short' })} {new Date().getFullYear()}</p>
              </div>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-inner ${stats?.currentStatus === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                {stats?.currentStatus === 'paid' ? '✓' : '!'}
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all">
              <div className="flex flex-col">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{t('my_attendance')}</p>
                <p className="text-3xl font-black text-indigo-600 tracking-tighter">{stats?.attendancePercentage?.toFixed(0) || 0}%</p>
                <p className="text-[9px] text-gray-400 font-bold mt-1 uppercase tracking-widest">{t('attendance_rate')}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl shadow-inner">
                📈
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all">
              <div className="flex flex-col">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{t('account_status')}</p>
                <p className="text-xl font-black text-slate-800 uppercase tracking-tight">{stats?.status || t('active_student')}</p>
                <p className="text-[9px] text-gray-400 font-bold mt-1 uppercase tracking-widest">{t('validated_session')}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-600 flex items-center justify-center text-xl shadow-inner text-opacity-40">
                👤
              </div>
            </div>
          </>
        )}
      </div>

      {/* Announcements Widget */}
      {!loading && announcements.length > 0 && (
        <div className="mb-8 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-[2rem] p-8 shadow-xl shadow-blue-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl group-hover:scale-110 transition-all duration-700"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-xl">📢</div>
                <div>
                  <h3 className="text-white font-black uppercase tracking-widest text-sm">{t('announcements')}</h3>
                  <p className="text-blue-100 text-[10px] font-bold uppercase tracking-tight">Wararkii ugu dambeeyay</p>
                </div>
              </div>
              <Link href="/student/announcements">
                <span className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer backdrop-blur-sm">
                  View All →
                </span>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {announcements.map(a => (
                <div key={a.id} className="bg-white/10 backdrop-blur-md border border-white/10 p-5 rounded-2xl hover:bg-white/20 transition-all cursor-default group/item">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${a.priority === 'urgent' ? 'bg-red-400 animate-pulse' : a.priority === 'high' ? 'bg-amber-400' : 'bg-blue-400'}`}></span>
                    <span className="text-[9px] font-black text-blue-100 uppercase tracking-widest">
                      {new Date(a.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="text-white font-bold text-sm line-clamp-1 group-hover/item:text-blue-200 transition-colors">{a.title}</h4>
                  <p className="text-blue-100/70 text-xs mt-1 line-clamp-2 leading-relaxed">{a.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Attendance Summary */}
        {loading ? <TableSkeleton /> : (
          <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden group hover:shadow-md transition-all">
            <div className="px-8 py-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
              <div>
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">{t('recent_attendance')}</h2>
                <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase">{t('last_7_days')}</p>
              </div>
              <Link href="/student/attendance">
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-4 py-2 rounded-xl cursor-pointer hover:bg-indigo-600 hover:text-white transition-all shadow-sm">{t('view_history')}</span>
              </Link>
            </div>
            <div className="overflow-x-auto max-h-[260px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left">
                <thead className="bg-white text-gray-400 text-[9px] uppercase tracking-[0.2em] font-black border-b border-gray-50">
                  <tr>
                    <th className="px-8 py-4">{t('date')}</th>
                    <th className="px-8 py-4">{t('session')}</th>
                    <th className="px-8 py-4 text-right">{t('status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-xs font-bold text-slate-600">
                  {(() => {
                    const uniqueDates = new Set();
                    const filtered = [];
                    for (const att of attendance) {
                      const dateStr = new Date(att.date).toLocaleDateString();
                      if (uniqueDates.size < 7 || uniqueDates.has(dateStr)) {
                        filtered.push(att);
                        uniqueDates.add(dateStr);
                      } else {
                        break;
                      }
                    }
                    return filtered;
                  })().map((att, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-8 py-4 text-slate-800">{new Date(att.date).toLocaleDateString()}</td>
                      <td className="px-8 py-4 uppercase tracking-wider text-indigo-500 font-black">{att.session} <span className="text-[10px] text-indigo-300">({att.shift === 'morning' ? t('subax_am') : att.shift === 'night' ? t('habeen_night') || '🌙 Habeen' : t('galab_pm')})</span></td>
                      <td className="px-8 py-4 text-right">
                        <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm ${att.status === 'Present' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                            att.status === 'Late' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                              'bg-rose-50 text-rose-600 border border-rose-100'
                          }`}>
                          {att.status === 'Present' ? t('present') : att.status === 'Late' ? t('late') : t('absent')}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {attendance.length === 0 && (
                    <tr><td colSpan="3" className="px-8 py-12 text-center text-gray-400 font-bold uppercase tracking-widest italic opacity-60">{t('no_attendance_record')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Payment Summary */}
        {loading ? <TableSkeleton /> : (
          <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden group hover:shadow-md transition-all">
            <div className="px-8 py-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
              <div>
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">{t('recent_payments')}</h2>
                <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase">{t('fee_history')}</p>
              </div>
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-4 py-2 rounded-xl shadow-sm border border-emerald-100 cursor-default">{t('finances')}</span>
            </div>
            <div className="overflow-x-auto max-h-[260px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left">
                <thead className="bg-white text-gray-400 text-[9px] uppercase tracking-[0.2em] font-black border-b border-gray-50">
                  <tr>
                    <th className="px-8 py-4">{t('date')}</th>
                    <th className="px-8 py-4">{t('amount')}</th>
                    <th className="px-8 py-4 text-right">{t('status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-xs font-bold text-slate-600">
                  {payments.map((pay, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-8 py-4 text-slate-800">{new Date(pay.date).toLocaleDateString()}</td>
                      <td className="px-8 py-4 font-black text-slate-900 drop-shadow-sm">${pay.amount.toLocaleString()}</td>
                      <td className="px-8 py-4 text-right">
                        <span className="text-[9px] bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-xl border border-emerald-100 font-black uppercase tracking-widest shadow-sm">{t('paid')}</span>
                      </td>
                    </tr>
                  ))}
                  {payments.length === 0 && (
                    <tr><td colSpan="3" className="px-8 py-12 text-center text-gray-400 font-bold uppercase tracking-widest italic opacity-60">{t('no_payment_record')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {loading ? <div className="mt-8"><TableSkeleton /></div> : (
        <div className="mt-8 bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden group hover:shadow-md transition-all">
          <div className="px-8 py-6 border-b border-gray-50 flex justify-between items-center bg-indigo-600 text-white shadow-xl shadow-indigo-100">
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest">{t('academic_performance')}</h2>
              <p className="text-[10px] text-indigo-100 font-bold mt-1 uppercase">{t('exam_class_results')}</p>
            </div>
            <div className="bg-white/20 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest backdrop-blur-sm">{t('results_label')}</div>
          </div>

          {/* Exam Summary Stats */}
          {examSummary && (
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-100 border-b border-gray-100 bg-slate-50/40">
              <div className="flex flex-col items-center justify-center py-5 px-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Total</p>
                <p className="text-xl font-black text-slate-800">{examSummary.grandTotal}<span className="text-xs text-slate-400 ml-1">/{examSummary.grandMax}</span></p>
              </div>
              <div className="flex flex-col items-center justify-center py-5 px-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Average</p>
                <p className="text-xl font-black text-indigo-600">{examSummary.average}%</p>
              </div>
              <div className="flex flex-col items-center justify-center py-5 px-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Status</p>
                <span className={`text-sm font-black px-3 py-1 rounded-full ${examSummary.status === 'Pass' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-200'}`}>
                  {examSummary.status}
                </span>
              </div>
              <div className="flex flex-col items-center justify-center py-5 px-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Class Position</p>
                <p className="text-xl font-black text-amber-500">
                  {examSummary.classPosition || '—'}
                  {examSummary.totalStudentsInClass > 0 && <span className="text-xs text-slate-400 ml-1 font-bold">of {examSummary.totalStudentsInClass}</span>}
                </p>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-white text-gray-400 text-[9px] uppercase tracking-[0.2em] font-black border-b border-gray-50">
                <tr>
                  <th className="px-8 py-4">{t('subject_maadada')}</th>
                  <th className="px-8 py-4">{t('score_dhibcaha')}</th>
                  <th className="px-8 py-4 text-center">{t('grade')}</th>
                  <th className="px-8 py-4 text-right">{t('date')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm font-bold text-slate-600">
                {grades.map((g, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50 transition-colors group/row">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-black group-hover/row:bg-indigo-600 group-hover/row:text-white transition-all">
                          {idx + 1}
                        </div>
                        <p className="font-black text-slate-800 tracking-tight uppercase">{g.exam?.subject?.name || g.subject || g.name || t('subject')}</p>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="font-black text-slate-900 text-lg">{g.marks || g.score || g.total || 0}</span>
                      <span className="text-slate-300 font-bold ml-1 text-[10px]">/ {g.exam?.totalMarks || g.totalMarks || 100}</span>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <div className={`inline-flex items-center justify-center w-10 h-10 rounded-2xl font-black text-lg shadow-sm border ${calculateGrade(g.marks || g.score || g.total || 0, g.exam?.totalMarks || g.totalMarks || 100) === 'F'
                          ? 'bg-rose-50 text-rose-600 border-rose-100'
                          : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                        }`}>
                        {g.grade || calculateGrade(g.marks || g.score || g.total || 0, g.exam?.totalMarks || g.totalMarks || 100)}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right font-bold text-slate-400 text-[10px] uppercase">
                      {g.exam?.date ? new Date(g.exam.date).toLocaleDateString() : (g.date ? new Date(g.date).toLocaleDateString() : 'N/A')}
                    </td>
                  </tr>
                ))}
                {grades.length === 0 && (
                  <tr><td colSpan="4" className="px-8 py-16 text-center text-gray-400 font-bold uppercase tracking-widest italic opacity-60">{t('no_results_yet')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Layout>
  )
}
