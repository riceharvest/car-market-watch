import type { Confidence, ImportRegion } from '../types';

export type ImportProfileKey = 'NL' | 'BE' | 'DE' | 'FR' | 'NON_EU';

export type ImportCountryProfile = {
  key: ImportProfileKey;
  countryLabel: string;
  region: ImportRegion;
  transportEur: number;
  rdwInspectionEur: number;
  platesAndRegistrationEur: number;
  adminBufferEur: number;
  vatRate: number;
  customsDutyRate: number;
  confidence: Confidence;
  assumptions: string[];
  sourceUrls: string[];
};

const rdwRegistrationUrl = 'https://www.rdw.nl/particulier/voertuigen/auto/invoeren-exporteren-doorvoeren/invoeren-vanuit-eu--of-eva-land';
const belastingdienstBpmUrl = 'https://www.belastingdienst.nl/wps/wcm/connect/nl/auto-en-vervoer/content/bpm-berekenen-en-betalen';
const douaneImportUrl = 'https://www.belastingdienst.nl/wps/wcm/connect/nl/internetaankopen/content/moet-ik-invoerrechten-betalen';

export const importCountryProfiles: Record<ImportProfileKey, ImportCountryProfile> = {
  NL: {
    key: 'NL',
    countryLabel: 'Netherlands',
    region: 'domestic-nl',
    transportEur: 0,
    rdwInspectionEur: 0,
    platesAndRegistrationEur: 0,
    adminBufferEur: 0,
    vatRate: 0,
    customsDutyRate: 0,
    confidence: 'high',
    assumptions: ['Al geregistreerd/aangeboden in Nederland; geen importlogistiek, btw, douane of BPM-importworkflow aangenomen.'],
    sourceUrls: [rdwRegistrationUrl, belastingdienstBpmUrl],
  },
  BE: {
    key: 'BE',
    countryLabel: 'Belgium',
    region: 'eu-efta',
    transportEur: 450,
    rdwInspectionEur: 120,
    platesAndRegistrationEur: 60,
    adminBufferEur: 250,
    vatRate: 0,
    customsDutyRate: 0,
    confidence: 'medium',
    assumptions: ['Nabije EU/EFTA-importlaag; gaat uit van door koper geregeld transport of ophalen plus Nederlandse RDW-registratie.', 'EU/EFTA-import van gebruikte auto’s heeft normaal geen Nederlandse invoerrechten of import-btw, maar BPM-aangifte blijft vereist.'],
    sourceUrls: [rdwRegistrationUrl, belastingdienstBpmUrl],
  },
  DE: {
    key: 'DE',
    countryLabel: 'Germany',
    region: 'eu-efta',
    transportEur: 650,
    rdwInspectionEur: 120,
    platesAndRegistrationEur: 60,
    adminBufferEur: 275,
    vatRate: 0,
    customsDutyRate: 0,
    confidence: 'medium',
    assumptions: ['Gangbare EU/EFTA-importlaag uit West-Duitsland; transportschatting is hoger dan België vanwege afstand en handling.', 'EU/EFTA-import van gebruikte auto’s heeft normaal geen Nederlandse invoerrechten of import-btw, maar BPM-aangifte blijft vereist.'],
    sourceUrls: [rdwRegistrationUrl, belastingdienstBpmUrl],
  },
  FR: {
    key: 'FR',
    countryLabel: 'France',
    region: 'eu-efta',
    transportEur: 900,
    rdwInspectionEur: 120,
    platesAndRegistrationEur: 60,
    adminBufferEur: 325,
    vatRate: 0,
    customsDutyRate: 0,
    confidence: 'medium',
    assumptions: ['EU/EFTA-importlaag op grotere afstand; transportschatting ligt boven België en Duitsland voor ophalen in Noord-/Midden-Frankrijk.', 'EU/EFTA-import van gebruikte auto’s heeft normaal geen Nederlandse invoerrechten of import-btw, maar BPM-aangifte blijft vereist.'],
    sourceUrls: [rdwRegistrationUrl, belastingdienstBpmUrl],
  },
  NON_EU: {
    key: 'NON_EU',
    countryLabel: 'Non-EU placeholder',
    region: 'non-eu',
    transportEur: 1500,
    rdwInspectionEur: 180,
    platesAndRegistrationEur: 80,
    adminBufferEur: 750,
    vatRate: 0.21,
    customsDutyRate: 0.1,
    confidence: 'low',
    assumptions: ['Placeholder voor import van buiten EU/EFTA; echte kosten hangen af van herkomst, transport, douanewaarde, voertuigtype en vrijstellingsstatus.', 'Past indicatieve Nederlandse btw- en douaneplaceholders toe op voertuigwaarde en transportbasis totdat een broker-offerte beschikbaar is.'],
    sourceUrls: [rdwRegistrationUrl, belastingdienstBpmUrl, douaneImportUrl],
  },
};

export function importProfileForCountry(country: string): ImportCountryProfile {
  return importCountryProfiles[(country.toUpperCase() as ImportProfileKey)] ?? importCountryProfiles.NON_EU;
}
