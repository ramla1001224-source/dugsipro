import { useEffect, useState } from 'react'
import axios from 'axios'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'

export default function ProfileSettings() {
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const [formData, setFormData] = useState({
        name: '',
        username: '',
        password: '',
        confirmPassword: '',
        phone: ''
    })

    useEffect(() => {
        fetchProfile()
    }, [])

    const fetchProfile = async () => {
        setLoading(true)
        try {
            const token = localStorage.getItem('token')
            const res = await axios.get(`${API}/api/auth/profile`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            setProfile(res.data)
            setFormData({
                name: res.data.name || '',
                username: res.data.username || '',
                password: '',
                confirmPassword: '',
                phone: res.data.phone || ''
            })
        } catch (err) {
            console.error('Profile Load Error:', err);
            setError(`Error loading profile: ${err.response?.status || ''} ${err.response?.data?.message || err.message}`);
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setSuccess('')

        if (formData.password && formData.password !== formData.confirmPassword) {
            return setError('Passwords do not match')
        }

        setSaving(true)
        try {
            const token = localStorage.getItem('token')
            await axios.put(`${API}/api/auth/profile`, formData, {
                headers: { Authorization: `Bearer ${token}` }
            })
            setSuccess('Profile updated successfully!')
            setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }))
            fetchProfile()
        } catch (err) {
            setError(err.response?.data?.message || 'Error updating profile')
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div className="p-8 text-center text-gray-500 font-bold loading-pulse">Loading Profile...</div>

    return (
        <div className="max-w-3xl mx-auto">
            <div className="mb-8">
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">Account Settings</h2>
                <p className="text-gray-400 font-medium uppercase tracking-widest text-[10px] mt-1">Manage your personal information and security</p>
            </div>

            {error && <div className="mb-6 p-4 bg-rose-50 text-rose-600 rounded-2xl font-bold border border-rose-100">{error}</div>}
            {success && <div className="mb-6 p-4 bg-emerald-50 text-emerald-600 rounded-2xl font-bold border border-emerald-100">{success}</div>}

            <div className="bg-white p-8 md:p-10 rounded-[2rem] border border-gray-100 shadow-sm">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block ml-1 tracking-widest">Full Name</label>
                            <input
                                type="text"
                                className={`w-full bg-slate-50 border-none rounded-2xl px-5 py-4 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all ${['student', 'teacher', 'parent'].includes(profile?.role) ? 'opacity-70 cursor-not-allowed' : ''}`}
                                value={formData.name}
                                onChange={e => !['student', 'teacher', 'parent'].includes(profile?.role) && setFormData({ ...formData, name: e.target.value })}
                                readOnly={['student', 'teacher', 'parent'].includes(profile?.role)}
                                disabled={['student', 'teacher', 'parent'].includes(profile?.role)}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block ml-1 tracking-widest">Username</label>
                            <input
                                type="text"
                                className={`w-full bg-slate-50 border-none rounded-2xl px-5 py-4 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all ${['student', 'teacher', 'parent'].includes(profile?.role) ? 'opacity-70 cursor-not-allowed' : ''}`}
                                value={formData.username}
                                onChange={e => !['student', 'teacher', 'parent'].includes(profile?.role) && setFormData({ ...formData, username: e.target.value })}
                                readOnly={['student', 'teacher', 'parent'].includes(profile?.role)}
                                disabled={['student', 'teacher', 'parent'].includes(profile?.role)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block ml-1 tracking-widest">Phone Number</label>
                        <input
                            type="text"
                            className={`w-full bg-slate-50 border-none rounded-2xl px-5 py-4 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all ${['student', 'teacher', 'parent'].includes(profile?.role) ? 'opacity-70 cursor-not-allowed' : ''}`}
                            value={formData.phone}
                            onChange={e => !['student', 'teacher', 'parent'].includes(profile?.role) && setFormData({ ...formData, phone: e.target.value })}
                            readOnly={['student', 'teacher', 'parent'].includes(profile?.role)}
                            disabled={['student', 'teacher', 'parent'].includes(profile?.role)}
                        />
                    </div>

                    <div className="pt-8 border-t border-gray-100">
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4">Security Update</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block ml-1 tracking-widest">New Password</label>
                                <input
                                    type="password"
                                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                    placeholder="Leave blank to keep current"
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block ml-1 tracking-widest">Confirm Password</label>
                                <input
                                    type="password"
                                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                    placeholder="Repeat new password"
                                    value={formData.confirmPassword}
                                    onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-6">
                        <button
                            type="submit"
                            disabled={saving}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-black py-4 px-8 rounded-2xl shadow-xl shadow-blue-100 transition-all uppercase text-[10px] tracking-widest disabled:opacity-50"
                        >
                            {saving ? 'Saving Changes...' : 'Save Settings'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
