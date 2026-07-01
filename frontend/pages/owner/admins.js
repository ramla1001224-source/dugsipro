import { useEffect, useState } from 'react'
import axios from 'axios'
import Layout from '../../components/Layout'
import Head from 'next/head'
import { getImageUrl } from '../../utils/imageHelper'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function SuperAdminsPage() {
    const [admins, setAdmins] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingAdmin, setEditingAdmin] = useState(null)
    const [form, setForm] = useState({ name: '', username: '', password: '', shortCode: '', schoolName: '', branchName: '', schoolLogo: '', phone: '', institutionType: 'school' })
    const [saving, setSaving] = useState(false)
    const [logoPreview, setLogoPreview] = useState(null)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [showConfigModal, setShowConfigModal] = useState(false)
    const [globalConfigs, setGlobalConfigs] = useState([])
    const [configSaving, setConfigSaving] = useState(false)
    const [smsToggling, setSmsToggling] = useState(null)
    const [smsStats, setSmsStats] = useState(null)
    const [expandedAdmin, setExpandedAdmin] = useState(null)
    const [activeProvider, setActiveProvider] = useState('hormuud')
    const [showApiKey, setShowApiKey] = useState({})

    const PROVIDERS = [
        { id: 'hormuud', name: 'Hormuud', emoji: '🟢', color: '#00a651', badge: 'Most Popular' },
        { id: 'golis', name: 'Golis', emoji: '🔵', color: '#0057a8', badge: 'North Somalia' },
        { id: 'somtel', name: 'Somtel', emoji: '🟠', color: '#f97316', badge: 'International' }
    ]

    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    useEffect(() => {
        fetchAdmins()
        fetchGlobalConfigs()
        fetchSmsStats()
    }, [])

    const fetchSmsStats = async () => {
        try {
            const res = await axios.get(`${API}/api/owner/sms-stats`, { headers: headers() })
            setSmsStats(res.data)
        } catch (e) {
            console.error('Failed to fetch SMS stats', e)
        }
    }

    const fetchGlobalConfigs = async () => {
        try {
            const res = await axios.get(`${API}/api/owner/global-config`, { headers: headers() })
            setGlobalConfigs(res.data)
        } catch (e) {
            console.error('Failed to fetch configs', e)
        }
    }

    const fetchAdmins = async () => {
        setLoading(true)
        try {
            const res = await axios.get(`${API}/api/owner/super-admins`, { headers: headers() })
            setAdmins(res.data)
        } catch (e) {
            console.error(e)
            setError('Failed to fetch super admins')
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSaving(true)
        setError('')
        try {
            if (editingAdmin) {
                await axios.put(`${API}/api/owner/super-admins/${editingAdmin.id}`, form, { headers: headers() })
            } else {
                await axios.post(`${API}/api/owner/super-admins`, form, { headers: headers() })
            }
            setShowModal(false)
            setEditingAdmin(null)
            setForm({ name: '', username: '', password: '', shortCode: '', schoolName: '', branchName: '', schoolLogo: '', phone: '', institutionType: 'school' })
            setLogoPreview(null)
            fetchAdmins()
        } catch (e) {
            setError(e.response?.data?.message || 'Something went wrong')
        } finally {
            setSaving(false)
        }
    }

    const openEdit = (admin) => {
        setEditingAdmin(admin)
        const school = admin.SuperAdminSchools?.[0] || {}
        setForm({
            name: admin.name || '',
            username: admin.username || '',
            password: '',
            shortCode: admin.shortCode || '',
            schoolName: admin.schoolName || '',
            branchName: school.name || '',
            schoolLogo: typeof school.logo === 'string' ? school.logo : '',
            phone: admin.phone || '',
            institutionType: school.institutionType || 'school'
        })
        setLogoPreview(typeof school.logo === 'string' ? school.logo : null)
        setShowModal(true)
    }

    const enterDashboard = async (admin) => {
        try {
            const currentToken = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
            const res = await axios.post(`${API}/api/owner/impersonate-super/${admin.id}`, {}, { headers: headers() })
            
            // Store original session
            localStorage.setItem('originalOwnerToken', currentToken)
            
            // Clear current role-specific data
            localStorage.removeItem('schoolId')
            localStorage.removeItem('schoolInfo')
            
            // Set new session
            localStorage.setItem('token', res.data.token)
            localStorage.setItem('role', 'super_admin')
            localStorage.setItem('userName', res.data.name)
            
            window.location.href = '/super-admin/dashboard'
        } catch (e) {
            console.error('Impersonation failed:', e)
            alert('Error entering dashboard: ' + (e.response?.data?.message || 'Connection failed'))
        }
    }

    const deleteAdmin = async (id) => {
        if (!confirm('Super admin-kan ma tirtirayaa? Dhammaan dugsiyada ku xidanyaana waa la tirtirayaa.')) return
        try {
            await axios.delete(`${API}/api/owner/super-admins/${id}`, { headers: headers() })
            setSuccess('Super admin waa la tirtiray')
            fetchAdmins()
        } catch (e) {
            setError(e.response?.data?.message || 'Tirtirku wuu fashilmay')
        }
    }

    const toggleStatus = async (admin) => {
        const confirmMsg = admin.isActive !== false
            ? 'Ma hubtaa inaad xirto maamulahan iyo dhammaan dugsiyadiisa? Tani waxay joojin doontaa in la isticmaalo.'
            : 'Ma hubtaa inaad dib u furto maamulahan iyo dugsiyadiisa?'
        if (!confirm(confirmMsg)) return
        try {
            const nextStatus = admin.isActive === false ? true : false;
            await axios.put(`${API}/api/owner/super-admins/${admin.id}`, { isActive: nextStatus }, { headers: headers() })
            fetchAdmins()
        } catch (e) {
            setError(e.response?.data?.message || 'Cillad ayaa dhacday bedelida xaaladda')
        }
    }

    const toggleSmsAuth = async (admin) => {
        setSmsToggling(admin.id)
        setError('')
        try {
            const nextStatus = !admin.isSmsEnabled;
            const res = await axios.put(`${API}/api/owner/super-admins/${admin.id}`, { isSmsEnabled: nextStatus }, { headers: headers() })
            
            if (res.status === 200) {
                fetchAdmins()
                fetchSmsStats()
                setSuccess(`SMS access ${nextStatus ? 'la furay' : 'la xiray'} — ${admin.name}`)
            }
        } catch (e) {
            console.error('SMS update error:', e)
            setError(e.response?.data?.message || '⚠️ Failed to update SMS status. Please check your connection.')
        } finally {
            setSmsToggling(null)
        }
    }

    const saveConfigs = async (e) => {
        e.preventDefault()
        setConfigSaving(true)
        try {
            await axios.post(`${API}/api/owner/global-config`, { configs: globalConfigs }, { headers: headers() })
            setSuccess('✅ SMS Gateway credentials waa la keydsaday')
            setShowConfigModal(false)
        } catch (e) {
            setError('Failed to save configuration')
        } finally {
            setConfigSaving(false)
        }
    }

    const handleLogoChange = (e) => {
        const file = e.target.files[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = (event) => {
            const base64 = event.target.result
            setForm({ ...form, schoolLogo: base64 })
            setLogoPreview(base64)
        }
        reader.readAsDataURL(file)
    }

    const getConfigVal = (key) => globalConfigs.find(c => c.key === key)?.value || ''
    const setConfigVal = (key, val) => {
        setGlobalConfigs(prev => {
            const existing = prev.find(c => c.key === key)
            if (existing) return prev.map(c => c.key === key ? { ...c, value: val } : c)
            return [...prev, { key, value: val }]
        })
    }

    const getAdminSmsStats = (adminId) => smsStats?.stats?.find(s => s.id === adminId)

    return (
        <Layout title="Maamulka Sare | Dugsi Pro">
            <Head>
                <title>Maamulka Sare | Core Registry</title>
            </Head>

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-12">
                <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Registry Control</h2>
                    <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px]">Administrative Access Management for System Nodes</p>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setShowConfigModal(true)}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-5 rounded-[2rem] font-black uppercase text-[10px] tracking-widest transition-all shadow-xl shadow-blue-500/20 flex items-center gap-2"
                    >
                        📡 SMS Gateway Config
                    </button>
                    <button
                        onClick={() => {
                            setEditingAdmin(null);
                            setForm({ name: '', username: '', password: '', shortCode: '', schoolName: '', branchName: '', schoolLogo: '', phone: '', institutionType: 'school' });
                            setLogoPreview(null);
                            setShowModal(true);
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-5 rounded-[2rem] font-black uppercase text-xs tracking-widest transition-all shadow-2xl shadow-blue-500/20 active:scale-95 flex items-center gap-3"
                    >
                        <span className="text-xl">+</span> Provision Global Admin
                    </button>
                </div>
            </div>

            {/* SMS Platform Overview Card */}
            {smsStats && (
                <div className="bg-gradient-to-br from-slate-900 to-blue-950 rounded-[2.5rem] p-8 mb-10 text-white shadow-2xl shadow-slate-900/20">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-6">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 rounded-2xl bg-blue-500/20 flex items-center justify-center text-xl">📡</div>
                                <h3 className="text-xl font-black tracking-tight">SMS Platform Overview</h3>
                            </div>
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">
                                {MONTHS[smsStats.currentMonth - 1]} {smsStats.currentYear} — Platform-wide farriimaha la diray
                            </p>
                        </div>
                        <div className="bg-white/10 rounded-2xl px-8 py-4 text-center">
                            <div className="text-3xl font-black text-blue-300">{smsStats.totalPlatformSmsThisMonth.toLocaleString()}</div>
                            <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">Total SMS This Month</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {smsStats.stats?.slice(0, 4).map((admin, i) => (
                            <div key={i} className="bg-white/5 rounded-2xl p-4 border border-white/5">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-7 h-7 rounded-xl bg-blue-500/20 flex items-center justify-center text-xs font-black text-blue-400">
                                        {admin.name[0].toUpperCase()}
                                    </div>
                                    <div className="text-[10px] font-black text-slate-300 truncate">{admin.name}</div>
                                </div>
                                <div className="text-2xl font-black text-white mb-0.5">{admin.totalSmsThisMonth}</div>
                                <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">SMS This Month</div>
                                <div className={`mt-2 text-[9px] font-black px-2 py-0.5 rounded-lg inline-block ${admin.isSmsEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                    {admin.isSmsEnabled ? '🔓 Authorized' : '🔒 Restricted'}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {success && (
                <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-6 rounded-3xl mb-8 flex items-center justify-between font-bold animate-in fade-in slide-in-from-top-4">
                    <span className="flex items-center gap-3">✅ {success}</span>
                    <button onClick={() => setSuccess('')} className="text-xl">✕</button>
                </div>
            )}

            {error && (
                <div className="bg-rose-50 border border-rose-100 text-rose-800 p-6 rounded-3xl mb-8 flex items-center justify-between font-bold animate-in fade-in slide-in-from-top-4">
                    <span className="flex items-center gap-3">⚠️ {error}</span>
                    <button onClick={() => setError('')} className="text-xl">✕</button>
                </div>
            )}

            <div className="bg-white/70 backdrop-blur-2xl rounded-[3rem] border border-white shadow-2xl shadow-slate-900/5 overflow-hidden transition-all duration-700">
                <div className="overflow-x-auto w-full">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-900/5">
                                <th className="px-10 py-8 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Node Administrator</th>
                                <th className="px-10 py-8 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">System ID</th>
                                <th className="px-10 py-8 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 text-center">SMS Authorization</th>
                                <th className="px-10 py-8 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 text-center">SMS This Month</th>
                                <th className="px-10 py-8 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 text-center">Status Index</th>
                                <th className="px-10 py-8 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 text-right">Registry Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                [1, 2, 3, 4].map(i => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan="6" className="px-10 py-10"><div className="h-12 bg-slate-50 rounded-[1.5rem] w-full"></div></td>
                                    </tr>
                                ))
                            ) : admins.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-10 py-24 text-center">
                                        <div className="text-5xl mb-6 opacity-20">🛡️</div>
                                        <p className="text-slate-400 font-black uppercase tracking-widest text-xs">No global administrators registered in the registry.</p>
                                    </td>
                                </tr>
                            ) : admins.map(admin => {
                                const adminStats = getAdminSmsStats(admin.id)
                                return (
                                    <tr key={admin.id} className="hover:bg-blue-50/30 transition-all duration-300 group">
                                        <td className="px-10 py-8">
                                            <div className="flex items-center gap-5">
                                                <div className="w-14 h-14 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center text-slate-900 font-black text-sm shadow-inner group-hover:from-blue-100 group-hover:to-blue-200 group-hover:text-blue-600 transition-all duration-500">
                                                    {admin.name[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-black text-slate-900 text-lg tracking-tight mb-0.5">{admin.name}</div>
                                                    {admin.schoolName && (
                                                        <div className="text-xs text-slate-500 font-bold tracking-tight mb-1">{admin.schoolName}</div>
                                                    )}
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        {(() => {
                                                            const itype = admin.SuperAdminSchools?.[0]?.institutionType || 'school'
                                                            return (
                                                                <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${
                                                                    itype === 'machad'
                                                                        ? 'bg-purple-100 text-purple-600'
                                                                        : 'bg-blue-100 text-blue-600'
                                                                }`}>
                                                                    {itype === 'machad' ? '🎓 Machadh' : '🏫 Dugsi'}
                                                                </span>
                                                            )
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8">
                                            <span className="bg-slate-50 text-slate-500 px-4 py-2 rounded-xl text-xs font-black tracking-tight group-hover:bg-white transition-colors border border-slate-100">@{admin.username}</span>
                                        </td>
                                        {/* SMS Authorization Toggle */}
                                        <td className="px-10 py-8 text-center">
                                            <div className="flex flex-col items-center gap-2">
                                                <button
                                                    onClick={() => toggleSmsAuth(admin)}
                                                    disabled={smsToggling === admin.id}
                                                    title={admin.isSmsEnabled ? "Click to Restrict SMS" : "Click to Authorize SMS"}
                                                    className={`relative w-16 h-8 rounded-full transition-all duration-500 shadow-inner ${admin.isSmsEnabled ? 'bg-gradient-to-r from-emerald-500 to-green-600' : 'bg-slate-200'}`}
                                                >
                                                    <div className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-500 ${admin.isSmsEnabled ? 'right-1' : 'left-1'} flex items-center justify-center text-[10px]`}>
                                                        {admin.isSmsEnabled ? '✅' : '🔒'}
                                                    </div>
                                                </button>
                                                <div className="flex flex-col items-center">
                                                    <span className={`text-[9px] font-black uppercase tracking-widest ${admin.isSmsEnabled ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                        {smsToggling === admin.id ? 'Updating...' : (admin.isSmsEnabled ? 'SMS AUTHORIZED' : 'SMS RESTRICTED')}
                                                    </span>
                                                    {!admin.isSmsEnabled && (
                                                        <span className="text-[8px] font-bold text-slate-300 italic">No access to gateway</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        {/* SMS Count This Month */}
                                        <td className="px-10 py-8 text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                <div className="text-2xl font-black text-slate-800">
                                                    {adminStats?.totalSmsThisMonth ?? '—'}
                                                </div>
                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                    {adminStats?.schoolBreakdown?.length || 0} Schools
                                                </div>
                                                {adminStats?.schoolBreakdown?.length > 0 && (
                                                    <button
                                                        onClick={() => setExpandedAdmin(expandedAdmin === admin.id ? null : admin.id)}
                                                        className="text-[9px] font-black text-blue-500 hover:text-blue-700 uppercase tracking-widest mt-1"
                                                    >
                                                        {expandedAdmin === admin.id ? '▲ Hide' : '▼ Details'}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        {/* Status */}
                                        <td className="px-10 py-8 text-center">
                                            <button
                                                onClick={() => toggleStatus(admin)}
                                                className={`px-5 py-2.5 rounded-[1.25rem] text-[9px] font-black uppercase tracking-widest transition-all border ${admin.isActive !== false ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-rose-100 hover:text-rose-600 hover:border-rose-200' : 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-emerald-100 hover:text-emerald-600 hover:border-emerald-200'}`}
                                            >
                                                {admin.isActive !== false ? '🟢 Operational' : '🔴 Suspended'}
                                            </button>
                                        </td>
                                        {/* Actions */}
                                        <td className="px-10 py-8 text-right underline-offset-4">
                                            <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-4 group-hover:translate-x-0">
                                                <button onClick={() => enterDashboard(admin)} className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white hover:bg-blue-700 rounded-xl transition-all font-black text-[9px] uppercase tracking-[0.15em] shadow-lg shadow-blue-600/10">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                    Launch
                                                </button>
                                                <button onClick={() => openEdit(admin)} className="p-3 bg-white border border-slate-100 hover:border-blue-200 hover:text-blue-600 rounded-xl transition-all text-slate-400 shadow-sm">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                </button>
                                                <button onClick={() => deleteAdmin(admin.id)} className="p-3 bg-white border border-slate-100 hover:border-rose-200 hover:text-rose-600 rounded-xl transition-all text-slate-400 shadow-sm">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}

                            {/* Expanded school-level SMS breakdown */}
                            {admins.map(admin => {
                                const adminStats = getAdminSmsStats(admin.id)
                                if (expandedAdmin !== admin.id || !adminStats?.schoolBreakdown?.length) return null
                                return (
                                    <tr key={`expand-${admin.id}`} className="bg-blue-50/40">
                                        <td colSpan="6" className="px-10 py-6">
                                            <div className="pl-20">
                                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4">📊 School-Level SMS Breakdown — {MONTHS[(smsStats?.currentMonth || 1) - 1]} {smsStats?.currentYear}</p>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                    {adminStats.schoolBreakdown.map((school, i) => (
                                                        <div key={i} className="bg-white rounded-2xl p-4 border border-blue-100 flex items-center gap-4">
                                                            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                                                {school.logo
                                                                    ? <img src={getImageUrl(school.logo)} alt="" className="w-full h-full object-contain" />
                                                                    : <span className="text-lg">🏫</span>
                                                                }
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="font-black text-slate-800 text-sm truncate">{school.schoolName}</div>
                                                                <div className="flex items-center gap-3 mt-1">
                                                                    <span className="text-[10px] font-black text-blue-600">{school.thisMonth} SMS</span>
                                                                    <span className="text-[9px] text-slate-400 font-bold">this month</span>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-lg font-black text-slate-800">{school.thisMonth}</div>
                                                                <div className="text-[9px] text-slate-400 font-bold uppercase">{school.allTime} total</div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ==================== SMS GATEWAY CONFIG MODAL ==================== */}
            {showConfigModal && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-900/70 backdrop-blur-xl animate-in fade-in duration-300">
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-[720px] overflow-hidden flex flex-col border border-white/20 animate-in zoom-in-95 duration-500 max-h-[90vh]">
                        {/* Header */}
                        <div className="bg-gradient-to-br from-slate-900 to-blue-950 p-10 text-white flex-shrink-0">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center text-2xl">📡</div>
                                    <div>
                                        <h3 className="text-2xl font-black uppercase tracking-tight">SMS Gateway Config</h3>
                                        <p className="text-blue-300 text-[10px] font-black uppercase tracking-[0.25em] mt-0.5">Global API credentials — Owner only</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowConfigModal(false)} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all text-white">✕</button>
                            </div>

                            {/* Provider tabs */}
                            <div className="flex gap-3 mt-6">
                                {PROVIDERS.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => setActiveProvider(p.id)}
                                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeProvider === p.id ? 'bg-white text-slate-900' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
                                    >
                                        <span>{p.emoji}</span> {p.name}
                                        <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${activeProvider === p.id ? 'bg-slate-100 text-slate-600' : 'bg-white/10'}`}>{p.badge}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Form */}
                        <form onSubmit={saveConfigs} className="p-10 space-y-5 overflow-y-auto flex-1">
                            {/* Info banner */}
                            <div className="bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4 flex items-start gap-3">
                                <span className="text-xl flex-shrink-0">🔐</span>
                                <p className="text-[11px] text-amber-800 font-bold leading-relaxed">
                                    Credentials-kani waxay xukumaan dhammaan SMS-yada platform-ka. School admin-yadu ma arki karaan waxna ma beddeli karaan.
                                    Waxaa la isticmaalaa provider-ka aad doortid oo keliya.
                                </p>
                            </div>

                            {(() => {
                                const p = PROVIDERS.find(x => x.id === activeProvider)
                                return (
                                    <div className="space-y-5">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-2xl">{p.emoji}</span>
                                            <div>
                                                <div className="font-black text-slate-800">{p.name} API Configuration</div>
                                                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">{p.badge}</div>
                                            </div>
                                        </div>

                                        {/* API Gateway URL */}
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">🔗 API Gateway URL</label>
                                            <input
                                                type="url"
                                                placeholder={`https://api.${activeProvider}.so/sms/send`}
                                                value={getConfigVal(`sms_gateway_url_${activeProvider}`)}
                                                onChange={e => setConfigVal(`sms_gateway_url_${activeProvider}`, e.target.value)}
                                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-mono text-sm text-slate-700 outline-none focus:border-blue-500 transition-all"
                                            />
                                        </div>

                                        {/* API Key */}
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">🔑 API Key / Token</label>
                                            <div className="relative">
                                                <input
                                                    type={showApiKey[activeProvider] ? 'text' : 'password'}
                                                    placeholder="sk-XXXX-XXXX-XXXX"
                                                    value={getConfigVal(`sms_api_key_${activeProvider}`)}
                                                    onChange={e => setConfigVal(`sms_api_key_${activeProvider}`, e.target.value)}
                                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 pr-14 font-mono text-sm text-slate-700 outline-none focus:border-blue-500 transition-all"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowApiKey(prev => ({ ...prev, [activeProvider]: !prev[activeProvider] }))}
                                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
                                                >
                                                    {showApiKey[activeProvider] ? '🙈' : '👁️'}
                                                </button>
                                            </div>
                                            <p className="text-[10px] text-slate-400 ml-1 mt-1 font-medium">Token sirta ah · Ha la wadaagin qof kale</p>
                                        </div>

                                        {/* Sender ID */}
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">🏷️ Sender ID (Default)</label>
                                            <input
                                                type="text"
                                                maxLength={11}
                                                placeholder="DUGSIPRO"
                                                value={getConfigVal(`sms_sender_id_${activeProvider}`)}
                                                onChange={e => setConfigVal(`sms_sender_id_${activeProvider}`, e.target.value.toUpperCase())}
                                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold uppercase text-slate-700 outline-none focus:border-blue-500 tracking-widest transition-all"
                                            />
                                            <p className="text-[10px] text-slate-400 ml-1 mt-1 font-medium">Max 11 xaraf</p>
                                        </div>
                                    </div>
                                )
                            })()}

                            {/* Active provider selector */}
                            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">⚡ Active Provider (Platform Default)</label>
                                <div className="flex gap-3">
                                    {PROVIDERS.map(p => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => setConfigVal('sms_active_provider', p.id)}
                                            className={`flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 text-[10px] font-black uppercase tracking-wide transition-all ${getConfigVal('sms_active_provider') === p.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                                        >
                                            <span className="text-xl">{p.emoji}</span>
                                            {p.name}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[10px] text-slate-400 mt-2 font-medium">Platform-ka oo dhan waxay isticmaalaan provider-kan default-ka ah</p>
                            </div>

                            <div className="pt-4 flex gap-4">
                                <button type="button" onClick={() => setShowConfigModal(false)} className="flex-1 bg-slate-50 text-slate-400 font-black py-5 rounded-[2rem] uppercase text-[10px] tracking-widest hover:bg-slate-100 transition-all">
                                    Cancel
                                </button>
                                <button type="submit" disabled={configSaving} className="flex-[2] bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black py-5 rounded-[2rem] shadow-2xl shadow-blue-600/20 uppercase text-[10px] tracking-widest active:scale-95 disabled:opacity-50 transition-all">
                                    {configSaving ? '⏳ Saving...' : '💾 Save Global SMS Credentials'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ==================== ADD/EDIT SUPER ADMIN MODAL ==================== */}
            {showModal && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-xl animate-in fade-in duration-300">
                    <div className="bg-white rounded-[3.5rem] shadow-2xl w-full max-w-[620px] overflow-hidden flex flex-col border border-white/20 animate-in zoom-in-95 duration-500">
                        <div className="bg-slate-900 p-12 text-white">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-3xl font-black uppercase tracking-tight">{editingAdmin ? 'Security Override' : 'Initialize Access'}</h3>
                                <button type="button" onClick={() => { setShowModal(false); setEditingAdmin(null) }} className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">✕</button>
                            </div>
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.25em] leading-relaxed">Global administrative credentialing for the DugsiPro Ecosystem.</p>
                        </div>

                        <form onSubmit={handleSubmit} className="p-12 space-y-6 max-h-[70vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block ml-1 tracking-widest">Admin Full Name *</label>
                                    <input required type="text" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all shadow-inner" placeholder="E.g. Ahmed Ali" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block ml-1 tracking-widest">System Identifier *</label>
                                    <input required type="text" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all shadow-inner" placeholder="username" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block ml-1 tracking-widest">{editingAdmin ? 'Security Key Reset' : 'Initial Security Key *'}</label>
                                    <input required={!editingAdmin} type="password" ocean-dark="true" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all shadow-inner" placeholder="••••••••" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block ml-1 tracking-widest">Phone Number (For SMS Notifications)</label>
                                    <input type="text" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all shadow-inner" placeholder="e.g. 25290..." value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block ml-1 tracking-widest">Protocol Sync Code (UNIQUE) *</label>
                                <input required type="text" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all uppercase tracking-widest shadow-inner" placeholder="e.g. ALPHA-X" value={form.shortCode} onChange={e => setForm({ ...form, shortCode: e.target.value })} />
                            </div>

                            <div className="pt-6 border-t border-slate-100">
                                <h4 className="text-[11px] font-black uppercase text-blue-600 mb-6 tracking-[0.25em] flex items-center gap-3">
                                    <span className="w-2 h-2 rounded-full bg-blue-600"></span> Institutional Node Binding
                                </h4>
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block ml-1 tracking-widest">Magaca School-ka / School Name *</label>
                                            <input required type="text" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all shadow-inner" placeholder="E.g. ALWAXA SCHOOL" value={form.schoolName} onChange={e => setForm({ ...form, schoolName: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block ml-1 tracking-widest">Magaca Faraca / Branch Name *</label>
                                            <input required type="text" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all shadow-inner" placeholder="E.g. Primary" value={form.branchName} onChange={e => setForm({ ...form, branchName: e.target.value })} />
                                        </div>
                                    </div>
                                    {/* Institution Type Selector */}
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 mb-3 block ml-1 tracking-widest">Nooca Xarunta (Institution Type) *</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setForm({ ...form, institutionType: 'school' })}
                                                className={`flex flex-col items-center gap-2 py-5 px-4 rounded-2xl border-2 font-black text-[10px] uppercase tracking-widest transition-all duration-300 ${
                                                    form.institutionType === 'school'
                                                        ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-lg shadow-blue-500/10'
                                                        : 'border-slate-200 text-slate-400 hover:border-slate-300 bg-white'
                                                }`}
                                            >
                                                <span className="text-3xl">🏫</span>
                                                <span>Dugsi</span>
                                                <span className={`text-[8px] px-2 py-0.5 rounded-full font-bold ${
                                                    form.institutionType === 'school' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'
                                                }`}>School</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setForm({ ...form, institutionType: 'machad' })}
                                                className={`flex flex-col items-center gap-2 py-5 px-4 rounded-2xl border-2 font-black text-[10px] uppercase tracking-widest transition-all duration-300 ${
                                                    form.institutionType === 'machad'
                                                        ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-lg shadow-purple-500/10'
                                                        : 'border-slate-200 text-slate-400 hover:border-slate-300 bg-white'
                                                }`}
                                            >
                                                <span className="text-3xl">🎓</span>
                                                <span>Machadh</span>
                                                <span className={`text-[8px] px-2 py-0.5 rounded-full font-bold ${
                                                    form.institutionType === 'machad' ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-400'
                                                }`}>Institute / College</span>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100 flex items-center gap-6">
                                        <div className="w-24 h-24 bg-white rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden shadow-inner flex-shrink-0">
                                            {logoPreview ? <img src={logoPreview} alt="Preview" className="w-full h-full object-contain p-2" /> : <span className="text-slate-200 text-3xl">🖼️</span>}
                                            <input type="file" accept="image/*" className="hidden" id="logo-upload" onChange={handleLogoChange} />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 leading-relaxed">System-wide institutional brand asset. Maximum file size: 2MB.</p>
                                            <label htmlFor="logo-upload" className="inline-block bg-white hover:bg-slate-900 hover:text-white border border-slate-200 text-slate-900 px-6 py-3 rounded-[1.25rem] font-black text-[10px] uppercase tracking-widest cursor-pointer transition-all shadow-sm">
                                                Initialize Brand Asset
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Branches List (Only for Editing) */}
                            {editingAdmin && editingAdmin.SuperAdminSchools?.length > 0 && (
                                <div className="pt-8 border-t border-slate-100">
                                    <h4 className="text-[11px] font-black uppercase text-indigo-600 mb-6 tracking-[0.25em] flex items-center gap-3">
                                        <span className="w-2 h-2 rounded-full bg-indigo-600"></span> Managed Branches ({editingAdmin.SuperAdminSchools.length})
                                    </h4>
                                    <div className="grid grid-cols-1 gap-3">
                                        {editingAdmin.SuperAdminSchools.map((school, i) => (
                                            <div key={i} className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center justify-between group/school transition-all hover:border-indigo-200 hover:bg-white">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-white rounded-xl border border-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                        {school?.logo && typeof school.logo === 'string' ? (
                                                            <img src={getImageUrl(school.logo)} alt="" className="w-full h-full object-contain p-1" />
                                                        ) : (
                                                            <span className="text-xl">🏫</span>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="font-black text-slate-800 text-sm">{school.name}</div>
                                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Node</div>
                                                    </div>
                                                </div>
                                                <button 
                                                    type="button"
                                                    onClick={() => enterDashboard(editingAdmin)}
                                                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest opacity-0 group-hover/school:opacity-100 transition-all shadow-lg shadow-indigo-600/20"
                                                >
                                                    Launch
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-[9px] text-slate-400 font-bold mt-4 italic text-center">To manage individual branch details, launch the node portal.</p>
                                </div>
                            )}

                            <div className="pt-8 flex gap-5">
                                <button type="button" onClick={() => { setShowModal(false); setEditingAdmin(null) }} className="flex-1 bg-slate-50 text-slate-400 font-black py-5 rounded-[2rem] uppercase text-[10px] tracking-widest hover:bg-slate-100 transition-all border border-slate-100">Abort</button>
                                <button type="submit" disabled={saving} className="flex-[2] bg-slate-900 text-white font-black py-5 rounded-[2rem] shadow-2xl shadow-slate-900/20 hover:bg-black transition-all uppercase text-[10px] tracking-widest active:scale-95">
                                    {saving ? 'Syncing...' : (editingAdmin ? 'Update Protocols' : 'Provision Secure Entry')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
            `}</style>
        </Layout>
    )
}
