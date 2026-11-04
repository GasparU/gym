# -*- coding: utf-8 -*-
"""Parche: dieta persistente (lectura + escritura + cache local)."""
import io

def leer(p):
    return io.open(p, encoding='utf-8', newline='').read()

def escribir(p, s):
    io.open(p, 'w', encoding='utf-8', newline='').write(s)

def rep(s, viejo, nuevo, nombre):
    if s.count(viejo) != 1:
        raise SystemExit('FALLO %s: %d ocurrencias' % (nombre, s.count(viejo)))
    return s.replace(viejo, nuevo, 1)

def nl_de(s):
    return '\r\n' if '\r\n' in s else '\n'

# ================= cloudSync =================
p = 'src/services/cloudSync.ts'
s = leer(p)
NL = nl_de(s)
s = rep(
    s,
    "import type { MealEntry, MealType } from '../types/nutrition';",
    "import type { MealEntry, MealType } from '../types/nutrition';" + NL
    + "import { entradasDesdeFilas, filasDesdeEntradas, type Meals } from '../logic/dieta';",
    'import dieta',
)

ini = s.index('// 2. Guardar una comida registrada en el día')
fin = s.index('// 4. Guardar serie y volumen de entrenamiento')
nuevo = """// 2. LEER el día completo (04/11/2026). Antes la tabla solo se ESCRIBÍA:
//    `DietModule` arrancaba con `meals` vacío y un refresh borraba desayuno,
//    almuerzo y cena. Devuelve null si la lectura falla: el llamador conserva
//    la caché local y NUNCA borra lo que el usuario cargó.
export async function loadMealsForDate(fecha: string): Promise<Meals | null> {
  const { data, error } = await supabase
    .from('daily_meals')
    .select('*')
    .eq('fecha', fecha)
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('No se pudo leer daily_meals:', error.message);
    return null;
  }
  return entradasDesdeFilas(data ?? []);
}

// 3. GUARDAR una comida del día como REEMPLAZO (borra + inserta). Es idempotente
//    y limpia duplicados de sesiones anteriores. Si el insert falla después del
//    delete, la caché local conserva el día y el próximo cambio re-sincroniza.
export async function saveMealDay(
  fecha: string,
  mealType: MealType,
  entradas: MealEntry[],
): Promise<boolean> {
  const borrado = await supabase
    .from('daily_meals')
    .delete()
    .match({ fecha, tipo_comida: mealType });

  if (borrado.error) {
    console.error('Error limpiando daily_meals:', borrado.error.message);
    return false;
  }
  if (entradas.length === 0) return true;

  const { error } = await supabase
    .from('daily_meals')
    .insert(filasDesdeEntradas(fecha, mealType, entradas));

  if (error) {
    console.error('Error guardando el día en Supabase:', error.message);
    return false;
  }
  return true;
}

""".replace('\n', NL)
s = s[:ini] + nuevo + s[fin:]
escribir(p, s)
print('cloudSync OK')

# ================= DietModule =================
p = 'src/components/DietModule.tsx'
d = leer(p)
NL = nl_de(d)

d = rep(
    d,
    'import React, { useState, useEffect } from "react";',
    'import React, { useState, useEffect, useMemo, useRef } from "react";',
    'react import',
)

viejo_import = """import {
  syncBodyMetrics,
  syncMealEntry,
  removeCloudMeal,
  loadLatestBodyMetrics,
} from "../services/cloudSync";""".replace('\n', NL)
nuevo_import = """import {
  syncBodyMetrics,
  loadLatestBodyMetrics,
  loadMealsForDate,
  saveMealDay,
  getTodayDateString,
} from "../services/cloudSync";
import {
  claveCache,
  leerCacheDe,
  mealsVacio,
  normalizarEntradas,
  MEAL_TYPES,
  type Meals,
} from "../logic/dieta";""".replace('\n', NL)
d = rep(d, viejo_import, nuevo_import, 'imports cloud')

viejo_estado = """  const [meals, setMeals] = useState<Record<MealType, MealEntry[]>>({
    desayuno: [],
    almuerzo: [],
    cena: [],
  });""".replace('\n', NL)
