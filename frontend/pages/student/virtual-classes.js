import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'

export default function StudentVirtualClasses() {
    const [meetings, setMeetings] = useState([])
    const [loading, setLoading] = useState(true)

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const getToken = () => localStorage.getItem('token')

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await axios.get(`${apiUrl}/api/virtual-classes?status=live`, {
                    headers: { Authorization: `Bearer ${getToken()}` }
                })
                setMeetings(res.data)
            } catch (e) {
                console.error(e)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [])

    return (
        <Layout title="Fasallada Live-ka ah">
            <div className="mb-8">
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Fasallada Live-ka ah (Zoom)</h2>
                <p className="text-gray-400 text-sm">Ku biir fasallada hada socda</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {meetings.map((m) => (
                    <div key={m.id} className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm relative overflow-hidden group hover:shadow-2xl hover:border-rose-100 transition-all">
                        <div className="absolute top-0 right-0 bg-rose-500 text-white px-6 py-2 rounded-bl-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">
                            Live Now
                        </div>

                        <h3 className="font-black text-slate-800 text-xl mb-1 mt-4">{m.title}</h3>
                        <p className="text-rose-500 text-[10px] font-black uppercase tracking-widest mb-6">{m.subject?.name}</p>

                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-700">{m.teacher?.user?.name}</p>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Teacher</p>
                            </div>
                        </div>

                        {m.status === 'live' && (
                            <a
                                href={m.meetingUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="w-full bg-slate-900 hover:bg-rose-600 text-white py-4 rounded-2xl font-black text-center text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-slate-200"
                            >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" /></svg>
                                Ku Biir (Join Class)
                            </a>
                        )}
                    </div>
                ))}
            </div>

            {meetings.length === 0 && !loading && (
                <div className="bg-slate-50/50 border-2 border-dashed border-slate-100 rounded-[3rem] p-20 text-center">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    </div>
                    <p className="font-black text-slate-300 text-xl uppercase tracking-tighter">Hada ma jiro Fasal Live ah oo socda.</p>
                </div>
            )}
        </Layout>
    )
}
