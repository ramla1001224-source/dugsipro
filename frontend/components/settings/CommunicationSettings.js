import { useEffect, useState } from 'react'
import axios from 'axios'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function CommunicationSettings() {
    const [smsStatus, setSmsStatus] = useState(null)
    const [usageHistory, setUsageHistory] = useState([])
    const [loading, setLoading] = useState(true)
    const [historyLoading, setHistoryLoading] = useState(true)

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    useEffect(() => {
        fetchSmsStatus()
        fetchUsageHistory()
    }, [])

    const fetchSmsStatus = async () => {
        setLoading(true)
        try {
            const res = await axios.get(`${apiUrl}/api/sms/settings`, { headers: headers() })
            setSmsStatus(res.data)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const fetchUsageHistory = async () => {
        setHistoryLoading(true)
        try {
            const res = await axios.get(`${apiUrl}/api/sms/usage-history`, { headers: headers() })
            setUsageHistory(res.data)
        } catch (e) {
            console.error(e)
        } finally {
            setHistoryLoading(false)
        }
    }

    const maxCount = Math.max(...usageHistory.map(h => h.count), 1)

    return (
        <div className="max-w-3xl mx-auto pb-24" style={{ fontFamily: "'Inter', sans-serif" }}>

            {/* Header */}
            <div className="mb-10">
                <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl">📡</span>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">SMS Notifications</h2>
                </div>
                <p className="text-gray-400 font-semibold uppercase tracking-widest text-[10px] ml-12">
                    Real-time usage statistics — Managed by System Owner
                </p>
            </div>

            {/* SMS Access Status Banner */}
            {loading ? (
                <div className="animate-pulse bg-slate-100 rounded-[2rem] h-40 mb-6" />
            ) : (
                <div
                    className="rounded-[2rem] p-8 mb-6 border-2 relative overflow-hidden"
                    style={{
                        borderColor: smsStatus?.isActive ? '#6366f120' : '#e2e8f0',
                        background: smsStatus?.isActive
                            ? 'linear-gradient(135deg, #6366f108, #4f46e508)'
                            : '#f8fafc'
                    }}
                >
                    {smsStatus?.isActive && (
                        <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-100 rounded-full -mr-16 -mt-16 opacity-30" />
                    )}
                    <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                        <div className="flex items-center gap-5">
                            <div
                                className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-md"
                                style={{ background: smsStatus?.isActive ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : '#e2e8f0' }}
                            >
                                {smsStatus?.isActive ? '🔓' : '🔒'}
                            </div>
                            <div>
                                <div
                                    className="text-xl font-black mb-1"
                                    style={{ color: smsStatus?.isActive ? '#4f46e5' : '#94a3b8' }}
                                >
                                    {smsStatus?.isActive ? 'SMS Active & Authorized' : 'SMS Restricted'}
                                </div>
                                <div className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">
                                    {smsStatus?.isActive
                                        ? 'Farriimaha waa la diri karaa — Owner wuu ogolaaday'
                                        : 'SMS-ka admin-ka system-ka (Owner) waa u xidaa — xiriir la galo'}
                                </div>
                            </div>
                        </div>

                        {/* Read-only badge */}
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                            <div className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl bg-slate-100 text-slate-400">
                                🔒 Read Only
                            </div>
                            <div className="text-[10px] text-slate-400 font-bold">
                                Credentials: Managed by Owner
                            </div>
                        </div>
                    </div>

                    {/* This month counter */}
                    <div className="mt-6 pt-6 border-t" style={{ borderColor: smsStatus?.isActive ? '#6366f115' : '#e2e8f0' }}>
                        <div className="flex items-end gap-6">
                            <div>
                                <div className="text-4xl font-black" style={{ color: smsStatus?.isActive ? '#4f46e5' : '#94a3b8' }}>
                                    {smsStatus?.monthlyCount ?? 0}
                                </div>
                                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">
                                    SMS Sent This Month
                                </div>
                            </div>
                            <div className="text-[11px] text-gray-400 font-medium pb-1">
                                Ujeeddada: Attendance alerts, fee reminders & exam results
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {[
                    { icon: '📊', title: 'Fee Reminders', desc: 'Waalidiinta biilasha la waayay ogeysiis waa la diri karaa', color: '#6366f1' },
                    { icon: '📅', title: 'Attendance Alerts', desc: 'Markay ardaydu tagnaato fasalka ogeysiis si toos ah', color: '#f59e0b' },
                    { icon: '📝', title: 'Exam Results', desc: 'Natiijada imtixaanada si toos ah waalidiinta', color: '#10b981' }
                ].map((item, i) => (
                    <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 flex gap-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: `${item.color}15` }}>
                            {item.icon}
                        </div>
                        <div>
                            <div className="font-black text-sm text-slate-800 mb-1">{item.title}</div>
                            <div className="text-[11px] text-gray-400 font-medium leading-relaxed">{item.desc}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Monthly Usage History Chart */}
            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-8 mb-6">
                <h4 className="font-black text-slate-800 text-base mb-1">📈 Monthly SMS Usage History</h4>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-8">
                    Farriimaha la diray — 6 bilood ee la soo dhaafay
                </p>

                {historyLoading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="animate-pulse bg-slate-50 rounded-xl h-12" />
                        ))}
                    </div>
                ) : usageHistory.length === 0 ? (
                    <div className="text-center py-12 text-slate-300">
                        <div className="text-4xl mb-3">📭</div>
                        <div className="text-sm font-bold text-slate-400">Wali SMS la ma dirin</div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {usageHistory.slice(0, 6).map((item, i) => {
                            const pct = Math.round((item.count / maxCount) * 100)
                            const isCurrentMonth = i === 0
                            return (
                                <div key={i} className="flex items-center gap-4">
                                    <div className="w-16 text-[11px] font-black text-slate-500 text-right flex-shrink-0">
                                        {MONTHS[item.month - 1]} {item.year}
                                    </div>
                                    <div className="flex-1 bg-slate-50 rounded-xl overflow-hidden h-9 relative">
                                        <div
                                            className="h-full rounded-xl transition-all duration-700 flex items-center px-4"
                                            style={{
                                                width: `${Math.max(pct, 4)}%`,
                                                background: isCurrentMonth
                                                    ? 'linear-gradient(90deg, #6366f1, #4f46e5)'
                                                    : 'linear-gradient(90deg, #e2e8f0, #cbd5e1)'
                                            }}
                                        >
                                            {pct > 20 && (
                                                <span className="text-[10px] font-black text-white">{item.count}</span>
                                            )}
                                        </div>
                                        {pct <= 20 && (
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-500">{item.count}</span>
                                        )}
                                    </div>
                                    {isCurrentMonth && (
                                        <div className="text-[9px] font-black text-indigo-500 uppercase tracking-widest flex-shrink-0">Current</div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Owner control info */}
            <div className="bg-blue-50/60 border border-blue-100 p-6 rounded-[2rem] flex gap-4">
                <div className="text-2xl flex-shrink-0">🛡️</div>
                <div>
                    <h4 className="text-sm font-black text-blue-900 uppercase tracking-tight mb-1">System Owner Control</h4>
                    <p className="text-xs text-blue-700 font-medium leading-relaxed">
                        SMS gateway credentials (API URL iyo API Key) waxaa gelin kara System Owner kaliya.
                        Dugsigu waa inuu xiriira Super Admin-kiisa ama System Owner-ka hadduu SMS-ka u baahan yahay.
                        Security iyo privacy-ga xogta sababo u ah, school admin-yadu ma arki karaan credentials-ka.
                    </p>
                </div>
            </div>
        </div>
    )
}
