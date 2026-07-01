import React from 'react'

export default function LockScreen() {
    return (
        <div className="fixed inset-0 bg-slate-900 z-[9999] flex items-center justify-center p-6 text-center">
            <div className="max-w-md w-full animate-in zoom-in-95 duration-500">
                <div className="mb-8 relative inline-block">
                    <div className="w-24 h-24 bg-rose-500/10 rounded-[2rem] flex items-center justify-center text-5xl animate-bounce">
                        🔒
                    </div>
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 rounded-full border-4 border-slate-900 animate-pulse"></div>
                </div>
                
                <h1 className="text-4xl font-black text-white mb-4 tracking-tight uppercase">
                    Nidaamka waa xiran yahay
                </h1>
                
                <div className="bg-white/5 border border-white/10 backdrop-blur-md rounded-3xl p-8 mb-8">
                    <p className="text-xl font-bold text-rose-400 mb-2">
                        Fadlan bixi biilka Bisha
                    </p>
                    <p className="text-slate-400 text-sm leading-relaxed">
                        Access to the management dashboard has been temporarily suspended due to outstanding payments. Please contact the system administrator to restore access.
                    </p>
                </div>

                <div className="flex flex-col gap-3">
                    <button 
                        onClick={() => window.location.reload()}
                        className="w-full bg-white text-slate-900 font-black py-4 rounded-2xl uppercase text-xs tracking-widest hover:bg-slate-100 transition-all shadow-xl shadow-white/5"
                    >
                        Check Status & Refresh
                    </button>
                    <button 
                        onClick={() => { localStorage.removeItem('token'); window.location.href = '/' }}
                        className="w-full bg-slate-800 text-slate-400 font-black py-4 rounded-2xl uppercase text-xs tracking-widest hover:bg-slate-700 transition-all"
                    >
                        Logout
                    </button>
                </div>

                <p className="mt-12 text-slate-600 text-[10px] font-black uppercase tracking-[0.3em]">
                    Dugsi Pro &bull; Enterprise Security
                </p>
            </div>
        </div>
    )
}
