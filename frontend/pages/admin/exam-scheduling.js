import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'

export default function ExamScheduling() {
    const [exams, setExams] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [schedulingExam, setSchedulingExam] = useState(null)
    const [scheduleData, setScheduleData] = useState({ date: '', time: '', endTime: '', description: '' })
    
    // Filters
    const [classes, setClasses] = useState([])
    const [subjects, setSubjects] = useState([])
    const [terms, setTerms] = useState([])
    const [selectedClass, setSelectedClass] = useState('')
    const [selectedSection, setSelectedSection] = useState('')
    const [selectedTerm, setSelectedTerm] = useState('')
    const [searchTerm, setSearchTerm] = useState('')
    
    // Create Form (Detailed)
    const [createBase, setCreateBase] = useState({ 
        name: '', 
        type: 'monthly_1', 
        classId: '', 
        sectionId: '', 
        termId: '', 
        totalMarks: 100
    })
    
    const [sessions, setSessions] = useState([
        { id: '', date: '', startTime: '', endTime: '' }
    ])

    const [submitting, setSubmitting] = useState(false)
    const [userRole, setUserRole] = useState('')
    
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    useEffect(() => {
        const role = typeof window !== 'undefined' ? localStorage.getItem('role') : ''
        setUserRole(role)
        fetchInitialData()
    }, [])

    const fetchInitialData = async () => {
        try {
            const [c, y, s] = await Promise.all([
                axios.get(`${apiUrl}/api/classes`, { headers: headers() }),
                axios.get(`${apiUrl}/api/academic-years?onlyCurrent=true`, { headers: headers() }),
                axios.get(`${apiUrl}/api/subjects`, { headers: headers() })
            ])
            setClasses(c.data.data || c.data || [])
            setSubjects(s.data.data || s.data || [])
            
            const academicYears = y.data.data || y.data || []
            const allTerms = academicYears.flatMap(year => 
                (year.Terms || []).map(t => ({ ...t, yearName: year.name }))
            )
            
            if (allTerms.length > 0) {
                setTerms(allTerms)
                const latestTerm = allTerms[0].id
                setSelectedTerm(latestTerm)
                setCreateBase(prev => ({ ...prev, termId: latestTerm }))
            } else if (academicYears.length > 0 && academicYears[0].id) {
                setTerms(academicYears)
                const latestTerm = academicYears[0].id
                setSelectedTerm(latestTerm)
                setCreateBase(prev => ({ ...prev, termId: latestTerm }))
            }
        } catch (err) {
            console.error('Error fetching initial data:', err)
        }
    }

    useEffect(() => {
        fetchExams()
    }, [selectedTerm, selectedClass, selectedSection])

    const fetchExams = async () => {
        setLoading(true)
        try {
            let url = `${apiUrl}/api/exams?termId=${selectedTerm}&all=true`
            if (selectedClass) url += `&classId=${selectedClass}`
            if (selectedSection) url += `&sectionId=${selectedSection}`
            
            const res = await axios.get(url, { headers: headers() })
            const data = Array.isArray(res.data) ? res.data : (res.data.data || [])
            // Only show scheduled (dated) exams
            setExams(data)
        } catch (err) {
            console.error('Error fetching exams:', err)
        } finally {
            setLoading(false)
        }
    }

    // Group scheduled exams by term
    const groupedByTerm = (() => {
        const filteredExams = exams.filter(ex =>
            ex.date !== null && // Only show scheduled items in the main list
            (ex.subject?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ex.name?.toLowerCase().includes(searchTerm.toLowerCase()))
        ).sort((a, b) => new Date(a.date) - new Date(b.date))

        const groups = {}
        filteredExams.forEach(ex => {
            const termName = ex.term?.name || ex.Term?.name || 'Muddo la\'aan'
            const yearName = ex.term?.AcademicYear?.name || ex.Term?.AcademicYear?.name || ''
            const key = yearName ? `${yearName} - ${termName}` : termName
            if (!groups[key]) groups[key] = []
            groups[key].push(ex)
        })
        return groups
    })()

    const handleOpenSchedule = (exam) => {
        setSchedulingExam(exam)
        const dateObj = exam.date ? new Date(exam.date) : null
        const endObj = exam.endTime ? new Date(exam.endTime) : null
        
        setScheduleData({
            date: dateObj ? dateObj.toISOString().split('T')[0] : '',
            time: dateObj ? new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000)).toISOString().split('T')[1].substring(0, 5) : '',
            endTime: endObj ? new Date(endObj.getTime() - (endObj.getTimezoneOffset() * 60000)).toISOString().split('T')[1].substring(0, 5) : '',
            description: exam.description || ''
        })
        setShowModal(true)
    }

    const handleUpdateSchedule = async (e) => {
        e.preventDefault()
        setSubmitting(true)
        try {
            const combinedDate = scheduleData.date && scheduleData.time 
                ? new Date(`${scheduleData.date}T${scheduleData.time}:00`)
                : scheduleData.date ? new Date(scheduleData.date) : null
            
            const combinedEnd = scheduleData.date && scheduleData.endTime 
                ? new Date(`${scheduleData.date}T${scheduleData.endTime}:00`)
                : null
            
            await axios.patch(`${apiUrl}/api/exams/${schedulingExam.id}`, {
                date: combinedDate,
                endTime: combinedEnd,
                description: scheduleData.description
            }, { headers: headers() })
            
            alert('Jadwalka si guul leh ayaa loo cusbeysiiyay!')
            setShowModal(false)
            fetchExams()
        } catch (err) {
            alert(err.response?.data?.message || 'Error updating schedule')
        } finally {
            setSubmitting(false)
        }
    }

    const handleAddSessionRow = () => {
        setSessions([...sessions, { id: '', date: '', startTime: '', endTime: '' }])
    }

    const handleRemoveSessionRow = (index) => {
        setSessions(sessions.filter((_, i) => i !== index))
    }

    const handleSessionChange = (index, field, value) => {
        const newSessions = [...sessions]
        newSessions[index][field] = value
        setSessions(newSessions)
    }

    const handleDeleteExam = async (exam) => {
        if (!confirm(`Imtixaanka "${exam.subject?.name || exam.name}" ma hubtaa inaad jadwalka ka saarto? Tani ma tirtiri doonto dhibcaha iyo xogta imtixaanka.`)) return
        try {
            await axios.patch(`${apiUrl}/api/exams/${exam.id}`, { 
                date: null, 
                endTime: null 
            }, { headers: headers() })
            fetchExams()
        } catch (err) {
            alert(err.response?.data?.message || 'Error removing from schedule')
        }
    }

    // Bulk unschedule: clear all scheduled exams for a specific term (or group of examIds)
    const handleBulkUnschedule = async ({ termId, termName, examIds }) => {
        const label = termName || 'Term-kan'
        const count = examIds ? examIds.length : ''
        const msg = examIds
            ? `${label} — ${count} imtixaan oo dhamaan jadwalkooda laga saari doonaa. Ma hubtaa?`
            : `${label} — Dhammaan imtixaanada jadwalsan ayaa jadwalkooda laga saari doonaa. Ma hubtaa?`
        if (!confirm(msg)) return
        try {
            const body = examIds ? { examIds } : { termId, classId: selectedClass || undefined, sectionId: selectedSection || undefined }
            const res = await axios.patch(`${apiUrl}/api/exams/bulk-unschedule`, body, { headers: headers() })
            alert(res.data?.message || 'Jadwalka waa la tirtiray!')
            fetchExams()
        } catch (err) {
            alert(err.response?.data?.message || 'Qalad ayaa ka dhacay tirtiridda jadwalka')
        }
    }

    const handleCreateExam = async (e) => {
        e.preventDefault()
        setSubmitting(true)
        try {
            const sessionPayload = sessions.map(s => ({
                id: s.id,
                date: s.date && s.startTime ? new Date(`${s.date}T${s.startTime}`) : (s.date ? new Date(s.date) : null),
                endTime: s.date && s.endTime ? new Date(`${s.date}T${s.endTime}`) : null,
                name: createBase.name
            })).filter(s => s.id)

            if (sessionPayload.length === 0) {
                alert('Fadlan ugu yaraan hal maado dooro.')
                setSubmitting(false)
                return
            }

            const missingDates = sessionPayload.filter(s => !s.date)
            if (missingDates.length > 0) {
                alert('Fadlan taariikhda geli maado kasta.')
                setSubmitting(false)
                return
            }

            await axios.post(`${apiUrl}/api/exams`, {
                ...createBase,
                sessions: sessionPayload
            }, { headers: headers() })
            
            alert('Jadwalka waa la abuuray!')
            setShowCreateModal(false)
            setSessions([{ subjectId: '', date: '', startTime: '', endTime: '' }])
            fetchExams()
        } catch (err) {
            alert(err.response?.data?.message || 'Error creating exam')
        } finally {
            setSubmitting(false)
        }
    }

    const totalExams = exams.filter(e => e.date).length

    // Filter exams that are NOT yet scheduled for the selected class/term
    const availableExams = (() => {
        if (!createBase.classId || !createBase.termId) return []
        return exams.filter(e => 
            e.date === null && 
            String(e.classId) === String(createBase.classId) &&
            String(e.termId) === String(createBase.termId)
        )
    })()

    return (
        <Layout title="Exam Scheduling">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <button 
                            onClick={() => window.location.href = '/admin/exams'}
                            className="text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1 font-bold text-xs uppercase tracking-widest"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            Hub
                        </button>
                        <span className="text-slate-300">/</span>
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Schedule</span>
                    </div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">Jadwalka Imtixaanka</h2>
                    <p className="text-gray-400 font-medium text-sm uppercase tracking-widest italic">Exam Timetable — Grouped by Term</p>
                </div>
                {(userRole === 'admin' || userRole === 'owner') && (
                    <button 
                        onClick={() => setShowCreateModal(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center gap-3"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                        Abuur Jadwal Cusub
                    </button>
                )}
            </div>

            {/* Filters */}
            <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm mb-10">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Muddada (Term)</label>
                        <select className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-5 py-4 text-xs font-black text-slate-700 outline-none focus:border-indigo-500 transition-all" value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)}>
                            {terms.map(t => <option key={t.id} value={t.id}>{t.yearName ? `${t.yearName} - ${t.name}` : t.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Fasalka (Class)</label>
                        <select className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-5 py-4 text-xs font-black text-slate-700 outline-none focus:border-indigo-500 transition-all" value={selectedClass} onChange={(e) => { setSelectedClass(e.target.value); setSelectedSection(''); }}>
                            <option value="">Dhammaan Fasallada</option>
                            {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Qaybta (Section)</label>
                        <select className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-5 py-4 text-xs font-black text-slate-700 outline-none focus:border-indigo-500 transition-all" value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)} disabled={!selectedClass}>
                            <option value="">Dhammaan Qaybaha</option>
                            {classes.find(c => c.id === selectedClass)?.Sections?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Raadi (Search)</label>
                        <input type="text" placeholder="Maadada raadi..." className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-5 py-4 text-xs font-black text-slate-700 outline-none focus:border-indigo-500 transition-all uppercase placeholder:italic placeholder:font-bold" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="flex items-center flex-wrap gap-4 mb-8">
                <div className="bg-indigo-600 text-white px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z" /></svg>
                    {totalExams} Xaaladood Jadwalsan
                </div>
                <div className="bg-emerald-50 text-emerald-600 border border-emerald-100 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest">
                    {Object.keys(groupedByTerm).length} Term
                </div>
                {(userRole === 'admin' || userRole === 'owner') && totalExams > 0 && selectedTerm && (
                    <button
                        onClick={() => handleBulkUnschedule({ termId: selectedTerm, termName: terms.find(t => String(t.id) === String(selectedTerm))?.name || 'Term-kan' })}
                        className="ml-auto bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border-2 border-red-200 hover:border-red-600 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2"
                        title="Dhammaan jadwalka term-kan laga tirtir"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        Ka saar Jadwalka Dhan
                    </button>
                )}
            </div>

            {loading ? (
                <div className="flex justify-center p-40"><div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600"></div></div>
            ) : Object.keys(groupedByTerm).length > 0 ? (
                <div className="space-y-10 mb-20">
                    {Object.entries(groupedByTerm).map(([termName, termExams]) => (
                        <div key={termName} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                            {/* Term Header */}
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
                                <div className="flex items-center gap-3">
                                    {(userRole === 'admin' || userRole === 'owner') && (
                                        <button
                                            onClick={() => handleBulkUnschedule({
                                                examIds: termExams.map(e => e.id),
                                                termName
                                            })}
                                            className="bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/30 hover:border-red-500 text-[9px] font-black px-4 py-2 rounded-xl uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2"
                                            title="Jadwalka group-kan oo dhan ka tirtir"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            Ka saar Jadwalka Dhan
                                        </button>
                                    )}
                                    <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest">
                                        {termExams.length} Records
                                    </span>
                                </div>
                            </div>

                            {/* Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100">
                                            <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] w-10">#</th>
                                            <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Maadada</th>
                                            <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Fasalka</th>
                                            <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Taariikhda</th>
                                            <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Maalinta</th>
                                            <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Waqtiga</th>
                                            {(userRole === 'admin' || userRole === 'owner') && (
                                                <th className="px-6 py-4 text-center text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Ficil</th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {termExams.map((ex, idx) => {
                                            const examDate = ex.date ? new Date(ex.date) : null
                                            const examEnd = ex.endTime ? new Date(ex.endTime) : null
                                            const isEven = idx % 2 === 0
                                            const isToday = examDate && new Date().toDateString() === examDate.toDateString()
                                            return (
                                                <tr key={ex.id} className={`border-b border-slate-50 hover:bg-indigo-50/40 transition-colors ${isEven ? 'bg-white' : 'bg-slate-50/30'} ${isToday ? 'ring-2 ring-inset ring-orange-400/30' : ''}`}>
                                                    <td className="px-6 py-5">
                                                        <span className="text-[11px] font-black text-slate-400">{idx + 1}</span>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <p className="text-sm font-black text-slate-800 uppercase tracking-tight">{ex.subject?.name || '—'}</p>
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{ex.name}</p>
                                                        {isToday && <span className="text-[9px] bg-orange-100 text-orange-600 font-black px-2 py-0.5 rounded-full uppercase tracking-widest animate-pulse">Maanta</span>}
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100 uppercase tracking-wide whitespace-nowrap">
                                                            {ex.class?.class_name || '—'} {ex.section?.name ? `(${ex.section.name})` : ''}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        {examDate ? (
                                                            <p className="text-sm font-black text-slate-700 whitespace-nowrap">
                                                                {examDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                            </p>
                                                        ) : <span className="text-[10px] text-red-400 font-bold">—</span>}
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        {examDate ? (
                                                            <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100 uppercase tracking-wide whitespace-nowrap">
                                                                {examDate.toLocaleDateString('so-SO', { weekday: 'long' })}
                                                            </span>
                                                        ) : <span className="text-[10px] text-red-400 font-bold">—</span>}
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        {examDate ? (
                                                            <p className="text-sm font-black text-slate-700 whitespace-nowrap">
                                                                {examDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                {examEnd ? ` – ${examEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                                                            </p>
                                                        ) : <span className="text-[10px] text-red-400 font-bold italic">Waqti la'aan</span>}
                                                    </td>
                                                    {(userRole === 'admin' || userRole === 'owner') && (
                                                        <td className="px-6 py-5">
                                                            <div className="flex items-center justify-center gap-2">
                                                                <button onClick={() => handleOpenSchedule(ex)} title="Bedel" className="bg-slate-900 hover:bg-indigo-600 text-white p-3 rounded-xl transition-all active:scale-90">
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                                </button>
                                                                <button onClick={() => handleDeleteExam(ex)} title="Ka saar Jadwalka" className="bg-red-50 hover:bg-red-500 text-red-500 hover:text-white border border-red-100 hover:border-red-500 p-3 rounded-xl transition-all active:scale-90">
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    )}
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
                <div className="bg-white rounded-[5rem] p-40 text-center border-2 border-dashed border-slate-100 flex flex-col items-center">
                    <div className="text-9xl mb-10 grayscale opacity-10">📅</div>
                    <h3 className="text-slate-400 font-black uppercase tracking-[0.4em] text-sm">Jadwal la'aan</h3>
                    <p className="text-slate-300 text-xs mt-3 italic">Imtixaanada jadwalsan ayaa halkan ka muuqan doona</p>
                </div>
            )}

            {/* Create Exam Modal (Multi-Session) */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-2xl flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
                    <div className="bg-white rounded-[4rem] shadow-2xl w-full max-w-6xl overflow-hidden animate-in zoom-in-95 duration-500 border border-white/20">
                        <div className="bg-slate-900 px-12 py-10 text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-3xl font-black tracking-tight mb-2 italic">Abuurista Jadwal Maalinle ah</h3>
                                <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] italic">Schedule multiple subjects for a specific day</p>
                            </div>
                            <button onClick={() => setShowCreateModal(false)} className="bg-white/5 hover:bg-white/10 p-5 rounded-3xl text-slate-400 hover:text-white transition-all"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg></button>
                        </div>
                        
                        <form onSubmit={handleCreateExam} className="p-12 bg-slate-50/30 max-h-[80vh] overflow-y-auto custom-scrollbar">
                         {/* Class & General Info */}
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">Magaca Exam-ka</label>
                                    <input required className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-xs font-bold text-slate-700" value={createBase.name} onChange={e => setCreateBase({...createBase, name: e.target.value})} placeholder="e.g. Midterm 2024" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">Fasalka</label>
                                    <select required className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-xs font-bold text-slate-700" value={createBase.classId} onChange={e => {
                                        const val = e.target.value;
                                        setCreateBase({...createBase, classId: val, sectionId: ''});
                                        setSelectedClass(val);
                                        setSelectedSection('');
                                    }}>
                                        <option value="">Dooro Fasalka</option>
                                        {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">Term</label>
                                    <select required className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-xs font-bold text-slate-700" value={createBase.termId} onChange={e => {
                                        const val = e.target.value;
                                        setCreateBase({...createBase, termId: val});
                                        setSelectedTerm(val);
                                    }}>
                                        {terms.map(t => <option key={t.id} value={t.id}>{t.yearName ? `${t.yearName} - ${t.name}` : t.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Sessions List */}
                             <div className="space-y-4 mb-10">
                                <div className="flex items-center justify-between ml-4 mb-6">
                                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Maadooyinka la Jadwalaynayo</h4>
                                    <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest">↑ Maado kasta waxay leedahay taariikhdeeda gaar ah</p>
                                </div>
                                {sessions.map((session, index) => (
                                    <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end bg-white p-6 rounded-[2rem] border border-slate-100 relative group animate-in slide-in-from-left-4 duration-300">
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Maadada (Subject)</label>
                                            <select required className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-xs font-bold text-slate-700" value={session.id} onChange={e => handleSessionChange(index, 'id', e.target.value)}>
                                                <option value="">Select Unscheduled Exam</option>
                                                {availableExams.map(e => <option key={e.id} value={e.id}>{e.subject?.name} - {e.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-indigo-500 uppercase tracking-widest ml-2">📅 Taariikhda (Date)</label>
                                            <input type="date" required className="w-full bg-indigo-50 border-2 border-indigo-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 focus:border-indigo-400 outline-none" value={session.date} onChange={e => handleSessionChange(index, 'date', e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Bilaabashada (Start)</label>
                                            <input type="time" required className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-xs font-bold text-slate-700" value={session.startTime} onChange={e => handleSessionChange(index, 'startTime', e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Dhamaadka (End)</label>
                                            <input type="time" required className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-xs font-bold text-slate-700" value={session.endTime} onChange={e => handleSessionChange(index, 'endTime', e.target.value)} />
                                        </div>
                                        <div className="flex items-center justify-center pt-4">
                                            {sessions.length > 1 ? (
                                                <button type="button" onClick={() => handleRemoveSessionRow(index)} className="w-full bg-red-50 hover:bg-red-100 text-red-500 font-bold text-[9px] uppercase tracking-widest py-3 rounded-xl transition-all">✕ Ka saar</button>
                                            ) : <div />}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex flex-col md:flex-row gap-6">
                                <button type="button" onClick={handleAddSessionRow} className="bg-indigo-50 text-indigo-600 px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-100 transition-all flex items-center justify-center gap-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                                    Ku dar Maado kale
                                </button>
                                <div className="flex-1"></div>
                                <button type="button" onClick={() => setShowCreateModal(false)} className="bg-white border-2 border-slate-100 text-slate-400 px-10 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:border-slate-200">Cancel</button>
                                <button type="submit" disabled={submitting} className="bg-indigo-600 hover:bg-indigo-700 text-white px-12 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 disabled:opacity-50">
                                    {submitting ? 'Abuuraya...' : 'CREATE SCHEDULE'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showModal && schedulingExam && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
                    <div className="bg-white rounded-[4rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-500 border border-white/20">
                        <div className="bg-slate-900 p-12 text-white relative">
                            <h3 className="text-3xl font-black tracking-tight mb-2 italic">Bedelka Waqtiga</h3>
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">{schedulingExam.subject?.name} • {schedulingExam.class?.class_name}</p>
                            <button onClick={() => setShowModal(false)} className="absolute top-12 right-12 text-slate-500 hover:text-white transition-colors"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg></button>
                        </div>
                        <form onSubmit={handleUpdateSchedule} className="p-12 space-y-10 bg-slate-50/50">
                            <div className="space-y-2 mb-2">
                                <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest ml-5">📅 Taariikhda (Date)</label>
                                <input type="date" required className="w-full bg-indigo-50 border-2 border-indigo-100 rounded-3xl px-8 py-6 text-sm font-black text-slate-700 outline-none focus:border-indigo-400" value={scheduleData.date} onChange={e => setScheduleData({...scheduleData, date: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-5">Bilaabashada (Start Time)</label>
                                    <input type="time" required className="w-full bg-white border-2 border-slate-100 rounded-3xl px-8 py-6 text-sm font-black text-slate-700 outline-none" value={scheduleData.time} onChange={e => setScheduleData({...scheduleData, time: e.target.value})} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-5">Dhamaadka (End Time)</label>
                                    <input type="time" required className="w-full bg-white border-2 border-slate-100 rounded-3xl px-8 py-6 text-sm font-black text-slate-700 outline-none" value={scheduleData.endTime} onChange={e => setScheduleData({...scheduleData, endTime: e.target.value})} />
                                </div>
                            </div>
                            <div className="flex gap-6">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-white border-2 border-slate-100 text-slate-400 px-8 py-6 rounded-[2rem] font-black text-[10px] uppercase tracking-widest">Cancel</button>
                                <button type="submit" disabled={submitting} className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-6 rounded-[2rem] font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all active:scale-95">Keydi Waqtiga</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </Layout>
    )
}
