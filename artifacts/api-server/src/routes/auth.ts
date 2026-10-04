import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { GetAuthSessionResponse, RegisterUserBody, RegisterUserResponse } from "@workspace/api-zod";
import { publicUser, registerClerkProfile, findActor } from "../middlewares/aurix-auth";

const router: IRouter = Router();

router.get("/auth/session", async (req, res) => {
  const actor = await findActor(req);
  if (actor) {
    return res.json(
      GetAuthSessionResponse.parse({
        signedIn: true,
        user: publicUser(actor.user),
        demoMode: actor.demoMode,
      }),
    );
  }
  return res.json(
    GetAuthSessionResponse.parse({
      signedIn: Boolean(getAuth(req).userId),
      user: null,
      demoMode: false,
    }),
  );
});

router.post("/auth/register", async (req, res) => {
  const parsed = RegisterUserBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Profile details are invalid.",
      issues: parsed.error.issues,
    });
  }
  const clerkUserId = getAuth(req).userId;
  if (!clerkUserId) return res.status(401).json({ error: "Sign in is required." });

  try {
    const user = await registerClerkProfile({
      clerkUserId,
      name: parsed.data.name,
      phone: parsed.data.phone,
    });
    return res
      .status(200)
      .json(RegisterUserResponse.parse(publicUser(user)));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Profile registration failed.";
    const isConflict =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505";
    return res.status(isConflict ? 409 : 400).json({ error: message });
  }
});

export default router;