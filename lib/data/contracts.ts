// Contract data for dynasty analysis
// Source: Spotrac, Over The Cap (January 2025)

export interface ContractInfo {
  totalYears: number;
  totalValue: number;        // millions
  guaranteed: number;        // millions
  yearsRemaining: number;
  avgAnnual: number;         // millions per year
  deadCap2025: number;       // dead cap if cut in 2025
  capHit2025: number;
  isRookieDeal: boolean;
  extensionEligible: boolean;
  recentlyExtended: boolean; // signed extension in last 12 months
  contractYear: boolean;     // final year of deal
  status: 'elite' | 'secure' | 'tradeable' | 'cuttable' | 'expiring';
}

// Top ~100 dynasty-relevant players with contract info
export const CONTRACT_DATA: Record<string, ContractInfo> = {
  // ELITE QBs
  'Patrick Mahomes': {
    totalYears: 10, totalValue: 450, guaranteed: 141,
    yearsRemaining: 7, avgAnnual: 45, deadCap2025: 82, capHit2025: 46,
    isRookieDeal: false, extensionEligible: false, recentlyExtended: false,
    contractYear: false, status: 'elite'
  },
  'Joe Burrow': {
    totalYears: 5, totalValue: 275, guaranteed: 219,
    yearsRemaining: 4, avgAnnual: 55, deadCap2025: 98, capHit2025: 42,
    isRookieDeal: false, extensionEligible: false, recentlyExtended: true,
    contractYear: false, status: 'elite'
  },
  'Josh Allen': {
    totalYears: 6, totalValue: 258, guaranteed: 150,
    yearsRemaining: 3, avgAnnual: 43, deadCap2025: 65, capHit2025: 45,
    isRookieDeal: false, extensionEligible: false, recentlyExtended: false,
    contractYear: false, status: 'elite'
  },
  'Lamar Jackson': {
    totalYears: 5, totalValue: 260, guaranteed: 185,
    yearsRemaining: 4, avgAnnual: 52, deadCap2025: 88, capHit2025: 40,
    isRookieDeal: false, extensionEligible: false, recentlyExtended: true,
    contractYear: false, status: 'elite'
  },
  'Jalen Hurts': {
    totalYears: 5, totalValue: 255, guaranteed: 179,
    yearsRemaining: 4, avgAnnual: 51, deadCap2025: 85, capHit2025: 38,
    isRookieDeal: false, extensionEligible: false, recentlyExtended: true,
    contractYear: false, status: 'elite'
  },
  'Justin Herbert': {
    totalYears: 5, totalValue: 262, guaranteed: 218,
    yearsRemaining: 4, avgAnnual: 52, deadCap2025: 95, capHit2025: 35,
    isRookieDeal: false, extensionEligible: false, recentlyExtended: true,
    contractYear: false, status: 'elite'
  },
  'Trevor Lawrence': {
    totalYears: 5, totalValue: 275, guaranteed: 200,
    yearsRemaining: 5, avgAnnual: 55, deadCap2025: 78, capHit2025: 32,
    isRookieDeal: false, extensionEligible: false, recentlyExtended: true,
    contractYear: false, status: 'elite'
  },
  'Dak Prescott': {
    totalYears: 4, totalValue: 240, guaranteed: 231,
    yearsRemaining: 4, avgAnnual: 60, deadCap2025: 120, capHit2025: 55,
    isRookieDeal: false, extensionEligible: false, recentlyExtended: true,
    contractYear: false, status: 'elite'
  },
  'Tua Tagovailoa': {
    totalYears: 4, totalValue: 212, guaranteed: 167,
    yearsRemaining: 4, avgAnnual: 53, deadCap2025: 75, capHit2025: 38,
    isRookieDeal: false, extensionEligible: false, recentlyExtended: true,
    contractYear: false, status: 'secure'
  },
  'C.J. Stroud': {
    totalYears: 4, totalValue: 36, guaranteed: 36,
    yearsRemaining: 3, avgAnnual: 9, deadCap2025: 18, capHit2025: 10,
    isRookieDeal: true, extensionEligible: false, recentlyExtended: false,
    contractYear: false, status: 'elite'
  },
  'Caleb Williams': {
    totalYears: 4, totalValue: 39, guaranteed: 39,
    yearsRemaining: 4, avgAnnual: 10, deadCap2025: 25, capHit2025: 9,
    isRookieDeal: true, extensionEligible: false, recentlyExtended: false,
    contractYear: false, status: 'secure'
  },
  'Jayden Daniels': {
    totalYears: 4, totalValue: 37, guaranteed: 37,
    yearsRemaining: 4, avgAnnual: 9, deadCap2025: 24, capHit2025: 8,
    isRookieDeal: true, extensionEligible: false, recentlyExtended: false,
    contractYear: false, status: 'secure'
  },
  'Drake Maye': {
    totalYears: 4, totalValue: 36, guaranteed: 36,
    yearsRemaining: 4, avgAnnual: 9, deadCap2025: 23, capHit2025: 8,
    isRookieDeal: true, extensionEligible: false, recentlyExtended: false,
    contractYear: false, status: 'secure'
  },
  'Anthony Richardson': {
    totalYears: 4, totalValue: 34, guaranteed: 34,
    yearsRemaining: 3, avgAnnual: 9, deadCap2025: 16, capHit2025: 9,
    isRookieDeal: true, extensionEligible: false, recentlyExtended: false,
    contractYear: false, status: 'tradeable'
  },
  'Bryce Young': {
    totalYears: 4, totalValue: 38, guaranteed: 38,
    yearsRemaining: 3, avgAnnual: 10, deadCap2025: 19, capHit2025: 10,
    isRookieDeal: true, extensionEligible: false, recentlyExtended: false,
    contractYear: false, status: 'tradeable'
  },
  'Jordan Love': {
    totalYears: 4, totalValue: 220, guaranteed: 155,
    yearsRemaining: 4, avgAnnual: 55, deadCap2025: 75, capHit2025: 40,
    isRookieDeal: false, extensionEligible: false, recentlyExtended: true,
    contractYear: false, status: 'secure'
  },
  'Baker Mayfield': {
    totalYears: 3, totalValue: 100, guaranteed: 50,
    yearsRemaining: 2, avgAnnual: 33, deadCap2025: 28, capHit2025: 35,
    isRookieDeal: false, extensionEligible: false, recentlyExtended: true,
    contractYear: false, status: 'secure'
  },
  'Brock Purdy': {
    totalYears: 4, totalValue: 3.7, guaranteed: 0.9,
    yearsRemaining: 1, avgAnnual: 0.9, deadCap2025: 0, capHit2025: 1.1,
    isRookieDeal: true, extensionEligible: true, recentlyExtended: false,
    contractYear: true, status: 'expiring'
  },

  // ELITE WRs
  "Ja'Marr Chase": {
    totalYears: 4, totalValue: 35, guaranteed: 30,
    yearsRemaining: 1, avgAnnual: 9, deadCap2025: 7, capHit2025: 11,
    isRookieDeal: true, extensionEligible: true, recentlyExtended: false,
    contractYear: true, status: 'expiring'
  },
  'Justin Jefferson': {
    totalYears: 4, totalValue: 140, guaranteed: 110,
    yearsRemaining: 4, avgAnnual: 35, deadCap2025: 65, capHit2025: 28,
    isRookieDeal: false, extensionEligible: false, recentlyExtended: true,
    contractYear: false, status: 'elite'
  },
  'CeeDee Lamb': {
    totalYears: 4, totalValue: 136, guaranteed: 100,
    yearsRemaining: 4, avgAnnual: 34, deadCap2025: 58, capHit2025: 26,
    isRookieDeal: false, extensionEligible: false, recentlyExtended: true,
    contractYear: false, status: 'elite'
  },
  "Amon-Ra St. Brown": {
    totalYears: 4, totalValue: 120, guaranteed: 77,
    yearsRemaining: 4, avgAnnual: 30, deadCap2025: 45, capHit2025: 24,
    isRookieDeal: false, extensionEligible: false, recentlyExtended: true,
    contractYear: false, status: 'elite'
  },
  'Tyreek Hill': {
    totalYears: 4, totalValue: 120, guaranteed: 72,
    yearsRemaining: 2, avgAnnual: 30, deadCap2025: 32, capHit2025: 32,
    isRookieDeal: false, extensionEligible: false, recentlyExtended: false,
    contractYear: false, status: 'tradeable'
  },
  'A.J. Brown': {
    totalYears: 4, totalValue: 100, guaranteed: 57,
    yearsRemaining: 2, avgAnnual: 25, deadCap2025: 28, capHit2025: 27,
    isRookieDeal: false, extensionEligible: false, recentlyExtended: false,
    contractYear: false, status: 'secure'
  },
  'Davante Adams': {
    totalYears: 5, totalValue: 140, guaranteed: 65,
    yearsRemaining: 2, avgAnnual: 28, deadCap2025: 18, capHit2025: 36,
    isRookieDeal: false, extensionEligible: false, recentlyExtended: false,
    contractYear: false, status: 'cuttable'
  },
  'Malik Nabers': {
    totalYears: 4, totalValue: 30, guaranteed: 30,
    yearsRemaining: 4, avgAnnual: 7.5, deadCap2025: 18, capHit2025: 7,
    isRookieDeal: true, extensionEligible: false, recentlyExtended: false,
    contractYear: false, status: 'elite'
  },
  'Marvin Harrison Jr.': {
    totalYears: 4, totalValue: 35, guaranteed: 35,
    yearsRemaining: 4, avgAnnual: 9, deadCap2025: 22, capHit2025: 8,
    isRookieDeal: true, extensionEligible: false, recentlyExtended: false,
    contractYear: false, status: 'elite'
  },
  'Garrett Wilson': {
    totalYears: 4, totalValue: 17, guaranteed: 17,
    yearsRemaining: 2, avgAnnual: 4, deadCap2025: 6, capHit2025: 5,
    isRookieDeal: true, extensionEligible: true, recentlyExtended: false,
    contractYear: false, status: 'secure'
  },
  'Chris Olave': {
    totalYears: 4, totalValue: 17, guaranteed: 17,
    yearsRemaining: 2, avgAnnual: 4, deadCap2025: 6, capHit2025: 5,
    isRookieDeal: true, extensionEligible: true, recentlyExtended: false,
    contractYear: false, status: 'secure'
  },
  'Drake London': {
    totalYears: 4, totalValue: 20, guaranteed: 20,
    yearsRemaining: 2, avgAnnual: 5, deadCap2025: 7, capHit2025: 6,
    isRookieDeal: true, extensionEligible: true, recentlyExtended: false,
    contractYear: false, status: 'secure'
  },
  'Jaylen Waddle': {
    totalYears: 4, totalValue: 16, guaranteed: 16,
    yearsRemaining: 1, avgAnnual: 4, deadCap2025: 3, capHit2025: 5,
    isRookieDeal: true, extensionEligible: true, recentlyExtended: false,
    contractYear: true, status: 'expiring'
  },
  'DeVonta Smith': {
    totalYears: 3, totalValue: 75, guaranteed: 51,
    yearsRemaining: 3, avgAnnual: 25, deadCap2025: 38, capHit2025: 22,
    isRookieDeal: false, extensionEligible: false, recentlyExtended: true,
    contractYear: false, status: 'secure'
  },
  'Nico Collins': {
    totalYears: 3, totalValue: 72, guaranteed: 46,
    yearsRemaining: 3, avgAnnual: 24, deadCap2025: 32, capHit2025: 20,
    isRookieDeal: false, extensionEligible: false, recentlyExtended: true,
    contractYear: false, status: 'secure'
  },
  'Puka Nacua': {
    totalYears: 4, totalValue: 4, guaranteed: 0.8,
    yearsRemaining: 3, avgAnnual: 1, deadCap2025: 0.5, capHit2025: 1.1,
    isRookieDeal: true, extensionEligible: false, recentlyExtended: false,
    contractYear: false, status: 'elite'
  },
  'Brian Thomas Jr.': {
    totalYears: 4, totalValue: 16, guaranteed: 16,
    yearsRemaining: 4, avgAnnual: 4, deadCap2025: 10, capHit2025: 4,
    isRookieDeal: true, extensionEligible: false, recentlyExtended: false,
    contractYear: false, status: 'secure'
  },
  'Rome Odunze': {
    totalYears: 4, totalValue: 22, guaranteed: 22,
    yearsRemaining: 4, avgAnnual: 5.5, deadCap2025: 14, capHit2025: 5,
    isRookieDeal: true, extensionEligible: false, recentlyExtended: false,
    contractYear: false, status: 'secure'
  },
  'Ladd McConkey': {
    totalYears: 4, totalValue: 8, guaranteed: 4,
    yearsRemaining: 4, avgAnnual: 2, deadCap2025: 3, capHit2025: 2,
    isRookieDeal: true, extensionEligible: false, recentlyExtended: false,
    contractYear: false, status: 'secure'
  },
  'Terry McLaurin': {
    totalYears: 3, totalValue: 71, guaranteed: 53,
    yearsRemaining: 1, avgAnnual: 24, deadCap2025: 8, capHit2025: 27,
    isRookieDeal: false, extensionEligible: true, recentlyExtended: false,
    contractYear: true, status: 'expiring'
  },
  'DK Metcalf': {
    totalYears: 3, totalValue: 72, guaranteed: 58,
    yearsRemaining: 1, avgAnnual: 24, deadCap2025: 11, capHit2025: 31,
    isRookieDeal: false, extensionEligible: true, recentlyExtended: false,
    contractYear: true, status: 'expiring'
  },
  'Stefon Diggs': {
    totalYears: 4, totalValue: 104, guaranteed: 70,
    yearsRemaining: 2, avgAnnual: 26, deadCap2025: 20, capHit2025: 29,
    isRookieDeal: false, extensionEligible: false, recentlyExtended: false,
    contractYear: false, status: 'tradeable'
  },
  'Tee Higgins': {
    totalYears: 1, totalValue: 21, guaranteed: 21,
    yearsRemaining: 1, avgAnnual: 21, deadCap2025: 0, capHit2025: 21,
    isRookieDeal: false, extensionEligible: true, recentlyExtended: false,
    contractYear: true, status: 'expiring'
  },
  'Mike Evans': {
    totalYears: 2, totalValue: 52, guaranteed: 35,
    yearsRemaining: 1, avgAnnual: 26, deadCap2025: 8, capHit2025: 28,
    isRookieDeal: false, extensionEligible: true, recentlyExtended: false,
    contractYear: true, status: 'expiring'
  },

  // ELITE RBs
  'Bijan Robinson': {
    totalYears: 4, totalValue: 22, guaranteed: 17,
    yearsRemaining: 3, avgAnnual: 5.5, deadCap2025: 8, capHit2025: 5,
    isRookieDeal: true, extensionEligible: false, recentlyExtended: false,
    contractYear: false, status: 'elite'
  },
  'Breece Hall': {
    totalYears: 4, totalValue: 10, guaranteed: 6,
    yearsRemaining: 2, avgAnnual: 2.5, deadCap2025: 3, capHit2025: 3,
    isRookieDeal: true, extensionEligible: true, recentlyExtended: false,
    contractYear: false, status: 'elite'
  },
  'Jahmyr Gibbs': {
    totalYears: 4, totalValue: 11, guaranteed: 6,
    yearsRemaining: 3, avgAnnual: 2.8, deadCap2025: 3, capHit2025: 2.5,
    isRookieDeal: true, extensionEligible: false, recentlyExtended: false,
    contractYear: false, status: 'elite'
  },
  'Jonathan Taylor': {
    totalYears: 3, totalValue: 42, guaranteed: 26,
    yearsRemaining: 2, avgAnnual: 14, deadCap2025: 14, capHit2025: 15,
    isRookieDeal: false, extensionEligible: false, recentlyExtended: false,
    contractYear: false, status: 'secure'
  },
  'Saquon Barkley': {
    totalYears: 3, totalValue: 37, guaranteed: 26,
    yearsRemaining: 2, avgAnnual: 12, deadCap2025: 15, capHit2025: 13,
    isRookieDeal: false, extensionEligible: false, recentlyExtended: true,
    contractYear: false, status: 'secure'
  },
  'Derrick Henry': {
    totalYears: 2, totalValue: 16, guaranteed: 9,
    yearsRemaining: 1, avgAnnual: 8, deadCap2025: 3, capHit2025: 9,
    isRookieDeal: false, extensionEligible: true, recentlyExtended: false,
    contractYear: true, status: 'expiring'
  },
  'Josh Jacobs': {
    totalYears: 4, totalValue: 48, guaranteed: 33,
    yearsRemaining: 3, avgAnnual: 12, deadCap2025: 20, capHit2025: 12,
    isRookieDeal: false, extensionEligible: false, recentlyExtended: true,
    contractYear: false, status: 'secure'
  },
  'De\'Von Achane': {
    totalYears: 4, totalValue: 5, guaranteed: 1,
    yearsRemaining: 2, avgAnnual: 1.3, deadCap2025: 0.5, capHit2025: 1.4,
    isRookieDeal: true, extensionEligible: false, recentlyExtended: false,
    contractYear: false, status: 'elite'
  },
  'Kyren Williams': {
    totalYears: 4, totalValue: 3.8, guaranteed: 0.08,
    yearsRemaining: 1, avgAnnual: 1, deadCap2025: 0, capHit2025: 1.2,
    isRookieDeal: true, extensionEligible: true, recentlyExtended: false,
    contractYear: true, status: 'expiring'
  },
  'Kenneth Walker III': {
    totalYears: 4, totalValue: 6, guaranteed: 2,
    yearsRemaining: 2, avgAnnual: 1.5, deadCap2025: 1, capHit2025: 1.7,
    isRookieDeal: true, extensionEligible: true, recentlyExtended: false,
    contractYear: false, status: 'secure'
  },
  'James Cook': {
    totalYears: 4, totalValue: 5, guaranteed: 1,
    yearsRemaining: 2, avgAnnual: 1.3, deadCap2025: 0.5, capHit2025: 1.5,
    isRookieDeal: true, extensionEligible: true, recentlyExtended: false,
    contractYear: false, status: 'secure'
  },
  'Jonathon Brooks': {
    totalYears: 4, totalValue: 13, guaranteed: 8,
    yearsRemaining: 4, avgAnnual: 3.3, deadCap2025: 5, capHit2025: 3,
    isRookieDeal: true, extensionEligible: false, recentlyExtended: false,
    contractYear: false, status: 'secure'
  },
  'Alvin Kamara': {
    totalYears: 5, totalValue: 75, guaranteed: 47,
    yearsRemaining: 1, avgAnnual: 15, deadCap2025: 5, capHit2025: 21,
    isRookieDeal: false, extensionEligible: true, recentlyExtended: false,
    contractYear: true, status: 'cuttable'
  },
  'Travis Etienne': {
    totalYears: 4, totalValue: 10, guaranteed: 6,
    yearsRemaining: 1, avgAnnual: 2.5, deadCap2025: 1, capHit2025: 3,
    isRookieDeal: true, extensionEligible: true, recentlyExtended: false,
    contractYear: true, status: 'expiring'
  },
  'Rachaad White': {
    totalYears: 4, totalValue: 4.5, guaranteed: 0.3,
    yearsRemaining: 2, avgAnnual: 1.1, deadCap2025: 0.2, capHit2025: 1.3,
    isRookieDeal: true, extensionEligible: true, recentlyExtended: false,
    contractYear: false, status: 'tradeable'
  },
  'Joe Mixon': {
    totalYears: 3, totalValue: 27, guaranteed: 15,
    yearsRemaining: 2, avgAnnual: 9, deadCap2025: 7, capHit2025: 10,
    isRookieDeal: false, extensionEligible: false, recentlyExtended: false,
    contractYear: false, status: 'tradeable'
  },

  // ELITE TEs
  'Sam LaPorta': {
    totalYears: 4, totalValue: 7, guaranteed: 3,
    yearsRemaining: 3, avgAnnual: 1.8, deadCap2025: 1.5, capHit2025: 1.7,
    isRookieDeal: true, extensionEligible: false, recentlyExtended: false,
    contractYear: false, status: 'elite'
  },
  'Travis Kelce': {
    totalYears: 4, totalValue: 57, guaranteed: 28,
    yearsRemaining: 2, avgAnnual: 14, deadCap2025: 12, capHit2025: 17,
    isRookieDeal: false, extensionEligible: false, recentlyExtended: false,
    contractYear: false, status: 'secure'
  },
  'George Kittle': {
    totalYears: 5, totalValue: 75, guaranteed: 40,
    yearsRemaining: 2, avgAnnual: 15, deadCap2025: 10, capHit2025: 16,
    isRookieDeal: false, extensionEligible: false, recentlyExtended: false,
    contractYear: false, status: 'secure'
  },
  'Mark Andrews': {
    totalYears: 4, totalValue: 56, guaranteed: 37,
    yearsRemaining: 2, avgAnnual: 14, deadCap2025: 15, capHit2025: 15,
    isRookieDeal: false, extensionEligible: false, recentlyExtended: false,
    contractYear: false, status: 'secure'
  },
  'Trey McBride': {
    totalYears: 4, totalValue: 6, guaranteed: 2,
    yearsRemaining: 2, avgAnnual: 1.5, deadCap2025: 0.8, capHit2025: 1.8,
    isRookieDeal: true, extensionEligible: true, recentlyExtended: false,
    contractYear: false, status: 'elite'
  },
  'Brock Bowers': {
    totalYears: 4, totalValue: 18, guaranteed: 12,
    yearsRemaining: 4, avgAnnual: 4.5, deadCap2025: 8, capHit2025: 4,
    isRookieDeal: true, extensionEligible: false, recentlyExtended: false,
    contractYear: false, status: 'elite'
  },
  'Evan Engram': {
    totalYears: 3, totalValue: 41, guaranteed: 24,
    yearsRemaining: 1, avgAnnual: 14, deadCap2025: 5, capHit2025: 17,
    isRookieDeal: false, extensionEligible: true, recentlyExtended: false,
    contractYear: true, status: 'expiring'
  },
  'Dallas Goedert': {
    totalYears: 4, totalValue: 57, guaranteed: 35,
    yearsRemaining: 2, avgAnnual: 14, deadCap2025: 10, capHit2025: 15,
    isRookieDeal: false, extensionEligible: false, recentlyExtended: false,
    contractYear: false, status: 'secure'
  },
  'David Njoku': {
    totalYears: 4, totalValue: 56, guaranteed: 28,
    yearsRemaining: 3, avgAnnual: 14, deadCap2025: 16, capHit2025: 14,
    isRookieDeal: false, extensionEligible: false, recentlyExtended: true,
    contractYear: false, status: 'secure'
  },
  'Kyle Pitts': {
    totalYears: 4, totalValue: 32, guaranteed: 32,
    yearsRemaining: 2, avgAnnual: 8, deadCap2025: 8, capHit2025: 11,
    isRookieDeal: true, extensionEligible: true, recentlyExtended: false,
    contractYear: false, status: 'tradeable'
  },
};

export function getContractInfo(playerName: string): ContractInfo | null {
  return CONTRACT_DATA[playerName] || null;
}

export function getContractSummary(contract: ContractInfo): string {
  const yearsLeft = contract.yearsRemaining === 1 ? 'Final year' : `${contract.yearsRemaining}yr`;
  const value = contract.avgAnnual >= 10 ? `$${contract.avgAnnual}M/yr` : `$${(contract.avgAnnual).toFixed(1)}M/yr`;
  const deadCap = `$${contract.deadCap2025}M dead cap`;

  return `${yearsLeft}, ${value}, ${deadCap} - ${contract.status.toUpperCase()}`;
}

export function getContractRisk(contract: ContractInfo): 'low' | 'medium' | 'high' {
  // High risk: expiring, cuttable, or extension talks
  if (contract.contractYear || contract.status === 'cuttable' || contract.status === 'expiring') {
    return 'high';
  }
  // Medium risk: tradeable or recently extended (might decline)
  if (contract.status === 'tradeable' || contract.recentlyExtended) {
    return 'medium';
  }
  // Low risk: elite, secure, or rookie deal
  return 'low';
}
