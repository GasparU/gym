import React, { useState } from 'react';
import type { UserProfile, MetabolicResult } from '../logic/metabolism';

interface Props {
  profile: UserProfile;
  targets: MetabolicResult;
  onUpdateProfile: (updated: UserProfile) => void;
}

export const UserProfileCard: React.FC<Props> = ({ profile, targets, onUpdateProfile }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<UserProfile>(profile);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile(formData);
    setIsEditing(false);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 mb-6 shadow-lg">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">👤</span>
          <h2 className="text-sm font-bold text-slate-100">Perfil Biométrico & Parámetros Metabólicos</h2>
        </div>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="text-xs px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-brand-400 font-semibold border border-slate-700 transition-colors"
        >
          {isEditing ? 'Cancelar' : '✏️ Modificar Datos'}
        </button>
      </div>

      {isEditing ? (
        <form onSubmit={handleSubmit} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs">
          <div>
            <label className="text-slate-400 block mb-1">Peso (kg)</label>
            <input
              type="number"
              step="0.1"
              value={formData.peso}
              onChange={(e) => setFormData({ ...formData, peso: parseFloat(e.target.value) || 0 })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-semibold focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Talla (cm)</label>
            <input
              type="number"
              value={formData.talla}
              onChange={(e) => setFormData({ ...formData, talla: parseFloat(e.target.value) || 0 })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-semibold focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Edad (años)</label>
            <input
              type="number"
              value={formData.edad}
              onChange={(e) => setFormData({ ...formData, edad: parseInt(e.target.value, 10) || 0 })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-semibold focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Sexo</label>
            <select
              value={formData.sexo}
              onChange={(e) => setFormData({ ...formData, sexo: e.target.value as 'H' | 'M' })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-semibold focus:border-brand-500 focus:outline-none"
            >
              <option value="H">Hombre</option>
              <option value="M">Mujer</option>
            </select>
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Días Gym/Semana</label>
            <input
              type="number"
              min="0"
              max="7"
              value={formData.diasEntrenamiento}
              onChange={(e) => setFormData({ ...formData, diasEntrenamiento: parseInt(e.target.value, 10) || 0 })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-semibold focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full bg-brand-600 hover:bg-brand-500 text-white font-bold py-1.5 px-3 rounded transition-colors text-xs shadow-md shadow-brand-900/40"
            >
              Guardar Cambios
            </button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs">
          <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Peso Actual</span>
            <span className="text-base font-bold text-slate-100">{profile.peso} kg</span>
          </div>

          <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Estatura / Edad</span>
            <span className="text-base font-bold text-slate-100">{profile.talla} cm / {profile.edad} a</span>
          </div>

          <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[11px]">IMC Real</span>
            <span className="text-base font-bold text-amber-400">{targets.imc}</span>
            <span className="text-[10px] text-slate-400 block font-medium">{targets.clasificacionIMC}</span>
          </div>

          <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Peso Ajustado (Clínico)</span>
            <span className="text-base font-bold text-emerald-400">{targets.pesoAjustado} kg</span>
            <span className="text-[10px] text-slate-400 block">
              {targets.aplicaPesoAjustado ? 'Activo (IMC ≥ 30)' : 'Inactivo'}
            </span>
          </div>

          <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Frecuencia Gym</span>
            <span className="text-base font-bold text-slate-100">{profile.diasEntrenamiento} días / sem</span>
            <span className="text-[10px] text-slate-400 block">Factor PAL: {targets.factorActividad}</span>
          </div>

          <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[11px]">TMB Base Calculada</span>
            <span className="text-base font-bold text-brand-400">{targets.tmb} kcal</span>
            <span className="text-[10px] text-slate-400 block">TDEE: {targets.tdee} kcal</span>
          </div>
        </div>
      )}
    </div>
  );
};