import React from 'react';

/**
 * Shimmer CSS - Injected style for the moving loading effect
 */
const ShimmerStyles = () => (
    <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
        }
        .shimmer-bg {
            background: linear-gradient(90deg, #f1f5f9 25%, #f8fafc 50%, #f1f5f9 75%);
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite linear;
        }
        .shimmer-bg-dark {
            background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite linear;
        }
    `}} />
);

/**
 * StatSkeleton - Moving loading state for small statistic cards
 */
export const StatSkeleton = () => (
    <>
        <ShimmerStyles />
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div className="w-12 h-12 rounded-xl shimmer-bg"></div>
            <div className="text-right space-y-2">
                <div className="w-20 h-2 shimmer-bg rounded-full ml-auto md:ml-0"></div>
                <div className="w-12 h-6 shimmer-bg-dark rounded-lg ml-auto md:ml-0"></div>
            </div>
        </div>
    </>
);

/**
 * TableSkeleton - Moving loading state for table blocks
 */
export const TableSkeleton = () => (
    <>
        <ShimmerStyles />
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50 flex justify-between items-center">
                <div className="w-32 h-4 shimmer-bg rounded-full"></div>
                <div className="w-16 h-6 shimmer-bg-dark rounded-lg"></div>
            </div>
            <div className="p-6 space-y-6">
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="flex justify-between items-center border-b border-gray-50 pb-4 last:border-0 last:pb-0">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl shimmer-bg"></div>
                            <div className="space-y-2">
                                <div className="w-32 h-2.5 shimmer-bg-dark rounded-full"></div>
                                <div className="w-20 h-2 shimmer-bg rounded-full"></div>
                            </div>
                        </div>
                        <div className="w-16 h-3 shimmer-bg rounded-full"></div>
                        <div className="w-12 h-5 shimmer-bg-dark rounded-lg hidden sm:block"></div>
                    </div>
                ))}
            </div>
        </div>
    </>
);

/**
 * BigCardSkeleton - For larger summary blocks
 */
export const BigCardSkeleton = () => (
    <>
        <ShimmerStyles />
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-6">
                <div className="w-48 h-3 shimmer-bg rounded-full"></div>
                <div className="w-12 h-12 rounded-2xl shimmer-bg"></div>
            </div>
            <div className="w-24 h-10 shimmer-bg-dark rounded-2xl mb-2"></div>
            <div className="w-40 h-2 shimmer-bg rounded-full"></div>
        </div>
    </>
);

/**
 * LoadingOverlay - Premium glassmorphism loader with Somali text & movement
 */
export const LoadingOverlay = () => (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-white/40 backdrop-blur-3xl transition-all duration-1000 animate-in fade-in">
        <ShimmerStyles />
        <div className="flex flex-col items-center">
            <div className="relative">
                {/* Ripple Effect */}
                <div className="absolute -inset-10 bg-indigo-500/10 rounded-full blur-3xl animate-pulse"></div>
                
                {/* Premium Spinner */}
                <div className="relative w-32 h-32 flex items-center justify-center">
                    <div className="absolute inset-0 border-4 border-slate-100/50 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin [animation-duration:1.2s] shadow-[0_0_20px_rgba(79,70,229,0.3)]"></div>
                    <div className="absolute inset-0 border-2 border-dashed border-indigo-200/50 rounded-full scale-110 animate-[spin_8s_linear_infinite]"></div>
                    
                    {/* Pulsing Core */}
                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-[2rem] rotate-45 shadow-2xl shadow-indigo-600/50 flex items-center justify-center overflow-hidden animate-pulse">
                         <div className="w-full h-full bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:250%_250%] animate-[shimmer_2s_infinite_linear]"></div>
                    </div>
                </div>
            </div>

            <div className="mt-12 text-center">
                <div className="inline-block px-4 py-1.5 rounded-full bg-slate-900 shadow-xl mb-4 animate-bounce">
                    <h3 className="text-[10px] font-black text-white uppercase tracking-[0.4em]">
                        Raadinayaa Xogta...
                    </h3>
                </div>
                <div className="flex items-center gap-1.5 mt-1 justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-200 animate-[bounce_1s_infinite_-0.3s]"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-[bounce_1s_infinite_-0.15s]"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-[bounce_1s_infinite]"></span>
                </div>
                <div className="mt-8 space-y-1">
                    <p className="text-[11px] text-slate-900 font-black uppercase tracking-[0.3em] opacity-80">
                        DUGSI PRO SYSTEM
                    </p>
                    <p className="text-[9px] text-indigo-500/60 font-bold uppercase tracking-widest">
                        Premium Education Experience
                    </p>
                </div>
            </div>
        </div>
        
        {/* Animated Orbs */}
        <div className="absolute top-1/4 -left-20 w-80 h-80 bg-blue-100/40 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-indigo-100/40 rounded-full blur-[120px] animate-pulse [animation-delay:1s]"></div>
    </div>
);

const DashboardSkeleton = {
    Stat: StatSkeleton,
    Table: TableSkeleton,
    Big: BigCardSkeleton,
    Overlay: LoadingOverlay
};

export default DashboardSkeleton;
