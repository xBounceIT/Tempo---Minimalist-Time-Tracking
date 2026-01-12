import React, { useState, useEffect } from 'react';
import { GeneralSettings as IGeneralSettings } from '../types';
import { generalSettingsApi } from '../services/api';

interface GeneralSettingsProps {
    settings: IGeneralSettings;
    onUpdate: (updates: Partial<IGeneralSettings>) => void;
}

const GeneralSettings: React.FC<GeneralSettingsProps> = ({ settings, onUpdate }) => {
    const [currency, setCurrency] = useState(settings.currency);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setCurrency(settings.currency);
    }, [settings]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onUpdate({ currency });
        } catch (err) {
            console.error('Failed to save general settings:', err);
            alert('Failed to save settings.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-500">
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                        <i className="fa-solid fa-globe text-indigo-600"></i>
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-slate-800">General Settings</h3>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Global Application Configuration</p>
                    </div>
                </div>

                <div className="max-w-md space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Application Currency</label>
                        <div className="relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                <i className="fa-solid fa-coins"></i>
                            </div>
                            <input
                                type="text"
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-semibold transition-all"
                                placeholder="e.g. USD, EUR, $"
                            />
                        </div>
                        <p className="mt-2 text-xs text-slate-500 italic">This currency symbol will be used globally in reports and user management.</p>
                    </div>

                    <div className="pt-4">
                        <button
                            onClick={handleSave}
                            disabled={isSaving || currency === settings.currency}
                            className={`px-8 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center gap-2 ${isSaving || currency === settings.currency
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                                    : 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700'
                                }`}
                        >
                            {isSaving ? (
                                <i className="fa-solid fa-circle-notch fa-spin"></i>
                            ) : (
                                <i className="fa-solid fa-check"></i>
                            )}
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GeneralSettings;
