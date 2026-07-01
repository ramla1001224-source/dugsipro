import Layout from '../../components/Layout'
export default function Transaction() {
    return (
        <Layout title="Transactions">
            <div className="flex flex-col items-center justify-center p-20 text-center min-h-[60vh]">
                <div className="bg-emerald-50 text-emerald-600 p-8 rounded-full mb-6 text-6xl shadow-lg border border-emerald-100">💳</div>
                <h2 className="text-3xl font-black text-slate-800 mb-3 tracking-tight">Transaction History</h2>
                <p className="text-gray-500 max-w-md mx-auto text-lg">Detailed logs of all financial transactions within the system.</p>
            </div>
        </Layout>
    )
}
