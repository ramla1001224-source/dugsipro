import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import axios from 'axios'
import { exportToExcel, exportToPDF } from '../../utils/reportUtils'

export default function AccountantPayments() {
    const [viewMode, setViewMode] = useState('status') // 'status' or 'history'
    const [classes, setClasses] = useState([])
    const [selectedClass, setSelectedClass] = useState('')
    const [sections, setSections] = useState([])
    const [selectedSection, setSelectedSection] = useState('')
    const [month, setMonth] = useState(new Date().getMonth() + 1)
    const [year, setYear] = useState(new Date().getFullYear())
    const [canDelete, setCanDelete] = useState(true)
    const [statusFilter, setStatusFilter] = useState('')
    const router = useRouter()

    const [payments, setPayments] = useState([])
    const [students, setStudents] = useState([])
    const [monthlyStatus, setMonthlyStatus] = useState([])
    const [loading, setLoading] = useState(false)
    const [showModal, setShowModal] = useState(false)
    const [formData, setFormData] = useState({ studentId: '', amount: '', payment_method: 'Cash', transactionId: '', phoneNumber: '', description: '', month: '', year: '' })
    const [bulkMethod, setBulkMethod] = useState('Cash')
    const [localStatuses, setLocalStatuses] = useState({})
    const [partialAmounts, setPartialAmounts] = useState({}) // { studentId: amount }
    const [saving, setSaving] = useState(false)

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    useEffect(() => {
        const fetchInitial = async () => {
            try {
                const res = await axios.get(`${apiUrl}/api/classes`, { headers: headers() })
                setClasses(res.data)
                if (res.data.length > 0) setSelectedClass(res.data[0].id)

                // Fetch permission setting
                const setRes = await axios.get(`${apiUrl}/api/settings/perm_acc_delete_payment`, { headers: headers() })
                setCanDelete(setRes.data.value === 'true')
            } catch (err) { 
                console.error('Initial fetch error:', err)
                if (err.response?.status === 404) setCanDelete(false)
            }
        }
        fetchInitial()
    }, [])

    useEffect(() => {
        if (router.query.status) {
            setStatusFilter(router.query.status)
        }
    }, [router.query])

    useEffect(() => {
        if (selectedClass) {
            axios.get(`${apiUrl}/api/sections?classId=${selectedClass}`, { headers: headers() })
                .then(res => {
                    setSections(res.data)
                    if (res.data.length > 0) setSelectedSection(res.data[0].id)
                    else setSelectedSection('')
                })
                .catch(err => console.error(err))
        } else {
            setSections([])
            setSelectedSection('')
        }
    }, [selectedClass])

    const fetchData = async () => {
        if (!selectedClass) return
        setLoading(true)
        try {
            const sectionParam = selectedSection ? `&sectionId=${selectedSection}` : ''
            const shiftParam = router.query.shift ? `&shift=${router.query.shift}` : ''
            if (viewMode === 'status') {
                const res = await axios.get(`${apiUrl}/api/payments/monthly-status?classId=${selectedClass}${sectionParam}${shiftParam}&month=${month}&year=${year}`, { headers: headers() })
                setMonthlyStatus(res.data)
            } else {
                const [payRes, studRes] = await Promise.all([
                    axios.get(`${apiUrl}/api/payments?classId=${selectedClass}${sectionParam}`, { headers: headers() }),
                    axios.get(`${apiUrl}/api/students?classId=${selectedClass}${sectionParam}`, { headers: headers() })
                ])
                setPayments(payRes.data)
                setStudents(studRes.data)
            }
        } catch (e) { console.error(e) }
        finally { setLoading(false) }
    }

    useEffect(() => { fetchData() }, [selectedClass, selectedSection, viewMode, month, year])

    const toggleStatus = (studentId, currentStatus, classFee) => {
        const effectiveStatus = localStatuses[studentId] || currentStatus
        
        // If trying to unpay (delete) or modify a paid/partial, check permission
        if ((effectiveStatus === 'paid' || effectiveStatus === 'partial') && !canDelete) {
            alert('Fasax uma lihid inaad beddesho ama tirtirto lacag bixinta. Fadlan la xiriir Admin-ka.')
            return
        }

        let newStatus;
        if (effectiveStatus === 'unpaid') newStatus = 'paid'
        else if (effectiveStatus === 'paid') newStatus = 'partial'
        else newStatus = 'unpaid'
        
        setLocalStatuses(prev => ({ ...prev, [studentId]: newStatus }))
        if (newStatus === 'partial') {
            setPartialAmounts(prev => ({ ...prev, [studentId]: prev[studentId] || '' }))
        }
    }

    const saveBulkChanges = async () => {
        if (saving) return
        setSaving(true)
        try {
            const updates = Object.entries(localStatuses).map(([studentId, status]) => ({
                studentId,
                status,
                amountPaid: status === 'partial' ? Number(partialAmounts[studentId] || 0) : undefined
            }))
            if (updates.length === 0) { setSaving(false); return }
            
            // Validate partial amounts
            for (const u of updates) {
                if (u.status === 'partial' && (!u.amountPaid || u.amountPaid <= 0)) {
                    alert('Fadlan gali lacagta qayb-bixinta ardayga ' + u.studentId)
                    setSaving(false)
                    return
                }
            }

            await axios.post(`${apiUrl}/api/payments/bulk`, { updates, month, year, payment_method: bulkMethod }, { headers: headers() })
            setLocalStatuses({})
            setPartialAmounts({})
            fetchData()
            alert('Payments synced successfully!')
        } catch (e) { console.error(e); alert('Error saving changes') }
        finally { setSaving(false) }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            await axios.post(`${apiUrl}/api/payments/create`, formData, { headers: headers() })
            setShowModal(false)
            setFormData({ studentId: '', amount: '', payment_method: 'Cash', transactionId: '', phoneNumber: '', description: '', month: '', year: '' })
            fetchData()
        } catch (e) { alert(e.response?.data?.message || 'Error recording payment') }
    }

    const monthsSomaali = ["Janaayo", "Febraayo", "Maarso", "Abriil", "Maajo", "Juun", "Luulyo", "Agoosto", "Sebteembar", "Oktoobar", "Noofeembar", "Diseembar"]

    const handleExportExcel = () => {
        let data = []
        if (viewMode === 'status') {
            data = monthlyStatus.map(s => {
                const status = localStatuses[s.studentId] || s.status
                const classFee = s.classFee || 0
                let amountPaid = s.amountPaid || 0
                if (status === 'paid') amountPaid = classFee
                const remaining = Math.max(0, classFee - amountPaid)
                return {
                    'Magaca Ardayga': s.name,
                    'ID': s.student_id,
                    'Xaalad': status === 'paid' ? 'Paid' : status === 'partial' ? 'Partial' : 'Unpaid',
                    'Bixiyay': `$${amountPaid.toFixed(2)}`,
                    'Fee-ga': `$${classFee.toFixed(2)}`,
                    'Hadhay': `$${remaining.toFixed(2)}`
                }
            })
        } else {
            data = students.map(s => {
                const p = payments.find(pay => pay.studentId === s.id)
                return {
                    'Magaca Ardayga': s.user?.name || s.name,
                    'ID': s.student_id,
                    'Lacag': p ? `$${p.amount}` : 'Unpaid',
                    'Taariikhda': p ? new Date(p.date).toLocaleDateString() : '—',
                    'Habka': p ? p.payment_method : 'Pending',
                    'Transaction ID': p?.transactionId || '-'
                }
            })
        }
        exportToExcel(data, `Payments_${viewMode}_Report`)
    }

    const handleExportPDF = async () => {
        if (viewMode === 'status') {
            const info = typeof window !== 'undefined' ? localStorage.getItem('schoolInfo') : ''
            const schoolQuery = info ? `&schoolId=${JSON.parse(info).id}` : ''
            const url = `${apiUrl}/api/payments/monthly-status/pdf?classId=${selectedClass}${selectedSection ? `&sectionId=${selectedSection}` : ''}&month=${month}&year=${year}${schoolQuery}`
            const token = localStorage.getItem('token')
            try {
                const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' })
                const blob = new Blob([res.data], { type: 'application/pdf' })
                const link = document.createElement('a')
                link.href = URL.createObjectURL(blob)
                const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']
                link.download = `Fee_Report_${monthNames[month - 1]}_${year}.pdf`
                link.click()
                URL.revokeObjectURL(link.href)
            } catch (err) {
                alert('PDF download khalad ah: ' + (err.response?.data?.message || err.message))
            }
            return
        }
        const pdfHeaders = ['Magaca', 'ID', 'Lacag', 'Taariikhda', 'Habka']
        const data = students.map(s => {
            const p = payments.find(pay => pay.studentId === s.id)
            return [s.user?.name || s.name, s.student_id, p ? `$${p.amount}` : 'Unpaid', p ? new Date(p.date).toLocaleDateString() : '—', p ? p.payment_method : 'Pending']
        })
        exportToPDF(pdfHeaders, data, `Payments_history_Report`, 'Payments', null)
    }

    return (
        <Layout title="Payments">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight uppercase">Payments</h2>
                    <p className="text-gray-400 font-medium tracking-wide">Sahal, E-Dahab & Cash Management</p>
                </div>

                <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
                    <button
                        onClick={handleExportPDF}
                        className="bg-red-50 text-red-600 px-5 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-red-100 transition-all"
                    >
                        📄 Dagso PDF ahaan
                    </button>
                    <button
                        onClick={handleExportExcel}
                        className="bg-emerald-50 text-emerald-600 px-5 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-100 transition-all"
                    >
                        📊 Dagso Excel ahaan
                    </button>
                    <div className="flex flex-col">
                        <label className="text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">Class</label>
                        <select className="bg-gray-50 border-none rounded-xl px-4 py-2 font-bold text-slate-700 outline-none w-32" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
                            {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                        </select>
                    </div>
                    {sections.length > 0 && (
                        <div className="flex flex-col">
                            <label className="text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">Section</label>
                            <select className="bg-gray-50 border-none rounded-xl px-4 py-2 font-bold text-slate-700 outline-none w-32" value={selectedSection} onChange={e => setSelectedSection(e.target.value)}>
                                <option value="">All</option>
                                {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                    )}
                    {viewMode === 'status' && (
                        <>
                            <div className="flex flex-col text-center">
                                <label className="text-[10px] font-black uppercase text-gray-400 mb-1 tracking-widest">Month</label>
                                <select className="bg-gray-50 border-none rounded-xl px-4 py-2 font-bold text-slate-700 outline-none" value={month} onChange={e => setMonth(parseInt(e.target.value))}>
                                    {monthsSomaali.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-col">
                                <label className="text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">Year</label>
                                <select className="bg-gray-50 border-none rounded-xl px-4 py-2 font-bold text-slate-700 outline-none" value={year} onChange={e => setYear(parseInt(e.target.value))}>
                                    {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                        </>
                    )}
                    {viewMode === 'status' ? (
                        <div className="flex items-center gap-3 ml-2">
                            <div className="flex flex-col">
                                <label className="text-[10px] font-black uppercase text-gray-400 mb-1 tracking-widest">Filter</label>
                                <select className="bg-gray-50 border-none rounded-xl px-4 py-2 font-bold text-slate-700 outline-none" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                                    <option value="">All Students</option>
                                    <option value="paid">Paid Only</option>
                                    <option value="unpaid">Unpaid Only</option>
                                </select>
                            </div>
                            <div className="flex flex-col">
                                <label className="text-[10px] font-black uppercase text-emerald-600 mb-1 ml-1 tracking-widest">Use Method:</label>
                                <select className="bg-emerald-50 text-emerald-700 border-none rounded-xl px-4 py-2 font-bold outline-none" value={bulkMethod} onChange={e => setBulkMethod(e.target.value)}>
                                    <option value="Cash">Cash</option>
                                    <option value="Sahal (Golis)">Sahal (Golis)</option>
                                    <option value="E-Dahab (Somtel)">E-Dahab (Somtel)</option>
                                </select>
                            </div>
                            {Object.keys(localStatuses).length > 0 && (
                                <button
                                    onClick={saveBulkChanges}
                                    disabled={saving}
                                    className={`flex items-center gap-2 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg shadow-emerald-100 mt-4 ${
                                        saving ? 'bg-emerald-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'
                                    }`}
                                >
                                    {saving ? (
                                        <>
                                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            Saving...
                                        </>
                                    ) : (
                                        <>💾 Save Changes ({Object.keys(localStatuses).length})</>
                                    )}
                                </button>
                            )}
                        </div>
                    ) : (
                        <button onClick={() => setShowModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all mt-4 lg:mt-0">+ Record Paid</button>
                    )}
                </div>
            </div>

            <div className="flex gap-3 mb-8">
                <button onClick={() => setViewMode('status')} className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'status' ? 'bg-slate-900 text-white' : 'bg-white text-gray-400 border border-gray-100'}`}>Monthly View</button>
                <button onClick={() => setViewMode('history')} className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'history' ? 'bg-slate-900 text-white' : 'bg-white text-gray-400 border border-gray-100'}`}>Detailed History</button>
            </div>

            <div className="bg-white rounded-[2rem] shadow-sm border border-gray-50 overflow-hidden relative">
                <div className="overflow-x-auto w-full">
<table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-50/50 text-slate-400 text-[10px] uppercase font-black tracking-[0.2em]">
                            <th className="px-8 py-6">Student</th>
                            {viewMode === 'status' ? (
                                <>
                                    <th className="px-8 py-6 text-center">Lacagta / Fee-ga</th>
                                    <th className="px-8 py-6 text-center">Payment Status</th>
                                </>
                            ) : (
                                <>
                                    <th className="px-8 py-6 text-center">Amount</th>
                                    <th className="px-8 py-6 text-center">Date</th>
                                    <th className="px-8 py-6 text-right">Details</th>
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-slate-700">
                        {loading ? (
                            <tr><td colSpan="5" className="text-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div></td></tr>
                        ) : viewMode === 'status' ? (
                            monthlyStatus
                                .filter(s => !statusFilter || (localStatuses[s.studentId] || s.status) === statusFilter)
                                .map(s => {
                                    const st = localStatuses[s.studentId] || s.status;
                                    const classFee = s.classFee || 0;
                                    return (
                                        <tr key={s.studentId} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="px-8 py-5">
                                                <div className="font-black text-slate-800 text-lg group-hover:text-blue-600 transition-colors uppercase">{s.name}</div>
                                                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{s.student_id}</div>
                                            </td>
                                            {/* Lacagta column */}
                                            <td className="px-8 py-5">
                                                <div className="flex flex-col items-center gap-1">
                                                    {st === 'partial' ? (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-amber-600 font-bold text-xs">$</span>
                                                            <input
                                                                type="number"
                                                                min="0.01"
                                                                max={classFee || undefined}
                                                                step="0.01"
                                                                className="w-24 border border-amber-300 rounded-xl px-3 py-1.5 text-sm font-bold text-amber-700 focus:ring-2 focus:ring-amber-400 outline-none bg-amber-50"
                                                                placeholder="0.00"
                                                                value={partialAmounts[s.studentId] !== undefined ? partialAmounts[s.studentId] : (s.amountPaid || '')}
                                                                onChange={e => {
                                                                    const val = e.target.value
                                                                    if (classFee > 0 && Number(val) > classFee) return
                                                                    setPartialAmounts(prev => ({ ...prev, [s.studentId]: val }))
                                                                }}
                                                            />
                                                            {classFee > 0 && <span className="text-gray-400 text-xs font-bold">/ ${classFee}</span>}
                                                        </div>
                                                    ) : (
                                                        <div className="text-center">
                                                            {st === 'paid' && classFee > 0 && (
                                                                <span className="text-emerald-600 font-black text-sm">${classFee}</span>
                                                            )}
                                                            {st === 'unpaid' && classFee > 0 && (
                                                                <span className="text-slate-400 font-bold text-xs">${classFee} <span className="text-rose-400">hadhay</span></span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            {/* Status button */}
                                            <td className="px-8 py-5 text-center">
                                                <button onClick={() => toggleStatus(s.studentId, s.status, classFee)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                                    st === 'paid' 
                                                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100' 
                                                        : st === 'partial'
                                                            ? 'bg-amber-50 text-amber-600 border border-amber-100 hover:bg-amber-100'
                                                            : 'bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100'
                                                }`}>
                                                    {st === 'paid' ? '✅ Paid' : st === 'partial' ? '🟡 Partial' : '❌ Unpaid'}
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })
                        ) : (
                            payments.map(p => (
                                <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-8 py-6 font-black uppercase text-slate-800">{p.student?.user?.name}</td>
                                    <td className="px-8 py-6 text-center font-black text-slate-900">${p.amount}</td>
                                    <td className="px-8 py-6 text-center text-sm font-medium text-gray-400">{new Date(p.date).toLocaleDateString()}</td>
                                    <td className="px-8 py-6">
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="bg-blue-50 text-blue-600 text-[10px] font-black px-3 py-1.5 rounded-lg border border-blue-100 uppercase">{p.payment_method}</span>
                                            {p.transactionId && <span className="text-[9px] font-bold text-gray-400 tracking-tighter uppercase whitespace-nowrap">ID: {p.transactionId}</span>}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                        {!loading && ((viewMode === 'status' && monthlyStatus.length === 0) || (viewMode === 'history' && payments.length === 0)) && (
                            <tr><td colSpan="5" className="text-center py-20 text-gray-400 font-medium tracking-wide italic uppercase text-xs">No records found</td></tr>
                        )}
                    </tbody>
                </table>
</div>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
                            <h3 className="text-xl font-black uppercase tracking-tight">Record Payment</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-xl">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-5">
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Select Student</label>
                                <select required className="w-full p-4 rounded-2xl border-none bg-gray-50 font-bold focus:ring-2 focus:ring-blue-500 outline-none" value={formData.studentId} onChange={e => setFormData({ ...formData, studentId: e.target.value })}>
                                    <option value="">Search student...</option>
                                    {students.map(s => <option key={s.id} value={s.id}>{s.user.name} ({s.student_id})</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Amount ($)</label>
                                <input required type="number" className="w-full p-4 rounded-2xl border-none bg-gray-50 font-black focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0.00" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-center">
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block uppercase">Month</label>
                                    <select className="w-full p-4 rounded-2xl border-none bg-gray-50 font-bold outline-none" value={formData.month} onChange={e => setFormData({ ...formData, month: e.target.value })}>
                                        <option value="">N/A</option>
                                        {monthsSomaali.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Year</label>
                                    <select className="w-full p-4 rounded-2xl border-none bg-gray-50 font-bold outline-none" value={formData.year} onChange={e => setFormData({ ...formData, year: e.target.value })}>
                                        <option value="">N/A</option>
                                        {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Payment Method</label>
                                <select className="w-full p-4 rounded-2xl border-none bg-gray-50 font-bold outline-none" value={formData.payment_method} onChange={e => setFormData({ ...formData, payment_method: e.target.value })}>
                                    <option value="Cash">Cash</option>
                                    <option value="Sahal (Golis)">Sahal (Golis)</option>
                                    <option value="E-Dahab (Somtel)">E-Dahab (Somtel)</option>
                                    <option value="Bank Transfer">Bank Transfer</option>
                                </select>
                            </div>
                            {(formData.payment_method === 'Sahal (Golis)' || formData.payment_method === 'E-Dahab (Somtel)') && (
                                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <input required type="text" className="p-4 rounded-2xl border-none bg-gray-50 font-bold outline-none placeholder:text-gray-300" placeholder="Transaction ID" value={formData.transactionId} onChange={e => setFormData({ ...formData, transactionId: e.target.value })} />
                                    <input required type="text" className="p-4 rounded-2xl border-none bg-gray-50 font-bold outline-none placeholder:text-gray-300" placeholder="Phone Number" value={formData.phoneNumber} onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })} />
                                </div>
                            )}
                            <button type="submit" className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl shadow-xl shadow-slate-100 hover:bg-black uppercase text-xs tracking-[0.2em] transition-all">Submit Payment</button>
                        </form>
                    </div>
                </div>
            )}
        </Layout>
    )
}
