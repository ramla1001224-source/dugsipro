import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'
import Link from 'next/link'
import { StatSkeleton, TableSkeleton, LoadingOverlay } from '../../components/DashboardSkeleton'

export default function LibrarianDashboard() {
    const [stats, setStats] = useState({ totalBooks: 0, activeIssues: 0, totalCategories: 0, overdueIssues: 0 })
    const [recentIssues, setRecentIssues] = useState([])
    const [loading, setLoading] = useState(true)
  const [announcements, setAnnouncements] = useState([])

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    const fetchStats = async () => {
        try {
            const res = await axios.get(`${apiUrl}/api/library/stats`, { headers: headers() })
            setStats(res.data)
            const issuesRes = await axios.get(`${apiUrl}/api/library/issues?limit=5`, { headers: headers() })
            setRecentIssues(issuesRes.data || [])
        } catch (e) {
            console.error(e)
        }
        setLoading(false)
    }

    useEffect(() => { fetchStats() }, [])

    const StatCard = ({ title, value, icon, color }) => (
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-all">
            <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{title}</p>
                <p className="text-3xl font-black text-slate-800">{value}</p>
            </div>
            <div className={`w-14 h-14 rounded-2xl ${color} flex items-center justify-center text-2xl shadow-inner`}>
                {icon}
            </div>
        </div>
    )

    return (
        <Layout title="Dashboard-ka Maktabadda">
            {loading && <LoadingOverlay />}
            
            <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {loading ? (
                        <>
                            <StatSkeleton />
                            <StatSkeleton />
                            <StatSkeleton />
                            <StatSkeleton />
                        </>
                    ) : (
                        <>
                            <StatCard title="Buugaagta Wadarta" value={stats.totalBooks} icon="📚" color="bg-blue-50 text-blue-600" />
                            <StatCard title="Amaahda Maqan" value={stats.activeIssues} icon="📖" color="bg-amber-50 text-amber-600" />
                            <StatCard title="Noocyada Buugaagta" value={stats.totalCategories} icon="🏷️" color="bg-emerald-50 text-emerald-600" />
                            <StatCard title="Waqtigu Ka Dhacay" value={stats.overdueIssues} icon="⏰" color="bg-rose-50 text-rose-600" />
                        </>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none text-9xl">📚</div>
                        <h3 className="text-xl font-black text-slate-800 mb-6">Action-nada Degdeg ah</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <Link href="/librarian/library" className="p-6 bg-slate-50 rounded-[2rem] hover:bg-slate-900 hover:text-white transition-all group">
                                <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">➕</div>
                                <p className="font-black text-xs uppercase tracking-widest">Ku Dar Buug</p>
                            </Link>
                            <Link href="/librarian/library" className="p-6 bg-slate-50 rounded-[2rem] hover:bg-slate-900 hover:text-white transition-all group">
                                <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">📤</div>
                                <p className="font-black text-xs uppercase tracking-widest">Amaahi Buug</p>
                            </Link>
                        </div>
                    </div>

                    <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm">
                        <h3 className="text-xl font-black text-slate-800 mb-6">Amaahdii u Dambaysay</h3>
                        {loading ? <TableSkeleton /> : (
                            <div className="space-y-4">
                                {recentIssues.slice(0, 3).map(i => {
                                    const title = i.book?.title || 'Buug la\'aan';
                                    const truncatedTitle = title.length > 20 ? title.substring(0, 20) + '...' : title;
                                    const borrowerName = i.student 
                                        ? `👤 ${i.student.user?.name || 'Arday'}` 
                                        : i.staff 
                                            ? `🤵 ${i.staff.user?.name || 'Shaqaale'}` 
                                            : 'N/A';
                                    const isReturned = i.status === 'returned';

                                    return (
                                        <div key={i.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-white border border-transparent hover:border-gray-100 transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">📖</div>
                                                <div>
                                                    <p className="font-black text-slate-800 text-sm">{truncatedTitle}</p>
                                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{borrowerName}</p>
                                                </div>
                                            </div>
                                            <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase ${
                                                isReturned ? 'text-emerald-600 bg-emerald-50' : 'text-blue-600 bg-blue-50'
                                            }`}>
                                                {i.status || 'issued'}
                                            </span>
                                        </div>
                                    );
                                })}
                                {recentIssues.length === 0 && <p className="text-center text-gray-400 py-10 italic">Ma jirto amaah dhowaan dhacday.</p>}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        
      {/* Announcements Widget */}
      {!loading && announcements.length > 0 && (
        <div className="mb-8 bg-gradient-to-r from-emerald-600 to-teal-700 rounded-[2.5rem] p-8 shadow-xl shadow-emerald-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl group-hover:scale-110 transition-all duration-700"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-xl">📢</div>
                <div>
                  <h3 className="text-white font-black uppercase tracking-widest text-sm">Announcements</h3>
                  <p className="text-emerald-100 text-[10px] font-bold uppercase tracking-tight">Farriimaha Maamulka</p>
                </div>
              </div>
              <Link href="/librarian/announcements">
                <span className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer backdrop-blur-sm">
                  View All →
                </span>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {announcements.map(a => (
                <div key={a.id} className="bg-white/10 backdrop-blur-md border border-white/10 p-5 rounded-2xl hover:bg-white/20 transition-all cursor-default group/item">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${a.priority === 'urgent' ? 'bg-red-400 animate-pulse' : a.priority === 'high' ? 'bg-amber-400' : 'bg-emerald-300'}`}></span>
                    <span className="text-[9px] font-black text-emerald-100 uppercase tracking-widest">
                      {new Date(a.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="text-white font-bold text-sm line-clamp-1 group-hover/item:text-emerald-200 transition-colors">{a.title}</h4>
                  <p className="text-emerald-100/70 text-xs mt-1 line-clamp-2 leading-relaxed">{a.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </Layout>
    )
}
