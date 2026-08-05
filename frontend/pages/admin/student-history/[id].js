import Layout from '../../../components/Layout'
import { useEffect, useState, useRef } from 'react'
import axios from 'axios'
import { useRouter } from 'next/router'
import StudentResultsView from '../../../components/exams/StudentResultsView'
import { getImageUrl } from '../../../utils/imageHelper'

export default function StudentHistory() {
    const router = useRouter()
    const { id } = router.query
    const [student, setStudent] = useState(null)
    const [results, setResults] = useState([])
    const [apiError, setApiError] = useState(null)
    const [fullExamData, setFullExamData] = useState(null)
    const [attendance, setAttendance] = useState([])
    const [payments, setPayments] = useState([])
    const [loading, setLoading] = useState(true)
    const [attLoading, setAttLoading] = useState(false)
    const [activeTab, setActiveTab] = useState('academic')
    const [schoolInfo, setSchoolInfo] = useState({})
    const [academicYears, setAcademicYears] = useState([])
    const [selectedYearId, setSelectedYearId] = useState('')
    const [generatingAI, setGeneratingAI] = useState(false)
    const initialLoadDone = useRef(false)
    const [fetching, setFetching] = useState(false)


    // ===== FILTERS =====
    // Academic filters
    const [subjectFilter, setSubjectFilter] = useState('')
    const [examTypeFilter, setExamTypeFilter] = useState('')
    // Attendance filters
    const [attStatusFilter, setAttStatusFilter] = useState('')
    const [attMonthFilter, setAttMonthFilter] = useState('')
    // Payment filters
    const [payMonthFilter, setPayMonthFilter] = useState('')
    const [payYearFilter, setPayYearFilter] = useState('')
    const [payMethodFilter, setPayMethodFilter] = useState('')

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    const fetchData = async () => {
        if (!id) return
        setLoading(true)
        setStudent(null)
        setResults([])
        try {
            // Read schoolInfo from localStorage (set by Layout component on login)
            const savedSchoolInfo = typeof window !== 'undefined'
                ? JSON.parse(localStorage.getItem('schoolInfo') || '{}')
                : {}
            if (savedSchoolInfo?.name) setSchoolInfo(savedSchoolInfo)

            // Fetch student info, payments AND academic years all in parallel — 1 round-trip instead of 2
            const [sRes, pRes, yRes] = await Promise.all([
                axios.get(`${apiUrl}/api/students/${id}`, { headers: headers() }),
                axios.get(`${apiUrl}/api/payments?studentId=${id}`, { headers: headers() }),
                axios.get(`${apiUrl}/api/exams/student-history-years/${id}`, { headers: headers() }).catch(() => ({ data: [] }))
            ])
            setStudent(sRes.data)
            setPayments(Array.isArray(pRes.data) ? pRes.data : [])

            // Resolve academic year from the years response
            let resolvedYearId = ''
            const years = yRes.data || []
            setAcademicYears(years)
            if (years.length > 0) {
                const current = years.find(y => y.isCurrent) || years[0]
                setSelectedYearId(current.id)
                resolvedYearId = current.id
            }

            // Fetch results AND attendance in parallel — saves another round-trip
            await Promise.all([
                fetchResults(id, resolvedYearId),
                fetchAttendance(id, resolvedYearId)
            ])

        } catch (e) {
            console.error('History fetch error:', e)
            setApiError(e.response?.data?.message || e.message)
            if (e.response?.data?.details) {
                console.error('Error details:', e.response.data.details)
                setApiError(prev => `${prev} (${e.response.data.details})`)
            }
        } finally {
            setLoading(false)
        }
    }

    const fetchResults = async (studentId, yearId) => {
        setFetching(true)
        setResults([]) // Clear stale data
        console.log(`[History] Fetching results for student: ${studentId}, year: ${yearId}`)

        try {
            const yearParam = yearId ? `?academicYearId=${yearId}` : ''
            const eRes = await axios.get(`${apiUrl}/api/exams/student/${studentId}${yearParam}`, { headers: headers() })
            const payload = eRes.data?.data || eRes.data
            const subjects = payload?.subjects || payload?.results || (Array.isArray(payload) ? payload : [])
            
            console.log(`[History] Results received: ${subjects.length} subjects. Backend year: ${payload?.academicYearId}`)
            
            setResults(subjects)
            setFullExamData(payload)

            if (payload?.academicYearId && payload.academicYearId !== yearId) {
                console.warn(`[History] Syncing dropdown: ${yearId} -> ${payload.academicYearId}`)
                setSelectedYearId(payload.academicYearId)
            }
        } catch (e) {
            console.error('Results fetch error:', e.response?.data || e.message)
            setResults([])
        } finally {
            setFetching(false)
        }
    }


    const fetchAttendance = async (studentId, yearId) => {
        const sid = studentId || id
        const yid = yearId !== undefined ? yearId : selectedYearId
        // Guard: don't start if no student id
        if (!sid) return

        setFetching(true)
        setAttendance([]) // Clear stale data
        setAttLoading(true)
        try {
            const yearParam = yid ? `?academicYearId=${yid}` : ''
            const res = await axios.get(`${apiUrl}/api/attendance/student/${sid}${yearParam}`, { headers: headers() })
            setAttendance(res.data || [])
        } catch (e) {
            console.error('Attendance fetch error:', e)
            setAttendance([])
        } finally {
            setAttLoading(false)
            setFetching(false)
        }
    }

    const handleDownloadPDF = async () => {
        const { default: jsPDF } = await import('jspdf')
        const { default: autoTable } = await import('jspdf-autotable')

        const doc = new jsPDF()
        const schoolName = schoolInfo.name || 'Dugsi Pro System'
        const selectedYearName = academicYears.find(y => y.id === selectedYearId)?.name || 'Current Session'

        doc.setFontSize(20)
        doc.setFont(undefined, 'bold')
        
        let headerY = 15
        let textX = 105

        // Handle Logo
        if (schoolInfo.logo) {
            try {
                const logoUrl = getImageUrl(schoolInfo.logo)
                const img = new Image()
                img.src = logoUrl
                img.crossOrigin = 'Anonymous'
                await new Promise((resolve) => {
                    img.onload = resolve
                    img.onerror = (err) => {
                        console.error('Logo Load Error:', err)
                        resolve()
                    }
                    // Timeout after 2 seconds
                    setTimeout(resolve, 2000)
                })

                if (img.complete && img.naturalWidth > 0) {
                    // Draw logo on the left
                    doc.addImage(img, 'PNG', 20, 10, 25, 25)
                    // Offset text to the right or keep centered but adjust Y
                    headerY = 20
                }
            } catch (e) {
                console.error('Logo Processing Error:', e)
            }
        }

        doc.text(schoolName, 105, headerY, { align: 'center' })
        doc.setFontSize(14)
        doc.setFont(undefined, 'normal')
        doc.text('Student Comprehensive History Report', 105, headerY + 10, { align: 'center' })
        doc.setFontSize(10)
        doc.text(`Academic Year: ${selectedYearName}`, 105, headerY + 15, { align: 'center' })
        doc.line(20, headerY + 18, 190, headerY + 18)

        doc.setFontSize(12)
        doc.text(`Name: ${student.user?.name}`, 20, headerY + 28)
        doc.text(`ID: ${student.student_id}`, 20, headerY + 36)
        doc.text(`Class: ${fullExamData?.student?.className || student.clss?.class_name || student.class_name || 'N/A'}`, 130, headerY + 28)
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 130, headerY + 36)

        doc.setFontSize(14)
        doc.text('Academic History', 20, headerY + 48)
        
        // ... (rest of the content will follow)
        // Adjust startY for autoTable
        const tableStartY = headerY + 53
        
        // Helper to calculate grade (local fallback or from backend data)
        const getGrade = (sub) => {
            if (sub.grade) return sub.grade;
            // Fallback calculation if needed (though backend should provide it now)
            const pct = sub.totalMarks ? Math.round((sub.total / sub.totalMarks) * 100) : 0;
            const scales = fullExamData?.gradingScales || [];
            if (scales.length > 0) {
                const match = [...scales].sort((a,b) => b.minScore - a.minScore).find(s => pct >= s.minScore);
                if (match) return match.grade;
            }
            if (pct >= 90) return 'A+';
            if (pct >= 85) return 'B++';
            if (pct >= 80) return 'B-';
            if (pct >= 75) return 'C+';
            if (pct >= 70) return 'C';
            if (pct >= 60) return 'D';
            return 'F';
        };

        const examRows = filteredResults.map(sub => {
            const s = sub.scores || {}
            return [
                sub.name,
                s.bile_1 ?? s.monthly_1 ?? '-',
                s.midterm ?? s.midterm_exam ?? s.term_1 ?? '-',
                s.bile_2 ?? s.monthly_2 ?? '-',
                s.final ?? s.final_term ?? s.Final ?? '-',
                `${sub.total} / ${sub.totalMarks}`,
                getGrade(sub)
            ]
        })
        autoTable(doc, {
            startY: tableStartY,
            head: [['Subject', 'Bile 1', 'Midterm', 'Bile 2', 'Final', 'Total', 'Grade']],
            body: examRows,
            theme: 'grid',
            headStyles: { fillColor: [30, 41, 59] } // Darker slate
        })

        let lastY = doc.lastAutoTable.finalY || 67

        // Add Aggregate Grade to PDF
        const aggGrade = fullExamData?.grade || 'N/A';
        const gTotal = fullExamData?.grandTotal || 0;
        const gMax = fullExamData?.grandMax || 0;
        
        const showAverage = typeof window !== 'undefined' ? localStorage.getItem('results_showAverage') !== 'false' : true;
        
        lastY += 10;
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.text(`Wadarta Guud (Grand Total): ${gTotal} / ${gMax}`, 190, lastY, { align: 'right' });
        if (showAverage) {
            lastY += 7;
            doc.text(`Celceliska: ${Number.isFinite(gTotal) ? (gTotal / 2).toFixed(1).replace(/\.0$/, '') : 0}`, 190, lastY, { align: 'right' });
        }
        lastY += 7;
        doc.text(`Aggregate Grade: ${aggGrade}`, 190, lastY, { align: 'right' });
        lastY += 10;

        if (filteredAttendance.length > 0) {
            const attY = lastY + 5
            doc.setFontSize(14)
            doc.text('Attendance Log', 20, attY)
            const attRows = filteredAttendance.map(a => [
                new Date(a.date).toLocaleDateString(),
                a.session,
                a.status
            ])
            autoTable(doc, {
                startY: attY + 5,
                head: [['Date', 'Session', 'Status']],
                body: attRows,
                theme: 'striped',
                headStyles: { fillColor: [51, 65, 85] }
            })
            lastY = doc.lastAutoTable.finalY
        }

        const finY = lastY + 15
        doc.setFontSize(14)
        doc.text('Payment History', 20, finY)
        const payRows = filteredPayments.map(p => [
            p.description,
            new Date(p.date).toLocaleDateString(),
            p.payment_method,
            `$${p.amount?.toLocaleString()}`
        ])
        autoTable(doc, {
            startY: finY + 5,
            head: [['Description', 'Date', 'Method', 'Amount']],
            body: payRows,
            theme: 'grid',
            headStyles: { fillColor: [51, 65, 85] }
        })

        doc.save(`${student.user?.name?.replace(/\s+/g, '_')}_${selectedYearName.replace(/\s+/g, '_')}_History.pdf`)
    }

    const generateAIInsights = async () => {
        setGeneratingAI(true)
        try {
            const yearParam = selectedYearId ? `?academicYearId=${selectedYearId}` : ''
            const res = await axios.post(`${apiUrl}/api/ai/generate-insight/${id}${yearParam}`, {}, { headers: headers() })
            setStudent({ ...student, aiInsights: res.data.insight })
        } catch (e) {
            alert('Error generating AI insights')
        }
        setGeneratingAI(false)
    }

    // When user manually changes the year dropdown, refetch (but not on first load)
    useEffect(() => {
        if (!id || !selectedYearId) return
        if (!initialLoadDone.current) {
            console.log('[History] Skipping effect for first load')
            initialLoadDone.current = true
            return
        }
        console.log(`[History] Year changed to: ${selectedYearId}`)
        fetchResults(id, selectedYearId)
        fetchAttendance(id, selectedYearId)
    }, [selectedYearId])


    useEffect(() => {
        initialLoadDone.current = false
        fetchData()
    }, [id])

    // ===== DERIVED FILTERED DATA =====
    const allSubjectNames = [...new Set(results.map(r => r.name).filter(Boolean))]
    const allExamTypes = [...new Set(results.flatMap(r => Object.keys(r.scores || {})).filter(Boolean))]
    const allMonths = [...new Set(attendance.map(a => {
        const d = new Date(a.date)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    }).filter(Boolean))].sort()
    const allPayMethods = [...new Set(payments.map(p => p.payment_method).filter(Boolean))]
    const allPayYears = [...new Set(payments.map(p => p.year || new Date(p.date).getFullYear()).filter(Boolean))].sort((a, b) => b - a)

    const filteredResults = results.filter(r => {
        if (subjectFilter && r.name !== subjectFilter) return false
        if (examTypeFilter && !r.scores?.[examTypeFilter]) return false
        return true
    })

    const filteredAttendance = attendance.filter(a => {
        if (attStatusFilter && a.status !== attStatusFilter) return false
        if (attMonthFilter) {
            const d = new Date(a.date)
            const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            if (m !== attMonthFilter) return false
        }
        return true
    })

    const filteredPayments = payments.filter(p => {
        if (payMethodFilter && p.payment_method !== payMethodFilter) return false
        if (payMonthFilter && (p.month || new Date(p.date).getMonth() + 1) !== parseInt(payMonthFilter)) return false
        if (payYearFilter && (p.year || new Date(p.date).getFullYear()) !== parseInt(payYearFilter)) return false
        
        // Filter by selected academic year
        const yearObj = academicYears.find(y => String(y.id) === String(selectedYearId))
        if (yearObj) {
            const payDate = new Date(p.date)
            const start = new Date(yearObj.startDate)
            const end = new Date(yearObj.endDate)
            
            // Normalize to start of day for comparison
            payDate.setHours(0,0,0,0)
            start.setHours(0,0,0,0)
            end.setHours(23,59,59,999)

            if (payDate < start || payDate > end) return false
        }
        
        return true
    })



    const totalPaid = filteredPayments.reduce((sum, p) => sum + (p.amount || 0), 0)
    const presentCount = filteredAttendance.filter(a => a.status === 'Present').length
    const absentCount = filteredAttendance.filter(a => a.status === 'Absent').length
    const grandTotal = filteredResults.reduce((sum, r) => sum + (r.total || 0), 0)

    if (loading) return (
        <Layout title="Loading History...">
            <div className="flex flex-col items-center justify-center p-20 gap-4">
                <div className="animate-spin rounded-full h-14 w-14 border-4 border-blue-600 border-t-transparent"></div>
                <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Loading Student Archive...</p>
            </div>
        </Layout>
    )

    if (!student) return (
        <Layout title="Not Found">
            <div className="flex flex-col items-center justify-center p-20 gap-4">
                <div className="text-5xl">😕</div>
                <p className="text-gray-600 font-bold">{apiError || 'Student not found.'}</p>
                <button onClick={() => router.back()} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold">Go Back</button>
            </div>
        </Layout>
    )

    const isCurrent = academicYears.find(y => y.id === selectedYearId)?.isCurrent

    return (
        <Layout title={`History: ${student.user?.name}`}>
            {/* ===== HEADER ===== */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-all">
                        ←
                    </button>
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight">{student.user?.name}</h2>
                        <p className="text-gray-400 font-bold tracking-widest text-xs">Complete Historical Archive • ID: {student.student_id}</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {/* Year Selector */}
                    {academicYears.length > 0 && (
                        <div className="relative">
                            <select
                                className="bg-white border-2 border-slate-100 rounded-xl px-4 py-2.5 font-bold text-xs uppercase tracking-widest text-slate-700 outline-none focus:border-blue-500 shadow-sm transition-all appearance-none pr-8"
                                value={selectedYearId}
                                onChange={(e) => setSelectedYearId(e.target.value)}
                            >
                                {academicYears.map(y => (
                                    <option key={y.id} value={y.id}>{y.name} {y.isCurrent ? '(CURRENT)' : ''}</option>
                                ))}
                            </select>
                            <svg className="w-3 h-3 absolute right-3 top-3.5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                    )}
                    <button
                        onClick={handleDownloadPDF}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-emerald-100"
                    >
                        📥 Download PDF
                    </button>
                </div>
            </div>

            {/* Non-current year banner */}
            {selectedYearId && !isCurrent && academicYears.length > 0 && (
                <div className="bg-amber-500 px-6 py-3 rounded-2xl mb-6 flex items-center gap-3 shadow-lg shadow-amber-100">
                    <span className="text-xl">📁</span>
                    <p className="text-white text-xs font-bold uppercase tracking-widest">
                        Archived Year: <span className="underline">{academicYears.find(y => y.id === selectedYearId)?.name}</span> — Attendance may be limited for past sessions.
                    </p>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* ===== SIDEBAR ===== */}
                <div className="lg:col-span-1 space-y-4">
                    {/* Student Card */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-black mb-4">
                            {student.user?.name?.[0]?.toUpperCase()}
                        </div>
                        <h3 className="font-black text-slate-800 text-lg">{student.user?.name}</h3>
                        <p className="text-blue-600 font-black text-[10px] uppercase tracking-widest mt-1">{fullExamData?.student?.className || student.clss?.class_name || student.class_name || 'N/A'}</p>
                        <span className={`mt-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${student.status === 'active' ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                            {student.status || 'active'}
                        </span>

                        <div className="w-full h-px bg-gray-100 my-4"></div>

                        <div className="w-full space-y-3 text-left">
                            {[
                                { label: 'Student ID', value: student.student_id },
                                { label: `Class ${!isCurrent ? '(Archived)' : ''}`, value: fullExamData?.student?.className || student.clss?.class_name || student.class_name || 'N/A' },
                                { label: `Section ${!isCurrent ? '(Archived)' : ''}`, value: fullExamData?.student?.sectionName || student.section_name || student.section?.name || 'N/A' },
                                { label: 'Parent', value: student.parent?.user?.name || 'N/A' },
                                { label: 'Phone', value: student.phone || 'N/A' },
                                { label: 'Gender', value: student.gender || 'N/A' },
                                { label: 'Scholarship', value: student.scholarship || 'None' }
                            ].map(item => (
                                <div key={item.label}>
                                    <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest block">{item.label}</label>
                                    <p className="text-sm font-bold text-slate-700 mt-0.5">{item.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 space-y-3">
                        <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Quick Stats</p>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-500 font-bold">Total Score</span>
                            <span className="font-black text-indigo-600">{grandTotal}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-500 font-bold">Present Days</span>
                            <span className="font-black text-emerald-600">{presentCount}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-500 font-bold">Absent Days</span>
                            <span className="font-black text-rose-600">{absentCount}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-500 font-bold">Total Paid</span>
                            <span className="font-black text-emerald-600">${totalPaid.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-500 font-bold">Payments</span>
                            <span className="font-black text-slate-700">{filteredPayments.length}</span>
                        </div>
                    </div>
                </div>

                {/* ===== MAIN CONTENT ===== */}
                <div className="lg:col-span-3 relative">
                    {fetching && (
                        <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] z-50 flex items-center justify-center rounded-3xl">
                            <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent"></div>
                        </div>
                    )}

                    {/* Tab Bar */}
                    <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100 mb-6 w-fit">
                        {['academic', 'attendance', 'finance', 'ai'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-gray-400 hover:text-slate-600'}`}
                            >
                                {tab === 'academic' ? '🎓 Academic' : tab === 'attendance' ? '📅 Attendance' : tab === 'finance' ? '💰 Finance' : '🤖 AI Insights'}
                            </button>
                        ))}
                    </div>

                    {/* Error Display */}
                    {apiError && (
                        <div className="bg-red-50 border border-red-200 text-red-600 px-6 py-4 rounded-2xl text-sm font-bold flex items-center gap-3 my-4">
                            <span className="text-xl">⚠️</span>
                            <div>
                                <p className="font-black uppercase tracking-widest text-[10px] mb-1">API Error Detected</p>
                                <p>{apiError}</p>
                            </div>
                        </div>
                    )}

                    {/* ======= ACADEMIC TAB ======= */}
                    {activeTab === 'academic' && (
                        <div className="space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                    <span className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">🎓</span>
                                    Exam Performance History
                                </h3>
                                {/* Filters */}
                                <div className="flex flex-wrap gap-2">
                                    <select
                                        value={subjectFilter}
                                        onChange={e => setSubjectFilter(e.target.value)}
                                        className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                                    >
                                        <option value="">All Subjects</option>
                                        {allSubjectNames.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    <select
                                        value={examTypeFilter}
                                        onChange={e => setExamTypeFilter(e.target.value)}
                                        className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                                    >
                                        <option value="">All Types</option>
                                        {allExamTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                    {(subjectFilter || examTypeFilter) && (
                                        <button onClick={() => { setSubjectFilter(''); setExamTypeFilter('') }} className="bg-red-50 text-red-500 px-3 py-2 rounded-xl text-xs font-bold hover:bg-red-100 transition-all">
                                            ✕ Clear
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="mt-4">
                                <StudentResultsView 
                                    data={{ 
                                        ...fullExamData, 
                                        subjects: filteredResults,
                                        student: fullExamData?.student || (student ? {
                                            ...student,
                                            name: student.user?.name,
                                            regId: student.student_id,
                                            className: student.clss?.class_name,
                                            sectionName: student.section?.name
                                        } : null)
                                    }} 
                                    years={[]} 
                                />
                            </div>
                        </div>
                    )}

                    {/* ======= ATTENDANCE TAB ======= */}
                    {activeTab === 'attendance' && (
                        <div className="space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                    <span className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">📅</span>
                                    Attendance Log
                                </h3>
                                {/* Filters */}
                                <div className="flex flex-wrap gap-2">
                                    <select
                                        value={attStatusFilter}
                                        onChange={e => setAttStatusFilter(e.target.value)}
                                        className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-orange-400 appearance-none"
                                    >
                                        <option value="">All Status</option>
                                        <option value="Present">✅ Present</option>
                                        <option value="Absent">❌ Absent</option>
                                        <option value="Late">⏰ Late</option>
                                    </select>
                                    <select
                                        value={attMonthFilter}
                                        onChange={e => setAttMonthFilter(e.target.value)}
                                        className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-orange-400 appearance-none"
                                    >
                                        <option value="">All Months</option>
                                        {allMonths.map(m => {
                                            const [yr, mo] = m.split('-')
                                            const label = new Date(yr, mo - 1).toLocaleString('default', { month: 'long', year: 'numeric' })
                                            return <option key={m} value={m}>{label}</option>
                                        })}
                                    </select>
                                    {(attStatusFilter || attMonthFilter) && (
                                        <button onClick={() => { setAttStatusFilter(''); setAttMonthFilter('') }} className="bg-red-50 text-red-500 px-3 py-2 rounded-xl text-xs font-bold hover:bg-red-100 transition-all">
                                            ✕ Clear
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Summary Cards */}
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { label: 'Present', count: presentCount, color: 'emerald' },
                                    { label: 'Absent', count: absentCount, color: 'rose' },
                                    { label: 'Late', count: filteredAttendance.filter(a => a.status === 'Late').length, color: 'amber' }
                                ].map(item => (
                                    <div key={item.label} className={`bg-${item.color}-50 rounded-2xl p-4 text-center border border-${item.color}-100`}>
                                        <div className={`text-2xl font-black text-${item.color}-600`}>{item.count}</div>
                                        <div className={`text-[10px] font-black uppercase tracking-widest text-${item.color}-500 mt-1`}>{item.label}</div>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden relative">
                                {attLoading && (
                                    <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-10">
                                        <div className="animate-spin rounded-full h-8 w-8 border-4 border-orange-500 border-t-transparent"></div>
                                    </div>
                                )}
                                <div className="overflow-x-auto w-full">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase font-black tracking-widest">
                                                <th className="px-6 py-5">Date</th>
                                                <th className="px-6 py-5">Session</th>
                                                <th className="px-6 py-5">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {filteredAttendance.map(rec => (
                                                <tr key={rec.id} className="hover:bg-gray-50/60 transition-colors">
                                                    <td className="px-6 py-5 font-bold text-slate-700">{new Date(rec.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</td>
                                                    <td className="px-6 py-5 text-xs font-black uppercase tracking-widest text-gray-400">{rec.session}</td>
                                                    <td className="px-6 py-5">
                                                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${rec.status === 'Present' ? 'bg-emerald-100 text-emerald-600' : rec.status === 'Absent' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                                                            {rec.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                            {filteredAttendance.length === 0 && (
                                                <tr>
                                                    <td colSpan="3" className="text-center py-14 text-gray-400 font-medium italic">
                                                        {attendance.length === 0 ? 'No attendance records found for this session.' : 'No records match the current filters.'}
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ======= FINANCE TAB ======= */}
                    {activeTab === 'finance' && (
                        <div className="space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                    <span className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">💰</span>
                                    Fee Payment History
                                </h3>
                                {/* Filters */}
                                <div className="flex flex-wrap gap-2">
                                    <select
                                        value={payMethodFilter}
                                        onChange={e => setPayMethodFilter(e.target.value)}
                                        className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 appearance-none"
                                    >
                                        <option value="">All Methods</option>
                                        {allPayMethods.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                    <select
                                        value={payYearFilter}
                                        onChange={e => { setPayYearFilter(e.target.value); setPayMonthFilter('') }}
                                        className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 appearance-none"
                                    >
                                        <option value="">All Years</option>
                                        {allPayYears.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                    <select
                                        value={payMonthFilter}
                                        onChange={e => setPayMonthFilter(e.target.value)}
                                        className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 appearance-none"
                                    >
                                        <option value="">All Months</option>
                                        {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                                            <option key={m} value={m}>{new Date(2000, m-1).toLocaleString('default', { month: 'long' })}</option>
                                        ))}
                                    </select>
                                    {(payMethodFilter || payMonthFilter || payYearFilter) && (
                                        <button onClick={() => { setPayMethodFilter(''); setPayMonthFilter(''); setPayYearFilter('') }} className="bg-red-50 text-red-500 px-3 py-2 rounded-xl text-xs font-bold hover:bg-red-100 transition-all">
                                            ✕ Clear
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Total Summary */}
                            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-6 py-4 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Total Paid (Filtered)</p>
                                    <p className="text-2xl font-black text-emerald-700">${totalPaid.toLocaleString()}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Transactions</p>
                                    <p className="text-2xl font-black text-emerald-700">{filteredPayments.length}</p>
                                </div>
                            </div>

                            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                                <div className="overflow-x-auto w-full">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase font-black tracking-widest">
                                                <th className="px-6 py-5">Description</th>
                                                <th className="px-6 py-5">Date</th>
                                                <th className="px-6 py-5">Method</th>
                                                <th className="px-6 py-5 text-right">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {filteredPayments.map(ctx => (
                                                <tr key={ctx.id} className="hover:bg-gray-50/60 transition-colors group">
                                                    <td className="px-6 py-5">
                                                        <div className="font-black text-slate-800 uppercase text-xs">{ctx.description}</div>
                                                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">#{ctx.transactionId || 'CASH-REC'}</div>
                                                    </td>
                                                    <td className="px-6 py-5 text-sm font-medium text-gray-500">{new Date(ctx.date).toLocaleDateString()}</td>
                                                    <td className="px-6 py-5 text-xs font-black uppercase tracking-widest text-blue-600">{ctx.payment_method}</td>
                                                    <td className="px-6 py-5 text-right font-black text-slate-900 group-hover:text-emerald-600 transition-colors">${ctx.amount?.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                            {filteredPayments.length === 0 && (
                                                <tr>
                                                    <td colSpan="4" className="text-center py-14 text-gray-400 font-medium italic">
                                                        {payments.length === 0 ? 'No financial transactions found for this student.' : 'No payments match the current filters.'}
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ======= AI TAB ======= */}
                    {activeTab === 'ai' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                    <span className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">🤖</span>
                                    AI-Driven Student Insights
                                </h3>
                                <button
                                    onClick={generateAIInsights}
                                    disabled={generatingAI}
                                    className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2"
                                >
                                    {generatingAI ? (
                                        <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Generating...</>
                                    ) : '🔄 Refresh Insights'}
                                </button>
                            </div>

                            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
                                <div className="absolute -top-8 -right-8 opacity-5 pointer-events-none text-9xl">🤖</div>
                                {student.aiInsights ? (
                                    <div>
                                        <p className="text-slate-700 leading-relaxed text-lg italic">"{student.aiInsights}"</p>
                                        <div className="mt-6 flex items-center gap-2 text-[10px] font-black uppercase text-purple-600 tracking-widest">
                                            <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse"></span>
                                            Generated by Dugsi Pro AI
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-14 text-center space-y-4">
                                        <div className="text-5xl">🧠</div>
                                        <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No AI insights generated yet.</p>
                                        <button onClick={generateAIInsights} className="text-blue-600 font-black text-xs uppercase tracking-widest hover:underline">
                                            Generate Now
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100">
                                <h4 className="font-black text-blue-800 text-sm mb-2 uppercase tracking-tight">Maxay tahay AI Insights?</h4>
                                <p className="text-blue-700/70 text-sm leading-relaxed">
                                    Nidaamka AI-ga wuxuu falanqeynayaa imaanshaha ardayga, dhibcaha imtixaannada, iyo hab-dhaqankiisa si uu u bixiyo talooyin ku aadan horumarkiisa waxbarashada.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    )
}
