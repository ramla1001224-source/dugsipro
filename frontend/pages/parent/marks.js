import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'
import { useRouter } from 'next/router'
import StudentResultsView from '../../components/exams/StudentResultsView'
import { StatSkeleton, TableSkeleton, LoadingOverlay } from '../../components/DashboardSkeleton'

export default function ParentMarks() {
    const [result, setResult] = useState(null)
    const [children, setChildren] = useState([])
    const [selectedChild, setSelectedChild] = useState(null)
    const [years, setYears] = useState([])
    const [selectedYearId, setSelectedYearId] = useState('')
    const [loading, setLoading] = useState(true)
    const [yearsLoading, setYearsLoading] = useState(false)
    const router = useRouter()
    const { childId } = router.query
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'

    const fetchChildren = async () => {
        try {
            const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
            const headers = { Authorization: `Bearer ${token}` }
            const res = await axios.get(`${apiUrl}/api/parents/my-children`, { headers })
            const childrenData = res.data?.data || (Array.isArray(res.data) ? res.data : [])
            setChildren(childrenData)
            
            if (!childId && childrenData.length > 0) {
                // If no childId in URL, default to first child
                setSelectedChild(childrenData[0])
            } else if (childId) {
                const currentChild = childrenData.find(c => c.id === childId)
                if (currentChild) setSelectedChild(currentChild)
            }
        } catch (err) {
            console.error('Error fetching children:', err)
        }
    }

    const fetchResults = async (studentId, yearId) => {
        if (!studentId) return
        setLoading(true)
        try {
            const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
            const headers = { Authorization: `Bearer ${token}` }
            const url = yearId
                ? `${apiUrl}/api/exams/student-results?studentId=${studentId}&academicYearId=${yearId}`
                : `${apiUrl}/api/exams/student-results?studentId=${studentId}`
            
            const res = await axios.get(url, { headers })
            if (res.data?.data) {
                setResult(res.data.data)
            } else if (res.data && !res.data.data) {
                setResult(res.data)
            }
        } catch (err) {
            console.error('Error fetching results:', err)
            setResult(null)
        } finally {
            setLoading(false)
        }
    }

    const fetchYears = async (studentId) => {
        if (!studentId) return
        setYearsLoading(true)
        try {
            const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
            const res = await axios.get(`${apiUrl}/api/exams/student-history-years/${studentId}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            const fetchedYears = res.data || []
            setYears(fetchedYears)
            if (fetchedYears.length > 0) {
                const current = fetchedYears.find(y => y.isCurrent) || fetchedYears[0]
                setSelectedYearId(current.id)
                fetchResults(studentId, current.id)
            } else {
                fetchResults(studentId)
            }
        } catch (e) {
            console.error('Error fetching years:', e)
            fetchResults(studentId)
        } finally {
            setYearsLoading(false)
        }
    }

    useEffect(() => {
        if (router.isReady) {
            fetchChildren()
        }
    }, [router.isReady])

    useEffect(() => {
        if (selectedChild?.id) {
            setResult(null)
            setLoading(true)
            fetchYears(selectedChild.id)
        }
    }, [selectedChild])

    const handleYearChange = (yearId) => {
        setSelectedYearId(yearId)
        fetchResults(selectedChild.id, yearId)
    }

    const selectedYearName = years.find(y => y.id === selectedYearId)?.name

    return (
        <Layout title="Natiijooyinka Imtixaanka">
            {loading && !result && <LoadingOverlay />}
            
            {/* Page Header */}
            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">Natiijooyinka Imtixaanka</h2>
                    <p className="text-gray-400 font-medium text-sm uppercase tracking-widest mt-1">
                        {selectedChild?.user?.name || 'Ardayga'} • {selectedYearName || 'Sanadkan'}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => router.back()}
                        className="px-6 py-3 bg-white border border-gray-200 text-slate-600 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-gray-50 transition-all shadow-sm flex items-center gap-2"
                    >
                        - dib u noqo
                    </button>
                    <button
                        onClick={() => {
                            const token = localStorage.getItem('token')
                            const path = selectedYearId
                                ? `/api/reports/student-report/${selectedChild.id}?token=${token}&academicYearId=${selectedYearId}`
                                : `/api/reports/student-report/${selectedChild.id}?token=${token}`;
                            const fullUrl = `${apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl}${path.startsWith('/') ? path : `/${path}`}`;
                            window.open(fullUrl, '_blank')
                        }}
                        disabled={!selectedChild}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
                    >
                        <span>📄 Report Card ↓</span>
                    </button>
                </div>
            </div>

            {/* Child Selector if multiple */}
            {children.length > 1 && (
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 mb-8 flex items-center gap-6">
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest min-w-fit">Dooro Ardayga:</div>
                    <div className="flex flex-wrap gap-2">
                        {children.map(c => (
                            <button
                                key={c.id}
                                onClick={() => setSelectedChild(c)}
                                className={`px-4 py-2 rounded-xl text-xs font-black transition-all border ${selectedChild?.id === c.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-600/20' : 'bg-slate-50 text-slate-600 border-gray-100 hover:bg-gray-100'}`}
                            >
                                {c.user?.name || 'Student'}
                            </button>
                        ))}
                    </div>
                </div>
            )}

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
                        years={years}
                        selectedYearId={selectedYearId}
                        onYearChange={handleYearChange}
                    />
                </div>
            )}
        </Layout>
    )
}
