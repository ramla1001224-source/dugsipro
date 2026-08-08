import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import VideoModal from '../../components/VideoModal'
import axios from 'axios'

export default function ParentVideoLessons() {
    const [lessons, setLessons] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedVideo, setSelectedVideo] = useState(null)
    
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

    return (
        <Layout title="Children's Video Lessons">
            <div className="mb-8">
                <h2 className="text-2xl font-black text-slate-800">Library-ga Casharada Carruurta</h2>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Halkan ka daawo casharada video-ga ah ee loo soo dhigay carruurtaada</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {loading ? (
                    <div className="col-span-full text-center py-20 text-slate-400 font-bold uppercase tracking-widest">Loading Library...</div>
                ) : lessons.length === 0 ? (
                    <div className="col-span-full bg-white p-20 rounded-[2rem] border border-dashed border-slate-200 text-center">
                        <div className="text-5xl mb-6">📺</div>
                        <h3 className="text-xl font-black text-slate-800 mb-2">Ma jiraan casharo cusub</h3>
                        <p className="text-slate-400 font-bold text-sm">Wali macallimiintu uma soo dhigin carruurtaada casharo video ah.</p>
                    </div>
                ) : lessons.map(l => (
                    <div key={l.id} className="bg-white overflow-hidden rounded-[3rem] border border-gray-100 shadow-xl shadow-slate-100 hover:shadow-2xl hover:scale-[1.02] transition-all group">
                        <div className="aspect-video bg-slate-900 relative">
                            <div className="absolute inset-0 flex items-center justify-center text-white/20 text-6xl">📽️</div>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60"></div>
                            <div className="absolute bottom-6 left-6 right-6">
                                <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Casharka: {l.clss?.class_name || 'Dhammaan'} {l.section?.name ? `(${l.section.name})` : ''}</div>
                                <h3 className="text-white font-black text-lg uppercase truncate">{l.title}</h3>
                            </div>
                        </div>
                        <div className="p-8">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-lg">
                                    👨‍🏫
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Macallinka</p>
                                    <p className="text-sm font-bold text-slate-700">{l.teacher?.user?.name || 'Macallinka'}</p>
                                </div>
                            </div>
                            <p className="text-xs text-slate-500 font-medium mb-8 line-clamp-2 h-8">{l.description || 'Ma jiro faahfaahin laga bixiyay casharka.'}</p>
                            <button 
                                onClick={() => setSelectedVideo({ url: l.videoUrl, title: l.title })}
                                className="block w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-center text-[10px] uppercase tracking-widest hover:bg-blue-600 shadow-xl shadow-slate-200 transition-all"
                            >
                                DAAWO CASHARKA HADDA
                            </button>
                        </div>
                    </div>
                ))}
            </div>
            
            <VideoModal 
                isOpen={!!selectedVideo} 
                onClose={() => setSelectedVideo(null)} 
                videoUrl={selectedVideo?.url} 
                title={selectedVideo?.title} 
            />
        </Layout>
    )
}
