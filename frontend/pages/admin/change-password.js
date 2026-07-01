import Layout from '../../components/Layout'
import { useState } from 'react'
import axios from 'axios'
import { useRouter } from 'next/router'

export default function ChangePassword() {
    const [oldPassword, setOldPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (newPassword !== confirmPassword) {
            alert('Passwords do not match!')
            return
        }
        if (newPassword.length < 6) {
            alert('New password must be at least 6 characters long.')
            return
        }

        setLoading(true)
        try {
            await axios.post(`${apiUrl}/api/users/change-password`, {
                oldPassword,
                newPassword
            }, { headers: headers() })
            
            alert('Password changed successfully!')
            router.push('/admin/profile')
        } catch (err) {
            alert(err.response?.data?.message || 'Error changing password. Make sure old password is correct.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Layout title="Change Password">
            <div className="max-w-xl mx-auto py-10 px-4">
                <div className="flex items-center gap-4 mb-10">
                    <button 
                        onClick={() => router.back()}
                        className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-slate-400 hover:text-blue-600 transition-all border border-slate-100"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <div>
                        <h2 className="text-3xl font-black text-slate-800 tracking-tight">Security Settings</h2>
                        <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mt-1">Update your account password</p>
                    </div>
                </div>

                <div className="bg-white rounded-[3rem] shadow-xl shadow-slate-100 border border-slate-50 overflow-hidden">
                    <div className="bg-slate-900 p-8 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl -mr-32 -mt-32"></div>
                        <div className="relative z-10">
                            <h3 className="text-xl font-black mb-2 flex items-center gap-3">
                                <span className="bg-blue-600 p-2 rounded-xl text-lg">🔐</span>
                                Password Change
                            </h3>
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Enter your old and new passwords</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="p-10 space-y-8">
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-gray-400 ml-1 tracking-widest">Old Password</label>
                                <input
                                    type="password"
                                    required
                                    className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                    placeholder="••••••••"
                                    value={oldPassword}
                                    onChange={e => setOldPassword(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-gray-400 ml-1 tracking-widest">New Password</label>
                                <input
                                    type="password"
                                    required
                                    className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                    placeholder="••••••••"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-gray-400 ml-1 tracking-widest">Confirm New Password</label>
                                <input
                                    type="password"
                                    required
                                    className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="pt-6">
                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full py-6 rounded-[1.5rem] font-black uppercase text-[10px] tracking-[0.25em] transition-all flex items-center justify-center gap-4 shadow-xl ${
                                    loading 
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                                    : 'bg-blue-600 text-white hover:bg-slate-900 shadow-blue-100 hover:shadow-blue-200 hover:-translate-y-1'
                                }`}
                            >
                                {loading ? (
                                    <>
                                        <div className="w-5 h-5 border-3 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                                        <span>Processing...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Update Password</span>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Layout>
    )
}
