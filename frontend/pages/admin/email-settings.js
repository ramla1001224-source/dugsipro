import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'

export default function EmailSettings() {
    const [emailSettings, setEmailSettings] = useState({
        gmailAddress: '', clientId: '', clientSecret: '', refreshToken: '', isActive: false
    })
    const [testEmailAddress, setTestEmailAddress] = useState('')
    const [testingEmail, setTestingEmail] = useState(false)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    useEffect(() => {
        axios.get(`${apiUrl}/api/email/settings`, { headers: headers() })
            .then(res => { if (res.data) setEmailSettings(res.data) })
            .catch(() => {})
    }, [])

    const saveSettings = async () => {
        setSaving(true)
        setSaved(false)
        try {
            await axios.post(`${apiUrl}/api/email/settings`, emailSettings, { headers: headers() })
            setSaved(true)
            setTimeout(() => setSaved(false), 3000)
        } catch (e) {
            alert('Qalad ayaa dhacay marka la keydinayay xogta.')
        }
        setSaving(false)
    }

    const handleTestEmail = async () => {
        if (!testEmailAddress || !emailSettings.gmailAddress || !emailSettings.clientId || !emailSettings.clientSecret || !emailSettings.refreshToken) {
            alert('Fadlan buuxi dhamaan xogta Email Settings iyo email-ka tijaabada.')
            return
        }
        setTestingEmail(true)
        try {
            const res = await axios.post(`${apiUrl}/api/email/test`, { ...emailSettings, toEmail: testEmailAddress }, { headers: headers() })
            alert(res.data.message || '✅ Fariinta waa la diray si guul leh!')
        } catch (err) {
            alert(err.response?.data?.message || '❌ Waxaa dhacay qalad marka la dirayay email-ka.')
        }
        setTestingEmail(false)
    }

    return (
        <Layout title="Email Settings">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-400 rounded-2xl flex items-center justify-center shadow-lg">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-800">Email Notification Settings</h2>
                            <p className="text-gray-400 text-sm">Habee Gmail API OAuth2 si aad ugu dirto fariimaha waalidiinta</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold ${emailSettings.isActive ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                            <div className={`w-2 h-2 rounded-full ${emailSettings.isActive ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                            {emailSettings.isActive ? 'Active' : 'Inactive'}
                        </div>
                    </div>
                </div>

                {/* Status Banner */}
                {saved && (
                    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-2xl flex items-center gap-3">
                        <span className="text-green-500 text-xl">✅</span>
                        <span className="text-green-700 font-bold text-sm">Xogta si guul leh ayaa loo keydinayay!</span>
                    </div>
                )}

                {/* Main Card */}
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                    {/* Card Header */}
                    <div className="p-8 border-b border-gray-50 flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">Gmail API OAuth2 Credentials</h3>
                            <p className="text-xs text-slate-400 mt-1">Geli xogta aad ka heshay Google Cloud Console</p>
                        </div>
                        {/* Toggle */}
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-slate-500 font-medium">Hawlgeli</span>
                            <button
                                onClick={() => setEmailSettings({ ...emailSettings, isActive: !emailSettings.isActive })}
                                className={`w-14 h-7 rounded-full transition-all relative shadow-inner ${emailSettings.isActive ? 'bg-green-500' : 'bg-gray-200'}`}
                            >
                                <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${emailSettings.isActive ? 'right-1' : 'left-1'}`}></div>
                            </button>
                        </div>
                    </div>

                    <div className="p-8 space-y-6">
                        {/* Gmail Address */}
                        <div>
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">
                                📧 Gmail Address <span className="text-red-400">*</span>
                            </label>
                            <input
                                className="w-full p-4 rounded-2xl border border-gray-100 bg-slate-50 focus:ring-2 focus:ring-red-400 focus:border-transparent outline-none font-mono text-sm transition-all"
                                placeholder="iskuulka@gmail.com"
                                value={emailSettings.gmailAddress || ''}
                                onChange={e => setEmailSettings({ ...emailSettings, gmailAddress: e.target.value })}
                            />
                            <p className="text-xs text-gray-400 mt-1">Email-ka Gmail-ka ah ee fariimaha laga diri doono</p>
                        </div>

                        {/* Client ID */}
                        <div>
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">
                                🔑 Client ID <span className="text-red-400">*</span>
                            </label>
                            <input
                                className="w-full p-4 rounded-2xl border border-gray-100 bg-slate-50 focus:ring-2 focus:ring-red-400 focus:border-transparent outline-none font-mono text-sm transition-all"
                                placeholder="123456789-abcdefg.apps.googleusercontent.com"
                                value={emailSettings.clientId || ''}
                                onChange={e => setEmailSettings({ ...emailSettings, clientId: e.target.value })}
                            />
                        </div>

                        {/* Client Secret */}
                        <div>
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">
                                🔒 Client Secret <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="password"
                                className="w-full p-4 rounded-2xl border border-gray-100 bg-slate-50 focus:ring-2 focus:ring-red-400 focus:border-transparent outline-none font-mono text-sm transition-all"
                                placeholder="GOCSPX-xxxxxxxxxxxxxx"
                                value={emailSettings.clientSecret || ''}
                                onChange={e => setEmailSettings({ ...emailSettings, clientSecret: e.target.value })}
                            />
                        </div>

                        {/* Refresh Token */}
                        <div>
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">
                                🔄 Refresh Token <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="password"
                                className="w-full p-4 rounded-2xl border border-gray-100 bg-slate-50 focus:ring-2 focus:ring-red-400 focus:border-transparent outline-none font-mono text-sm transition-all"
                                placeholder="1//0exxxxxxxxxxxxxxx..."
                                value={emailSettings.refreshToken || ''}
                                onChange={e => setEmailSettings({ ...emailSettings, refreshToken: e.target.value })}
                            />
                            <p className="text-xs text-gray-400 mt-1">Ka hel Google OAuth 2.0 Playground</p>
                        </div>

                        {/* Info Box */}
                        <div className="p-5 bg-blue-50 rounded-2xl border border-blue-100 flex gap-4">
                            <span className="text-2xl">💡</span>
                            <div>
                                <p className="text-xs font-bold text-blue-700 mb-1">Xogtan sida loo helo:</p>
                                <ol className="text-xs text-blue-600 space-y-1 list-decimal list-inside">
                                    <li>Tag console.cloud.google.com → samee project → Enable Gmail API</li>
                                    <li>Samee OAuth 2.0 Credentials (Web application)</li>
                                    <li>Ka hel Refresh Token-ka Google OAuth Playground</li>
                                </ol>
                            </div>
                        </div>

                        {/* Save Button */}
                        <button
                            onClick={saveSettings}
                            disabled={saving}
                            className="w-full py-4 bg-gradient-to-r from-red-500 to-orange-400 text-white font-black rounded-2xl shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? '⏳ Keydinaya...' : '💾 Save Email Settings'}
                        </button>
                    </div>

                    {/* Test Section */}
                    <div className="p-8 bg-slate-50 border-t border-gray-100">
                        <h4 className="text-sm font-black text-slate-600 uppercase tracking-widest mb-4">🧪 Tijaabi Xiriirka (Test Connection)</h4>
                        <div className="flex gap-3">
                            <input
                                className="flex-1 p-4 rounded-2xl border border-gray-200 bg-white focus:ring-2 focus:ring-red-400 outline-none text-sm"
                                placeholder="Geli email-kaaga si aad u tijaabiso..."
                                value={testEmailAddress}
                                onChange={e => setTestEmailAddress(e.target.value)}
                            />
                            <button
                                onClick={handleTestEmail}
                                disabled={testingEmail}
                                className="px-6 py-4 bg-white border-2 border-red-200 text-red-500 hover:bg-red-50 rounded-2xl font-bold text-sm transition-all disabled:opacity-50 whitespace-nowrap"
                            >
                                {testingEmail ? '⏳ Diraya...' : '📤 Send Test'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Quick Guide */}
                <div className="mt-6 bg-gradient-to-br from-slate-800 to-slate-900 text-white p-8 rounded-3xl">
                    <h4 className="font-black text-lg mb-4">📬 Sida Fariimaha Loo Diro</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="bg-white/10 p-4 rounded-2xl">
                            <p className="font-bold mb-1">📋 Maqnaanshaha</p>
                            <p className="text-slate-300 text-xs">Waxaa otomaatig ah loogu diraa waalidiinta marka ardayga la calaamadiyo absent</p>
                        </div>
                        <div className="bg-white/10 p-4 rounded-2xl">
                            <p className="font-bold mb-1">📊 Natiijada Exam</p>
                            <p className="text-slate-300 text-xs">Waxaa loogu diraa waalidiinta marka natiijada imtixaanka la daabaco</p>
                        </div>
                        <div className="bg-white/10 p-4 rounded-2xl">
                            <p className="font-bold mb-1">📢 Ogaysiisyo</p>
                            <p className="text-slate-300 text-xs">Waxaad si toos ah ugu diri kartaa fariimaha guud ee waalidiinta</p>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    )
}
