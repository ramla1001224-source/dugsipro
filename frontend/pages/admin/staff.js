import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'

export default function StaffManagement() {
    const [staff, setStaff] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [showEditModal, setShowEditModal] = useState(false)
    const [editingStaff, setEditingStaff] = useState(null)
    const [loading, setLoading] = useState(true)
    const [formData, setFormData] = useState({ name: '', username: '', password: '', role: 'staff', salary: '', position: '' })
    const [editData, setEditData] = useState({ name: '', username: '', password: '', role: 'staff', salary: '', position: '', phone: '' })
    const [submitting, setSubmitting] = useState(false)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    const fetchStaff = async () => {
        try {
            const res = await axios.get(`${apiUrl}/api/staff`, { headers: headers() })
            setStaff(res.data)
        } catch (err) { console.error(err) }
        finally { setLoading(false) }
    }

    useEffect(() => { fetchStaff() }, [])

    const deleteStaff = async (id) => {
        if (!confirm('Ma hubtaa inaad tirtirto shaqaalahan?')) return
        try {
            await axios.delete(`${apiUrl}/api/staff/${id}`, { headers: headers() })
            fetchStaff()
        } catch (err) { alert('Error deleting staff') }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (submitting) return
        setSubmitting(true)
        try {
            await axios.post(`${apiUrl}/api/staff`, formData, { headers: headers() })
            setShowModal(false)
            setFormData({ name: '', username: '', password: '', role: 'staff', salary: '', position: '' })
            fetchStaff()
        } catch (err) { alert(err.response?.data?.message || 'Error creating staff member') }
        finally { setSubmitting(false) }
    }

    const openEdit = (member) => {
        setEditingStaff(member)
        setEditData({
            name: member.user?.name || '',
            username: member.user?.username || '',
            password: '',
            role: member.user?.role || 'staff',
            salary: member.salary || '',
            position: member.position || '',
            phone: member.phone || ''
        })
        setShowEditModal(true)
    }

    const handleEditSubmit = async (e) => {
        e.preventDefault()
        if (submitting) return
        setSubmitting(true)
        try {
            const payload = { ...editData }
            if (!payload.password) delete payload.password
            await axios.put(`${apiUrl}/api/staff/${editingStaff.id}`, payload, { headers: headers() })
            setShowEditModal(false)
            setEditingStaff(null)
            fetchStaff()
        } catch (err) { alert(err.response?.data?.message || 'Error updating staff member') }
        finally { setSubmitting(false) }
    }

    return (
        <Layout title="Staff Management">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">System Staff</h2>
                    <p className="text-gray-400 font-medium">Manage accountants and administrative staff</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-blue-100 transition-all transform hover:-translate-y-1"
                >
                    + Add New Staff
                </button>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-50 overflow-hidden">
                <div className="overflow-x-auto w-full">
                    <table className="w-full text-left min-w-max">
                    <thead>
                        <tr className="bg-slate-50/50 text-slate-400 text-[10px] uppercase font-black tracking-[0.2em]">
                            <th className="px-8 py-6">Name</th>
                            <th className="px-8 py-6">Role / Position</th>
                            <th className="px-8 py-6">Salary</th>
                            <th className="px-8 py-6">Joined Date</th>
                            <th className="px-8 py-6 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {loading ? (
                            <tr><td colSpan="5" className="text-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div></td></tr>
                        ) : staff.length > 0 ? (
                            staff.map(member => (
                                <tr key={member.id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-black text-xs uppercase">
                                                {member.user?.name?.substring(0, 2)}
                                            </div>
                                            <div className="font-black text-slate-800 text-lg group-hover:text-blue-600 transition-colors">{member.user?.name}</div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex flex-col">
                                            <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest inline-block w-fit mb-1 ${member.user?.role === 'accountant' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                                                {member.user?.role}
                                            </span>
                                            <span className="text-gray-400 text-[11px] font-bold uppercase">{member.position}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 font-black text-slate-700">${member.salary?.toLocaleString()}</td>
                                    <td className="px-8 py-6 text-sm text-gray-400 font-medium">{new Date(member.created_at).toLocaleDateString()}</td>
                                    <td className="px-8 py-6 text-right flex justify-end gap-3 items-center">
                                        <button onClick={() => openEdit(member)} className="text-blue-600 hover:text-blue-800 text-[10px] font-black uppercase tracking-widest transition-colors bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">Edit</button>
                                        <button onClick={() => deleteStaff(member.id)} className="text-red-400 hover:text-red-600 text-[10px] font-black uppercase tracking-widest transition-colors">Terminate</button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan="5" className="text-center py-20 text-gray-400 font-medium tracking-wide italic">No staff members found.</td></tr>
                        )}
                    </tbody>
                </table>
</div>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in duration-300">
                        <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
                            <h3 className="text-2xl font-black tracking-tight">Create Staff Record</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-xl transition-colors">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-10 space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Full Name</label>
                                    <input required className="w-full p-4 rounded-2xl border-none bg-gray-50 focus:ring-2 focus:ring-blue-600 font-bold text-slate-700 outline-none" placeholder="Staff name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Login Username</label>
                                    <input required className="w-full p-4 rounded-2xl border-none bg-gray-50 focus:ring-2 focus:ring-blue-600 font-bold text-slate-700 outline-none" placeholder="username" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Password</label>
                                    <input required type="password" className="w-full p-4 rounded-2xl border-none bg-gray-50 focus:ring-2 focus:ring-blue-600 font-bold text-slate-700 outline-none" placeholder="••••••••" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">System Role</label>
                                    <select className="w-full p-4 rounded-2xl border-none bg-gray-50 focus:ring-2 focus:ring-blue-600 font-black text-slate-700 outline-none" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                                        <option value="accountant">Accountant</option>
                                        <option value="librarian">Librarian</option>
                                        <option value="staff">Administrative Staff</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Job Position</label>
                                    <input className="w-full p-4 rounded-2xl border-none bg-gray-50 focus:ring-2 focus:ring-blue-600 font-bold text-slate-700 outline-none" placeholder="e.g. IT Manager" value={formData.position} onChange={e => setFormData({ ...formData, position: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Base Salary ($)</label>
                                    <input type="number" className="w-full p-4 rounded-2xl border-none bg-gray-50 focus:ring-2 focus:ring-blue-600 font-bold text-slate-700 outline-none" placeholder="0.00" value={formData.salary} onChange={e => setFormData({ ...formData, salary: e.target.value })} />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className={`w-full ${submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white font-black py-5 rounded-3xl shadow-xl shadow-blue-100 transition-all text-lg tracking-tight mt-4`}
                            >
                                {submitting ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Creating Account...
                                    </div>
                                ) : 'Create Employee Account'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
            {showEditModal && editingStaff && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in duration-300">
                        <div className="bg-blue-600 p-8 text-white flex justify-between items-center">
                            <h3 className="text-2xl font-black tracking-tight">Edit Staff Record</h3>
                            <button onClick={() => { setShowEditModal(false); setEditingStaff(null); }} className="text-blue-100 hover:text-white bg-blue-500 p-2 rounded-xl transition-colors">✕</button>
                        </div>
                        <form onSubmit={handleEditSubmit} className="p-10 space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Full Name</label>
                                    <input required className="w-full p-4 rounded-2xl border-none bg-gray-50 focus:ring-2 focus:ring-blue-600 font-bold text-slate-700 outline-none" placeholder="Staff name" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Login Username</label>
                                    <input required className="w-full p-4 rounded-2xl border-none bg-gray-50 focus:ring-2 focus:ring-blue-600 font-bold text-slate-700 outline-none" placeholder="username" value={editData.username} onChange={e => setEditData({ ...editData, username: e.target.value })} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">New Password (blank to keep)</label>
                                    <input type="password" className="w-full p-4 rounded-2xl border-none bg-gray-50 focus:ring-2 focus:ring-blue-600 font-bold text-slate-700 outline-none" placeholder="••••••••" value={editData.password} onChange={e => setEditData({ ...editData, password: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">System Role</label>
                                    <select className="w-full p-4 rounded-2xl border-none bg-gray-50 focus:ring-2 focus:ring-blue-600 font-black text-slate-700 outline-none" value={editData.role} onChange={e => setEditData({ ...editData, role: e.target.value })}>
                                        <option value="accountant">Accountant</option>
                                        <option value="librarian">Librarian</option>
                                        <option value="staff">Administrative Staff</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Job Position</label>
                                    <input className="w-full p-4 rounded-2xl border-none bg-gray-50 focus:ring-2 focus:ring-blue-600 font-bold text-slate-700 outline-none" placeholder="e.g. IT Manager" value={editData.position} onChange={e => setEditData({ ...editData, position: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Base Salary ($)</label>
                                    <input type="number" className="w-full p-4 rounded-2xl border-none bg-gray-50 focus:ring-2 focus:ring-blue-600 font-bold text-slate-700 outline-none" placeholder="0.00" value={editData.salary} onChange={e => setEditData({ ...editData, salary: e.target.value })} />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className={`w-full ${submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white font-black py-5 rounded-3xl shadow-xl shadow-blue-100 transition-all text-lg tracking-tight mt-4`}
                            >
                                {submitting ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Saving Changes...
                                    </div>
                                ) : 'Save Staff Changes'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </Layout>
    )
}
