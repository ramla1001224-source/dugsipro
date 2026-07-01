import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'
import { useRouter } from 'next/router'
import { StatSkeleton, TableSkeleton, LoadingOverlay } from '../../components/DashboardSkeleton'

export default function ParentAttendance() {
    const [attendance, setAttendance] = useState([])
    const [child, setChild] = useState(null)
    const [loading, setLoading] = useState(true)
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [sessionFilter, setSessionFilter] = useState('')
    const router = useRouter()
    const { childId } = router.query
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const [children, setChildren] = useState([])
    const [years, setYears] = useState([])
    const [selectedYearId, setSelectedYearId] = useState('')

    const fetchChildren = async () => {
        try {
            const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
            const headers = { Authorization: `Bearer ${token}` }
            const res = await axios.get(`${apiUrl}/api/parents/my-children`, { headers })
            const childrenData = res.data?.data || (Array.isArray(res.data) ? res.data : [])
            setChildren(childrenData)
            
            if (!childId && childrenData.length > 0) {
                // If no childId in URL, default to first child
                setChild(childrenData[0])
            } else if (childId) {
                const currentChild = childrenData.find(c => c.id === childId)
                if (currentChild) setChild(currentChild)
            }
        } catch (err) {
            console.error('Error fetching children:', err)
        }
    }

    const fetchAttendanceHistory = async (cid) => {
        const idToUse = cid || childId
        if (!idToUse) return
        setLoading(true)
        try {
            const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
            if (!token) {
                router.push('/')
                return
            }

            const headers = { Authorization: `Bearer ${token}` }
            
            const params = new URLSearchParams()
            if (startDate) params.append('startDate', startDate)
            if (endDate) params.append('endDate', endDate)
            if (sessionFilter) params.append('session', sessionFilter)
            if (selectedYearId) params.append('academicYearId', selectedYearId)

            const res = await axios.get(`${apiUrl}/api/attendance/student/${idToUse}?${params.toString()}`, {
                headers
            })
            
            const rawData = res.data?.data || (Array.isArray(res.data) ? res.data : []);
            setAttendance(rawData)
        } catch (err) {
            console.error('Error fetching attendance history:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        // Default to last 30 days
        const lastMonth = new Date()
        lastMonth.setDate(lastMonth.getDate() - 30)
        setStartDate(lastMonth.toISOString().split('T')[0])
        setEndDate(new Date().toISOString().split('T')[0])
    }, [])

    useEffect(() => {
        if (router.isReady) {
            fetchChildren()
        }
    }, [router.isReady])

    useEffect(() => {
        const fetchYears = async () => {
            const idToUse = child?.id || childId
            if (!idToUse) return
            try {
                const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
                const res = await axios.get(`${apiUrl}/api/exams/student-history-years/${idToUse}`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
                setYears(res.data || [])
                if (res.data?.length > 0) {
                    const current = res.data.find(y => y.isCurrent) || res.data[0]
                    setSelectedYearId(current.id)
                }
            } catch (err) {
                console.error('Error fetching student years:', err)
            }
        }
        fetchYears()
    }, [child, childId])

    useEffect(() => {
        if (child?.id) {
            fetchAttendanceHistory(child.id)
        } else if (childId) {
            fetchAttendanceHistory(childId)
        }
    }, [child, childId, startDate, endDate, sessionFilter, selectedYearId])

    const getStatusStyle = (status) => {
        switch(status?.toLowerCase()) {
            case 'present': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
            case 'absent': return 'bg-rose-100 text-rose-700 border-rose-200'
            case 'late': return 'bg-amber-100 text-amber-700 border-amber-200'
            default: return 'bg-slate-100 text-slate-700 border-slate-200'
        }
    }

    const totalRecords = attendance.length
    const presentCount = attendance.filter(a => a.status === 'Present').length
    const absentCount = attendance.filter(a => a.status === 'Absent').length
    const lateCount = attendance.filter(a => a.status === 'Late').length

    return (
        <Layout title={`Attendance - ${child?.user?.name || 'Student'}`}>
            {loading && <LoadingOverlay />}
            
            <div className="mb-8 flex flex-col md:flex-row justify-between md:items-end gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">Taariikhda Imaanshaha</h2>
                    <p className="text-gray-400 font-bold text-xs uppercase tracking-[0.2em] mt-1">
                        Ardayga: <span className="text-indigo-600 underline font-black">{child?.user?.name || '...'}</span>
                    </p>
                </div>
                <button 
                    onClick={() => router.back()}
                    className="px-6 py-3 bg-white border border-gray-200 text-slate-600 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-gray-50 transition-all shadow-sm flex items-center gap-2 w-fit"
                >
                    - dib u noboq
                </button>
            </div>

            {selectedYearId && !years.find(y => y.id === selectedYearId)?.isCurrent && (
                <div className="bg-amber-600 px-8 py-3 rounded-2xl mb-8 flex items-center justify-between shadow-lg shadow-amber-100 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-3">
                        <span className="text-xl">ℹ️</span>
                        <p className="text-white text-xs font-bold uppercase tracking-widest">
                            Xogta imaanshaha sanadaha hore waa la kaydiyaa (archived). Kaliya <span className="underline decoration-white/30">{years.find(y => y.id === selectedYearId)?.name}</span> ayaan hadda la heli karin xogteeda imaanshaha.
                        </p>
                    </div>
                </div>
            )}

            {/* Child Selector if multiple */}
            {children.length > 1 && (
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 mb-8 flex items-center gap-6">
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest min-w-fit">Dooro Ardayga:</div>
                    <div className="flex flex-wrap gap-2">
                        {children.map(c => (
                            <button
                                key={c.id}
                                onClick={() => setChild(c)}
                                className={`px-4 py-2 rounded-xl text-xs font-black transition-all border ${child?.id === c.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-600/20' : 'bg-slate-50 text-slate-600 border-gray-100 hover:bg-gray-100'}`}
                            >
                                {c.user?.name || 'Student'}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Filters Area */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 mb-8 flex flex-wrap gap-6 items-end group hover:shadow-md transition-all">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Taariikhda Bilaawga</label>
                    <input 
                        type="date" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        min={`${new Date().getFullYear()}-01-01`}
                        max={`${new Date().getFullYear()}-12-31`}
                        className="w-full border border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 bg-slate-50/50 outline-none transition-all"
                    />
                </div>
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Taariikhda Dhamaadka</label>
                    <input 
                        type="date" 
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        min={`${new Date().getFullYear()}-01-01`}
                        max={`${new Date().getFullYear()}-12-31`}
                        className="w-full border border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 bg-slate-50/50 outline-none transition-all"
                    />
                </div>
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Sanad Dugsiyeedka (Year)</label>
                    <select 
                        value={selectedYearId}
                        onChange={(e) => setSelectedYearId(e.target.value)}
                        className="w-full border border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 bg-white outline-none transition-all appearance-none shadow-sm cursor-not-allowed bg-gray-50 opacity-70"
                        disabled
                    >
                        {years.map(y => (
                            <option key={y.id} value={y.id}>{y.name} {y.isCurrent ? '(Hadda)' : ''}</option>
                        ))}
                    </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Xilliga (Session)</label>
                    <select 
                        value={sessionFilter}
                        onChange={(e) => setSessionFilter(e.target.value)}
                        className="w-full border border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 bg-slate-50/50 outline-none transition-all appearance-none"
                    >
                        <option value="">Dhammaan Xilliyada</option>
                        <option value="Break 1">Break 1</option>
                        <option value="Break 2">Break 2</option>
                    </select>
                </div>
                <div className="w-full md:w-auto mt-2 md:mt-0">
                    <button 
                        onClick={() => { setStartDate(''); setEndDate(''); setSessionFilter(''); }}
                        className="w-full md:w-auto px-8 py-4 bg-slate-900 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-black transition-all shadow-xl shadow-slate-200 active:scale-95"
                    >
                        Nadiifi
                    </button>
                </div>
            </div>

            {/* Quick Stats Summary */}
            {loading ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <StatSkeleton /><StatSkeleton /><StatSkeleton /><StatSkeleton />
                </div>
            ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 text-center hover:scale-105 transition-transform">
                        <div className="text-3xl font-black text-slate-800">{totalRecords}</div>
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">Guud ahaan</div>
                    </div>
                    <div className="bg-emerald-50/50 p-6 rounded-[2rem] border border-emerald-100 text-center hover:scale-105 transition-transform">
                        <div className="text-3xl font-black text-emerald-600">{presentCount}</div>
                        <div className="text-[10px] font-black text-emerald-600/70 uppercase tracking-widest mt-2">Jooga</div>
                    </div>
                    <div className="bg-rose-50/50 p-6 rounded-[2rem] border border-rose-100 text-center hover:scale-105 transition-transform">
                        <div className="text-3xl font-black text-rose-600">{absentCount}</div>
                        <div className="text-[10px] font-black text-rose-600/70 uppercase tracking-widest mt-2">Ma Joogo</div>
                    </div>
                    <div className="bg-amber-50/50 p-6 rounded-[2rem] border border-amber-100 text-center hover:scale-105 transition-transform">
                        <div className="text-3xl font-black text-amber-600">{lateCount}</div>
                        <div className="text-[10px] font-black text-amber-600/70 uppercase tracking-widest mt-2">Soo Daahay</div>
                    </div>
                </div>
            )}

            {/* Attendance Table */}
            {loading ? <TableSkeleton /> : (
                <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden group hover:shadow-md transition-all">
                    <div className="px-8 py-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Diiwaanka Imaanshaha</h3>
                        <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse outline outline-4 outline-indigo-500/20"></div>
                    </div>
                    <div className="overflow-x-auto min-h-[400px]">
                        <table className="w-full text-left font-medium text-slate-600">
                            <thead className="bg-white text-gray-400 text-[9px] uppercase tracking-[0.2em] font-black border-b border-gray-50">
                                <tr>
                                    <th className="px-8 py-5">Taariikhda</th>
                                    <th className="px-8 py-5">Xilliga</th>
                                    <th className="px-8 py-5">Galinta</th>
                                    <th className="px-8 py-5 text-right">Xaaladda</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 text-xs font-bold">
                                {attendance.length > 0 ? (
                                    attendance.map((att) => (
                                        <tr key={att.id} className="hover:bg-indigo-50/30 transition-all group/row">
                                            <td className="px-8 py-5 text-slate-800 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover/row:bg-indigo-600 group-hover/row:text-white transition-all shadow-sm">
                                                        📅
                                                    </div>
                                                    {new Date(att.date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-indigo-600 font-black uppercase tracking-wider">
                                                {att.session}
                                            </td>
                                            <td className="px-8 py-5 text-indigo-400 font-black uppercase tracking-widest text-[10px]">
                                                {att.shift === 'morning' ? '☀️ Subax' : att.shift === 'afternoon' ? '🌅 Galab' : att.shift === 'night' ? '🌙 Habeen' : (att.shift || 'Default')}
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <span className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.15em] border shadow-sm ${getStatusStyle(att.status)}`}>
                                                    {att.status === 'Present' ? 'Jooga' : att.status === 'Absent' ? 'Ma Joogo' : att.status === 'Late' ? 'Soo Daahay' : att.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="4" className="px-8 py-20 text-center">
                                            <div className="mx-auto w-24 h-24 bg-slate-50 rounded-[2rem] flex items-center justify-center mb-6 opacity-40 grayscale animate-pulse">
                                                <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                                </svg>
                                            </div>
                                            <p className="text-gray-400 font-black text-sm uppercase tracking-widest italic opacity-60">Wax diiwaan ah lama helin.</p>
                                        </td>
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
