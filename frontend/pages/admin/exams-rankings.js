import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'

export default function ExamRankings() {
    const [rankings, setRankings] = useState([])
    const [classes, setClasses] = useState([])
    const [sections, setSections] = useState([])
    const [academicYears, setAcademicYears] = useState([])
    const [schoolInfo, setSchoolInfo] = useState(null)
    
    const [selectedYearId, setSelectedYearId] = useState('')
    const [selectedClassId, setSelectedClassId] = useState('')
    const [selectedSectionId, setSelectedSectionId] = useState('')
    const [sortOrder, setSortOrder] = useState('desc')
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        const saved = localStorage.getItem('schoolInfo')
        if (saved) setSchoolInfo(JSON.parse(saved))
    }, [])

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    useEffect(() => {
        fetchInitialData()
    }, [])

    const fetchInitialData = async () => {
        try {
            const [yearsRes, classesRes] = await Promise.all([
                axios.get(`${apiUrl}/api/academic-years`, { headers: headers() }),
                axios.get(`${apiUrl}/api/classes`, { headers: headers() })
            ])
            
            const years = Array.isArray(yearsRes.data) ? yearsRes.data : (yearsRes.data.data || [])
            setAcademicYears(years)
            setClasses(Array.isArray(classesRes.data) ? classesRes.data : (classesRes.data.data || []))

            const currentYear = years.find(y => y.isCurrent)
            if (currentYear) {
                setSelectedYearId(currentYear.id)
            }
        } catch (err) {
            console.error('Error fetching initial data:', err)
        }
    }

    useEffect(() => {
        if (selectedClassId) {
            axios.get(`${apiUrl}/api/sections?classId=${selectedClassId}`, { headers: headers() })
                .then(res => setSections(Array.isArray(res.data) ? res.data : (res.data.data || [])))
                .catch(err => console.error('Error fetching sections:', err))
        } else {
            setSections([])
            setSelectedSectionId('')
        }
    }, [selectedClassId])

    const fetchRankings = async () => {
        if (!selectedYearId || !selectedClassId) return
        setLoading(true)
        try {
            const url = `${apiUrl}/api/exams/rankings?academicYearId=${selectedYearId}&classId=${selectedClassId}${selectedSectionId ? `&sectionId=${selectedSectionId}` : ''}&order=${sortOrder}`
            const res = await axios.get(url, { headers: headers() })
            setRankings(res.data)
        } catch (err) {
            console.error('Error fetching rankings:', err)
        } finally {
            setLoading(false)
        }
    }

    const exportToExcel = () => {
        if (!rankings || rankings.length === 0) return;
        const selectedClass = classes.find(c => c.id === selectedClassId);
        
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
                        <td colspan="6" class="title-row">${sortOrder === 'desc' ? 'Top 10 Students Rankings' : 'Bottom 10 Students Rankings'}</td>
                    </tr>
                    <tr>
                        <td colspan="6" class="info-row">Class: ${selectedClass?.class_name || ''} | Session: ${selectedYearId ? academicYears.find(y => y.id === selectedYearId)?.name : ''}</td>
                    </tr>
                    <tr>
                        <th>Rank</th>
                        <th>Student Name</th>
                        <th>Reg ID</th>
                        <th>Total Marks</th>
                        <th>Possible Marks</th>
                        <th>Percentage</th>
                    </tr>
        `;

        rankings.forEach((r, idx) => {
            const percentage = ((r.totalMarks / r.possibleMarks) * 100).toFixed(1);
            html += `
                <tr>
                    <td style="text-align: center;">${idx + 1}</td>
                    <td>${r.name}</td>
                    <td>'${r.student_id || ''}</td>
                    <td style="text-align: center;">${r.totalMarks}</td>
                    <td style="text-align: center;">${r.possibleMarks}</td>
                    <td style="text-align: center; font-weight: bold;">${percentage}%</td>
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
        a.download = `Rankings_${selectedClass?.class_name.replace(/\s+/g, '_') || 'Report'}.xls`;
        a.click();
    };

    const exportToWord = () => {
        if (!rankings || rankings.length === 0) return;
        const selectedClass = classes.find(c => c.id === selectedClassId);
        
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
                    th, td { border: 1px solid #ccc; padding: 10px; text-align: left; }
                    th { background-color: #f3f4f6; font-weight: bold; text-align: center; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="title">${sortOrder === 'desc' ? 'Top 10 Students Rankings' : 'Bottom 10 Students Rankings'}</div>
                    <div class="subtitle">Class: ${selectedClass?.class_name || ''}</div>
                    <div class="subtitle">Session: ${selectedYearId ? academicYears.find(y => y.id === selectedYearId)?.name : ''}</div>
                </div>
                
                <table>
                    <thead>
                        <tr>
                            <th style="width: 10%">Rank</th>
                            <th>Student Name</th>
                            <th>Reg ID</th>
                            <th>Total Marks</th>
                            <th>Possible Marks</th>
                            <th>Percentage</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        rankings.forEach((r, idx) => {
            const percentage = ((r.totalMarks / r.possibleMarks) * 100).toFixed(1);
            html += `
                <tr>
                    <td style="text-align: center;"><b>${idx + 1}</b></td>
                    <td><b>${r.name}</b></td>
                    <td>${r.student_id || ''}</td>
                    <td style="text-align: center;">${r.totalMarks}</td>
                    <td style="text-align: center;">${r.possibleMarks}</td>
                    <td style="text-align: center;"><b>${percentage}%</b></td>
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
        a.download = `Rankings_${selectedClass?.class_name.replace(/\s+/g, '_') || 'Report'}.doc`;
        a.click();
    };

    useEffect(() => {
        fetchRankings()
    }, [selectedYearId, selectedClassId, selectedSectionId, sortOrder])

    return (
        <Layout title="Exam Rankings - Top 10">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-2xl font-black text-slate-800">
                        {sortOrder === 'desc' ? 'Top 10 Arday ee ugu Sareeya' : '10-ka Arday ee ugu Hooseeya'}
                    </h2>
                    <p className="text-gray-400 text-sm">
                        {sortOrder === 'desc' ? 'Liiska 10-ka arday ee dhibcaha ugu badan keenay' : 'Liiska 10-ka arday ee dhibcaha ugu hooseeya keenay'}
                    </p>
                </div>
                <div className="flex gap-3 no-print">
                    {rankings.length > 0 && (
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
                        onClick={() => window.print()} 
                        className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg"
                    >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 00-2 2h2m2 4h10a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 00-2 2h2m2 4h10a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 00-2 2h2m2 4h10a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 00-2 2h2m2 4h10a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 00-2 2h2" /></svg>
                    Daabac (Print)
                </button>
            </div>
        </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Sanad Dugsiyeedka (Year):</label>
                    <select
                        value={selectedYearId}
                        onChange={(e) => setSelectedYearId(e.target.value)}
                        className="w-full bg-slate-50 border-none rounded-2xl px-4 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    >
                        <option value="">Dooro Sanadka</option>
                        {academicYears.map(y => (
                            <option key={y.id} value={y.id}>{y.name} {y.isCurrent ? '⭐' : ''}</option>
                        ))}
                    </select>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Fasalka (Class):</label>
                    <select
                        value={selectedClassId}
                        onChange={(e) => setSelectedClassId(e.target.value)}
                        className="w-full bg-slate-50 border-none rounded-2xl px-4 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    >
                        <option value="">Dooro Fasalka</option>
                        {classes.map(c => (
                            <option key={c.id} value={c.id}>{c.class_name}</option>
                        ))}
                    </select>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Qaybta (Section - Optional):</label>
                    <select
                        value={selectedSectionId}
                        onChange={(e) => setSelectedSectionId(e.target.value)}
                        className="w-full bg-slate-50 border-none rounded-2xl px-4 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    >
                        <option value="">Dhamaan Qaybaha (All Sections)</option>
                        {sections.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Sida loo kala horeeyo (Sort By):</label>
                    <select
                        value={sortOrder}
                        onChange={(e) => setSortOrder(e.target.value)}
                        className="w-full bg-slate-50 border-none rounded-2xl px-4 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    >
                        <option value="desc">Top 10 (Ugu Sareeya)</option>
                        <option value="asc">Bottom 10 (Ugu Liidata)</option>
                    </select>
                </div>
            </div>

            {/* Rankings List */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
                <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex justify-between items-center">
                    <h3 className="font-black text-slate-800 uppercase tracking-wider flex items-center gap-3 text-sm">
                        <span className="bg-indigo-600 text-white p-2 rounded-lg">{sortOrder === 'desc' ? '🏆' : '📉'}</span>
                        {sortOrder === 'desc' ? '10-ka Ugu Sareeya' : '10-ka Ugu Liidata'} (Rankings)
                    </h3>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Natiijada Isku-darka ah
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-900 text-white">
                                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest">Rank</th>
                                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest">Ardayga (Student)</th>
                                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest">Reg ID</th>
                                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-center">Dhibcaha (Marks)</th>
                                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-center">Total Possible</th>
                                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-center">Percentage</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="px-8 py-20 text-center">
                                        <div className="flex flex-col items-center">
                                            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                                            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Waa la soo riday xogta...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : rankings.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-8 py-20 text-center">
                                        <div className="text-4xl mb-4">Empty</div>
                                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Ma jirto xog laga helay fasalkan iyo sanadkan.</p>
                                    </td>
                                </tr>
                            ) : (
                                rankings.map((r, idx) => {
                                    const percentage = ((r.totalMarks / r.possibleMarks) * 100).toFixed(1)
                                    const isTop3 = idx < 3
                                    const medalColors = ['text-amber-400', 'text-slate-400', 'text-amber-700']

                                    return (
                                        <tr key={r.id} className={`group transition-colors hover:bg-slate-50/50 ${isTop3 ? 'bg-indigo-50/20' : ''}`}>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-3">
                                                    <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${isTop3 ? 'bg-white shadow-md border-2 border-indigo-100' : 'bg-slate-100 text-slate-500'}`}>
                                                        {idx + 1}
                                                    </span>
                                                    {isTop3 && <span className={`${medalColors[idx]} text-xl`}>🏆</span>}
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="font-black text-slate-800 tracking-tight">{r.name}</div>
                                                <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Student Record</div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">{r.student_id}</span>
                                            </td>
                                            <td className="px-8 py-6 text-center font-black text-indigo-600 text-lg">
                                                {r.totalMarks}
                                            </td>
                                            <td className="px-8 py-6 text-center text-slate-400 font-bold text-sm">
                                                {r.possibleMarks}
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden max-w-[100px]">
                                                        <div 
                                                            className={`h-full transition-all duration-1000 ${Number(percentage) >= 50 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                                                            style={{ width: `${percentage}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className={`text-[11px] font-black ${Number(percentage) >= 50 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                        {percentage}%
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="mt-10 p-8 bg-amber-50 rounded-3xl border border-amber-100">
                <div className="flex gap-4">
                    <span className="text-2xl">💡</span>
                    <div>
                        <h4 className="font-black text-amber-800 text-sm uppercase tracking-wider">Xusuusin Muhiim ah</h4>
                        <p className="text-amber-700/80 text-xs mt-1 leading-relaxed">
                            Natiijadan waxaa lagu xisaabiyay dhamaan imtixaanada loo asteeyay <b>"Grading"</b>, <b>"Published"</b> ama <b>"Locked"</b>. 
                            Haddii imtixaanku uu wali yahay "Draft", dhibcihiisu halkan kama soo muuqan doonaan.
                        </p>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                @media print {
                    .no-print, header, aside, .grid, .mt-10, button { display: none !important; }
                    body { background: white !important; margin: 0; padding: 0; font-family: serif; }
                    .bg-white { box-shadow: none !important; border: none !important; }
                    table { width: 100% !important; border: 1px solid #000 !important; border-collapse: collapse !important; }
                    th, td { border: 1px solid #000 !important; padding: 8px !important; }
                    th { background-color: #f1f5f9 !important; color: #000 !important; -webkit-print-color-adjust: exact; }
                }
            `}</style>
        </Layout>
    )
}
