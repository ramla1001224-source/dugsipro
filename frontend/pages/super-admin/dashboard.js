import { useEffect, useState } from 'react'
import Link from 'next/link'
import axios from 'axios'
import Head from 'next/head'
import { StatSkeleton, LoadingOverlay } from '../../components/DashboardSkeleton'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { useLanguage } from '../../context/LanguageContext'
import { getImageUrl } from '../../utils/imageHelper'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'

export default function SuperAdminDashboard() {
    const { t } = useLanguage()
    const [schools, setSchools] = useState([])
    const [loading, setLoading] = useState(true)
  const [announcements, setAnnouncements] = useState([])
    const [selectedSchool, setSelectedSchool] = useState(null)
    const [schoolStats, setSchoolStats] = useState(null)
    const [schoolAdmin, setSchoolAdmin] = useState(null)
    const [statsLoading, setStatsLoading] = useState(false)
    const [globalStats, setGlobalStats] = useState(null)
    const [globalLoading, setGlobalLoading] = useState(true)
    const [smsStatus, setSmsStatus] = useState(null)
    const [smsNetworkStats, setSmsNetworkStats] = useState(null)
    const [smsHistory, setSmsHistory] = useState([])
    const [smsHistoryLoading, setSmsHistoryLoading] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')

    // Global SMS Logs
    const [showGlobalSmsModal, setShowGlobalSmsModal] = useState(false)
    const [globalSmsLogs, setGlobalSmsLogs] = useState([])
    const [globalSmsLoading, setGlobalSmsLoading] = useState(false)
    const [smsLogMonth, setSmsLogMonth] = useState(new Date().getMonth() + 1)
    const [smsLogYear, setSmsLogYear] = useState(new Date().getFullYear())
    const [showAddSchool, setShowAddSchool] = useState(false)
    const [schoolForm, setSchoolForm] = useState({ name: '', shortCode: '', address: '', phone: '', email: '', logo: '' })
    const [schoolSaving, setSchoolSaving] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [editId, setEditId] = useState(null)

    const [showAddAdmin, setShowAddAdmin] = useState(false)
    const [adminForm, setAdminForm] = useState({ name: '', username: '', password: '' })
    const [adminSaving, setAdminSaving] = useState(false)
    const [adminSchoolId, setAdminSchoolId] = useState(null)

    const [showApiSettings, setShowApiSettings] = useState(false)
    const [apiForm, setApiForm] = useState({ customSmsApiKey: '', customSmsApiUrl: '', customSmsSenderId: '', customSmsProvider: 'hormuud', useCustomSmsApi: false })
    const [apiSaving, setApiSaving] = useState(false)
    const [superAdminSmsConfig, setSuperAdminSmsConfig] = useState(null)

    const [role, setRole] = useState('')
    const [isImpersonatingSuper, setIsImpersonatingSuper] = useState(false)
    const [impersonatedName, setImpersonatedName] = useState('')
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const token = () => typeof window !== 'undefined' ? localStorage.getItem('token') : ''
    const headers = () => ({ Authorization: `Bearer ${token()}` })

    useEffect(() => {
        const t = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
        const r = typeof window !== 'undefined' ? localStorage.getItem('role') : ''
        if (!t || (r !== 'super_admin' && r !== 'owner')) return window.location.href = '/'
        setRole(r)

        try {
            const payload = JSON.parse(atob(t.split('.')[1]))
            setIsImpersonatingSuper(payload.isImpersonatingSuper || false)
            if (payload.isImpersonatingSuper) setImpersonatedName(payload.name || '')
        } catch (e) { }

        fetchSchools()
        fetchSmsNetworkStats()
        if (r === 'super_admin') {
            fetchSuperAdminApiSettings()
        }
    }, [])

    useEffect(() => {
        if (role === 'super_admin' || role === 'owner') {
            fetchGlobalStats()
        }
    }, [role])


    const fetchGlobalStats = async () => {
        setGlobalLoading(true)
        try {
            const url = `${API}/api/dashboard/superadmin`
            const res = await axios.get(url, { headers: headers() })
            setGlobalStats(res.data)
        } catch (e) {
            console.error('Failed to fetch global stats', e)
        } finally {
            setGlobalLoading(false)
        }
    }

    const fetchSuperAdminApiSettings = async () => {
        try {
            const res = await axios.get(`${API}/api/super-admin/sms-api`, { headers: headers() })
            setSuperAdminSmsConfig(res.data)
            setApiForm({
                customSmsApiKey: res.data.customSmsApiKey || '',
                customSmsApiUrl: res.data.customSmsApiUrl || '',
                customSmsSenderId: res.data.customSmsSenderId || '',
                customSmsProvider: res.data.customSmsProvider || 'hormuud',
                useCustomSmsApi: !!res.data.useCustomSmsApi
            })
        } catch (e) {
            console.error('Failed to fetch Super Admin API config', e)
        }
    }

    const handleSaveApiSettings = async (e) => {
        e.preventDefault()
        setApiSaving(true)
        setError('')
        try {
            await axios.put(`${API}/api/super-admin/sms-api`, apiForm, { headers: headers() })
            setSuccess(t('settings_updated_success') || 'API Settings updated successfully')
            setShowApiSettings(false)
            fetchSuperAdminApiSettings()
        } catch (e) {
            setError(e.response?.data?.message || 'Error updating API settings')
        } finally {
            setApiSaving(false)
        }
    }

    const fetchSmsNetworkStats = async () => {
        try {
            const res = await axios.get(`${API}/api/sms/superadmin-stats`, { headers: headers() })
            setSmsNetworkStats(res.data)
        } catch (e) {
            console.error('Failed to fetch SMS network stats', e)
        }
    }

    const fetchGlobalSmsLogs = async (m, y) => {
        setGlobalSmsLoading(true)
        try {
            const res = await axios.get(`${API}/api/sms/superadmin-logs?month=${m}&year=${y}`, { headers: headers() })
            setGlobalSmsLogs(res.data || [])
        } catch (e) {
            console.error('Failed to fetch sms logs', e)
        } finally {
            setGlobalSmsLoading(false)
        }
    }

    useEffect(() => {
        if (showGlobalSmsModal) {
            fetchGlobalSmsLogs(smsLogMonth, smsLogYear)
        }
    }, [showGlobalSmsModal, smsLogMonth, smsLogYear])

    const fetchSchools = async () => {
        setLoading(true)
        try {
            const res = await axios.get(`${API}/api/schools`, { headers: headers() })
            setSchools(res.data)
        } catch (e) {
            setError(t('error_fetching_schools'))
        } finally {
            setLoading(false)
        }
    }

    const fetchSchoolStats = async (schoolId) => {
        setStatsLoading(true)
        setSmsHistory([])
        setSmsHistoryLoading(true)
        try {
            const [statsRes, adminsRes, smsRes] = await Promise.all([
                axios.get(`${API}/api/schools/${schoolId}/stats`, { headers: headers() }),
                axios.get(`${API}/api/schools/${schoolId}/admins`, { headers: headers() }),
                axios.get(`${API}/api/sms/settings?schoolId=${schoolId}`, { headers: headers() })
            ])
            setSchoolStats(statsRes.data)
            setSchoolAdmin(adminsRes.data[0] || null)
            setSmsStatus(smsRes.data)
        } catch (e) {
            setSchoolStats(null)
            setSchoolAdmin(null)
            setSmsStatus(null)
        } finally {
            setStatsLoading(false)
        }

        // Fetch SMS history separately (non-blocking)
        try {
            const histRes = await axios.get(`${API}/api/sms/usage-history?schoolId=${schoolId}`, { headers: headers() })
            setSmsHistory(histRes.data || [])
        } catch (e) {
            setSmsHistory([])
        } finally {
            setSmsHistoryLoading(false)
        }
    }

    // SMS is controlled by Owner only — no toggle here

    const handleSelectSchool = (school) => {
        setSelectedSchool(school)
        fetchSchoolStats(school.id)
    }

    const handleAddSchool = async (e) => {
        e.preventDefault()
        setSchoolSaving(true)
        setError('')
        try {
            if (isEditing) {
                await axios.put(`${API}/api/schools/${editId}`, schoolForm, { headers: headers() })
                setSuccess(t('school_updated_success'))
            } else {
                await axios.post(`${API}/api/schools`, schoolForm, { headers: headers() })
                setSuccess(t('school_added_success'))
            }
            setShowAddSchool(false)
            setSchoolForm({ name: '', address: '', phone: '', email: '', shortCode: '', logo: '' })
            setIsEditing(false)
            setEditId(null)
            fetchSchools()
        } catch (e) {
            setError(e.response?.data?.message || 'Error')
        } finally {
            setSchoolSaving(false)
        }
    }

    const openEditSchool = (school) => {
        setSchoolForm({
            name: school.name,
            shortCode: school.shortCode || '',
            address: school.address || '',
            phone: school.phone || '',
            email: school.email || '',
            logo: school.logo || ''
        })
        setEditId(school.id)
        setIsEditing(true)
        setShowAddSchool(true)
    }

    // Logo upload removed for Super Admins - managed by System Owner

    const openAddSchoolModal = () => {
        setSchoolForm({ name: '', address: '', phone: '', email: '', shortCode: '', logo: '' })
        setIsEditing(false)
        setEditId(null)
        setShowAddSchool(true)
    }

    const handleToggleActive = async (school) => {
        try {
            await axios.put(`${API}/api/schools/${school.id}`, { ...school, isActive: !school.isActive }, { headers: headers() })
            fetchSchools()
            if (selectedSchool?.id === school.id) {
                setSelectedSchool({ ...school, isActive: !school.isActive })
            }
        } catch (e) {
            setError(t('error_changing_school_status'))
        }
    }

    const handleDeleteSchool = async (id) => {
        if (!window.confirm(t('confirm_delete_school'))) return
        try {
            await axios.delete(`${API}/api/schools/${id}`, { headers: headers() })
            setSelectedSchool(null)
            setSchoolStats(null)
            fetchSchools()
        } catch (e) {
            setError(e.response?.data?.message || t('delete_failed'))
        }
    }

    const openAddAdmin = (schoolId, admin = null) => {
        setAdminSchoolId(schoolId)
        if (admin) {
            setAdminForm({ name: admin.name, username: admin.username, password: '' })
        } else {
            setAdminForm({ name: '', username: '', password: '' })
        }
        setShowAddAdmin(true)
    }

    const handleAddAdmin = async (e) => {
        e.preventDefault()
        setAdminSaving(true)
        setError('')
        try {
            if (schoolAdmin) {
                await axios.put(`${API}/api/schools/${adminSchoolId}/admin/${schoolAdmin.id}`, adminForm, { headers: headers() })
                setSuccess(t('admin_updated_success'))
            } else {
                await axios.post(`${API}/api/schools/${adminSchoolId}/admin`, adminForm, { headers: headers() })
                setSuccess(t('admin_added_success'))
            }
            setShowAddAdmin(false)
            fetchSchoolStats(adminSchoolId)
        } catch (e) {
            setError(e.response?.data?.message || 'Error')
        } finally {
            setAdminSaving(false)
        }
    }

    const handleDeleteAdmin = async (adminId) => {
        if (!window.confirm(t('confirm_delete_admin'))) return
        try {
            await axios.delete(`${API}/api/schools/${selectedSchool.id}/admin/${adminId}`, { headers: headers() })
            setSuccess(t('admin_deleted_success'))
            fetchSchoolStats(selectedSchool.id)
        } catch (e) {
            setError(e.response?.data?.message || t('delete_failed'))
        }
    }

    const handleEnterSchool = async (school) => {
        try {
            const res = await axios.post(`${API}/api/schools/impersonate/${school.id}`, {}, { headers: headers() })
            const currentToken = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
            localStorage.setItem('originalOwnerToken', currentToken)
            localStorage.setItem('token', res.data.token)
            localStorage.setItem('role', 'admin')
            window.location.href = '/admin/dashboard'
        } catch (e) {
            setError(t('error_entering_school'))
        }
    }

    const handleLogout = () => {
        localStorage.clear()
        window.location.href = '/'
    }

    const returnToOwner = () => {
        const originalToken = typeof window !== 'undefined' ? localStorage.getItem('originalOwnerToken') : ''
        if (originalToken) {
            localStorage.setItem('token', originalToken)
            localStorage.setItem('role', 'owner')
            localStorage.removeItem('originalOwnerToken')
            window.location.href = '/owner/dashboard'
        } else {
            handleLogout()
        }
    }

    return (
        <div className="min-h-screen font-sans" style={{ background: 'linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%)', color: '#1e293b' }}>
            <Head>
                <title>{role === 'owner' ? t('system_owner') : t('super_admin')} | {t('system_name')} {t('dashboard')}</title>
            </Head>

            {loading && !schools.length && <LoadingOverlay />}

            {/* Premium Glassmorphic Header */}
            <header className="sticky top-0 z-[100] h-[72px] px-8 flex items-center justify-between border-b border-white/10 backdrop-blur-xl" 
                style={{ background: 'rgba(15, 23, 42, 0.9)' }}>
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-xl shadow-lg shadow-blue-500/20">🏫</div>
                    <div>
                        <div className="text-base font-black text-white tracking-tight">
                            DUGSI<span className="text-blue-400">PRO</span> <span className="text-[10px] font-extrabold bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full ml-1 uppercase tracking-widest">Ecosystem</span>
                        </div>
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-0.5">
                            {role === 'owner' ? t('enterprise_core') : t('central_command')}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    {isImpersonatingSuper && (
                        <div className="hidden lg:flex items-center gap-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 px-4 py-2 rounded-xl text-[11px] font-black">
                            <span>🛡️ {t('impersonating')}: {impersonatedName.toUpperCase()}</span>
                            <button onClick={returnToOwner} className="bg-blue-500 text-white px-3 py-1 rounded-lg hover:bg-blue-600 transition-colors uppercase tracking-widest">{t('return_label')}</button>
                        </div>
                    )}
                    <button onClick={handleLogout} className="bg-white/5 hover:bg-white/10 text-slate-300 px-5 py-2.5 rounded-xl border border-white/5 transition-all text-xs font-black uppercase tracking-widest">{t('log_out')}</button>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto p-8 lg:p-12">
                {error && <div className="bg-rose-50 border border-rose-100 text-rose-800 p-4 rounded-2xl mb-8 flex items-center justify-between font-bold animate-in fade-in slide-in-from-top-4">
                    <span className="flex items-center gap-2">⚠️ {error}</span>
                    <button onClick={() => setError('')} className="text-xl">✕</button>
                </div>}
                {success && <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-4 rounded-2xl mb-8 flex items-center justify-between font-bold animate-in fade-in slide-in-from-top-4">
                    <span className="flex items-center gap-2">✅ {success}</span>
                    <button onClick={() => setSuccess('')} className="text-xl">✕</button>
                </div>}

                {/* Global SMS API Status Header - High Priority Visibility */}
                {!globalLoading && smsNetworkStats && (
                    <div className="mb-14 p-8 bg-slate-900 rounded-[3rem] shadow-2xl border border-white/5 flex flex-col md:flex-row items-center justify-between gap-8 overflow-hidden relative group">
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-500 via-violet-500 to-emerald-500 opacity-50"></div>
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 via-transparent to-transparent pointer-events-none"></div>
                        <div className="flex items-center gap-8 relative z-10">
                            <div className={`w-20 h-20 rounded-3xl ${smsNetworkStats.isSmsEnabled ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-rose-500 shadow-rose-500/20'} flex items-center justify-center text-4xl shadow-2xl text-white transform transition-transform group-hover:scale-110 duration-500`}>
                                {smsNetworkStats.isSmsEnabled ? '📡' : '📵'}
                            </div>
                            <div>
                                <h3 className="text-white text-xl font-black tracking-tight flex items-center gap-3">
                                    {t('sms_gateway')}
                                    <span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest ${smsNetworkStats.isSmsEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                        {smsNetworkStats.isSmsEnabled ? t('system_online') : t('restricted')}
                                    </span>
                                    {superAdminSmsConfig?.useCustomSmsApi && (
                                        <span className="text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                            Custom API Active
                                        </span>
                                    )}
                                </h3>
                                <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.2em] mt-2 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> {t('central_comm_infra')}
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-12 relative z-10">
                            <div className="text-right">
                                <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2">{t('monthly_traffic')}</p>
                                <p className="text-white text-4xl font-black tabular-nums tracking-tighter leading-none transition-all group-hover:text-blue-400">{(smsNetworkStats.totalThisMonth || 0).toLocaleString()}</p>
                            </div>
                            <div className="hidden xl:block w-px h-14 bg-white/10"></div>
                            <div className="text-right">
                                <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2">{t('all_time_payload')}</p>
                                <p className="text-white text-4xl font-black tabular-nums tracking-tighter leading-none transition-all group-hover:text-violet-400">{(smsNetworkStats.totalAllTime || 0).toLocaleString()}</p>
                            </div>
                            <div className="flex flex-col gap-2">
                                <button 
                                    onClick={() => setShowGlobalSmsModal(true)}
                                    className="bg-white/5 hover:bg-white text-slate-400 hover:text-slate-900 text-[11px] font-black uppercase tracking-widest px-8 py-3.5 rounded-[1.5rem] transition-all border border-white/5 hover:border-white shadow-xl hover:-translate-y-1 active:scale-95"
                                >
                                    {t('open_analytics_archive')} ⏎
                                </button>
                                {role === 'super_admin' && (
                                    <button 
                                        onClick={() => setShowApiSettings(true)}
                                        className={`text-[11px] font-black uppercase tracking-widest px-8 py-3.5 rounded-[1.5rem] transition-all border shadow-xl hover:-translate-y-1 active:scale-95 ${
                                            superAdminSmsConfig?.useCustomSmsApi 
                                                ? 'bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border-blue-500/30' 
                                                : 'bg-white/5 hover:bg-white text-slate-400 hover:text-slate-900 border-white/5 hover:border-white'
                                        }`}
                                    >
                                        ⚙️ API Settings
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}


                {/* Global Intelligence Section */}
                {!globalLoading && globalStats && (
                    <section className="mb-14">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
                            <div>
                                <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">{t('system_overview')}</h1>
                                <p className="text-slate-500 text-sm font-medium">{t('real_time_metrics_desc')}</p>
                            </div>
                            <div className="flex flex-col sm:flex-row items-center gap-4">
                                <div className="bg-emerald-500 text-white px-4 py-3.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 animate-pulse">
                                    <span className="w-1.5 h-1.5 bg-white rounded-full"></span> {t('live_data_sync_active')}
                                </div>
                            </div>
                        </div>


                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                            {[
                                { label: t('total_revenue'), value: `$${(globalStats.financials?.totalRevenue || 0).toLocaleString()}`, icon: '💰', color: 'bg-emerald-500', trend: '+12.5%' },
                                { label: t('total_students'), value: (globalStats.counts?.totalStudents || 0).toLocaleString(), icon: '👨‍🎓', color: 'bg-blue-500', trend: 'Global' },
                                { label: t('total_teachers'), value: (globalStats.counts?.totalTeachers || 0).toLocaleString(), icon: '🏫', color: 'bg-indigo-500', trend: 'Active' },
                                { label: t('total_schools'), value: (globalStats.counts?.totalSchools || 0).toLocaleString(), icon: '🏢', color: 'bg-amber-500', trend: 'Systems' },
                            ].map((s, i) => (
                                <div key={i} className={`group relative bg-white border border-slate-100 p-6 xl:p-8 rounded-[2.5rem] shadow-sm hover:shadow-2xl hover:shadow-blue-500/5 transition-all duration-500 cursor-default`}>
                                    <div className="flex items-center justify-between mb-6">
                                        <div className={`w-14 h-14 rounded-2xl ${s.color} flex items-center justify-center text-2xl shadow-lg shadow-current/20 text-white`}>{s.icon}</div>
                                        <div className={`text-[10px] font-black px-2 py-1 rounded-lg text-emerald-500 bg-emerald-50 uppercase tracking-widest`}>{s.trend}</div>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
                                    <h3 className="text-3xl font-black text-slate-900 tracking-tight">{s.value}</h3>
                                </div>
                            ))}
                        </div>

                        {/* Revenue Visualization */}
                        {globalStats.monthlyTrends && (
                            <div className="bg-white border border-slate-100 p-10 rounded-[3rem] shadow-sm overflow-hidden group">
                                <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-10">
                                    <div>
                                        <h3 className="text-xl font-black text-slate-900 mb-1">{t('financial_overview')}</h3>
                                        <p className="text-slate-400 text-[11px] font-black uppercase tracking-widest">{t('monthly_aggregation_desc')}</p>
                                    </div>
                                    <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl">
                                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest mr-4">{t('revenue_label')}</span>
                                    </div>
                                </div>
                                <div className="h-[360px] w-full group-hover:scale-[1.01] transition-transform duration-700">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={globalStats.monthlyTrends}>
                                            <defs>
                                                <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="8 8" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 800 }} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 800 }} tickFormatter={(val) => `$${val.toLocaleString()}`} />
                                            <Tooltip 
                                                contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)', padding: '20px' }}
                                                itemStyle={{ fontWeight: 900, fontSize: 14, color: '#0f172a' }}
                                                labelStyle={{ fontWeight: 800, fontSize: 10, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase' }}
                                            />
                                            <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={6} dot={{ r: 8, fill: '#fff', strokeWidth: 5, stroke: '#3b82f6' }} activeDot={{ r: 12, strokeWidth: 0, fill: '#1e293b' }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}
                    </section>
                )}

                {/* Institutional Management Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                    <div className="flex-1 max-w-2xl">
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                            {t('institutional_network')}
                            <span className="text-[10px] bg-slate-100 text-slate-500 px-3 py-1 rounded-full uppercase tracking-widest">{schools.length} {t('units_count')}</span>
                        </h2>
                        <div className="relative mt-4 group">
                            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-xl grayscale group-hover:grayscale-0 transition-all opacity-40 group-hover:opacity-100">🔍</span>
                            <input 
                                type="text"
                                placeholder={t('search_school_placeholder')}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-white border-2 border-slate-100 rounded-3xl py-5 pl-14 pr-6 text-sm font-bold shadow-sm focus:border-blue-500 focus:shadow-xl focus:shadow-blue-500/5 transition-all outline-none"
                            />
                        </div>
                    </div>
                    {(role === 'owner' || isImpersonatingSuper) && (
                        <button onClick={openAddSchoolModal} className="relative overflow-hidden group bg-slate-900 text-white px-8 py-5 rounded-[2rem] text-sm font-black uppercase tracking-widest transition-all hover:pr-12 shadow-2xl shadow-slate-900/20 active:scale-95 self-end">
                            <span className="relative z-10 font-bold">{t('new_institution')}</span>
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all">→</span>
                        </button>
                    )}
                </div>

                <div className={`grid gap-10 items-start ${selectedSchool ? 'grid-cols-1 lg:grid-cols-[1fr_480px]' : 'grid-cols-1'}`}>
                    {/* Schools Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {loading && !schools.length ? (
                            [1,2,3,4,5,6].map(i => <div key={i} className="animate-pulse bg-white border border-slate-100 h-64 rounded-[2.5rem]"></div>)
                        ) : schools.length === 0 ? (
                            <div className="col-span-full py-24 text-center bg-white border border-slate-100 rounded-[3rem]">
                                <div className="text-6xl mb-6 grayscale opacity-20">🏢</div>
                                <h3 className="text-xl font-black text-slate-900">{t('no_stats_found')}</h3>
                                <p className="text-slate-400 mt-2 font-medium">{t('add_first_institution_desc')}</p>
                            </div>
                        ) : schools.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || (s.shortCode || '').toLowerCase().includes(searchTerm.toLowerCase())).map(school => (
                            <div
                                key={school.id}
                                onClick={() => handleSelectSchool(school)}
                                className={`group relative p-8 rounded-[2.5rem] cursor-pointer transition-all duration-500 border-2 ${selectedSchool?.id === school.id ? 'bg-white border-blue-500 shadow-2xl shadow-blue-500/10 -translate-y-2' : 'bg-white/50 border-transparent hover:border-slate-200 hover:bg-white hover:-translate-y-1'} ${!school.isActive && 'grayscale opacity-60 hover:grayscale-0'}`}
                            >
                                <div className="flex items-start justify-between mb-8">
                                    <div className="flex items-center gap-5">
                                        <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden p-3 group-hover:border-blue-100 transition-colors">
                                            {school.logo ? <img src={getImageUrl(school.logo)} alt="" className="w-full h-full object-contain" /> : <span className="text-3xl">🏫</span>}
                                        </div>
                                        <div>
                                            <h4 className="font-black text-slate-900 text-lg tracking-tight mb-0.5">{school.name}</h4>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{school.shortCode || t('no_code')}</p>
                                        </div>
                                    </div>
                                    <div className={`text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-full ${school.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                        {school.isActive ? t('active') : t('locked')}
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { l: t('students_label'), v: school.students || 0, c: 'text-blue-500', b: 'bg-blue-50' },
                                        { l: t('classes_label'), v: school.classes || 0, c: 'text-amber-500', b: 'bg-amber-50' },
                                        { l: t('sms_sent'), v: school.smsSent || 0, c: 'text-violet-500', b: 'bg-violet-50' },
                                    ].map((stat, idx) => (
                                        <div key={idx} className={`${stat.b} rounded-2xl p-4 text-center transition-transform group-hover:scale-105 duration-300`}>
                                            <div className={`text-xl font-black ${stat.c} mb-1`}>{stat.v}</div>
                                            <div className={`text-[8px] font-black uppercase tracking-widest ${stat.c} opacity-60`}>{stat.l}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* School Detail Intelligence Sidebar */}
                    {selectedSchool && (
                        <div className="sticky top-[100px] animate-in fade-in slide-in-from-right-8 duration-500">
                            <div className="bg-white/80 backdrop-blur-2xl border border-white p-10 rounded-[3.5rem] shadow-2xl shadow-slate-900/5 overflow-hidden">
                                <div className="flex items-center justify-between mb-10">
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">{t('intelligence_node')}</h2>
                                    <button onClick={() => { setSelectedSchool(null); setSchoolStats(null) }} className="w-10 h-10 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center transition-colors">✕</button>
                                </div>

                                <div className="space-y-6 mb-10">
                                    {[
                                        { i: '📍', t: selectedSchool.address || t('location_unspecified') },
                                        { i: '📞', t: selectedSchool.phone || t('comm_gateway_required') },
                                        { i: '📧', t: selectedSchool.email || t('email_not_configured') },
                                    ].map((item, i) => (
                                        <div key={i} className="flex items-center gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-50">
                                            <span className="text-xl">{item.i}</span>
                                            <span className="text-xs font-bold text-slate-600 truncate">{item.t}</span>
                                        </div>
                                    ))}
                                </div>

                                {statsLoading ? (
                                    <div className="py-12 flex flex-col items-center gap-4 text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                        {t('fetching_intelligence')}...
                                    </div>
                                ) : schoolStats && (
                                    <div className="grid grid-cols-2 gap-4 mb-10">
                                        {[
                                            { l: t('revenue_node'), v: `$${(schoolStats.revenue || 0).toLocaleString()}`, c: 'text-emerald-500', b: 'bg-emerald-50' },
                                            { l: t('sms_this_month'), v: smsStatus?.monthlyCount || 0, c: 'text-blue-500', b: 'bg-blue-50' },
                                        ].map((s, i) => (
                                            <div key={i} className={`${s.b} p-6 rounded-3xl border border-white shadow-sm`}>
                                                <div className={`text-2xl font-black ${s.c} mb-1 tracking-tight`}>{s.v}</div>
                                                <div className={`text-[9px] font-black uppercase tracking-widest ${s.c} opacity-70`}>{s.l}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                
                                {/* SMS Status — Read-Only (Owner controls this) */}
                                <div className={`p-6 rounded-[2rem] border mb-4 ${smsStatus?.isActive ? 'bg-indigo-50/50 border-indigo-100' : 'bg-slate-50 border-slate-100'}`}>
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('sms_access_status')}</p>
                                        <div className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl ${smsStatus?.isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
                                            {smsStatus?.isActive ? `🔓 ${t('authorized')}` : `🔒 ${t('restricted_by_owner')}`}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-2xl font-black text-slate-800">{smsStatus?.monthlyCount || 0}</div>
                                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{t('sms_this_month')}</div>
                                        </div>
                                        {!smsStatus?.isActive && (
                                            <div className="text-[10px] text-slate-400 font-bold bg-slate-100 rounded-xl px-3 py-2 text-center max-w-[140px]">
                                                {t('contact_owner_to_enable_sms')}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* SMS Section removed in favor of Global Logs Modal */}

                                {schoolAdmin && (
                                    <div className="bg-slate-900 p-8 rounded-[2.5rem] mb-10 relative overflow-hidden group shadow-2xl shadow-slate-900/10">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
                                        <div className="relative z-10">
                                            <div className="flex justify-between items-start mb-6">
                                                <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest bg-blue-400/10 px-3 py-1 rounded-lg">{t('primary_administrator')}</div>
                                                <button onClick={() => handleDeleteAdmin(schoolAdmin.id)} className="text-[10px] font-black text-rose-400 hover:text-rose-300 transition-colors uppercase tracking-widest border-b border-rose-400/20">{t('provision_off')}</button>
                                            </div>
                                            <h5 className="text-white text-xl font-black tracking-tight mb-1">{schoolAdmin.name}</h5>
                                            <p className="text-slate-500 text-sm font-bold">@{schoolAdmin.username}</p>
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 gap-3">
                                    <button onClick={() => handleEnterSchool(selectedSchool)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-blue-600/20 uppercase text-xs tracking-widest">
                                        🚀 {t('launch_node_portal')}
                                    </button>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button onClick={() => openEditSchool(selectedSchool)} className="bg-white border-2 border-slate-100 hover:border-slate-200 text-slate-900 font-black py-4 rounded-xl text-[10px] uppercase tracking-widest transition-all">✏️ {t('edit_sync')}</button>
                                        <button onClick={() => openAddAdmin(selectedSchool.id, schoolAdmin)} className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-black py-4 rounded-xl text-[10px] uppercase tracking-widest transition-all border border-indigo-100">👤 {t('admins_label')}</button>
                                    </div>
                                    <button onClick={() => handleToggleActive(selectedSchool)} className={`w-full font-black py-4 rounded-2xl text-[11px] uppercase tracking-widest transition-all ${selectedSchool.isActive ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'} border border-current/10`}>
                                        {selectedSchool.isActive ? `🔒 ${t('suspend_protocol')}` : `✅ ${t('restore_connectivity')}`}
                                    </button>
                                    {(role === 'owner' || isImpersonatingSuper) && (
                                        <button onClick={() => handleDeleteSchool(selectedSchool.id)} className="w-full py-4 text-rose-400 hover:text-rose-600 font-black text-[10px] uppercase tracking-widest transition-colors mt-4">{t('terminate_institutional_entity')}</button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Premium Modals */}
            {(showAddSchool || showAddAdmin || showApiSettings) && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-[540px] overflow-hidden animate-in zoom-in-95 duration-500 border border-white/20">
                        {showAddSchool && (
                            <form onSubmit={handleAddSchool}>
                                <div className="bg-slate-900 p-10 text-white">
                                    <div className="flex justify-between items-center mb-6">
                                        <h2 className="text-2xl font-black tracking-tight uppercase">{isEditing ? t('sync_modification') : t('unified_provisioning')}</h2>
                                        <button type="button" onClick={() => setShowAddSchool(false)} className="text-white/40 hover:text-white transition-colors">✕</button>
                                    </div>
                                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest leading-relaxed">{t('unified_provisioning_desc')}</p>
                                </div>
                                <div className="p-10 space-y-5 max-h-[60vh] overflow-y-auto">
                                    {[
                                        { key: 'name', label: t('entity_name'), placeholder: 'e.g. Al-Fajr University', required: true },
                                        { key: 'shortCode', label: t('entity_code'), placeholder: 'e.g. AF-UNIT1' },
                                        { key: 'address', label: t('geographic_radius'), placeholder: 'City, Region' },
                                        { key: 'phone', label: t('gateway_contact'), placeholder: '+252...' },
                                        { key: 'email', label: t('system_email'), placeholder: 'admin@node.edu', type: 'email' },
                                    ].map(field => (
                                        <div key={field.key}>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">{field.label}</label>
                                            <input
                                                type={field.type || 'text'}
                                                placeholder={field.placeholder}
                                                required={field.required}
                                                value={schoolForm[field.key]}
                                                onChange={e => setSchoolForm(f => ({ ...f, [field.key]: e.target.value }))}
                                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold focus:border-blue-500 focus:bg-white transition-all outline-none"
                                            />
                                        </div>
                                    ))}

                                    {/* Logo Display Only (Managed by System Owner) */}
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Branch Logo (System Managed)</label>
                                        <div className="flex items-center gap-4 bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 opacity-80">
                                            <div className="w-16 h-16 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden p-2 shrink-0">
                                                {schoolForm.logo ? (
                                                    <img src={getImageUrl(schoolForm.logo)} alt="Preview" className="w-full h-full object-contain" />
                                                ) : (
                                                    <span className="text-2xl opacity-20">🏫</span>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-relaxed">
                                                    This branch branding is synchronized with the Global System Node. Contact System Owner to update branding assets.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-10 pt-0 flex gap-4">
                                    <button type="button" onClick={() => setShowAddSchool(false)} className="flex-1 py-4 bg-slate-50 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all">{t('cancel')}</button>
                                    <button type="submit" disabled={schoolSaving} className="flex-[2] py-4 bg-blue-600 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20">
                                        {schoolSaving ? t('synchronizing') : (isEditing ? t('confirm_changes') : t('initialize_node'))}
                                    </button>
                                </div>
                            </form>
                        )}
                        {showAddAdmin && (
                            <form onSubmit={handleAddAdmin}>
                                <div className="bg-slate-900 p-10 text-white text-center">
                                    <h2 className="text-2xl font-black tracking-tight uppercase mb-2">{schoolAdmin ? t('override_access') : t('provision_admin')}</h2>
                                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{t('provision_admin_desc')}</p>
                                </div>
                                <div className="p-10 space-y-5">
                                    {[
                                        { key: 'name', label: t('legal_identity'), placeholder: 'Principal / Admin Name', required: true },
                                        { key: 'username', label: t('system_identifier_id'), placeholder: 'username', required: true },
                                        { key: 'password', label: schoolAdmin ? t('key_reset_password') : t('access_key_password'), placeholder: 'Highly Secure Key', required: !schoolAdmin, type: 'password' },
                                    ].map(field => (
                                        <div key={field.key}>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2 ml-1">{field.label}</label>
                                            <input
                                                type={field.type || 'text'}
                                                placeholder={field.placeholder}
                                                required={field.required}
                                                value={adminForm[field.key]}
                                                onChange={e => setAdminForm(f => ({ ...f, [field.key]: e.target.value }))}
                                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold focus:border-blue-500 focus:bg-white transition-all outline-none"
                                            />
                                        </div>
                                    ))}
                                </div>
                                <div className="p-10 pt-0 flex gap-4">
                                    <button type="button" onClick={() => setShowAddAdmin(false)} className="flex-1 py-4 bg-slate-50 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all">{t('discard')}</button>
                                    <button type="submit" disabled={adminSaving} className="flex-[2] py-4 bg-slate-900 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-black transition-all shadow-xl">
                                        {adminSaving ? t('provisioning') : t('confirm_access')}
                                    </button>
                                </div>
                            </form>
                        )}
                        {showApiSettings && (
                            <form onSubmit={handleSaveApiSettings}>
                                <div className="bg-slate-900 p-10 text-white text-center">
                                    <h2 className="text-2xl font-black tracking-tight uppercase mb-2">Custom SMS API</h2>
                                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Override Global SMS Gateway Settings</p>
                                </div>
                                <div className="p-10 space-y-5">
                                    <div className="flex items-center gap-4 bg-blue-50 p-4 rounded-2xl border border-blue-100">
                                        <div className="flex-1">
                                            <h4 className="text-sm font-black text-blue-900 mb-1">Enable Custom API</h4>
                                            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Bypass System Owner API</p>
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={() => setApiForm(f => ({ ...f, useCustomSmsApi: !f.useCustomSmsApi }))}
                                            className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${apiForm.useCustomSmsApi ? 'bg-blue-600' : 'bg-slate-300'}`}
                                        >
                                            <span className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${apiForm.useCustomSmsApi ? 'translate-x-6' : 'translate-x-0'}`} />
                                        </button>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2 ml-1">Gateway Provider</label>
                                        <select
                                            value={apiForm.customSmsProvider}
                                            onChange={e => setApiForm(f => ({ ...f, customSmsProvider: e.target.value }))}
                                            disabled={!apiForm.useCustomSmsApi}
                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold focus:border-blue-500 focus:bg-white transition-all outline-none"
                                        >
                                            <option value="hormuud">Hormuud Telecom</option>
                                            <option value="golis">Golis Telecom</option>
                                        </select>
                                    </div>
                                    {[
                                        { key: 'customSmsApiUrl', label: 'Gateway URL', placeholder: 'https://...', required: apiForm.useCustomSmsApi },
                                        { key: 'customSmsApiKey', label: 'API Key / Token', placeholder: 'Token or Key', required: apiForm.useCustomSmsApi },
                                        { key: 'customSmsSenderId', label: 'Sender ID', placeholder: 'e.g. DugsiPro', required: false },
                                    ].map(field => (
                                        <div key={field.key}>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2 ml-1">{field.label}</label>
                                            <input
                                                type={field.type || 'text'}
                                                placeholder={field.placeholder}
                                                required={field.required}
                                                disabled={!apiForm.useCustomSmsApi}
                                                value={apiForm[field.key] || ''}
                                                onChange={e => setApiForm(f => ({ ...f, [field.key]: e.target.value }))}
                                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold focus:border-blue-500 focus:bg-white transition-all outline-none disabled:opacity-50"
                                            />
                                        </div>
                                    ))}
                                </div>
                                <div className="p-10 pt-0 flex gap-4">
                                    <button type="button" onClick={() => setShowApiSettings(false)} className="flex-1 py-4 bg-slate-50 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all">{t('discard')}</button>
                                    <button type="submit" disabled={apiSaving} className="flex-[2] py-4 bg-blue-600 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl hover:shadow-blue-500/20">
                                        {apiSaving ? 'SAVING...' : 'SAVE SETTINGS'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
            {showGlobalSmsModal && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 lg:p-10 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-[1000px] h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-500 border border-white/20">
                        {/* Header */}
                        <div className="bg-slate-900 p-8 text-white flex flex-col md:flex-row items-center justify-between gap-4 shrink-0">
                            <div>
                                <h2 className="text-2xl font-black tracking-tight uppercase flex items-center gap-3">
                                    <span className="text-3xl">📨</span> {t('global_sms_archive')}
                                </h2>
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">{t('cross_network_history')}</p>
                            </div>
                            <div className="flex gap-4 items-center">
                                <select 
                                    className="bg-white/10 text-white border-0 rounded-xl px-4 py-3 font-black text-xs uppercase cursor-pointer outline-none focus:ring-2 focus:ring-violet-500"
                                    value={smsLogMonth === 'all' ? 'all' : `${smsLogYear}-${smsLogMonth}`}
                                    onChange={(e) => {
                                        if (e.target.value === 'all') {
                                            setSmsLogMonth('all')
                                            setSmsLogYear('all')
                                        } else {
                                            const [y, m] = e.target.value.split('-')
                                            setSmsLogMonth(parseInt(m))
                                            setSmsLogYear(parseInt(y))
                                        }
                                    }}
                                >
                                    <option value={`${new Date().getFullYear()}-${new Date().getMonth() + 1}`}>{t('these_30_days')}</option>
                                    <option value={`${new Date().getFullYear()}-${new Date().getMonth() === 0 ? 12 : new Date().getMonth()}`}>{t('last_month_label')}</option>
                                    <option value="all">{t('all_history_max_1000')}</option>
                                </select>
                                <button onClick={() => setShowGlobalSmsModal(false)} className="w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-all flex items-center justify-center font-black">✕</button>
                            </div>
                        </div>
                        
                        {/* Log List */}
                        <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
                            {globalSmsLoading ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                    <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mb-4" />
                                    <p className="text-[10px] font-black uppercase tracking-widest">{t('decrypting_archive')}</p>
                                </div>
                            ) : globalSmsLogs.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-300">
                                    <span className="text-6xl mb-4 grayscale pr-[20px]">📭</span>
                                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">{t('no_transmissions_found')}</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-3">
                                    {globalSmsLogs.map(log => (
                                        <div key={log.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col lg:flex-row lg:items-center gap-4 hover:border-violet-200 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                                            <div className="flex items-center gap-3 shrink-0 lg:w-[220px]">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 ${log.type === 'attendance' ? 'bg-amber-50 text-amber-500' : 'bg-blue-50 text-blue-500'}`}>
                                                    {log.type === 'attendance' ? '⏰' : '📝'}
                                                </div>
                                                <div>
                                                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{new Date(log.created_at).toLocaleString()}</div>
                                                    <div className="text-xs font-black text-slate-800 line-clamp-1 truncate">{log.schoolName}</div>
                                                </div>
                                            </div>
                                            <div className="flex-1 bg-slate-50/50 p-3 rounded-xl border border-slate-50">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[10px] font-black bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md uppercase">{log.phoneNumber}</span>
                                                    <span className={`text-[9px] font-black uppercase py-0.5 px-2 rounded-md ${log.status === 'sent' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                                        {log.status}
                                                    </span>
                                                </div>
                                                <p className="text-[12px] font-medium text-slate-700 leading-snug">{log.message}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
