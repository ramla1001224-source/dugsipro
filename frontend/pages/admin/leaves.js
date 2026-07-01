import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'

export default function AdminLeaves() {
    const [leaves, setLeaves] = useState([])
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    const fetchAll = async () => {
        try { const r = await axios.get(`${apiUrl}/api/leaves`, { headers: headers() }); setLeaves(r.data) } catch (e) { console.error(e) }
    }
    useEffect(() => { fetchAll() }, [])

    const updateStatus = async (id, status) => {
        try { await axios.patch(`${apiUrl}/api/leaves/${id}`, { status }, { headers: headers() }); fetchAll() }
        catch (e) { alert('Error') }
    }

    const statusColors = { pending: 'bg-amber-50 text-amber-600', approved: 'bg-green-50 text-green-600', rejected: 'bg-red-50 text-red-600' }

    return (
        <Layout title="Leave Management">
            <div className="mb-8">
                <h2 className="text-2xl font-black text-slate-800">Leave Requests</h2>
                <p className="text-gray-400 text-sm">Approve or reject staff leave requests</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto w-full">
<table className="w-full text-left">
                    <thead><tr className="bg-gray-50 text-gray-400 text-[10px] uppercase font-bold tracking-[0.2em]"><th className="px-6 py-4">Name</th><th className="px-6 py-4">From</th><th className="px-6 py-4">To</th><th className="px-6 py-4">Reason</th><th className="px-6 py-4">Status</th><th className="px-6 py-4 text-right">Action</th></tr></thead>
                    <tbody className="divide-y divide-gray-100">
                        {leaves.map(l => (
                            <tr key={l.id} className="hover:bg-gray-50/50">
                                <td className="px-6 py-4 font-bold text-slate-700">{l.teacher?.user?.name || l.staff?.user?.name || 'N/A'}</td>
                                <td className="px-6 py-4 text-sm text-gray-500">{new Date(l.startDate).toLocaleDateString()}</td>
                                <td className="px-6 py-4 text-sm text-gray-500">{new Date(l.endDate).toLocaleDateString()}</td>
                                <td className="px-6 py-4 text-sm text-gray-500">{l.reason || '-'}</td>
                                <td className="px-6 py-4"><span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${statusColors[l.status]}`}>{l.status}</span></td>
                                <td className="px-6 py-4 text-right flex gap-2 justify-end">
                                    {l.status === 'pending' && <>
                                        <button onClick={() => updateStatus(l.id, 'approved')} className="bg-green-50 text-green-600 font-bold text-xs px-3 py-1 rounded-lg hover:bg-green-100">Approve</button>
                                        <button onClick={() => updateStatus(l.id, 'rejected')} className="bg-red-50 text-red-600 font-bold text-xs px-3 py-1 rounded-lg hover:bg-red-100">Reject</button>
                                    </>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
</div>
            </div>
        </Layout>
    )
}
