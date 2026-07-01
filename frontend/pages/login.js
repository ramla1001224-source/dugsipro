import { useState, useEffect } from 'react'
import axios from 'axios'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useLanguage } from '../context/LanguageContext'
import { getErrorMessage } from '../utils/errorHelper'
import { getImageUrl } from '../utils/imageHelper'

export default function Login() {
    const router = useRouter()
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [schoolData, setSchoolData] = useState(null)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const { t } = useLanguage()

    useEffect(() => {
        if (router.isReady) {
            const code = router.query.school
            const sId = router.query.schoolId
            if (code) {
                fetchSchool(code, sId)
            } else {
                const saved = typeof window !== 'undefined' ? localStorage.getItem('selectedSchool') : ''
                if (saved) setSchoolData(JSON.parse(saved))
            }
        }
    }, [router.isReady, router.query.school, router.query.schoolId])

    const fetchSchool = async (code, sId = null) => {
        try {
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
            const res = await axios.get(`${baseUrl}/api/schools/by-code/${code.toUpperCase()}`)

            let data = res.data;
            // If we have multiple schools but a specific sId requested, narrow it down
            if (data.type === 'super_admin' && sId && data.schools) {
                const specific = data.schools.find(s => s.id === sId);
                if (specific) data = { ...data, ...specific, type: 'school' };
            }

            setSchoolData(data)
            localStorage.setItem('selectedSchool', JSON.stringify(data))
        } catch (e) {
            console.warn('School lookup failed')
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError('')
        try {
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
            const res = await axios.post(baseUrl + '/api/auth/login', {
                username,
                password,
                schoolCode: schoolData?.shortCode || router.query.school,
                schoolId: schoolData?.type === 'school' ? (schoolData?.id || router.query.schoolId) : null
            })
            const { token, role, school } = res.data
            // Clear ALL stale session data to prevent role bleed between logins
            localStorage.removeItem('originalSuperAdminToken')
            localStorage.removeItem('originalOwnerToken')
            localStorage.removeItem('schoolId')
            localStorage.removeItem('schoolInfo')
            localStorage.removeItem('selectedSchool')
            // Store new session
            localStorage.setItem('token', token)
            localStorage.setItem('role', role)
            if (school?.id) localStorage.setItem('schoolId', school.id)

            const dashboards = {
                owner: '/owner/dashboard',
                super_admin: '/super-admin/dashboard',
                admin: '/admin/dashboard',
                teacher: '/teacher/dashboard',
                parent: '/parent/dashboard',
                accountant: '/accountant/dashboard',
                staff: '/staff/dashboard',
                librarian: '/librarian/dashboard',
                student: '/student/dashboard'
            }
            window.location.href = dashboards[role] || '/student/dashboard'
        } catch (err) {
            setError(getErrorMessage(err, t))
        } finally { setLoading(false) }
    }

    return (
        <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 font-sans relative overflow-hidden">
            <Head>
                <title>{schoolData ? `${schoolData.name} | ${t('login')}` : t('portal_title')}</title>
            </Head>

            {/* Modern Background */}
            <div className="absolute top-0 left-0 w-full h-full">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full"></div>
            </div>

            <div className="w-full max-w-[440px] relative z-10">
                <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/10 transition-all">

                    <div className="p-10 text-center pb-6">
                        <div className="mb-8 flex justify-center">
                            {schoolData?.logo ? (
                                <div className="w-40 h-40 bg-slate-50 rounded-[2.5rem] p-6 shadow-sm border border-slate-100 flex items-center justify-center transition-transform hover:scale-105 duration-500">
                                    <img src={getImageUrl(schoolData.logo)} alt="Logo" className="max-w-full max-h-full object-contain" />
                                </div>
                            ) : (
                                <div className="w-40 h-40 flex items-center justify-center p-4 transition-transform hover:scale-105 duration-500">
                                    <img src="/logo.svg" alt="Dugsi Pro System" className="max-w-full max-h-full object-contain filter drop-shadow-2xl" />
                                </div>
                            )}
                        </div>

                        <h1 className="text-2xl font-black text-slate-800 tracking-tight leading-tight">
                            {router.query.role === 'owner' ? (
                                <><span className="text-slate-900">{t('system_owner_access')}</span></>
                            ) : schoolData ? (
                                schoolData.name
                            ) : (
                                <><span className="text-slate-900">Dugsi Pro</span> <span className="text-blue-600">System</span></>
                            )}
                        </h1>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em] mt-3">
                            {router.query.role === 'owner' ? (
                                t('central_system_management')
                            ) : schoolData?.type === 'super_admin' ? (
                                t('super_administrative_access')
                            ) : schoolData ? (
                                t('student_staff_portal')
                            ) : (
                                t('access_required')
                            )}
                        </p>
                    </div>

                    {(schoolData?.isActive === false || schoolData?.isActive === null) && router.query.role !== 'owner' ? (
                        <div className="px-10 pb-10 space-y-6 text-center">
                            <div className="bg-rose-50 border border-rose-100 p-8 rounded-[2rem] relative overflow-hidden">
                                <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                                    <svg className="w-10 h-10 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                                    </svg>
                                </div>
                                <h3 className="text-rose-600 text-lg font-black uppercase tracking-widest mb-3">{t('system_locked')}</h3>
                                <p className="text-rose-500/80 text-xs font-bold leading-relaxed mb-6">
                                    {t('system_locked_desc')}
                                </p>
                                <div className="pt-6 border-t border-rose-200/50 bg-rose-100/50 -mx-8 -mb-8 p-6">
                                    <p className="text-rose-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2">{t('contact_management')}</p>
                                    <a href="tel:+2520907525970" className="text-rose-600 font-black text-xl tracking-wider block hover:text-rose-700 transition-colors">
                                        +252 0907525970
                                    </a>
                                </div>
                            </div>
                            <div className="pt-6 flex justify-center">
                                <button
                                    type="button"
                                    onClick={() => {
                                        localStorage.removeItem('selectedSchool')
                                        router.push('/')
                                    }}
                                    className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-all"
                                >
                                    ← {t('login_mode')}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="px-10 pb-10 space-y-6" autoComplete="off">
                            {error && (
                                <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl animate-shake">
                                    <p className="text-rose-600 text-[11px] font-bold text-center uppercase tracking-wider">{error}</p>
                                </div>
                            )}

                            <div className="space-y-4">
                                <div className="relative group">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1 block">{t('username')}</label>
                                    <input
                                        className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl px-5 py-4 text-slate-700 font-bold focus:bg-white focus:border-blue-500 outline-none transition-all placeholder:text-slate-300"
                                        value={username}
                                        onChange={e => setUsername(e.target.value)}
                                        placeholder={t('enter_username')}
                                        autoComplete="username"
                                        autoCapitalize="none"
                                        autoCorrect="off"
                                        spellCheck="false"
                                        required
                                    />
                                </div>

                                <div className="relative group">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1 block">{t('password')}</label>
                                    <input
                                        type="password"
                                        className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl px-5 py-4 text-slate-700 font-bold focus:bg-white focus:border-blue-500 outline-none transition-all placeholder:text-slate-300"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        autoComplete="current-password"
                                        autoCapitalize="none"
                                        autoCorrect="off"
                                        spellCheck="false"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                disabled={loading}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-2xl shadow-xl shadow-blue-100 transition-all transform active:scale-[0.98] disabled:opacity-70 uppercase tracking-widest text-xs"
                            >
                                {loading ? t('authenticating') : t('sign_in_now')}
                            </button>

                            <div className="pt-4 flex items-center justify-between gap-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        localStorage.removeItem('selectedSchool')
                                        router.push('/')
                                    }}
                                    className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 transition-all text-left"
                                >
                                    ← {schoolData ? t('switch_portal') : t('back_to_portal')}
                                </button>
                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                                    v2.0 Premium
                                </span>
                            </div>
                        </form>
                    )}
                </div>

                <p className="text-center mt-8 text-[10px] text-slate-500 font-bold uppercase tracking-[0.4em] opacity-50">
                    {t('designed_for_excellence')}
                </p>
            </div>
        </div>
    )
}
