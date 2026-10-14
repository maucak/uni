import type { Program, SearchState } from "../../shared/contracts.ts";
export function filterPrograms(programs: Program[], state: SearchState) {
  const search = state.search.toLocaleLowerCase("tr-TR");
  return programs.filter((p) => {
    if (
      (state.dataKind === "real" && p.isSample) ||
      (state.dataKind === "sample" && !p.isSample)
    )
      return false;
    if (
      search &&
      !`${p.name} ${p.university} ${p.subjects.join(" ")}`
        .toLocaleLowerCase("tr-TR")
        .includes(search)
    )
      return false;
    if (
      (state.city && p.city !== state.city) ||
      (state.scoreType && p.scoreType !== state.scoreType) ||
      (state.language && p.language !== state.language) ||
      (state.type && p.universityType !== state.type)
    )
      return false;
    if (state.rankMin !== null || state.rankMax !== null) {
      if (p.rank === null) {
        if (!state.includeUnknown) return false;
      } else if (
        (state.rankMin !== null && p.rank < state.rankMin) ||
        (state.rankMax !== null && p.rank > state.rankMax)
      )
        return false;
    }
    if (state.maxTuition !== null) {
      if (p.tuition == null) {
        if (!state.includeUnknown) return false;
      } else if (p.tuition > state.maxTuition) return false;
    }
    if (state.minScholarship !== null) {
      if (p.scholarshipPercent == null) {
        if (!state.includeUnknown) return false;
      } else if (p.scholarshipPercent < state.minScholarship) return false;
    }
    return true;
  });
}
export function sortPrograms(programs: Program[], sort: SearchState["sort"]) {
  return [...programs].sort((a, b) =>
    sort === "rank"
      ? (a.rank ?? Number.MAX_SAFE_INTEGER) -
          (b.rank ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id)
      : `${a.university} ${a.name} ${a.language}`.localeCompare(
          `${b.university} ${b.name} ${b.language}`,
          "tr",
        ) || a.id.localeCompare(b.id),
  );
}
