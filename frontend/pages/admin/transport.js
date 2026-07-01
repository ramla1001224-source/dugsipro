import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'

export default function AdminTransport() {
    const [routes, setRoutes] = useState([])
    const [vehicles, setVehicles] = useState([])
    const [showVehicle, setShowVehicle] = useState(false)
    const [showRoute, setShowRoute] = useState(false)
    const [vForm, setVForm] = useState({ plateNumber: '', driverName: '', driverPhone: '', capacity: '' })
    const [rForm, setRForm] = useState({ name: '', vehicleId: '' })
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    const fetchAll = async () => {
        const [r, v] = await Promise.all([
            axios.get(`${apiUrl}/api/transport/routes`, { headers: headers() }).catch(() => ({ data: [] })),
            axios.get(`${apiUrl}/api/transport/vehicles`, { headers: headers() }).catch(() => ({ data: [] }))
        ])
        setRoutes(r.data); setVehicles(v.data)
    }
    useEffect(() => { fetchAll() }, [])

    const addVehicle = async (e) => { e.preventDefault(); try { await axios.post(`${apiUrl}/api/transport/vehicles`, vForm, { headers: headers() }); setShowVehicle(false); fetchAll() } catch (e) { alert('Error') } }
    const addRoute = async (e) => { e.preventDefault(); try { await axios.post(`${apiUrl}/api/transport/routes`, rForm, { headers: headers() }); setShowRoute(false); fetchAll() } catch (e) { alert('Error') } }

    return (
        <Layout title="Transport">
            <div className="flex justify-between items-center mb-8">
                <div><h2 className="text-2xl font-black text-slate-800">Transport Management</h2><p className="text-gray-400 text-sm">Manage school buses and routes</p></div>
                <div className="flex gap-3">
                    <button onClick={() => setShowVehicle(true)} className="bg-sky-600 hover:bg-sky-700 text-white px-5 py-3 rounded-xl font-bold shadow-lg shadow-sky-100 transition-all">Add Vehicle</button>
                    <button onClick={() => setShowRoute(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-xl font-bold shadow-lg shadow-indigo-100 transition-all">Add Route</button>
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Vehicles ({vehicles.length})</h3>
                    <div className="space-y-4">
                        {vehicles.map(v => (
                            <div key={v.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                                <div className="bg-sky-50 text-sky-600 p-3 rounded-2xl"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg></div>
                                <div className="flex-1"><p className="font-bold text-slate-800">{v.plateNumber}</p><p className="text-xs text-gray-400">{v.driverName || 'No driver'} · {v.capacity || '?'} seats</p></div>
                            </div>
                        ))}
                    </div>
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Routes ({routes.length})</h3>
                    <div className="space-y-4">
                        {routes.map(r => (
                            <div key={r.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                <div className="flex justify-between items-start mb-3">
                                    <div><p className="font-bold text-slate-800">{r.name}</p><p className="text-xs text-gray-400">{r.vehicle?.plateNumber || 'No vehicle'} · {r._count?.Assignments || 0} students</p></div>
                                    <span className="bg-green-50 text-green-600 text-[10px] font-bold px-2 py-1 rounded-full uppercase">Active</span>
                                </div>
                                {r.Stops?.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{r.Stops.map(s => <span key={s.id} className="bg-gray-50 text-gray-500 text-[10px] font-bold px-2 py-1 rounded">{s.name} {s.time && `@ ${s.time}`}</span>)}</div>}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            {showVehicle && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="bg-slate-900 p-6 text-white flex justify-between"><h3 className="text-xl font-bold">Add Vehicle</h3><button onClick={() => setShowVehicle(false)} className="text-slate-400 hover:text-white">✕</button></div>
                        <form onSubmit={addVehicle} className="p-8 space-y-4">
                            <div><label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Plate Number</label><input required className="w-full p-3 rounded-xl border" value={vForm.plateNumber} onChange={e => setVForm({ ...vForm, plateNumber: e.target.value })} /></div>
                            <div className="grid grid-cols-2 gap-4"><div><label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Driver</label><input className="w-full p-3 rounded-xl border" value={vForm.driverName} onChange={e => setVForm({ ...vForm, driverName: e.target.value })} /></div><div><label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Phone</label><input className="w-full p-3 rounded-xl border" value={vForm.driverPhone} onChange={e => setVForm({ ...vForm, driverPhone: e.target.value })} /></div></div>
                            <div><label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Capacity</label><input type="number" className="w-full p-3 rounded-xl border" value={vForm.capacity} onChange={e => setVForm({ ...vForm, capacity: e.target.value })} /></div>
                            <button type="submit" className="w-full bg-sky-600 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-sky-700 transition-all">Add Vehicle</button>
                        </form>
                    </div>
                </div>
            )}
            {showRoute && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="bg-slate-900 p-6 text-white flex justify-between"><h3 className="text-xl font-bold">Add Route</h3><button onClick={() => setShowRoute(false)} className="text-slate-400 hover:text-white">✕</button></div>
                        <form onSubmit={addRoute} className="p-8 space-y-4">
                            <div><label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Route Name</label><input required className="w-full p-3 rounded-xl border" placeholder="e.g. Route A - North" value={rForm.name} onChange={e => setRForm({ ...rForm, name: e.target.value })} /></div>
                            <div><label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Vehicle</label><select className="w-full p-3 rounded-xl border appearance-none bg-white" value={rForm.vehicleId} onChange={e => setRForm({ ...rForm, vehicleId: e.target.value })}><option value="">Select Vehicle</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.plateNumber}</option>)}</select></div>
                            <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-indigo-700 transition-all">Create Route</button>
                        </form>
                    </div>
                </div>
            )}
        </Layout>
    )
}
