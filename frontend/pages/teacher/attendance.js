import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'

export default function TeacherAttendance() {
    const [classes, setClasses] = useState([])
    const [students, setStudents] = useState([])
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'

    // Parse shift field (CSV string or single) into array
    const parseShifts = (shift) => {
        if (!shift) return ['morning']
        if (Array.isArray(shift)) return shift
        return shift.split(',').map(s => s.trim()).filter(Boolean)
    }

    const SHIFT_LABELS = {
        morning:   { label: 'Morning (Subax)',   emoji: '🌅' },
        afternoon: { label: 'Afternoon (Galab)', emoji: '🌇' },
        night:     { label: 'Night (Habeen)',    emoji: '🌙' },
    }


    const [selectedClass, setSelectedClass] = useState('')
    const [session, setSession] = useState('Break 1')
    const [shift, setShift] = useState('morning')
    const [attendance, setAttendance] = useState({})

    const [activeTab, setActiveTab] = useState('mark')
    const [historyMonth, setHistoryMonth] = useState(new Date().getMonth() + 1)
    const [historyYear, setHistoryYear] = useState(new Date().getFullYear())
    const [activeYear, setActiveYear] = useState(null)
    const [historyData, setHistoryData] = useState({ students: [], matrix: {}, daysInMonth: 31 })

    useEffect(() => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
        Promise.all([
            axios.get(`${apiUrl}/api/classes`, { headers: { Authorization: `Bearer ${token}` } }),
            axios.get(`${apiUrl}/api/academic-years`, { headers: { Authorization: `Bearer ${token}` } })
        ]).then(([clsRes, ayRes]) => {
            setClasses(clsRes.data)
            const currentYear = ayRes.data.find(y => y.isCurrent)
            setActiveYear(currentYear)
            if (currentYear) {
                setHistoryYear(new Date().getFullYear())
            }
        }).catch(console.error)
    }, [])

    useEffect(() => {
        if (!activeYear) return
        const start = new Date(activeYear.startDate)
        const end = new Date(activeYear.endDate)
        if (historyMonth >= (start.getMonth() + 1) && historyMonth <= 12) {
            setHistoryYear(start.getFullYear())
        } else if (historyMonth >= 1 && historyMonth <= (end.getMonth() + 1)) {
            setHistoryYear(end.getFullYear())
        }
    }, [historyMonth, activeYear])

    const fetchAttendance = async () => {
        if (!selectedClass || !session) return
        setLoading(true)
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
        const today = new Date().toISOString().split('T')[0]
        try {
            const sRes = await axios.get(`${apiUrl}/api/students?classId=${selectedClass}&asOfDate=${today}`, { headers: { Authorization: `Bearer ${token}` } })
            const aRes = await axios.get(`${apiUrl}/api/attendance?classId=${selectedClass}&date=${today}&session=${session}&shift=${shift}`, { headers: { Authorization: `Bearer ${token}` } })

            const initial = {}
            sRes.data.forEach(s => {
                const existing = aRes.data.find(att => att.studentId === s.id)
                initial[s.id] = existing ? existing.status : null
            })
            setStudents(sRes.data)
            setAttendance(initial)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const fetchHistory = async () => {
        if (!selectedClass) return
        setLoading(true)
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
        try {
            const res = await axios.get(`${apiUrl}/api/attendance/monthly-register?classId=${selectedClass}&month=${historyMonth}&year=${historyYear}&asOfDate=${historyYear}-${String(historyMonth).padStart(2, '0')}-28`, { headers: { Authorization: `Bearer ${token}` } })
            const matrix = {}
            res.data.attendanceRecords?.forEach(rec => {
                const dateNum = new Date(rec.date).getDate()
                if (!matrix[rec.studentId]) matrix[rec.studentId] = {}
                matrix[rec.studentId][dateNum] = rec.status
            })
            const daysInMonth = new Date(historyYear, historyMonth, 0).getDate()
            setHistoryData({ students: res.data.students || [], matrix, daysInMonth })
        } catch (e) { console.error(e) }
        finally { setLoading(false) }
    }

    useEffect(() => {
        if (selectedClass && activeTab === 'mark') fetchAttendance()
        if (selectedClass && activeTab === 'history') fetchHistory()
    }, [selectedClass, session, shift, activeTab, historyMonth, historyYear])

    const mark = (studentId, status) => setAttendance(prev => ({ ...prev, [studentId]: status }))

    const saveAttendance = async () => {
        setSaving(true)
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
        try {
            const attendanceUpdates = Object.entries(attendance)
                .filter(([_, status]) => status !== null)
                .map(([studentId, status]) => ({ studentId, status }))

            if (attendanceUpdates.length === 0) {
                alert('No attendance marked to save.')
                setSaving(false)
                return
            }

            const payload = {
                classId: selectedClass,
                date: new Date().toISOString(),
                session,
                shift,
                attendance: attendanceUpdates
            }
            await axios.post(`${apiUrl}/api/attendance`, payload, { headers: { Authorization: `Bearer ${token}` } })
            alert('Attendance saved successfully!')
        } catch (e) {
            alert('Error saving attendance: ' + (e.response?.data?.message || e.message))
        } finally {
            setSaving(false)
        }
    }

    return (
        <Layout title="Attendance Management">
            {activeTab === 'history' && (
                <div className="bg-blue-600 px-8 py-3 rounded-2xl mb-6 flex items-center justify-between shadow-lg shadow-blue-100 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-3">
                        <span className="text-xl">ℹ️</span>
                        <p className="text-white text-xs font-bold uppercase tracking-widest">
                            Attendance history is archived annually. Only records for <span className="underline decoration-white/30">{activeYear?.name || 'the current session'}</span> are available.
                        </p>
                    </div>
                </div>
            )}

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">Attendance Record</h2>
                    <p className="text-gray-400 font-medium">Capture attendance or view historical monthly data</p>
                </div>

                <div className="flex bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
                    <button
                        onClick={() => setActiveTab('mark')}
                        className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'mark' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-gray-400 hover:text-slate-600'}`}
                    >
                        Mark Daily
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-gray-400 hover:text-slate-600'}`}
                    >
                        View History
                    </button>
                </div>
            </div>

            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 mb-8 flex flex-wrap gap-6 items-end">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1 tracking-widest">Select Class</label>
                    <select
                        className="w-full p-4 rounded-2xl border-none bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700"
                        value={selectedClass}
                        onChange={e => setSelectedClass(e.target.value)}
                    >
                        <option value="">-- Choose a class --</option>
                        {classes.filter(c => {
                            if (shift === 'all') return true;
                            if (c.Sections && c.Sections.length > 0) {
                                return c.Sections.some(s => parseShifts(s.shift).includes(shift));
                            }
                            return parseShifts(c.shift).includes(shift);
                        }).map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                    </select>
                </div>

                {activeTab === 'mark' ? (
                    <>
                        <div className="w-full md:w-48">
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1 tracking-widest">Shift</label>
                            <select
                                className="w-full p-4 rounded-2xl border-none bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700"
                                value={shift}
                                onChange={e => {
                                    const nextShift = e.target.value;
                                    setShift(nextShift); 
                                    if (nextShift === "all") return;
                                    const currentCls = classes.find(c => c.id === selectedClass);
                                    if (currentCls) {
                                        const hasShift = currentCls.Sections && currentCls.Sections.length > 0
                                            ? currentCls.Sections.some(s => parseShifts(s.shift).includes(nextShift))
                                            : parseShifts(currentCls.shift).includes(nextShift);
                                        if (!hasShift) {
                                            const firstInShift = classes.find(c => {
                                                if (c.Sections && c.Sections.length > 0) {
                                                    return c.Sections.some(s => parseShifts(s.shift).includes(nextShift));
                                                }
                                                return parseShifts(c.shift).includes(nextShift);
                                            });
                                            setSelectedClass(firstInShift ? firstInShift.id : '');
                                            if (!firstInShift) setStudents([]);
                                        }
                                    }
                                }}
                            >
                                <option value="morning">Morning (Subax) 🌅</option>
                                <option value="afternoon">Afternoon (Galab) 🌇</option>
                                <option value="night">Night (Habeen) 🌙</option>
                                <option value="all">Dhammaan (All)</option>
                            </select>
                        </div>

                        <div className="w-full md:w-48">
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1 tracking-widest">Session</label>
                            <select
                                className="w-full p-4 rounded-2xl border-none bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-blue-600"
                                value={session}
                                onChange={e => setSession(e.target.value)}
                            >
                                <option value="Break 1">Break 1</option>
                                <option value="Break 2">Break 2</option>
                            </select>
                        </div>

                        <button
                            onClick={saveAttendance}
                            disabled={saving || !selectedClass}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 text-white px-10 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-100 transition-all"
                        >
                            {saving ? 'Saving...' : 'Save Attendance'}
                        </button>
                    </>
                ) : (
                    <>
                        <div className="flex flex-col">
                            <label className="text-[10px] font-black uppercase text-gray-400 mb-2 ml-1 tracking-widest">Month</label>
                            <select className="bg-gray-50 border-none rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none" value={historyMonth} onChange={e => setHistoryMonth(Number(e.target.value))}>
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                    <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('default', { month: 'long' })}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col">
                            <label className="text-[10px] font-black uppercase text-gray-400 mb-2 ml-1 tracking-widest">Year</label>
                            <select 
                                className="bg-gray-50 border-none rounded-2xl px-6 py-4 font-bold text-slate-400 outline-none cursor-not-allowed opacity-60" 
                                value={historyYear} 
                                disabled
                            >
                                <option value={historyYear}>{historyYear}</option>
                            </select>
                        </div>
                    </>
                )}
            </div>

            {loading ? (
                <div className="text-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div></div>
            ) : activeTab === 'mark' ? (
                <>
                {classes.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-[2.5rem] border border-gray-50 max-w-2xl mx-auto shadow-sm">
                        <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        </div>
                        <h3 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tight">Fashallo Laguma Meelayn</h3>
                        <p className="text-gray-400 font-medium px-8">Wali looma meelayn fashallo ama maadooyin aad dhigto. Fadlan la xiriir maamulka (Admin) si laguugu xiriiriyo fasalladaada.</p>
                    </div>
                ) : selectedClass && students.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-[2.5rem] border border-gray-50">
                        <p className="text-gray-400 font-medium">No students found in this class.</p>
                    </div>
                ) : selectedClass && (
                    <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-50 overflow-hidden">
                        <div className="overflow-x-auto w-full">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase font-black tracking-widest">
                                        <th className="px-8 py-6">Student Information</th>
                                        <th className="px-8 py-6 text-center">Attendance Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {students.map(s => (
                                        <tr key={s.id} className="hover:bg-blue-50/30 transition-colors group">
                                            <td className="px-8 py-6">
                                                <div className="font-black text-slate-800 text-lg group-hover:text-blue-600 transition-colors uppercase">{s.user.name}</div>
                                                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">{s.student_id}</div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex justify-center items-center gap-3">
                                                    <button
                                                        onClick={() => mark(s.id, attendance[s.id] === 'Absent' ? 'Present' : (attendance[s.id] === 'Present' || attendance[s.id] === 'Late' ? null : 'Present'))}
                                                        className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${attendance[s.id] === 'Present' || attendance[s.id] === 'Late' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'bg-slate-50 text-slate-300 hover:bg-slate-100'}`}
                                                    >
                                                        Present
                                                    </button>
                                                    {(attendance[s.id] === 'Present' || attendance[s.id] === 'Late') && (
                                                        <button
                                                            onClick={() => mark(s.id, attendance[s.id] === 'Late' ? 'Present' : 'Late')}
                                                            className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${attendance[s.id] === 'Late' ? 'bg-amber-500 text-white shadow-lg shadow-amber-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}
                                                        >
                                                            Soo Daahay (Late)
                                                        </button>
                                                    )}
                                                    <div className="w-px h-6 bg-slate-100 mx-2"></div>
                                                    <button
                                                        onClick={() => mark(s.id, attendance[s.id] === 'Absent' ? null : 'Absent')}
                                                        className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${attendance[s.id] === 'Absent' ? 'bg-rose-600 text-white shadow-lg shadow-rose-100' : 'bg-slate-50 text-slate-300 hover:bg-slate-100'}`}
                                                    >
                                                        Absent
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                </>
            ) : (
                <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-50 overflow-hidden">
                    <div className="overflow-auto max-h-[600px] pb-4">
                        <div className="overflow-x-auto w-full">
                            <table className="w-full text-left min-w-max border-collapse">
                                <thead className="sticky top-0 z-20 shadow-sm">
                                    <tr className="bg-slate-100 text-slate-500 text-xs uppercase font-black tracking-widest border-b-2 border-slate-200">
                                        <th className="px-6 py-4 sticky left-0 top-0 bg-slate-100 z-30 border-r-2 border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Student Name</th>
                                        {Array.from({ length: historyData.daysInMonth }, (_, i) => i + 1).map(day => (
                                            <th key={day} className="px-1 py-4 text-center w-10 border-r border-slate-200 bg-slate-100 last:border-0">{day}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y-2 divide-slate-100">
                                    {historyData.students.length > 0 ? (
                                        historyData.students.map(s => (
                                            <tr key={s.id} className="hover:bg-blue-50/30 transition-colors group">
                                                <td className="px-6 py-3 sticky left-0 bg-white group-hover:bg-blue-50/30 z-10 border-r-2 border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                                    <div className="font-extrabold text-slate-700 text-sm uppercase whitespace-nowrap">{s.user.name}</div>
                                                </td>
                                                {Array.from({ length: historyData.daysInMonth }, (_, i) => i + 1).map(day => {
                                                    const status = historyData.matrix[s.id]?.[day]
                                                    return (
                                                        <td key={day} className="px-1 py-3 text-center border-r border-slate-100 last:border-0 hover:bg-slate-100 transition-colors cursor-default">
                                                            {status === 'Present' && <div className="w-6 h-6 mx-auto rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-xs shadow-sm shadow-emerald-100/50" title={`${s.user.name} - Present on ${day}`}>P</div>}
                                                            {status === 'Absent' && <div className="w-6 h-6 mx-auto rounded-md bg-red-100 text-red-700 flex items-center justify-center font-black text-xs shadow-sm shadow-red-100/50" title={`${s.user.name} - Absent on ${day}`}>A</div>}
                                                            {status === 'Late' && <div className="w-6 h-6 mx-auto rounded-md bg-amber-100 text-amber-700 flex items-center justify-center font-black text-xs shadow-sm shadow-amber-100/50" title={`${s.user.name} - Late on ${day}`}>L</div>}
                                                            {!status && <div className="w-6 h-6 mx-auto text-slate-200 font-bold">-</div>}
                                                        </td>
                                                    )
                                                })}
                                            </tr>
                                        ))
                                    ) : (
                                        <tr><td colSpan={historyData.daysInMonth + 1} className="text-center py-20 text-gray-400 font-medium">No students or attendance records found. Select a class and date to view history.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    )
}

