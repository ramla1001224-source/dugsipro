import Layout from '../../components/Layout'
export default function Bank() {
    return (
        <Layout title="Bank / Cash Account">
            <div className="flex flex-col items-center justify-center p-20 text-center min-h-[60vh]">
                <div className="bg-blue-50 text-blue-600 p-8 rounded-full mb-6 text-6xl shadow-lg border border-blue-100">🏦</div>
                <h2 className="text-3xl font-black text-slate-800 mb-3 tracking-tight">Bank Module</h2>
                <p className="text-gray-500 max-w-md mx-auto text-lg">Manage bank accounts, cash flow, and financial reconciliations. This feature is coming very soon.</p>
                <button className="mt-8 bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200">Notify Me When Ready</button>
            </div>
        </Layout>
    )
}
