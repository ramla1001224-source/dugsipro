import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'
import { useRouter } from 'next/router'

export default function StudentAttendance() {
    const [attendance, setAttendance] = useState([])
    const [loading, setLoading] = useState(true)
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [sessionFilter, setSessionFilter] = useState('')
    const [years, setYears] = useState([])
    const [selectedYearId, setSelectedYearId] = useState('')
    const router = useRouter()
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'

    const fetchAttendance = async () => {
        setLoading(true)
        try {
            const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
            if (!token) { router.push('/'); return }

            // Role Guard: Only students can access this page
            try {
                const payload = JSON.parse(atob(token.split('.')[1]))
                if (payload.role !== 'student') {
                    const dashboards = { owner: '/owner/dashboard', super_admin: '/super-admin/dashboard', admin: '/admin/dashboard', teacher: '/teacher/dashboard', parent: '/parent/dashboard', accountant: '/accountant/dashboard', staff: '/staff/dashboard', librarian: '/librarian/dashboard' }
                    router.push(dashboards[payload.role] || '/')
                    return
                }
            } catch (e) { router.push('/'); return }

            const params = new URLSearchParams()
            if (startDate) params.append('startDate', startDate)
            if (endDate) params.append('endDate', endDate)
            if (sessionFilter) params.append('session', sessionFilter)
            if (selectedYearId) params.append('academicYearId', selectedYearId)

            const res = await axios.get(`${apiUrl}/api/attendance?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            
            // The API returns an array directly
            if (Array.isArray(res.data)) {
                setAttendance(res.data)
            } else {
                setAttendance([])
            }
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
        const init = async () => {
            const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
            if (!token) return

            try {
                const payload = JSON.parse(atob(token.split('.')[1]))
                const studentId = payload.id
                
                // Fetch available years for this student
                const yRes = await axios.get(`${apiUrl}/api/exams/student-history-years/${studentId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
                setYears(yRes.data || [])
                
                if (yRes.data?.length > 0) {
                    const current = yRes.data.find(y => y.isCurrent) || yRes.data[0]
                    setSelectedYearId(current.id)
                }
            } catch (err) {
                console.error('Error initializing attendance years:', err)
            }
        }
        init()
    }, [])

    useEffect(() => {
        fetchAttendance()
    }, [startDate, endDate, sessionFilter, selectedYearId])

    const getStatusStyle = (status) => {
        switch(status?.toLowerCase()) {
            case 'present': return 'bg-green-100 text-green-700'
            case 'absent': return 'bg-red-100 text-red-700'
            case 'late': return 'bg-yellow-100 text-yellow-700'
            case 'excused': return 'bg-blue-100 text-blue-700'
            default: return 'bg-gray-100 text-gray-700'
        }
    }

    // Calculate quick stats
    const totalRecords = attendance.length
    const presentCount = attendance.filter(a => a.status === 'Present').length
    const absentCount = attendance.filter(a => a.status === 'Absent').length
    const lateCount = attendance.filter(a => a.status === 'Late').length

    return (
        <Layout title="My Attendance History">
            <div className="mb-8 flex flex-col md:flex-row justify-between md:items-end gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">Attendance History</h2>
                    <p className="text-gray-400 font-medium text-sm uppercase tracking-widest mt-1">Review your daily attendance records</p>
                </div>
            </div>

            {selectedYearId && years.length > 0 && !years.find(y => y.id === selectedYearId)?.isCurrent && (
                <div className="bg-amber-600 px-8 py-3 rounded-2xl mb-8 flex items-center justify-between shadow-lg shadow-amber-100 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-3">
                        <span className="text-xl">ℹ️</span>
                        <p className="text-white text-xs font-bold uppercase tracking-widest">
                            Attendance logs are archived annually. Records for <span className="underline decoration-white/30">{years.find(y => y.id === selectedYearId)?.name || 'archived year'}</span> are no longer accessible for viewing.
                        </p>
                    </div>
                </div>
            )}

            {/* Filters Area */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-8 flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[150px]">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Start Date</label>
                    <input 
                        type="date" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        min={`${new Date().getFullYear()}-01-01`}
                        max={`${new Date().getFullYear()}-12-31`}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50/50"
                    />
                </div>
                <div className="flex-1 min-w-[150px]">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">End Date</label>
                    <input 
                        type="date" 
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        min={`${new Date().getFullYear()}-01-01`}
                        max={`${new Date().getFullYear()}-12-31`}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50/50"
                    />
                </div>
                <div className="flex-1 min-w-[150px]">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Academic Year</label>
                    <select 
                        value={selectedYearId}
                        onChange={(e) => setSelectedYearId(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 shadow-sm cursor-not-allowed opacity-70"
                        disabled
                    >
                        {years.map(y => (
                            <option key={y.id} value={y.id}>
                                {y.name} {y.isCurrent ? '(Current)' : ''}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex-1 min-w-[150px]">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Session</label>
                    <select 
                        value={sessionFilter}
                        onChange={(e) => setSessionFilter(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50/50"
                    >
                        <option value="">All Sessions</option>
                        <option value="Break 1">Break 1</option>
                        <option value="Break 2">Break 2</option>
                    </select>
                </div>
                <div className="w-full md:w-auto mt-2 md:mt-0">
                    <button 
                        onClick={() => { setStartDate(''); setEndDate(''); setSessionFilter(''); setSelectedYearId(years.find(y => y.isCurrent)?.id || ''); }}
                        className="w-full md:w-auto px-6 py-3 bg-gray-100 text-gray-600 font-bold text-sm rounded-xl hover:bg-gray-200 transition-colors"
                    >
                        Clear Filters
                    </button>
                </div>
            </div>

            {/* Quick Stats Summary */}
            {!loading && attendance.length > 0 && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 text-center">
                        <div className="text-3xl font-black text-slate-800">{totalRecords}</div>
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Total Records</div>
                    </div>
                    <div className="bg-green-50 p-5 rounded-2xl border border-green-100 text-center">
                        <div className="text-3xl font-black text-green-600">{presentCount}</div>
                        <div className="text-xs font-bold text-green-600/70 uppercase tracking-widest mt-1">Present</div>
                    </div>
                    <div className="bg-red-50 p-5 rounded-2xl border border-red-100 text-center">
                        <div className="text-3xl font-black text-red-600">{absentCount}</div>
                        <div className="text-xs font-bold text-red-600/70 uppercase tracking-widest mt-1">Absent</div>
                    </div>
                    <div className="bg-yellow-50 p-5 rounded-2xl border border-yellow-100 text-center">
                        <div className="text-3xl font-black text-yellow-600">{lateCount}</div>
                        <div className="text-xs font-bold text-yellow-600/70 uppercase tracking-widest mt-1">Late</div>
                    </div>
                </div>
            )}

            {/* Attendance Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left font-medium text-slate-600">
                        <thead className="bg-gray-50 text-gray-400 text-[10px] uppercase tracking-[0.2em] font-bold">
                            <tr>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Session</th>
                                <th className="px-6 py-4">Shift</th>
                                <th className="px-6 py-4">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {loading ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center">
                                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                        <p className="mt-4 text-gray-400 font-medium text-sm">Loading attendance...</p>
                                    </td>
                                </tr>
                            ) : attendance.length > 0 ? (
                                attendance.map((att) => (
                                    <tr key={att.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 font-semibold text-slate-700 whitespace-nowrap">
                                            {new Date(att.date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                                        </td>
                                        <td className="px-6 py-4 text-xs font-bold text-indigo-600 uppercase tracking-wider">
                                            {att.session}
                                        </td>
                                        <td className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">
                                            {att.shift === 'morning' ? '☀️ Subax' : att.shift === 'afternoon' ? '🌅 Galab' : att.shift === 'night' ? '🌙 Habeen' : (att.shift || '-')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${getStatusStyle(att.status)}`}>
                                                {att.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="4" className="px-6 py-16 text-center">
                                        <div className="mx-auto w-16 h-16 bg-gray-50 object-cover rounded-full flex items-center justify-center mb-4">
                                            <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                            </svg>
                                        </div>
                                        <p className="text-gray-400 font-medium text-sm">No attendance records found for the selected dates.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </Layout>
    )
}
