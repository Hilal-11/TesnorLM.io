/** Roles and explanation levels (Beginner · Intermediate · Expert), shared by server and client. */
export const ROLES = ["student", "instructor", "developer", "researcher"] as const;
export const LEVELS = ["beginner", "intermediate", "expert"] as const;
export type Role = (typeof ROLES)[number];
export type Level = (typeof LEVELS)[number];
