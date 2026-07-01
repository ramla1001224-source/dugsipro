import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import ProfileSettings from '../components/settings/ProfileSettings'
import SystemSettings from '../components/settings/SystemSettings'
import FeesSettings from '../components/settings/FeesSettings'
import AcademicYearSettings from '../components/settings/AcademicYearSettings'
import CommunicationSettings from '../components/settings/CommunicationSettings'
import FinanceSettings from '../components/settings/FinanceSettings'
import RoleSettings from '../components/settings/RoleSettings'
import BackupSettings from '../components/settings/BackupSettings'
import MaintenanceSettings from '../components/settings/MaintenanceSettings'

export default function SettingsHub() {
    // Determine default tab from localStorage or default to 'profile'
    const [activeTab, setActiveTab] = useState('profile')
    const [role, setRole] = useState('')

    useEffect(() => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
        if (token) {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]))
                setRole(payload.role)
            } catch (e) { console.error('Error parsing token in Settings', e) }
        }

        const savedTab = typeof window !== 'undefined' ? localStorage.getItem('settingsTab') : ''
        if (savedTab) {
            setActiveTab(savedTab)
        }
    }, [])

    const handleTabChange = (tabId) => {
        setActiveTab(tabId)
        localStorage.setItem('settingsTab', tabId)
    }

    const tabs = [
        { id: 'profile', label: 'Profile', icon: '👤', roles: ['admin', 'owner', 'teacher', 'student', 'parent', 'staff', 'accountant', 'super_admin'] },
        { id: 'system', label: 'System Config', icon: '⚙️', roles: ['admin', 'owner', 'super_admin'] },
        { id: 'academic', label: 'Academic Year', icon: '📅', roles: ['admin', 'owner', 'super_admin'] },
        { id: 'comm', label: 'Communication', icon: '💬', roles: ['admin', 'owner', 'super_admin'] },
        { id: 'finance', label: 'Finance Config', icon: '💸', roles: ['admin', 'owner', 'accountant', 'super_admin'] },
        { id: 'roles', label: 'Permissions', icon: '🛡️', roles: ['admin', 'owner', 'super_admin'] },
        { id: 'backup', label: 'Data Backup', icon: '📥', roles: ['owner', 'super_admin'] },
        { id: 'maintenance', label: 'Data Cleanup', icon: '🧹', roles: ['admin', 'owner', 'super_admin'] },
        { id: 'fees', label: 'Fees Structure', icon: '💰', roles: ['admin', 'owner', 'accountant', 'super_admin'] },
    ]

    // Only show tabs current role is permitted to see
    const visibleTabs = tabs.filter(t => t.roles.includes(role || 'admin')) // Fallback to admin if role not loaded yet

    return (
        <Layout title="Configurations & Settings">
            <div className="flex flex-col md:flex-row gap-8 max-w-7xl mx-auto h-[calc(100vh-100px)] overflow-hidden">
                {/* Sidebar Menu */}
                <div className="w-full md:w-64 bg-white rounded-[2rem] border border-gray-100 shadow-sm p-6 flex flex-col h-full flex-shrink-0">
                    <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] mb-6 px-4">Configuration Hub</h3>
                    <nav className="flex-1 space-y-2 overflow-y-auto pr-2 custom-scrollbar">
                        {visibleTabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => handleTabChange(tab.id)}
                                className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all font-bold text-sm outline-none
                                    ${activeTab === tab.id
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-100'
                                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                                    }`}
                            >
                                <span className={`text-xl ${activeTab === tab.id ? 'opacity-100 drop-shadow-md' : 'opacity-70 group-hover:opacity-100'}`}>{tab.icon}</span>
                                <span className="tracking-wide">{tab.label}</span>
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Content Area */}
                <div className="flex-1 bg-gray-50/50 rounded-[2.5rem] overflow-y-auto custom-scrollbar md:pr-4 pb-12">
                    <div className="animate-in fade-in zoom-in-95 duration-300">
                        { activeTab === 'maintenance' && <MaintenanceSettings /> }
                        {activeTab === 'profile' && <ProfileSettings />}
                        {activeTab === 'system' && <SystemSettings />}
                        {activeTab === 'academic' && <AcademicYearSettings />}
                        {activeTab === 'comm' && <CommunicationSettings />}
                        {activeTab === 'finance' && <FinanceSettings />}
                        {activeTab === 'roles' && <RoleSettings />}
                        {activeTab === 'backup' && <BackupSettings />}
                        {activeTab === 'fees' && <FeesSettings />}
                    </div>
                </div>
            </div>
        </Layout>
    )
}
