import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'

export default function TeacherVirtualClasses() {
    const [meetings, setMeetings] = useState([])
    const [loading, setLoading] = useState(true)
    const [classes, setClasses] = useState([])
    const [subjects, setSubjects] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [formData, setFormData] = useState({
        title: '',
        meetingUrl: '',
        startTime: '',
        classId: '',
        sectionId: '',
        subjectId: ''
    })
    const [activeTab, setActiveTab] = useState('active') // 'active' or 'history'

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const getToken = () => localStorage.getItem('token')

    const fetchData = async () => {
        setLoading(true)
        try {
            const [meetRes, classRes, subRes] = await Promise.all([
                axios.get(`${apiUrl}/api/virtual-classes`, { headers: { Authorization: `Bearer ${getToken()}` } }),
                axios.get(`${apiUrl}/api/classes`, { headers: { Authorization: `Bearer ${getToken()}` } }),
                axios.get(`${apiUrl}/api/subjects`, { headers: { Authorization: `Bearer ${getToken()}` } })
            ])
            setMeetings(meetRes.data)
            
            // Flatten hierarchical classes for the teacher form
            const flattenedClasses = [];
            classRes.data.forEach(c => {
                c.Sections.forEach(s => {
                    flattenedClasses.push({
                        classId: c.id,
                        class_name: c.class_name,
                        sectionId: s.id,
                        section: s.name,
                        shift: s.shift
                    });
                });
            });

            setClasses(flattenedClasses)
            setSubjects(subRes.data)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    const handleSubmit = async (e) => {
        e.preventDefault()

        try {
            await axios.post(`${apiUrl}/api/virtual-classes/create`, formData, {
                headers: { Authorization: `Bearer ${getToken()}` }
            })
            setShowModal(false)
            setFormData({ title: '', meetingUrl: '', startTime: '', classId: '', sectionId: '', subjectId: '' })
            fetchData()
        } catch (e) {
            alert(e.response?.data?.message || 'Error creating meeting')
        }
    }

    const endMeeting = async (id) => {
        if (!confirm('Ma hubtaa inaad soo gabagabayso fasalkan? Si toos ah ayuu system-ka uga tirtirmayaa.')) return
        try {
            await axios.delete(`${apiUrl}/api/virtual-classes/${id}`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            })
            fetchData()
        } catch (e) {
            alert('Error ending meeting')
        }
    }
    const deleteMeeting = async (id) => {
        if (!confirm('Ma hubtaa inaad tirtirto kulankan?')) return
        try {
            await axios.delete(`${apiUrl}/api/virtual-classes/${id}`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            })
            fetchData()
        } catch (e) {
            alert(e.response?.data?.message || 'Error deleting meeting')
        }
    }

    return (
        <Layout title="Fasallada Online-ka (Zoom)">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Fasallada Online-ka</h2>
                    <p className="text-gray-400 text-sm">Ku dar Fasallada Maqal iyo Muuqaal ah (Jitsi/Zoom)</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-100"
                >
                    + Fasal Cusub
                </button>
            </div>


            {/* ===== TABS ===== */}
            <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-2xl w-fit">
                <button
                    onClick={() => setActiveTab('active')}
                    className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'active' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    🔴 Hadda Socda
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'history' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    📋 Taariikhda
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {meetings
                    .filter(m => activeTab === 'active' ? m.status === 'live' : m.status === 'ended')
                    .map((m) => (
                        <div key={m.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
                            <div className={`absolute top-0 right-0 px-4 py-1.5 rounded-bl-2xl text-[10px] font-black uppercase tracking-widest ${m.status === 'live' ? 'bg-rose-500 text-white animate-pulse' : 'bg-gray-100 text-gray-400'}`}>
                                {m.status}
                            </div>
                            <div className="absolute top-0 left-0 bg-indigo-600 text-white px-3 py-1 rounded-br-xl text-[9px] font-black uppercase tracking-widest shadow-lg">
                                Moderator Control
                            </div>
                            <h3 className="font-black text-slate-800 text-lg mb-1">{m.title}</h3>
                            <p className="text-indigo-600 text-xs font-bold uppercase tracking-wider mb-4">{m.subject?.name}</p>

                            <div className="space-y-3 mb-6">
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <span className="bg-slate-50 p-2 rounded-lg text-slate-600 font-bold text-xs">
                                        {m.section ? `${m.section.class?.class_name} - ${m.section.name}` : `${m.clss?.class_name} - Dhammaan Qaybaha`}
                                    </span>
                                    <span>{new Date(m.startTime).toLocaleString()}</span>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                {m.status === 'live' && (
                                    <>
                                    <div className="flex-1 space-y-2">
                                        <div className="flex gap-2">
                                            <a
                                                href={m.meetingUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black text-center text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 hover:bg-black transition-all flex items-center justify-center gap-2"
                                            >
                                                <span>🚀</span> Biloow Fasalka (Start)
                                            </a>
                                            <button
                                                onClick={() => endMeeting(m.id)}
                                                className="px-4 bg-slate-50 text-slate-400 hover:bg-amber-50 hover:text-amber-500 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all"
                                            >
                                                End
                                            </button>
                                            <button
                                                onClick={() => deleteMeeting(m.id)}
                                                className="px-4 bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-gray-400 font-medium text-center italic">
                                            * Macalin, adiga ayaa Dominator-ka ah (Host).
                                        </p>
                                    </div>
                                    </>
                                )}
                                {m.status === 'ended' && (
                                    <button
                                        onClick={() => deleteMeeting(m.id)}
                                        className="w-full bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all"
                                    >
                                        Delete History
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
            </div>

            {meetings.filter(m => activeTab === 'active' ? m.status === 'live' : m.status === 'ended').length === 0 && !loading && (
                <div className="bg-slate-50/50 border-2 border-dashed border-slate-100 rounded-[2rem] p-12 text-center text-slate-400 font-bold">
                    {activeTab === 'active' ? 'Ma jiraan fasallo hadda socda. Biloow mid cusub!' : 'Ma jiraan fasallo hore oo la dhameeyay.'}
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="bg-indigo-900 p-6 text-white flex justify-between items-center">
                            <h3 className="text-xl font-bold">Biloow Fasal Online ah</h3>
                            <button onClick={() => setShowModal(false)} className="text-indigo-400 hover:text-white text-xl">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Cinwaanka Casharka</label>
                                <input required className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="Tusaale: Xisaab - Cutubka 1aad"
                                    value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                            </div>
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <span>🔗</span> Meeting Link (Optional)
                                </label>
                                <input 
                                    className="w-full p-3 rounded-xl border-2 border-white focus:border-indigo-500 outline-none font-medium text-sm shadow-sm"
                                    placeholder="Paste Zoom, Meet or Jitsi link here..."
                                    value={formData.meetingUrl} 
                                    onChange={e => setFormData({ ...formData, meetingUrl: e.target.value })} 
                                />
                                <p className="text-[10px] text-gray-400 font-medium italic">
                                    * Leave empty to auto-generate a secure Jitsi meeting link.
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Fasalka (Class)</label>
                                    <select required className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-bold text-sm"
                                        value={formData.classId} 
                                        onChange={e => setFormData({ ...formData, classId: e.target.value, sectionId: '', subjectId: '' })}>
                                        <option value="">Dooro Fasal...</option>
                                        {Array.from(new Map(classes.map(c => [c.classId, c.class_name])).entries()).map(([id, name]) => (
                                            <option key={id} value={id}>{name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Qaybta (Section)</label>
                                    <select required className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-bold text-sm"
                                        value={formData.sectionId} onChange={e => setFormData({ ...formData, sectionId: e.target.value, subjectId: '' })} disabled={!formData.classId}>
                                        <option value="">Dooro Qayb...</option>
                                        {formData.classId && <option value="all" className="text-indigo-600 font-black">Dhammaan Qaybaha (All Sections)</option>}
                                        {classes.filter(c => c.classId === formData.classId).map(c => (
                                            <option key={c.sectionId} value={c.sectionId}>{c.section} - {c.shift}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Maaddada</label>
                                    <select required className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-bold text-sm"
                                        value={formData.subjectId} onChange={e => setFormData({ ...formData, subjectId: e.target.value })}>
                                        <option value="">Dooro Maaddo...</option>
                                        {!formData.sectionId ? (
                                            <option disabled>Qayb marka hore dooro...</option>
                                        ) : subjects
                                            .filter(s => {
                                                if (formData.sectionId === 'all') {
                                                    const classSectionIds = classes.filter(c => c.classId === formData.classId).map(c => c.sectionId.toString());
                                                    return s.Assignments?.some(a => classSectionIds.includes(a.sectionId?.toString()));
                                                }
                                                return s.Assignments?.some(a => a.sectionId?.toString() === formData.sectionId?.toString());
                                            })
                                            .map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                                        }
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Goorta la bilaabayo</label>
                                    <input required type="datetime-local" className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                        value={formData.startTime} onChange={e => setFormData({ ...formData, startTime: e.target.value })} />
                                </div>
                            </div>
                            <div className="pt-4">
                                <button type="submit" className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-100 hover:bg-black transition-all uppercase tracking-[0.2em] text-[10px]">
                                    🚀 Biloow Fasalka (Start Now)
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </Layout>
    )
}
