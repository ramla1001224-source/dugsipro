import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'
import { getImageUrl } from '../../utils/imageHelper'

export default function Profile() {
    const [user, setUser] = useState(null)
    const [name, setName] = useState('')
    const [phone, setPhone] = useState('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    const fetchProfile = async () => {
        try {
            const res = await axios.get(`${apiUrl}/api/users/profile`, { headers: headers() })
            setUser(res.data)
            setName(res.data.name || '')
            setPhone(res.data.phone || '')
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchProfile()
    }, [])

    const handleUpdate = async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
            await axios.put(`${apiUrl}/api/users/profile`, { name, phone }, { headers: headers() })
            alert('Profile updated successfully!')
            fetchProfile()
        } catch (err) {
            alert('Error updating profile')
        } finally {
            setSaving(false)
        }
    }



    if (loading) return <Layout title="Profile"><div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div></Layout>

    return (
        <Layout title="My Profile">
            <div className="max-w-4xl mx-auto space-y-8 pb-20">
                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-gray-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/50 rounded-full -mr-32 -mt-32 blur-3xl"></div>

                    <div className="flex flex-col md:flex-row items-center gap-10 relative z-10">
                        <div className="relative group">
                            <div className="w-40 h-40 rounded-[2.5rem] bg-slate-900 border-4 border-white shadow-2xl overflow-hidden flex items-center justify-center text-5xl text-white font-black transition-all">
                                {user.name ? user.name[0].toUpperCase() : '?'}
                            </div>
                        </div>

                        <div className="text-center md:text-left">
                            <h2 className="text-4xl font-black text-slate-800 tracking-tight">{user.name}</h2>
                            <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-4">
                                <span className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-black uppercase tracking-widest">{user.role}</span>
                                <span className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-black uppercase tracking-widest">Active Status</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] shadow-sm border border-gray-100">
                        <h3 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-3">
                            <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-sm">👤</span>
                            Personal Details
                        </h3>
                        <form onSubmit={handleUpdate} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-gray-400 ml-1 tracking-widest">Full Name</label>
                                    <input
                                        type="text"
                                        className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-gray-400 ml-1 tracking-widest">Phone Number</label>
                                    <input
                                        type="text"
                                        className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                        value={phone}
                                        onChange={e => setPhone(e.target.value)}
                                        placeholder="E.g. +252..."
                                    />
                                </div>
                            </div>
                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:bg-black transition-all transform hover:-translate-y-1 active:translate-y-0 disabled:opacity-50"
                                >
                                    {saving ? 'Saving...' : 'Update Profile Information'}
                                </button>
                            </div>
                        </form>
                    </div>

                    <div className="bg-slate-900 p-10 rounded-[3rem] shadow-2xl text-white relative overflow-hidden">
                        <div className="absolute bottom-0 right-0 w-40 h-40 bg-white/5 rounded-full -mb-20 -mr-20 blur-2xl"></div>
                        <h3 className="text-xl font-black mb-8">Account Access</h3>
                        <div className="space-y-6">
                            <div>
                                <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Username</p>
                                <p className="font-bold text-lg">{user.username}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">User ID</p>
                                <p className="text-xs font-mono text-slate-400 truncate">{user.id}</p>
                            </div>
                            <div className="pt-4">
                                <a href="/admin/change-password" className="text-blue-400 hover:text-blue-300 font-black text-xs uppercase tracking-widest flex items-center gap-2">
                                    🔐 Security Settings
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    )
}
