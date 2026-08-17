import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import axios from 'axios'

export default function AccountantAttendance() {
    const [classes, setClasses] = useState([])
    const [students, setStudents] = useState([])
    const [selectedClass, setSelectedClass] = useState('')
    const [sections, setSections] = useState([])
    const [selectedSection, setSelectedSection] = useState('')
    const [date, setDate] = useState(new Date().toISOString().substring(0, 10))
    const [session, setSession] = useState('Break 1')
    const [shift, setShift] = useState('morning')
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [statusFilter, setStatusFilter] = useState('')
    const router = useRouter()

    const [activeTab, setActiveTab] = useState('mark')
    const [historyMonth, setHistoryMonth] = useState(new Date().getMonth() + 1)
    const [historyYear, setHistoryYear] = useState(new Date().getFullYear())
    const [activeYear, setActiveYear] = useState(null)
    const [historyData, setHistoryData] = useState({ students: [], matrix: {}, daysInMonth: 31 })

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

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

    // Compute available shifts based on selected section (or all sections in class)
    const getAvailableShifts = () => {
        const cls = classes.find(c => c.id === selectedClass)
        if (!cls) return ['morning', 'afternoon', 'night']
        const sections = cls.Sections || []
        if (selectedSection) {
            const sec = sections.find(s => s.id === selectedSection)
            return sec ? parseShifts(sec.shift) : ['morning']
        }
        // Union of all shifts across all sections in the class
        const all = new Set()
        sections.forEach(s => parseShifts(s.shift).forEach(sh => all.add(sh)))
        return all.size > 0 ? [...all] : ['morning']
    }

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [clsRes, ayRes] = await Promise.all([
                    axios.get(`${apiUrl}/api/classes`, { headers: headers() }),
                    axios.get(`${apiUrl}/api/academic-years`, { headers: headers() })
                ])
                setClasses(clsRes.data)
                
                const currentYear = ayRes.data.find(y => y.isCurrent)
                setActiveYear(currentYear)
                
                if (currentYear) {
                    setHistoryYear(new Date().getFullYear())
                }

                if (clsRes.data.length > 0) {
                    const firstClass = clsRes.data[0];
                    setSelectedClass(firstClass.id)
                    const firstShift = parseShifts(firstClass.Sections?.[0]?.shift || 'morning')[0]
                    setShift(firstShift)
                }
            } catch (err) { console.error(err) }
        }
        fetchInitialData()
    }, [])

    // When section changes, auto-reset shift to first available for that section
    useEffect(() => {
        const cls = classes.find(c => c.id === selectedClass)
        if (!cls) return
        const available = getAvailableShifts()
        if (!available.includes(shift)) {
            setShift(available[0] || 'morning')
        }
    }, [selectedClass, selectedSection, classes])


    useEffect(() => {
        if (router.query.status) {
            setStatusFilter(router.query.status)
        }
    }, [router.query])

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

    useEffect(() => {
        if (selectedClass) {
            axios.get(`${apiUrl}/api/sections?classId=${selectedClass}`, { headers: headers() })
                .then(res => {
                    setSections(res.data)
                    if (res.data.length > 0) setSelectedSection(res.data[0].id)
                    else setSelectedSection('')
                })
                .catch(err => console.error(err))
        } else {
            setSections([])
            setSelectedSection('')
        }
    }, [selectedClass])

    const fetchStudents = async () => {
        if (!selectedClass || !date || !session) return
        setLoading(true)
        try {
            const sectionParam = selectedSection ? `&sectionId=${selectedSection}` : ''
            const sRes = await axios.get(`${apiUrl}/api/students?classId=${selectedClass}${sectionParam}`, { headers: headers() })
            const aRes = await axios.get(`${apiUrl}/api/attendance?classId=${selectedClass}${sectionParam}&date=${date}&session=${session}&shift=${shift}`, { headers: headers() })

            setStudents(sRes.data.map(s => {
                const existing = aRes.data.find(a => a.studentId === s.id)
                return { ...s, status: existing ? existing.status : 'Present' }
            }))
        } catch (err) { console.error(err) }
        finally { setLoading(false) }
    }

    const fetchHistory = async () => {
        if (!selectedClass) return
        setLoading(true)
        try {
            const sectionParam = selectedSection ? `&sectionId=${selectedSection}` : ''
            const res = await axios.get(`${apiUrl}/api/attendance/monthly-register?classId=${selectedClass}${sectionParam}&month=${historyMonth}&year=${historyYear}`, { headers: headers() })
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
        if (activeTab === 'mark') fetchStudents() 
    }, [selectedClass, selectedSection, date, session, shift, activeTab])

    useEffect(() => { 
        if (activeTab === 'history') fetchHistory() 
    }, [selectedClass, selectedSection, historyMonth, historyYear, activeTab])

    const handleStatusChange = (studentId, status) => {
        setStudents(students.map(s => s.id === studentId ? { ...s, status } : s))
    }

    const saveAttendance = async () => {
        setSaving(true)
        try {
            const payload = {
                classId: selectedClass,
                date,
                session,
                shift,
                attendance: students.map(s => ({ studentId: s.id, status: s.status }))
            }
            await axios.post(`${apiUrl}/api/attendance`, payload, { headers: headers() })
            alert('Attendance saved successfully!')
        } catch (err) {
            alert('Error saving attendance')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Layout title="Student Attendance">
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
                    <p className="text-gray-400 font-medium">Daily presence tracking and monthly history</p>
                </div>

                <div className="flex bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
                    <button
                        onClick={() => setActiveTab('mark')}
                        className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'mark' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-gray-400 hover:text-slate-600'}`}
                    >
                        Daily Mark
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-gray-400 hover:text-slate-600'}`}
                    >
                        View History
                    </button>
                </div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-wrap gap-6 items-end mb-10">
                <div className="flex flex-col">
                    <label className="text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">Select Class</label>
                    <select
                        className="bg-gray-50 border-none rounded-2xl px-5 py-3 font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                        value={selectedClass}
                        onChange={(e) => {
                            setSelectedClass(e.target.value)
                            setSelectedSection('')
                        }}
                    >
                        {classes.filter(c => c.Sections && c.Sections.some(s => parseShifts(s.shift).includes(shift))).map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                    </select>
                </div>

                {sections.length > 0 && (
                    <div className="flex flex-col">
                        <label className="text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">Select Section</label>
                        <select
                            className="bg-gray-50 border-none rounded-2xl px-5 py-3 font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                            value={selectedSection}
                            onChange={(e) => setSelectedSection(e.target.value)}
                        >
                            <option value="">All</option>
                            {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                )}

                {activeTab === 'mark' ? (
                    <>
                        <div className="flex flex-col">
                            <label className="text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">Select Date</label>
                            <input
                                type="date"
                                className="bg-gray-50 border-none rounded-2xl px-5 py-3 font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                            />
                        </div>

                        <div className="flex flex-col">
                            <label className="text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">Select Shift</label>
                            <select
                                className="bg-gray-50 border-none rounded-2xl px-5 py-3 font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                                value={shift}
                                onChange={(e) => {
                                    const nextShift = e.target.value;
                                    setShift(nextShift);
                                    // Reset class if it doesn't match new shift
                                    const currentCls = classes.find(c => c.id === selectedClass);
                                    if (currentCls && currentCls.Sections && !currentCls.Sections.some(s => parseShifts(s.shift).includes(nextShift))) {
                                        const firstInShift = classes.find(c => c.Sections && c.Sections.some(s => parseShifts(s.shift).includes(nextShift)));
                                        setSelectedClass(firstInShift ? firstInShift.id : '');
                                        setSelectedSection('');
                                        if (!firstInShift) setStudents([]);
                                    }
                                }}
                            >
                                <option value="morning">Morning (Subax) 🌅</option>
                                <option value="afternoon">Afternoon (Galab) 🌇</option>
                                <option value="night">Night (Habeen) 🌙</option>
                            </select>
                        </div>

                        <div className="flex flex-col">
                            <label className="text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">Select Session</label>
                            <select
                                className="bg-gray-50 border-none rounded-2xl px-5 py-3 font-bold text-blue-600 focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                                value={session}
                                onChange={(e) => setSession(e.target.value)}
                            >
                                <option value="Break 1">Break 1</option>
                                <option value="Break 2">Break 2</option>
                            </select>
                        </div>

                        <div className="flex flex-col">
                            <label className="text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">Filter Status</label>
                            <select
                                className="bg-gray-50 border-none rounded-2xl px-5 py-3 font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option value="">All Students</option>
                                <option value="Present">Present Only</option>
                                <option value="Absent">Absent Only</option>
                                <option value="Late">Late Only</option>
                            </select>
                        </div>

                        <button
                            onClick={saveAttendance}
                            disabled={saving || students.length === 0}
                            className={`px-8 py-3.5 rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-lg ml-auto ${saving ? 'bg-gray-200 text-gray-400' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100'}`}
                        >
                            {saving ? 'Saving...' : 'Save All'}
                        </button>
                    </>
                ) : (
                    <>
                        <div className="flex flex-col">
                            <label className="text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">Month</label>
                            <select className="bg-gray-50 border-none rounded-2xl px-5 py-3 font-bold text-slate-700 outline-none" value={historyMonth} onChange={e => setHistoryMonth(Number(e.target.value))}>
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                    <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('default', { month: 'long' })}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col">
                            <label className="text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">Year</label>
                            <select 
                                className="bg-gray-50 border-none rounded-2xl px-5 py-3 font-bold text-slate-400 outline-none cursor-not-allowed opacity-60" 
                                value={historyYear} 
                                disabled
                            >
                                <option value={historyYear}>{historyYear}</option>
                            </select>
                        </div>
                    </>
                )}
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-50 overflow-hidden">
                {activeTab === 'mark' ? (
                <div className="overflow-x-auto w-full">
<table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-50/50 text-slate-400 text-[10px] uppercase font-black tracking-[0.2em]">
                            <th className="px-8 py-6">Student</th>
                            <th className="px-8 py-6">Student ID</th>
                            <th className="px-8 py-6 text-center">Status Participation</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {loading ? (
                            <tr><td colSpan="3" className="text-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div></td></tr>
                        ) : students.length > 0 ? (
                            students
                                .filter(s => !statusFilter || s.status === statusFilter)
                                .map(student => (
                                    <tr key={student.id} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className="px-8 py-6">
                                            <div className="font-black text-slate-800 text-lg group-hover:text-blue-600 transition-colors uppercase">{student.user?.name}</div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">{student.student_id}</span>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex justify-center gap-2">
                                                {['Present', 'Absent', 'Late'].map(s => (
                                                    <button
                                                        key={s}
                                                        onClick={() => handleStatusChange(student.id, s)}
                                                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${student.status === s ?
                                                            s === 'Present' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' :
                                                                s === 'Absent' ? 'bg-rose-600 text-white shadow-lg shadow-rose-100' :
                                                                    'bg-amber-500 text-white shadow-lg shadow-amber-100'
                                                            : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                                                    >
                                                        {s}
                                                    </button>
                                                ))}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                        ) : (
                            <tr><td colSpan="3" className="text-center py-20 text-gray-400 font-medium tracking-wide italic">Arday looma helin fasalkan.</td></tr>
                        )}
                    </tbody>
                </table>
</div>
                ) : (
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
                                    {loading ? (
                                        <tr><td colSpan={historyData.daysInMonth + 1} className="text-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div></td></tr>
                                    ) : historyData.students.length > 0 ? (
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
                                        <tr><td colSpan={historyData.daysInMonth + 1} className="text-center py-20 text-gray-400 font-medium">No students or attendance records found. Select parameters to search.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    )
}

