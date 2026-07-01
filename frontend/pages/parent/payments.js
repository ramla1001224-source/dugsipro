import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'

export default function ParentPayments() {
    const [payments, setPayments] = useState([])
    const [loading, setLoading] = useState(true)
    const [gateway, setGateway] = useState({})
    const [showPayModal, setShowPayModal] = useState(false)
    const [selectedPayment, setSelectedPayment] = useState(null)
    const [phone, setPhone] = useState('')
    const [payerName, setPayerName] = useState('')
    const [processing, setProcessing] = useState(false)

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    useEffect(() => {
        fetchPayments()
        fetchGateway()
    }, [])

    const fetchPayments = async () => {
        setLoading(true)
        try {
            const res = await axios.get(`${apiUrl}/api/payments/monthly-records`, { headers: getHeaders() })
            setPayments(res.data)
        } catch (e) { console.error(e) }
        setLoading(false)
    }

    const fetchGateway = async () => {
        try {
            const res = await axios.get(`${apiUrl}/api/payment-gateways`, { headers: getHeaders() })
            setGateway(res.data)
        } catch (e) { console.error(e) }
    }

    const handlePay = (p) => {
        if (p === 'all') {
            const total = payments.reduce((acc, curr) => acc + (curr.remainingAmount || 0), 0)
            setSelectedPayment({
                studentId: payments[0]?.studentId,
                amount: total,
                isAll: true,
                description: 'Wadarta dhamaan biilasha dhiman'
            })
        } else {
            setSelectedPayment({ ...p, amount: p.remainingAmount })
        }
        setShowPayModal(true)
    }

    const initiatePayment = async () => {
        if (!payerName) return alert('Fadlan gali magacaaga')
        if (!phone || phone.length < 9) return alert('Fadlan gali lambar sax ah')
        setProcessing(true)
        try {
            const res = await axios.post(`${apiUrl}/api/payment-gateways/initiate`, {
                studentId: selectedPayment.studentId,
                amount: selectedPayment.amount,
                phoneNumber: phone,
                name: payerName,
                month: selectedPayment.month,
                year: selectedPayment.year,
                description: selectedPayment.description || `Tuition Fee for ${selectedPayment.month}/${selectedPayment.year}`
            }, { headers: getHeaders() })

            alert(res.data.message)
            setShowPayModal(false)
            fetchPayments()
        } catch (e) {
            alert(e.response?.data?.message || 'Cillad ayaa dhacday')
        }
        setProcessing(false)
    }

    const totalBalance = payments.reduce((acc, curr) => acc + (curr.remainingAmount || 0), 0)

    return (
        <Layout title="Lacag Bixinta">
            <div className="mb-8 flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-black text-slate-800">Maaraynta Lacagaha</h2>
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Halkan ka la soco oo ka bixi biilasha carruurtaada</p>
                </div>
                {gateway.isActive && (
                    <div className="bg-green-50 px-4 py-2 rounded-xl border border-green-100 flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        <span className="text-[10px] font-black text-green-700 uppercase tracking-widest">Mobile Money Is Active</span>
                    </div>
                )}
            </div>

            {/* Total Balance Card */}
            {!loading && totalBalance > 0 && (
                <div className="bg-slate-900 rounded-[2.5rem] p-8 mb-8 text-white flex flex-col md:flex-row justify-between items-center gap-6 shadow-2xl shadow-slate-200">
                    <div>
                        <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-1">Wadarta Guud ee dhiman</p>
                        <h3 className="text-5xl font-black">${totalBalance}</h3>
                    </div>
                    {gateway.isActive && (
                        <button 
                            onClick={() => handlePay('all')}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-blue-900/20 active:scale-95"
                        >
                            Bixi Wadarta Guud
                        </button>
                    )}
                </div>
            )}

            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ardayga</th>
                            <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Bil/Sano</th>
                            <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Biilka</th>
                            <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Wali Dhiman</th>
                            <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                            <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="6" className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest">Loading Bills...</td></tr>
                        ) : payments.length === 0 ? (
                            <tr><td colSpan="6" className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest">Ma jiraan biilal wali</td></tr>
                        ) : payments.map(p => (
                            <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-all text-sm">
                                <td className="p-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-lg font-black text-slate-400 uppercase">
                                            {p.student?.user?.name?.[0]}
                                        </div>
                                        <div>
                                            <p className="font-black text-slate-700 uppercase">{p.student?.user?.name}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{p.student?.student_id}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-6">
                                    <p className="font-bold text-slate-600 uppercase">{p.month}/{p.year}</p>
                                </td>
                                <td className="p-6">
                                    <p className="font-black text-slate-800 text-base">${p.expectedAmount}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bixiyay: ${p.amountPaid || 0}</p>
                                </td>
                                <td className="p-6">
                                    <p className={`font-black text-base ${p.remainingAmount > 0 ? 'text-rose-500' : 'text-slate-400'}`}>${p.remainingAmount}</p>
                                </td>
                                <td className="p-6">
                                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${p.status === 'paid' ? 'bg-green-100 text-green-700' : p.amountPaid > 0 ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                                        }`}>
                                        {p.status === 'paid' ? 'PAID' : p.amountPaid > 0 ? 'PARTIAL' : 'UNPAID'}
                                    </span>
                                </td>
                                <td className="p-6 text-right">
                                    {p.remainingAmount > 0 && gateway.isActive ? (
                                        <button
                                            onClick={() => handlePay(p)}
                                            className="px-6 py-3 bg-slate-100 text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all"
                                        >
                                            Bixi
                                        </button>
                                    ) : (
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            {p.status === 'paid' ? 'Waad Bixisay' : 'Lama bixin karo'}
                                        </span>
                                    )}
                                    {p.paymentId && (
                                        <button
                                            onClick={() => {
                                                const token = localStorage.getItem('token')
                                                const path = `/api/payments/${p.paymentId}/receipt?token=${token}`
                                                const fullUrl = `${apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl}${path.startsWith('/') ? path : `/${path}`}`
                                                window.open(fullUrl, '_blank')
                                            }}
                                            className="ml-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all"
                                            title="Download Receipt"
                                        >
                                            Xaqiijinta
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showPayModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[3rem] w-full max-w-md p-10 shadow-2xl animate-in fade-in zoom-in duration-300">
                        <h3 className="text-2xl font-black text-slate-800 mb-2 uppercase">Bixi Lacagta</h3>
                        <p className="text-slate-400 font-bold text-xs mb-8">Buuxi macluumaadka hoose si aad lacagta u dirto.</p>

                        <div className="bg-slate-50 p-6 rounded-3xl mb-8 border border-slate-100">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Wadarta la bixinayo</span>
                                <span className="text-3xl font-black text-slate-900">${selectedPayment?.amount}</span>
                            </div>
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex flex-col gap-1 mt-2 border-t border-slate-100 pt-2">
                                <span>{selectedPayment?.isAll ? 'Qofka: Dhamaan carruurta' : `Ardayga: ${selectedPayment?.student?.user?.name}`}</span>
                                {!selectedPayment?.isAll && <span>Bisha: {selectedPayment?.month}/{selectedPayment?.year}</span>}
                            </div>
                        </div>

                        <div className="space-y-6 mb-8">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-2">Magacaaga</label>
                                <input
                                    type="text"
                                    value={payerName}
                                    onChange={(e) => setPayerName(e.target.value)}
                                    placeholder="Gali magacaaga oo buuxa"
                                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all placeholder:text-slate-300 placeholder:font-normal"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-2">Mobile Number-kaaga</label>
                                <input
                                    type="text"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="E.g. 61xxxxxxx ama 63xxxxxxx"
                                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all placeholder:text-slate-300 placeholder:font-normal"
                                />
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => setShowPayModal(false)}
                                className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
                            >
                                Ka Noqo
                            </button>
                            <button
                                onClick={initiatePayment}
                                disabled={processing}
                                className={`flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-blue-200 ${processing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'
                                    }`}
                            >
                                {processing ? 'WAA LA DIRAYAA...' : 'BIXI HADDA'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    )
}
