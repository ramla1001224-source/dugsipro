import { useState } from 'react'
import axios from 'axios'

export default function MaintenanceSettings() {
    const [cleaning, setCleaning] = useState(null)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    const handleCleanup = async (type) => {
        const confirmMsg = type === 'zoom' 
            ? 'Ma hubtaa inaad tirtirto dhammaan taariikhda Zoom-ka? Arrintan dib looma soo celin karo.' 
            : 'Ma hubtaa inaad tirtirto dhammaan Homework-yada iyo faylasha ku xiran? Arrintan dib looma soo celin karo.';
        
        if (!window.confirm(confirmMsg)) return;

        setCleaning(type)
        try {
            const res = await axios.delete(`${apiUrl}/api/settings/cleanup/${type}`, { headers: headers() });
            alert(res.data.message || 'Xogta si guul leh ayaa loo tirtiray.');
        } catch (err) {
            alert(err.response?.data?.message || 'Qalad ayaa dhacay xiligii tirtirista.');
        } finally {
            setCleaning(null)
        }
    }

    return (
        <div className="max-w-5xl mx-auto pb-20">
            <div className="mb-10">
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">Data Maintenance (Nadiifinta Xogta)</h2>
                <p className="text-gray-400 font-medium uppercase tracking-widest text-[10px] mt-1">Ka saar xogta aan loo baahnayn si aad u badbaadiso storage-ga iyo booska database-ka</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Zoom Cleanup */}
                <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm group hover:shadow-xl transition-all">
                    <div className="w-20 h-20 bg-blue-50 rounded-[2rem] flex items-center justify-center text-3xl mb-6 group-hover:bg-blue-600 transition-all shadow-inner">
                        🎥
                    </div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">Zoom Class History</h3>
                    <p className="text-xs text-gray-400 font-medium leading-relaxed mb-8">
                        Waxaad tirtiraysaa dhammaan taariikhda casharadii Zoom-ka ee hore. Tani database-ka ayay fududaynaysaa.
                    </p>
                    <button
                        onClick={() => handleCleanup('zoom')}
                        disabled={cleaning === 'zoom'}
                        className={`w-full py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg ${cleaning === 'zoom' ? 'bg-gray-100 text-gray-400' : 'bg-white border-2 border-slate-200 text-slate-600 hover:border-red-200 hover:text-red-500 hover:bg-red-50'}`}
                    >
                        {cleaning === 'zoom' ? 'Cleaning...' : 'Clear Zoom History'}
                    </button>
                </div>

                {/* Homework Cleanup */}
                <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm group hover:shadow-xl transition-all">
                    <div className="w-20 h-20 bg-orange-50 rounded-[2rem] flex items-center justify-center text-3xl mb-6 group-hover:bg-orange-600 transition-all shadow-inner">
                        📚
                    </div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">Homework & Submissions</h3>
                    <p className="text-xs text-gray-400 font-medium leading-relaxed mb-8">
                        Waxaad tirtiraysaa dhammaan Homework-yada iyo faylasha ardaydu soo direen. Tani waxay badbaadinaysaa boos badan (Storage).
                    </p>
                    <button
                        onClick={() => handleCleanup('homework')}
                        disabled={cleaning === 'homework'}
                        className={`w-full py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg ${cleaning === 'homework' ? 'bg-gray-100 text-gray-400' : 'bg-white border-2 border-slate-200 text-slate-600 hover:border-red-200 hover:text-red-500 hover:bg-red-50'}`}
                    >
                        {cleaning === 'homework' ? 'Cleaning...' : 'Clear Homework History'}
                    </button>
                </div>
            </div>

            <div className="mt-12 p-8 rounded-[2.5rem] bg-amber-50 border border-amber-100 flex items-center gap-6">
                <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center text-2xl flex-shrink-0 animate-pulse">⚠️</div>
                <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-700 mb-1">Taxadar Muhiim ah</h4>
                    <p className="text-sm font-bold text-amber-900 leading-relaxed">
                        Tirtirista xogtan dib looma soo celin karo. Fadlan hubi inaad haysato backup haddii aad u baahan tahay xogtan mustaqbalka.
                    </p>
                </div>
            </div>
        </div>
    )
}
