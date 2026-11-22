import { Redirect } from "expo-router";

import { useAuth } from "@/src/auth";
import { Loading } from "@/src/components/ui";

export default function Index() {
  const { user, ready } = useAuth();
  if (!ready) return <Loading label="Securing session" />;
  return <Redirect href={user ? "/(tabs)/meetings" : "/auth/login"} />;
}
