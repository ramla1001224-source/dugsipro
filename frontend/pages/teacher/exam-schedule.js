import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'

export default function TeacherExamSchedule() {
    const [groupedExams, setGroupedExams] = useState({})
    const [loading, setLoading] = useState(true)
    const [totalCount, setTotalCount] = useState(0)
    const [classes, setClasses] = useState([])
    const [selectedClass, setSelectedClass] = useState('')
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    useEffect(() => {
        fetchClasses()
    }, [])

    useEffect(() => {
        fetchSchedule()
    }, [selectedClass])

    const fetchClasses = async () => {
        try {
            const res = await axios.get(`${apiUrl}/api/classes`, { headers: headers() })
            const data = res.data.data || res.data || []
            
            // Deduplicate by classId (since teacher sees sections, but wants to filter by Class/Grade)
            const uniqueClasses = []
            const seenClassIds = new Set()
            
            data.forEach(item => {
                if (!seenClassIds.has(item.id)) {
                    seenClassIds.add(item.id)
                    uniqueClasses.push({
                        id: item.id, // Use the actual Class UUID as the ID
                        class_name: item.class_name
                    })
                }
            })
            setClasses(uniqueClasses)
        } catch (err) {
            console.error('Error fetching classes:', err)
        }
    }

    const fetchSchedule = async () => {
        setLoading(true)
        try {
            let url = `${apiUrl}/api/exams`
            if (selectedClass) url += `?classId=${selectedClass}`

            const res = await axios.get(url, { headers: headers() })
            const data = Array.isArray(res.data) ? res.data : (res.data.data || [])
            // Show all exams, but sort scheduled ones to the top by date
            const sorted = [...data].sort((a, b) => {
                if (!a.date) return 1;
                if (!b.date) return -1;
                return new Date(a.date) - new Date(b.date);
            });
            setTotalCount(sorted.length)

            const groups = {}
            sorted.forEach(ex => {
                const termName = ex.term?.name || ex.Term?.name || "Muddo la'aan"
                const yearName = (ex.term?.AcademicYear?.name || ex.Term?.AcademicYear?.name) || ''
                const key = yearName ? `${yearName} — ${termName}` : termName
                if (!groups[key]) groups[key] = []
                groups[key].push(ex)
            })
            setGroupedExams(groups)
        } catch (err) {
            console.error('Error fetching exam schedule:', err)
        } finally {
            setLoading(false)
        }
    }

    const today = new Date().toDateString()

    return (
        <Layout title="Jadwalka Imtixaanka">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">Jadwalka Imtixaanka</h2>
                    <p className="text-gray-400 font-medium text-sm uppercase tracking-widest mt-1">Exam Timetable — Grouped by Term</p>
                </div>
                {totalCount > 0 && (
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-600 text-white px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest">{totalCount} Imtixaan</div>
                        <div className="bg-emerald-50 text-emerald-600 border border-emerald-100 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest">{Object.keys(groupedExams).length} Term</div>
                    </div>
                )}
            </div>

            {/* Filter */}
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm mb-8">
                <div className="max-w-xs space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Fasalka (Class)</label>
                    <select
                        className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-5 py-4 text-xs font-black text-slate-700 outline-none focus:border-indigo-500 transition-all"
                        value={selectedClass}
                        onChange={e => setSelectedClass(e.target.value)}
                    >
                        <option value="">Dhammaan Fasallada</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center p-40"><div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600"></div></div>
            ) : Object.keys(groupedExams).length > 0 ? (
                <div className="space-y-10 mb-10">
                    {Object.entries(groupedExams).map(([termName, termExams]) => (
                        <div key={termName} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                            <div className="bg-slate-900 px-8 py-5 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="bg-indigo-600 p-2.5 rounded-xl">
                                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z" /></svg>
                                    </div>
                                    <div>
                                        <h3 className="text-white font-black text-lg tracking-tight">{termName}</h3>
                                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">{termExams.length} Imtixaan Jadwalsan</p>
                                    </div>
                                </div>
                                <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest">{termExams.length} Records</span>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100">
                                            <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] w-10">#</th>
                                            <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Maadada</th>
                                            <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Fasalka</th>
                                            <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Taariikhda</th>
                                            <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Maalinta</th>
                                            <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Bilaabashada</th>
                                            <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Dhamaadka</th>
                                            <th className="px-6 py-4 text-center text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Xaaladda</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {termExams.map((ex, idx) => {
                                            const examDate = new Date(ex.date)
                                            const examEnd = ex.endTime ? new Date(ex.endTime) : null
                                            const isToday = examDate.toDateString() === today
                                            const isPast = examDate < new Date() && !isToday
                                            return (
                                                <tr key={ex.id} className={`border-b border-slate-50 transition-colors ${isToday ? 'bg-orange-50/60 hover:bg-orange-50' : idx % 2 === 0 ? 'bg-white hover:bg-indigo-50/30' : 'bg-slate-50/30 hover:bg-indigo-50/30'} ${isPast ? 'opacity-60' : ''}`}>
                                                    <td className="px-6 py-5"><span className="text-[11px] font-black text-slate-400">{idx + 1}</span></td>
                                                    <td className="px-6 py-5">
                                                        <p className="text-sm font-black text-slate-800 uppercase tracking-tight">{ex.subject?.name || '—'}</p>
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{ex.name}</p>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100 uppercase tracking-wide whitespace-nowrap">
                                                            {ex.class_name} {ex.section_name !== 'All' ? `(${ex.section_name})` : ''}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        {ex.date ? (
                                                            <p className="text-sm font-black text-slate-700 whitespace-nowrap">{examDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                                        ) : (
                                                            <span className="text-[10px] text-rose-500 font-black uppercase tracking-widest italic">Ma la jadwalayn</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        {ex.date ? (
                                                            <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100 uppercase tracking-wide whitespace-nowrap">
                                                                {examDate.toLocaleDateString('so-SO', { weekday: 'long' })}
                                                            </span>
                                                        ) : <span className="text-slate-300">—</span>}
                                                    </td>
                                                    <td className="px-6 py-5">{ex.date ? <span className="text-sm font-black text-slate-700">{examDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> : <span className="text-slate-300">—</span>}</td>
                                                    <td className="px-6 py-5">{examEnd ? <span className="text-sm font-black text-slate-700">{examEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> : <span className="text-[10px] text-slate-300 font-bold">—</span>}</td>
                                                    <td className="px-6 py-5 text-center">
                                                        {!ex.date ? (
                                                            <span className="text-[9px] bg-rose-50 text-rose-600 border border-rose-100 font-black px-3 py-1.5 rounded-full uppercase tracking-widest italic animate-pulse">Ma la qaban</span>
                                                        ) : isToday ? (
                                                            <span className="text-[9px] bg-orange-100 text-orange-600 border border-orange-200 font-black px-3 py-1.5 rounded-full uppercase tracking-widest animate-pulse">📌 Maanta</span>
                                                        ) : isPast ? (
                                                            <span className="text-[9px] bg-slate-100 text-slate-400 font-black px-3 py-1.5 rounded-full uppercase tracking-widest">✓ Dhamaaday</span>
                                                        ) : (
                                                            <span className="text-[9px] bg-indigo-50 text-indigo-600 border border-indigo-100 font-black px-3 py-1.5 rounded-full uppercase tracking-widest">🕐 Soo Socda</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-[3rem] p-20 text-center border-2 border-dashed border-slate-100">
                    <div className="text-6xl mb-6 grayscale opacity-20">📅</div>
                    <h3 className="text-slate-400 font-black uppercase tracking-[0.2em] text-xs">Ma jirto jadwalka imtixaan oo hada yaala</h3>
                    <p className="text-slate-300 text-[10px] mt-2 italic">Exams that have been scheduled will appear here</p>
                </div>
            )}
        </Layout>
    )
}
