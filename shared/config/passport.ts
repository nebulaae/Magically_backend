import dotenv from "dotenv";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { User } from "../../src/user/models/User";

dotenv.config();

const makeUsername = (profile: any) =>
  (
    profile.displayName ||
    profile.emails?.[0]?.value?.split("@")[0] ||
    `google_${profile.id}`
  )
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 32);

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL:
        process.env.BACKEND_URL + "/api/v1/auth/google/callback",
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;

        let user = await User.findOne({
          where: { googleId: profile.id },
        });

        // 🔹 если нашли по email — привязываем google
        if (!user && email) {
          user = await User.findOne({ where: { email } });

          if (user) {
            user.googleId = profile.id;
          }
        }

        const shouldUpdate =
          !user?.fullname ||
          !user?.username ||
          !user?.verified;

        if (user && shouldUpdate) {
          user.fullname ??= profile.displayName;
          user.username ??= makeUsername(profile);
          user.verified = true;

          await user.save();
        }

        // 🔹 если пользователя вообще не было
        if (!user) {
          user = await User.create({
            googleId: profile.id,
            email: email ?? `google_${profile.id}@volshebny.by`,
            fullname: profile.displayName,
            username: makeUsername(profile),
            verified: true,
            role: "user",
            tokens: 50,
            password: null,
          });
        }

        return done(null, user);
      } catch (err) {
        return done(err as any);
      }
    }
  )
);
