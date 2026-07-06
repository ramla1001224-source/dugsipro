import { useState, useEffect } from 'react'
import { getImageUrl } from '../../utils/imageHelper'

export default function StudentResultsView({ data, years = [], selectedYearId = '', onYearChange = null }) {
    const [schoolInfo, setSchoolInfo] = useState(null)
    useEffect(() => {
        const saved = localStorage.getItem('schoolInfo')
        if (saved) setSchoolInfo(JSON.parse(saved))
    }, [])

    const isEmpty = !data || !data.subjects || data.subjects.length === 0;
    const message = data?.message || "Natiijada imtixaanka ardayga weli lama soo saarin ama lama daabicin sanadkan.";
    const title = data?.code === 'NOT_ENROLLED_IN_CLASS' ? "Fasal Laguma Qorin" : "Natiijo Lama Helin";
    const icon = data?.code === 'NOT_ENROLLED_IN_CLASS' ? "🏫" : "📊";

    if (isEmpty) {
        return (
            <div className="space-y-4">
                {years.length > 0 && (
                    <div className="flex justify-end p-2 bg-white rounded-2xl border border-slate-100 shadow-sm">
                        <select 
                            value={selectedYearId}
                            onChange={(e) => onYearChange && onYearChange(e.target.value)}
                            className="bg-transparent text-sm font-bold text-slate-700 outline-none px-4 py-1.5"
                        >
                            {years.map(y => (
                                <option key={y.id} value={y.id}>{y.name} {y.isCurrent ? '(Current)' : ''}</option>
                            ))}
                        </select>
                    </div>
                )}
                <div className="bg-white p-12 rounded-3xl text-center border-2 border-dashed border-gray-100 max-w-2xl mx-auto my-8">
                    <div className="text-5xl mb-4 grayscale opacity-30">{icon}</div>
                    <h3 className="text-xl font-black text-slate-800 mb-2">{title}</h3>
                    <p className="text-gray-400 font-medium text-sm">{message}</p>
                </div>
            </div>
        )
    }

    const { student, subjects, grandTotal, grandMax, gradingScales = [], average, status, classPosition, totalStudentsInClass } = data

    // Compute average locally if backend didn't send it
    const displayAverage = average !== undefined ? average : (grandMax > 0 ? ((grandTotal / grandMax) * 100).toFixed(1) : 0)
    const displayStatus = status || (parseFloat(displayAverage) >= 50 ? 'Pass' : 'Fail')
    const isPass = displayStatus === 'Pass'

    const calculateGrade = (marks, totalMarks) => {
        if (!totalMarks || isNaN(marks)) return 'F';
        const percentage = Math.round((marks / totalMarks) * 100)

        // Robust dynamic scale matching (DESC sort ensures correct priority)
        if (gradingScales && gradingScales.length > 0) {
            const sortedScales = [...gradingScales]
                .filter(s => s && s.minScore !== undefined)
                .sort((a, b) => (Number(b.minScore) || 0) - (Number(a.minScore) || 0));
            
            for (const scale of sortedScales) {
                if (percentage >= (Number(scale.minScore) || 0)) {
                    return scale.grade
                }
            }
        }

        // Standard Somali Fallback
        if (percentage >= 90) return 'A+'
        if (percentage >= 85) return 'B++'
        if (percentage >= 80) return 'B-'
        if (percentage >= 75) return 'C+'
        if (percentage >= 70) return 'C'
        if (percentage >= 60) return 'D'
        return 'F'
    }

    const getGradeColor = (marks, totalMarks) => {
        const grade = calculateGrade(marks, totalMarks)
        if (grade.startsWith('A')) return 'text-emerald-700 bg-emerald-50 border-emerald-100'
        if (grade.startsWith('B')) return 'text-indigo-700 bg-indigo-50 border-indigo-100'
        if (grade.startsWith('C')) return 'text-blue-700 bg-blue-50 border-blue-100'
        if (grade.startsWith('D')) return 'text-amber-700 bg-amber-50 border-amber-100'
        return 'text-rose-700 bg-rose-50 border-rose-100'
    }

    return (
        <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden my-4">
            {/* Header Section */}
            <div className="bg-slate-900 p-6 md:p-8 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                    {schoolInfo?.logo && (
                        <div className="bg-white p-2 rounded-2xl shadow-xl flex-shrink-0">
                            <img 
                                src={getImageUrl(schoolInfo.logo)} 
                                alt="Logo" 
                                className="w-16 h-16 object-contain"
                            />
                        </div>
                    )}
                    <div>
                        <h3 className="text-xl md:text-2xl font-black tracking-tight">{student?.name}</h3>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-slate-400 text-[10px] md:text-xs font-bold uppercase tracking-widest">
                            <span>{schoolInfo?.name || 'Educational Portal'}</span>
                            <span>• Class: {student?.className}</span>
                            {student?.sectionName && <span>• Section: {student?.sectionName}</span>}
                            <span>• ID: {student?.regId}</span>
                        </div>
                    </div>
                    
                    {years.length > 0 && (
                        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-3 py-1.5 flex flex-col">
                            <label className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-0.5 ml-1">Academic Year</label>
                            <select 
                                value={selectedYearId}
                                onChange={(e) => onYearChange && onYearChange(e.target.value)}
                                className="bg-transparent text-xs font-black text-white outline-none cursor-pointer pr-4"
                            >
                                {years.map(y => (
                                    <option key={y.id} value={y.id} className="text-slate-900">
                                        {y.name} {y.isCurrent ? '(Current)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
                <div className="text-left md:text-right">
                    <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Wadarta Guud (Total)</div>
                    <div className="text-2xl md:text-3xl font-black text-indigo-400">
                        {grandTotal}
                        <span className="text-sm font-bold text-slate-600 ml-1">/{grandMax}</span>
                    </div>
                </div>
            </div>

            {/* Stats Bar: Average, Status, Class Position */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-0 bg-white border-t border-gray-100">
                <div className="flex flex-col items-center justify-center py-5 px-4 border-r border-gray-100">
                    <div className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Total</div>
                    <div className="text-xl font-black text-slate-800">{grandTotal}<span className="text-xs text-slate-400 ml-1 font-bold">/{grandMax}</span></div>
                </div>
                <div className="flex flex-col items-center justify-center py-5 px-4 border-r border-gray-100">
                    <div className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Celceliska</div>
                    <div className="text-xl font-black text-indigo-600">{displayAverage}%</div>
                </div>
                <div className="flex flex-col items-center justify-center py-5 px-4 border-r border-gray-100">
                    <div className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Status</div>
                    <div className={`text-sm font-black px-3 py-1 rounded-full ${isPass ? 'text-emerald-600 bg-emerald-50 border border-emerald-200' : 'text-rose-600 bg-rose-50 border border-rose-200'}`}>
                        {displayStatus}
                    </div>
                </div>
                <div className="flex flex-col items-center justify-center py-5 px-4">
                    <div className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Class Position</div>
                    <div className="text-xl font-black text-amber-500">
                        {classPosition ? `${classPosition}` : '—'}
                        {totalStudentsInClass > 0 && <span className="text-xs text-slate-400 ml-1 font-bold">of {totalStudentsInClass}</span>}
                    </div>
                </div>
            </div>

            {/* Table Section */}
            <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[750px] border-collapse">
                    <thead>
                        <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                            <th className="p-5 bg-slate-50/50">Subject (Maado)</th>
                            <th className="p-5 bg-slate-50/50 text-center">Bile 1</th>
                            <th className="p-5 bg-slate-50/50 text-center">Term 1</th>
                            <th className="p-5 bg-slate-50/50 text-center">Bile 2</th>
                            <th className="p-5 bg-slate-50/50 text-center">Final Term</th>
                            <th className="p-5 bg-indigo-50/30 text-indigo-600 text-center hidden md:table-cell">Other</th>
                            <th className="p-5 bg-slate-50 text-right">Total</th>
                            <th className="p-5 bg-slate-50 text-right">Grade</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {subjects.map((sub) => {
                            const scores = sub.scores || {}
                            
                            // Map known keys correctly (consistent with backend structure)
                            const bile1 = scores['bile_1'] || scores['monthly_1'] || '-';
                            const term1 = scores['term_1'] || scores['midterm'] || scores['midterm_exam'] || '-';
                            const bile2 = scores['bile_2'] || scores['monthly_2'] || '-';
                            const finalTerm = scores['final_term'] || scores['final'] || '-';
                            
                            // Calculate "Other" (any scores not in the fixed columns)
                            const knownKeys = ['bile_1', 'monthly_1', 'term_1', 'midterm', 'midterm_exam', 'bile_2', 'monthly_2', 'final_term', 'final'];
                            let otherTotal = 0;
                            Object.keys(scores).forEach(k => {
                                if (!knownKeys.includes(k) && !isNaN(parseFloat(scores[k]))) {
                                    otherTotal += parseFloat(scores[k]);
                                }
                            });

                            return (
                                <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="p-5 font-black text-slate-800 text-sm">{sub.name}</td>
                                    <td className="p-5 font-bold text-slate-600 text-center text-sm">{bile1}</td>
                                    <td className="p-5 font-bold text-slate-600 text-center text-sm">{term1}</td>
                                    <td className="p-5 font-bold text-slate-600 text-center text-sm">{bile2}</td>
                                    <td className="p-5 font-bold text-slate-600 text-center text-sm">{finalTerm}</td>
                                    <td className="p-5 font-bold text-indigo-400 text-center text-sm hidden md:table-cell">
                                        {otherTotal > 0 ? otherTotal : '-'}
                                    </td>
                                    <td className="p-5 font-black text-slate-900 text-right text-base bg-slate-50/20 group-hover:bg-indigo-50/20 transition-colors">
                                        {sub.total} 
                                        <span className="text-[10px] text-slate-300 ml-1 font-bold">/ {sub.totalMarks}</span>
                                    </td>
                                    <td className="p-5 text-right">
                                        <span className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${getGradeColor(sub.total, sub.totalMarks)}`}>
                                            {sub.grade || calculateGrade(sub.total, sub.totalMarks)}
                                        </span>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
            
            {/* Footer Summary (Optional but looks premium) */}
            <div className="bg-slate-50/50 p-6 flex justify-between items-center border-t border-slate-100">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Official Academic Result</div>
                <div className="flex items-center gap-4">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Aggregate Grade:</div>
                    <span className={`px-4 py-1 rounded-full font-black text-sm shadow-sm ${getGradeColor(grandTotal, grandMax)}`}>
                        {data.grade || calculateGrade(grandTotal, grandMax)}
                    </span>
                </div>
            </div>
        </div>
    )
}
