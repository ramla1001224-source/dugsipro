import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'

export default function Events() {
    const [events, setEvents] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        startDate: '',
        endDate: '',
        location: '',
        type: 'event'
    })

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    const fetchEvents = async () => {
        setLoading(true)
        try {
            const res = await axios.get(`${apiUrl}/api/events`, { headers: headers() })
            setEvents(res.data)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchEvents()
    }, [])

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            await axios.post(`${apiUrl}/api/events`, formData, { headers: headers() })
            setShowModal(false)
            setFormData({ title: '', description: '', startDate: '', endDate: '', location: '', type: 'event' })
            fetchEvents()
        } catch (e) {
            alert(e.response?.data?.message || 'Error creating event')
        }
    }

    const deleteEvent = async (id) => {
        if (!confirm('Ma hubtaa inaad tirtirto dhacdadan?')) return
        try {
            await axios.delete(`${apiUrl}/api/events/${id}`, { headers: headers() })
            fetchEvents()
        } catch (e) {
            alert('Error deleting event')
        }
    }

    const SkeletonRow = () => (
        <div className="flex items-center justify-between p-6 rounded-3xl bg-slate-50 border border-slate-100 animate-pulse mb-3">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-200"></div>
                <div className="space-y-2">
                    <div className="w-32 h-3 bg-slate-200 rounded-full"></div>
                    <div className="w-24 h-2 bg-slate-100 rounded-full"></div>
                </div>
            </div>
            <div className="w-20 h-8 bg-slate-200 rounded-xl"></div>
        </div>
    )

    return (
        <Layout title="Events">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                <div>
                    <h2 className="text-4xl font-black text-slate-800 tracking-tight">Events & Calendar</h2>
                    <p className="text-gray-400 font-medium">Maamul dhacdooyinka dugsiga iyo kalandarka</p>
                </div>

                <button
                    onClick={() => setShowModal(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-xl shadow-indigo-100 flex items-center gap-2"
                >
                    <span className="text-lg">+</span> Create New Event
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-50">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Upcoming Events</h3>
                            <span className="bg-slate-100 text-slate-500 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
                                {events.length} Total
                            </span>
                        </div>

                        {loading ? (
                            <>
                                <SkeletonRow />
                                <SkeletonRow />
                                <SkeletonRow />
                            </>
                        ) : events.length > 0 ? (
                            <div className="space-y-3">
                                {events.map(event => (
                                    <div key={event.id} className="group flex items-center justify-between p-6 rounded-3xl bg-slate-50 border border-slate-100 hover:bg-white hover:shadow-xl hover:shadow-slate-100 hover:border-indigo-100 transition-all">
                                        <div className="flex items-center gap-5">
                                            <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-black ${event.type === 'holiday' ? 'bg-rose-100 text-rose-600' : event.type === 'meeting' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                                <span className="text-[10px] uppercase leading-none mb-1">{new Date(event.startDate).toLocaleString('default', { month: 'short' })}</span>
                                                <span className="text-xl leading-none">{new Date(event.startDate).getDate()}</span>
                                            </div>
                                            <div>
                                                <h4 className="font-black text-slate-800 uppercase tracking-tight group-hover:text-indigo-600 transition-colors">{event.title}</h4>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1">
                                                        🕒 {new Date(event.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    {event.location && (
                                                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1">
                                                            📍 {event.location}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                            <button
                                                onClick={() => deleteEvent(event.id)}
                                                className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-20 text-center">
                                <div className="text-6xl mb-4 grayscale opacity-20">📅</div>
                                <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No upcoming events scheduled</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-8">
                    <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-indigo-100 relative overflow-hidden">
                        <div className="relative z-10">
                            <h3 className="text-2xl font-black mb-2">Modern School Management</h3>
                            <p className="text-indigo-100 text-sm font-medium leading-relaxed mb-6">Plan and organize your school year with ease using our advanced calendar system.</p>
                            <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20">
                                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-1">Coming Soon</p>
                                <p className="font-bold">Google Calendar Sync & SMS Notifications</p>
                            </div>
                        </div>
                        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                    </div>

                    <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6">Event Types</h3>
                        <div className="space-y-4">
                            {[
                                { label: 'General Event', color: 'bg-indigo-500', count: events.filter(e => e.type === 'event').length },
                                { label: 'Holidays', color: 'bg-rose-500', count: events.filter(e => e.type === 'holiday').length },
                                { label: 'School Meetings', color: 'bg-amber-500', count: events.filter(e => e.type === 'meeting').length }
                            ].map((type, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full ${type.color}`}></div>
                                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">{type.label}</span>
                                    </div>
                                    <span className="font-black text-slate-800">{type.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-white/20 animate-in zoom-in-95 duration-300">
                        <div className="bg-indigo-600 p-8 text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-2xl font-black uppercase tracking-tight">Create New Event</h3>
                                <p className="text-white/70 text-[10px] font-black uppercase tracking-widest mt-1">Schedule a new school activity</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors font-black">✕</button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 space-y-5">
                            <div className="grid grid-cols-1 gap-5">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block ml-1 tracking-widest">Event Title</label>
                                    <input required type="text" className="w-full bg-slate-50 border-none rounded-2xl px-6 py-3.5 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all" placeholder="e.g. Annual Sports Day" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block ml-1 tracking-widest">Start Date & Time</label>
                                        <input required type="datetime-local" className="w-full bg-slate-50 border-none rounded-2xl px-6 py-3.5 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block ml-1 tracking-widest">Event Type</label>
                                        <select className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 appearance-none" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                                            <option value="event">General Event</option>
                                            <option value="holiday">School Holiday</option>
                                            <option value="meeting">Meeting</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block ml-1 tracking-widest">Location</label>
                                    <input type="text" className="w-full bg-slate-50 border-none rounded-2xl px-6 py-3.5 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all" placeholder="e.g. School Main Hall" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block ml-1 tracking-widest">Description (Optional)</label>
                                    <textarea rows="3" className="w-full bg-slate-50 border-none rounded-2xl px-6 py-3.5 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all" placeholder="Tell us more about this event..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}></textarea>
                                </div>
                            </div>
                            <div className="pt-4">
                                <button type="submit" className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all uppercase text-xs tracking-[0.2em]">Save & Publish Event</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </Layout>
    )
}
