import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'

export default function StudentLessons() {
    const [lessons, setLessons] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('active') // active, history
    
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    useEffect(() => {
        fetchLessons()
    }, [])

    const fetchLessons = async () => {
        setLoading(true)
        try {
            const res = await axios.get(`${apiUrl}/api/lessons`, { headers: getHeaders() })
            setLessons(res.data)
        } catch (e) { console.error(e) }
        setLoading(false)
    }

    const activeLessons = lessons.filter(l => l.isActive !== false);
    const historyLessons = lessons.filter(l => l.isActive === false);
    const displayLessons = activeTab === 'active' ? activeLessons : historyLessons;

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
        <Layout title="My Video Lessons">
            <div className="mb-8">
                <h2 className="text-2xl font-black text-slate-800">Video Library</h2>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Watch lessons shared by your teachers</p>
            </div>

            <div className="flex gap-4 mb-8">
                <button onClick={() => setActiveTab('active')} className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'active' ? 'bg-blue-600 text-white shadow-xl shadow-blue-200' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>Active Videos ({activeLessons.length})</button>
                <button onClick={() => setActiveTab('history')} className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-slate-800 text-white shadow-xl' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>Video History ({historyLessons.length})</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full text-center py-20 text-slate-400 font-bold uppercase tracking-widest">Loading Library...</div>
                ) : displayLessons.length === 0 ? (
                    <div className="col-span-full bg-white p-20 rounded-[2rem] border border-dashed border-slate-200 text-center">
                        <div className="text-5xl mb-6">{activeTab === 'active' ? '📺' : '📚'}</div>
                        <h3 className="text-xl font-black text-slate-800 mb-2">{activeTab === 'active' ? 'No Active Videos' : 'No Video History'}</h3>
                        <p className="text-slate-400 font-bold text-sm">
                            {activeTab === 'active' ? 'Check back later for new video lessons from your teachers.' : 'There are no expired or ended videos here.'}
                        </p>
                    </div>
                ) : displayLessons.map(l => {
                    const ytId = extractYoutubeId(l.videoUrl);
                    const isActive = l.isActive !== false;
                    const subjectName = l.subject?.name || 'ALL SUBJECTS';
                    const className = l.clss?.class_name || l.section?.class?.class_name || 'N/A';
                    const sectionName = l.section?.name || 'Dhammaan Qaybaha';
                    const formattedDate = formatDate(l.createdAt || l.created_at);
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
                                        <span className="text-[13px] font-bold text-slate-600 truncate">{className} ({sectionName})</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-7 h-7 rounded-lg bg-purple-100/50 text-purple-500 flex items-center justify-center shrink-0">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        </div>
                                        <span className="text-[13px] font-bold text-slate-600 truncate">{formattedDate}</span>
                                    </div>
                                </div>
                                <a 
                                    href={l.videoUrl} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    className="flex items-center justify-center gap-2 w-full py-3.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-600 rounded-xl transition-colors mt-auto"
                                >
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
                                    <span className="font-black text-[13px] tracking-wide">WATCH VIDEO</span>
                                </a>
                            </div>
                        </div>
                    );
                })}
            </div>
        </Layout>
    )
}
