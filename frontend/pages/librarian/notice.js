import Layout from '../../components/Layout'

export default function LibrarianNotice() {
    return (
        <Layout title="System Notices">
            <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-gray-100">
                <h2 className="text-2xl font-black text-slate-800 mb-6">Latest Announcements</h2>
                <p className="text-gray-400 font-medium tracking-wide italic">Ma jiraan ogeysiisyo cusub hadda.</p>
            </div>
        </Layout>
    )
}
