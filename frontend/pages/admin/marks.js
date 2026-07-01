import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'

export default function AdminMarks() {
    const [exams, setExams] = useState([])
    const [classes, setClasses] = useState([]) // Classes with nested Sections
    const [academicYears, setAcademicYears] = useState([])
    const [subjects, setSubjects] = useState([])
    const [students, setStudents] = useState([])
    
    // Multi-step search state
    const [selectedYearId, setSelectedYearId] = useState('')
    const [selectedExamName, setSelectedExamName] = useState('')
    const [selectedClassId, setSelectedClassId] = useState('')   // Grade ID
    const [selectedSectionId, setSelectedSectionId] = useState('') // Section ID
    const [selectedSubjectId, setSelectedSubjectId] = useState('')
    const [currentExamId, setCurrentExamId] = useState(null)
    const [description, setDescription] = useState('')

    const [marksData, setMarksData] = useState({}) // { studentId: { marks: '', remarks: '', sectionId: '' } }
    const [loading, setLoading] = useState(false)
    const [searching, setSearching] = useState(false)
    const [saving, setSaving] = useState(false)
    const [userRole, setUserRole] = useState('')
    const [gradingScales, setGradingScales] = useState([])
    const [examTotalMarks, setExamTotalMarks] = useState(100)

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
        if (!selectedExamName || !selectedClassId || !selectedSubjectId) {
            alert('Please select all filters first (Exam, Grade, and Subject are required)')
            return
        }

        setSearching(true)
        setLoading(true)
        setStudents([]) // Clear previous results
        try {
            console.log('Searching for:', { selectedExamName, selectedClassId, selectedSubjectId, selectedSectionId });
            
            // Find the specific exam ID based on name, classId, and subjectId within the selected year
            let targetExam = filteredExamsForYear.find(e => {
                const baseName = e.name.includes(' - ') ? e.name.split(' - ')[0] : e.name;
                return baseName === selectedExamName &&
                       e.classId === selectedClassId &&
                       e.subjectId === selectedSubjectId
            })

            // FALLBACK: Match global exams if specific class exam not found
            if (!targetExam) {
                targetExam = filteredExamsForYear.find(e => {
                    const baseName = e.name.includes(' - ') ? e.name.split(' - ')[0] : e.name;
                    return baseName === selectedExamName &&
                           !e.classId &&
                           e.subjectId === selectedSubjectId
                })
            }

            console.log('Target Exam found:', targetExam);

            if (!targetExam) {
                alert('No matching exam found for the selected year. Make sure exams have been created.')
                setStudents([])
                setLoading(false)
                setSearching(false)
                return
            }

            setCurrentExamId(targetExam.id)

            // Fetch students from this specific section + existing results
            const [sRes, rRes] = await Promise.all([
                axios.get(`${apiUrl}/api/exams/${targetExam.id}/students-for-marks?sectionId=${selectedSectionId}`, { headers: headers() }),
                axios.get(`${apiUrl}/api/exams/${targetExam.id}/results?grading=true&sectionId=${selectedSectionId}`, { headers: headers() })
            ])

            const gradingSheet = rRes.data.data || []
            setStudents(gradingSheet)
            setGradingScales(rRes.data.gradingScales || [])
            setExamTotalMarks(targetExam.totalMarks || 100)

            const initialMarks = {}
            gradingSheet.forEach(row => {
                initialMarks[row.studentId] = {
                    marks: row.marks !== '' ? row.marks : '',
                    remarks: row.remarks || '',
                    sectionId: row.sectionId || selectedSectionId,
                    classId: row.classId || selectedClassId,
                    mobile: row.student?.Parents?.[0]?.parent?.phone || row.student?.user?.phone || row.student?.phone || '---',
                    id: row.id
                }
            })
            setMarksData(initialMarks)
            if (targetExam.description) setDescription(targetExam.description)

        } catch (err) {
            console.error('Error searching:', err)
            alert('Search failed: ' + (err.response?.data?.message || err.message))
        } finally {
            setSearching(false)
            setLoading(false)
        }
    }

    const handleMarkChange = (studentId, field, value) => {
        setMarksData(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                [field]: value
            }
        }))
    }

    const calculateGrade = (marks) => {
        if (marks === '' || marks === undefined || marks === null) return '—'
        const marksVal = parseFloat(marks)
        if (isNaN(marksVal) || !examTotalMarks) return 'F'
        
        const percentage = Math.round((marksVal / examTotalMarks) * 100)
        
        // Robust dynamic scale matching (DESC sort ensures correct priority)
        if (gradingScales && gradingScales.length > 0) {
            const sortedScales = [...gradingScales]
                .filter(s => s && s.minScore !== undefined)
                .sort((a, b) => (Number(b.minScore) || 0) - (Number(a.minScore) || 0));
            
            const match = sortedScales.find(s => percentage >= (Number(s.minScore) || 0));
            if (match) return match.grade
        }

        // Standard Fallback (Matching Somali Standard)
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
        if (!currentExamId) return alert('Please search first')
        setSaving(true)
        try {
            const results = students.map(row => ({
                studentId: row.studentId,
                classId: row.classId || selectedClassId,
                sectionId: row.sectionId || selectedSectionId,
                marks: marksData[row.studentId]?.marks !== '' ? Number(marksData[row.studentId]?.marks) : 0,
                remarks: marksData[row.studentId]?.remarks || ''
            }))

            await axios.post(`${apiUrl}/api/exams/${currentExamId}/results`, { results }, { headers: headers() })
            alert('Marks saved successfully!')
        } catch (err) {
            alert(err.response?.data?.message || err.message || 'Error saving marks')
        } finally {
            setSaving(false)
        }
    }

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
                    <h2 className="text-xl font-bold text-slate-700">Natiijada & Marks</h2>
                </div>
                <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-100 italic text-gray-400 text-sm">
                    Search and enter student marks
                </div>
            </div>

            <div className="bg-gray-50/50 p-8 rounded-2xl border border-gray-100 mb-8">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
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
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Exam</label>
                        <select
                            className="w-full p-3 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none bg-white text-sm font-bold text-slate-700 appearance-none cursor-pointer"
                            value={selectedExamName}
                            onChange={e => setSelectedExamName(e.target.value)}
                        >
                            <option value="">Select Exam</option>
                            {uniqueExamNames.map(name => <option key={name} value={name}>{name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Grade</label>
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
                            <option value="">Select Section</option>
                            {availableSections.map(sec => <option key={sec.id} value={sec.id}>Section {sec.name || 'General'} ({sec.shift})</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Subject</label>
                        <select
                            className="w-full p-3 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none bg-white text-sm font-bold text-slate-700 appearance-none cursor-pointer"
                            value={selectedSubjectId}
                            onChange={e => setSelectedSubjectId(e.target.value)}
                        >
                            <option value="">Select Subject</option>
                            {subjects.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
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
            ) : students.length > 0 ? (
                <form onSubmit={handleSubmit} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden">
                        <div className="p-8 flex justify-between items-center border-b border-gray-50 bg-slate-50/50">
                            <div>
                                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Student List</h3>
                                <p className="text-xs text-slate-400 font-medium">Recording marks for {students.length} students · Section {availableSections.find(s => s.id === selectedSectionId)?.name || ''}</p>
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
<table className="w-full text-left">
                            <thead>
                                <tr className="text-[10px] uppercase font-bold text-gray-400 border-b border-gray-50">
                                    <th className="px-8 py-5">#</th>
                                    <th className="px-8 py-5">RollNo</th>
                                    <th className="px-8 py-5">Name</th>
                                    <th className="px-8 py-5">Mobile</th>
                                    <th className="px-8 py-5 w-32 text-center">Marks Obtained</th>
                                    <th className="px-8 py-5 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {students.map((row, idx) => (
                                    <tr key={row.studentId} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-8 py-5 text-xs font-bold text-slate-400">{idx + 1}</td>
                                        <td className="px-8 py-5 text-xs font-bold text-slate-800">{row.studentRegId}</td>
                                        <td className="px-8 py-5">
                                            <div className="font-bold text-slate-700">{row.studentName}</div>
                                            <div className="text-[10px] text-gray-400 font-medium uppercase">Sec. {row.sectionName || 'N/A'}</div>
                                        </td>
                                        <td className="px-8 py-5 text-xs text-slate-500 font-medium">{marksData[row.studentId]?.mobile || '---'}</td>
                                        <td className="px-8 py-5">
                                            <input
                                                type="number"
                                                className={`w-full p-3 rounded-xl border border-gray-100 focus:border-indigo-500 text-center font-bold text-indigo-600 outline-none ${userRole === '' ? 'bg-gray-100' : 'bg-gray-50/50'}`}
                                                value={marksData[row.studentId]?.marks ?? ''}
                                                onChange={e => handleMarkChange(row.studentId, 'marks', e.target.value)}
                                                readOnly={userRole === ''}
                                            />
                                        </td>
                                         <td className="px-8 py-5 text-center">
                                            <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 shadow-sm">
                                                {calculateGrade(marksData[row.studentId]?.marks)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
</div>
                    </div>
                </form>
            ) : (selectedClassId && !searching) && (
                <div className="bg-white p-20 rounded-[2.5rem] text-center border-2 border-dashed border-gray-100">
                    <div className="text-4xl mb-4 grayscale opacity-20">📊</div>
                    <h3 className="text-gray-400 font-bold uppercase tracking-widest text-xs">
                        {searching ? 'Eegayaa (Searching)...' : 'Arday Lama Helin (No Students Found)'}
                    </h3>
                    <p className="text-gray-300 text-[10px] mt-2 italic">
                        Hubi haddii imtixaanka la abuuray iyo haddii ardaydu ku jiraan xilli ciyaareedkan (year).
                    </p>
                </div>
            )}
        </Layout>
    )
}
