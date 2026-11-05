import React, { useState, useEffect, useMemo, useRef } from "react";
import type { FoodItem, MealEntry, MealType } from "../types/nutrition";
import { AutocompleteFood } from "./AutocompleteFood";
import { BuscadorPlato } from "./BuscadorPlato";
import { PlatoModal } from "./PlatoModal";
import type { Plato, PlatoCalculado } from "../logic/platos";
import { UserProfileCard } from "./UserProfileCard";
import { computeMealTotals } from "../logic/auditor";
import { numEs, numEsMax } from "../logic/formato";
import { EstadoAlimento } from "./EstadoAlimento";
import {
  calculateMetabolicTargets,
  repartoCalorico,
  NOMBRES_ACTIVIDAD,
  type UserProfile,
} from "../logic/metabolism";
import {
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
} from "../logic/dieta";

// Datos reales del dueño (medidos el 03/11/2026): 99 kg, 175 cm, 44 a, 3 días.
// El % de grasa (32,4) NO es un supuesto: sale de cintura 115 / cuello 44 por US Navy.
const DEFAULT_PROFILE: UserProfile = {
  peso: 99,
  talla: 175,
  edad: 44,
  sexo: "H",
  diasEntrenamiento: 3,
  deficitPct: 0.15,
  grasaPct: 0.324,
  nivelActividad: "LIGERO",
};

const objetivoEtiqueta = (deficit: number): string =>
  deficit > 0.2 ? "Déficit agresivo" : deficit < 0.12 ? "Déficit suave" : "Recomposición";

const pctBarra = (valor: number, objetivo: number): number =>
  objetivo > 0 ? Math.min(100, (valor / objetivo) * 100) : 0;

