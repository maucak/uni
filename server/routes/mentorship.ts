import { Router } from "express";
import { z } from "zod";
import { rateLimit } from "express-rate-limit";
import {
  mentorProfileInput,
  mentorshipRequestInput,
} from "../../shared/mentorship.ts";
import { requireUser, requireVerifiedEmail } from "../auth.ts";
import { mentorshipActions } from "../services/mentorship-rules.ts";
import {
  listMentors,
  getMentorProfile,
  saveMentorProfile,
  createMentorshipRequest,
  listMentorshipRequests,
  updateMentorshipRequest,
} from "../services/mentorship.ts";
const api = Router();
const uuid = z.uuid();
const requestLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (_req, res) => `u:${res.locals.user?.id}`,
  message: {
    code: "RATE_LIMIT",
    message: "Çok fazla talep denemesi. Biraz sonra tekrar dene.",
  },
});

api.get("/mentors", async (req, res) => {
  const q = z
    .object({
      universityId: uuid.optional(),
      programId: uuid.optional(),
      topic: z.string().trim().max(40).optional(),
      limit: z.coerce.number().int().min(1).max(50).default(30),
      offset: z.coerce.number().int().min(0).max(10000).default(0),
    })
    .parse(req.query);
  res.json(await listMentors(q, res.locals.user?.id));
});
api.get("/mentor-profile/me", requireUser, async (_req, res) => {
  res.json(await getMentorProfile(res.locals.user.id));
});
api.put("/mentor-profile", requireUser, async (req, res) => {
  res.json(
    await saveMentorProfile(
      res.locals.user.id,
      mentorProfileInput.parse(req.body),
    ),
  );
});
api.post(
  "/mentorship-requests",
  requireUser,
  requireVerifiedEmail,
  requestLimit,
  async (req, res) => {
    res
      .status(201)
      .json(
        await createMentorshipRequest(
          res.locals.user.id,
          mentorshipRequestInput.parse(req.body),
        ),
      );
  },
);
api.get("/mentorship-requests", requireUser, async (req, res) => {
  const { box } = z
    .object({ box: z.enum(["incoming", "outgoing"]).default("incoming") })
    .parse(req.query);
  res.json(await listMentorshipRequests(res.locals.user.id, box));
});
api.put("/mentorship-requests/:id", requireUser, async (req, res) => {
  const id = uuid.parse(req.params.id);
  const { action } = z
    .object({ action: z.enum(mentorshipActions) })
    .parse(req.body);
  res.json(await updateMentorshipRequest(id, res.locals.user.id, action));
});
export default api;
