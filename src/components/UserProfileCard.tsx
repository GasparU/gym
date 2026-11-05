import React, { useState } from 'react';
import { BodyFatEstimator } from './BodyFatEstimator';
import {
  DESCRIPCION_ACTIVIDAD,
  DIAS_POR_NIVEL,
  ETIQUETAS_ACTIVIDAD,
  descripcionActividadAutomatica,
  factorPorDias,
} from '../logic/metabolism';
import type {
  UserProfile,
  MetabolicResult,
  NivelActividad,
} from '../logic/metabolism';

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
            <form onSubmit={handleSubmit} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-xs">
              <p className="col-span-full text-[11px] leading-snug text-slate-500">
                El factor de actividad cuenta <b className="text-slate-400">todo el día</b> (trabajo + entrenamiento), no solo el gym. Si dudás entre dos niveles, elegí el menor: es más fácil subir calorías después que bajarlas.
              </p>
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

              <div>
                <label className="text-slate-400 block mb-1">% Grasa (solo si lo mediste)</label>
                <input
                  type="number"
                  min="5"
                  max="60"
                  step="0.1"
                  placeholder="ej. 32.4"
                  value={
                    formData.grasaPct !== undefined
                      ? Math.round(formData.grasaPct * 1000) / 10
                      : ''
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    const n = parseFloat(v);
                    setFormData({
                      ...formData,
                      grasaPct: v === '' || !Number.isFinite(n) ? undefined : n / 100,
                    });
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-semibold focus:border-brand-500 focus:outline-none"
                />
                <BodyFatEstimator
                  talla={formData.talla}
                  sexo={formData.sexo}
                  onApply={(grasaPct) => setFormData({ ...formData, grasaPct })}
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Actividad total (trabajo + gym)</label>
                <select
                  value={formData.nivelActividad ?? ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      nivelActividad:
                        e.target.value === ''
                          ? undefined
                          : (e.target.value as NivelActividad),
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-semibold focus:border-brand-500 focus:outline-none"
                >
                  <option value="">Automático — solo días de gym</option>
                  {(Object.keys(ETIQUETAS_ACTIVIDAD) as NivelActividad[]).map((n) => (
                    <option key={n} value={n}>
                      {ETIQUETAS_ACTIVIDAD[n]}
                    </option>
                  ))}
                </select>
                <div className="mt-1.5 rounded-md border border-slate-700 bg-slate-900/60 px-2.5 py-2">
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 rounded bg-brand-500/20 px-1.5 py-0.5 text-[10px] font-bold text-brand-300">
                      {formData.nivelActividad
                        ? DIAS_POR_NIVEL[formData.nivelActividad]
                        : `${formData.diasEntrenamiento} días/sem`}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {formData.nivelActividad ? 'referencia del nivel' : 'automático por días de gym'}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-slate-400">
                    {formData.nivelActividad
                      ? DESCRIPCION_ACTIVIDAD[formData.nivelActividad]
                      : descripcionActividadAutomatica(
                          formData.diasEntrenamiento,
                          factorPorDias(formData.diasEntrenamiento),
                        )}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Déficit calórico</label>
                <select
                  value={Math.round((formData.deficitPct ?? 0.15) * 100)}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      deficitPct: parseInt(e.target.value, 10) / 100,
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-semibold focus:border-brand-500 focus:outline-none"
                >
                  <option value={10}>10% — suave</option>
                  <option value={15}>15% — recomposición</option>
                  <option value={20}>20%</option>
                  <option value={25}>25% — agresivo</option>
                  <option value={30}>30%</option>
                </select>
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
            <span className="text-slate-400 block text-[11px]">Peso ajustado (referencia)</span>
            <span className="text-base font-bold text-emerald-400">{targets.pesoAjustado} kg</span>
            <span className="text-[10px] text-slate-400 block">
              {targets.aplicaPesoAjustado ? 'Clínico · no entra en la TMB' : 'No aplica'}
            </span>
          </div>

              <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Frecuencia Gym</span>
                <span className="text-base font-bold text-slate-100">{profile.diasEntrenamiento} días / sem</span>
                <span className="text-[10px] text-slate-400 block">
                  PAL {targets.factorActividad} ·{' '}
                  {targets.factorActividadFuente === 'DIAS' ? 'asumido por días' : 'elegido'}
                </span>
              </div>

              <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[11px]">TMB Base Calculada</span>
                <span className="text-base font-bold text-brand-400">{targets.tmb} kcal</span>
                <span className="text-[10px] text-slate-400 block">
                  {targets.formulaTmb === 'KATCH_MCARDLE'
                    ? `Katch-McArdle · MLG ${targets.masaLibreGrasa} kg`
                    : 'Mifflin-St Jeor · peso real'}
                </span>
                <span className="text-[10px] text-slate-500 block">TDEE: {targets.tdee} kcal</span>
              </div>
        </div>
      )}
    </div>
  );
};