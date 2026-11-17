import type { User } from "../../shared/contracts";
// Yalnızca arayüzü göstermek içindir; yetki kontrolü sunucuda yapılır.
export const hasRole = (user: User | null, ...roles: User["roles"]) =>
  !!user && roles.some((r) => user.roles?.includes(r));
export const isModerator = (user: User | null) =>
  hasRole(user, "moderator", "admin");
export const isReviewer = (user: User | null) =>
  hasRole(user, "reviewer", "admin");
