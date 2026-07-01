import Layout from '../../components/Layout'
import { useState, useEffect } from 'react'
import { StatSkeleton, LoadingOverlay } from '../../components/DashboardSkeleton'

export default function StaffDashboard() {
    const [loading, setLoading] = useState(true)
  const [announcements, setAnnouncements] = useState([])

    useEffect(() => {
        // Simulate initial loading for a consistent premium feel
        const timer = setTimeout(() => setLoading(false), 800)
        return () => clearTimeout(timer)
    }, [])

    return (
        <Layout title="Staff Dashboard">
            {loading && <LoadingOverlay />}
            
            <div className="mb-10">
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">Administrative Support</h2>
                <p className="text-gray-400 font-medium tracking-wide">Welcome to the staff portal. Manage administrative tasks and view notices.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {loading ? (
                    <>
                        <StatSkeleton />
                        <StatSkeleton />
                        <StatSkeleton />
                    </>
                ) : (
                    <>
                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-lg transition-all">
                            <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center text-white mb-4 shadow-lg shadow-emerald-100">🌐</div>
                            <h3 className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1">System Status</h3>
                            <p className="text-3xl font-black text-slate-800 tracking-tight">Online</p>
                        </div>
                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-lg transition-all">
                            <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center text-white mb-4 shadow-lg shadow-blue-100">📝</div>
                            <h3 className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1">Tasks Pending</h3>
                            <p className="text-3xl font-black text-slate-800 tracking-tight">0</p>
                        </div>
                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-lg transition-all">
                            <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center text-white mb-4 shadow-lg shadow-amber-100">🔔</div>
                            <h3 className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1">Notifications</h3>
                            <p className="text-3xl font-black text-slate-800 tracking-tight">2</p>
                        </div>
                    </>
                )}
            </div>

            <div className="mt-12 bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden group">
                <h3 className="text-2xl font-black mb-4">Staff Notice Board</h3>
                <p className="text-slate-400 font-medium max-w-lg mb-8">Stay updated with the latest administrative notices and system maintenance schedules.</p>
                <a href="/staff/notice" className="bg-white text-slate-900 px-8 py-4 rounded-2xl font-black hover:bg-slate-100 transition-all inline-block">View All Notices</a>
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
              <Link href="/staff/announcements">
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
