import { useEffect, useState, useRef } from 'react'
import axios from 'axios'
import Layout from '../../components/Layout'
import { LoadingOverlay } from '../../components/DashboardSkeleton'
import Head from 'next/head'
import { getImageUrl } from '../../utils/imageHelper'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'

export default function OwnerAds() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [previewImage, setPreviewImage] = useState(null)
    const fileInputRef = useRef(null)

    const [adForm, setAdForm] = useState({
        title: '',
        subtitle: '',
        ctaText: '',
        linkUrl: '',
        imageUrl: '',
        isActive: false,
        useGoogle: true
    })

    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    useEffect(() => {
        fetchAdConfig()
    }, [])

    const fetchAdConfig = async () => {
        setLoading(true)
        try {
            const res = await axios.get(`${API}/api/ads/custom`, { headers: headers() })
            if (res.data) {
                setAdForm(res.data)
                setPreviewImage(res.data.imageUrl)
            }
        } catch (e) {
            console.error('Failed to fetch ad config', e)
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
            await axios.post(`${API}/api/ads/custom`, adForm, { headers: headers() })
            alert('Xayasiiska si guul ah ayaa loo keydiyay (Saved successfully)')
        } catch (e) {
            alert(e.response?.data?.message || 'Khalad ayaa dhacay')
        } finally {
            setSaving(false)
        }
    }

    const handleImageUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return

        setUploading(true)
        const formData = new FormData()
        formData.append('image', file)

        try {
            const res = await axios.post(`${API}/api/ads/upload-image`, formData, {
                headers: { ...headers(), 'Content-Type': 'multipart/form-data' }
            })
            setAdForm({ ...adForm, imageUrl: res.data.imageUrl })
            setPreviewImage(res.data.imageUrl)
        } catch (e) {
            alert('Khalad ayaa dhacay markii sawirka la upload garaynayay')
        } finally {
            setUploading(false)
        }
    }

    const toggleStatus = () => {
        setAdForm({ ...adForm, isActive: !adForm.isActive })
    }

    const handleRemoveCustomAd = async () => {
        if (!confirm('Ma hubtaa inaad rabto inaad masaxdo xayasiiskan?')) return;
        const emptyAd = {
            title: '',
            subtitle: '',
            ctaText: '',
            linkUrl: '',
            imageUrl: '',
            isActive: false,
            useGoogle: true
        };
        setSaving(true);
        try {
            await axios.post(`${API}/api/ads/custom`, emptyAd, { headers: headers() });
            setAdForm(emptyAd);
            setPreviewImage(null);
            alert('Xayasiiska waa la saaray (Removed successfully)');
        } catch (e) {
            alert(e.response?.data?.message || 'Khalad ayaa dhacay');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Layout title="Maamulka Xayasiiska (Ad Management)">
            <Head>
                <title>Ad Management | Dugsi Pro</title>
            </Head>

            {loading && <LoadingOverlay />}

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-12">
                <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Xayasiiska App-ka</h2>
                    <p className="text-slate-500 font-semibold uppercase tracking-[0.2em] text-[10px]">Maamul Google Ads & Xayasiiska Gaarka ah</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Form Section */}
                <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden">
                    <h3 className="font-black text-slate-900 text-2xl tracking-tight leading-tight mb-8">Halkan ka geli Xayasiis Cusub</h3>
                    
                    <form onSubmit={handleSave} className="space-y-6 relative z-10">
                        {/* Toggle Google vs Custom */}
                        <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] flex-1">
                                Nooca Xayasiiska (Ad Type)
                            </label>
                            <select 
                                className="bg-white border-2 border-slate-200 rounded-xl px-4 py-2 font-bold text-slate-700 outline-none focus:border-blue-500"
                                value={adForm.useGoogle ? 'google' : 'custom'}
                                onChange={(e) => setAdForm({ ...adForm, useGoogle: e.target.value === 'google' })}
                            >
                                <option value="google">Google AdMob</option>
                                <option value="custom">Custom Ad (Kagaar ah)</option>
                            </select>
                        </div>

                        {!adForm.useGoogle && (
                            <>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block ml-1 tracking-[0.2em]">Ciwaanka (Title) *</label>
                                    <input required type="text" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-5 font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all" placeholder="Tusaale: Ogeysiis Cusub" value={adForm.title} onChange={e => setAdForm({ ...adForm, title: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block ml-1 tracking-[0.2em]">Faahfaahin (Subtitle)</label>
                                    <input type="text" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-5 font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all" placeholder="Tusaale: Isdiiwaangelintu way furan tahay" value={adForm.subtitle} onChange={e => setAdForm({ ...adForm, subtitle: e.target.value })} />
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block ml-1 tracking-[0.2em]">Button Text</label>
                                        <input type="text" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-5 font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all" placeholder="Tusaale: Guji Halkan" value={adForm.ctaText} onChange={e => setAdForm({ ...adForm, ctaText: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block ml-1 tracking-[0.2em]">Link (URL)</label>
                                        <input type="url" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-5 font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all" placeholder="https://..." value={adForm.linkUrl} onChange={e => setAdForm({ ...adForm, linkUrl: e.target.value })} />
                                    </div>
                                </div>

                                {/* Image Upload */}
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block ml-1 tracking-[0.2em]">Sawirka Xayasiiska</label>
                                    <div className="flex items-center gap-4">
                                        <input 
                                            type="file" 
                                            accept="image/*" 
                                            className="hidden" 
                                            ref={fileInputRef} 
                                            onChange={handleImageUpload} 
                                        />
                                        <button 
                                            type="button" 
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={uploading}
                                            className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 px-6 rounded-xl text-sm transition-colors"
                                        >
                                            {uploading ? 'Uploading...' : 'Dooro Sawir'}
                                        </button>
                                        {adForm.imageUrl && <span className="text-xs font-bold text-emerald-500">Sawir waa la doortay ✓</span>}
                                    </div>
                                </div>
                            </>
                        )}

                        <div className="pt-6 flex gap-4 border-t border-slate-100 mt-6">
                            <button 
                                type="button" 
                                onClick={toggleStatus} 
                                className={`flex-1 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${adForm.isActive ? 'bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white border border-rose-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white border border-emerald-100'}`}
                            >
                                {adForm.isActive ? '🔒 Dami Xayasiiska' : '🔓 Shid Xayasiiska'}
                            </button>
                            <button type="submit" disabled={saving || uploading} className="flex-[1.5] bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl shadow-slate-900/20 hover:bg-black transition-all uppercase text-[10px] tracking-widest active:scale-95">
                                {saving ? 'Keydinayaa...' : 'Keydi Xayasiiska'}
                            </button>
                        </div>
                        {(!adForm.useGoogle && adForm.title) && (
                            <div className="mt-4">
                                <button type="button" onClick={handleRemoveCustomAd} className="w-full text-rose-500 text-xs font-bold underline hover:text-rose-600 text-center">
                                    Masax xayasiiska Custom-ka ah (Remove Custom Ad)
                                </button>
                            </div>
                        )}
                    </form>
                </div>

                {/* Preview Section */}
                <div className="bg-slate-50 p-10 rounded-[3rem] border border-slate-200 flex flex-col justify-center items-center relative overflow-hidden">
                    <h3 className="font-black text-slate-400 text-sm tracking-widest uppercase mb-10 text-center">Tijaabo Muuqaal (Live Preview)</h3>
                    
                    <div className="w-[350px] h-[700px] bg-white rounded-[3rem] border-[12px] border-slate-800 shadow-2xl relative overflow-hidden flex flex-col">
                        <div className="w-full h-24 bg-blue-600 pt-10 px-6">
                            <div className="w-1/2 h-4 bg-white/20 rounded-full mb-2"></div>
                            <div className="w-1/3 h-3 bg-white/20 rounded-full"></div>
                        </div>
                        <div className="flex-1 p-4 bg-slate-50 space-y-4">
                            <div className="w-full h-32 bg-white rounded-2xl border border-slate-100 shadow-sm"></div>
                            <div className="w-full h-24 bg-white rounded-2xl border border-slate-100 shadow-sm"></div>
                            
                            {/* The Ad Preview */}
                            {(adForm.isActive || !adForm.useGoogle) && (
                                <div className="mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    {adForm.useGoogle ? (
                                        <div className="w-full h-16 bg-slate-200 rounded flex items-center justify-center border border-slate-300">
                                            <span className="text-slate-400 font-bold text-xs">Google Banner Ad</span>
                                        </div>
                                    ) : (
                                        <div className="bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 border border-indigo-500/20 rounded-2xl p-4 flex gap-3 shadow-sm">
                                            {previewImage ? (
                                                <img src={getImageUrl(previewImage)} alt="Ad" className="w-12 h-12 rounded-xl object-cover" />
                                            ) : (
                                                <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center">
                                                    <span className="text-indigo-500 text-xs font-bold">Img</span>
                                                </div>
                                            )}
                                            <div className="flex-1">
                                                <div className="inline-block px-1.5 py-0.5 bg-indigo-500/10 rounded text-[6px] font-black text-indigo-500 tracking-widest mb-1">XAYASIIS • AD</div>
                                                <h4 className="text-sm font-black text-slate-800 leading-tight">{adForm.title || 'Title Halkan'}</h4>
                                                <p className="text-[9px] text-slate-500 mt-0.5 leading-tight">{adForm.subtitle || 'Faahfaahin kooban...'}</p>
                                            </div>
                                            {adForm.ctaText && (
                                                <div className="self-center bg-indigo-500 text-white text-[8px] font-black px-3 py-2 rounded-lg">
                                                    {adForm.ctaText}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="w-full h-32 bg-white rounded-2xl border border-slate-100 shadow-sm mt-4"></div>
                        </div>
                        {/* Mobile Home Bar */}
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1/3 h-1 bg-slate-900 rounded-full"></div>
                    </div>
                </div>
            </div>
        </Layout>
    )
}
