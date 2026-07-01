import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'

export default function AdminAnnouncements() {
    const [announcements, setAnnouncements] = useState([])
    const [classes, setClasses] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [filterPriority, setFilterPriority] = useState('all')
    const [role, setRole] = useState('student')
    const [formData, setFormData] = useState({ title: '', content: '', priority: 'normal', targetType: 'all', classId: '' })

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    useEffect(() => {
        const token = localStorage.getItem('token')
        if (token) {
            try {
                const p = JSON.parse(atob(token.split('.')[1]))
                setRole((p.role || 'student').toLowerCase())
            } catch (_) {}
        }
        fetchAll()
        fetchTargets()
    }, [])

    const fetchAll = async () => {
        setLoading(true)
        try {
            const r = await axios.get(`${apiUrl}/api/announcements`, { headers: headers() })
            setAnnouncements(r.data)
        } catch (e) { console.error(e) }
        setLoading(false)
    }

    const fetchTargets = async () => {
        try {
            const r = await axios.get(`${apiUrl}/api/announcements/targets`, { headers: headers() })
            setClasses(r.data.classes || [])
        } catch (_) {}
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!formData.title.trim() || !formData.content.trim()) return
        setSubmitting(true)
        try {
            let targets = []
            if (formData.targetType === 'all') targets = [{ targetType: 'all' }]
            else if (formData.targetType === 'class' && formData.classId) targets = [{ targetType: 'class', classId: formData.classId }]
            else targets = [{ targetType: formData.targetType }]

            await axios.post(`${apiUrl}/api/announcements`, {
                title: formData.title.trim(),
                content: formData.content.trim(),
                priority: formData.priority,
                targets
            }, { headers: headers() })

            setShowModal(false)
            setFormData({ title: '', content: '', priority: 'normal', targetType: 'all', classId: '' })
            fetchAll()
        } catch (e) { alert(e.response?.data?.message || 'Error') }
        setSubmitting(false)
    }

    const del = async (id) => {
        if (!confirm('Announcement-kan ma tirtirtaa?')) return
        try { await axios.delete(`${apiUrl}/api/announcements/${id}`, { headers: headers() }); fetchAll() }
        catch (e) { alert('Error deleting') }
    }

    const canManage = ['admin', 'super_admin', 'owner'].includes(role)

    const prioConfig = {
        low:    { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-l-slate-300', dot: 'bg-slate-400',  label: 'Hoose'  },
        normal: { bg: 'bg-blue-50',   text: 'text-blue-600',  border: 'border-l-blue-400',  dot: 'bg-blue-500',   label: 'Caadi'  },
        high:   { bg: 'bg-amber-50',  text: 'text-amber-600', border: 'border-l-amber-400', dot: 'bg-amber-500',  label: 'Muhiim' },
        urgent: { bg: 'bg-red-50',    text: 'text-red-600',   border: 'border-l-red-500',   dot: 'bg-red-500',    label: 'Deg-deg'},
    }
    const targetLabels = { all: { icon: '🌐', label: 'Dhammaan' }, students: { icon: '🎓', label: 'Ardayda' }, teachers: { icon: '👨‍🏫', label: 'Macalimiinta' }, parents: { icon: '👨‍👩‍👧', label: 'Waalidinta' }, class: { icon: '🏫', label: 'Fasal' }, section: { icon: '📚', label: 'Qayb' } }

    const targetOptions = [
        { key: 'all',      icon: '🌐', label: 'Dhammaan (Ardayda + Macalimiinta + Waalidinta)' },
        { key: 'students', icon: '🎓', label: 'Ardayda Kaliya' },
        { key: 'teachers', icon: '👨‍🏫', label: 'Macalimiinta Kaliya' },
        { key: 'parents',  icon: '👨‍👩‍👧', label: 'Waalidinta Kaliya' },
        { key: 'class',    icon: '🏫', label: 'Fasal Gaar ah...' },
    ]

    const filtered = filterPriority === 'all' ? announcements : announcements.filter(a => a.priority === filterPriority)
    const today = new Date().toDateString()
    const todayCount  = announcements.filter(a => new Date(a.created_at).toDateString() === today).length
    const urgentCount = announcements.filter(a => a.priority === 'urgent').length

    return (
        <Layout title="Ogeysiisyada">
            <div className="space-y-6">

                {/* ── Header ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight">📢 Ogeysiisyada Dugsiga</h2>
                        <p className="text-gray-400 text-sm mt-1">Ogeysiisyada la diro ardayda, macalimiinta, iyo waalidinta</p>
                    </div>
                    {canManage && (
                        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-5 py-3 rounded-xl font-bold shadow-lg shadow-rose-100 transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap">
                            <span className="text-lg leading-none">+</span> Ogeysiis Cusub
                        </button>
                    )}
                </div>

                {/* ── Stats ── */}
                {canManage && (
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm text-center">
                            <p className="text-3xl font-black text-slate-800">{announcements.length}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Wadarta</p>
                        </div>
                        <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100 text-center">
                            <p className="text-3xl font-black text-blue-700">{todayCount}</p>
                            <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mt-1">Maanta</p>
                        </div>
                        <div className="bg-red-50 rounded-2xl p-5 border border-red-100 text-center">
                            <p className="text-3xl font-black text-red-600">{urgentCount}</p>
                            <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest mt-1">Deg-deg</p>
                        </div>
                    </div>
                )}

                {/* ── Filter Tabs ── */}
                <div className="flex gap-2 flex-wrap">
                    {[{ key: 'all', label: 'Dhammaan' }, { key: 'urgent', label: '🔴 Deg-deg' }, { key: 'high', label: '🟡 Muhiim' }, { key: 'normal', label: '🔵 Caadi' }, { key: 'low', label: '⚫ Hoose' }].map(f => (
                        <button key={f.key} onClick={() => setFilterPriority(f.key)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${filterPriority === f.key ? 'bg-slate-900 text-white shadow' : 'bg-white text-slate-500 border border-gray-100 hover:border-slate-300'}`}>
                            {f.label}
                            {f.key !== 'all' && <span className="ml-1 opacity-60">({announcements.filter(a => a.priority === f.key).length})</span>}
                        </button>
                    ))}
                </div>

                {/* ── List ── */}
                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => <div key={i} className="bg-white rounded-2xl p-6 animate-pulse h-28 border border-gray-100" />)}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="bg-white rounded-2xl p-16 text-center border border-gray-100 shadow-sm">
                        <div className="text-5xl mb-3">📢</div>
                        <p className="text-slate-400 font-bold text-lg">Ma jiraan ogeysiisyo</p>
                        <p className="text-gray-300 text-sm mt-1">{canManage ? 'Riix "Ogeysiis Cusub" si aad u bilowdo' : 'Wali ogeysiis lama soo dirin'}</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map(a => {
                            const pc = prioConfig[a.priority] || prioConfig.normal
                            const tgs = (a.Targets && a.Targets.length > 0) ? a.Targets : [{ targetType: 'all' }]
                            return (
                                <div key={a.id} className={`bg-white rounded-2xl border border-gray-100 shadow-sm border-l-4 ${pc.border} hover:shadow-md transition-all`}>
                                    <div className="p-5">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wide ${pc.bg} ${pc.text}`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${pc.dot}`}></span>{pc.label}
                                                    </span>
                                                    {tgs.map((t, i) => {
                                                        const tl = targetLabels[t.targetType] || targetLabels.all
                                                        return (
                                                            <span key={i} className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">
                                                                {tl.icon} {tl.label}
                                                            </span>
                                                        )
                                                    })}
                                                    <span className="text-gray-300 text-xs ml-auto">{new Date(a.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                </div>
                                                <h3 className="text-base font-black text-slate-800 mb-1.5">{a.title}</h3>
                                                <p className="text-sm text-gray-500 leading-relaxed line-clamp-3">{a.content}</p>
                                            </div>
                                            {canManage && (
                                                <button onClick={() => del(a.id)} className="flex-shrink-0 p-2 rounded-xl text-gray-200 hover:text-red-500 hover:bg-red-50 transition-all">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* ── New Announcement Modal ── */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 overflow-y-auto flex justify-center items-start p-4 py-12">
                    <div className="bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] w-full max-w-xl relative flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-8 duration-500">
                        <div className="bg-slate-900 p-8 flex justify-between items-center shrink-0 border-b border-white/10">
                            <div>
                                <h3 className="text-xl font-black text-white">📢 Ogeysiis Cusub</h3>
                                <p className="text-slate-400 text-xs mt-1">Ogeysiiska waxaa lagu diri doonaa notification</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-all font-black text-xl">✕</button>
                        </div>
                        <div className="overflow-y-auto max-h-[70vh] custom-scrollbar">
                            <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            {/* Title */}
                            <div>
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">Cinwaanka *</label>
                                <input required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="Tusaale: Imtixaanka Xiga..."
                                    className="w-full p-3.5 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none text-sm font-medium transition-all" />
                            </div>
                            {/* Content */}
                            <div>
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">Farriin Buuxda *</label>
                                <textarea required rows={4} value={formData.content} onChange={e => setFormData({ ...formData, content: e.target.value })}
                                    placeholder="Qor ogeysiiska oo dhamaystiran..."
                                    className="w-full p-3.5 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none text-sm leading-relaxed resize-none transition-all" />
                            </div>
                            {/* Priority */}
                            <div>
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">Darajo</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {[['low','⚫','Hoose','border-slate-300'],['normal','🔵','Caadi','border-blue-400'],['high','🟡','Muhiim','border-amber-400'],['urgent','🔴','Deg-deg','border-red-500']].map(([val, icon, lbl, border]) => (
                                        <button type="button" key={val} onClick={() => setFormData({ ...formData, priority: val })}
                                            className={`p-2.5 rounded-xl border-2 text-center transition-all ${formData.priority === val ? `${border} bg-slate-50 shadow-sm` : 'border-gray-100 hover:border-gray-200'}`}>
                                            <div className="text-lg">{icon}</div>
                                            <div className="text-[10px] font-black text-slate-600 mt-0.5">{lbl}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {/* Target Audience */}
                            <div>
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">U dir Cidda</label>
                                <div className="space-y-2">
                                    {targetOptions.map(opt => (
                                        <button type="button" key={opt.key} onClick={() => setFormData({ ...formData, targetType: opt.key, classId: '' })}
                                            className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${formData.targetType === opt.key ? 'border-blue-400 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}`}>
                                            <span className="text-xl">{opt.icon}</span>
                                            <span className="text-sm font-bold text-slate-700">{opt.label}</span>
                                            {formData.targetType === opt.key && <span className="ml-auto text-blue-500">✓</span>}
                                        </button>
                                    ))}
                                    {/* Class dropdown */}
                                    {formData.targetType === 'class' && (
                                        <select required value={formData.classId} onChange={e => setFormData({ ...formData, classId: e.target.value })}
                                            className="w-full p-3 rounded-xl border border-gray-200 mt-2 text-sm font-medium outline-none focus:border-blue-400">
                                            <option value="">-- Dooro Fasalka --</option>
                                            {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                                        </select>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-4 sticky bottom-0 bg-white">
                                <button type="button" onClick={() => setShowModal(false)}
                                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black py-4 rounded-2xl transition-all">
                                    Ka noqo (Cancel)
                                </button>
                                <button type="submit" disabled={submitting}
                                    className="flex-[2] bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-black py-4 rounded-2xl shadow-lg shadow-rose-200 transition-all hover:scale-[1.01] active:scale-[0.99]">
                                    {submitting ? '⏳ Waa la dirayo...' : '📤 Dir Ogeysiiska'}
                                </button>
                            </div>
                        </form>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    )
}
