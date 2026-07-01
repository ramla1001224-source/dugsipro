import { useEffect, useState } from 'react'
import axios from 'axios'

export default function AcademicYearSettings() {
    const [years, setYears] = useState([])
    const [loading, setLoading] = useState(true)
    const [showAddYear, setShowAddYear] = useState(false)
    const [showAddTerm, setShowAddTerm] = useState(false)
    const [selectedYearId, setSelectedYearId] = useState(null)
    const [saving, setSaving] = useState(false)

    const [newYear, setNewYear] = useState({ name: '', startDate: '', endDate: '', isCurrent: false })
    const [newTerm, setNewTerm] = useState({ name: '', startDate: '', endDate: '' })

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    const fetchYears = async () => {
        setLoading(true)
        try {
            const res = await axios.get(`${apiUrl}/api/academic-years`, { headers: headers() })
            setYears(res.data)
        } catch (e) { console.error(e) }
        finally { setLoading(false) }
    }

    useEffect(() => { fetchYears() }, [])

    const handleCreateYear = async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
            await axios.post(`${apiUrl}/api/academic-years`, newYear, { headers: headers() })
            setShowAddYear(false)
            setNewYear({ name: '', startDate: '', endDate: '', isCurrent: false })
            fetchYears()
        } catch (e) { alert(e.response?.data?.message || 'Error creating year') }
        finally { setSaving(false) }
    }

    const handleCreateTerm = async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
            await axios.post(`${apiUrl}/api/academic-years/terms`, { ...newTerm, academicYearId: selectedYearId }, { headers: headers() })
            setShowAddTerm(false)
            setNewTerm({ name: '', startDate: '', endDate: '' })
            fetchYears()
        } catch (e) { alert(e.response?.data?.message || 'Error creating term') }
        finally { setSaving(false) }
    }

    if (loading) return <div className="p-20 text-center text-gray-400 font-bold animate-pulse uppercase tracking-widest text-xs">Loading Academic Years...</div>

    return (
        <div className="max-w-5xl mx-auto pb-20">
            <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">Academic Years & Terms</h2>
                    <p className="text-gray-400 font-medium uppercase tracking-widest text-[10px] mt-1">Manage school calendar and active periods</p>
                </div>
                <button
                    onClick={() => setShowAddYear(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-100 transition-all flex items-center gap-2"
                >
                    <span className="text-lg">+</span> New Academic Year
                </button>
            </div>

            <div className="space-y-8">
                {years.map(year => (
                    <div key={year.id} className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden group hover:shadow-md transition-all">
                        <div className={`p-8 flex justify-between items-center ${year.isCurrent ? 'bg-blue-50/50' : 'bg-white'}`}>
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <h3 className="text-2xl font-black text-slate-800 uppercase">{year.name}</h3>
                                    {year.isCurrent && (
                                        <span className="bg-blue-600 text-white text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest animate-pulse">Current Year</span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                                    {new Date(year.startDate).toLocaleDateString()} — {new Date(year.endDate).toLocaleDateString()}
                                </p>
                            </div>
                            <button
                                onClick={() => { setSelectedYearId(year.id); setShowAddTerm(true); }}
                                className="bg-slate-50 hover:bg-slate-100 text-slate-600 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                            >
                                + Add Term
                            </button>
                        </div>

                        <div className="p-8 pt-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {year.Terms.map(term => (
                                <div key={term.id} className="bg-slate-50/50 border border-slate-100 p-5 rounded-3xl relative overflow-hidden group/term">
                                    <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none group-hover/term:scale-110 transition-transform">
                                        <span className="text-4xl text-slate-400">📅</span>
                                    </div>
                                    <h4 className="font-black text-slate-800 uppercase text-sm mb-1">{term.name}</h4>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-3">
                                        {new Date(term.startDate).toLocaleDateString()} - {new Date(term.endDate).toLocaleDateString()}
                                    </p>
                                    <div className="h-1.5 w-8 bg-blue-600 rounded-full"></div>
                                </div>
                            ))}
                            {year.Terms.length === 0 && (
                                <div className="col-span-full py-10 text-center text-gray-300 font-bold uppercase text-[10px] tracking-widest border-2 border-dashed border-gray-100 rounded-[2rem]">
                                    No terms defined for this year
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {years.length === 0 && (
                    <div className="bg-white p-20 rounded-[3rem] border border-dashed border-gray-200 text-center">
                        <p className="text-gray-400 font-bold uppercase tracking-widest text-sm text-[10px]">No Academic Years Found</p>
                        <p className="text-gray-300 text-[10px] font-bold uppercase mt-2">Create your first academic year to get started</p>
                    </div>
                )}
            </div>

            {/* Modal: Add Year */}
            {showAddYear && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-slate-900 p-8 text-white">
                            <h3 className="text-xl font-black uppercase tracking-tight">New Academic Year</h3>
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Set the timeframe for the school year</p>
                        </div>
                        <form onSubmit={handleCreateYear} className="p-8 space-y-5">
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block tracking-widest ml-1">Year Name</label>
                                <input
                                    required
                                    className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="e.g. 2024/2025"
                                    value={newYear.name}
                                    onChange={e => setNewYear({ ...newYear, name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block tracking-widest ml-1">Start Date</label>
                                    <input
                                        required
                                        type="date"
                                        className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                                        value={newYear.startDate}
                                        onChange={e => setNewYear({ ...newYear, startDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block tracking-widest ml-1">End Date</label>
                                    <input
                                        required
                                        type="date"
                                        className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                                        value={newYear.endDate}
                                        onChange={e => setNewYear({ ...newYear, endDate: e.target.value })}
                                    />
                                </div>
                            </div>
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 rounded-lg border-2 border-slate-200 text-blue-600 focus:ring-blue-500"
                                    checked={newYear.isCurrent}
                                    onChange={e => setNewYear({ ...newYear, isCurrent: e.target.checked })}
                                />
                                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest group-hover:text-blue-600 transition-colors">Set as Current Year</span>
                            </label>
                            <div className="pt-4 flex gap-3">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all uppercase text-[10px] tracking-widest disabled:opacity-50"
                                >
                                    {saving ? 'Creating...' : 'Create Year'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowAddYear(false)}
                                    className="px-8 py-4 rounded-2xl border-2 border-slate-100 font-black text-slate-400 uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all focus:outline-none"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Add Term */}
            {showAddTerm && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-slate-900 p-8 text-white">
                            <h3 className="text-xl font-black uppercase tracking-tight">New Academic Term</h3>
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Specify term name and duration</p>
                        </div>
                        <form onSubmit={handleCreateTerm} className="p-8 space-y-5">
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block tracking-widest ml-1">Term Name</label>
                                <input
                                    required
                                    className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="e.g. Term 1, Q1, Autumn"
                                    value={newTerm.name}
                                    onChange={e => setNewTerm({ ...newTerm, name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block tracking-widest ml-1">Start Date</label>
                                    <input
                                        required
                                        type="date"
                                        className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                                        value={newTerm.startDate}
                                        onChange={e => setNewTerm({ ...newTerm, startDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block tracking-widest ml-1">End Date</label>
                                    <input
                                        required
                                        type="date"
                                        className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                                        value={newTerm.endDate}
                                        onChange={e => setNewTerm({ ...newTerm, endDate: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all uppercase text-[10px] tracking-widest disabled:opacity-50"
                                >
                                    {saving ? 'Creating...' : 'Create Term'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowAddTerm(false)}
                                    className="px-8 py-4 rounded-2xl border-2 border-slate-100 font-black text-slate-400 uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all focus:outline-none"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
