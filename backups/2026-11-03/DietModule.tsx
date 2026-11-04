import React, { useState, useEffect } from "react";
import type { FoodItem, MealEntry, MealType } from "../types/nutrition";
import { AutocompleteFood } from "./AutocompleteFood";
import { UserProfileCard } from "./UserProfileCard";
import { computeMealTotals } from "../logic/auditor";
import {
  calculateMetabolicTargets,
  type UserProfile,
} from "../logic/metabolism";
import {
  syncBodyMetrics,
  syncMealEntry,
  removeCloudMeal,
} from "../services/cloudSync";

const DEFAULT_PROFILE: UserProfile = {
  peso: 98,
  talla: 175,
  edad: 44,
  sexo: "H",
  diasEntrenamiento: 3,
  deficitPct: 0.15,
};

export const DietModule: React.FC = () => {
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Cargar Perfil de localStorage o usar el inicial
  const [profile, setProfile] = useState<UserProfile>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("user_metabolic_profile");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error("Error parseando perfil:", e);
        }
      }
    }
    return DEFAULT_PROFILE;
  });

  // 2. Cálculo metabólico reactivo automático
  const targets = calculateMetabolicTargets(profile);

  const [meals, setMeals] = useState<Record<MealType, MealEntry[]>>({
    desayuno: [],
    almuerzo: [],
    cena: [],
  });

  // Guardar perfil al actualizar
  const handleUpdateProfile = (newProfile: UserProfile) => {
    setProfile(newProfile);
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "user_metabolic_profile",
        JSON.stringify(newProfile),
      );
    }
    const newTargets = calculateMetabolicTargets(newProfile);
    syncBodyMetrics(newProfile, newTargets); // <-- Sincroniza a Supabase
  };

  // Cargar alimentos de public/data/foods.json
  useEffect(() => {
    fetch("/data/foods.json")
      .then((res) => res.json())
      .then((data: FoodItem[]) => {
        setFoods(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error cargando foods.json:", err);
        setLoading(false);
      });
  }, []);

  const addFoodToMeal = (mealType: MealType, food: FoodItem) => {
    const defaultGrams = 100;
    const factor = defaultGrams / 100;

    const newEntry: MealEntry = {
      id: crypto.randomUUID(),
      foodId: food.id,
      nombre: food.nombre,
      gramos: defaultGrams,
      kcal: parseFloat((food.energiaKcal * factor).toFixed(1)),
      proteinas: parseFloat((food.proteinas * factor).toFixed(1)),
      grasa: parseFloat((food.grasaTotal * factor).toFixed(1)),
      carbohidratos: parseFloat(
        (food.carbohidratosTotales * factor).toFixed(1),
      ),
      fibra: parseFloat((food.fibra * factor).toFixed(1)),
    };

    setMeals((prev) => ({
      ...prev,
      [mealType]: [...prev[mealType], newEntry],
    }));
    syncMealEntry(mealType, newEntry);
  };

  const updateGrams = (mealType: MealType, id: string, newGrams: number) => {
    setMeals((prev) => ({
      ...prev,
      [mealType]: prev[mealType].map((item) => {
        if (item.id !== id) return item;
        const foodRef = foods.find((f) => f.id === item.foodId);
        if (!foodRef) return { ...item, gramos: newGrams };

        const factor = Math.max(0, newGrams) / 100;
        return {
          ...item,
          gramos: newGrams,
          kcal: parseFloat((foodRef.energiaKcal * factor).toFixed(1)),
          proteinas: parseFloat((foodRef.proteinas * factor).toFixed(1)),
          grasa: parseFloat((foodRef.grasaTotal * factor).toFixed(1)),
          carbohidratos: parseFloat(
            (foodRef.carbohidratosTotales * factor).toFixed(1),
          ),
          fibra: parseFloat((foodRef.fibra * factor).toFixed(1)),
        };
      }),
    }));
  };

  const removeEntry = (mealType: MealType, id: string) => {
    const itemToRemove = meals[mealType].find((m) => m.id === id);
    if (itemToRemove) {
      removeCloudMeal(mealType, itemToRemove.nombre);
    }
    setMeals((prev) => ({
      ...prev,
      [mealType]: prev[mealType].filter((item) => item.id !== id),
    }));
  };

  const allEntries = [...meals.desayuno, ...meals.almuerzo, ...meals.cena];
  const totalAudit = computeMealTotals(allEntries);

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-400">
        Cargando base de datos de alimentos...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Panel de Perfil Físico Editable */}
      <UserProfileCard
        profile={profile}
        targets={targets}
        onUpdateProfile={handleUpdateProfile}
      />

      {/* 2. Resumen de Metas Diarias */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-800/80 p-4 rounded-xl border border-slate-700">
        <div>
          <span className="text-xs text-slate-400 block">TMB Activa</span>
          <span className="text-xl font-bold text-slate-100">
            {targets.tmb} kcal
          </span>
          <span className="text-[10px] text-emerald-400 block">
            {targets.aplicaPesoAjustado
              ? `Sobre ${targets.pesoAjustado} kg (Ajustado)`
              : `Sobre ${profile.peso} kg`}
          </span>
        </div>
        <div>
          <span className="text-xs text-slate-400 block">
            Gasto Total (TDEE)
          </span>
          <span className="text-xl font-bold text-slate-100">
            {targets.tdee} kcal
          </span>
          <span className="text-[10px] text-slate-400 block">
            {profile.diasEntrenamiento} días gym (PAL: {targets.factorActividad}
            )
          </span>
        </div>
        <div>
          <span className="text-xs text-slate-400 block">
            Meta Recomposición (-15%)
          </span>
          <span className="text-xl font-bold text-amber-400">
            {targets.metaCalorica} kcal
          </span>
          <span className="text-[10px] text-slate-400 block">
            Presupuesto diario
          </span>
        </div>
        <div>
          <span className="text-xs text-slate-400 block">
            Consumo Registrado
          </span>
          <span className="text-xl font-bold text-emerald-400">
            {totalAudit.energiaTablaKcal} kcal
          </span>
          <span className="text-[10px] text-slate-400 block">
            Atwater: {totalAudit.energiaAtwaterKcal} kcal (
            {totalAudit.estaCuadrado ? "✓ Cuadrado" : "Revisar"})
          </span>
        </div>
      </div>

      {/* 3. Barras de Progreso de Macronutrientes */}
      <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700 space-y-3">
        <h3 className="text-sm font-semibold text-slate-200">
          Balance de Macronutrientes del Día
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-blue-400 font-medium">Proteínas</span>
              <span className="text-slate-300">
                {totalAudit.proteinasG} / {targets.targetProteinaG} g
              </span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (totalAudit.proteinasG / targets.targetProteinaG) * 100)}%`,
                }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-amber-400 font-medium">Grasas</span>
              <span className="text-slate-300">
                {totalAudit.grasaG} / {targets.targetGrasaG} g
              </span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
              <div
                className="bg-amber-500 h-2 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (totalAudit.grasaG / targets.targetGrasaG) * 100)}%`,
                }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-emerald-400 font-medium">
                Carbohidratos
              </span>
              <span className="text-slate-300">
                {totalAudit.carbohidratosG} / {targets.targetCarbohidratosG} g
              </span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (totalAudit.carbohidratosG / targets.targetCarbohidratosG) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Tablas por Comida */}
      {(["desayuno", "almuerzo", "cena"] as MealType[]).map((mealType) => (
        <div
          key={mealType}
          className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-base font-semibold capitalize text-slate-100">
              {mealType}
            </h4>
            <span className="text-xs text-slate-400">
              {meals[mealType]
                .reduce((acc, curr) => acc + curr.kcal, 0)
                .toFixed(0)}{" "}
              kcal
            </span>
          </div>

          <AutocompleteFood
            foods={foods}
            onSelectFood={(food) => addFoodToMeal(mealType, food)}
            placeholder={`Agregar alimento a ${mealType}...`}
          />

          {meals[mealType].length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/60 text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="py-2 px-3">Alimento</th>
                    <th className="py-2 px-3 w-24">Gramos</th>
                    <th className="py-2 px-3 text-right">Kcal</th>
                    <th className="py-2 px-3 text-right">Prot (g)</th>
                    <th className="py-2 px-3 text-right">Grasa (g)</th>
                    <th className="py-2 px-3 text-right">Carb (g)</th>
                    <th className="py-2 px-3 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {meals[mealType].map((item) => (
                    <tr key={item.id} className="hover:bg-slate-700/30">
                      <td className="py-2 px-3 font-medium text-slate-200">
                        {item.nombre}
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          value={item.gramos}
                          onChange={(e) =>
                            updateGrams(
                              mealType,
                              item.id,
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 text-xs focus:outline-none focus:border-brand-500 font-semibold"
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-emerald-400">
                        {item.kcal}
                      </td>
                      <td className="py-2 px-3 text-right text-blue-400">
                        {item.proteinas}
                      </td>
                      <td className="py-2 px-3 text-right text-amber-400">
                        {item.grasa}
                      </td>
                      <td className="py-2 px-3 text-right text-emerald-400">
                        {item.carbohidratos}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          onClick={() => removeEntry(mealType, item.id)}
                          className="text-rose-400 hover:text-rose-300 font-bold px-1"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
