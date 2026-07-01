import { useEffect, useState } from 'react'
import axios from 'axios'

export default function RoleSettings() {
    const [settings, setSettings] = useState({})
    const [saving, setSaving] = useState(false)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    useEffect(() => {
        axios.get(`${apiUrl}/api/settings`, { headers: headers() })
            .then(res => setSettings(res.data))
            .catch(e => console.error(e))
    }, [])

    const saveSettings = async () => {
        setSaving(true)
        try {
            await axios.put(`${apiUrl}/api/settings`, settings, { headers: headers() })
            alert('Permissions updated successfully!')
        } catch (e) { alert('Error saving permissions') }
        finally { setSaving(false) }
    }

    const roles = [
        {
            name: 'Accountant',
            icon: '💳',
            permissions: [
                { key: 'perm_acc_delete_payment', label: 'Can Delete Payments', desc: 'Allow accountant to remove payment records' },
                { key: 'perm_acc_edit_fees', label: 'Can Edit Fee Structures', desc: 'Allow changing class monthly fees' },
                { key: 'perm_acc_view_salary', label: 'Can Manage Payroll', desc: 'Full access to staff salary records' }
            ]
        },
        {
            name: 'Teacher',
            icon: '👨‍🏫',
            permissions: [
                { key: 'perm_tea_edit_attendance', label: 'Can Edit Past Attendance', desc: 'Allow modifying attendance after 24 hours' },
                { key: 'perm_tea_view_parent_contact', label: 'View Parent Phone', desc: 'Show parent contact details to teachers' },
                { key: 'perm_tea_manage_exams', label: 'Can Create & Lock Exams', desc: 'Full control over examination schedules' }
            ]
        }
    ]

    const togglePermission = (key) => {
        const val = settings[key] === 'true' ? 'false' : 'true'
        setSettings({ ...settings, [key]: val })
    }

    return (
        <div className="max-w-5xl mx-auto pb-20">
            <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">Roles & Permissions</h2>
                    <p className="text-gray-400 font-medium uppercase tracking-widest text-[10px] mt-1">Control access levels for school staff</p>
                </div>
                <button
                    onClick={saveSettings}
                    disabled={saving}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all disabled:opacity-50"
                >
                    {saving ? 'Saving...' : 'Update Permissions'}
                </button>
            </div>

            <div className="space-y-10">
                {roles.map((role, i) => (
                    <div key={i} className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-8 bg-slate-50/50 border-b border-gray-100 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-2xl">
                                {role.icon}
                            </div>
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">{role.name} Permissions</h3>
                        </div>

                        <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {role.permissions.map(p => {
                                const isActive = settings[p.key] === 'true'
                                return (
                                    <button
                                        key={p.key}
                                        onClick={() => togglePermission(p.key)}
                                        className={`p-6 rounded-[2rem] border-2 text-left transition-all relative overflow-hidden group ${isActive ? 'border-indigo-600 bg-indigo-50/30' : 'border-gray-100 bg-white hover:border-indigo-100'}`}
                                    >
                                        <div className={`w-10 h-10 rounded-xl mb-4 flex items-center justify-center transition-all ${isActive ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400 group-hover:bg-indigo-50'}`}>
                                            {isActive ? '✓' : '○'}
                                        </div>
                                        <h4 className={`font-black uppercase text-xs mb-1 ${isActive ? 'text-indigo-900' : 'text-slate-700'}`}>{p.label}</h4>
                                        <p className="text-[10px] text-gray-400 font-medium leading-relaxed">{p.desc}</p>

                                        {isActive && (
                                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                                <div className="w-12 h-12 rounded-full bg-indigo-600"></div>
                                            </div>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-8 p-8 rounded-[2.5rem] bg-indigo-50/50 border border-indigo-100 flex items-start gap-4">
                <div className="text-2xl">🛡️</div>
                <div>
                    <h4 className="text-sm font-black text-indigo-900 uppercase tracking-tight mb-1">Security Enforcement</h4>
                    <p className="text-xs text-indigo-700 font-medium leading-relaxed">
                        Administrators and Owners always have full permissions across all modules. These toggles specifically restrict or grant additional capabilities to staff roles to ensure data integrity and privacy.
                    </p>
                </div>
            </div>
        </div>
    )
}
