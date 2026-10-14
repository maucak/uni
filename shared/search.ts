import { searchStateSchema, type SearchState } from "./contracts.ts";
export function searchFromParams(params: URLSearchParams): SearchState {
  const input: Record<string, unknown> = {};
  for (const [key, value] of params) {
    if (["rankMin", "rankMax", "maxTuition", "minScholarship"].includes(key))
      input[key] = value === "" ? null : Number(value);
    else if (key === "includeUnknown") input[key] = value !== "false";
    else input[key] = value;
  }
  return searchStateSchema.parse(input);
}
export function searchToParams(state: SearchState) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(state)) {
    if (value === null || value === "") continue;
    params.set(key, String(value));
  }
  return params;
}
