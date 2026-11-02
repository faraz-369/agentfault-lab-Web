export type Scenario = {
  scenario_id: string;
  name: string;
  description: string;
  tags: string[];
};

export type ExecutionEvent = {
  event_id: string;
  run_id: string;
  sequence: number;
  timestamp: string;
  event_type: string;
  step: number;
  name: string;
  details: Record<string, unknown>;
};

export type RunResult = {
  run_id: string;
  scenario_id: string;
  policy: string;
  success: boolean;
  final_state: Record<string, unknown>;
  event_count: number;
  tool_calls: number;
  retries: number;
  invariant_violations: Array<Record<string, unknown>>;
  first_violation_sequence: number | null;
  fault_injected: boolean;
  error: string | null;
  duration_ms: number;
  events: ExecutionEvent[];
};

export type ExperimentReport = {
  experiment_id: string;
  methodology_note?: string;
  [key: string]: unknown;
};
