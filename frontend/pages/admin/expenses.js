import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'

export default function AdminExpenses() {
    const [expenses, setExpenses] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [formData, setFormData] = useState({ title: '', amount: '', category: 'Operations', date: new Date().toISOString().split('T')[0] })
    const [month, setMonth] = useState(new Date().getMonth() + 1)
    const [year, setYear] = useState(new Date().getFullYear())
    const [submitting, setSubmitting] = useState(false)

    const fetchExpenses = async () => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
        try {
            const res = await axios.get(`${apiUrl}/api/expenses?month=${month}&year=${year}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            setExpenses(res.data)
        } catch (e) { console.error(e) }
    }

    useEffect(() => { fetchExpenses() }, [month, year])

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (submitting) return
        setSubmitting(true)
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
        try {
            await axios.post(`${apiUrl}/api/expenses/create`, formData, {
                headers: { Authorization: `Bearer ${token}` }
            })
            setShowModal(false)
            setFormData({ title: '', amount: '', category: 'Operations', date: new Date().toISOString().split('T')[0] })
            fetchExpenses()
        } catch (e) { alert(e.response?.data?.message || 'Error recording expense') }
        finally { setSubmitting(false) }
    }

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this expense?')) return
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
        try {
            await axios.delete(`${apiUrl}/api/expenses/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            fetchExpenses()
        } catch (e) { alert(e.response?.data?.message || 'Error deleting expense') }
    }

    return (
        <Layout title="School Expenses">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Expense Tracker</h2>
                    <p className="text-gray-400 text-sm">Monitor school expenditures</p>
                </div>
                <div className="flex gap-4 items-center">
                    <div className="flex bg-white rounded-xl shadow-sm border border-gray-100 p-1">
                        <select className="bg-transparent font-bold text-slate-700 outline-none px-4 py-2 border-r border-gray-100" value={month} onChange={e => setMonth(Number(e.target.value))}>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('default', { month: 'short' })}</option>
                            ))}
                        </select>
                        <select className="bg-transparent font-bold text-slate-700 outline-none px-4 py-2" value={year} onChange={e => setYear(Number(e.target.value))}>
                            {[...Array(5)].map((_, i) => {
                                const y = new Date().getFullYear() - i;
                                return <option key={y} value={y}>{y}</option>
                            })}
                        </select>
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-red-100"
                    >
                        + Add Expense
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto w-full">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50 text-gray-400 text-[10px] uppercase font-bold tracking-[0.2em]">
                                <th className="px-6 py-4">Title / Category</th>
                                <th className="px-6 py-4">Amount</th>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {expenses.map(exp => (
                                <tr key={exp.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <p className="font-bold text-slate-700">{exp.title}</p>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{exp.category}</p>
                                    </td>
                                    <td className="px-6 py-4 font-black text-red-600">-${exp.amount.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{new Date(exp.date).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button onClick={() => handleDelete(exp.id)} className="text-gray-300 hover:text-red-500">✕</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
                            <h3 className="text-xl font-bold">New Expense Record</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Expense Title</label>
                                <input required className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-red-500 outline-none" placeholder="e.g. Electricity Bill" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Amount ($)</label>
                                    <input required type="number" className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-red-500 outline-none" placeholder="0.00" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Category</label>
                                    <select className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-red-500 outline-none appearance-none bg-white" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                                        <option value="Operations">Operations</option>
                                        <option value="Salaries">Salaries</option>
                                        <option value="Maintenance">Maintenance</option>
                                        <option value="Marketing">Marketing</option>
                                        <option value="Utilities">Utilities</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Date</label>
                                <input type="date" className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-red-500 outline-none" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className={`flex-1 ${submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'} text-white font-bold py-3 rounded-xl shadow-lg shadow-red-100 transition-all`}
                                >
                                    {submitting ? (
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            Recording...
                                        </div>
                                    ) : 'Record Expense'}
                                </button>
                                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 rounded-xl border-2 border-gray-100 font-bold text-gray-400">Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </Layout>
    )
}
