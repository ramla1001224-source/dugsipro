import Layout from '../../components/Layout'
import { useState, useEffect } from 'react'
import axios from 'axios'

export default function Attendance() {
    const [classes, setClasses] = useState([])
    const [students, setStudents] = useState([])
    const [selectedClass, setSelectedClass] = useState('')
    const [selectedSection, setSelectedSection] = useState('')
    const [date, setDate] = useState(new Date().toISOString().substring(0, 10))
    const [session, setSession] = useState('Break 1')
    const [shift, setShift] = useState('morning')
    const [attendance, setAttendance] = useState({})
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)

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
                    const now = new Date()
                    setHistoryYear(now.getFullYear())
                }

                if (clsRes.data.length > 0) {
                    const firstClass = clsRes.data[0];
                    setSelectedClass(firstClass.id)
                    // Parse CSV shift and use first available
                    const firstShift = parseShifts(firstClass.Sections?.[0]?.shift || 'morning')[0]
                    setShift(firstShift)
                }
            } catch (e) { console.error(e) }
        }
        fetchInitialData()
    }, [])

    useEffect(() => {
        if (!activeYear) return
        // Set initial year based on active academic year's date range
        const now = new Date()
        setHistoryYear(now.getFullYear())
    }, [activeYear])

    // When section changes, auto-reset shift to first available for that section
    useEffect(() => {
        const cls = classes.find(c => c.id === selectedClass)
        if (!cls) return
        const available = getAvailableShifts()
        if (!available.includes(shift)) {
            setShift(available[0] || 'morning')
        }
    }, [selectedClass, selectedSection, classes])

    const fetchAttendance = async () => {
        if (!selectedClass || !date || !session) return
        setLoading(true)
        try {
            const sectionParam = selectedSection ? `&sectionId=${selectedSection}` : ''
            const sRes = await axios.get(`${apiUrl}/api/students?classId=${selectedClass}${sectionParam}&asOfDate=${date}`, { headers: headers() })
            const aRes = await axios.get(`${apiUrl}/api/attendance?classId=${selectedClass}${sectionParam}&date=${date}&session=${session}&shift=${shift}`, { headers: headers() })

            const initial = {}
            sRes.data.forEach(s => {
                const existing = aRes.data.find(att => att.studentId === s.id)
                initial[s.id] = existing ? existing.status : null
            })
            setStudents(sRes.data)
            setAttendance(initial)
        } catch (e) { console.error(e) }
        finally { setLoading(false) }
    }

    const fetchHistory = async () => {
        if (!selectedClass) return
        setLoading(true)
        try {
            const sectionParam = selectedSection ? `&sectionId=${selectedSection}` : ''
            // Use last day of selected month so all enrolled students are included
            const lastDay = new Date(historyYear, historyMonth, 0).getDate()
            const res = await axios.get(`${apiUrl}/api/attendance/monthly-register?classId=${selectedClass}${sectionParam}&month=${historyMonth}&year=${historyYear}`, { headers: headers() })
            const matrix = {}
            res.data.attendanceRecords.forEach(rec => {
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
        if (activeTab === 'mark') fetchAttendance()
    }, [selectedClass, selectedSection, date, session, shift, activeTab])

    useEffect(() => {
        if (activeTab === 'history') fetchHistory()
    }, [selectedClass, selectedSection, historyMonth, historyYear, activeTab])

    const mark = (studentId, status) => setAttendance(prev => ({ ...prev, [studentId]: status }))

    const markAllPresent = () => {
        const updates = {}
        students.forEach(s => {
            if (!attendance[s.id]) updates[s.id] = 'Present'
        })
        setAttendance(prev => ({ ...prev, ...updates }))
    }

    const saveAttendance = async () => {
        setSaving(true)
        try {
            const attendanceUpdates = Object.entries(attendance)
                .filter(([_, status]) => status !== null)
                .map(([studentId, status]) => ({ studentId, status, sectionId: students.find(s => s.id === studentId)?.sectionId }))

            if (attendanceUpdates.length === 0) {
                alert('No attendance marked to save.')
                setSaving(false)
                return
            }

            const payload = {
                classId: selectedClass,
                sectionId: selectedSection || null,
                date,
                session,
                shift,
                attendance: attendanceUpdates
            }
            await axios.post(`${apiUrl}/api/attendance`, payload, { headers: headers() })
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
                    <div className="flex items-center gap-2 mb-2">
                        <button 
                            onClick={() => window.location.href = '/admin/students'}
                            className="text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-1 font-bold text-xs uppercase tracking-widest"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            Hub
                        </button>
                        <span className="text-slate-300">/</span>
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Attendance</span>
                    </div>
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

            {/* Common Class Filter for both tabs */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-wrap gap-4 items-end mb-8">
                <div className="flex flex-col">
                    <label className="text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">Class</label>
                    <select 
                        className="bg-gray-50 border-none rounded-2xl px-5 py-3 font-bold text-slate-700 outline-none w-48 appearance-none" 
                        value={selectedClass} 
                        onChange={e => { setSelectedClass(e.target.value); setSelectedSection(''); }}
                    >
                        <option value="">Select Grade</option>
                        {classes.filter(c => {
                            if (!c.Sections || c.Sections.length === 0) return false
                            // Show class if any of its sections include the current shift
                            return c.Sections.some(s => parseShifts(s.shift).includes(shift))
                        }).map(c => (
                            <option key={c.id} value={c.id}>{c.class_name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex flex-col">
                    <label className="text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">Section</label>
                    <select 
                        className="bg-gray-50 border-none rounded-2xl px-5 py-3 font-bold text-slate-700 outline-none w-40 appearance-none disabled:bg-gray-100 disabled:cursor-not-allowed" 
                        value={selectedSection} 
                        onChange={e => setSelectedSection(e.target.value)}
                        disabled={!selectedClass}
                    >
                        <option value="">All Sections</option>
                        {(classes.find(c => c.id === selectedClass)?.Sections || []).map(s => {
                            const shifts = parseShifts(s.shift)
                            const badge = shifts.map(sh => SHIFT_LABELS[sh]?.emoji || sh).join('+')
                            return <option key={s.id} value={s.id}>{s.name} {badge}</option>
                        })}
                    </select>
                </div>

                {activeTab === 'mark' ? (
                    <>
                        <div className="flex flex-col">
                            <label className="text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">Date</label>
                            <input type="date" className="bg-gray-50 border-none rounded-2xl px-5 py-3 font-bold text-slate-700 outline-none" value={date} onChange={e => setDate(e.target.value)} />
                        </div>
                        <div className="flex flex-col">
                            <label className="text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">Shift</label>
                            <select 
                                className="bg-gray-50 border-none rounded-2xl px-5 py-3 font-bold text-slate-700 outline-none" 
                                value={shift} 
                                onChange={e => setShift(e.target.value)}
                            >
                                {getAvailableShifts().map(sh => (
                                    <option key={sh} value={sh}>
                                        {SHIFT_LABELS[sh]?.emoji} {SHIFT_LABELS[sh]?.label || sh}
                                    </option>
                                ))}
                            </select>
                            {selectedSection && getAvailableShifts().length > 1 && (
                                <p className="text-[9px] text-indigo-500 font-bold mt-1 ml-1">
                                    Section-kan wuxuu dhigaa {getAvailableShifts().length} shift
                                </p>
                            )}
                        </div>
                        <div className="flex flex-col">
                            <label className="text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">Session</label>
                            <select className="bg-gray-50 border-none rounded-2xl px-5 py-3 font-bold text-blue-600 outline-none" value={session} onChange={e => setSession(e.target.value)}>
                                <option value="Break 1">Break 1</option>
                                <option value="Break 2">Break 2</option>
                            </select>
                        </div>
                        <div className="ml-auto flex gap-3">
                            <button onClick={markAllPresent} className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-6 py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all">
                                Mark All Present
                            </button>
                            <button onClick={saveAttendance} disabled={saving || students.length === 0} className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-8 py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-100 transition-all">
                                {saving ? 'Saving...' : 'Save Attendance'}
                            </button>
                        </div>
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
                                className="bg-gray-50 border-none rounded-2xl px-5 py-3 font-bold text-slate-700 outline-none"
                                value={historyYear}
                                onChange={e => setHistoryYear(Number(e.target.value))}
                            >
                                {/* Show current year and 2 previous years */}
                                {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                    </>
                )}
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-50 overflow-hidden">
                {activeTab === 'mark' ? (
                    <div className="overflow-auto max-h-[70vh] w-full scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                        <table className="w-full text-left border-separate border-spacing-0 min-w-max">
                            <thead className="sticky top-0 z-20">
                                <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase font-black tracking-[0.2em]">
                                    <th className="px-8 py-6 border-b border-slate-100 bg-slate-50 rounded-tl-[2.5rem]">#</th>
                                    <th className="px-8 py-6 border-b border-slate-100 bg-slate-50">Student Name</th>
                                    <th className="px-8 py-6 text-center border-b border-slate-100 bg-slate-50 rounded-tr-[2.5rem]">Current Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {loading ? (
                                    <tr><td colSpan="3" className="text-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div></td></tr>
                                ) : students.length > 0 ? (
                                    students.map((s, idx) => (
                                        <tr key={s.id} className={`transition-colors group ${!attendance[s.id] ? 'bg-amber-50/50' : 'hover:bg-gray-50/50'}`}>
                                            <td className="px-8 py-6 text-xs font-bold text-slate-400 border-b border-gray-50">{idx + 1}</td>
                                            <td className="px-8 py-6 border-b border-gray-50">
                                                <div translate="no" className="font-black text-slate-800 text-lg group-hover:text-blue-600 transition-colors uppercase notranslate">{s.user.name}</div>
                                                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">{s.student_id}</div>
                                            </td>
                                            <td className="px-8 py-6 border-b border-gray-50">
                                                <div className="flex justify-center items-center gap-3">
                                                    <button
                                                        onClick={() => mark(s.id, attendance[s.id] === 'Present' ? null : 'Present')}
                                                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${attendance[s.id] === 'Present' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                                                    >
                                                        Present
                                                    </button>
                                                    <button
                                                        onClick={() => mark(s.id, attendance[s.id] === 'Late' ? null : 'Late')}
                                                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${attendance[s.id] === 'Late' ? 'bg-amber-500 text-white shadow-lg shadow-amber-100' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                                                    >
                                                        Soo Daahay (Late)
                                                    </button>
                                                    <button
                                                        onClick={() => mark(s.id, attendance[s.id] === 'Absent' ? null : 'Absent')}
                                                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${attendance[s.id] === 'Absent' ? 'bg-rose-600 text-white shadow-lg shadow-rose-100' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                                                    >
                                                        Absent
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan="3" className="text-center py-20 text-gray-400 font-medium">No students found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="overflow-auto max-h-[70vh] border-t border-slate-50 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                        <table className="w-full text-left min-w-max border-separate border-spacing-0">
                            <thead className="sticky top-0 z-30">
                                <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase font-black tracking-widest">
                                    <th className="px-6 py-4 sticky left-0 top-0 bg-slate-50 z-40 border-r border-b border-slate-200 shadow-[2px_0_10px_-4px_rgba(0,0,0,0.1)]">Student Name</th>
                                    {Array.from({ length: historyData.daysInMonth }, (_, i) => i + 1).map(day => (
                                        <th key={day} className="px-1 py-4 text-center w-10 border-r border-b border-slate-200 bg-slate-50 last:border-r-0">{day}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="">
                                {loading ? (
                                    <tr><td colSpan={historyData.daysInMonth + 1} className="text-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div></td></tr>
                                ) : historyData.students.length > 0 ? (
                                    historyData.students.map(s => (
                                        <tr key={s.id} className="hover:bg-blue-50/30 transition-colors group">
                                            <td translate="no" className="px-6 py-3 sticky left-0 bg-white group-hover:bg-[#f8fafc] z-20 border-r border-b border-slate-100 shadow-[2px_0_10px_-4px_rgba(0,0,0,0.1)] notranslate">
                                                <div className="font-extrabold text-slate-700 text-xs uppercase whitespace-nowrap">{s.user.name}</div>
                                            </td>
                                            {Array.from({ length: historyData.daysInMonth }, (_, i) => i + 1).map(day => {
                                                const status = historyData.matrix[s.id]?.[day]
                                                return (
                                                    <td key={day} className="px-1 py-3 text-center border-r border-b border-slate-50 last:border-r-0 hover:bg-slate-50 transition-colors cursor-default">
                                                        {status === 'Present' && <div className="w-6 h-6 mx-auto rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-[10px] shadow-sm shadow-emerald-100/50" title={`${s.user.name} - Present on ${day}`}>P</div>}
                                                        {status === 'Absent' && <div className="w-6 h-6 mx-auto rounded-md bg-red-100 text-red-700 flex items-center justify-center font-black text-[10px] shadow-sm shadow-red-100/50" title={`${s.user.name} - Absent on ${day}`}>A</div>}
                                                        {status === 'Late' && <div className="w-6 h-6 mx-auto rounded-md bg-amber-100 text-amber-700 flex items-center justify-center font-black text-[10px] shadow-sm shadow-amber-100/50" title={`${s.user.name} - Late on ${day}`}>L</div>}
                                                        {!status && <div className="w-6 h-6 mx-auto text-slate-200 font-bold">-</div>}
                                                    </td>
                                                )
                                            })}
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan={historyData.daysInMonth + 1} className="text-center py-20 text-gray-400 font-medium">No students or attendance records found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </Layout>
    )
}
