import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import axios from 'axios'
import { generateReportCard } from '../../utils/reportCardUtils'
import StudentResultsView from '../../components/exams/StudentResultsView'
import { StatSkeleton, TableSkeleton, LoadingOverlay } from '../../components/DashboardSkeleton'
import { useLanguage } from '../../context/LanguageContext'

export default function ParentDashboard() {
    const { t } = useLanguage()
    const [user, setUser] = useState(null)
    const [children, setChildren] = useState([])
    const [selectedChild, setSelectedChild] = useState(null)
    const [childData, setChildData] = useState({ attendance: [], grades: [], payments: [] })
    const [loading, setLoading] = useState(true)
    const [currentYear, setCurrentYear] = useState(null)
    const [showModal, setShowModal] = useState(false)
    const [modalLoading, setModalLoading] = useState(false)
    const [childYears, setChildYears] = useState([])
    const [selectedYearId, setSelectedYearId] = useState('')
    const [announcements, setAnnouncements] = useState([])
    const [error, setError] = useState('')
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'

    const fetchDashboard = async () => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
        if (!token) return window.location.href = '/'
        const headers = { Authorization: `Bearer ${token}` }

        try {
            const [profileRes, childRes, annRes] = await Promise.all([
                axios.get(`${apiUrl}/api/users/profile`, { headers }),
                axios.get(`${apiUrl}/api/parents/my-children`, { headers }),
                axios.get(`${apiUrl}/api/announcements`, { headers }).catch(() => ({ data: [] }))
            ])
            setUser(profileRes.data)
            setChildren(childRes.data?.data || (Array.isArray(childRes.data) ? childRes.data : []))
            setCurrentYear(childRes.data?.currentYear)
            setAnnouncements(Array.isArray(annRes.data) ? annRes.data.slice(0, 3) : [])
            setLoading(false)
        } catch (error) {
            console.error("Dashboard Load Error:", error)
            setError(`Error: ${error.response?.status || ''} ${error.response?.data?.message || error.message}`)
            if (error.response?.status === 401) window.location.href = '/'
            setLoading(false)
        }
    }

    const fetchChildDetails = async (child, yearId = null) => {
        setSelectedChild(child)
        if (!yearId) {
            setShowModal(true)
            setChildYears([])
            setSelectedYearId('')
        }
        setModalLoading(true)
        setChildData({ attendance: [], grades: [], payments: [], statusHistory: [] })
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
        const headers = { Authorization: `Bearer ${token}` }

        let attData = [], examData = null, payData = [], statData = [];

        // Calculate 3 months ago date filter for recent payments
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        const threeMonthsAgoStr = threeMonthsAgo.toISOString().split('T')[0];

        try {
            const examUrl = `${apiUrl}/api/exams/student-results?studentId=${child.id}${yearId ? `&academicYearId=${yearId}` : ''}`
            const attUrl = yearId ? `${apiUrl}/api/attendance?studentId=${child.id}&academicYearId=${yearId}` : `${apiUrl}/api/attendance?studentId=${child.id}`
            const payUrl = yearId 
                ? `${apiUrl}/api/payments?academicYearId=${yearId}&startDate=${threeMonthsAgoStr}` 
                : `${apiUrl}/api/payments?startDate=${threeMonthsAgoStr}`
            const statUrl = yearId ? `${apiUrl}/api/payments/student/${child.id}/status-history?academicYearId=${yearId}` : `${apiUrl}/api/payments/student/${child.id}/status-history`
            
            // Fetch individually to prevent one failure from breaking everything
            const attRes = await axios.get(attUrl, { headers }).catch(e => { console.error('Attendance Error:', e); return { data: [] }; });
            const examRes = await axios.get(examUrl, { headers }).catch(e => { console.error('Exam Error:', e); return { data: null }; });
            const payRes = await axios.get(payUrl, { headers }).catch(e => { console.error('Payments Error:', e); return { data: [] }; });
            const statRes = await axios.get(statUrl, { headers }).catch(e => { console.error('Payment Status Error:', e); return { data: [] }; });

            attData = Array.isArray(attRes.data?.data) ? attRes.data.data : (Array.isArray(attRes.data) ? attRes.data : []);
            examData = examRes.data?.data || examRes.data; // Handle both wrapped and unwrapped responses
            payData = (Array.isArray(payRes.data) ? payRes.data : (payRes.data?.data || [])).filter(p => p.studentId === child.id);
            
            const now = new Date();
            const currentMonth = now.getMonth() + 1;
            const currentYear = now.getFullYear();
            
            statData = (Array.isArray(statRes.data) ? statRes.data : (statRes.data?.data || [])).filter(s =>
                s.year < currentYear || (s.year === currentYear && s.month <= currentMonth)
            );

            // Fetch years if not already fetched
            if (!yearId) {
                try {
                    const yRes = await axios.get(`${apiUrl}/api/exams/student-history-years/${child.id}`, { headers });
                    const years = yRes.data || [];
                    setChildYears(years)
                    if (years.length > 0) {
                        const current = years.find(y => y.isCurrent) || years[0]
                        setSelectedYearId(current.id)
                        
                        // If we found a current year and it wasn't what we just fetched (implicitly), 
                        // we should ideally re-fetch exam results for THIS specific year to be 100% sure.
                        // But since the backend now handles current year fallback robustly, we just ensure 
                        // the state is updated.
                        if (current.id && !yearId) {
                            // Optionally re-fetch if you want to be extremely safe:
                            // const specificExamRes = await axios.get(`${apiUrl}/api/exams/student-results/${child.id}?academicYearId=${current.id}`, { headers });
                            // examData = specificExamRes.data?.data || specificExamRes.data;
                        }
                    }
                } catch (yErr) {
                    console.error('History Years Error:', yErr);
                }
            }

            setChildData({
                attendance: attData,
                grades: examData,
                payments: payData,
                statusHistory: statData
            });
            setModalLoading(false);
        } catch (error) {
            console.error("Error fetching child details:", error)
            setModalLoading(false)
        }
    }

    useEffect(() => { fetchDashboard() }, [])

    if (loading) {
        return (
            <Layout title="Dashboard">
                <LoadingOverlay />
                <div className="mb-8 animate-pulse">
                    <div className="w-64 h-8 bg-slate-100 rounded-full mb-2"></div>
                    <div className="w-48 h-4 bg-slate-50 rounded-full"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                    <StatSkeleton /><StatSkeleton /><StatSkeleton />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <TableSkeleton /><TableSkeleton />
                </div>
            </Layout>
        )
    }

    return (
        <Layout title={t('parent_dashboard')}>
            {error && <div className="mb-6 p-4 bg-rose-50 text-rose-600 rounded-2xl font-bold border border-rose-100">{error}</div>}
            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">{t('welcome_parent_name').replace('{name}', user?.name || t('parent'))}</h2>
                    <p className="text-gray-400 text-sm font-medium">{t('parent_subtitle')}</p>
                </div>
                {currentYear && (
                    <div className="bg-indigo-50 border border-indigo-100 px-4 py-2 rounded-2xl flex flex-col items-end">
                        <span className="text-[8px] font-black uppercase tracking-[0.2em] text-indigo-400">{t('academic_year')}</span>
                        <span className="text-sm font-black text-indigo-600 tracking-tight">{currentYear.name}</span>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                <div className="bg-gradient-to-br from-pink-500 to-pink-600 p-6 rounded-2xl text-white shadow-lg shadow-pink-100">
                    <p className="text-pink-100 text-xs font-bold uppercase tracking-wider mb-1">{t('children_label')}</p>
                    <p className="text-2xl font-black">{children.length} {t('students_count')}</p>
                    <p className="text-pink-200 text-sm mt-2">{t('children_connected_account')}</p>
                </div>
                <Link href="/parent/marks" className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all group">
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">{t('results_label')}</p>
                    <div className="flex items-center justify-between">
                        <p className="text-lg font-black text-indigo-600">{t('exam_label')}</p>
                        <span className="text-2xl grayscale group-hover:grayscale-0 transition-all">📊</span>
                    </div>
                    <p className="text-[10px] text-gray-400 font-bold mt-2 uppercase tracking-widest group-hover:text-indigo-400 transition-colors">{t('view_students_results')}</p>
                </Link>
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">{t('status_label')}</p>
                    <p className="text-lg font-black text-green-600">{t('active')}</p>
                </div>
            </div>

            {/* Announcements Widget */}
            {!loading && announcements.length > 0 && (
                <div className="mb-8 bg-gradient-to-r from-pink-600 to-rose-700 rounded-[2rem] p-8 shadow-xl shadow-pink-100 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl group-hover:scale-110 transition-all duration-700"></div>
                    <div className="relative z-10">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-xl">📢</div>
                                <div>
                                    <h3 className="text-white font-black uppercase tracking-widest text-sm">{t('announcements')}</h3>
                                    <p className="text-pink-100 text-[10px] font-bold uppercase tracking-tight">Ogeysiisyadii ugu dambeeyay</p>
                                </div>
                            </div>
                            <Link href="/parent/announcements">
                                <span className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer backdrop-blur-sm">
                                    View All →
                                </span>
                            </Link>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {announcements.map(a => (
                                <div key={a.id} className="bg-white/10 backdrop-blur-md border border-white/10 p-5 rounded-2xl hover:bg-white/20 transition-all cursor-default group/item">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`w-1.5 h-1.5 rounded-full ${a.priority === 'urgent' ? 'bg-red-400 animate-pulse' : a.priority === 'high' ? 'bg-amber-400' : 'bg-pink-300'}`}></span>
                                        <span className="text-[9px] font-black text-pink-100 uppercase tracking-widest">
                                            {new Date(a.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <h4 className="text-white font-bold text-sm line-clamp-1 group-hover/item:text-pink-200 transition-colors">{a.title}</h4>
                                    <p className="text-pink-100/70 text-xs mt-1 line-clamp-2 leading-relaxed">{a.content}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-8">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                        <h3 className="text-lg font-bold text-slate-800">{t('my_children')}</h3>
                    </div>
                    <div className="p-6 grid grid-cols-1 gap-4">
                        {children.map(child => (
                            <div key={child.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-pink-200 transition-all group">
                                <div className="flex items-center space-x-4">
                                    <div className="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center text-pink-600 font-bold text-xl">
                                        {child.user?.name?.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800">{child.user?.name}</p>
                                        <p className="text-xs text-gray-400 uppercase font-medium">
                                            {child.status?.toLowerCase() === 'graduated' 
                                                ? t('graduated') 
                                                : `${child.clss?.class_name} - ${child.section?.name || t('general')}`}
                                        </p>
                                        {child.currentMonthStatus === 'unpaid' && (
                                            <p className="text-[9px] font-black text-rose-600 uppercase tracking-widest mt-1 bg-rose-50 px-2 py-0.5 rounded-full w-fit">
                                                {t('status_please_pay')}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => fetchChildDetails(child)}
                                    className="bg-white text-pink-600 border border-pink-100 px-4 py-2 rounded-xl text-xs font-bold hover:bg-pink-600 hover:text-white transition-all shadow-sm"
                                >
                                    {t('view_data')}
                                </button>
                            </div>
                        ))}
                        {children.length === 0 && <p className="text-center text-gray-400 py-8 italic font-medium">{t('no_students_connected')}</p>}
                    </div>
                </div>
            </div>

            {showModal && selectedChild && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden max-h-[90vh] flex flex-col border border-white/20">
                        <div className="bg-slate-900 p-8 text-white flex justify-between items-center shrink-0">
                            <div className="flex items-center space-x-4">
                                <div className="w-14 h-14 bg-pink-500 rounded-2xl flex items-center justify-center font-black text-2xl shadow-lg shadow-pink-500/20">{selectedChild.user?.name?.charAt(0)}</div>
                                <div>
                                    <h3 className="text-2xl font-black">{selectedChild.user?.name}</h3>
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                                            {selectedChild.status?.toLowerCase() === 'graduated' 
                                                ? t('graduated') 
                                                : `${childData.grades?.student?.className || selectedChild.clss?.class_name} - ${childData.grades?.student?.sectionName || selectedChild.section?.name || t('general')}`}
                                        </p>
                                        <span className="text-slate-600 text-[10px] font-black uppercase tracking-widest bg-white/10 px-2 py-0.5 rounded-lg border border-white/10">
                                            {childYears.find(y => y.id === selectedYearId)?.name || currentYear?.name || t('academic_year')}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setShowModal(false)} className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-2xl hover:bg-white/20 transition-all">✕</button>
                        </div>

                        <div className="p-8 overflow-y-auto space-y-8 bg-gray-50/50 relative">
                            {modalLoading && (
                                <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-sm transition-all duration-500">
                                    <div className="flex flex-col items-center">
                                        <div className="w-12 h-12 border-4 border-pink-100 border-t-pink-600 rounded-full animate-spin shadow-lg"></div>
                                        <p className="mt-4 text-[10px] font-black text-pink-600 uppercase tracking-[0.3em] animate-pulse">{t('searching')}</p>
                                    </div>
                                </div>
                            )}
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                                <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">{t('attendance')}</p>
                                    <p className="text-xl font-black text-slate-800">
                                        {childData.attendance.filter(a => ['Present', 'Late'].includes(a.status)).length} / {childData.attendance.length}
                                    </p>
                                </div>
                                <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">{t('exam_total')}</p>
                                    <p className="text-xl font-black text-indigo-500">
                                        {childData.grades ? `${childData.grades.grandTotal} / ${childData.grades.grandMax}` : 'N/A'}
                                    </p>
                                </div>
                                <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Average</p>
                                    <p className="text-xl font-black text-indigo-600">
                                        {childData.grades?.average !== undefined
                                            ? `${childData.grades.average}%`
                                            : childData.grades?.grandMax > 0
                                                ? `${((childData.grades.grandTotal / childData.grades.grandMax) * 100).toFixed(1)}%`
                                                : 'N/A'}
                                    </p>
                                </div>
                                <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Status</p>
                                    {childData.grades ? (
                                        <span className={`text-sm font-black px-3 py-1 rounded-full w-fit mt-1 ${
                                            (childData.grades.status || (childData.grades.average >= 50 ? 'Pass' : 'Fail')) === 'Pass'
                                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                                : 'bg-rose-50 text-rose-600 border border-rose-200'
                                        }`}>
                                            {childData.grades.status || (childData.grades.average >= 50 ? 'Pass' : 'Fail')}
                                        </span>
                                    ) : <p className="text-xl font-black text-slate-400">N/A</p>}
                                </div>
                                <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm border-l-4 border-l-amber-400 flex flex-col">
                                    <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-2">Class Position</p>
                                    <p className="text-xl font-black text-amber-500">
                                        {childData.grades?.classPosition || '—'}
                                        {childData.grades?.totalStudentsInClass > 0 && (
                                            <span className="text-xs text-gray-400 ml-1 font-bold">of {childData.grades.totalStudentsInClass}</span>
                                        )}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
                                <div className="flex justify-between items-center bg-pink-50 p-6 rounded-[2rem] border border-pink-100">
                                    <div>
                                        <h4 className="text-sm font-black text-pink-600 uppercase tracking-widest">{t('general_report_card')}</h4>
                                        <p className="text-xs text-pink-400 mt-1">{t('download_full_report_desc')}</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            const token = localStorage.getItem('token')
                                            const path = selectedYearId 
                                                ? `/api/reports/student-report/${selectedChild.id}?token=${token}&academicYearId=${selectedYearId}`
                                                : `/api/reports/student-report/${selectedChild.id}?token=${token}`;
                                            const fullUrl = `${apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl}${path.startsWith('/') ? path : `/${path}`}`;
                                            window.open(fullUrl, '_blank')
                                        }}
                                        className="bg-pink-600 text-white px-8 py-3 rounded-2xl text-xs font-black hover:bg-pink-700 transition-all shadow-lg shadow-pink-200"
                                    >
                                        {t('download_report_card')}
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="space-y-4 lg:col-span-2">
                                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest pl-2">{t('exam_results_schedule')}</h4>
                                    <StudentResultsView 
                                        data={childData.grades} 
                                        years={childYears}
                                        selectedYearId={selectedYearId}
                                        onYearChange={(yId) => {
                                            setSelectedYearId(yId)
                                            fetchChildDetails(selectedChild, yId)
                                        }}
                                    />
                                </div>

                                <div className="space-y-8 lg:col-span-2">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                        <div className="space-y-4">
                                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest pl-2">{t('payment_status_label')}</h4>
                                            <div className="grid grid-cols-1 gap-4">
                                                {childData.statusHistory.map((s, idx) => (
                                                    <div key={idx} className={`bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center border-l-4 ${s.status === 'paid' ? 'border-l-emerald-500' : 'border-l-rose-500'}`}>
                                                        <div>
                                                            <p className="font-bold text-slate-700 text-sm">{t('month_year_format').replace('{month}', s.month).replace('{year}', s.year)}</p>
                                                            <p className={`text-[9px] font-black uppercase tracking-widest ${s.status === 'paid' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                                {s.status === 'paid' ? t('is_paid') : t('still_owed')}
                                                            </p>
                                                        </div>
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${s.status === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                                            {s.status === 'paid' ? '✓' : '!'}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2 pt-4">{t('payment_date')}</h4>
                                            <div className="space-y-3">
                                                {childData.payments.map((p, idx) => (
                                                    <div key={idx} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center">
                                                        <div className="flex items-center space-x-4">
                                                            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-lg">💰</div>
                                                            <div>
                                                                <p className="font-bold text-slate-700 text-sm">{p.description || t('monthly_fee')}</p>
                                                                <p className="text-[10px] text-gray-400 uppercase font-bold">
                                                                    {new Date(p.date).toLocaleDateString()}
                                                                    {p.transactionId && ` • ID: ${p.transactionId}`}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-sm font-black text-slate-800">${p.amount}</p>
                                                            <p className="text-[9px] font-bold text-gray-400 uppercase">{p.payment_method}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                                {childData.payments.length === 0 && <p className="text-xs text-center text-gray-400 py-4 italic">{t('no_payment_record_found')}</p>}
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center pr-4">
                                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2 pt-2 lg:pt-0">{t('recent_attendance_label')}</h4>
                                                <Link href={`/parent/attendance?childId=${selectedChild.id}`}>
                                                    <span className="text-[10px] font-black text-pink-600 uppercase tracking-widest bg-pink-50 px-3 py-1 rounded-xl cursor-pointer hover:bg-pink-600 hover:text-white transition-all shadow-sm">{t('full_history')}</span>
                                                </Link>
                                            </div>
                                            <div className="overflow-hidden rounded-3xl border border-gray-100 shadow-sm bg-white mt-2">
                                                <div className="overflow-x-auto w-full max-h-[300px] overflow-y-auto custom-scrollbar">
                                                    <table className="w-full text-left border-collapse">
                                                        <thead>
                                                            <tr className="bg-gray-50/50">
                                                                <th className="px-4 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">{t('date_label')}</th>
                                                                <th className="px-4 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">{t('period_label')}</th>
                                                                <th className="px-4 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">{t('status_label')}</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-50">
                                                            {(() => {
                                                                const uniqueDates = new Set();
                                                                const filtered = [];
                                                                for (const a of (childData.attendance || [])) {
                                                                    const dateStr = new Date(a.date).toLocaleDateString();
                                                                    if (uniqueDates.size < 7 || uniqueDates.has(dateStr)) {
                                                                        filtered.push(a);
                                                                        uniqueDates.add(dateStr);
                                                                    } else {
                                                                        break;
                                                                    }
                                                                }
                                                                return filtered;
                                                            })().map((a, idx) => (
                                                                <tr key={idx} className="hover:bg-gray-50/30 transition-colors">
                                                                    <td className="px-4 py-3 text-xs font-bold text-slate-700">
                                                                        {new Date(a.date).toLocaleDateString()}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-[10px] text-gray-400 font-bold uppercase">
                                                                        {a.session} <span className="text-[9px] text-pink-300">({a.shift === 'morning' ? t('subax_am') : a.shift === 'night' ? t('habeen_night') || '🌙 Habeen' : t('galab_pm')})</span>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right">
                                                                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${a.status === 'Present' ? 'bg-emerald-50 text-emerald-600' : a.status === 'Absent' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
                                                                            {a.status === 'Present' ? t('present') : a.status === 'Absent' ? t('absent') : a.status === 'Late' ? t('late') : a.status}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                {childData.attendance.length === 0 && <p className="text-[10px] text-center text-gray-400 py-6 italic font-bold">{t('no_attendance_records')}</p>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    )
}
