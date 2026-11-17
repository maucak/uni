import { z } from "zod";

export const mentorProfileInput = z.object({
  accepting: z.boolean(),
  topics: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  bio: z.string().trim().max(600).default(""),
  universityId: z.uuid().nullable().optional(),
  programId: z.uuid().nullable().optional(),
});
export const mentorshipRequestInput = z.object({
  mentorId: z.uuid(),
  topic: z.string().trim().min(2).max(80),
  message: z.string().trim().min(10).max(1000),
});
export type Mentor = {
  userId: string;
  displayName: string;
  accepting: boolean;
  topics: string[];
  bio: string;
  universityId: string | null;
  university: string | null;
  programId: string | null;
  program: string | null;
};
export type MentorProfile = {
  eligible: boolean;
  profile: Mentor | null;
  universities: { id: string; name: string }[];
};
export type MentorshipRequest = {
  id: string;
  box: "incoming" | "outgoing";
  topic: string;
  message: string;
  status: "pending" | "accepted" | "declined" | "cancelled" | "completed";
  createdAt: string;
  respondedAt: string | null;
  other: { userId: string; displayName: string };
};
