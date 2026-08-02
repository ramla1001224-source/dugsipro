import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useLanguage } from '../../context/LanguageContext'
import { getErrorMessage } from '../../utils/errorHelper'
import { StatSkeleton, BigCardSkeleton, LoadingOverlay } from '../../components/DashboardSkeleton'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function AdminDashboard() {
  const router = useRouter()
  const { t } = useLanguage()
  const { schoolId } = router.query
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [announcements, setAnnouncements] = useState([])
  const [session, setSession] = useState('Break 1')
  const [shift, setShift] = useState('morning')

  const [details, setDetails] = useState([])
  const [showDetails, setShowDetails] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState('')
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [smsHistory, setSmsHistory] = useState([])
  const [showSmsHistory, setShowSmsHistory] = useState(false)
  const [smsLoading, setSmsLoading] = useState(false)
  const [expandedClasses, setExpandedClasses] = useState({})

  const fetchDetails = async (status, isPayment = false) => {
    setSelectedStatus(status)
    setShowDetails(true)
    setDetailsLoading(true)
    setExpandedClasses({})
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
    const endpoint = isPayment ? 'payment-details' : 'attendance-details'
    let query = isPayment ? `status=${status}&shift=${shift}` : `status=${status}&session=${session}&shift=${shift}`
    if (schoolId) query += `&schoolId=${schoolId}`

    try {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'}/api/dashboard/${endpoint}?${query}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setDetails(res.data)
    } catch (e) {
      console.error('Fetch Details Error:', e?.response?.data || e.message)
    } finally {
      setDetailsLoading(false)
    }
  }

  const [fetchError, setFetchError] = useState(null)

  const fetchSmsHistory = async () => {
    setShowSmsHistory(true)
    setSmsLoading(true)
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
    let url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'}/api/sms/usage-history`
    if (schoolId) url += `?schoolId=${schoolId}`

    try {
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setSmsHistory(res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setSmsLoading(false)
    }
  }


  const fetchData = async () => {
    setLoading(true)
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
    try {
      // Get schoolId from query param, or fallback to JWT payload
      let resolvedSchoolId = schoolId
      if (!resolvedSchoolId && token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]))
          resolvedSchoolId = payload.schoolId
        } catch (_) {}
      }

      let url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'}/api/dashboard/stats?session=${session}&shift=${shift}`
      if (resolvedSchoolId) url += `&schoolId=${resolvedSchoolId}`
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setData(res.data)
      setFetchError(null)
      setLoading(false)
    } catch (e) {
      const msg = getErrorMessage(e, t)
      console.error('Frontend: Fetch error', msg);
      setFetchError(msg)
      setLoading(false)
    }
  }

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
    if (!token) return window.location.href = '/'
    if (router.isReady) {
      fetchData()
    }
  }, [session, shift, schoolId, router.isReady])

  if (loading && !data) {
    return (
      <Layout title={t('dashboard')}>
        <LoadingOverlay />
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <StatSkeleton /><StatSkeleton /><StatSkeleton />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
            <StatSkeleton /><StatSkeleton />
          </div>
          <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(i => <StatSkeleton key={i} />)}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
            <BigCardSkeleton /><BigCardSkeleton />
          </div>
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
                  <h3 className="text-white font-black uppercase tracking-widest text-sm">Announcements</h3>
                  <p className="text-emerald-100 text-[10px] font-bold uppercase tracking-tight">Farriimaha Maamulka</p>
                </div>
              </div>
              <Link href="/admin/announcements">
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

    </Layout>
    )
  }

  if (!data) {
    return (
      <Layout title={t('dashboard')}>
        <div className="p-12 text-center bg-white border border-rose-100 rounded-[3rem] shadow-xl max-w-2xl mx-auto mt-20">
          <div className="text-6xl mb-6">⚠️</div>
          <h2 className="text-2xl font-black text-slate-900 mb-2 font-black uppercase tracking-tight">{t('error_loading_dashboard')}</h2>
          <p className="text-rose-500 font-bold mb-8">{fetchError || t('unable_to_retrieve_stats')}</p>
          <button 
            onClick={() => fetchData()} 
            className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-black transition-all shadow-2xl"
          >
            🔄 {t('try_reconnecting')}
          </button>
        </div>
      </Layout>
    )
  }

  const { counts, financials, graph } = data

  const StatCard = ({ label, value, color, icon, href }) => {
    const CardContent = (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow cursor-pointer">
        <div>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${color} bg-opacity-10`}>
            {icon}
          </div>
        </div>
        <div className="text-right">
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">{label}</p>
          <p className="text-xl font-black text-slate-800">{value}</p>
        </div>
      </div>
    );
    return href ? <Link href={href}>{CardContent}</Link> : CardContent;
  }

  const BigStatCard = ({ label, value, color, icon, href }) => {
    const CardContent = (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center ${color.bg} ${color.text}`}>
          {icon}
        </div>
        <div>
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-black text-slate-800">{value}</p>
        </div>
      </div>
    );
    return href ? <Link href={href}>{CardContent}</Link> : CardContent;
  }

  return (
    <Layout title={t('dashboard')}>
      {loading && <LoadingOverlay />}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">{t('main_dashboard')}</h1>
            <p className="text-gray-400 text-xs font-medium uppercase tracking-widest">{t('school_performance_stats')}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <StatCard label={t('students_label')} value={counts.students} color="bg-yellow-100 text-yellow-600"
            icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>} />
          <StatCard label={t('teachers_label')} value={counts.teachers} color="bg-emerald-100 text-emerald-600"
            icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>} />
          <StatCard label={t('admin_label')} value={counts.admins} color="bg-emerald-100 text-emerald-600"
            icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>} />
          <div onClick={fetchSmsHistory}>
            <StatCard label={t('monthly_sms')} value={data.smsMonthlyCount || 0} color="bg-blue-100 text-blue-600"
              icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl">
          <StatCard label={t('parent_label')} value={counts.parents} color="bg-red-100 text-red-600"
            icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>} />
          <StatCard label={t('employees_label')} value={counts.employees} color="bg-purple-100 text-purple-600"
            icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>} />
          <StatCard label={t('classes_label')} value={counts.classes} color="bg-blue-100 text-blue-600"
            icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>} />
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center gap-4 bg-white p-4 rounded-[1.5rem] shadow-sm border border-gray-100 w-full lg:max-w-fit">
          <div className="flex items-center justify-between lg:justify-start gap-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2 whitespace-nowrap">Viewing Session:</p>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              {['Break 1', 'Break 2'].map(s => (
                <button
                  key={s}
                  onClick={() => setSession(s)}
                  className={`px-4 sm:px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${session === s ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  {t(s.toLowerCase().replace(' ', '_')) || s}
                </button>
              ))}
            </div>
          </div>

          <div className="hidden lg:block w-px h-6 bg-slate-200 mx-2"></div>

          <div className="flex items-center justify-between lg:justify-start gap-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">Shift:</p>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              {['morning', 'afternoon', 'night'].map(sh => (
                <button
                  key={sh}
                  onClick={() => setShift(sh)}
                  className={`px-4 sm:px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${shift === sh ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  {t(sh.toLowerCase()) || sh}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 ml-2">{t('attendance_summary')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            <button onClick={() => fetchDetails('Present')} className="bg-emerald-600 p-6 rounded-[2rem] text-white flex items-center justify-between shadow-xl shadow-emerald-100 hover:scale-[1.02] transition-transform text-left">
              <div>
                <p className="text-emerald-200 text-[10px] font-black uppercase tracking-widest mb-1">{t('total_present_today')}</p>
                <p className="text-3xl font-black">{data.attendance?.present || 0}</p>
              </div>
              <div className="text-3xl">✅</div>
            </button>
            <button onClick={() => fetchDetails('Absent')} className="bg-rose-600 p-6 rounded-[2rem] text-white flex items-center justify-between shadow-xl shadow-rose-100 hover:scale-[1.02] transition-transform text-left">
              <div>
                <p className="text-rose-200 text-[10px] font-black uppercase tracking-widest mb-1">{t('today_absent')}</p>
                <p className="text-3xl font-black">{data.attendance?.absent || 0}</p>
              </div>
              <div className="text-3xl">❌</div>
            </button>
            <button onClick={() => fetchDetails('Late')} className="bg-amber-500 p-6 rounded-[2rem] text-white flex items-center justify-between shadow-xl shadow-amber-100 hover:scale-[1.02] transition-transform text-left">
              <div>
                <p className="text-amber-100 text-[10px] font-black uppercase tracking-widest mb-1">{t('today_late')}</p>
                <p className="text-3xl font-black">{data.attendance?.late || 0}</p>
              </div>
              <div className="text-3xl">⏰</div>
            </button>
            <button onClick={() => fetchDetails('Pending')} className="bg-slate-400 p-6 rounded-[2rem] text-white flex items-center justify-between shadow-xl shadow-slate-100 hover:scale-[1.02] transition-transform text-left">
              <div>
                <p className="text-slate-100 text-[10px] font-black uppercase tracking-widest mb-1">{t('pending_classes_label')}</p>
                <p className="text-3xl font-black">{data.attendance?.unmarkedClasses || 0}</p>
              </div>
              <div className="text-3xl opacity-50">➖</div>
            </button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 ml-2">{t(new Date().toLocaleString('default', { month: 'long' }).toLowerCase())} {t('fee_status')}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
            <button onClick={() => fetchDetails('paid', true)} className="bg-blue-600 p-8 rounded-[2rem] text-white flex items-center justify-between shadow-xl shadow-blue-100 hover:scale-[1.02] transition-transform text-left">
              <div>
                <p className="text-blue-200 text-[10px] font-black uppercase tracking-widest mb-1">{t('students_paid')}</p>
                <p className="text-4xl font-black">{data.paymentStatus?.paid || 0}</p>
              </div>
              <div className="text-4xl">💰</div>
            </button>
            <button onClick={() => fetchDetails('unpaid', true)} className="bg-slate-900 p-8 rounded-[2rem] text-white flex items-center justify-between shadow-xl shadow-slate-200 hover:scale-[1.02] transition-transform text-left">
              <div>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">{t('students_unpaid')}</p>
                <p className="text-4xl font-black">{data.paymentStatus?.unpaid || 0}</p>
              </div>
              <div className="text-4xl">⏳</div>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          <Link href="/admin/fees" className="block">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-4 hover:shadow-md transition-shadow cursor-pointer w-full">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full flex items-center justify-center bg-blue-100 text-blue-600">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                </div>
                <div>
                  <p className="text-gray-400 text-[10px] font-black uppercase tracking-wider">{t('collected_revenue')}</p>
                  <p className="text-2xl font-black text-slate-800">${(financials.monthlyStudentPayments || 0).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </Link>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-4 hover:shadow-md transition-shadow cursor-pointer w-full">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center bg-slate-900 text-white">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
              </div>
              <div>
                <p className="text-gray-400 text-[10px] font-black uppercase tracking-wider">{t('expected_revenue')}</p>
                <p className="text-2xl font-black text-slate-800">${(financials.expectedRevenue || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">

          <BigStatCard label={t('other_income')} value={`$${(financials.currentOtherIncome || 0).toLocaleString()}`} color={{ bg: 'bg-emerald-100', text: 'text-emerald-600' }} icon={<svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
          <BigStatCard label={t('monthly_expense')} value={`$${(financials.currentMonthExpense || 0).toLocaleString()}`} color={{ bg: 'bg-red-100', text: 'text-red-600' }} href="/admin/expenses" icon={<svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>} />
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
          <h2 className="text-slate-800 text-sm font-black uppercase tracking-widest mb-8 text-center">
            {t('income_expense_summary')} {data?.currentYear?.name || new Date().getFullYear()}
          </h2>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={graph} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} />
                <Tooltip contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '20px' }} cursor={{ fill: '#f8fafc' }} />
                <Legend iconType="circle" />
                <Bar dataKey="income" name={t('income')} fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={24} />
                <Bar dataKey="expense" name={t('expense')} fill="#ef4444" radius={[6, 6, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {showDetails && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col border border-white/20 animate-in zoom-in-95 duration-300">
            <div className={`p-8 ${selectedStatus.toLowerCase().includes('present') || selectedStatus === 'paid' ? 'bg-emerald-600' : selectedStatus.toLowerCase().includes('absent') || selectedStatus === 'unpaid' ? 'bg-rose-600' : selectedStatus === 'Pending' ? 'bg-slate-700' : 'bg-amber-500'} text-white flex justify-between items-center`}>
              <div>
                <h3 className="text-2xl font-black uppercase tracking-tight">
                  {selectedStatus === 'paid' ? t('this_month_paid') : selectedStatus === 'unpaid' ? t('this_month_unpaid') : selectedStatus === 'Pending' ? t('pending_classes_label') : t('today_students').replace('{status}', t(selectedStatus.toLowerCase()))}
                </h3>
                <p className="text-white/70 text-xs font-bold uppercase tracking-widest mt-1">{t('found_records').replace('{count}', details.length.toString())}</p>
              </div>
              <button onClick={() => setShowDetails(false)} className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors font-black">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-8">
              {detailsLoading ? (
                <div className="py-20 text-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900 mx-auto"></div></div>
              ) : details.length > 0 ? (
                (() => {
                  const grouped = details.reduce((acc, curr) => {
                    const c = curr.class || 'N/A';
                    if (!acc[c]) acc[c] = [];
                    acc[c].push(curr);
                    return acc;
                  }, {});
                  
                  return (
                    <div className="flex flex-col gap-4">
                      {Object.keys(grouped).map(className => (
                        <div key={className} className="border border-slate-100 rounded-3xl bg-slate-50 overflow-hidden">
                          <button 
                            onClick={() => setExpandedClasses(prev => ({...prev, [className]: !prev[className]}))}
                            className="w-full flex items-center justify-between p-5 hover:bg-white transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black ${expandedClasses[className] ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
                                🏫
                              </div>
                              <div className="text-left">
                                <p className="font-black text-slate-800 uppercase tracking-tight">{className}</p>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{grouped[className].length} {t('students_label')}</p>
                              </div>
                            </div>
                            <div className="text-slate-400 font-black text-xs">
                              {expandedClasses[className] ? '▲' : '▼'}
                            </div>
                          </button>
                          
                          {expandedClasses[className] && (
                            <div className="p-4 pt-0 border-t border-slate-100 bg-white grid grid-cols-1 gap-2">
                              {grouped[className].map((s, idx) => (
                                <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-transparent hover:border-blue-100 hover:shadow-sm transition-all">
                                  <div className="flex items-center gap-4">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black ${(selectedStatus.toLowerCase().includes('present') || selectedStatus === 'paid') ? 'bg-emerald-100 text-emerald-600' : (selectedStatus.toLowerCase().includes('absent') || selectedStatus === 'unpaid') ? 'bg-rose-100 text-rose-600' : selectedStatus === 'Pending' ? 'bg-slate-200 text-slate-600' : 'bg-amber-100 text-amber-600'}`}>
                                      {s.name?.substring(0, 2).toUpperCase() || '??'}
                                    </div>
                                    <div>
                                      <p className="font-black text-slate-800 uppercase tracking-tight text-sm">{s.name}</p>
                                      <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{s.student_id}</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()
              ) : (
                <div className="py-20 text-center text-gray-400 font-bold uppercase tracking-widest">{t('no_records_found')}</div>
              )}
            </div>
            <div className="p-6 border-t border-gray-50 flex justify-end bg-gray-50/50">
              <button onClick={() => setShowDetails(false)} className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-black transition-all shadow-xl shadow-gray-200">{t('close_view')}</button>
            </div>
          </div>
        </div>
      )}

      {showSmsHistory && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl max-h-[80vh] overflow-hidden flex flex-col border border-white/20 animate-in zoom-in-95 duration-300">
            <div className="p-8 bg-blue-600 text-white flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black uppercase tracking-tight">{t('sms_history')}</h3>
                <p className="text-white/70 text-xs font-bold uppercase tracking-widest mt-1">{t('monthly_usage_tracking')}</p>
              </div>
              <button onClick={() => setShowSmsHistory(false)} className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors font-black">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-8">
              {smsLoading ? (
                <div className="py-20 text-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div></div>
              ) : smsHistory.length > 0 ? (
                <div className="rounded-3xl border border-slate-100 overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">{t('month_year')}</th>
                        <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">{t('messages_sent')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {smsHistory.map((item, idx) => {
                        const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
                        const monthName = t(monthNames[item.month - 1]) || 'Unknown';
                        return (
                          <tr key={idx} className="hover:bg-blue-50/30 transition-colors group">
                            <td className="p-4">
                              <p className="font-black text-slate-800 uppercase tracking-tight">{monthName} {item.year}</p>
                            </td>
                            <td className="p-4 text-right">
                              <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-black">{item.count}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-20 text-center text-gray-400 font-bold uppercase tracking-widest">{t('no_records_found')}</div>
              )}
            </div>
            <div className="p-6 border-t border-gray-50 flex justify-end bg-gray-50/50">
              <button onClick={() => setShowSmsHistory(false)} className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-black transition-all shadow-xl shadow-gray-200">{t('close_view')}</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
