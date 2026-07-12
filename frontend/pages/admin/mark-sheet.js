import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'
import { getImageUrl } from '../../utils/imageHelper'
import { useRouter } from 'next/router'

export default function MarkSheet() {
    const router = useRouter()
    const { classId: queryClassId } = router.query
    const [classes, setClasses] = useState([])
    const [academicYears, setAcademicYears] = useState([])
    const [selectedYearId, setSelectedYearId] = useState('')
    const [selectedClass, setSelectedClass] = useState(queryClassId || '')
    const [selectedSection, setSelectedSection] = useState('')
    const [filterType, setFilterType] = useState('all')
    const [data, setData] = useState({ markSheet: [], subjects: [] })
    const [loading, setLoading] = useState(false)
    const [showAverage, setShowAverage] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('marksheet_showAverage') !== 'false'
        }
        return true
    })

    const toggleAverage = () => {
        setShowAverage(prev => {
            const next = !prev
            localStorage.setItem('marksheet_showAverage', String(next))
            return next
        })
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    const selectedClassObj = classes.find(c => c.id === selectedClass)
    const availableSections = selectedClassObj?.Sections || []

    useEffect(() => {
        Promise.all([
            axios.get(`${apiUrl}/api/classes`, { headers: headers() }),
            axios.get(`${apiUrl}/api/academic-years`, { headers: headers() })
        ]).then(([cRes, yRes]) => {
            setClasses(cRes.data)
            setAcademicYears(yRes.data)
            const current = yRes.data.find(y => y.isCurrent)
            if (current) setSelectedYearId(current.id)
        }).catch(err => console.error(err))
    }, [])

    useEffect(() => {
        if (queryClassId) setSelectedClass(queryClassId)
    }, [queryClassId])

    const fetchData = async () => {
        if (!selectedClass) return
        setLoading(true)
        try {
            let query = `?academicYearId=${selectedYearId}`
            if (selectedSection) query += `&sectionId=${selectedSection}`
            const res = await axios.get(`${apiUrl}/api/exams/class-results/${selectedClass}${query}`, { headers: headers() })
            setData(res.data)
        } catch (err) {
            console.error('Fetch error:', err)
            const msg = err.response?.data?.message || err.message || 'Error fetching results'
            alert(msg)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [selectedClass, selectedYearId, selectedSection])

    const handlePrint = () => {
        window.print()
    }

    const exportToExcel = () => {
        if (!rankedMarkSheet || rankedMarkSheet.length === 0) return;
        const classNameStr = classes.find(c => c.id === selectedClass)?.class_name || 'Report';
        
        let html = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head>
                <meta charset="utf-8" />
                <style>
                    table { border-collapse: collapse; width: 100%; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-family: Arial, sans-serif; }
                    th { background-color: #4F46E5; color: white; font-weight: bold; text-align: center; }
                    .title-row { font-size: 18px; font-weight: bold; text-align: center; }
                    .info-row { font-size: 12px; color: #666; text-align: center; }
                </style>
            </head>
            <body>
                <table>
                    <tr>
                        <td colspan="${5 + data.subjects.length}" class="title-row">${schoolInfo?.name || 'Class Mark Sheet'}</td>
                    </tr>
                    <tr>
                        <td colspan="${4 + data.subjects.length}" class="title-row">${schoolInfo?.name || 'Class Mark Sheet'}</td>
                    </tr>
                    <tr>
                        <td colspan="${4 + data.subjects.length}" class="info-row">Class: ${classNameStr} | Session: ${selectedYearId ? academicYears.find(y => y.id === selectedYearId)?.name : ''}</td>
                    </tr>
                    <tr>
                        <th>Pos</th>
                        <th>Reg ID</th>
                        <th>Student Name</th>
                        ${data.subjects.map(sub => `<th>${sub.name} (TOT)</th>`).join('')}
                        <th>Grand Total</th>
                        <th>Celceliska</th>
                        <th>Grade</th>
                    </tr>
        `;

        rankedMarkSheet.forEach((student) => {
            html += `
                <tr>
                    <td style="text-align: center;">${student.position}</td>
                    <td>${student.studentRegId || ''}</td>
                    <td>${student.studentName}</td>
                    ${data.subjects.map(sub => {
                        const subData = student.subjects[sub.id] || { total: 0 };
                        return `<td style="text-align: center;">${subData.total}</td>`;
                    }).join('')}
                    <td style="text-align: center; font-weight: bold;">${student.displayTotal}</td>
                    <td style="text-align: center; font-weight: bold;">${Number.isFinite(student.displayTotal) ? (student.displayTotal / 2).toFixed(1).replace(/\.0$/, '') : 0}</td>
                    <td style="text-align: center; font-weight: bold;">${student.displayGrade}</td>
                </tr>
            `;
        });

        html += `
                </table>
            </body>
            </html>
        `;

        const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `MarkSheet_${classNameStr.replace(/\s+/g, '_')}.xls`;
        a.click();
    };

    const exportToWord = () => {
        if (!rankedMarkSheet || rankedMarkSheet.length === 0) return;
        const classNameStr = classes.find(c => c.id === selectedClass)?.class_name || 'Report';
        
        let html = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
            <head>
                <meta charset="utf-8" />
                <style>
                    body { font-family: 'Arial', sans-serif; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .title { font-size: 24px; font-weight: bold; color: #333; }
                    .subtitle { font-size: 14px; color: #666; margin-top: 5px; }
                    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
                    th, td { border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 11px; }
                    th { background-color: #f3f4f6; font-weight: bold; text-align: center; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="title">${schoolInfo?.name || 'Class Mark Sheet'}</div>
                    <div class="subtitle">Class: ${classNameStr}</div>
                    <div class="subtitle">Session: ${selectedYearId ? academicYears.find(y => y.id === selectedYearId)?.name : ''}</div>
                </div>
                
                <table>
                    <thead>
                        <tr>
                            <th style="width: 5%">#</th>
                            <th style="width: 5%">Pos</th>
                            <th>Reg ID</th>
                            <th>Student Name</th>
                            ${data.subjects.map(sub => `<th>${sub.name}</th>`).join('')}
                            <th>Grand Total</th>
                            <th>Celceliska</th>
                            <th>Grade</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        rankedMarkSheet.forEach((student, idx) => {
            html += `
                <tr>
                    <td style="text-align: center;"><b>${idx + 1}</b></td>
                    <td style="text-align: center;"><b>${student.position}</b></td>
                    <td>${student.studentRegId || ''}</td>
                    <td><b>${student.studentName}</b></td>
                    ${data.subjects.map(sub => {
                        const subData = student.subjects[sub.id] || { total: 0 };
                        return `<td style="text-align: center;">${subData.total}</td>`;
                    }).join('')}
                    <td style="text-align: center;"><b>${student.displayTotal}</b></td>
                    <td style="text-align: center;"><b>${Number.isFinite(student.displayTotal) ? (student.displayTotal / 2).toFixed(1).replace(/\.0$/, '') : 0}</b></td>
                    <td style="text-align: center;"><b>${student.displayGrade}</b></td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </body>
            </html>
        `;

        const blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `MarkSheet_${classNameStr.replace(/\s+/g, '_')}.doc`;
        a.click();
    };

    const milestones = [
        { key: 'monthly_1', label: 'M1' },
        { key: 'midterm', label: 'MT' },
        { key: 'monthly_2', label: 'M2' },
        { key: 'final', label: 'FN' }
    ]

    const filteredMilestones = filterType === 'all'
        ? milestones
        : milestones.filter(m => m.key === filterType)

    const calculateGrade = (marks, totalMarks) => {
        if (!totalMarks) return '-'
        const percentage = Math.round((marks / totalMarks) * 100)
        
        // Robust dynamic scale matching
        if (data.gradingScales && data.gradingScales.length > 0) {
            const sortedScales = [...data.gradingScales]
                .filter(s => s && s.minScore !== undefined)
                .sort((a, b) => (Number(b.minScore) || 0) - (Number(a.minScore) || 0))
            
            for (const scale of sortedScales) {
                if (percentage >= (Number(scale.minScore) || 0)) {
                    return scale.grade
                }
            }
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

    // Calculate totals and ranks based on current filter
    const processedMarkSheet = data.markSheet.map(student => {
        let currentTotal = 0
        let maxTotal = 0
        const filteredSubjects = {}

        Object.keys(student.subjects).forEach(subId => {
            const sub = student.subjects[subId]
            let subTotal = 0
            const subScores = {}

            filteredMilestones.forEach(m => {
                const score = sub.scores[m.key] || 0
                subScores[m.key] = sub.scores[m.key]
                subTotal += score
            })

            const subMax = sub.totalMarks || 0

            if (subMax > 0 || subTotal > 0) {
                filteredSubjects[subId] = {
                    ...sub,
                    scores: subScores,
                    total: subTotal,
                    totalMarks: subMax,
                    grade: calculateGrade(subTotal, subMax)
                }
                currentTotal += subTotal
                maxTotal += subMax
            }
        })

        return {
            ...student,
            subjects: filteredSubjects,
            displayTotal: currentTotal,
            displayMax: maxTotal,
            displayGrade: calculateGrade(currentTotal, maxTotal)
        }
    })

    const sortedMarkSheet = [...processedMarkSheet].sort((a, b) => b.displayTotal - a.displayTotal)
    let currentRank = 1;
    const rankedMarkSheet = sortedMarkSheet.map((student, index) => {
        if (index > 0 && student.displayTotal < sortedMarkSheet[index - 1].displayTotal) {
            currentRank++;
        }
        return {
            ...student,
            position: currentRank
        }
    })

    const [schoolInfo, setSchoolInfo] = useState(null)
    useEffect(() => {
        const saved = localStorage.getItem('schoolInfo')
        if (saved) setSchoolInfo(JSON.parse(saved))
    }, [])

    return (
        <Layout title="Class Mark Sheet">
            <div className="flex justify-between items-center mb-8 no-print">
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
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Mark Sheet</span>
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Xaanshida Natiijada (Mark Sheet)</h2>
                    <p className="text-gray-400 text-sm font-medium">Consolidated academic performance by class</p>
                </div>
                <div className="flex gap-3 no-print">
                    {/* Toggle Celceliska Button */}
                    <button
                        onClick={toggleAverage}
                        className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all border-2 ${
                            showAverage
                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-100 hover:bg-emerald-700'
                                : 'bg-white border-slate-200 text-slate-500 hover:border-emerald-400 hover:text-emerald-600'
                        }`}
                        title={showAverage ? 'Qari Celceliska' : 'Muuji Celceliska'}
                    >
                        <span className="text-base">{showAverage ? '✅' : '⬜'}</span>
                        <span>Celceliska</span>
                    </button>
                    <button
                        onClick={() => router.push('/admin/exams')}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-6 py-3 rounded-xl font-bold transition-all"
                    >
                        ← Back to Hub
                    </button>
                    {rankedMarkSheet.length > 0 && (
                        <>
                            <button
                                onClick={exportToExcel}
                                className="bg-sky-600 hover:bg-sky-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-sky-100 transition-all flex items-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                <span>Excel</span>
                            </button>
                            <button
                                onClick={exportToWord}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-100 transition-all flex items-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                <span>Word</span>
                            </button>
                        </>
                    )}
                    <button
                        onClick={handlePrint}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-indigo-100 transition-all flex items-center gap-2"
                    >
                        <span>Print Report</span>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    </button>
                </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-8 no-print">
                <div className="flex flex-wrap gap-8">
                    <div className="max-w-xs flex-1 min-w-[200px]">
                        <label className="text-xs font-bold text-gray-400 uppercase mb-2 block tracking-widest">Select Year</label>
                        <select
                            className="w-full p-4 rounded-2xl border-2 border-slate-50 focus:border-indigo-500 outline-none transition-all appearance-none bg-white font-bold text-slate-700 shadow-sm"
                            value={selectedYearId}
                            onChange={e => setSelectedYearId(e.target.value)}
                        >
                            <option value="">-- Choose Year --</option>
                            {academicYears.map(y => <option key={y.id} value={y.id}>{y.name} {y.isCurrent ? '(Current)' : ''}</option>)}
                        </select>
                    </div>

                    <div className="max-w-xs flex-1 min-w-[200px]">
                        <label className="text-xs font-bold text-gray-400 uppercase mb-2 block tracking-widest">Select Class</label>
                        <select
                            className="w-full p-4 rounded-2xl border-2 border-slate-50 focus:border-indigo-500 outline-none transition-all appearance-none bg-white font-bold text-slate-700 shadow-sm"
                            value={selectedClass}
                            onChange={e => { setSelectedClass(e.target.value); setSelectedSection(''); }}
                        >
                            <option value="">-- Choose Class --</option>
                            {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                        </select>
                    </div>

                    <div className="max-w-xs flex-1 min-w-[200px]">
                        <label className="text-xs font-bold text-gray-400 uppercase mb-2 block tracking-widest">Select Section</label>
                        <select
                            className="w-full p-4 rounded-2xl border-2 border-slate-50 focus:border-indigo-500 outline-none transition-all appearance-none bg-white font-bold text-slate-700 shadow-sm"
                            value={selectedSection}
                            onChange={e => setSelectedSection(e.target.value)}
                            disabled={!selectedClass}
                        >
                            <option value="">-- All Sections --</option>
                            {availableSections.map(s => <option key={s.id} value={s.id}>Section {s.name} ({s.shift})</option>)}
                        </select>
                    </div>

                    <div className="max-w-xs flex-1 min-w-[200px]">
                        <label className="text-xs font-bold text-gray-400 uppercase mb-2 block tracking-widest">Filter Exam Type</label>
                        <select
                            className="w-full p-4 rounded-2xl border-2 border-slate-50 focus:border-indigo-500 outline-none transition-all appearance-none bg-indigo-50 font-bold text-indigo-700 shadow-sm"
                            value={filterType}
                            onChange={e => setFilterType(e.target.value)}
                        >
                            <option value="all">Full Result (All Exams)</option>
                            <option value="monthly_1">Monthly 1 Only</option>
                            <option value="midterm">Mid-Term Only</option>
                            <option value="monthly_2">Monthly 2 Only</option>
                            <option value="final">Final Exam Only</option>
                        </select>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center p-20 no-print">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            ) : rankedMarkSheet.length > 0 ? (
                <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden print:overflow-visible print:shadow-none print:border-none print:m-0 print:p-0">
                    <div className="hidden print:flex flex-col items-center p-8 border-b-4 border-double border-slate-900 mb-6 text-center">
                        {schoolInfo?.logo && (
                            <div className="w-32 h-32 mb-4">
                                <img src={getImageUrl(schoolInfo.logo)} alt="School Logo" className="w-full h-full object-contain" />
                            </div>
                        )}
                        <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter mb-1">{schoolInfo?.name || 'OFFICIAL RESULT SHEET'}</h1>
                        <div className="flex justify-center items-center gap-6 mt-4 text-sm font-bold text-slate-600 uppercase tracking-widest">
                            <span className="bg-slate-100 px-4 py-1 rounded-full border border-slate-200">Class: {classes.find(c => c.id === selectedClass)?.class_name}</span>
                            <span className="bg-slate-100 px-4 py-1 rounded-full border border-slate-200">Exam: {filterType === 'all' ? 'FULL YEAR' : filterType.replace('_', ' ').toUpperCase()}</span>
                            <span className="bg-slate-100 px-4 py-1 rounded-full border border-slate-200">Date: {new Date().toLocaleDateString('en-GB')}</span>
                        </div>
                    </div>

                    <div className="overflow-x-auto print:overflow-visible">
                        <table className="w-full text-left border-collapse table-auto print:text-[8px]">
                            <thead>
                                <tr className="bg-slate-900 text-white uppercase font-bold tracking-widest text-[10px]">
                                    <th className="px-3 py-4 border-r border-slate-800 text-center min-w-[40px]">#</th>
                                    <th className="px-4 py-4 border-r border-slate-800 text-center min-w-[30px]">Pos</th>
                                    <th className="px-6 py-4 border-r border-slate-800 text-center min-w-[80px]">Reg ID</th>
                                    <th className="px-6 py-4 border-r border-slate-800 sticky left-0 bg-slate-900 z-10 min-w-[180px]">Student Name</th>
                                    {data.subjects.map(sub => (
                                        <th key={sub.id} className="px-2 py-4 text-center border-r border-slate-800 min-w-[110px]">
                                            <div className="truncate mb-1">{sub.name}</div>
                                            <div className="flex justify-center gap-2 text-[8px] opacity-60 font-black">
                                                {filteredMilestones.map(m => (
                                                    <span key={m.key}>{m.label}</span>
                                                ))}
                                                <span className="text-white">TOT</span>
                                            </div>
                                        </th>
                                    ))}
                                    <th className="px-6 py-4 text-center bg-slate-800">Grand Total</th>
                                    {showAverage && (
                                        <th className="px-6 py-4 text-center bg-emerald-700 text-white">Celceliska</th>
                                    )}
                                    <th className="px-6 py-4 text-center bg-indigo-700">Grade</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {rankedMarkSheet.map((student, idx) => (
                                    <tr key={student.studentId} className="hover:bg-gray-50/50 transition-colors odd:bg-gray-50/20">
                                        <td className="px-3 py-4 text-center font-bold text-slate-400 border-r border-gray-100 italic">
                                            {idx + 1}
                                        </td>
                                        <td className="px-4 py-4 font-black text-slate-500 text-center border-r border-gray-100">
                                            #{student.position}
                                        </td>
                                        <td className="px-6 py-4 font-bold text-slate-500 text-center border-r border-gray-100">
                                            {student.studentRegId}
                                        </td>
                                        <td className="px-6 py-4 font-bold text-slate-700 border-r border-gray-100 sticky left-0 bg-white z-10 group-hover:bg-gray-50">
                                            <button
                                                onClick={() => router.push(`/admin/student-report/${student.studentId}`)}
                                                className="text-indigo-600 hover:text-indigo-800 hover:underline text-left block"
                                            >
                                                {student.studentName}
                                            </button>
                                        </td>
                                        {data.subjects.map(sub => {
                                            const subData = student.subjects[sub.id] || { scores: {}, total: 0 }
                                            return (
                                                <td key={sub.id} className="px-1 py-4 border-r border-gray-100">
                                                    <div className="flex justify-center items-center gap-3 text-[10px] font-bold px-1">
                                                        {filteredMilestones.map(m => (
                                                            <span key={m.key} className={`w-4 text-center ${subData.scores[m.key] === undefined ? 'text-gray-200' : 'text-slate-500'}`}>
                                                                {subData.scores[m.key] ?? '-'}
                                                            </span>
                                                        ))}
                                                        <span className="font-black text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 min-w-[24px] text-center">
                                                            {subData.total}
                                                            <span className="ml-1 text-[8px] text-indigo-400">{subData.grade}</span>
                                                        </span>
                                                    </div>
                                                </td>
                                            )
                                        })}
                                        <td className="px-6 py-4 text-center bg-indigo-600 text-white font-black text-lg print:text-base print:bg-white print:text-indigo-700 print:border-l print:border-indigo-100">
                                            {student.displayTotal}
                                        </td>
                                        {showAverage && (
                                            <td className="px-6 py-4 text-center bg-emerald-600 text-white font-black text-lg print:text-base print:bg-white print:text-emerald-700">
                                                {Number.isFinite(student.displayTotal) ? (student.displayTotal / 2).toFixed(1).replace(/\.0$/, '') : 0}
                                            </td>
                                        )}
                                        <td className="px-6 py-4 text-center bg-indigo-700 text-white font-black text-lg print:text-base print:bg-white print:text-indigo-800">
                                            {student.displayGrade}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Official Footer for Print Only */}
                    <div className="hidden print:grid grid-cols-3 gap-12 p-12 mt-12 border-t-2 border-slate-100 text-center">
                        <div className="border-t border-slate-400 py-4">
                            <p className="text-[10px] font-black uppercase text-slate-400">Class Teacher</p>
                        </div>
                        <div className="border-t border-slate-400 py-4">
                            <p className="text-[10px] font-black uppercase text-slate-400">Examiner</p>
                        </div>
                        <div className="border-t border-slate-400 py-4">
                            <p className="text-[10px] font-black uppercase text-slate-400">School Principal</p>
                        </div>
                    </div>
                </div>
            ) : selectedClass ? (
                <div className="bg-white p-20 rounded-3xl text-center border-2 border-dashed border-gray-100 no-print">
                    <div className="text-4xl mb-4">🔍</div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">No Students or Results Found</h3>
                    <p className="text-gray-400 font-medium max-w-sm mx-auto">
                        We couldn't find any student results for this class. Please ensure that students are assigned to this class and exams have been published.
                    </p>
                    <button onClick={fetchData} className="mt-6 text-indigo-600 font-bold hover:underline">
                        Retry Fetching Data
                    </button>
                </div>
            ) : (
                <div className="bg-indigo-50 p-20 rounded-3xl text-center border border-indigo-100 border-dashed no-print">
                    <div className="text-4xl mb-4">🏆</div>
                    <p className="text-indigo-400 font-extrabold uppercase tracking-widest text-sm italic">Ready to see the winners? Select a class above!</p>
                </div>
            )}

            <style jsx global>{`
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; margin: 0; padding: 0; font-family: serif; }
                    .print-container { width: 100% !important; margin: 0 !important; }
                    table { width: 100% !important; border: 1px solid #000 !important; }
                    th, td { border: 1px solid #000 !important; vertical-align: middle !important; padding: 2px 4px !important; }
                    th { background-color: #f1f5f9 !important; color: #000 !important; -webkit-print-color-adjust: exact; }
                    .bg-indigo-600 { background: none !important; color: #000 !important; border: 1px solid #000 !important; }
                    .bg-indigo-50 { background: none !important; }
                    @page {
                        size: landscape;
                        margin: 1cm;
                    }
                }
            `}</style>
        </Layout>
    )
}
