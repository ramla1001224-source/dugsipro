import { useEffect, useState } from 'react'
import Link from 'next/link'
import axios from 'axios'
import Layout from '../../components/Layout'
import { StatSkeleton, LoadingOverlay } from '../../components/DashboardSkeleton'
import { useLanguage } from '../../context/LanguageContext'
import Head from 'next/head'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'

export default function OwnerDashboard() {
    const { t } = useLanguage()
    const [schools, setSchools] = useState([])
    const [loading, setLoading] = useState(true)
  const [announcements, setAnnouncements] = useState([])
    const [showAddSchool, setShowAddSchool] = useState(false)
    const [editingSchool, setEditingSchool] = useState(null)
    const [schoolForm, setSchoolForm] = useState({ name: '', shortCode: '', address: '', phone: '', email: '' })
    const [saving, setSaving] = useState(false)

    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    useEffect(() => {
        fetchSchools()
    }, [])

    const fetchSchools = async () => {
        setLoading(true)
        try {
            const res = await axios.get(`${API}/api/schools`, { headers: headers() })
            setSchools(res.data)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const handleAddSchool = async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
            if (editingSchool) {
                await axios.put(`${API}/api/schools/${editingSchool.id}`, schoolForm, { headers: headers() })
            } else {
                await axios.post(`${API}/api/schools`, schoolForm, { headers: headers() })
            }
            setShowAddSchool(false)
            setEditingSchool(null)
            setSchoolForm({ name: '', shortCode: '', address: '', phone: '', email: '' })
            fetchSchools()
        } catch (e) {
            alert(e.response?.data?.message || 'Error')
        } finally {
            setSaving(false)
        }
    }

    const openEdit = (school) => {
        setEditingSchool(school)
        setSchoolForm({
            name: school.name,
            shortCode: school.shortCode || '',
            address: school.address || '',
            phone: school.phone || '',
            email: school.email || ''
        })
        setShowAddSchool(true)
    }

    const toggleLock = async (school) => {
        const action = school.isActive ? 'lock' : 'unlock'
        if (!confirm(t('confirm_lock_unlock_msg').replace('{action}', action === 'lock' ? t('lock') : t('unlock')))) return
        try {
            await axios.put(`${API}/api/schools/${school.id}`, { ...school, isActive: !school.isActive }, { headers: headers() })
            fetchSchools()
        } catch (e) {
            alert('Error toggling school lock')
        }
    }

    const deleteSchool = async (id) => {
        if (!confirm(t('confirm_delete_school_full_msg'))) return
        try {
            await axios.delete(`${API}/api/schools/${id}`, { headers: headers() })
            fetchSchools()
        } catch (e) {
            alert('Error deleting school')
        }
    }

    return (
        <Layout title={`${t('system_owner')} | ${t('dashboard')}`}>
            <Head>
                <title>{t('enterprise_owner')} | {t('system_name')}</title>
            </Head>

            {loading && <LoadingOverlay />}
            
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-12">
                <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-2">{t('network_hub')}</h2>
                    <p className="text-slate-500 font-semibold uppercase tracking-[0.2em] text-[10px]">{t('managed_enterprise_nodes')}</p>
                </div>

            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {loading ? (
                    <>
                        <StatSkeleton />
                        <StatSkeleton />
                        <StatSkeleton />
                    </>
                ) : schools.length === 0 ? (
                    <div className="col-span-full py-32 text-center bg-white border border-slate-100 rounded-[3rem]">
                        <div className="text-6xl mb-6 grayscale opacity-20">🏢</div>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{t('empty_network')}</h3>
                        <p className="text-slate-400 mt-2 font-black text-[10px] uppercase tracking-widest">{t('no_institutional_entities_desc')}</p>
                    </div>
                ) : schools.map(school => (
                    <div key={school.id} className={`bg-white/80 backdrop-blur-xl p-10 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-500 group relative overflow-hidden ${!school.isActive && 'grayscale opacity-60 hover:grayscale-0'}`}>
                        <div className="flex items-start justify-between mb-10 relative z-10">
                            <div className="flex items-center gap-5">
                                <div className="w-20 h-20 bg-gradient-to-br from-slate-50 to-slate-100 rounded-3xl flex items-center justify-center text-4xl group-hover:scale-110 transition-transform duration-500 border border-slate-200/50 shadow-inner">🏫</div>
                                <div>
                                    <h3 className="font-black text-slate-900 text-2xl tracking-tight leading-tight mb-1">{school.name}</h3>
                                    <div className="flex gap-3 items-center">
                                        <div className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${school.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                            {school.isActive ? t('operational') : t('suspended')}
                                        </div>
                                        <div className="text-blue-500 text-[9px] font-black uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full">{school.shortCode || t('no_value')}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3 mb-10 relative z-10">
                            {[
                                { label: t('enrollment_label'), val: school.students, color: 'text-blue-600', bg: 'bg-blue-50' },
                                { label: t('faculty_label'), val: school.teachers, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                                { label: t('revenue_label'), val: `$${(school.revenue || 0).toLocaleString()}`, color: 'text-emerald-600', bg: 'bg-emerald-50' }
                            ].map((s, i) => (
                                <div key={i} className={`${s.bg} p-4 rounded-2xl text-center border border-white`}>
                                    <div className={`text-[11px] font-black ${s.color} mb-1 truncate`}>{s.val ?? 0}</div>
                                    <div className={`text-[8px] font-black ${s.color} opacity-60 uppercase tracking-widest`}>{s.label}</div>
                                </div>
                            ))}
                        </div>

                        <div className="flex items-center gap-3 relative z-10">
                            <button
                                onClick={() => openEdit(school)}
                                className="flex-1 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all"
                            >
                                {t('edit_sync')}
                            </button>
                            <button
                                onClick={() => toggleLock(school)}
                                className={`flex-[1.5] py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${school.isActive ? 'bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white border border-rose-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white border border-emerald-100'}`}
                            >
                                {school.isActive ? `🔒 ${t('suspend')}` : `🔓 ${t('restore')}`}
                            </button>
                            <button
                                onClick={() => deleteSchool(school.id)}
                                className="w-14 h-14 bg-slate-50 border border-slate-100 hover:bg-rose-600 hover:text-white flex items-center justify-center rounded-2xl transition-all hover:scale-105"
                                title={t('terminate_entity')}
                            >
                                🗑️
                            </button>
                        </div>

                        <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-blue-500/5 rounded-full scale-0 group-hover:scale-100 transition-transform duration-700 pointer-events-none"></div>
                    </div>
                ))}
            </div>

            {showAddSchool && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-xl animate-in fade-in duration-300">
                    <div className="bg-white rounded-[3.5rem] shadow-2xl w-full max-w-[580px] overflow-hidden animate-in zoom-in-95 duration-500 border border-white/20">
                        <div className="bg-slate-900 p-12 text-white">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-3xl font-black tracking-tight uppercase">{editingSchool ? t('override_sync') : t('system_provisioning')}</h3>
                                <button type="button" onClick={() => { setShowAddSchool(false); setEditingSchool(null) }} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">✕</button>
                            </div>
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] leading-relaxed">{t('cross_registry_sync_desc')}</p>
                        </div>

                        <form onSubmit={handleAddSchool} className="p-12 space-y-6">
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block ml-1 tracking-[0.2em]">{t('institutional_identity')} *</label>
                                <input required type="text" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-5 font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all" placeholder="e.g. Al-Shafi Regional College" value={schoolForm.name} onChange={e => setSchoolForm({ ...schoolForm, name: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block ml-1 tracking-[0.2em]">{t('registry_code')}</label>
                                    <input type="text" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-5 font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all uppercase" placeholder="e.g. SRC-01" value={schoolForm.shortCode} onChange={e => setSchoolForm({ ...schoolForm, shortCode: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block ml-1 tracking-[0.2em]">{t('gateway_contact')}</label>
                                    <input type="text" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-5 font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all" placeholder="+252..." value={schoolForm.phone} onChange={e => setSchoolForm({ ...schoolForm, phone: e.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block ml-1 tracking-[0.2em]">{t('system_comms_endpoint')}</label>
                                <input type="email" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-5 font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all" placeholder="admin@institute.edu" value={schoolForm.email} onChange={e => setSchoolForm({ ...schoolForm, email: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block ml-1 tracking-[0.2em]">{t('geo_location_radius')}</label>
                                <input type="text" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-5 font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all" placeholder="Region, City, District" value={schoolForm.address} onChange={e => setSchoolForm({ ...schoolForm, address: e.target.value })} />
                            </div>

                            <div className="pt-8 flex gap-4">
                                <button type="button" onClick={() => { setShowAddSchool(false); setEditingSchool(null) }} className="flex-1 bg-slate-50 text-slate-400 font-black py-5 rounded-[2rem] uppercase text-[10px] tracking-widest hover:bg-slate-100 transition-all border border-slate-100">Cancel</button>
                                <button type="submit" disabled={saving} className="flex-[2] bg-slate-900 text-white font-black py-5 rounded-[2rem] shadow-2xl shadow-slate-900/20 hover:bg-black transition-all uppercase text-[10px] tracking-widest active:scale-95">
                                    {saving ? 'Syncing...' : (editingSchool ? 'Confirm Sync' : 'Initialize Node')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        
      {/* Announcements Widget */}
      {!loading && announcements.length > 0 && (
        <div className="mb-8 bg-gradient-to-r from-emerald-600 to-teal-700 rounded-[2.5rem] p-8 shadow-xl shadow-emerald-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl group-hover:scale-110 transition-all duration-700"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-xl">📢</div>
                <div>
                  <h3 className="text-white font-black uppercase tracking-widest text-sm">Announcements</h3>
                  <p className="text-emerald-100 text-[10px] font-bold uppercase tracking-tight">Farriimaha Maamulka</p>
                </div>
              </div>
              <Link href="/owner/announcements">
                <span className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer backdrop-blur-sm">
                  View All →
                </span>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {announcements.map(a => (
                <div key={a.id} className="bg-white/10 backdrop-blur-md border border-white/10 p-5 rounded-2xl hover:bg-white/20 transition-all cursor-default group/item">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${a.priority === 'urgent' ? 'bg-red-400 animate-pulse' : a.priority === 'high' ? 'bg-amber-400' : 'bg-emerald-300'}`}></span>
                    <span className="text-[9px] font-black text-emerald-100 uppercase tracking-widest">
                      {new Date(a.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="text-white font-bold text-sm line-clamp-1 group-hover/item:text-emerald-200 transition-colors">{a.title}</h4>
                  <p className="text-emerald-100/70 text-xs mt-1 line-clamp-2 leading-relaxed">{a.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </Layout>
    )
}
