import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import axios from 'axios'
import { StatSkeleton, LoadingOverlay } from '../../components/DashboardSkeleton'

export default function AccountantDashboard() {
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const [announcements, setAnnouncements] = useState([])
    const [session, setSession] = useState('Break 1')
    const [shift, setShift] = useState('morning')
    const [details, setDetails] = useState([])
    const [showDetails, setShowDetails] = useState(false)
    const [detailsLoading, setDetailsLoading] = useState(false)
    const [selectedStatus, setSelectedStatus] = useState('')

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    const fetchDetails = async (status, isPayment = false) => {
        setSelectedStatus(status)
        setShowDetails(true)
        setDetailsLoading(true)
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
        try {
            const endpoint = isPayment ? 'payment-details' : 'attendance-details'
            const query = isPayment
                ? `status=${status}&shift=${shift}`
                : `status=${status}&session=${session}&shift=${shift}`
            const res = await axios.get(`${apiUrl}/api/dashboard/${endpoint}?${query}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            setDetails(res.data)
        } catch (e) {
            console.error('Fetch Details Error:', e?.response?.data || e.message)
        } finally {
            setDetailsLoading(false)
        }
    }

    const fetchStats = async (sess, sh) => {
        try {
            const res = await axios.get(`${apiUrl}/api/dashboard/accountant-stats?session=${sess}&shift=${sh}`, { headers: headers() })
            setStats(res.data || {})
        } catch (err) {
            console.error(err)
        }
    }

    useEffect(() => {
        const init = async () => {
            setLoading(true)
            await fetchStats(session, shift)
            setLoading(false)
        }
        init()
    }, [session, shift])

    const attendance = stats?.attendance || { present: 0, absent: 0, late: 0, unmarkedClasses: 0 }

    return (
        <Layout title="Accountant Dashboard">
            {loading && <LoadingOverlay />}
            <div className="space-y-6">

                {/* Header */}
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">Accountant Dashboard</h1>
                    <p className="text-gray-400 text-xs font-medium uppercase tracking-widest">Xogta Lacagaha iyo Imaanshaha</p>
                </div>

                {/* Session & Shift Selector */}
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
                                    {s}
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
                                    {sh}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Attendance Summary */}
                <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 ml-2">Attendance Summary</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                        <button onClick={() => fetchDetails('Present')} className="bg-emerald-600 p-6 rounded-[2rem] text-white flex items-center justify-between shadow-xl shadow-emerald-100 hover:scale-[1.02] transition-transform text-left">
                            <div>
                                <p className="text-emerald-200 text-[10px] font-black uppercase tracking-widest mb-1">Total Present Today</p>
                                <p className="text-3xl font-black">{loading ? '—' : attendance.present}</p>
                            </div>
                            <div className="text-3xl">✅</div>
                        </button>
                        <button onClick={() => fetchDetails('Absent')} className="bg-rose-600 p-6 rounded-[2rem] text-white flex items-center justify-between shadow-xl shadow-rose-100 hover:scale-[1.02] transition-transform text-left">
                            <div>
                                <p className="text-rose-200 text-[10px] font-black uppercase tracking-widest mb-1">Today Absent</p>
                                <p className="text-3xl font-black">{loading ? '—' : attendance.absent}</p>
                            </div>
                            <div className="text-3xl">❌</div>
                        </button>
                        <button onClick={() => fetchDetails('Late')} className="bg-amber-500 p-6 rounded-[2rem] text-white flex items-center justify-between shadow-xl shadow-amber-100 hover:scale-[1.02] transition-transform text-left">
                            <div>
                                <p className="text-amber-100 text-[10px] font-black uppercase tracking-widest mb-1">Today Late</p>
                                <p className="text-3xl font-black">{loading ? '—' : attendance.late}</p>
                            </div>
                            <div className="text-3xl">⏰</div>
                        </button>
                        <button onClick={() => fetchDetails('Pending')} className="bg-slate-400 p-6 rounded-[2rem] text-white flex items-center justify-between shadow-xl shadow-slate-100 hover:scale-[1.02] transition-transform text-left">
                            <div>
                                <p className="text-slate-100 text-[10px] font-black uppercase tracking-widest mb-1">Pending Classes</p>
                                <p className="text-3xl font-black">{loading ? '—' : attendance.unmarkedClasses}</p>
                            </div>
                            <div className="text-3xl opacity-50">➖</div>
                        </button>
                    </div>
                </div>

                {/* Fee Status */}
                <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 ml-2">
                        {new Date().toLocaleString('default', { month: 'long' })} Fee Status — <span className="text-blue-500">{shift.toUpperCase()}</span>
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
                        <button onClick={() => fetchDetails('paid', true)} className="bg-blue-600 p-8 rounded-[2rem] text-white flex items-center justify-between shadow-xl shadow-blue-100 hover:scale-[1.02] transition-transform text-left">
                            <div>
                                <p className="text-blue-200 text-[10px] font-black uppercase tracking-widest mb-1">Students Paid</p>
                                <p className="text-4xl font-black">{loading ? '—' : (stats?.paidStudents || 0)}</p>
                            </div>
                            <div className="text-4xl">💰</div>
                        </button>
                        <button onClick={() => fetchDetails('unpaid', true)} className="bg-slate-900 p-8 rounded-[2rem] text-white flex items-center justify-between shadow-xl shadow-slate-200 hover:scale-[1.02] transition-transform text-left">
                            <div>
                                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Students Unpaid</p>
                                <p className="text-4xl font-black">{loading ? '—' : (stats?.unpaidStudents || 0)}</p>
                            </div>
                            <div className="text-4xl">⏳</div>
                        </button>
                    </div>
                </div>

                {/* Revenue */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Link href="/accountant/payments" className="block">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-4 hover:shadow-md transition-shadow cursor-pointer w-full">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-full flex items-center justify-center bg-blue-100 text-blue-600">
                                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                                </div>
                                <div>
                                    <p className="text-gray-400 text-[10px] font-black uppercase tracking-wider">Collected Revenue</p>
                                    <p className="text-2xl font-black text-slate-800">${(stats?.monthlyRevenue || 0).toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                    </Link>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-4 w-full">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-full flex items-center justify-center bg-slate-900 text-white">
                                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                            </div>
                            <div>
                                <p className="text-gray-400 text-[10px] font-black uppercase tracking-wider">Expected Revenue</p>
                                <p className="text-2xl font-black text-slate-800">${(stats?.expectedRevenue || 0).toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* Details Modal */}
            {showDetails && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col border border-white/20 animate-in zoom-in-95 duration-300">
                        <div className={`p-8 ${selectedStatus === 'paid' ? 'bg-emerald-600' : selectedStatus === 'unpaid' ? 'bg-rose-600' : selectedStatus === 'Present' ? 'bg-emerald-600' : selectedStatus === 'Absent' ? 'bg-rose-600' : selectedStatus === 'Late' ? 'bg-amber-500' : 'bg-slate-700'} text-white flex justify-between items-center`}>
                            <div>
                                <h3 className="text-2xl font-black uppercase tracking-tight">
                                    {selectedStatus === 'paid' ? 'Ardayda Bixiyay Bishaan' : selectedStatus === 'unpaid' ? 'Ardayda Bixin Bishaan' : `Ardayda ${selectedStatus}`}
                                </h3>
                                <p className="text-white/70 text-xs font-bold uppercase tracking-widest mt-1">
                                    {details.length} record — {shift.toUpperCase()} Shift
                                </p>
                            </div>
                            <button onClick={() => setShowDetails(false)} className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors font-black">✕</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8">
                            {detailsLoading ? (
                                <div className="py-20 text-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900 mx-auto"></div></div>
                            ) : details.length > 0 ? (
                                <div className="grid grid-cols-1 gap-3">
                                    {details.map((s, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-5 rounded-3xl bg-slate-50 border border-slate-100 hover:bg-white hover:shadow-md hover:border-blue-100 transition-all group">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black ${selectedStatus === 'paid' || selectedStatus === 'Present' ? 'bg-emerald-100 text-emerald-600' : selectedStatus === 'unpaid' || selectedStatus === 'Absent' ? 'bg-rose-100 text-rose-600' : selectedStatus === 'Late' ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-600'}`}>
                                                    {s.name?.substring(0, 2).toUpperCase() || '??'}
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-800 uppercase tracking-tight">{s.name}</p>
                                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{s.student_id}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-[10px] font-black text-slate-500 uppercase tracking-widest shadow-sm">{s.class}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-20 text-center text-gray-400 font-bold uppercase tracking-widest">Ma jiraan xog</div>
                            )}
                        </div>
                        <div className="p-6 border-t border-gray-50 flex justify-end bg-gray-50/50">
                            <button onClick={() => setShowDetails(false)} className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-black transition-all shadow-xl shadow-gray-200">Xir</button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    )
}