nuevo_estado = """  // 2.b. DIETA PERSISTENTE (04/11/2026). Antes `meals` nacía vacío en cada
  // render: no se leía de ningún lado y el refresh borraba el día. Ahora hay
  // 3 capas: localStorage (instantáneo, offline), Supabase (multi-equipo) y
  // el estado de React (lo que ves). La caché de ESTE equipo manda para hoy.
  const fechaHoy = useMemo(() => getTodayDateString(), []);
  const [meals, setMeals] = useState<Meals>(() =>
    typeof window === "undefined"
      ? mealsVacio()
      : (leerCacheDe(window.localStorage.getItem(claveCache(getTodayDateString()))) ??
        mealsVacio()),
  );
  const cambiosLocales = useRef(false);
  const timersNube = useRef<Partial<Record<MealType, ReturnType<typeof setTimeout>>>>({});

  const guardarCache = (m: Meals) => {
    try {
      window.localStorage.setItem(claveCache(fechaHoy), JSON.stringify(m));
    } catch {
      /* modo privado o cuota llena: la nube sigue siendo el respaldo */
    }
  };

  const programarNube = (mealType: MealType, entradas: MealEntry[]) => {
    const previo = timersNube.current[mealType];
    if (previo) clearTimeout(previo);
    timersNube.current[mealType] = setTimeout(() => {
      void saveMealDay(fechaHoy, mealType, entradas);
    }, 600);
  };

  const persistir = (m: Meals, mealType: MealType) => {
    guardarCache(m);
    programarNube(mealType, m[mealType]);
  };

  // Al abrir: si este equipo ya tiene el día en caché, MANDA la caché (y se
  // sube, por si la nube quedó atrás). Si no, se baja de la nube.
  useEffect(() => {
    let vivo = true;
    const local = leerCacheDe(window.localStorage.getItem(claveCache(fechaHoy)));
    const localTiene = !!local && MEAL_TYPES.some((t) => local[t].length > 0);
    loadMealsForDate(fechaHoy).then((nube) => {
      if (!vivo || cambiosLocales.current) return;
      if (localTiene && local) {
        MEAL_TYPES.forEach((t) => {
          if (local[t].length > 0) void saveMealDay(fechaHoy, t, local[t]);
        });
      } else if (nube) {
        setMeals(nube);
        guardarCache(nube);
      }
    });
    return () => {
      vivo = false;
    };
  }, [fechaHoy]);

  // Cuando llega el catálogo se recupera el `foodId` por NOMBRE y se recalculan
  // los macros con la tabla real (las filas de la nube no guardan foodId).
  useEffect(() => {
    if (foods.length === 0) return;
    setMeals((prev) => {
      const normalizado = normalizarEntradas(prev, foods);
      guardarCache(normalizado);
      return normalizado;
    });
  }, [foods]);""".replace('\n', NL)
d = rep(d, viejo_estado, nuevo_estado, 'estado meals')

viejo_add = """    setMeals((prev) => ({
      ...prev,
      [mealType]: [...prev[mealType], newEntry],
    }));
    syncMealEntry(mealType, newEntry);""".replace('\n', NL)
nuevo_add = """    const siguiente: Meals = {
      ...meals,
      [mealType]: [...meals[mealType], newEntry],
    };
    cambiosLocales.current = true;
    setMeals(siguiente);
    persistir(siguiente, mealType);""".replace('\n', NL)
d = rep(d, viejo_add, nuevo_add, 'addFoodToMeal')

viejo_upd = """  const updateGrams = (mealType: MealType, id: string, newGrams: number) => {
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
  };""".replace('\n', NL)
nuevo_upd = """  const updateGrams = (mealType: MealType, id: string, newGrams: number) => {
    const siguiente: Meals = {
      ...meals,
      [mealType]: meals[mealType].map((item) => {
        if (item.id !== id) return item;
        const foodRef =
          foods.find((f) => f.id === item.foodId) ??
          foods.find((f) => f.nombre === item.nombre);
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
    };
    cambiosLocales.current = true;
    setMeals(siguiente);
    persistir(siguiente, mealType);
  };""".replace('\n', NL)
d = rep(d, viejo_upd, nuevo_upd, 'updateGrams')

viejo_rm = """  const removeEntry = (mealType: MealType, id: string) => {
    const itemToRemove = meals[mealType].find((m) => m.id === id);
    if (itemToRemove) {
      removeCloudMeal(mealType, itemToRemove.nombre);
    }
    setMeals((prev) => ({
      ...prev,
      [mealType]: prev[mealType].filter((item) => item.id !== id),
    }));
  };""".replace('\n', NL)
nuevo_rm = """  const removeEntry = (mealType: MealType, id: string) => {
    const siguiente: Meals = {
      ...meals,
      [mealType]: meals[mealType].filter((item) => item.id !== id),
    };
    cambiosLocales.current = true;
    setMeals(siguiente);
    persistir(siguiente, mealType);
  };""".replace('\n', NL)
d = rep(d, viejo_rm, nuevo_rm, 'removeEntry')

escribir(p, d)
print('DietModule OK')
