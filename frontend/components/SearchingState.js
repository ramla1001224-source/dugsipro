export default function SearchingState() {
    return (
        <div className="bg-white rounded-[2rem] p-24 text-center border border-slate-100 shadow-sm flex flex-col items-center justify-center animate-pulse">
            <svg className="animate-spin h-14 w-14 text-indigo-500 mb-6 drop-shadow-md" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-100" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <h3 className="text-slate-800 font-black uppercase tracking-[0.2em] text-lg">Searching...</h3>
            <p className="text-slate-400 text-[11px] mt-3 font-bold uppercase tracking-widest">Fadlan sug inta xogta la soo baarayo...</p>
        </div>
    )
}
