import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'

export default function TeacherLessons() {
    const [lessons, setLessons] = useState([])
    const [classes, setClasses] = useState([])
    const [sections, setSections] = useState([])
    const [loading, setLoading] = useState(true)
    const [showCreate, setShowCreate] = useState(false)
    const [saving, setSaving] = useState(false)
    
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        videoUrl: '',
        classId: '',
        sectionId: '',
        subjectId: ''
    })
    const [subjects, setSubjects] = useState([])
    const [activeTab, setActiveTab] = useState('active') // active, history

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    useEffect(() => {
        fetchLessons()
        fetchClasses()
        fetchSubjects()
    }, [])

    const fetchClasses = async () => {
        try {
            const res = await axios.get(`${apiUrl}/api/classes`, { headers: getHeaders() })
            
            // Flatten hierarchical classes for the teacher form
            const flattenedClasses = [];
            res.data.forEach(c => {
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
        } catch (e) { console.error(e) }
    }

    const fetchSubjects = async () => {
        try {
            const res = await axios.get(`${apiUrl}/api/subjects`, { headers: getHeaders() })
            setSubjects(res.data)
        } catch (e) { console.error(e) }
    }

    const fetchLessons = async () => {
        setLoading(true)
        try {
            const res = await axios.get(`${apiUrl}/api/lessons`, { headers: getHeaders() })
            setLessons(res.data)
        } catch (e) { console.error(e) }
        setLoading(false)
    }

    // Removed broken cascading fetch since classes API returns all required info for teachers

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
            const submitData = { ...formData };
            if (submitData.sectionId === 'all') submitData.sectionId = ''; // Backend handles empty string as null

            await axios.post(`${apiUrl}/api/lessons`, submitData, { headers: getHeaders() })
            alert('Lesson shared successfully!')
            setShowCreate(false)
            setFormData({ title: '', description: '', videoUrl: '', classId: '', sectionId: '', subjectId: '' })
            fetchLessons()
        } catch (e) { alert('Error sharing lesson') }
        setSaving(false)
    }

    const deleteLesson = async (id) => {
        if (!confirm('Ma hubtaa inaad tirtirto casharkan?')) return
        try {
            await axios.delete(`${apiUrl}/api/lessons/${id}`, { headers: getHeaders() })
            fetchLessons()
        } catch (e) { alert('Error deleting lesson') }
    }

    const toggleLessonStatus = async (id, currentStatus) => {
        if (!confirm(`Are you sure you want to mark this lesson as ${currentStatus ? 'Ended' : 'Active'}?`)) return
        try {
            await axios.put(`${apiUrl}/api/lessons/${id}/toggle-active`, { isActive: !currentStatus }, { headers: getHeaders() })
            fetchLessons()
        } catch (e) { alert('Failed to change lesson status') }
    }

    const extractYoutubeId = (url) => {
        if (!url) return null;
        const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const match = url.match(regExp);
        return match ? match[1] : null;
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            const dt = new Date(dateString);
            return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' • ' + dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        } catch (e) {
            return dateString.split('T')[0];
        }
    };

    return (
        <Layout title="Video Lessons">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-2xl font-black text-slate-800">Video Lessons</h2>
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Share educational videos with your students</p>
                </div>
                {!showCreate && (
                    <button onClick={() => setShowCreate(true)} className="bg-blue-600 hover:bg-black text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-200 transition-all">+ Add Video Lesson</button>
                )}
            </div>

            {showCreate ? (
                <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-xl mb-12 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex justify-between items-center mb-10">
                        <h3 className="text-xl font-black text-slate-800">Post New Video Lesson</h3>
                        <button onClick={() => setShowCreate(false)} className="bg-slate-50 p-3 rounded-xl hover:bg-red-50 hover:text-red-500 transition-all font-bold">Cancel</button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="md:col-span-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Lesson Title</label>
                                <input className="w-full p-4 rounded-xl border-2 border-slate-50 focus:border-blue-500 outline-none font-bold text-slate-700 bg-slate-50/30" required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="Ex: Introduction to Algebra" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Video URL (YouTube/Drive)</label>
                                <input className="w-full p-4 rounded-xl border-2 border-slate-50 focus:border-blue-500 outline-none font-bold text-slate-700 bg-slate-50/30" required value={formData.videoUrl} onChange={e => setFormData({ ...formData, videoUrl: e.target.value })} placeholder="https://www.youtube.com/watch?v=..." />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Select Class</label>
                                <select className="w-full p-4 rounded-xl border-2 border-slate-50 focus:border-blue-500 outline-none font-bold text-slate-700 bg-slate-50/30" value={formData.classId} onChange={e => {
                                    setFormData({ ...formData, classId: e.target.value, sectionId: '' })
                                }}>
                                    <option value="">Select Class</option>
                                    {Array.from(new Map(classes.map(c => [c.classId, c.class_name])).entries()).map(([id, name]) => (
                                        <option key={id} value={id}>{name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Select Section</label>
                                <select className="w-full p-4 rounded-xl border-2 border-slate-50 focus:border-blue-500 outline-none font-bold text-slate-700 bg-slate-50/30" value={formData.sectionId} onChange={e => setFormData({ ...formData, sectionId: e.target.value })} disabled={!formData.classId}>
                                    <option value="">Select Section</option>
                                    {formData.classId && <option value="all" className="text-blue-600 font-black">All Sections (Dhammaan Qaybaha)</option>}
                                    {classes.filter(c => c.classId === formData.classId).map(c => (
                                        <option key={c.sectionId} value={c.sectionId}>{c.section} - {c.shift}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Select Subject</label>
                                <select className="w-full p-4 rounded-xl border-2 border-slate-50 focus:border-blue-500 outline-none font-bold text-slate-700 bg-slate-50/30" required value={formData.subjectId} onChange={e => setFormData({ ...formData, subjectId: e.target.value })}>
                                    <option value="">Select Subject</option>
                                    {subjects.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Description (Optional)</label>
                                <textarea className="w-full p-4 rounded-xl border-2 border-slate-50 focus:border-blue-500 outline-none font-bold text-slate-700 bg-slate-50/30 h-32 resize-none" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Tell students what this video covers..." />
                            </div>
                        </div>

                        <button type="submit" disabled={saving} className="w-full py-5 bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black shadow-2xl transition-all disabled:opacity-50">
                            {saving ? 'Posting Lesson...' : 'Publish Video Lesson'}
                        </button>
                    </form>
                </div>
            ) : (
                <>
                <div className="flex gap-4 mb-8">
                    <button onClick={() => setActiveTab('active')} className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'active' ? 'bg-blue-600 text-white shadow-xl shadow-blue-200' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>Active Videos ({lessons.filter(l => l.isActive !== false).length})</button>
                    <button onClick={() => setActiveTab('history')} className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-slate-800 text-white shadow-xl' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>Video History ({lessons.filter(l => l.isActive === false).length})</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading ? (
                        <div className="col-span-full text-center py-20 text-slate-400 font-bold uppercase tracking-widest">Loading Lessons...</div>
                    ) : (activeTab === 'active' ? lessons.filter(l => l.isActive !== false) : lessons.filter(l => l.isActive === false)).length === 0 ? (
                        <div className="col-span-full bg-white p-20 rounded-[2rem] border border-dashed border-slate-200 text-center">
                            <div className="text-5xl mb-6">{activeTab === 'active' ? '🎥' : '📚'}</div>
                            <h3 className="text-xl font-black text-slate-800 mb-2">{activeTab === 'active' ? 'No Active Lessons' : 'No Video History'}</h3>
                            <p className="text-slate-400 font-bold text-sm mb-8">{activeTab === 'active' ? "You haven't posted any active video lessons yet." : "You have no ended or expired videos."}</p>
                            {activeTab === 'active' && <button onClick={() => setShowCreate(true)} className="bg-blue-600 text-white px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all">+ Post First Lesson</button>}
                        </div>
                    ) : (activeTab === 'active' ? lessons.filter(l => l.isActive !== false) : lessons.filter(l => l.isActive === false)).map(l => {
                        const ytId = extractYoutubeId(l.videoUrl);
                        const isActive = l.isActive !== false;
                        const subjectName = l.Subject?.name || 'ALL SUBJECTS';
                        const classNameStr = l.clss?.class_name || l.section?.class?.class_name || 'All Classes';
                        const sectionName = l.section?.name || 'Dhammaan Qaybaha';
                        const formattedDate = formatDate(l.created_at || l.createdAt);
                        const title = (l.title || 'UNTITLED LESSON').toUpperCase();

                        return (
                        <div key={l.id} className="bg-white overflow-hidden rounded-[20px] border border-gray-100 shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:-translate-y-1 transition-all group flex flex-col">
                            <div className="h-[160px] bg-slate-100 relative shrink-0">
                                {ytId ? (
                                    <>
                                        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(https://img.youtube.com/vi/${ytId}/hqdefault.jpg)` }}></div>
                                        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/50"></div>
                                    </>
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <svg className="w-14 h-14 text-slate-400" fill="currentColor" viewBox="0 0 24 24"><path d="M21 3H3c-1.11 0-2 .89-2 2v14c0 1.11.89 2 2 2h18c1.11 0 2-.89 2-2V5c0-1.11-.89-2-2-2zm0 16H3V5h18v14zm-11-2h9V7h-9v10zm2-8h5v6h-5V9zM5 15h3v2H5v-2zm0-4h3v2H5v-2zm0-4h3v2H5V7z"/></svg>
                                    </div>
                                )}
                                <div className="absolute top-3 right-3 z-10">
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-sm ${isActive ? 'bg-emerald-500 text-white shadow-emerald-500/30' : 'bg-slate-500 text-white shadow-slate-500/30'}`}>
                                        {isActive ? 'Active' : 'Ended'}
                                    </span>
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    {ytId ? (
                                        <a href={l.videoUrl} target="_blank" rel="noreferrer" className="w-14 h-14 bg-red-600/90 rounded-full flex items-center justify-center shadow-lg shadow-red-500/40 transform group-hover:scale-110 transition-transform cursor-pointer">
                                            <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                        </a>
                                    ) : null}
                                </div>
                            </div>
                            <div className="p-5 flex-1 flex flex-col">
                                <h3 className="text-[18px] font-black text-slate-900 tracking-tight leading-tight mb-2 truncate">{title}</h3>
                                {l.description && (
                                    <p className="text-[13px] text-slate-500 font-medium leading-relaxed mb-4 line-clamp-2">{l.description}</p>
                                )}
                                <div className="flex flex-col gap-2.5 mb-6 flex-1 justify-center">
                                    <div className="flex items-center gap-3">
                                        <div className="w-7 h-7 rounded-lg bg-blue-100/50 text-blue-500 flex items-center justify-center shrink-0">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                        </div>
                                        <span className="text-[13px] font-bold text-slate-600 truncate">{subjectName}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-7 h-7 rounded-lg bg-amber-100/50 text-amber-500 flex items-center justify-center shrink-0">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                        </div>
                                        <span className="text-[13px] font-bold text-slate-600 truncate">{classNameStr} ({sectionName})</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-7 h-7 rounded-lg bg-purple-100/50 text-purple-500 flex items-center justify-center shrink-0">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        </div>
                                        <span className="text-[13px] font-bold text-slate-600 truncate">{formattedDate}</span>
                                    </div>
                                </div>
                                <div className="mt-auto space-y-2">
                                    <div className="flex gap-2">
                                        <a 
                                            href={l.videoUrl} 
                                            target="_blank" 
                                            rel="noreferrer" 
                                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-600 rounded-xl transition-colors"
                                        >
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
                                            <span className="font-black text-[10px] tracking-wide uppercase">WATCH</span>
                                        </a>
                                        <button onClick={() => deleteLesson(l.id)} className="px-4 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-all border border-red-200">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                    <button onClick={() => toggleLessonStatus(l.id, isActive)} className={`w-full py-3 rounded-xl font-black text-[10px] text-center uppercase tracking-widest transition-all border ${isActive ? 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100' : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'}`}>
                                        {isActive ? 'Mark as Ended' : 'Mark as Active'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )})}
                </div>
                </>
            )}
        </Layout>
    )
}
