import { useEffect, useState } from 'react'
import axios from 'axios'
import { useLanguage } from '../../context/LanguageContext'

export default function FeesSettings() {
    const { t } = useLanguage()
    const [classes, setClasses] = useState([])
    const [feeStructures, setFeeStructures] = useState([])
    const [localAmounts, setLocalAmounts] = useState({})
    const [savingId, setSavingId] = useState(null)
    const [successId, setSuccessId] = useState(null)
    const [loading, setLoading] = useState(true)

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    const fetchFeeStructures = async () => {
        try {
            const res = await axios.get(`${apiUrl}/api/fees`, { headers: headers() })
            setFeeStructures(res.data)
            
            // Initialize local amounts from fetched data
            const amounts = {}
            res.data.forEach(f => {
                if (f.clss?.id) {
                    amounts[f.clss.id] = f.amount
                }
            })
            setLocalAmounts(prev => ({ ...prev, ...amounts }))
        } catch (e) { console.error(e) }
    }

    useEffect(() => {
        const fetchClasses = async () => {
            try {
                const res = await axios.get(`${apiUrl}/api/classes`, { headers: headers() })
                setClasses(res.data)
                setLoading(false)
            } catch (e) {
                console.error(e)
                setLoading(false)
            }
        }
        fetchClasses()
        fetchFeeStructures()
    }, [])

    const handleSave = async (classId) => {
        const amount = localAmounts[classId]
        if (amount === undefined) return

        setSavingId(classId)
        try {
            await axios.post(`${apiUrl}/api/fees/upsert`, { classId, amount }, { headers: headers() })
            await fetchFeeStructures()
            setSuccessId(classId)
            setTimeout(() => setSuccessId(null), 3000)
        } catch (e) { 
            alert('Error updating fee') 
        } finally { 
            setSavingId(null) 
        }
    }

    if (loading) return <div className="p-8 text-center text-gray-500 font-bold loading-pulse">Loading Classes...</div>

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-8 flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">Fee Settings</h2>
                    <p className="text-gray-400 font-medium uppercase tracking-widest text-[10px] mt-1">Set monthly tuition fee per class</p>
                </div>
            </div>

            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {classes.map(c => {
                        // Find fee by checking name 'Tuition Fee' or the Somali version
                        const fee = feeStructures.find(f => 
                            (f.classId === c.id || f.clss?.id === c.id) && 
                            (f.name === 'Tuition Fee' || f.name.includes('Tuition'))
                        );
                        
                        const currentAmount = localAmounts[c.id] !== undefined ? localAmounts[c.id] : (fee?.amount || '')

                        return (
                            <div key={c.id} className="flex items-center justify-between p-6 rounded-3xl bg-slate-50 border border-slate-100 group hover:bg-white hover:shadow-md transition-all">
                                <div>
                                    <p className="font-black text-slate-800 text-lg uppercase">{c.class_name}</p>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Monthly Amount</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                        <input
                                            type="number"
                                            value={currentAmount}
                                            onChange={(e) => setLocalAmounts({ ...localAmounts, [c.id]: e.target.value })}
                                            className="w-32 bg-white border border-slate-200 rounded-2xl py-3 pl-8 pr-4 font-black text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <button
                                        onClick={() => handleSave(c.id)}
                                        disabled={savingId === c.id}
                                        className={`px-4 py-2 rounded-xl font-bold text-xs transition-all ${
                                            successId === c.id 
                                            ? 'bg-green-500 text-white' 
                                            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-100'
                                        }`}
                                    >
                                        {savingId === c.id ? (
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        ) : (
                                            successId === c.id ? 'Saved!' : 'Save'
                                        )}
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
