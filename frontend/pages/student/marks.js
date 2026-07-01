import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'
import StudentResultsView from '../../components/exams/StudentResultsView'

export default function StudentMarks() {
    const [result, setResult] = useState(null)
    const [years, setYears] = useState([])
    const [selectedYearId, setSelectedYearId] = useState('')
    const [loading, setLoading] = useState(true)
    const [yearsLoading, setYearsLoading] = useState(true)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    const fetchResults = async (yearId) => {
        setLoading(true)
        try {
            const url = yearId
                ? `${apiUrl}/api/exams/student-results?academicYearId=${yearId}`
                : `${apiUrl}/api/exams/student-results`
            const res = await axios.get(url, { headers: headers() })
            if (res.data?.data) {
                setResult(res.data.data)
            } else if (res.data && !res.data.data) {
                // Handle direct response (empty state)
                setResult(res.data)
            }
        } catch (err) {
            console.error('Error fetching results:', err)
            setResult(null)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        const init = async () => {
            const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
            if (!token) { window.location.href = '/'; return }

            let userId;
            try {
                const payload = JSON.parse(atob(token.split('.')[1]))
                userId = payload.id;
                if (payload.role !== 'student') {
                    const d = { owner: '/owner/dashboard', super_admin: '/super-admin/dashboard', admin: '/admin/dashboard', teacher: '/teacher/dashboard', parent: '/parent/dashboard', accountant: '/accountant/dashboard', staff: '/staff/dashboard', librarian: '/librarian/dashboard' }
                    window.location.href = d[payload.role] || '/'; return
                }
            } catch (e) { window.location.href = '/'; return }

            // Fetch academic years (backend now handles userId -> studentId resolution)
            setYearsLoading(true)
            try {
                const yRes = await axios.get(`${apiUrl}/api/exams/student-history-years/${userId}`, { headers: headers() })
                const fetchedYears = yRes.data || []
                setYears(fetchedYears)
                if (fetchedYears.length > 0) {
                    // User request: Always show the school's current year first.
                    // Student can then manually switch to previous years using the filter.
                    const current = fetchedYears.find(y => y.isCurrent) || fetchedYears[0]
                    setSelectedYearId(current.id)
                    fetchResults(current.id)
                } else {
                    fetchResults()
                }
            } catch (e) {
                console.error('Error fetching years:', e)
                fetchResults()
            } finally {
                setYearsLoading(false)
            }
        }
        init()
    }, [])

    const handleYearChange = (e) => {
        const yearId = e.target.value
        setSelectedYearId(yearId)
        fetchResults(yearId)
    }

    const selectedYearName = years.find(y => y.id === selectedYearId)?.name

    return (
        <Layout title="My Academic Results">
            {/* Page Header */}
            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">Examination Results</h2>
                    <p className="text-gray-400 font-medium text-sm uppercase tracking-widest mt-1">
                        {selectedYearName || 'Current Year'} • Performance Overview
                    </p>
                </div>

                {/* Academic Year Selector - always visible */}
                <div className="flex flex-col">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Academic Year</label>
                    <div className="bg-white border border-slate-200 rounded-2xl px-4 py-2.5 shadow-sm flex items-center gap-3 min-w-[200px]">
                        <span className="text-slate-400 text-sm">📅</span>
                        {yearsLoading ? (
                            <span className="text-sm text-slate-400 font-medium italic">Loading...</span>
                        ) : years.length > 0 ? (
                            <select
                                value={selectedYearId}
                                onChange={handleYearChange}
                                className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer pr-4 w-full"
                            >
                                {years.map(y => (
                                    <option key={y.id} value={y.id}>
                                        {y.name} - {y.schoolName}{y.isCurrent ? ' (Current)' : ''}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <span className="text-sm text-slate-500 font-bold">Current Year</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Download Report Card Button */}
            <div className="mb-6 flex justify-end">
                <button
                    onClick={() => {
                        const token = localStorage.getItem('token')
                        const payload = JSON.parse(atob(token.split('.')[1]))
                        const path = selectedYearId
                            ? `/api/reports/student-report/${payload.id}?token=${token}&academicYearId=${selectedYearId}`
                            : `/api/reports/student-report/${payload.id}?token=${token}`;
                        const fullUrl = `${apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl}${path.startsWith('/') ? path : `/${path}`}`;
                        window.open(fullUrl, '_blank')
                    }}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                >
                    <span>📄 Download Report Card</span>
                </button>
            </div>

            {/* Results Content */}
            {loading && !result ? (
                <div className="flex justify-center p-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            ) : (
                <div className="relative">
                    {loading && (
                        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-3xl">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                        </div>
                    )}
                    <StudentResultsView
                        data={result}
                        years={[]}
                        selectedYearId={selectedYearId}
                        onYearChange={() => {}}
                    />
                </div>
            )}
        </Layout>
    )
}
