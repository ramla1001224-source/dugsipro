import { useEffect, useState } from 'react'
import axios from 'axios'

export default function FinanceSettings() {
    const [settings, setSettings] = useState({})
    const [gatewaySettings, setGatewaySettings] = useState({ provider: 'SAHAL', merchantUid: '', apiUserId: '', apiKey: '', isActive: false })
    const [saving, setSaving] = useState(false)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    useEffect(() => {
        Promise.all([
            axios.get(`${apiUrl}/api/settings`, { headers: headers() }).catch(() => ({ data: {} })),
            axios.get(`${apiUrl}/api/payment-gateways`, { headers: headers() }).catch(() => ({ data: { provider: 'SAHAL', merchantUid: '', apiUserId: '', apiKey: '', isActive: true } }))
        ]).then(([s, p]) => {
            setSettings(s.data)
            setGatewaySettings(p.data && p.data.provider ? p.data : { provider: 'SAHAL', merchantUid: '', apiUserId: '', apiKey: '', isActive: false })
        })
    }, [])

    const saveSettings = async () => {
        setSaving(true)
        try {
            await axios.put(`${apiUrl}/api/settings`, settings, { headers: headers() })
            await axios.post(`${apiUrl}/api/payment-gateways`, gatewaySettings, { headers: headers() })
            alert('Finance & Payment settings saved!')
        } catch (e) { 
            alert(e.response?.data?.message || 'Error saving settings. Hubi in dhammaan meelaha ay ku qoran yihiin "Required" aad buuxisay.') 
        }
        finally { setSaving(false) }
    }

    return (
        <div className="max-w-5xl mx-auto pb-20">
            <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">Finance & Payroll Rules</h2>
                    <p className="text-gray-400 font-medium uppercase tracking-widest text-[10px] mt-1">Configure currency, invoices, and salary defaults</p>
                </div>
                <button
                    onClick={saveSettings}
                    disabled={saving}
                    className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-green-100 transition-all disabled:opacity-50"
                >
                    {saving ? 'Saving...' : 'Save Finance Config'}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Currency & General */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6">General Finance</h3>
                    <div className="space-y-5">
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block tracking-widest ml-1">Default Currency</label>
                            <select
                                className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold text-slate-700 outline-none focus:ring-2 focus:ring-green-500 transition-all appearance-none"
                                value={settings.currency || 'USD'}
                                onChange={e => setSettings({ ...settings, currency: e.target.value })}
                            >
                                <option value="USD">USD - US Dollar ($)</option>
                                <option value="SOS">SOS - Somali Shilling (Sh.So.)</option>
                                <option value="BOTH">Multi-Currency (USD/SOS)</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block tracking-widest ml-1">Exchange Rate (1 USD = ? SOS)</label>
                            <input
                                type="number"
                                className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold text-slate-700 outline-none focus:ring-2 focus:ring-green-500 transition-all"
                                placeholder="e.g. 26000"
                                value={settings.exchange_rate || ''}
                                onChange={e => setSettings({ ...settings, exchange_rate: e.target.value })}
                            />
                        </div>
                    </div>
                </div>

                {/* Invoice Settings */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6">Invoice Defaults</h3>
                    <div className="space-y-5">
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block tracking-widest ml-1">Invoice Prefix</label>
                            <input
                                className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold text-slate-700 outline-none focus:ring-2 focus:ring-green-500 transition-all"
                                placeholder="e.g. INV-"
                                value={settings.invoice_prefix || 'INV-'}
                                onChange={e => setSettings({ ...settings, invoice_prefix: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block tracking-widest ml-1">Invoice Footer Note</label>
                            <textarea
                                className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold text-slate-700 outline-none focus:ring-2 focus:ring-green-500 transition-all h-24 resize-none"
                                placeholder="e.g. Thank you for your payment. Please keep this receipt."
                                value={settings.invoice_footer || ''}
                                onChange={e => setSettings({ ...settings, invoice_footer: e.target.value })}
                            />
                        </div>
                    </div>
                </div>

                {/* Mobile Money Integration */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm lg:col-span-2">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-xl shadow-lg shadow-blue-100 text-white">📲</div>
                            <div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-1">Mobile Money API</h3>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Configure your payment gateway credentials</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black uppercase tracking-widest ${gatewaySettings.isActive ? 'text-green-500' : 'text-gray-400'}`}>
                                {gatewaySettings.isActive ? 'Active' : 'Inactive'}
                            </span>
                            <button
                                onClick={() => setGatewaySettings({ ...gatewaySettings, isActive: !gatewaySettings.isActive })}
                                className={`w-12 h-6 rounded-full transition-all relative ${gatewaySettings.isActive ? 'bg-green-500' : 'bg-gray-200'}`}
                            >
                                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${gatewaySettings.isActive ? 'right-1' : 'left-1'}`}></div>
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-5">
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block tracking-widest ml-1">Payment Provider</label>
                                <select
                                    className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none"
                                    value={gatewaySettings.provider || 'SAHAL'}
                                    onChange={e => setGatewaySettings({ ...gatewaySettings, provider: e.target.value })}
                                >
                                    <option value="SAHAL">Sahal (Golis)</option>
                                    <option value="ZAAD">Zaad (Telesom)</option>
                                    <option value="EDAHAB">E-Dahab (Dahabshiil)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block tracking-widest ml-1">Merchant UID (Account ID)</label>
                                <input
                                    className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono"
                                    placeholder="e.g. M-0612345"
                                    value={gatewaySettings.merchantUid || ''}
                                    onChange={e => setGatewaySettings({ ...gatewaySettings, merchantUid: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-5">
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block tracking-widest ml-1">API User ID</label>
                                <input
                                    className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono"
                                    placeholder="e.g. API-USER-123"
                                    value={gatewaySettings.apiUserId || ''}
                                    onChange={e => setGatewaySettings({ ...gatewaySettings, apiUserId: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block tracking-widest ml-1">API Secret Key</label>
                                <input
                                    type="password"
                                    className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono"
                                    placeholder="••••••••••••••••"
                                    value={gatewaySettings.apiKey || ''}
                                    onChange={e => setGatewaySettings({ ...gatewaySettings, apiKey: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-8 bg-green-50/50 border border-green-100 p-8 rounded-[2.5rem] flex items-center gap-6">
                <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center text-3xl shadow-sm">
                    💰
                </div>
                <div>
                    <h4 className="text-sm font-black text-green-900 uppercase tracking-tight mb-1">Financial Integrity</h4>
                    <p className="text-xs text-green-700 font-medium leading-relaxed max-w-2xl">
                        These settings will automatically apply to all new fee structures and salary records generated by the system. Updating the exchange rate will affect how unpaid balances are displayed in local currency.
                    </p>
                </div>
            </div>
        </div>
    )
}
