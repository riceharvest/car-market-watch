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
    assumptions: ['Already registered/marketed domestically in the Netherlands; no import logistics, VAT, customs, or BPM import workflow assumed.'],
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
    assumptions: ['Nearby EU/EFTA import tier; assumes buyer-arranged transport or pickup plus Dutch RDW registration workflow.', 'EU/EFTA used-car imports normally do not incur Dutch customs duty or import VAT, but a BPM return is still required.'],
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
    assumptions: ['Common EU/EFTA import tier from western Germany; transport estimate is higher than Belgium to allow for distance and handling.', 'EU/EFTA used-car imports normally do not incur Dutch customs duty or import VAT, but a BPM return is still required.'],
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
    assumptions: ['Longer-distance EU/EFTA import tier; transport estimate is above Belgium and Germany for collection from northern/central France.', 'EU/EFTA used-car imports normally do not incur Dutch customs duty or import VAT, but a BPM return is still required.'],
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
    assumptions: ['Placeholder for imports from outside the EU/EFTA; real costs depend on origin, shipping, customs value, vehicle type, and exemption status.', 'Applies indicative Dutch VAT and customs placeholders to the vehicle value and transport base until a broker quote is available.'],
    sourceUrls: [rdwRegistrationUrl, belastingdienstBpmUrl, douaneImportUrl],
  },
};

export function importProfileForCountry(country: string): ImportCountryProfile {
  return importCountryProfiles[(country.toUpperCase() as ImportProfileKey)] ?? importCountryProfiles.NON_EU;
}
