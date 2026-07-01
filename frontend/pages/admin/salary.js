import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'

export default function AdminSalary() {
    const [records, setRecords] = useState([])
    const [teachers, setTeachers] = useState([])
    const [staff, setStaff] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [loading, setLoading] = useState(false)
    const [month, setMonth] = useState(new Date().getMonth() + 1)
    const [year, setYear] = useState(new Date().getFullYear())
    const [formData, setFormData] = useState({ teacherId: '', staffId: '', month: '', baseSalary: '', deductions: 0, bonus: 0 })
    const [userRole, setUserRole] = useState('')
    const [canViewSalary, setCanViewSalary] = useState(true)

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    const selectedPeriod = `${year}-${month.toString().padStart(2, '0')}`

    const [selectedEmployee, setSelectedEmployee] = useState('') // teacher:ID or staff:ID

    const fetchAll = async () => {
        setLoading(true)
        try {
            let employeeQuery = ''
            if (selectedEmployee) {
                const [type, id] = selectedEmployee.split(':')
                employeeQuery = type === 'teacher' ? `&teacherId=${id}` : `&staffId=${id}`
            }

            const [r, t, s] = await Promise.all([
                axios.get(`${apiUrl}/api/salary?month=${selectedPeriod}${employeeQuery}`, { headers: headers() }),
                axios.get(`${apiUrl}/api/teachers`, { headers: headers() }),
                axios.get(`${apiUrl}/api/staff`, { headers: headers() })
            ])
            setRecords(r.data)
            setTeachers(t.data)
            setStaff(s.data)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        const role = typeof window !== 'undefined' ? localStorage.getItem('role') : '' || ''
        setUserRole(role)

        if (role === 'accountant') {
            axios.get(`${apiUrl}/api/settings/perm_acc_view_salary`, { headers: headers() })
                .then(res => {
                    const permitted = res.data.value === 'true'
                    setCanViewSalary(permitted)
                    if (!permitted) {
                        alert('Fasax uma lihid inaad aragto payroll-ka.')
                        window.location.href = '/accountant/dashboard'
                    }
                })
                .catch(() => {
                    setCanViewSalary(false)
                    window.location.href = '/accountant/dashboard'
                })
        } else if (role !== 'admin' && role !== 'owner' && role !== 'super_admin') {
            window.location.href = '/'
        }
    }, [])

    useEffect(() => { 
        if (canViewSalary) fetchAll() 
    }, [month, year, selectedEmployee, canViewSalary])

    const handleGenerate = async () => {
        setLoading(true)
        try {
            const res = await axios.post(`${apiUrl}/api/salary/generate`, { month: selectedPeriod }, { headers: headers() })
            alert(res.data.message)
            fetchAll()
        } catch (e) {
            alert(e.response?.data?.message || 'Error generating salaries')
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            await axios.post(`${apiUrl}/api/salary`, { ...formData, month: selectedPeriod }, { headers: headers() })
            setShowModal(false)
            setFormData({ teacherId: '', staffId: '', month: '', baseSalary: '', deductions: 0, bonus: 0 })
            fetchAll()
        } catch (e) { alert(e.response?.data?.message || 'Error') }
    }

    const markPaid = async (id) => {
        try {
            await axios.patch(`${apiUrl}/api/salary/${id}/pay`, {}, { headers: headers() })
            fetchAll()
        } catch (e) { alert('Error') }
    }

    const employees = [
        ...teachers.map(t => ({ id: t.id, type: 'teacher', name: t.user?.name, salary: t.salary })),
        ...staff.map(s => ({ id: s.id, type: 'staff', name: s.user?.name, salary: s.salary || 0 }))
    ]

    const totalPending = records.filter(r => r.status === 'pending').reduce((s, r) => s + r.netSalary, 0)
    const totalPaid = records.filter(r => r.status === 'paid').reduce((s, r) => s + r.netSalary, 0)

    return (
        <Layout title="Payroll">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">Salary & Payroll</h2>
                    <p className="text-gray-400 font-medium tracking-wide">Manage and review historical payroll records</p>
                </div>

                <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
                    <div className="flex flex-col">
                        <label className="text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">Month</label>
                        <select className="bg-gray-50 border-none rounded-2xl px-5 py-3 font-bold text-slate-700 outline-none" value={month} onChange={e => setMonth(parseInt(e.target.value))}>
                            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>)}
                        </select>
                    </div>
                    <div className="flex flex-col">
                        <label className="text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">Year</label>
                        <select className="bg-gray-50 border-none rounded-2xl px-5 py-3 font-bold text-slate-700 outline-none" value={year} onChange={e => setYear(parseInt(e.target.value))}>
                            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>

                    <div className="flex flex-col">
                        <label className="text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">Employee</label>
                        <select className="bg-gray-50 border-none rounded-2xl px-5 py-3 font-bold text-blue-600 outline-none" value={selectedEmployee} onChange={e => setSelectedEmployee(e.target.value)}>
                            <option value="">All Employees</option>
                            {employees.map(e => <option key={`${e.type}:${e.id}`} value={`${e.type}:${e.id}`}>{e.name} ({e.type})</option>)}
                        </select>
                    </div>

                    <div className="h-10 w-[1px] bg-gray-100 mx-2 hidden lg:block"></div>

                    <button
                        onClick={handleGenerate}
                        disabled={loading}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl shadow-emerald-100"
                    >
                        🚀 {loading ? 'Processing...' : 'Generate All'}
                    </button>

                    <button
                        onClick={() => setShowModal(true)}
                        className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all"
                    >
                        + Custom
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
                    <p className="text-gray-400 text-xs font-black uppercase tracking-widest mb-3">Total Records</p>
                    <p className="text-4xl font-black text-slate-800">{records.length}</p>
                </div>
                <div className="bg-amber-50 p-8 rounded-[2.5rem] border border-amber-100">
                    <p className="text-amber-600 text-xs font-black uppercase tracking-widest mb-3">Pending Payroll</p>
                    <p className="text-4xl font-black text-amber-700">${totalPending.toLocaleString()}</p>
                </div>
                <div className="bg-emerald-50 p-8 rounded-[2.5rem] border border-emerald-100">
                    <p className="text-emerald-600 text-xs font-black uppercase tracking-widest mb-3">Released Salary</p>
                    <p className="text-4xl font-black text-emerald-700">${totalPaid.toLocaleString()}</p>
                </div>
            </div>

            <div className={`bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden transition-opacity ${loading ? 'opacity-50' : 'opacity-100'}`}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50 text-gray-400 text-[10px] uppercase font-black tracking-widest">
                                <th className="px-8 py-6">Staff Member</th>
                                <th className="px-8 py-6">Month</th>
                                <th className="px-8 py-6">Base Salary</th>
                                <th className="px-8 py-6">Deductions</th>
                                <th className="px-8 py-6">Bonus</th>
                                <th className="px-8 py-6">Net Salary</th>
                                <th className="px-8 py-6">Status</th>
                                <th className="px-8 py-6 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {records.map(r => (
                                <tr key={r.id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-400 text-sm">
                                                {(r.teacher?.user?.name || r.staff?.user?.name)?.[0]}
                                            </div>
                                            <div>
                                                <span className="font-bold text-slate-800 block">{r.teacher?.user?.name || r.staff?.user?.name}</span>
                                                <span className="text-[9px] font-black uppercase text-gray-400 tracking-tighter">
                                                    {r.teacher ? 'Teacher' : (r.staff?.position || 'Staff')}
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-xs font-bold text-gray-500">{r.month}</td>
                                    <td className="px-8 py-6 font-bold text-slate-600">${r.baseSalary?.toLocaleString()}</td>
                                    <td className="px-8 py-6 font-bold text-red-500">-${r.deductions?.toLocaleString()}</td>
                                    <td className="px-8 py-6 font-bold text-emerald-500">+${r.bonus?.toLocaleString()}</td>
                                    <td className="px-8 py-6">
                                        <span className="text-lg font-black text-slate-900">${r.netSalary?.toLocaleString()}</span>
                                    </td>
                                    <td className="px-8 py-6">
                                        <span className={`text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest ${r.status === 'paid' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                            {r.status}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        {r.status === 'pending' && (
                                            <button
                                                onClick={() => markPaid(r.id)}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-widest px-4 py-2 rounded-xl transition-all shadow-lg shadow-emerald-100"
                                            >
                                                Pay
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-black tracking-tight">Process Custom Salary</h3>
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Manual adjustment</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all font-bold">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">Staff Member</label>
                                <select required className="w-full p-4 rounded-2xl border border-gray-100 bg-gray-50 font-bold text-slate-700 outline-none focus:ring-2 ring-emerald-500/20" value={formData.teacherId || formData.staffId} onChange={e => {
                                    const val = e.target.value
                                    const emp = employees.find(x => x.id === val)
                                    if (emp.type === 'teacher') {
                                        setFormData({ ...formData, teacherId: val, staffId: '', baseSalary: emp.salary || 0 })
                                    } else {
                                        setFormData({ ...formData, staffId: val, teacherId: '', baseSalary: emp.salary || 0 })
                                    }
                                }}>
                                    <option value="">Select Employee</option>
                                    {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.type})</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">Base ($)</label>
                                    <input required type="number" className="w-full p-4 rounded-2xl border border-gray-100 bg-gray-50 font-bold text-slate-700 outline-none" value={formData.baseSalary} onChange={e => setFormData({ ...formData, baseSalary: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">Deductions</label>
                                    <input type="number" className="w-full p-4 rounded-2xl border border-gray-100 bg-gray-50 font-bold text-slate-700 outline-none" value={formData.deductions} onChange={e => setFormData({ ...formData, deductions: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">Bonus</label>
                                    <input type="number" className="w-full p-4 rounded-2xl border border-gray-100 bg-gray-50 font-bold text-slate-700 outline-none" value={formData.bonus} onChange={e => setFormData({ ...formData, bonus: e.target.value })} />
                                </div>
                            </div>

                            <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-black text-emerald-600 uppercase tracking-widest">Net Payable</span>
                                    <span className="text-2xl font-black text-emerald-700">
                                        ${(Number(formData.baseSalary) - Number(formData.deductions) + Number(formData.bonus)).toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            <button type="submit" className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition-all uppercase tracking-widest text-[10px]">
                                Record Salary for {selectedPeriod}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </Layout>
    )
}
