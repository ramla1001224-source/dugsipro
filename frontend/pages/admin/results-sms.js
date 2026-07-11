import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import axios from 'axios'

export default function ResultsSMS() {
    const { t } = useLanguage()
    const [exams, setExams] = useState([])
    const [academicYears, setAcademicYears] = useState([])
    const [selectedTerm, setSelectedTerm] = useState('')
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState({})
    const [isSendingAll, setIsSendingAll] = useState(false)
    const [smsType, setSmsType] = useState('term') // 'term', 'final_100', 'final_midterm'
    const [includeSchoolName, setIncludeSchoolName] = useState(false)
    const [expandedClassId, setExpandedClassId] = useState(null)
    const [classStudents, setClassStudents] = useState({}) 
    const [previewLoading, setPreviewLoading] = useState({})
    const [excludedStudentIds, setExcludedStudentIds] = useState(new Set())
    const [smsStatus, setSmsStatus] = useState({})
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        try {
            const [e, y] = await Promise.all([
                axios.get(`${apiUrl}/api/exams`, { headers: headers() }).catch(() => ({ data: [] })),
                axios.get(`${apiUrl}/api/academic-years`, { headers: headers() }).catch(() => ({ data: [] }))
            ])
            setExams(Array.isArray(e.data) ? e.data : (e.data.data || []))
            setAcademicYears(Array.isArray(y.data) ? y.data : (y.data.data || []))
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const fetchSmsStatus = async () => {
        try {
            let academicYearId = null;
            if (selectedTerm?.startsWith('YEAR_')) {
                academicYearId = selectedTerm.replace('YEAR_', '');
            } else {
                for (const year of academicYears) {
                    if (year.Terms?.some(t => t.id === selectedTerm)) {
                        academicYearId = year.id;
                        break;
                    }
                }
            }
            const res = await axios.get(`${apiUrl}/api/exams/bulk-sms-status`, { 
                params: { termId: selectedTerm, academicYearId, smsType },
                headers: headers() 
            });
            setSmsStatus(res.data);
        } catch (err) {
            console.error('Error fetching SMS status:', err);
        }
    }

    useEffect(() => {
        if ((selectedTerm || smsType !== 'term') && academicYears.length > 0) {
            fetchSmsStatus();
        }
    }, [selectedTerm, smsType, academicYears]);

    const handleToggleStudents = async (group) => {
        if (expandedClassId === group.classId) {
            setExpandedClassId(null);
            return;
        }
        
        setExpandedClassId(group.classId);
        if (!classStudents[group.classId]) {
            setPreviewLoading(prev => ({ ...prev, [group.classId]: true }));
            try {
                let academicYearId = null;
                if (selectedTerm?.startsWith('YEAR_')) {
                    academicYearId = selectedTerm.replace('YEAR_', '');
                } else {
                    for (const year of academicYears) {
                        if (year.Terms?.some(t => t.id === selectedTerm)) {
                            academicYearId = year.id;
                            break;
                        }
                    }
                }
                
                const examIds = group.exams.map(e => e.id);
                const res = await axios.post(`${apiUrl}/api/exams/send-bulk-sms`, { 
                    examIds, 
                    smsType, 
                    academicYearId,
                    previewOnly: true
                }, { headers: headers() });
                
                setClassStudents(prev => ({ ...prev, [group.classId]: res.data.students || [] }));
            } catch (err) {
                console.error("Preview fetch error", err);
            } finally {
                setPreviewLoading(prev => ({ ...prev, [group.classId]: false }));
            }
        }
    }
    
    const handleToggleStudentExclude = (studentId) => {
        setExcludedStudentIds(prev => {
            const next = new Set(prev);
            if (next.has(studentId)) next.delete(studentId);
            else next.add(studentId);
            return next;
        });
    }

    const handleSendBulkSMS = async (group, skipConfirm = false, skipAlert = false) => {
        if (!group.allPublished) {
            if (!skipAlert) alert(`Waa in la daabacaa (Publish) dhammaan maaddooyinka fasalkan kahor intaan la dirin Natiijada fasalka ${group.className}!`);
            return false;
        }
        
        let academicYearId = null;
        if (selectedTerm?.startsWith('YEAR_')) {
            academicYearId = selectedTerm.replace('YEAR_', '');
        } else {
            for (const year of academicYears) {
                if (year.Terms?.some(t => t.id === selectedTerm)) {
                    academicYearId = year.id;
                    break;
                }
            }
        }

        if (!skipConfirm) {
            const termLabel = academicYears.flatMap(y => y.Terms || []).find(t => t.id === selectedTerm)?.name || 'Term';
            const confirmMsg = smsType === 'final_100'
                ? `Ma hubtaa inaad rabto in SMS loo diro waalidiinta fasalka "${group.className}" iyadoo la isku darayo NATIIJADA SANNADKA OO DHAN (Final 100%)?`
                : smsType === 'final_midterm'
                ? `Ma hubtaa inaad rabto in SMS loo diro waalidiinta fasalka "${group.className}" iyadoo la isku darayo (Term + Midterm)?`
                : `Ma hubtaa inaad rabto in SMS wadar ah (Bulk) loo diro waalidiinta fasalka "${group.className}" ee imtixaanka "${termLabel}"?`;

            if (!confirm(confirmMsg)) return false;
        }
        
        setSending(prev => ({ ...prev, [group.classId]: true }))
        try {
            const examIds = group.exams.map(e => e.id);
            const res = await axios.post(`${apiUrl}/api/exams/send-bulk-sms`, { 
                examIds, 
                smsType, 
                academicYearId,
                includeSchoolName,
                excludedStudentIds: Array.from(excludedStudentIds)
            }, { headers: headers() });
            if (!skipAlert) alert(res.data.message || 'SMS dirista wadar ahaaneed waa la dhameeyay');
            await fetchSmsStatus();
            return true;
        } catch (err) {
            if (!skipAlert) alert(err.response?.data?.message || 'Cillad ayaa ku timid diridda SMS-ka');
            return false;
        } finally {
            setSending(prev => ({ ...prev, [group.classId]: false }))
        }
    }

    const handleSendAllBulkSMS = async () => {
        const readyGroups = classCards.filter(g => g.allPublished);
        if (readyGroups.length === 0) {
            alert('Fasal diyaar ah oo la wada daabacay (Published) lama helin. Fadlan daabac fasallada intaanad dirin.');
            return;
        }

        const confirmMsg = `Ma hubtaa inaad rabto in SMS loo wada diro DHAMMAAN FASALADA diyaar ah (${readyGroups.length} fasal)?
Fasallada aan la wada daabicin (Qabyada ah) waa la iska dhaafi doonaa.
Fasalba fasalka xiga ayuu ku xigsan doonaa dirista automatically.`;

        if (!confirm(confirmMsg)) return;

        setIsSendingAll(true);
        let successCount = 0;
        
        for (const group of readyGroups) {
            const success = await handleSendBulkSMS(group, true, true);
            if (success) {
                successCount++;
                // Wait briefly between class requests
                await new Promise(res => setTimeout(res, 500));
            }
        }
        
        alert(`Dirista Dhammaan Fasalada waa la dhammeeyay. La guulaystay ${successCount}/${readyGroups.length} fasal. Status-kooda hoos ka eeg.`);
        setIsSendingAll(false);
    }

    const filteredExams = smsType === 'final_100'
        ? exams.filter(ex => {
            if (selectedTerm?.startsWith('YEAR_')) return ex.term?.academicYearId === selectedTerm.replace('YEAR_', '');
            const yearIdOfTerm = academicYears.find(y => y.Terms?.some(t => t.id === selectedTerm))?.id;
            return ex.term?.academicYearId === yearIdOfTerm;
        })
        : (selectedTerm ? exams.filter(ex => ex.termId === selectedTerm) : []);

    const classGroups = {};
    filteredExams.forEach(ex => {
        const classId = ex.classId || 'unassigned';
        if (!classGroups[classId]) {
            classGroups[classId] = {
                classId: classId,
                className: ex.class?.class_name || 'Aan la geyn Fasal',
                exams: [],
                allPublished: true,
                draftExams: []
            };
        }
        classGroups[classId].exams.push(ex);
        if (ex.status === 'draft') {
            classGroups[classId].allPublished = false;
            classGroups[classId].draftExams.push(ex.subject?.name || ex.name);
        }
    });

    const classCards = Object.values(classGroups).sort((a,b) => a.className.localeCompare(b.className));

    return (
        <Layout title={t('email_sms')}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <button 
                            onClick={() => window.location.href = '/admin/exams'}
                            className="text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1 font-bold text-xs uppercase tracking-widest"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            Hub
                        </button>
                        <span className="text-slate-300">/</span>
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">SMS</span>
                    </div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">Karnayga / SMS</h2>
                    <p className="text-gray-400 text-sm mt-1">U dir Natiijada Term-ka midaysan (Report Card SMS) Waalidiinta fasal walba</p>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
                    <label className="flex items-center gap-3 text-sm font-bold text-slate-700 bg-white p-4 rounded-2xl border-2 border-slate-100 shadow-sm cursor-pointer hover:border-indigo-500 transition-all">
                        <input 
                            type="checkbox" 
                            className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                            checked={includeSchoolName}
                            onChange={e => setIncludeSchoolName(e.target.checked)}
                        />
                        Ku dar Magaca Schoolka
                    </label>
                    <select
                        className="w-full md:w-auto p-4 rounded-2xl border-2 border-slate-100 bg-white font-bold text-slate-700 focus:border-indigo-500 outline-none transition-all shadow-sm"
                        value={smsType}
                        onChange={e => setSmsType(e.target.value)}
                    >
                        <option value="term">Term Result (Keliya)</option>
                        <option value="final_100">Final Result (100% Sannadka)</option>
                        <option value="final_midterm">Final Result (Term + Midterm)</option>
                    </select>

                    <select
                        className="w-full md:w-80 p-4 rounded-2xl border-2 border-slate-100 bg-white font-bold text-slate-700 focus:border-indigo-500 outline-none transition-all shadow-sm"
                        value={selectedTerm}
                        onChange={e => setSelectedTerm(e.target.value)}
                    >
                        <option value="">{smsType === 'final_100' ? 'Select Year context' : 'Dooro Time-ka aad rabto (Select Term)'}</option>
                        {academicYears.filter(year => year.isCurrent).map(year => (
                            <optgroup key={year.id} label={`${year.name} (Hadda)`}>
                                {smsType === 'final_100' && <option value={`YEAR_${year.id}`}>Dhammaad: {year.name} (All Terms)</option>}
                                {(year.Terms || []).map(term => (
                                    <option key={term.id} value={term.id}>
                                        {term.name} ({year.name})
                                    </option>
                                ))}
                            </optgroup>
                        ))}
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center p-32">
                    <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : !selectedTerm ? (
                <div className="flex flex-col items-center justify-center p-32 text-center bg-white rounded-[4rem] border-4 border-dashed border-slate-100">
                    <div className="w-24 h-24 rounded-full bg-slate-50 flex items-center justify-center text-5xl mb-6">📅</div>
                    <h3 className="text-2xl font-black text-slate-800 mb-2">Dooro Term si aad u aragto Fasalada</h3>
                    <p className="text-slate-400 max-w-sm mx-auto font-bold uppercase text-xs tracking-widest">Waa inaad soo xulataa term-ka (Sida Term 1, Term 2) ka hor inta aadan dirin.</p>
                </div>
            ) : classCards.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-32 text-center bg-white rounded-[4rem] border-4 border-dashed border-slate-100">
                    <div className="w-24 h-24 rounded-full bg-slate-50 flex items-center justify-center text-5xl mb-6">🔍</div>
                    <h3 className="text-2xl font-black text-slate-800 mb-2">Exams Lama Helin</h3>
                    <p className="text-slate-400 max-w-sm mx-auto font-bold uppercase text-xs tracking-widest">Lama hayo imtixaanno ku jira term-kan ama qaybtan la xushay.</p>
                </div>
            ) : (
                <>
                    <div className="flex justify-end mb-6">
                        <button
                            onClick={handleSendAllBulkSMS}
                            disabled={isSendingAll || classCards.filter(g => g.allPublished).length === 0}
                            className={`px-8 py-4 rounded-2xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-xl ${
                                isSendingAll 
                                    ? 'bg-slate-200 text-slate-500 cursor-not-allowed' 
                                    : classCards.filter(g => g.allPublished).length > 0 
                                        ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:-translate-y-1 hover:shadow-indigo-200' 
                                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            }`}
                        >
                            {isSendingAll ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div>
                                    <span>Waa Socotaa...</span>
                                </>
                            ) : (
                                <>
                                    <span>DIR DHAMMAAN FASALADA</span>
                                    <span className="text-xl">🚀</span>
                                </>
                            )}
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {classCards.map(group => (
                        <div key={group.classId} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-xl transition-all group overflow-hidden relative">
                            <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-5 group-hover:scale-150 transition-transform ${group.allPublished ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                            
                            <div className="flex justify-between items-start mb-6">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-inner ${group.allPublished ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                    {group.allPublished ? '✅' : '⏳'}
                                </div>
                                <span className={`text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest ${group.allPublished ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                    {group.allPublished ? 'READY' : 'INCOMPLETE'}
                                </span>
                            </div>

                            <div className="flex items-center gap-2 mb-4">
                                <div className={`w-2 h-2 rounded-full ${
                                    (smsStatus[group.classId]?.sentCount || 0) === 0 ? 'bg-slate-300' :
                                    (smsStatus[group.classId]?.sentCount || 0) >= (smsStatus[group.classId]?.totalCount || 0) ? 'bg-emerald-500' : 'bg-amber-500'
                                }`}></div>
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                                    {(smsStatus[group.classId]?.sentCount || 0) === 0 ? 'SMS NOT SENT' :
                                     (smsStatus[group.classId]?.sentCount || 0) >= (smsStatus[group.classId]?.totalCount || 0) ? 'SMS COMPLETED' : 
                                     `SMS PARTIAL (${smsStatus[group.classId]?.sentCount}/${smsStatus[group.classId]?.totalCount})`
                                    }
                                </span>
                            </div>

                            <h3 className="text-xl font-black text-slate-800 mb-2 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">
                                FASALKA: {group.className}
                            </h3>
                            <div className="space-y-2 mb-6">
                                <div className="flex items-center gap-2 text-slate-400">
                                    <span className="text-xs uppercase font-bold tracking-widest">Maadooyinka/Exams:</span>
                                    <span className="text-xs font-black text-slate-600">{group.exams.length} </span>
                                </div>
                                {!group.allPublished && (
                                    <div className="mt-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                                        <p className="text-[10px] text-red-600 font-bold uppercase tracking-wide mb-1">Qabyo (Aan La Publish-garayn):</p>
                                        <p className="text-[11px] font-medium text-red-500">{group.draftExams.join(', ')}</p>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => handleToggleStudents(group)}
                                className="w-full mb-3 py-2 rounded-xl border-2 border-slate-100 font-bold text-xs uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-between px-4"
                            >
                                <span>{expandedClassId === group.classId ? 'Qari Ardayda' : 'Eeg Ardayda'}</span>
                                <span>{expandedClassId === group.classId ? '▲' : '▼'}</span>
                            </button>

                            {expandedClassId === group.classId && (
                                <div className="mb-4 bg-slate-50 rounded-xl p-3 max-h-60 overflow-y-auto border border-slate-100">
                                    {previewLoading[group.classId] ? (
                                        <div className="flex justify-center p-4">
                                            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                    ) : (classStudents[group.classId] || []).length === 0 ? (
                                        <p className="text-center text-xs text-slate-400 font-bold py-2">Arday lama helin</p>
                                    ) : (
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center mb-2 px-1 border-b border-slate-100 pb-2">
                                                <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Magaca Ardayga</span>
                                                <div className="flex items-center gap-2">
                                                    <button 
                                                        onClick={() => {
                                                            setExcludedStudentIds(prev => {
                                                                const next = new Set(prev);
                                                                const groupStudents = (classStudents[group.classId] || []).filter(st => st.hasPhone);
                                                                // Uncheck all (add to excluded)
                                                                groupStudents.forEach(st => next.add(st.id));
                                                                return next;
                                                            });
                                                        }}
                                                        className="text-[9px] font-black uppercase text-red-500 hover:text-red-700 bg-red-50 px-2 py-1 rounded transition-colors tracking-widest"
                                                        title="Tick-ga ka qaad dhammaan"
                                                    >
                                                        Qaad Dhammaan
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            setExcludedStudentIds(prev => {
                                                                const next = new Set(prev);
                                                                const groupStudents = (classStudents[group.classId] || []).filter(st => st.hasPhone);
                                                                // Check all (remove from excluded)
                                                                groupStudents.forEach(st => next.delete(st.id));
                                                                return next;
                                                            });
                                                        }}
                                                        className="text-[9px] font-black uppercase text-emerald-600 hover:text-emerald-800 bg-emerald-50 px-2 py-1 rounded transition-colors tracking-widest"
                                                        title="Tick-ga saar dhammaan"
                                                    >
                                                        Saar Dhammaan
                                                    </button>
                                                </div>
                                            </div>
                                            {(classStudents[group.classId] || []).map(st => (
                                                <label key={st.id} className="flex justify-between items-center bg-white p-2 rounded-lg shadow-sm border border-slate-100 cursor-pointer hover:border-indigo-300">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full ${st.hasPhone ? 'bg-emerald-500' : 'bg-red-500'}`} title={st.hasPhone ? 'Wuxuu leeyahay Number' : 'Number ma leh'}></div>
                                                        <span className="text-xs font-bold text-slate-700 truncate w-32" title={st.name}>{st.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {st.isAlreadySent && <span className="text-[8px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded font-bold uppercase">La diray</span>}
                                                        <input 
                                                            type="checkbox" 
                                                            className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                                                            checked={!excludedStudentIds.has(st.id)}
                                                            onChange={() => handleToggleStudentExclude(st.id)}
                                                            disabled={!st.hasPhone}
                                                        />
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            <button
                                onClick={() => handleSendBulkSMS(group)}
                                disabled={sending[group.classId] || !group.allPublished}
                                className={`w-full py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-3 shadow-lg ${sending[group.classId] ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : (group.allPublished ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200 hover:-translate-y-1' : 'bg-slate-50 text-slate-300 cursor-not-allowed')}`}
                            >
                                {sending[group.classId] ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                                        <span>Dirista...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>
                                            {(smsStatus[group.classId]?.sentCount || 0) > 0 && (smsStatus[group.classId]?.sentCount || 0) < (smsStatus[group.classId]?.totalCount || 0)
                                                ? 'Dir Inta ku dhiman (Send Remaining)'
                                                : (smsStatus[group.classId]?.sentCount || 0) >= (smsStatus[group.classId]?.totalCount || 0)
                                                    ? 'Waa la wada diray (All Sent)'
                                                    : 'Dir Natiijada Wadar-ahaan(SMS)'
                                            }
                                        </span>
                                        <span className="text-lg">📩</span>
                                    </>
                                )}
                            </button>
                            {(smsStatus[group.classId]?.sentCount || 0) >= (smsStatus[group.classId]?.totalCount || 1) && group.allPublished && (
                                <p className="text-[9px] text-emerald-600 font-black mt-3 text-center uppercase tracking-widest italic">✓ DHAMMAAN WAALIDKA WAA LOO DIRAY!</p>
                            )}
                            {!group.allPublished && (
                                <p className="text-[9px] text-red-600 font-black mt-3 text-center uppercase tracking-widest">⚠️ Ma diri kartid, dhammaystir imtixaanaadka ku qoran "Qabyo"!</p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </Layout>
    )
}
