import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  loadCurrencyPreference,
  saveCurrencyPreference,
  loadDistanceUnitPreference,
  saveDistanceUnitPreference,
  loadTemperatureUnitPreference,
  saveTemperatureUnitPreference,
  formatCurrency,
  formatTemp,
  type DistanceUnit,
  type TemperatureUnit,
} from "../utils/settings";

interface AppSettingsValue {
  currency: string;
  setCurrency: (code: string) => void;
  distanceUnit: DistanceUnit;
  setDistanceUnit: (unit: DistanceUnit) => void;
  temperatureUnit: TemperatureUnit;
  setTemperatureUnit: (unit: TemperatureUnit) => void;
  /** Formatta un importo con la valuta scelta dall'utente, es. "€ 42.50". */
  formatMoney: (value: number, decimals?: number) => string;
  /** Formatta una temperatura (in Celsius) nell'unità scelta, es. "212°F" o "100°C". */
  formatTemperature: (celsius: number) => string;
}

const AppSettingsContext = createContext<AppSettingsValue | null>(null);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState("EUR");
  const [distanceUnit, setDistanceUnitState] = useState<DistanceUnit>("km");
  const [temperatureUnit, setTemperatureUnitState] = useState<TemperatureUnit>("C");

  useEffect(() => {
    loadCurrencyPreference().then(setCurrencyState);
    loadDistanceUnitPreference().then(setDistanceUnitState);
    loadTemperatureUnitPreference().then(setTemperatureUnitState);
  }, []);

  function setCurrency(code: string) {
    setCurrencyState(code);
    saveCurrencyPreference(code);
  }

  function setDistanceUnit(unit: DistanceUnit) {
    setDistanceUnitState(unit);
    saveDistanceUnitPreference(unit);
  }

  function setTemperatureUnit(unit: TemperatureUnit) {
    setTemperatureUnitState(unit);
    saveTemperatureUnitPreference(unit);
  }

  function formatMoney(value: number, decimals = 2): string {
    return formatCurrency(value, currency, decimals);
  }

  function formatTemperature(celsius: number): string {
    return formatTemp(celsius, temperatureUnit);
  }

  return (
    <AppSettingsContext.Provider
      value={{
        currency,
        setCurrency,
        distanceUnit,
        setDistanceUnit,
        temperatureUnit,
        setTemperatureUnit,
        formatMoney,
        formatTemperature,
      }}
    >
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings(): AppSettingsValue {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) {
    throw new Error("useAppSettings deve essere usato dentro <AppSettingsProvider>");
  }
  return ctx;
}
