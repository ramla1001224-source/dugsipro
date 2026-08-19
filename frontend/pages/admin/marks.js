import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'

export default function AdminMarks() {
    const [exams, setExams] = useState([])
    const [classes, setClasses] = useState([]) // Classes with nested Sections
    const [academicYears, setAcademicYears] = useState([])
    const [subjects, setSubjects] = useState([])
    const [students, setStudents] = useState([])
    const [categoryExams, setCategoryExams] = useState([]) // Exams for the selected category
    
    // Multi-step search state
    const [selectedYearId, setSelectedYearId] = useState('')
    const [selectedExamName, setSelectedExamName] = useState('') // Exam Category
    const [selectedClassId, setSelectedClassId] = useState('')   // Grade ID
    const [selectedSectionId, setSelectedSectionId] = useState('') // Section ID
    const [description, setDescription] = useState('')

    // marksData: { [studentId]: { mobile, studentName, studentRegId, sectionName, classId, sectionId, exams: { [examId]: { marks, remarks } } } }
    const [marksData, setMarksData] = useState({})
    const [loading, setLoading] = useState(false)
    const [searching, setSearching] = useState(false)
    const [saving, setSaving] = useState(false)
    const [userRole, setUserRole] = useState('')
    const [gradingScales, setGradingScales] = useState([])

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    useEffect(() => {
        setUserRole(localStorage.getItem('role') || '')
        fetchInitialData()
    }, [])

    const fetchInitialData = async () => {
        try {
            const [eRes, cRes, sRes, yRes] = await Promise.all([
                axios.get(`${apiUrl}/api/exams`, { headers: headers() }).catch(() => ({ data: [] })),
                axios.get(`${apiUrl}/api/classes`, { headers: headers() }).catch(() => ({ data: [] })),
                axios.get(`${apiUrl}/api/subjects`, { headers: headers() }).catch(() => ({ data: [] })),
                axios.get(`${apiUrl}/api/academic-years`, { headers: headers() }).catch(() => ({ data: [] }))
            ])
            setExams(eRes.data)
            setClasses(cRes.data)
            setSubjects(sRes.data)
            setAcademicYears(yRes.data)
            
            const current = yRes.data.find(y => y.isCurrent)
            if (current) setSelectedYearId(current.id)
        } catch (err) {
            console.error('Error fetching initial data:', err)
        }
    }

    // Derived lists for filters
    const filteredExamsForYear = exams.filter(e => !selectedYearId || e.term?.academicYearId === selectedYearId)
    const uniqueExamNames = Array.from(new Set(filteredExamsForYear.map(e => e.name.split(' - ')[0])))
    const selectedClassObj = classes.find(c => c.id === selectedClassId)
    const availableSections = selectedClassObj?.Sections || []

    const handleSearch = async () => {
        if (!selectedExamName || !selectedClassId) {
            alert('Please select Exam Category and Grade first')
            return
        }

        setSearching(true)
        setLoading(true)
        setStudents([])
        setCategoryExams([])
        try {
            // Find ALL exams for this category and class
            let targetExams = filteredExamsForYear.filter(e => {
                const baseName = e.name.includes(' - ') ? e.name.split(' - ')[0] : e.name;
                return baseName === selectedExamName && String(e.classId) === String(selectedClassId);
            })

            // Fallback: match global exams if specific class exams not found
            if (targetExams.length === 0) {
                const globalExams = filteredExamsForYear.filter(e => {
                    const baseName = e.name.includes(' - ') ? e.name.split(' - ')[0] : e.name;
                    return baseName === selectedExamName && !e.classId;
                })
                targetExams.push(...globalExams);
            }

            if (targetExams.length === 0) {
                alert('No exams found for this category and class. Make sure exams have been created.')
                setLoading(false)
                setSearching(false)
                return
            }

            setCategoryExams(targetExams)
            
            if (targetExams[0].description) {
                setDescription(targetExams[0].description)
            } else {
                setDescription('')
            }

            // Fetch results for ALL targeted exams in parallel
            const resultsPromises = targetExams.map(ex => {
                let rQuery = `?grading=true`;
                if (selectedSectionId) rQuery += `&sectionId=${selectedSectionId}`;
                return axios.get(`${apiUrl}/api/exams/${ex.id}/results${rQuery}`, { headers: headers() })
                     .then(r => ({ examId: ex.id, data: r.data.data || [], gradingScales: r.data.gradingScales || [] }))
                     .catch(() => ({ examId: ex.id, data: [], gradingScales: [] }))
            });
            const allResults = await Promise.all(resultsPromises);

            const gradingSheet = allResults.length > 0 ? allResults[0].data : [];
            setStudents(gradingSheet);

            const scales = allResults.find(r => r.gradingScales && r.gradingScales.length > 0)?.gradingScales || []
            setGradingScales(scales)

            // Initialize marks grid state
            const initialMarks = {}
            gradingSheet.forEach(row => {
                initialMarks[row.studentId] = {
                    studentName: row.studentName,
                    studentRegId: row.studentRegId,
                    sectionName: row.sectionName,
                    classId: row.classId || selectedClassId,
                    sectionId: row.sectionId || selectedSectionId,
                    mobile: row.student?.Parents?.[0]?.parent?.phone || row.student?.user?.phone || row.student?.phone || '---',
                    exams: {}
                }
            })

            allResults.forEach(resObj => {
                resObj.data.forEach(row => {
                    if (initialMarks[row.studentId]) {
                        initialMarks[row.studentId].exams[resObj.examId] = {
                            marks: row.marks !== '' && row.marks !== null ? row.marks : '',
                            remarks: row.remarks || '',
                            id: row.id
                        }
                    }
                })
            })

            setMarksData(initialMarks)

        } catch (err) {
            console.error('Error searching:', err)
            alert('Search failed: ' + (err.response?.data?.message || err.message))
        } finally {
            setSearching(false)
            setLoading(false)
        }
    }

    const handleMarkChange = (studentId, examId, field, value) => {
        setMarksData(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                exams: {
                    ...prev[studentId].exams,
                    [examId]: {
                        ...(prev[studentId].exams?.[examId] || {}),
                        [field]: value
                    }
                }
            }
        }))
    }

    const calculateGrade = (marks, totalMax) => {
        if (marks === '' || marks === undefined || marks === null) return '—'
        const marksVal = parseFloat(marks)
        if (isNaN(marksVal) || !totalMax) return 'F'
        
        const percentage = Math.round((marksVal / totalMax) * 100)
        
        if (gradingScales && gradingScales.length > 0) {
            const sortedScales = [...gradingScales]
                .filter(s => s && s.minScore !== undefined)
                .sort((a, b) => (Number(b.minScore) || 0) - (Number(a.minScore) || 0));
            
            const match = sortedScales.find(s => percentage >= (Number(s.minScore) || 0));
            if (match) return match.grade
        }

        if (percentage >= 90) return 'A+'
        if (percentage >= 85) return 'B++'
        if (percentage >= 80) return 'B-'
        if (percentage >= 75) return 'C+'
        if (percentage >= 70) return 'C'
        if (percentage >= 60) return 'D'
        return 'F'
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (categoryExams.length === 0) return alert('Please search first')
        setSaving(true)
        try {
            const promises = categoryExams.map(ex => {
                const results = students.map(row => {
                    const cell = marksData[row.studentId]?.exams?.[ex.id]
                    return {
                        studentId: row.studentId,
                        classId: row.classId || selectedClassId,
                        sectionId: row.sectionId || selectedSectionId,
                        marks: (cell?.marks !== '' && cell?.marks !== undefined && cell?.marks !== null) ? Number(cell.marks) : null,
                        remarks: cell?.remarks || ''
                    }
                })
                // Only send payload if there's actual data
                return axios.post(`${apiUrl}/api/exams/${ex.id}/results`, { results }, { headers: headers() })
            })

            await Promise.all(promises)
            alert('Marks saved successfully!')
        } catch (err) {
            alert(err.response?.data?.message || err.message || 'Error saving marks')
        } finally {
            setSaving(false)
        }
    }

    const isFinal = selectedExamName.toLowerCase().includes('final');

    return (
        <Layout title="Student Marks Management">
            <div className="flex justify-between items-center mb-6">
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
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Marks</span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-700">Natiijada & Marks (Grid View)</h2>
                </div>
                <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-100 italic text-gray-400 text-sm">
                    View and enter student marks across all subjects
                </div>
            </div>

            <div className="bg-gray-50/50 p-8 rounded-2xl border border-gray-100 mb-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Academic Year</label>
                        <select
                            className="w-full p-3 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none bg-white text-sm font-bold text-slate-700 appearance-none cursor-pointer"
                            value={selectedYearId}
                            onChange={e => { setSelectedYearId(e.target.value); setSelectedExamName(''); }}
                        >
                            <option value="">Select Year</option>
                            {academicYears.map(y => <option key={y.id} value={y.id}>{y.name} {y.isCurrent ? '(Current)' : ''}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Exam Category</label>
                        <select
                            className="w-full p-3 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none bg-white text-sm font-bold text-slate-700 appearance-none cursor-pointer"
                            value={selectedExamName}
                            onChange={e => setSelectedExamName(e.target.value)}
                        >
                            <option value="">Select Category</option>
                            {uniqueExamNames.map(name => <option key={name} value={name}>{name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Grade / Class</label>
                        <select
                            className="w-full p-3 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none bg-white text-sm font-bold text-slate-700 appearance-none cursor-pointer"
                            value={selectedClassId}
                            onChange={e => { setSelectedClassId(e.target.value); setSelectedSectionId(''); }}
                        >
                            <option value="">Select Grade</option>
                            {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Section</label>
                        <select
                            className="w-full p-3 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none bg-white text-sm font-bold text-slate-700 appearance-none cursor-pointer"
                            value={selectedSectionId}
                            onChange={e => setSelectedSectionId(e.target.value)}
                            disabled={!selectedClassId}
                        >
                            <option value="">All Sections</option>
                            {availableSections.map(sec => <option key={sec.id} value={sec.id}>Section {sec.name || 'General'} ({sec.shift})</option>)}
                        </select>
                    </div>
                </div>

                <div className="mb-6">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Description</label>
                    <textarea
                        className={`w-full p-4 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none ${userRole === 'admin' ? 'bg-gray-100' : 'bg-white'} text-sm font-medium text-slate-600 h-24 resize-none`}
                        placeholder="Add additional description or context here..."
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        readOnly={userRole === ''}
                    ></textarea>
                </div>

                <div className="flex justify-end">
                    <button
                        onClick={handleSearch}
                        disabled={searching}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-3 rounded-xl font-bold shadow-lg shadow-indigo-100 transition-all active:scale-95 disabled:bg-indigo-300"
                    >
                        {searching ? 'Searching...' : 'Search'}
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center p-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            ) : students.length > 0 && categoryExams.length > 0 ? (
                <form onSubmit={handleSubmit} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden">
                        <div className="p-8 flex justify-between items-center border-b border-gray-50 bg-slate-50/50">
                            <div>
                                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Student Grid</h3>
                                <p className="text-xs text-slate-400 font-medium">Recording marks for {students.length} students · {categoryExams.length} Subjects</p>
                            </div>
                            {userRole !== '' && (
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className={`${saving ? 'bg-gray-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'} text-white px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-purple-100 transition-all`}
                                >
                                    {saving ? 'Saving...' : 'SAVE ALL'}
                                </button>
                            )}
                        </div>
                        <div className="overflow-x-auto w-full">
                            <table className="w-full text-left whitespace-nowrap">
                                <thead>
                                    <tr className="text-[10px] uppercase font-bold text-gray-400 border-b border-gray-50">
                                        <th className="px-6 py-5">#</th>
                                        <th className="px-6 py-5">RollNo</th>
                                        <th className="px-6 py-5">Name</th>
                                        {categoryExams.map(ex => {
                                            const subName = subjects.find(s => s.id === ex.subjectId)?.name || 'Subject'
                                            return <th key={ex.id} className="px-4 py-5 text-center min-w-[80px]" title={ex.name}>{subName} <br/><span className="text-[9px] text-gray-300">({ex.totalMarks})</span></th>
                                        })}
                                        <th className="px-6 py-5 text-center text-indigo-400">Total</th>
                                        {isFinal && <th className="px-6 py-5 text-center text-emerald-400">Celceliska</th>}
                                        <th className="px-6 py-5 text-center">Grade</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {students.map((row, idx) => {
                                        const studentMarks = marksData[row.studentId]
                                        let total = 0
                                        let totalMax = 0
                                        categoryExams.forEach(ex => {
                                            const m = studentMarks?.exams?.[ex.id]?.marks
                                            if (m !== '' && m !== undefined && m !== null) total += Number(m)
                                            totalMax += Number(ex.totalMarks || 100)
                                        })

                                        return (
                                            <tr key={row.studentId} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-6 py-4 text-xs font-bold text-slate-400">{idx + 1}</td>
                                                <td className="px-6 py-4 text-xs font-bold text-slate-800">{row.studentRegId}</td>
                                                <td className="px-6 py-4 min-w-[150px]">
                                                    <div className="font-bold text-slate-700 truncate">{row.studentName}</div>
                                                    <div className="text-[10px] text-gray-400 font-medium uppercase">Sec. {row.sectionName || 'N/A'}</div>
                                                </td>
                                                {categoryExams.map(ex => (
                                                    <td key={ex.id} className="px-2 py-4">
                                                        <input
                                                            type="number"
                                                            className={`w-full max-w-[80px] mx-auto p-2 rounded-lg border border-gray-200 focus:border-indigo-500 text-center font-bold text-slate-700 outline-none ${userRole === '' ? 'bg-gray-100' : 'bg-white'}`}
                                                            value={studentMarks?.exams?.[ex.id]?.marks ?? ''}
                                                            onChange={e => handleMarkChange(row.studentId, ex.id, 'marks', e.target.value)}
                                                            readOnly={userRole === ''}
                                                            min={0}
                                                            max={ex.totalMarks || 100}
                                                        />
                                                    </td>
                                                ))}
                                                <td className="px-6 py-4 text-center font-black text-indigo-600">{total}</td>
                                                {isFinal && (
                                                    <td className="px-6 py-4 text-center font-black text-emerald-600">
                                                        {Number.isFinite(total) ? (total / 2).toFixed(1).replace(/\.0$/, '') : 0}
                                                    </td>
                                                )}
                                                <td className="px-6 py-4 text-center">
                                                    <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 shadow-sm">
                                                        {calculateGrade(total, totalMax)}
                                                    </span>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </form>
            ) : (selectedClassId && !searching) && (
                <div className="bg-white p-20 rounded-[2.5rem] text-center border-2 border-dashed border-gray-100">
                    <div className="text-4xl mb-4 grayscale opacity-20">📊</div>
                    <h3 className="text-gray-400 font-bold uppercase tracking-widest text-xs">
                        {searching ? 'Eegayaa (Searching)...' : 'Arday Ama Imtixaan Lama Helin'}
                    </h3>
                    <p className="text-gray-300 text-[10px] mt-2 italic">
                        Hubi haddii imtixaanka la abuuray iyo haddii ardaydu ku jiraan xilli ciyaareedkan.
                    </p>
                </div>
            )}
        </Layout>
    )
}
