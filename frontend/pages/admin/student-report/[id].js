import Layout from '../../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'
import { getImageUrl } from '../../../utils/imageHelper'
import { useRouter } from 'next/router'

export default function StudentReport() {
    const router = useRouter()
    const { id } = router.query
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [showAverage, setShowAverage] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('results_showAverage') !== 'false'
        }
        return true
    })

    const toggleAverage = () => {
        setShowAverage(prev => {
            const next = !prev
            localStorage.setItem('results_showAverage', String(next))
            return next
        })
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    const milestones = [
        { key: 'monthly_1', label: 'Monthly 1' },
        { key: 'midterm', label: 'Mid-Term' },
        { key: 'monthly_2', label: 'Monthly 2' },
        { key: 'final', label: 'Final-Term' }
    ]

    useEffect(() => {
        if (!id) return
        axios.get(`${apiUrl}/api/exams/student-results/${id}`, { headers: headers() })
            .then(res => {
                setData(res.data)
                setLoading(false)
            })
            .catch(err => {
                console.error(err)
                setLoading(false)
            })
    }, [id])

    const handlePrint = () => window.print()

    if (loading) return (
        <Layout title="Loading Report Card...">
            <div className="flex justify-center p-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        </Layout>
    )

    if (!data) return (
        <Layout title="Report Card Not Found">
            <div className="bg-white p-20 rounded-3xl text-center border-2 border-dashed border-gray-100">
                <p className="text-gray-400 font-medium">Student report data could not be found.</p>
                <button onClick={() => router.back()} className="mt-4 text-indigo-600 font-bold hover:underline">← Go Back</button>
            </div>
        </Layout>
    )

    const { student, subjects, grandTotal } = data

    const [schoolInfo, setSchoolInfo] = useState(null)
    useEffect(() => {
        const saved = localStorage.getItem('schoolInfo')
        if (saved) setSchoolInfo(JSON.parse(saved))
    }, [])

    return (
        <Layout title={`${student.name} - Report Card`}>
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-8 no-print">
                    <button onClick={() => router.back()} className="text-gray-500 font-bold hover:text-indigo-600 flex items-center gap-2">
                        ← Back to List
                    </button>
                    <div className="flex gap-3">
                        {/* Toggle Celceliska */}
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
                            onClick={handlePrint}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-indigo-100 transition-all flex items-center gap-2"
                        >
                            <span>Print Report Card</span>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-gray-100 print:shadow-none print:border-none print:rounded-none">
                    {/* Header Part */}
                    <div className="bg-indigo-900 p-12 text-white relative overflow-hidden">
                        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                            <div className="flex items-center gap-6">
                                {schoolInfo?.logo && (
                                    <div className="w-24 h-24 bg-white/10 p-3 rounded-2xl backdrop-blur-md border border-white/20">
                                        <img src={getImageUrl(schoolInfo.logo)} alt="Logo" className="w-full h-full object-contain" />
                                    </div>
                                )}
                                <div className="text-center md:text-left">
                                    <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Academic Progress Report</h1>
                                    <p className="text-indigo-200 font-bold tracking-widest uppercase text-sm">{schoolInfo?.name || 'Official School Record'}</p>
                                </div>
                            </div>
                            <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20 text-center md:text-right">
                                <p className="text-indigo-200 text-xs font-black uppercase mb-1">Student Status</p>
                                <p className="text-2xl font-black">ENROLLED</p>
                            </div>
                        </div>
                        {/* Abstract Background Shapes */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 -mr-20 -mt-20"></div>
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 -ml-20 -mb-20"></div>
                    </div>

                    <div className="p-8 md:p-12">
                        {/* Student Details Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12 bg-slate-50 p-8 rounded-3xl border border-slate-100">
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Student Full Name</label>
                                <p className="text-2xl font-black text-slate-800 tracking-tight">{student.name}</p>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Registration ID</label>
                                <p className="text-2xl font-black text-slate-800 tracking-tight">{student.regId}</p>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Current Class</label>
                                <p className="text-xl font-bold text-indigo-600">{student.className}</p>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Academic Session</label>
                                <p className="text-xl font-bold text-slate-600">{new Date().getFullYear()}</p>
                            </div>
                        </div>

                        {/* Subject Table */}
                        <div className="mb-12">
                            <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-sm shadow-lg">📊</span>
                                Subject-Wise Performance
                            </h3>
                            <div className="overflow-hidden rounded-3xl border border-slate-100">
                                <div className="overflow-x-auto w-full">
<table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-900 text-white text-[10px] uppercase font-bold tracking-widest">
                                            <th className="px-6 py-4">Subject Name</th>
                                            {milestones.map(m => <th key={m.key} className="px-2 py-4 text-center">{m.label}</th>)}
                                            <th className="px-6 py-4 text-center bg-slate-800">Total</th>
                                            <th className="px-6 py-4 text-center bg-indigo-700">Grade</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {subjects.map(sub => (
                                            <tr key={sub.id} className="hover:bg-indigo-50/30 transition-colors">
                                                <td className="px-6 py-4 font-bold text-slate-700">{sub.name}</td>
                                                {milestones.map(m => (
                                                    <td key={m.key} className="px-2 py-4 text-center font-medium text-slate-500">
                                                        {sub.scores[m.key] ?? '-'}
                                                    </td>
                                                ))}
                                                <td className="px-6 py-4 text-center font-black text-indigo-600 bg-indigo-50/50">
                                                    {sub.total}
                                                </td>
                                                <td className="px-6 py-4 text-center font-black text-indigo-700 bg-indigo-100/30">
                                                    {sub.grade || '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-slate-50 border-t-2 border-slate-100">
                                            <td colSpan={4} className="px-6 py-6 text-right font-black text-slate-400 uppercase tracking-widest text-xs">Over-all Achievement</td>
                                            <td colSpan={1} className="px-6 py-6 text-center font-black text-3xl text-indigo-600">
                                                {grandTotal}
                                            </td>
                                            {showAverage && (
                                                <td className="px-6 py-6 text-center font-black text-2xl text-emerald-600 bg-emerald-50/30">
                                                    <div className="text-[10px] text-emerald-500 mb-1 uppercase tracking-widest">Celceliska</div>
                                                    {Number.isFinite(grandTotal) ? (grandTotal / 2).toFixed(1).replace(/\.0$/, '') : '0'}
                                                </td>
                                            )}
                                            <td className="px-6 py-6 text-center font-black text-3xl text-indigo-700">
                                                {data.grade || '-'}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
</div>
                            </div>
                        </div>

                        {/* Footer Signatures */}
                        <div className="grid grid-cols-3 gap-12 mt-20 text-center">
                            <div className="flex flex-col items-center">
                                <div className="w-full border-t border-slate-300 pt-4">
                                    <p className="text-[10px] font-black uppercase text-slate-500">Class Teacher</p>
                                </div>
                            </div>
                            <div className="flex flex-col items-center">
                                <div className="w-full border-t border-slate-300 pt-4">
                                    <p className="text-[10px] font-black uppercase text-slate-500">Examinations Office</p>
                                </div>
                            </div>
                            <div className="flex flex-col items-center">
                                <div className="w-full border-t border-slate-300 pt-4">
                                    <p className="text-[10px] font-black uppercase text-slate-500">School Principal</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; margin: 0; padding: 0; font-family: serif; }
                    .max-w-4xl { max-width: 100% !important; }
                    .bg-white { box-shadow: none !important; border: none !important; }
                    .bg-indigo-900 { background-color: #1e1b4b !important; color: white !important; -webkit-print-color-adjust: exact; }
                    .p-12 { padding: 2rem !important; }
                    .mb-12 { margin-bottom: 2rem !important; }
                    table { border: 1px solid #000 !important; }
                    th, td { border: 1px solid #000 !important; }
                    .bg-slate-900 { background-color: #0f172a !important; color: white !important; -webkit-print-color-adjust: exact; }
                    .bg-slate-800 { background-color: #1e293b !important; color: white !important; -webkit-print-color-adjust: exact; }
                    .bg-indigo-50 { background-color: #f5f3ff !important; -webkit-print-color-adjust: exact; }
                }
            `}</style>
        </Layout>
    )
}
