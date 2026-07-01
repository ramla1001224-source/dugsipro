import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'
import { useLanguage } from '../../context/LanguageContext'
import { exportToExcel, exportToPDF } from '../../utils/reportUtils'

export default function AdminPayments() {
    const { t } = useLanguage()
    const [viewMode, setViewMode] = useState('status') // 'status' or 'history'
    const [classes, setClasses] = useState([])
    const [selectedClass, setSelectedClass] = useState('')
    const [sections, setSections] = useState([])
    const [selectedSection, setSelectedSection] = useState('')
    const [month, setMonth] = useState(new Date().getMonth() + 1)
    const [year, setYear] = useState(new Date().getFullYear())
    const [activeYear, setActiveYear] = useState(null)
    const [academicYears, setAcademicYears] = useState([])

    const [payments, setPayments] = useState([])
    const [students, setStudents] = useState([])
    const [monthlyStatus, setMonthlyStatus] = useState([])
    const [loading, setLoading] = useState(false)
    const [showModal, setShowModal] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [formData, setFormData] = useState({ studentId: '', amount: '', payment_method: 'Cash', month: '', year: '', description: '', transactionId: '', phoneNumber: '' })

    const [feeStructures, setFeeStructures] = useState([])
    const [showSettings, setShowSettings] = useState(false)
    const [bulkMethod, setBulkMethod] = useState('Cash')
    const [settingLoading, setSettingLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [schoolInfo, setSchoolInfo] = useState({})
    const [canEditFees, setCanEditFees] = useState(true)
    const [userRole, setUserRole] = useState('')

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    const fetchFeeStructures = async () => {
        const info = typeof window !== 'undefined' ? localStorage.getItem('schoolInfo') : ''
        const schoolId = info ? JSON.parse(info).id : null
        try {
            const res = await axios.get(`${apiUrl}/api/fees${schoolId ? `?schoolId=${schoolId}` : ''}`, { headers: headers() })
            setFeeStructures(res.data)
        } catch (e) { console.error(e) }
    }

    useEffect(() => {
        const fetchClasses = async () => {
            const info = typeof window !== 'undefined' ? localStorage.getItem('schoolInfo') : ''
            const schoolId = info ? JSON.parse(info).id : null
            try {
                const res = await axios.get(`${apiUrl}/api/classes${schoolId ? `?schoolId=${schoolId}` : ''}`, { headers: headers() })
                setClasses(res.data)
                if (res.data.length > 0) setSelectedClass(res.data[0].id)
            } catch (e) { console.error(e) }
        }
        
        const fetchAcademicYears = async () => {
            const info = typeof window !== 'undefined' ? localStorage.getItem('schoolInfo') : ''
            const schoolId = info ? JSON.parse(info).id : null
            try {
                const res = await axios.get(`${apiUrl}/api/academic-years${schoolId ? `?schoolId=${schoolId}` : ''}`, { headers: headers() })
                setAcademicYears(res.data)
                const current = res.data.find(y => y.isCurrent)
                if (current) {
                    setActiveYear(current)
                    // Set year to current calendar year (within academic year range)
                    const todayYr = new Date().getFullYear()
                    const startYr = new Date(current.startDate).getFullYear()
                    const endYr = new Date(current.endDate).getFullYear()
                    setYear(todayYr >= startYr && todayYr <= endYr ? todayYr : endYr)
                    // Set month to current month if within academic year, else first month of academic year
                    const todayMo = new Date().getMonth() + 1
                    const startMo = new Date(current.startDate).getMonth() + 1
                    const endMo = new Date(current.endDate).getMonth() + 1
                    const startYrFull = new Date(current.startDate).getFullYear()
                    const endYrFull = new Date(current.endDate).getFullYear()
                    // Check if today's month/year is within the academic year range
                    const todayInRange = (todayYr > startYrFull || (todayYr === startYrFull && todayMo >= startMo)) &&
                                        (todayYr < endYrFull || (todayYr === endYrFull && todayMo <= endMo))
                    setMonth(todayInRange ? todayMo : startMo)
                }
            } catch (e) { console.error(e) }
        }

        fetchClasses()
        fetchFeeStructures()
        fetchAcademicYears()
        const info = typeof window !== 'undefined' ? localStorage.getItem('schoolInfo') : ''
        if (info) setSchoolInfo(JSON.parse(info))

        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
        if (token) {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]))
                setUserRole(payload.role)
                
                if (payload.role === 'accountant') {
                    axios.get(`${apiUrl}/api/settings/perm_acc_edit_fees`, { 
                        headers: { Authorization: `Bearer ${token}` } 
                    }).then(res => setCanEditFees(res.data.value === 'true'))
                      .catch(() => setCanEditFees(false))
                }
            } catch (e) { console.error(e) }
        }
    }, [])

    useEffect(() => {
        const fetchSections = async () => {
            if (!selectedClass) {
                setSections([])
                setSelectedSection('')
                return
            }
            try {
                const res = await axios.get(`${apiUrl}/api/sections?classId=${selectedClass}`, { headers: headers() })
                setSections(res.data)
                setSelectedSection('') // Reset to "All Sections" when class changes
            } catch (e) { console.error(e) }
        }
        fetchSections()
    }, [selectedClass])

    const fetchData = async () => {
        if (!selectedClass) return
        setLoading(true)
        const info = typeof window !== 'undefined' ? localStorage.getItem('schoolInfo') : ''
        const schoolQuery = info ? `&schoolId=${JSON.parse(info).id}` : ''
        try {
            if (viewMode === 'status') {
                const res = await axios.get(`${apiUrl}/api/payments/monthly-status?classId=${selectedClass}${selectedSection ? `&sectionId=${selectedSection}` : ''}&month=${month}&year=${year}${schoolQuery}`, { headers: headers() })
                setMonthlyStatus(res.data)
            } else {
                const [payRes, studRes] = await Promise.all([
                    axios.get(`${apiUrl}/api/payments?classId=${selectedClass}${selectedSection ? `&sectionId=${selectedSection}` : ''}&month=${month}&year=${year}${schoolQuery}`, { headers: headers() }),
                    axios.get(`${apiUrl}/api/students?classId=${selectedClass}${selectedSection ? `&sectionId=${selectedSection}` : ''}${schoolQuery}`, { headers: headers() })
                ])
                setPayments(payRes.data)
                setStudents(studRes.data)
            }
        } catch (e) { console.error(e) }
        finally { setLoading(false) }
    }

    useEffect(() => { fetchData() }, [selectedClass, selectedSection, viewMode, month, year])

    const [localStatuses, setLocalStatuses] = useState({}) 

    const toggleStatus = (studentId, currentStatus) => {
        const effectiveStatus = localStatuses[studentId] || currentStatus
        const newStatus = effectiveStatus === 'paid' ? 'unpaid' : 'paid'
        setLocalStatuses(prev => ({ ...prev, [studentId]: newStatus }))
    }

    const saveBulkChanges = async () => {
        if (saving) return
        setSaving(true)
        try {
            const updates = Object.entries(localStatuses).map(([studentId, status]) => ({ studentId, status }))
            if (updates.length === 0) { setSaving(false); return }
            await axios.post(`${apiUrl}/api/payments/bulk`, { updates, month, year, payment_method: bulkMethod }, { headers: headers() })
            setLocalStatuses({})
            fetchData()
            alert('Class payments synced successfully!')
        } catch (e) {
            const msg = e.response?.data?.message || 'Error saving changes'
            alert('Error: ' + msg)
        }
        finally { setSaving(false) }
    }


    const handleExportExcel = () => {
        let data = []
        if (viewMode === 'status') {
            data = monthlyStatus.map(s => ({
                [t('name')]: s.name,
                [t('id')]: s.student_id,
                [t('status')]: localStatuses[s.studentId] || s.status
            }))
        } else {
            data = students.map(s => {
                const p = payments.find(pay => pay.studentId === s.id)
                return {
                    [t('name')]: s.user?.name || s.name,
                    [t('id')]: s.student_id,
                    [t('amount')]: p ? `$${p.amount}` : 'Unpaid',
                    [t('date')]: p ? new Date(p.date).toLocaleDateString() : '—',
                    'Method': p ? p.payment_method : 'Pending',
                    'Transaction ID': p?.transactionId || '-'
                }
            })
        }
        exportToExcel(data, `Payments_${viewMode}_Report`)
    }

    const handleExportPDF = () => {
        let headers = []
        let data = []
        if (viewMode === 'status') {
            headers = [t('name'), t('id'), t('status')]
            data = monthlyStatus.map(s => [s.name, s.student_id, localStatuses[s.studentId] || s.status])
        } else {
            headers = [t('name'), t('id'), t('amount'), t('date'), 'Method']
            data = students.map(s => {
                const p = payments.find(pay => pay.studentId === s.id)
                return [s.user?.name || s.name, s.student_id, p ? `$${p.amount}` : 'Unpaid', p ? new Date(p.date).toLocaleDateString() : '—', p ? p.payment_method : 'Pending']
            })
        }
        exportToPDF(headers, data, `Payments_${viewMode}_Report`, t('fees'), schoolInfo)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (submitting) return
        setSubmitting(true)
        try {
            await axios.post(`${apiUrl}/api/payments/create`, formData, { headers: headers() })
            setShowModal(false)
            setFormData({ studentId: '', amount: '', payment_method: 'Cash', month: '', year: '', description: '', transactionId: '', phoneNumber: '' })
            fetchData()
        } catch (e) { alert(e.response?.data?.message || 'Error recording payment') }
        finally { setSubmitting(false) }
    }

    const getDefaultFee = (classId) => {
        const found = feeStructures.find(f => f.classId === classId && f.name === 'Tuition Fee')
        return found ? found.amount.toString() : ''
    }

    const updateFeeStructure = async (classId, amount) => {
        if (userRole === 'accountant' && !canEditFees) {
            alert('Fasax uma lihid inaad wax ka beddesho fees-ka. Fadlan la xiriir Admin-ka.')
            return
        }
        setSettingLoading(true)
        try {
            await axios.post(`${apiUrl}/api/fees/upsert`, { classId, amount }, { headers: headers() })
            await fetchFeeStructures()
        } catch (e) { alert('Error updating fee') }
        finally { setSettingLoading(false) }
    }

    const currentClassStudents = async () => {
        if (!selectedClass) return
        try {
            const res = await axios.get(`${apiUrl}/api/students?classId=${selectedClass}`, { headers: headers() })
            setStudents(res.data)
            setFormData(prev => ({ ...prev, amount: getDefaultFee(selectedClass) }))
        } catch (e) { console.error(e) }
    }
    useEffect(() => { if (showModal) currentClassStudents() }, [showModal, selectedClass])

    return (
        <Layout title={t('fees')}>
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <button 
                            onClick={() => window.location.href = '/admin/students'}
                            className="text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-1 font-bold text-xs uppercase tracking-widest"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            Hub
                        </button>
                        <span className="text-slate-300">/</span>
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Fees</span>
                    </div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">{t('fees')}</h2>
                    <p className="text-gray-400 font-medium">Maamul Class-ka iyo bilaha lacag bixinta</p>
                </div>

                <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
                    <button
                        onClick={handleExportPDF}
                        className="bg-red-50 text-red-600 px-5 py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all"
                    >
                        📄 {t('export_pdf')}
                    </button>
                    <button
                        onClick={handleExportExcel}
                        className="bg-emerald-50 text-emerald-600 px-5 py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all"
                    >
                        📊 {t('export_excel')}
                    </button>
                    <div className="flex flex-col">
                        <label className="text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">{t('class')}</label>
                        <select className="bg-gray-50 border-none rounded-2xl px-5 py-3 font-bold text-slate-700 outline-none" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
                            {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                        </select>
                    </div>

                    <div className="flex flex-col">
                        <label className="text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">{t('section')}</label>
                        <select 
                            className="bg-gray-50 border-none rounded-2xl px-5 py-3 font-bold text-slate-700 outline-none min-w-[120px]" 
                            value={selectedSection} 
                            onChange={e => setSelectedSection(e.target.value)}
                        >
                            <option value="">{t('all_sections') || 'All Sections'}</option>
                            {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>

                    <div className="flex flex-col">
                        <label className="text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">Year</label>
                        <select 
                            className="bg-gray-50 border-none rounded-2xl px-5 py-3 font-bold text-slate-700 outline-none"
                            value={year} 
                            onChange={e => {
                                const newYear = Number(e.target.value)
                                setYear(newYear)
                                // Reset month to a valid one for this year within the academic year
                                if (activeYear) {
                                    const startDate = new Date(activeYear.startDate)
                                    const endDate = new Date(activeYear.endDate)
                                    const startYr = startDate.getFullYear()
                                    const endYr = endDate.getFullYear()
                                    const startMo = startDate.getMonth() + 1
                                    const endMo = endDate.getMonth() + 1
                                    if (newYear === startYr && newYear === endYr) {
                                        setMonth(startMo)
                                    } else if (newYear === startYr) {
                                        setMonth(startMo)
                                    } else if (newYear === endYr) {
                                        setMonth(1)
                                    } else {
                                        setMonth(1)
                                    }
                                }
                            }}
                        >
                            {activeYear ? (
                                Array.from({ 
                                    length: new Date(activeYear.endDate).getFullYear() - new Date(activeYear.startDate).getFullYear() + 1 
                                }, (_, i) => new Date(activeYear.startDate).getFullYear() + i).map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))
                            ) : (
                                [2023, 2024, 2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)
                            )}
                        </select>
                    </div>
                    <div className="flex flex-col">
                        <label className="text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">Month</label>
                        <select className="bg-gray-50 border-none rounded-2xl px-5 py-3 font-bold text-slate-700 outline-none" value={month} onChange={e => setMonth(Number(e.target.value))}>
                            {(() => {
                                if (!activeYear) {
                                    return Array.from({ length: 12 }, (_, i) => (
                                        <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>
                                    ))
                                }
                                const startDate = new Date(activeYear.startDate)
                                const endDate = new Date(activeYear.endDate)
                                const startYr = startDate.getFullYear()
                                const endYr = endDate.getFullYear()
                                const startMo = startDate.getMonth() + 1
                                const endMo = endDate.getMonth() + 1
                                // Build list of valid months for the selected year
                                const validMonths = []
                                for (let m = 1; m <= 12; m++) {
                                    const afterStart = (year > startYr) || (year === startYr && m >= startMo)
                                    const beforeEnd = (year < endYr) || (year === endYr && m <= endMo)
                                    if (afterStart && beforeEnd) validMonths.push(m)
                                }
                                return validMonths.map(m => (
                                    <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('default', { month: 'long' })}</option>
                                ))
                            })()}
                        </select>
                    </div>

                    {viewMode === 'status' ? (
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col">
                                <label className="text-[10px] font-black uppercase text-emerald-600 mb-1 ml-1 tracking-widest">Use Method:</label>
                                <select
                                    className="bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl px-4 py-2 font-bold outline-none text-xs"
                                    value={bulkMethod}
                                    onChange={e => setBulkMethod(e.target.value)}
                                >
                                    <option value="Cash">Cash</option>
                                    <option value="Sahal (Golis)">Sahal (Golis)</option>
                                    <option value="E-Dahab (Somtel)">E-Dahab (Somtel)</option>
                                </select>
                            </div>
                            {Object.keys(localStatuses).length > 0 ? (
                                <button
                                    onClick={saveBulkChanges}
                                    disabled={saving}
                                    className={`flex items-center gap-2 text-white px-8 py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl shadow-emerald-200 animate-in fade-in zoom-in mt-4 ${
                                        saving ? 'bg-emerald-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'
                                    }`}
                                >
                                    {saving ? (
                                        <>
                                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            Saving...
                                        </>
                                    ) : (
                                        <>💾 Save Changes ({Object.keys(localStatuses).length})</>
                                    )}
                                </button>
                            ) : (
                                <div className="px-8 py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest text-gray-300 border border-gray-100 select-none bg-gray-50 mt-4">
                                    No Changes
                                </div>
                            )}
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowModal(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all"
                        >
                            + Record
                        </button>
                    )}
                    {(userRole === 'admin' || userRole === 'owner' || (userRole === 'accountant' && canEditFees)) && viewMode === 'status' && (
                        <button
                            onClick={() => setShowSettings(true)}
                            className="bg-slate-900 text-white p-3.5 rounded-2xl hover:bg-black transition-all mt-4"
                            title="Fee Settings"
                        >
                            ⚙️
                        </button>
                    )}
                </div>
            </div>

            <div className="flex gap-4 mb-8">
                <button onClick={() => setViewMode('status')} className={`px-8 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${viewMode === 'status' ? 'bg-slate-900 text-white shadow-xl shadow-slate-200' : 'bg-white text-slate-400 border border-gray-100'}`}>Monthly Status</button>
                <button onClick={() => setViewMode('history')} className={`px-8 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${viewMode === 'history' ? 'bg-slate-900 text-white shadow-xl shadow-slate-200' : 'bg-white text-slate-400 border border-gray-100'}`}>History</button>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-50 overflow-hidden relative">
                <div className="overflow-x-auto w-full">
                    <table className="w-full text-left min-w-max">
                    <thead>
                        <tr className="bg-slate-50/50 text-slate-400 text-[10px] uppercase font-black tracking-[0.2em]">
                            <th className="px-8 py-6">{t('students')}</th>
                            {viewMode === 'status' ? (
                                <th className="px-8 py-6 text-center">Payment Status</th>
                            ) : (
                                <>
                                    <th className="px-8 py-6">{t('amount')}</th>
                                    <th className="px-8 py-6">{t('date')}</th>
                                    <th className="px-8 py-6">Method / Details</th>
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {loading ? (
                            <tr><td colSpan="5" className="text-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div></td></tr>
                        ) : viewMode === 'status' ? (
                            monthlyStatus.map(s => {
                                const status = localStatuses[s.studentId] || s.status;
                                return (
                                    <tr key={s.studentId} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className="px-8 py-6">
                                            <div className="font-black text-slate-800 text-lg group-hover:text-blue-600 transition-colors uppercase">{s.name}</div>
                                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{s.student_id}</div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex justify-center">
                                                <button
                                                    onClick={() => toggleStatus(s.studentId, s.status)}
                                                    className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${status === 'paid' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'bg-rose-100 text-rose-600'}`}
                                                >
                                                    {status === 'paid' ? 'Bixiyay (Paid)' : 'Ma Bixin (Unpaid)'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })
                        ) : (
                            students.length > 0 ? students.map(s => {
                                const payment = payments.find(p => p.studentId === s.id);
                                return (
                                    <tr key={s.id} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className="px-8 py-6">
                                            <div className="font-black text-slate-800 text-lg group-hover:text-blue-600 transition-colors uppercase">{s.user?.name || s.name}</div>
                                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{s.student_id}</div>
                                        </td>
                                        <td className="px-8 py-6">
                                            {payment ? (
                                                <span className="font-black text-slate-900 text-xl">${payment.amount.toLocaleString()}</span>
                                            ) : (
                                                <span className="text-rose-600 font-black text-sm uppercase tracking-widest">Unpaid</span>
                                            )}
                                        </td>
                                        <td className="px-8 py-6 text-sm text-gray-500 font-medium">
                                            {payment ? new Date(payment.date).toLocaleDateString() : '—'}
                                        </td>
                                        <td className="px-8 py-6">
                                            {payment ? (
                                                <div className="flex flex-col gap-1">
                                                    <span className="bg-emerald-50 text-emerald-600 text-[10px] font-black px-4 py-2 rounded-xl uppercase tracking-widest border border-emerald-100 w-fit">{payment.payment_method}</span>
                                                    {payment.transactionId && <span className="text-[10px] text-slate-500 font-bold ml-1">ID: {payment.transactionId}</span>}
                                                    {payment.phoneNumber && <span className="text-[10px] text-slate-500 font-bold ml-1">Tel: {payment.phoneNumber}</span>}
                                                </div>
                                            ) : (
                                                <span className="bg-rose-50 text-rose-500 text-[10px] font-black px-4 py-2 rounded-xl uppercase tracking-widest border border-rose-100 w-fit">Pending</span>
                                            )}
                                        </td>
                                    </tr>
                                )
                            }) : (
                                <tr><td colSpan="5" className="px-8 py-20 text-center text-gray-400 font-medium uppercase text-[10px] tracking-widest">No students found in this class.</td></tr>
                            )
                        )}
                    </tbody>
                </table>
</div>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
                            <h3 className="text-xl font-bold">Record Payment</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Select Student</label>
                                <select required className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 outline-none appearance-none bg-white" value={formData.studentId} onChange={e => setFormData({ ...formData, studentId: e.target.value })}>
                                    <option value="">Search student...</option>
                                    {students.map(s => <option key={s.id} value={s.id}>{s.user.name} ({s.student_id})</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Amount ($)</label>
                                <input required type="number" className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="0.00" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Month (Optional)</label>
                                    <select className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 outline-none appearance-none bg-white font-bold" value={formData.month} onChange={e => setFormData({ ...formData, month: e.target.value })}>
                                        <option value="">N/A</option>
                                        {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Year (Optional)</label>
                                    <select className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 outline-none appearance-none bg-white font-bold" value={formData.year} onChange={e => setFormData({ ...formData, year: e.target.value })}>
                                        <option value="">N/A</option>
                                        {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Description</label>
                                <input
                                    type="text"
                                    className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 outline-none"
                                    placeholder="e.g. Tuition Fee, Bus Fee, etc."
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Payment Method</label>
                                <select className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 outline-none appearance-none bg-white font-bold" value={formData.payment_method} onChange={e => setFormData({ ...formData, payment_method: e.target.value })}>
                                    <option value="Cash">Cash</option>
                                    <option value="Sahal (Golis)">Sahal (Golis)</option>
                                    <option value="E-Dahab (Somtel)">E-Dahab (Somtel)</option>
                                    <option value="Bank Transfer">Bank Transfer</option>
                                    <option value="Online">Online / Card</option>
                                </select>
                            </div>
                            {(formData.payment_method === 'Sahal (Golis)' || formData.payment_method === 'E-Dahab (Somtel)') && (
                                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Transaction ID</label>
                                        <input
                                            required
                                            type="text"
                                            className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 outline-none"
                                            placeholder="TRX-123..."
                                            value={formData.transactionId}
                                            onChange={e => setFormData({ ...formData, transactionId: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Phone Number</label>
                                        <input
                                            required
                                            type="text"
                                            className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 outline-none"
                                            placeholder="061..."
                                            value={formData.phoneNumber}
                                            onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })}
                                        />
                                    </div>
                                </div>
                            )}
                            <div className="pt-4 flex gap-3">
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className={`flex-1 ${submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'} text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-100 transition-all`}
                                >
                                    {submitting ? (
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            Recording...
                                        </div>
                                    ) : 'Submit Payment'}
                                </button>
                                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 rounded-xl border-2 border-gray-100 font-bold text-gray-400">Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showSettings && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-2xl font-black uppercase tracking-tight">Fee Settings</h3>
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Set monthly tuition fee per class</p>
                            </div>
                            <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white text-2xl font-black">✕</button>
                        </div>
                        <div className="p-8 max-h-[60vh] overflow-y-auto">
                            <div className="grid grid-cols-1 gap-4">
                                {classes.map(c => {
                                    const fee = feeStructures.find(f => f.classId === c.id && f.name === 'Tuition Fee');
                                    return (
                                        <div key={c.id} className="flex items-center justify-between p-6 rounded-3xl bg-slate-50 border border-slate-100 group hover:bg-white hover:shadow-md transition-all">
                                            <div>
                                                <p className="font-black text-slate-800 text-lg uppercase">{c.class_name}</p>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Monthly Amount</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                                    <input
                                                        type="number"
                                                        defaultValue={fee?.amount || ''}
                                                        onBlur={(e) => updateFeeStructure(c.id, e.target.value)}
                                                        className="w-32 bg-white border border-slate-200 rounded-2xl py-3 pl-8 pr-4 font-black text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                                {settingLoading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-50 flex justify-end bg-gray-50/50">
                            <button onClick={() => setShowSettings(false)} className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-black transition-all">Done Settings</button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    )
}
