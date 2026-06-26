export type DecimalString = string;
export type SchemaVersion = 1;
export type PriceBasis = "constant" | "nominal";
export type ScenarioKind = "owned" | "cloud";
export type OwnedAssetType = "nas" | "mini-pc" | "other-owned";
export type RecommendationCode =
  | "cost-favors-owned"
  | "cost-favors-cloud"
  | "too-close-to-call"
  | "sensitivity-dependent";

export interface CostLine {
  id: string;
  label: string;
  amount: DecimalString;
}

export interface RecurringCostLine {
  id: string;
  label: string;
  monthlyAmount: DecimalString;
  annualEscalationRate: DecimalString;
}

export interface ScheduledCostLine extends CostLine {
  month: number;
}

export interface DepreciationPolicy {
  depreciableCapitalIds: string[];
  usefulLifeMonths: number;
  residualValue: DecimalString;
}

export interface OwnedScenarioInput {
  id: string;
  label: string;
  kind: "owned";
  assetType: OwnedAssetType;
  initialCapex: CostLine[];
  scheduledCosts?: ScheduledCostLine[];
  annualEnergyKwh: DecimalString;
  electricityRatePerKwh: DecimalString;
  electricityEscalationRate: DecimalString;
  annualMaintenance: DecimalString;
  maintenanceEscalationRate: DecimalString;
  otherMonthlyRecurring?: RecurringCostLine[];
  salvageValue?: DecimalString;
  depreciation?: DepreciationPolicy;
  notes?: string[];
}

export interface CloudScenarioInput {
  id: string;
  label: string;
  kind: "cloud";
  initialCosts?: CostLine[];
  scheduledCosts?: ScheduledCostLine[];
  monthlyRecurring: RecurringCostLine[];
  monthlyEgressGb: DecimalString;
  egressRatePerGb: DecimalString;
  egressEscalationRate: DecimalString;
  notes?: string[];
}

export type ScenarioInput = OwnedScenarioInput | CloudScenarioInput;

export interface ComparisonInput {
  schemaVersion: SchemaVersion;
  id: string;
  label: string;
  baseDate: string;
  currency: string;
  priceBasis: PriceBasis;
  horizonMonths: number;
  materialityThresholdPercent: DecimalString;
  scenarios: ScenarioInput[];
}

export interface SensitivityCase {
  id: string;
  label: string;
  comparison?: ComparisonInput;
}

export interface MonthlyCashFlow {
  month: number;
  capitalCost: DecimalString;
  recurringCost: DecimalString;
  scheduledCost: DecimalString;
  cumulativeGrossCashCost: DecimalString;
}

export interface ScenarioResult {
  id: string;
  label: string;
  kind: ScenarioKind;
  grossCashTco: DecimalString;
  netCashTco: DecimalString;
  salvageValue: DecimalString;
  monthlyCashFlows: MonthlyCashFlow[];
  depreciation?: {
    monthlyDepreciation: DecimalString;
    accumulatedDepreciation: DecimalString;
    endBookValue: DecimalString;
  };
}

export interface PairBreakEvenResult {
  ownedScenarioId: string;
  cloudScenarioId: string;
  durableBreakEvenMonth: number | null;
  crossoverMonths: number[];
}

export interface ComparisonResult {
  schemaVersion: SchemaVersion;
  input: ComparisonInput;
  scenarios: ScenarioResult[];
  pairBreakEvens: PairBreakEvenResult[];
  lowestOwnedScenarioId: string;
  lowestCloudScenarioId: string;
  tcoDifference: DecimalString;
  recommendation: {
    code: RecommendationCode;
    explanation: string;
    disclaimer: string;
  };
}

export interface SensitivityResult {
  schemaVersion: SchemaVersion;
  base: ComparisonResult;
  cases: Array<
    | { id: string; label: string; result: ComparisonResult }
    | { id: string; label: string; error: ValidationIssue }
  >;
  recommendation: ComparisonResult["recommendation"];
}

export interface ValidationIssue {
  code: string;
  path: string;
  message: string;
}