const BarraMacro: React.FC<{
  nombre: string;
  valor: number;
  objetivo: number;
  unidad: string;
  colorTexto: string;
  colorBarra: string;
}> = ({ nombre, valor, objetivo, unidad, colorTexto, colorBarra }) => {
  const pct = objetivo > 0 ? (valor / objetivo) * 100 : 0;
  const lleno = pctBarra(valor, objetivo);
  const excedido = pct > 100.5;
  const falta = Math.max(0, objetivo - valor);
  const sobra = Math.max(0, valor - objetivo);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className={`${colorTexto} font-medium`}>{nombre}</span>
        <span className="text-slate-300">
          {numEsMax(valor, 1)} / {numEs(objetivo)} {unidad}
        </span>
      </div>
      <div
        className="relative w-full bg-slate-950 ring-1 ring-slate-600 rounded-full h-2.5 overflow-hidden"
        role="progressbar"
        aria-valuenow={Math.min(100, Math.round(pct))}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${nombre}: ${numEsMax(valor, 1)} de ${numEs(objetivo)} ${unidad}`}
      >
        <div
          className={`${
            excedido ? "bg-rose-500" : colorBarra
          } h-2.5 rounded-full transition-all`}
          style={{ width: `${lleno}%` }}
        />
        <span
          className="absolute inset-y-0 left-[99.5%] w-px bg-slate-300/80"
          aria-hidden="true"
        />
      </div>
      <div className="flex justify-between text-[10px] mt-1">
        <span className={excedido ? "text-rose-400" : "text-slate-500"}>
          {excedido
            ? `+${numEsMax(sobra, 1)} ${unidad} sobre el objetivo`
            : `faltan ${numEsMax(falta, 1)} ${unidad}`}
        </span>
        <span className={excedido ? "text-rose-400" : "text-slate-500"}>
          {numEs(pct)} %
        </span>
      </div>
    </div>
  );
};


// Migración única (03/11/2026): si el perfil guardado es EXACTAMENTE el default
// viejo (98 kg, sin % de grasa, sin nivel de actividad), se pasa a los datos
// reales medidos. Si el usuario ya lo editó, NO se toca nada.
function cargarPerfil(): UserProfile {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  const saved = window.localStorage.getItem("user_metabolic_profile");
  if (!saved) return DEFAULT_PROFILE;
  try {
    const p = JSON.parse(saved) as UserProfile;
    const esDefaultViejo =
      p.peso === 98 &&
      p.talla === 175 &&
      p.edad === 44 &&
      p.sexo === "H" &&
      p.grasaPct === undefined &&
      p.nivelActividad === undefined;
    if (esDefaultViejo) {
      const migrado: UserProfile = {
        ...DEFAULT_PROFILE,
        ...p,
        peso: 99,
        grasaPct: 0.324,
        nivelActividad: "LIGERO",
      };
      window.localStorage.setItem("user_metabolic_profile", JSON.stringify(migrado));
      return migrado;
    }
    return p;
  } catch (e) {
    console.error("Error parseando perfil:", e);
    return DEFAULT_PROFILE;
  }
}

/** Comida sugerida segun la hora local. Es solo el valor inicial: el modal lo deja cambiar. */
const comidaPorHora = (): MealType => {
  const h = new Date().getHours();
  if (h < 11) return "desayuno";
  if (h < 16) return "almuerzo";
  return "cena";
};

export const DietModule: React.FC = () => {
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [platos, setPlatos] = useState<Plato[]>([]);
  const [modo, setModo] = useState<Record<MealType, "alimento" | "plato">>({
    desayuno: "alimento",
    almuerzo: "alimento",
    cena: "alimento",
  });
  const [platoAbierto, setPlatoAbierto] = useState<{ plato: Plato; mealType: MealType } | null>(null);
  const [loading, setLoading] = useState(true);

  // 1. Cargar Perfil de localStorage o usar el inicial
  const [profile, setProfile] = useState<UserProfile>(cargarPerfil);
  const [perfilDeNube, setPerfilDeNube] = useState<boolean>(false);

  // 1.b. BAJAR el perfil desde la nube (04/11/2026). Antes solo se SUBÍA a
  // body_metrics: un equipo nuevo arrancaba con el default del código y las
  // metas cambiaban en silencio. Ahora la base manda si tiene una fila.
  useEffect(() => {
    let alive = true;
    loadLatestBodyMetrics().then((remoto) => {
      if (!alive) return;
      if (!remoto) {
        // No hay ninguna fila en la nube: subimos la de este equipo para que exista
        // desde el primer dia (upsert por fecha: una fila por dia).
        const actual = cargarPerfil();
        syncBodyMetrics(actual, calculateMetabolicTargets(actual));
        return;
      }
      setProfile((prev) => {
        const fusionado: UserProfile = {
          ...prev,
          peso: remoto.peso ?? prev.peso,
          talla: remoto.talla ?? prev.talla,
          edad: remoto.edad ?? prev.edad,
          sexo: remoto.sexo ?? prev.sexo,
          diasEntrenamiento: remoto.diasEntrenamiento ?? prev.diasEntrenamiento,
          deficitPct: remoto.deficitPct ?? prev.deficitPct,
          grasaPct: remoto.grasaPct ?? prev.grasaPct,
          nivelActividad: remoto.nivelActividad ?? prev.nivelActividad,
        };
        try {
          localStorage.setItem("user_metabolic_profile", JSON.stringify(fusionado));
        } catch {
          /* modo privado */
        }
        return fusionado;
      });
      setPerfilDeNube(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  // 2. Cálculo metabólico reactivo automático
  const targets = calculateMetabolicTargets(profile);

  // 2.b. DIETA PERSISTENTE (04/11/2026). Antes `meals` nacía vacío en cada
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
  const colasNube = useRef<Partial<Record<MealType, Promise<unknown>>>>({});
  const [hidratado, setHidratado] = useState(false);

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
      // Cola por comida: dos guardados seguidos no se pisan (delete + insert).
      const anterior = colasNube.current[mealType] ?? Promise.resolve();
      colasNube.current[mealType] = anterior
        .then(() => saveMealDay(fechaHoy, mealType, entradas))
        .catch(() => undefined);
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
      setHidratado(true);
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
  }, [foods, hidratado]);

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

  // Cargar recetario de public/data/platos.json (gramos por porcion)
  useEffect(() => {
    fetch("/data/platos.json")
      .then((res) => res.json())
      .then((data: { platos: Plato[] }) => setPlatos(data.platos ?? []))
      .catch((err) => console.error("Error cargando platos.json:", err));
  }, []);

  const addPlatoToMeal = (mealType: MealType, plato: Plato, calc: PlatoCalculado) => {
    const nuevaEntrada: MealEntry = {
      id: crypto.randomUUID(),
      foodId: -1, // un plato no es un alimento de la tabla: no tiene foodId
      nombre: plato.nombre,
      gramos: calc.gramos,
      kcal: calc.totales.kcal,
      proteinas: calc.totales.proteinas,
      grasa: calc.totales.grasa,
      carbohidratos: calc.totales.carbohidratos,
      fibra: calc.totales.fibra,
    };

    const siguiente: Meals = {
      ...meals,
      [mealType]: [...meals[mealType], nuevaEntrada],
    };
    cambiosLocales.current = true;
    setMeals(siguiente);
    persistir(siguiente, mealType);
  };

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

    const siguiente: Meals = {
      ...meals,
      [mealType]: [...meals[mealType], newEntry],
    };
    cambiosLocales.current = true;
    setMeals(siguiente);
    persistir(siguiente, mealType);
  };

  const updateGrams = (mealType: MealType, id: string, newGrams: number) => {
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
  };

  const removeEntry = (mealType: MealType, id: string) => {
    const siguiente: Meals = {
      ...meals,
      [mealType]: meals[mealType].filter((item) => item.id !== id),
    };
    cambiosLocales.current = true;
    setMeals(siguiente);
    persistir(siguiente, mealType);
  };

  const allEntries = [...meals.desayuno, ...meals.almuerzo, ...meals.cena];
  const totalAudit = computeMealTotals(allEntries);
  const reparto = repartoCalorico(targets);

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
      {perfilDeNube && (
        <p className="text-[11px] text-emerald-400/90 -mt-4">
          ☁️ Perfil cargado desde la base de datos: lo que edites acá se sube y se
          ve igual en cualquier dispositivo.
        </p>
      )}

          {/* 2. Resumen de Metas Diarias */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 bg-slate-800/80 p-4 rounded-xl border border-slate-700">
            <div>
              <span className="text-xs text-slate-400 block">TMB Activa</span>
              <span className="text-xl font-bold text-slate-100">
                {numEs(targets.tmb)} kcal
              </span>
              <span className="text-[10px] text-emerald-400 block">
                {targets.formulaTmb === "KATCH_MCARDLE"
                  ? `Katch-McArdle · MLG ${
                        targets.masaLibreGrasa !== null
                          ? numEsMax(targets.masaLibreGrasa, 2)
                          : "—"
                      } kg`
                  : `Mifflin-St Jeor · ${numEsMax(profile.peso, 1)} kg (peso real)`}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block">
                Gasto Total (TDEE)
              </span>
              <span className="text-xl font-bold text-slate-100">
                {numEs(targets.tdee)} kcal
              </span>
              <span className="text-[10px] text-slate-400 block">
                {targets.factorActividadFuente === "DIAS"
                  ? `×${String(targets.factorActividad).replace(".", ",")} estimado por ${profile.diasEntrenamiento} día(s) de gym`
                  : `×${String(targets.factorActividad).replace(".", ",")} · ${
                      profile.nivelActividad
                        ? NOMBRES_ACTIVIDAD[profile.nivelActividad]
                        : "elegido"
                    } (todo el día)`}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block">Déficit</span>
              <span className="text-xl font-bold text-rose-400">
                −{numEs(targets.deficitKcal)} kcal
              </span>
              <span className="text-[10px] text-slate-400 block">
                −{numEs(targets.deficitPctUsado * 100)} % del gasto total
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block">
                Meta {objetivoEtiqueta(targets.deficitPctUsado)} (−
                {numEs(targets.deficitPctUsado * 100)} %)
              </span>
              <span className="text-xl font-bold text-amber-400">
                {numEs(targets.metaCalorica)} kcal
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
                {numEs(totalAudit.energiaTablaKcal)} kcal
              </span>
              <span className="text-[10px] text-slate-400 block">
                Atwater: {numEs(totalAudit.energiaAtwaterKcal)} kcal · Δ {" "}
                {numEs(totalAudit.diferenciaKcal)} kcal (tol. {numEs(totalAudit.toleranciaKcal)})
              </span>
              <span
                className={`text-[10px] block font-semibold ${
                  totalAudit.estaCuadrado
                    ? "text-emerald-400"
                    : totalAudit.posibleErrorDeOrigen
                      ? "text-rose-400"
                      : "text-amber-400"
                }`}
              >
                {totalAudit.estaCuadrado
                  ? "✓ Cuadra"
                  : totalAudit.posibleErrorDeOrigen
                    ? "⚠ Dato del alimento sospechoso"
                    : "Revisar redondeos"}
              </span>
            </div>
          </div>

              {/* 2.a Agua diaria (fórmula del Excel: 35 ml/kg o peso ideal si IMC ≥ 30) */}
              <div className="rounded-xl border border-sky-800/60 bg-sky-950/30 px-4 py-2.5 text-sm text-sky-200 flex flex-wrap items-baseline gap-x-2">
                <span>💧 Agua: <b>{numEsMax(targets.aguaLitros, 1)} L/día</b></span>
                <span className="text-[11px] text-sky-300/80">
                  + 0,5 L por cada hora de entrenamiento
                </span>
              </div>

          {/* 2.b Cómo se calcularon las metas (trazabilidad) */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-2">
              Cómo se calcularon tus metas
            </h3>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-slate-400">
              <span>
                Reparto:{" "}
                <b className="text-slate-200">
                  {numEsMax(reparto.proteina, 1)} % proteína · {numEsMax(reparto.grasa, 1)} % grasa ·{" "}
                  {numEsMax(reparto.carbohidratos, 1)} % carbohidratos
                </b>
              </span>
              <span>
                Proteína: <b className="text-slate-200">{numEs(targets.proteinaFactorGkg, 2)} g/kg</b>{" "}
                sobre {targets.proteinaBaseG} kg{" "}
                {targets.masaLibreGrasa !== null ? "(masa libre de grasa)" : "(peso real)"}
              </span>
              <span>Grasa: 0,75 g/kg con piso del 20% de las kcal</span>
            </div>
            {targets.avisos.length > 0 && (
              <ul className="mt-3 space-y-1">
                {targets.avisos.map((a) => (
                  <li key={a} className="text-[11px] text-amber-300/90 flex gap-2">
                    <span aria-hidden>·</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

      {/* 3. Balance de macronutrientes: barra contenedora + cuanto falta */}
      {(() => {
        const restanteKcal = targets.metaCalorica - totalAudit.energiaTablaKcal;
        const restanteProteina = targets.targetProteinaG - totalAudit.proteinasG;
        const pasado = restanteKcal < 0;
        return (
          <div
            className={`rounded-xl border p-3 text-sm ${
              pasado
                ? "border-rose-700 bg-rose-950/40 text-rose-300"
                : "border-emerald-700 bg-emerald-950/40 text-emerald-300"
            }`}
          >
            {pasado ? (
              <>
                Te pasaste del presupuesto por{" "}
                <b>{numEs(-restanteKcal)} kcal</b>.
              </>
            ) : (
              <>
                Te queda hoy: <b>{numEs(restanteKcal)} kcal</b> ·{" "}
                <b>{numEsMax(Math.max(0, restanteProteina), 1)} g de proteína</b>.
              </>
            )}
          </div>
        );
        })()}
      <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700 space-y-3">
        <h3 className="text-sm font-semibold text-slate-200">
          Balance de Macronutrientes del Día
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <BarraMacro
            nombre="Proteínas"
            valor={totalAudit.proteinasG}
            objetivo={targets.targetProteinaG}
            unidad="g"
            colorTexto="text-blue-400"
            colorBarra="bg-blue-500"
          />
          <BarraMacro
            nombre="Grasas"
            valor={totalAudit.grasaG}
            objetivo={targets.targetGrasaG}
            unidad="g"
            colorTexto="text-amber-400"
            colorBarra="bg-amber-500"
          />
          <BarraMacro
            nombre="Carbohidratos"
            valor={totalAudit.carbohidratosG}
            objetivo={targets.targetCarbohidratosG}
            unidad="g"
            colorTexto="text-emerald-400"
            colorBarra="bg-emerald-500"
          />
        </div>
      </div>
          {/* 3.5 Recetario: siempre a la vista */}
          <div className="bg-slate-800/80 border border-brand-500/40 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-base font-semibold text-slate-100">🍲 Recetario criollo</h4>
              <span className="text-[11px] text-slate-400">
                {platos.length} platos caseros
              </span>
            </div>
            <p className="text-[11px] leading-snug text-slate-400">
              Buscá el plato, mirá los gramos y la receta se ajusta a lo que te queda hoy. Lo que no
              está en la tabla (sillao, sal, kion) se avisa y no entra al total.
            </p>
            <BuscadorPlato
              platos={platos}
              onElegir={(plato) => setPlatoAbierto({ plato, mealType: comidaPorHora() })}
            />
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

              <div className="flex gap-2">
                {(["alimento", "plato"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setModo((prev) => ({ ...prev, [mealType]: m }))}
                    aria-pressed={(modo[mealType] ?? "alimento") === m}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
                      (modo[mealType] ?? "alimento") === m
                        ? "border-brand-500 bg-brand-500/20 text-brand-300"
                        : "border-slate-600 bg-slate-900/40 text-slate-200 hover:border-slate-400"
                    }`}
                  >
                    {m === "alimento" ? "Alimento" : "Plato criollo"}
                  </button>
                ))}
              </div>

              {(modo[mealType] ?? "alimento") === "alimento" ? (
                <AutocompleteFood
                  foods={foods}
                  onSelectFood={(food) => addFoodToMeal(mealType, food)}
                  placeholder={`Agregar alimento a ${mealType}...`}
                />
              ) : (
                <BuscadorPlato
                  platos={platos}
                  onElegir={(plato) => setPlatoAbierto({ plato, mealType })}
                />
              )}

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

                            <span className="inline-flex items-center gap-1.5">

                              {item.nombre}

                              {(() => {

                                const f = foods.find((x) => x.id === item.foodId);

                                return f ? <EstadoAlimento esCocido={f.esCocido} /> : null;

                              })()}

                            </span>

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
      {platoAbierto && (
        <PlatoModal
          plato={platoAbierto.plato}
          foods={foods}
          kcalRestantes={targets.metaCalorica - totalAudit.energiaTablaKcal}
          mealTypeInicial={platoAbierto.mealType}
          onCerrar={() => setPlatoAbierto(null)}
          onAgregar={(plato, calc, mealType) => {
            addPlatoToMeal(mealType, plato, calc);
            setPlatoAbierto(null);
          }}
        />
      )}

    </div>
  );
};
