import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'

export default function AcademicYears() {
    const [years, setYears] = useState([])
    const [classes, setClasses] = useState([])
    const [loading, setLoading] = useState(true)
    const [showYearModal, setShowYearModal] = useState(false)
    const [showTermModal, setShowTermModal] = useState(false)
    const [showReportModal, setShowReportModal] = useState(false)
    const [showPromoteModal, setShowPromoteModal] = useState(false)
    const [selectedYear, setSelectedYear] = useState(null)
    const [yearEndReport, setYearEndReport] = useState(null)
    const [reportLoading, setReportLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [role, setRole] = useState('')
    // === SMART PROMOTION STATE ===
    const [promotionStep, setPromotionStep] = useState(1) // 1: Mapping, 2: Preview, 3: Done
    const [promotions, setPromotions] = useState([])      // [{ fromClassId, fromClassName, toClassId }]
    const [targetYearId, setTargetYearId] = useState('')
    const [previewStudents, setPreviewStudents] = useState([]) // raw from API
    const [studentDecisions, setStudentDecisions] = useState({}) // { enrollmentId: { action, targetClassId } }
    const [filterAction, setFilterAction] = useState('all')     // 'all' | 'promote' | 'retain' | 'graduate'
    const [filterClass, setFilterClass] = useState('all')       // classId
    const [previewLoading, setPreviewLoading] = useState(false)
    const [promoting, setPromoting] = useState(false)
    const [promotionResult, setPromotionResult] = useState(null)
    const [managedSchools, setManagedSchools] = useState([])
    const [targetSchoolId, setTargetSchoolId] = useState('')
    const [targetClasses, setTargetClasses] = useState([])
    const [targetYears, setTargetYears] = useState([])
    const [targetLoading, setTargetLoading] = useState(false)
    const [schoolClassesCache, setSchoolClassesCache] = useState({}) // { schoolId: [classes] }

    const [yearForm, setYearForm] = useState({ name: '', startDate: '', endDate: '', isCurrent: false })
    const [editingYear, setEditingYear] = useState(null)
    const [termForm, setTermForm] = useState({ name: '', startDate: '', endDate: '' })

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    const fetchAll = async () => {
        setLoading(true)
        try {
            const [yearsRes, classesRes] = await Promise.all([
                axios.get(`${apiUrl}/api/academic-years`, { headers: headers() }),
                axios.get(`${apiUrl}/api/classes`, { headers: headers() })
            ])
            const yearsData = Array.isArray(yearsRes.data) ? yearsRes.data : (yearsRes.data.data || [])
            const classesData = Array.isArray(classesRes.data) ? classesRes.data : (classesRes.data.data || [])
            // Sort: active year first, then by startDate descending
            const sortedYears = [...(yearsData || [])].sort((a, b) => {
                if (a.isCurrent && !b.isCurrent) return -1
                if (!a.isCurrent && b.isCurrent) return 1
                return new Date(b.startDate) - new Date(a.startDate)
            })
            setYears(sortedYears)
            setClasses(classesData || [])

            // Fetch schools separately so it doesn't block main UI
            axios.get(`${apiUrl}/api/schools`, { headers: headers() })
                .then(res => {
                    const schoolsData = Array.isArray(res.data) ? (res.data.data || res.data) : (res.data.data || [])
                    setManagedSchools(Array.isArray(schoolsData) ? schoolsData : [])
                })
                .catch(() => setManagedSchools([]))

        } catch (err) { console.error(err) }
        finally { setLoading(false) }
    }

    useEffect(() => { 
        const r = typeof window !== 'undefined' ? localStorage.getItem('role') : '' || ''
        setRole(r)
        fetchAll() 
    }, [])

    // Check if a year is expired
    const isExpired = (year) => year.isCurrent && new Date(year.endDate) < new Date()

    const handleSaveYear = async (e) => {
        e.preventDefault()
        if (submitting) return
        setSubmitting(true)
        try {
            if (editingYear) {
                await axios.put(`${apiUrl}/api/academic-years/${editingYear.id}`, yearForm, { headers: headers() })
            } else {
                await axios.post(`${apiUrl}/api/academic-years`, yearForm, { headers: headers() })
            }
            setShowYearModal(false)
            setEditingYear(null)
            setYearForm({ name: '', startDate: '', endDate: '', isCurrent: false })
            fetchAll()
        } catch (err) { alert(err.response?.data?.message || 'Qalad ayaa dhacay') }
        finally { setSubmitting(false) }
    }

    const handleCreateTerm = async (e) => {
        e.preventDefault()
        if (submitting || !selectedYear) return
        setSubmitting(true)
        try {
            await axios.post(`${apiUrl}/api/academic-years/terms`, { ...termForm, academicYearId: selectedYear.id }, { headers: headers() })
            setShowTermModal(false)
            setTermForm({ name: '', startDate: '', endDate: '' })
            fetchAll()
        } catch (err) { alert(err.response?.data?.message || 'Qalad ayaa dhacay') }
        finally { setSubmitting(false) }
    }

    const handleDeleteYear = async (id) => {
        if (!confirm('Ma hubtaa? Terms-kiisa oo dhan ayaa la tirtiri doonaa!')) return
        try {
            await axios.delete(`${apiUrl}/api/academic-years/${id}`, { headers: headers() })
            fetchAll()
        } catch (err) { alert(err.response?.data?.message || 'Ma tirtiri karin') }
    }

    const handleDeleteTerm = async (termId) => {
        if (!confirm('Ma hubtaa inaad tirtirto term-kan?')) return
        try {
            await axios.delete(`${apiUrl}/api/academic-years/terms/${termId}`, { headers: headers() })
            fetchAll()
        } catch (err) { alert(err.response?.data?.message || 'Ma tirtiri karin') }
    }

    const handleSetCurrent = async (yearId) => {
        try {
            await axios.patch(`${apiUrl}/api/academic-years/${yearId}/set-current`, {}, { headers: headers() })
            fetchAll()
        } catch (err) { alert(err.response?.data?.message || 'Qalad ayaa dhacay') }
    }

    const openYearEndReport = async (year) => {
        setSelectedYear(year)
        setYearEndReport(null)
        setShowReportModal(true)
        setReportLoading(true)
        try {
            const res = await axios.get(`${apiUrl}/api/academic-years/${year.id}/year-end-summary`, { headers: headers() })
            setYearEndReport(res.data)
        } catch (err) { setYearEndReport(null) }
        finally { setReportLoading(false) }
    }

    const openPromoteModal = (year) => {
        setSelectedYear(year)
        
        // Find candidate for next academic year (any year with a later start date)
        const futureYears = years.filter(y => 
            y.id !== year.id && 
            new Date(y.startDate) > new Date(year.startDate)
        ).sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
        
        const candidateYear = futureYears[0]
        setTargetYearId(candidateYear?.id || '')
        setTargetYears(futureYears)
        
        // Helper to guess next class name
        const getNextClassName = (currentName) => {
            const num = parseInt(currentName.match(/\d+/)?.[0])
            if (isNaN(num)) return null
            const nextNum = num + 1
            const nextName = currentName.replace(num.toString(), nextNum.toString())
            return nextName
        }

        // Auto-map classes to the "next level" if possible
        const initialPromotions = classes.map(c => {
            const nextNameCandidate = getNextClassName(c.class_name)
            const matchedClass = classes.find(tc => 
                tc.class_name.toLowerCase().includes(nextNameCandidate?.toLowerCase()) ||
                (nextNameCandidate && tc.class_name.toLowerCase() === nextNameCandidate.toLowerCase())
            )
            return { 
                fromClassId: c.id, 
                fromClassName: c.class_name, 
                toClassId: matchedClass?.id || '', 
                toSectionId: '', 
                targetSchoolId: '' 
            }
        })

        setPromotions(initialPromotions)
        setPromotionResult(null)
        setTargetSchoolId('') 
        setTargetClasses(classes)
        setSchoolClassesCache({ 'local': classes })
        setPromotionStep(1)
        setPreviewStudents([])
        setStudentDecisions({})
        setFilterAction('all')
        setFilterClass('all')
        setShowPromoteModal(true)
    }

    const handleRowSchoolChange = async (idx, schoolId) => {
        const updated = [...promotions]
        const cacheKey = schoolId || 'local'
        updated[idx] = { ...updated[idx], targetSchoolId: schoolId, toClassId: '', toSectionId: '' }
        setPromotions(updated)

        if (!schoolId) return; 

        if (schoolClassesCache[cacheKey]) return; // Already cached

        setTargetLoading(true)
        try {
            const res = await axios.get(`${apiUrl}/api/classes?schoolId=${schoolId}`, { headers: headers() })
            const data = Array.isArray(res.data) ? res.data : (res.data.data || [])
            setSchoolClassesCache(prev => ({ ...prev, [cacheKey]: data }))
        } catch (err) {
            console.error('Failed to fetch school classes:', err)
        } finally {
            setTargetLoading(true) // Setting back to false soon
            // Also need targetYears if moving cross-school?
            // Actually, Target Year is global in Step 1.
            // Let's at least fetch Target Years for the FIRST cross-school selected to allow Year selection
            if (targetYears.length <= years.length) {
                try {
                    const yRes = await axios.get(`${apiUrl}/api/academic-years?schoolId=${schoolId}`, { headers: headers() })
                    const yData = Array.isArray(yRes.data) ? yRes.data : (yRes.data.data || [])
                    const unexpired = yData.filter(y => 
                        y.id !== selectedYear.id && 
                        new Date(y.startDate) > new Date(selectedYear.startDate)
                    ).sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
                    setTargetYears(prev => {
                        const combined = [...prev, ...unexpired]
                        const seen = new Set()
                        return combined.filter(y => seen.has(y.id) ? false : seen.add(y.id))
                    })
                } catch (e) {}
            }
            setTargetLoading(false)
        }
    }

    // STEP 2: Fetch preview from backend
    const handleFetchPreview = async () => {
        if (!targetYearId) {
            alert('Fadlan dooro sanadka loo gudbayo (Target Year) marka hore!')
            return
        }
        const unmappedClasses = promotions.filter(p => p.toClassId === '')
        if (unmappedClasses.length > 0) {
            alert(`Fadlan dhammaan fasallada u dooro halka ay u socdaan! Waxaa kuu dhiman ${unmappedClasses.length} fasal.`)
            return
        }
        const mappedClasses = promotions;
        setPreviewLoading(true)
        try {
            const res = await axios.post(
                `${apiUrl}/api/academic-years/${selectedYear.id}/promote-preview`,
                { 
                    classMappings: mappedClasses.map(p => ({ 
                        fromClassId: p.fromClassId, 
                        toClassId: p.toClassId,
                        toSectionId: p.toSectionId, // Added Section Selection
                        targetSchoolId: p.targetSchoolId || undefined
                    })),
                },
                { headers: headers() }
            )
            const students = res.data.preview || []
            setPreviewStudents(students)
            // Auto-set decisions from suggested action
            const decisions = {}
            students.forEach(s => {
                decisions[s.enrollmentId] = {
                    action: s.suggestedAction === 'promote' ? 'promote' : 'retain',
                    targetClassId: s.targetClassId,
                    targetSectionId: s.targetSectionId, // Preserve Section
                    targetSchoolId: s.targetSchoolId
                }
            })
            setStudentDecisions(decisions)
            setPromotionStep(2)
        } catch (err) {
            alert(err.response?.data?.message || 'Preview soo qaadida kuma guulaysan')
        } finally {
            setPreviewLoading(false)
        }
    }

    // STEP 3: Publish decisions
    const handlePublishPromotion = async () => {
        if (!confirm(`Ma hubtaa? Tani waa ficil aan dib loo celin karin!`)) return
        setPromoting(true)
        try {
            const studentDecisionsList = previewStudents.map(s => {
                const dec = studentDecisions[s.enrollmentId]
                return {
                    enrollmentId: s.enrollmentId,
                    studentId: s.studentId,
                    action: dec?.action || 'retain',
                    targetClassId: dec?.action === 'graduate' ? 'graduate' : (dec?.targetClassId || s.currentClassId),
                    targetSectionId: dec?.targetSectionId || s.targetSectionId, // Added Section
                    targetSchoolId: dec?.targetSchoolId || s.targetSchoolId
                }
            })
            const res = await axios.post(
                `${apiUrl}/api/academic-years/${selectedYear.id}/promote-publish`,
                { 
                    targetYearId, 
                    studentDecisions: studentDecisionsList,
                    // Note: targetSchoolId per student is handled inside studentDecisionsList
                },
                { headers: headers() }
            )
            setPromotionResult(res.data)
            setPromotionStep(3)
            fetchAll()
        } catch (err) {
            alert(err.response?.data?.message || 'Qalad ayaa dhacay')
        } finally {
            setPromoting(false)
        }
    }

    // Helper: count decisions by action
    const countDecisions = (action) => {
        if (action === 'all') return Object.keys(studentDecisions).length
        return Object.values(studentDecisions).filter(d => d.action === action).length
    }

    const fmt = (dateStr) => {
        if (!dateStr) return '—'
        return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    }

    return (
        <Layout title="Academic Years & Terms">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-2xl font-black text-slate-800">Sanadaha Waxbarashada</h2>
                    <p className="text-gray-400 text-sm">Academic Years, Terms, iyo Year-End Management</p>
                </div>
                <button onClick={() => setShowYearModal(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-100 transition-all flex items-center gap-2">
                    <span className="text-lg">＋</span> Sanad Cusub
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-32">
                    <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : years.length === 0 ? (
                <div className="bg-white rounded-3xl p-20 text-center border-2 border-dashed border-gray-100">
                    <span className="text-5xl mb-4 block">📅</span>
                    <h3 className="text-gray-400 font-bold uppercase tracking-widest text-sm mb-2">Sanad waxbarasho ma jiro</h3>
                    <button onClick={() => setShowYearModal(true)} className="mt-4 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all">+ Abuur Sanad</button>
                </div>
            ) : (
                <div className="space-y-6">
                    {years.map(year => {
                        const expired = isExpired(year)
                        return (
                            <div key={year.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                                {/* ⚠️ Year-End Warning Banner */}
                                {expired && (
                                    <div className="bg-amber-50 border-b-2 border-amber-300 px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl animate-bounce">⚠️</span>
                                            <div>
                                                <p className="font-black text-amber-800 text-sm">Sanadkani wuu dhammaday laakiin weli active yahay!</p>
                                                <p className="text-amber-600 text-xs font-bold mt-0.5">
                                                    Dhammaadkii: {fmt(year.endDate)} — Fadlan year-end actions samee si nidaam u ahaado
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 flex-wrap">
                                            <button onClick={() => openYearEndReport(year)}
                                                className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2">
                                                📊 Year-End Report
                                            </button>
                                            <button onClick={() => openPromoteModal(year)}
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2">
                                                🎓 Promote Students
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Year Header */}
                                <div className={`p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${year.isCurrent ? 'bg-indigo-600' : 'bg-slate-800'}`}>
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 rounded-xl bg-white/10"><span className="text-2xl">📅</span></div>
                                        <div>
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <h3 className="text-xl font-black text-white">{year.name}</h3>
                                                {year.isCurrent && !expired && (
                                                    <span className="bg-white text-indigo-600 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">✓ Hadda Socda</span>
                                                )}
                                                {expired && (
                                                    <span className="bg-amber-400 text-amber-900 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest animate-pulse">⚠ Dhammaday</span>
                                                )}
                                                {!year.isCurrent && (
                                                    <span className="bg-slate-700 text-slate-400 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Archived</span>
                                                )}
                                            </div>
                                            <p className="text-white/60 text-xs font-bold mt-1 uppercase tracking-widest">{fmt(year.startDate)} → {fmt(year.endDate)}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 flex-wrap">
                                        <button onClick={() => {
                                            setEditingYear(year)
                                            setYearForm({
                                                name: year.name,
                                                startDate: year.startDate?.split('T')[0] || '',
                                                endDate: year.endDate?.split('T')[0] || '',
                                                isCurrent: year.isCurrent
                                            })
                                            setShowYearModal(true)
                                        }}
                                            className="bg-white/10 hover:bg-white text-white hover:text-slate-900 border border-white/20 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all">
                                            ✏️ Edit
                                        </button>
                                        <button onClick={() => openYearEndReport(year)}
                                            className="bg-white/10 hover:bg-white text-white hover:text-slate-900 border border-white/20 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all">
                                            📊 Report
                                        </button>
                                        {/* REMOVED: Manual Set as Current button to enforce promotion-based transitions */}
                                        {year.isCurrent && (
                                            <button onClick={() => openPromoteModal(year)}
                                                className="bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/20 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all">
                                                🎓 Promote
                                            </button>
                                        )}
                                        <button onClick={() => { setSelectedYear(year); setShowTermModal(true) }}
                                            className="bg-white/10 hover:bg-white text-white hover:text-slate-900 border border-white/20 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all">
                                            + Term
                                        </button>
                                        <button onClick={() => handleDeleteYear(year.id)}
                                            className="bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/10 px-3 py-2 rounded-xl transition-all">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                </div>

                                {/* Terms */}
                                <div className="p-6 bg-slate-50/50">
                                    {(!year.Terms || year.Terms.length === 0) ? (
                                        <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-2xl">
                                            <p className="text-slate-400 text-sm font-bold">Sanadkan Terms lama abuuri</p>
                                            <button onClick={() => { setSelectedYear(year); setShowTermModal(true) }}
                                                className="mt-3 text-indigo-600 font-black text-xs underline hover:no-underline">
                                                + Term Cusub Abuur
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {year.Terms.map(term => (
                                                <div key={term.id} className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm flex justify-between items-start">
                                                    <div>
                                                        <div className="font-black text-slate-800 text-sm">{term.name}</div>
                                                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{fmt(term.startDate)} → {fmt(term.endDate)}</div>
                                                    </div>
                                                    <button onClick={() => handleDeleteTerm(term.id)}
                                                        className="text-red-400 hover:text-red-600 transition-colors p-1 rounded-lg hover:bg-red-50">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* ─── CREATE/EDIT ACADEMIC YEAR MODAL ─── */}
            {showYearModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
                            <h3 className="text-xl font-black">{editingYear ? 'Bedel Sanad Waxbarasho' : 'Sanad Waxbarasho Cusub'}</h3>
                            <button onClick={() => { setShowYearModal(false); setEditingYear(null); }} className="text-slate-400 hover:text-white text-2xl">✕</button>
                        </div>
                        <form onSubmit={handleSaveYear} className="p-6 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Magaca Sanadka</label>
                                <input required className="w-full p-3 rounded-xl border border-slate-200 font-bold text-slate-700 focus:outline-none focus:border-indigo-400"
                                    placeholder="tusaale: 2025-2026" value={yearForm.name}
                                    onChange={e => setYearForm({ ...yearForm, name: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Bilow</label>
                                    <input required type="date" className="w-full p-3 rounded-xl border border-slate-200 font-bold focus:outline-none focus:border-indigo-400"
                                        value={yearForm.startDate} onChange={e => setYearForm({ ...yearForm, startDate: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Dhamaan</label>
                                    <input required type="date" className="w-full p-3 rounded-xl border border-slate-200 font-bold focus:outline-none focus:border-indigo-400"
                                        value={yearForm.endDate} onChange={e => setYearForm({ ...yearForm, endDate: e.target.value })} />
                                </div>
                            </div>
                            {/* REMOVED: Manual isCurrent checkbox during creation to enforce promotion workflow */}
                            <button type="submit" disabled={submitting}
                                className={`w-full ${submitting ? 'bg-gray-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'} text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2`}>
                                {submitting ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Abuuraya...</> : 'Abuur Sanad'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ─── CREATE TERM MODAL ─── */}
            {showTermModal && selectedYear && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="bg-emerald-600 p-6 text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-black">Term Cusub</h3>
                                <p className="text-emerald-200 text-xs font-bold mt-1 uppercase tracking-widest">{selectedYear.name}</p>
                            </div>
                            <button onClick={() => setShowTermModal(false)} className="text-white/60 hover:text-white text-2xl">✕</button>
                        </div>
                        <form onSubmit={handleCreateTerm} className="p-6 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Magaca Term-ka</label>
                                <input required className="w-full p-3 rounded-xl border border-slate-200 font-bold text-slate-700 focus:outline-none focus:border-emerald-400"
                                    placeholder="tusaale: Term 1, Qaybta Kowaad" value={termForm.name}
                                    onChange={e => setTermForm({ ...termForm, name: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Bilow</label>
                                    <input required type="date" className="w-full p-3 rounded-xl border border-slate-200 font-bold focus:outline-none focus:border-emerald-400"
                                        value={termForm.startDate} onChange={e => setTermForm({ ...termForm, startDate: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Dhamaan</label>
                                    <input required type="date" className="w-full p-3 rounded-xl border border-slate-200 font-bold focus:outline-none focus:border-emerald-400"
                                        value={termForm.endDate} onChange={e => setTermForm({ ...termForm, endDate: e.target.value })} />
                                </div>
                            </div>
                            <button type="submit" disabled={submitting}
                                className={`w-full ${submitting ? 'bg-gray-300 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'} text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2`}>
                                {submitting ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Abuuraya...</> : '+ Abuur Term'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ─── YEAR-END REPORT MODAL ─── */}
            {showReportModal && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4 z-[100]">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <span className="bg-amber-500 text-slate-900 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Year-End Report</span>
                                </div>
                                <h3 className="text-3xl font-black">{selectedYear?.name}</h3>
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">{fmt(selectedYear?.startDate)} → {fmt(selectedYear?.endDate)}</p>
                            </div>
                            <button onClick={() => setShowReportModal(false)} className="text-slate-400 hover:text-white text-3xl w-12 h-12 flex items-center justify-center bg-white/5 rounded-2xl hover:bg-white/10 transition-all">✕</button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8">
                            {reportLoading ? (
                                <div className="flex items-center justify-center py-24">
                                    <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            ) : !yearEndReport ? (
                                <div className="text-center py-24 text-slate-400 font-bold">Xog ma heli karin</div>
                            ) : (
                                <div className="space-y-8">
                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {[
                                            { label: 'Ardayda Guud', value: yearEndReport.stats.totalStudents, color: 'bg-indigo-50 text-indigo-600', icon: '👨‍🎓' },
                                            { label: 'Imtixaannada', value: yearEndReport.stats.totalExams, color: 'bg-blue-50 text-blue-600', icon: '📝' },
                                            { label: 'Baasay ✓', value: yearEndReport.stats.passCount, color: 'bg-emerald-50 text-emerald-600', icon: '✅' },
                                            { label: 'Ku Dhacay ✗', value: yearEndReport.stats.failCount, color: 'bg-red-50 text-red-500', icon: '❌' },
                                        ].map((stat, i) => (
                                            <div key={i} className={`${stat.color} rounded-2xl p-5 text-center`}>
                                                <div className="text-3xl mb-2">{stat.icon}</div>
                                                <div className="text-3xl font-black">{stat.value}</div>
                                                <div className="text-[10px] font-black uppercase tracking-widest mt-1 opacity-70">{stat.label}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Top Students */}
                                    {yearEndReport.topStudents?.length > 0 && (
                                        <div>
                                            <h4 className="font-black text-slate-800 text-sm uppercase tracking-widest mb-4 flex items-center gap-2">
                                                <span>🏆</span> Ardayda Ugu Fiican Sanadkan
                                            </h4>
                                            <div className="space-y-3">
                                                {yearEndReport.topStudents.map((s, i) => (
                                                    <div key={s.id} className="bg-slate-50 rounded-2xl p-4 flex items-center justify-between gap-4">
                                                        <div className="flex items-center gap-4">
                                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg ${i === 0 ? 'bg-amber-400 text-amber-900' : i === 1 ? 'bg-slate-300 text-slate-700' : i === 2 ? 'bg-orange-300 text-orange-800' : 'bg-slate-100 text-slate-500'}`}>
                                                                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                                                            </div>
                                                            <div>
                                                                <div className="font-black text-slate-800">{s.name}</div>
                                                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{s.count} imtixaan</div>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-2xl font-black text-indigo-600">{s.percentage}%</div>
                                                            <div className="text-[10px] text-slate-400 font-bold">{s.totalMarks} / {s.maxMarks}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {yearEndReport.allStudents?.length === 0 && (
                                        <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
                                            <p className="text-slate-400 font-bold">Sanadkaan xog imtixaan ah lama gelin — Terms-ka ku xidna exams ma jiraan</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-slate-100 flex justify-between items-center">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Generated {new Date().toLocaleDateString()}</p>
                            <div className="flex gap-3">
                                <button onClick={() => { setShowReportModal(false); openPromoteModal(selectedYear) }}
                                    className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all">
                                    🎓 Promote Students
                                </button>
                                <button onClick={() => setShowReportModal(false)}
                                    className="bg-slate-100 text-slate-600 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">
                                    Xir
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── SMART STUDENT PROMOTION MODAL (3-STEP WIZARD) ─── */}
            {showPromoteModal && selectedYear && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 z-[110]">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full overflow-hidden flex flex-col"
                        style={{ maxWidth: promotionStep === 2 ? '900px' : '640px', maxHeight: '92vh' }}>

                        {/* === MODAL HEADER === */}
                        <div className={`p-6 text-white flex-shrink-0 ${
                            promotionStep === 1 ? 'bg-gradient-to-r from-indigo-700 to-indigo-600' :
                            promotionStep === 2 ? 'bg-gradient-to-r from-slate-800 to-slate-700' :
                            'bg-gradient-to-r from-emerald-600 to-emerald-500'
                        }`}>
                            <div className="flex justify-between items-start">
                                <div>
                                    {/* Step Indicator */}
                                    <div className="flex items-center gap-2 mb-3">
                                        {[1,2,3].map(s => (
                                            <div key={s} className="flex items-center gap-2">
                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all ${
                                                    s < promotionStep ? 'bg-white text-indigo-700 border-white' :
                                                    s === promotionStep ? 'bg-white/20 text-white border-white' :
                                                    'bg-transparent text-white/40 border-white/30'
                                                }`}>
                                                    {s < promotionStep ? '✓' : s}
                                                </div>
                                                {s < 3 && <div className={`w-8 h-0.5 ${ s < promotionStep ? 'bg-white' : 'bg-white/30'}`}></div>}
                                            </div>
                                        ))}
                                        <span className="text-white/60 text-[10px] font-black uppercase tracking-widest ml-2">
                                            {promotionStep === 1 ? 'Qorsheynta' : promotionStep === 2 ? 'Dib u Eegista' : 'Dhammaad'}
                                        </span>
                                    </div>
                                    <h3 className="text-2xl font-black">
                                        {promotionStep === 1 && `${selectedYear?.name} — Promote Ardayda`}
                                        {promotionStep === 2 && `Ardayda Dib u Eeg (${previewStudents.length} arday)`}
                                        {promotionStep === 3 && 'Si Guul leh Dhammaaday! 🎉'}
                                    </h3>
                                    <p className="text-white/60 text-xs font-bold mt-1">
                                        {promotionStep === 1 && 'Fasalkasta u dooro fasalka xiga ee sanadka cusub'}
                                        {promotionStep === 2 && 'Ardayda kasta xaqiiji go\'aanka — promote, retain, ama graduate'}
                                        {promotionStep === 3 && 'Ardayda waa si guul leh loo gudbiyey sanadka cusub'}
                                    </p>
                                </div>
                                <button onClick={() => setShowPromoteModal(false)}
                                    className="text-white/60 hover:text-white text-2xl w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10 transition-all">
                                    ✕
                                </button>
                            </div>
                        </div>

                        {/* === STEP 1: CLASS MAPPING === */}
                        {promotionStep === 1 && (
                            <>
                                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                    {/* 📦 VERSION TAG */}
                                    <div className="text-[10px] font-black text-emerald-500 bg-emerald-50 px-3 py-1 rounded-lg w-fit mb-6">SYSTEM VERSION: V2.4 (SEP)</div>

                                    {/* Target Year remains global as academic years are usually synchronized */}
                                    <div className="bg-white border-2 border-indigo-100 rounded-[2rem] p-8 mb-6 shadow-xl shadow-indigo-100/20">
                                        <div className="flex items-center gap-4 mb-6">
                                            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                            </div>
                                            <div>
                                                <h4 className="text-xl font-black text-slate-800 tracking-tight">SANADKA LOO GUDBAYO</h4>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Dooro sanadka cusub ee ardayda loo dallacsiinayo</p>
                                            </div>
                                        </div>
                                            <select
                                                className="w-full p-4 rounded-2xl border-2 border-indigo-100 font-black text-slate-800 bg-white focus:outline-none focus:border-indigo-500"
                                                value={targetYearId}
                                                onChange={e => setTargetYearId(e.target.value)}
                                                disabled={targetLoading}
                                            >
                                                <option value="">-- Dooro Sanadka Loo Gudbayo --</option>
                                                {targetYears.map(y => (
                                                    <option key={y.id} value={y.id}>
                                                        {y.name} {y.isCurrent ? '(Active)' : ''}
                                                    </option>
                                                ))}
                                            </select>
                                    </div>


                                    {/* Class Mappings */}
                                    <div>
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-3">Fasalkasta meesha uu u socdo u dooro</label>
                                        <div className="space-y-4">
                                            {classes.map((cls, idx) => {
                                                const promo = promotions[idx] || {}
                                                const currentRowClasses = schoolClassesCache[promo.targetSchoolId || 'local'] || []
                                                
                                                return (
                                                    <div key={cls.id} className="bg-white rounded-3xl p-6 border-2 border-slate-100 shadow-sm hover:border-indigo-200 transition-all">
                                                        <div className="flex flex-col gap-4">
                                                            {/* Row Header: Current Class */}
                                                            <div className="flex items-center justify-between border-b border-slate-50 pb-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-black text-xs">
                                                                        {idx + 1}
                                                                    </div>
                                                                    <div>
                                                                        <div className="font-black text-slate-800 text-sm">{cls.class_name}</div>
                                                                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Fasalka Hadda</div>
                                                                    </div>
                                                                </div>
                                                                <div className="hidden sm:block text-slate-200 font-black text-xl">→</div>
                                                            </div>

                                                             {/* Destination & Target Class Group */}
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                {/* 1. Destination Selection */}
                                                                <div>
                                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Meesha Loo Wareejinayo</label>
                                                                    <select
                                                                        className="w-full p-3 rounded-xl border-2 border-slate-100 font-bold text-xs focus:outline-none focus:border-indigo-400 bg-slate-50"
                                                                        value={promo.targetSchoolId || ''}
                                                                        onChange={e => handleRowSchoolChange(idx, e.target.value)}
                                                                    >
                                                                        <option value="">ISLA DUGSIGAN (LOCAL)</option>
                                                                        {managedSchools.filter(s => s.id !== selectedYear.schoolId).map(s => (
                                                                            <option key={s.id} value={s.id}>DUGSI KALE: {s.name}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                                {/* 2. Target Class Selection */}
                                                                <div>
                                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Fasalka Uu Gelayo</label>
                                                                    <select
                                                                        disabled={targetLoading && promo.targetSchoolId && !currentRowClasses.length}
                                                                        className={`w-full p-3 rounded-xl border-2 font-bold text-xs focus:outline-none transition-all ${
                                                                            promo.toClassId === 'graduate' ? 'border-amber-300 bg-amber-50 text-amber-900' :
                                                                            promo.toClassId ? 'border-emerald-300 bg-emerald-50 text-emerald-900' :
                                                                            'border-slate-100 bg-white text-slate-400'
                                                                        }`}
                                                                        value={promo.toClassId || ''}
                                                                        onChange={e => {
                                                                            const updated = [...promotions]
                                                                            updated[idx] = { ...updated[idx], toClassId: e.target.value }
                                                                            setPromotions(updated)
                                                                        }}
                                                                    >
                                                                        <option value="">— Ha promote garayn —</option>
                                                                        {currentRowClasses.map(c => (
                                                                            <option key={c.id} value={c.id}>{c.class_name}</option>
                                                                        ))}
                                                                        <option value="graduate">🎓 Qalin-jabi (Graduate)</option>
                                                                    </select>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                                        <span className="text-xl flex-shrink-0">⚠️</span>
                                        <p className="text-amber-700 font-bold text-xs leading-relaxed">
                                            Xiga waxaad arki doontaa ardayda kasta oo leh natiijadooda. Waxaad badeli kartaa go&apos;aanka ardayda kasta ka hor inta aadan xaqiijin.
                                        </p>
                                    </div>
                                </div>
                                <div className="p-6 border-t border-slate-100 flex justify-between items-center gap-4 flex-shrink-0">
                                    <button onClick={() => setShowPromoteModal(false)}
                                        className="px-6 py-3 rounded-xl border-2 border-slate-200 font-black text-slate-500 hover:bg-slate-50 text-xs uppercase tracking-widest transition-all">
                                        Xir
                                    </button>
                                    <button
                                        onClick={handleFetchPreview}
                                        disabled={previewLoading || !targetYearId || targetLoading}
                                        className={`px-8 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all flex items-center gap-2 ${
                                            previewLoading || !targetYearId || targetLoading
                                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200'
                                        }`}
                                    >
                                        {previewLoading
                                            ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Soo qaadaya...</>
                                            : <>Eeg Ardayda Preview →</>}
                                    </button>
                                </div>
                            </>
                        )}

                        {/* === STEP 2: PREVIEW TABLE === */}
                        {promotionStep === 2 && (
                            <>
                                <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
                                    {/* Stats Bar */}
                                    <div className="grid grid-cols-4 gap-3 p-5 bg-slate-50 border-b border-slate-100 flex-shrink-0">
                                        {[
                                            { label: 'Guud Ahaan', value: previewStudents.length, color: 'bg-slate-100 text-slate-700', icon: '👥' },
                                            { label: 'Promote', value: countDecisions('promote'), color: 'bg-emerald-50 text-emerald-700', icon: '⬆️' },
                                            { label: 'Retain', value: countDecisions('retain'), color: 'bg-red-50 text-red-600', icon: '⏸' },
                                            { label: 'Graduate', value: countDecisions('graduate'), color: 'bg-amber-50 text-amber-700', icon: '🎓' },
                                        ].map((s, i) => (
                                            <div key={i} className={`${s.color} rounded-xl p-3 text-center relative overflow-hidden`}>
                                                <div className="text-2xl font-black relative z-10">{s.value}</div>
                                                <div className="text-[10px] font-black uppercase tracking-widest mt-0.5 opacity-70 relative z-10">{s.label}</div>
                                                <span className="absolute -right-2 -bottom-2 text-4xl opacity-10 grayscale">{s.icon}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Cross-School Info Badge */}
                                    {targetSchoolId && (
                                        <div className="px-5 py-2 bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                                            <span>🚀 WAREERJIN:</span>
                                            <span>{selectedYear.school?.name || 'Current'}</span>
                                            <span>→</span>
                                            <span>{managedSchools.find(s => s.id === targetSchoolId)?.name || 'Target'}</span>
                                        </div>
                                    )}

                                    {/* Filters */}
                                    <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 flex-shrink-0 flex-wrap">
                                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Filter:</span>
                                        {['all', 'promote', 'retain', 'graduate'].map(f => (
                                            <button key={f}
                                                onClick={() => setFilterAction(f)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                                                    filterAction === f
                                                        ? 'bg-indigo-600 text-white'
                                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                }`}
                                            >
                                                {f === 'all' ? 'Dhamaan' : f === 'promote' ? '⬆ Promote' : f === 'retain' ? '⏸ Retain' : '🎓 Graduate'}
                                            </button>
                                        ))}
                                        <select
                                            className="ml-auto p-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 focus:outline-none"
                                            value={filterClass}
                                            onChange={e => setFilterClass(e.target.value)}
                                        >
                                            <option value="all">Fasalka Dhamaan</option>
                                            {[...new Set(previewStudents.map(s => s.currentClassId))].map(cid => {
                                                const cls = classes.find(c => c.id === cid)
                                                return <option key={cid} value={cid}>{cls?.class_name || cid}</option>
                                            })}
                                        </select>
                                    </div>

                                    {/* Table */}
                                    <div className="flex-1 overflow-y-auto">
                                        <table className="w-full text-sm">
                                            <thead className="sticky top-0 bg-white border-b border-slate-100 z-10">
                                                <tr>
                                                    <th className="text-left px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ardayga</th>
                                                    <th className="text-center px-3 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fasalka</th>
                                                    <th className="text-center px-3 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Score</th>
                                                    <th className="text-center px-3 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Natiijada</th>
                                                    <th className="text-center px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Go&apos;aanka Admin</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {previewStudents
                                                    .filter(s => {
                                                        const dec = studentDecisions[s.enrollmentId]
                                                        const actionMatch = filterAction === 'all' || dec?.action === filterAction
                                                        const classMatch = filterClass === 'all' || s.currentClassId === filterClass
                                                        return actionMatch && classMatch
                                                    })
                                                    .map((s, idx) => {
                                                        const dec = studentDecisions[s.enrollmentId] || {}
                                                        const isPromote = dec.action === 'promote'
                                                        const isRetain = dec.action === 'retain'
                                                        const isGraduate = dec.action === 'graduate'
                                                        const passThreshold = s.percentage >= 50
                                                        return (
                                                            <tr key={s.enrollmentId} className={`hover:bg-slate-50 transition-colors ${
                                                                isGraduate ? 'bg-amber-50/40' :
                                                                isRetain ? 'bg-red-50/40' : ''
                                                            }`}>
                                                                <td className="px-5 py-3">
                                                                    <div className="font-bold text-slate-800">{s.studentName}</div>
                                                                    <div className="text-[10px] text-slate-400 font-bold">{s.student_id}</div>
                                                                </td>
                                                                <td className="px-3 py-3 text-center">
                                                                    <span className="bg-slate-100 text-slate-600 text-[10px] font-black px-2 py-1 rounded-lg">{s.currentClassName}</span>
                                                                </td>
                                                                <td className="px-3 py-3 text-center">
                                                                    <div className={`text-lg font-black ${
                                                                        s.percentage >= 70 ? 'text-emerald-600' :
                                                                        s.percentage >= 50 ? 'text-blue-600' :
                                                                        'text-red-500'
                                                                    }`}>{s.percentage}%</div>
                                                                </td>
                                                                <td className="px-3 py-3 text-center">
                                                                    <span className={`text-[10px] font-black px-2 py-1 rounded-full ${
                                                                        passThreshold
                                                                            ? 'bg-emerald-100 text-emerald-700'
                                                                            : 'bg-red-100 text-red-600'
                                                                    }`}>
                                                                        {passThreshold ? '✅ Baasay' : '❌ Fashalay'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-5 py-3 text-center">
                                                                    <select
                                                                        className={`p-2 rounded-xl border font-bold text-xs focus:outline-none transition-all ${
                                                                            isPromote ? 'border-emerald-300 bg-emerald-50 text-emerald-700' :
                                                                            isRetain ? 'border-red-300 bg-red-50 text-red-600' :
                                                                            isGraduate ? 'border-amber-300 bg-amber-50 text-amber-700' :
                                                                            'border-slate-200 bg-white text-slate-600'
                                                                        }`}
                                                                        value={dec.action || 'retain'}
                                                                        onChange={e => {
                                                                            const newAction = e.target.value
                                                                            const mapping = promotions.find(p => p.fromClassId === s.currentClassId)
                                                                            setStudentDecisions(prev => ({
                                                                                ...prev,
                                                                                [s.enrollmentId]: {
                                                                                    action: newAction,
                                                                                    targetClassId: newAction === 'graduate' ? 'graduate' :
                                                                                                   newAction === 'retain' ? s.currentClassId :
                                                                                                   mapping?.toClassId || s.currentClassId
                                                                                }
                                                                            }))
                                                                        }}
                                                                    >
                                                                        <option value="promote">⬆️ Promote</option>
                                                                        <option value="retain">⏸ Retain</option>
                                                                        <option value="graduate">🎓 Graduate</option>
                                                                    </select>
                                                                </td>
                                                            </tr>
                                                        )
                                                    })}
                                                {previewStudents.filter(s => {
                                                    const dec = studentDecisions[s.enrollmentId]
                                                    const actionMatch = filterAction === 'all' || dec?.action === filterAction
                                                    const classMatch = filterClass === 'all' || s.currentClassId === filterClass
                                                    return actionMatch && classMatch
                                                }).length === 0 && (
                                                    <tr><td colSpan={5} className="text-center py-16 text-slate-400 font-bold">Arday kuma helin fiilerkan</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="p-5 border-t border-slate-100 flex justify-between items-center gap-4 flex-shrink-0 bg-white">
                                    <button onClick={() => setPromotionStep(1)}
                                        className="px-5 py-2.5 rounded-xl border-2 border-slate-200 font-black text-slate-500 hover:bg-slate-50 text-xs uppercase tracking-widest transition-all flex items-center gap-2">
                                        ← Dib
                                    </button>
                                    <div className="flex items-center gap-3">
                                        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">
                                            <p className="text-amber-700 font-black text-xs">⚠️ Ficilkan dib looma celin karo!</p>
                                        </div>
                                        <button
                                            onClick={handlePublishPromotion}
                                            disabled={promoting}
                                            className={`px-8 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all flex items-center gap-2 ${
                                                promoting
                                                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200'
                                            }`}
                                        >
                                            {promoting
                                                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Haya...</>
                                                : <>🎓 Xaqiiji &amp; Fur Sanadka Cusub</>}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* === STEP 3: SUCCESS === */}
                        {promotionStep === 3 && promotionResult && (
                            <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center justify-center">
                                <div className="text-8xl mb-4 animate-bounce">🎉</div>
                                <h3 className="text-3xl font-black text-slate-800 mb-2 text-center">Si Guul leh Dhammaaday!</h3>
                                <p className="text-slate-500 font-bold text-center mb-8">{promotionResult.message}</p>

                                <div className="w-full max-w-sm space-y-3">
                                    {[
                                        { label: 'Arday la Promote garey', value: countDecisions('promote'), icon: '⬆️', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
                                        { label: 'Arday la Retain garey', value: countDecisions('retain'), icon: '⏸', color: 'bg-red-50 border-red-200 text-red-600' },
                                        { label: 'Arday la Qalin-jabiyay', value: countDecisions('graduate'), icon: '🎓', color: 'bg-amber-50 border-amber-200 text-amber-700' },
                                    ].filter(s => s.value > 0).map((s, i) => (
                                        <div key={i} className={`${s.color} border rounded-2xl p-4 flex items-center justify-between`}>
                                            <span className="font-bold flex items-center gap-2">{s.icon} {s.label}</span>
                                            <span className="text-2xl font-black">{s.value}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-6 bg-indigo-50 border border-indigo-100 rounded-2xl px-6 py-4 text-center">
                                    <p className="text-indigo-700 font-bold text-sm">✅ Sanadka Cusub: <span className="font-black">{promotionResult.targetYear}</span></p>
                                    <p className="text-indigo-500 text-xs font-bold mt-1">Sanadkii hore waa la xiray — Sanadka cusub waa la furay</p>
                                </div>

                                <button onClick={() => setShowPromoteModal(false)}
                                    className="mt-8 bg-slate-800 hover:bg-slate-900 text-white px-10 py-3 rounded-2xl font-black transition-all">
                                    Xir
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </Layout>
    )
}
