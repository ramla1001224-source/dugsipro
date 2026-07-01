import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'

export default function TeacherLeave() {
    const [leaves, setLeaves] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [formData, setFormData] = useState({ startDate: '', endDate: '', reason: '' })
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    const fetchAll = async () => {
        try { const r = await axios.get(`${apiUrl}/api/leaves`, { headers: headers() }); setLeaves(r.data) } catch (e) { console.error(e) }
    }
    useEffect(() => { fetchAll() }, [])

    const handleSubmit = async (e) => {
        e.preventDefault()
        try { await axios.post(`${apiUrl}/api/leaves`, formData, { headers: headers() }); setShowModal(false); setFormData({ startDate: '', endDate: '', reason: '' }); fetchAll() }
        catch (e) { alert(e.response?.data?.message || 'Error') }
    }

    const statusColors = { pending: 'bg-amber-50 text-amber-600', approved: 'bg-green-50 text-green-600', rejected: 'bg-red-50 text-red-600' }

    return (
        <Layout title="Leave Request">
            <div className="flex justify-between items-center mb-8">
                <div><h2 className="text-2xl font-black text-slate-800">My Leaves</h2><p className="text-gray-400 text-sm">Request and track time off</p></div>
                <button onClick={() => setShowModal(true)} className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-teal-100 transition-all">Request Leave</button>
            </div>
            <div className="space-y-4">
                {leaves.map(l => (
                    <div key={l.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-1"><span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${statusColors[l.status]}`}>{l.status}</span></div>
                            <p className="font-bold text-slate-800">{new Date(l.startDate).toLocaleDateString()} → {new Date(l.endDate).toLocaleDateString()}</p>
                            <p className="text-sm text-gray-400 mt-1">{l.reason || 'No reason provided'}</p>
                        </div>
                    </div>
                ))}
                {leaves.length === 0 && <div className="bg-white p-12 rounded-2xl text-center text-gray-300 italic">No leave requests</div>}
            </div>
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="bg-slate-900 p-6 text-white flex justify-between"><h3 className="text-xl font-bold">Request Leave</h3><button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">✕</button></div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-gray-400 uppercase mb-1 block">From</label><input required type="date" className="w-full p-3 rounded-xl border" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} /></div>
                                <div><label className="text-xs font-bold text-gray-400 uppercase mb-1 block">To</label><input required type="date" className="w-full p-3 rounded-xl border" value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} /></div>
                            </div>
                            <div><label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Reason</label><textarea rows="3" className="w-full p-3 rounded-xl border" value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })} /></div>
                            <button type="submit" className="w-full bg-teal-600 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-teal-700 transition-all">Submit Request</button>
                        </form>
                    </div>
                </div>
            )}
        </Layout>
    )
}
