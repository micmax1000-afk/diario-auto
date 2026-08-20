// Elenco marche/modelli più comuni sul mercato italiano, per compilare
// rapidamente il nome del veicolo. Non è (e non può essere) esaustivo: chi
// non trova la propria marca o modello può sempre scegliere "Altra marca..."
// / "Altro modello..." e scrivere a mano.

export interface CarBrand {
  brand: string;
  models: string[];
}

export const CAR_CATALOG: CarBrand[] = [
  { brand: "Audi", models: ["A1", "A3", "A4", "A5", "A6", "Q2", "Q3", "Q5", "Q7", "e-tron"] },
  { brand: "Alfa Romeo", models: ["Giulietta", "Giulia", "Stelvio", "MiTo", "Tonale"] },
  { brand: "BMW", models: ["Serie 1", "Serie 2", "Serie 3", "Serie 5", "X1", "X2", "X3", "X5", "i3", "i4"] },
  { brand: "Citroën", models: ["C1", "C3", "C3 Aircross", "C4", "C4 Cactus", "C5 Aircross", "Berlingo"] },
  { brand: "Dacia", models: ["Sandero", "Duster", "Jogger", "Spring"] },
  { brand: "Fiat", models: ["Panda", "500", "500L", "500X", "Tipo", "Punto", "Ducato", "Doblò"] },
  { brand: "Ford", models: ["Fiesta", "Focus", "Puma", "Kuga", "Ecosport", "Mustang Mach-E"] },
  { brand: "Honda", models: ["Civic", "Jazz", "HR-V", "CR-V"] },
  { brand: "Hyundai", models: ["i10", "i20", "i30", "Kona", "Tucson", "Santa Fe", "Ioniq"] },
  { brand: "Jeep", models: ["Renegade", "Compass", "Wrangler", "Avenger"] },
  { brand: "Kia", models: ["Picanto", "Rio", "Ceed", "Sportage", "Niro", "EV6"] },
  { brand: "Lancia", models: ["Ypsilon"] },
  { brand: "Mazda", models: ["Mazda2", "Mazda3", "CX-3", "CX-5", "MX-5"] },
  { brand: "Mercedes-Benz", models: ["Classe A", "Classe B", "Classe C", "CLA", "GLA", "GLC"] },
  { brand: "Mini", models: ["Cooper", "Countryman", "Clubman"] },
  { brand: "Nissan", models: ["Micra", "Juke", "Qashqai", "X-Trail", "Leaf"] },
  { brand: "Opel", models: ["Corsa", "Astra", "Crossland", "Grandland", "Mokka"] },
  { brand: "Peugeot", models: ["108", "208", "308", "2008", "3008", "5008", "Partner"] },
  { brand: "Renault", models: ["Clio", "Captur", "Megane", "Kadjar", "Scenic", "Zoe", "Twingo"] },
  { brand: "Seat", models: ["Ibiza", "Leon", "Arona", "Ateca"] },
  { brand: "Škoda", models: ["Fabia", "Octavia", "Kamiq", "Karoq", "Kodiaq"] },
  { brand: "Smart", models: ["Fortwo", "Forfour"] },
  { brand: "Suzuki", models: ["Swift", "Vitara", "S-Cross", "Ignis"] },
  { brand: "Tesla", models: ["Model 3", "Model Y", "Model S", "Model X"] },
  { brand: "Toyota", models: ["Aygo", "Yaris", "Corolla", "C-HR", "RAV4", "Prius"] },
  { brand: "Volkswagen", models: ["Polo", "Golf", "Passat", "T-Roc", "Tiguan", "ID.3", "ID.4", "Up!"] },
  { brand: "Volvo", models: ["XC40", "XC60", "XC90", "V60", "S60"] },
];

export const OTHER_BRAND = "__altra_marca__";
export const OTHER_MODEL = "__altro_modello__";
