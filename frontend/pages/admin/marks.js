import Layout from '../../components/Layout'
import { useEffect, useState, useRef } from 'react'
import axios from 'axios'
import * as XLSX from 'xlsx'

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
    const [gradingScales, setGradingScales] = useState([])

    const tableRef = useRef(null)

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    useEffect(() => {
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

    const exportToExcel = () => {
        const table = document.getElementById("marks-table");
        const wb = XLSX.utils.table_to_book(table, { sheet: "Marks" });
        XLSX.writeFile(wb, `Marks_${selectedExamName}_${new Date().getTime()}.xlsx`);
    }

    const exportToWord = () => {
        const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset='utf-8'><title>Export HTML To Doc</title>
        <style>
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid black; padding: 5px; text-align: center; }
            th { background-color: #f2f2f2; }
        </style>
        </head><body>`;
        const footer = "</body></html>";
        const tableHtml = document.getElementById("marks-table").outerHTML;
        const html = header + tableHtml + footer;
        
        const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Marks_${selectedExamName}_${new Date().getTime()}.doc`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    const isFinal = /final|term\s*2|gabo|kama/i.test(selectedExamName);

    const colorfulBg = [
        'bg-blue-100 text-blue-900 border-blue-200',
        'bg-green-100 text-green-900 border-green-200',
        'bg-purple-100 text-purple-900 border-purple-200',
        'bg-yellow-100 text-yellow-900 border-yellow-200',
        'bg-pink-100 text-pink-900 border-pink-200',
        'bg-teal-100 text-teal-900 border-teal-200',
        'bg-orange-100 text-orange-900 border-orange-200',
        'bg-indigo-100 text-indigo-900 border-indigo-200'
    ];

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
                    <h2 className="text-xl font-bold text-slate-700">Natiijada & Marks (Excel View)</h2>
                </div>
                <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-100 italic text-gray-400 text-sm">
                    View, export, and manage student marks
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
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                        <div className="p-4 flex justify-between items-center border-b border-gray-200 bg-slate-50">
                            <div>
                                <h3 className="text-sm font-black text-slate-600 uppercase tracking-widest">Mark Sheet</h3>
                                <p className="text-xs text-slate-500 font-medium">Viewing marks for {students.length} students · {categoryExams.length} Subjects</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={exportToExcel}
                                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    Export Excel
                                </button>
                                <button
                                    onClick={exportToWord}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    Export Word
                                </button>
                            </div>
                        </div>
                        <div className="overflow-x-auto w-full p-4 bg-gray-100">
                            <table id="marks-table" className="w-full text-left whitespace-nowrap border-collapse border border-gray-300 bg-white text-sm shadow-sm">
                                <thead>
                                    <tr className="bg-slate-200">
                                        <th className="border border-gray-300 px-3 py-2 font-bold text-slate-700 text-center w-10">#</th>
                                        <th className="border border-gray-300 px-3 py-2 font-bold text-slate-700 text-center w-24">RollNo</th>
                                        <th className="border border-gray-300 px-3 py-2 font-bold text-slate-700">Name</th>
                                        {categoryExams.map((ex, idx) => {
                                            const subName = subjects.find(s => s.id === ex.subjectId)?.name || 'Subject'
                                            const colorClass = colorfulBg[idx % colorfulBg.length]
                                            return (
                                                <th key={ex.id} className={`border border-gray-300 px-3 py-2 font-black text-center min-w-[80px] ${colorClass}`} title={ex.name}>
                                                    {subName} <br/>
                                                    <span className="text-[10px] opacity-70 font-semibold">({ex.totalMarks})</span>
                                                </th>
                                            )
                                        })}
                                        <th className="border border-gray-300 px-3 py-2 font-bold text-slate-700 text-center bg-slate-100">Total</th>
                                        {isFinal && <th className="border border-gray-300 px-3 py-2 font-bold text-slate-700 text-center bg-slate-100">Celceliska</th>}
                                        <th className="border border-gray-300 px-3 py-2 font-bold text-slate-700 text-center bg-slate-100">Grade</th>
                                    </tr>
                                </thead>
                                <tbody>
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
                                            <tr key={row.studentId} className="hover:bg-slate-50 transition-colors group">
                                                <td className="border border-gray-300 px-3 py-2 text-center font-medium text-slate-500">{idx + 1}</td>
                                                <td className="border border-gray-300 px-3 py-2 text-center font-semibold text-slate-700">{row.studentRegId}</td>
                                                <td className="border border-gray-300 px-3 py-2 font-bold text-slate-800">
                                                    {row.studentName}
                                                    {row.sectionName && <span className="ml-2 text-[10px] text-gray-400 font-normal">Sec: {row.sectionName}</span>}
                                                </td>
                                                {categoryExams.map(ex => {
                                                    const m = studentMarks?.exams?.[ex.id]?.marks;
                                                    const displayMark = (m !== '' && m !== undefined && m !== null) ? m : '-';
                                                    return (
                                                        <td key={ex.id} className="border border-gray-300 px-3 py-2 text-center font-semibold text-slate-700 group-hover:bg-blue-50/30">
                                                            {displayMark}
                                                        </td>
                                                    )
                                                })}
                                                <td className="border border-gray-300 px-3 py-2 text-center font-bold text-indigo-700 bg-slate-50">{total}</td>
                                                {isFinal && (
                                                    <td className="border border-gray-300 px-3 py-2 text-center font-bold text-emerald-700 bg-slate-50">
                                                        {Number.isFinite(total) ? (total / 2).toFixed(1).replace(/\.0$/, '') : 0}
                                                    </td>
                                                )}
                                                <td className="border border-gray-300 px-3 py-2 text-center font-bold bg-slate-50">
                                                    {calculateGrade(total, totalMax)}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : (selectedClassId && !searching) && (
                <div className="bg-white p-20 rounded-[2.5rem] text-center border-2 border-dashed border-gray-200">
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
