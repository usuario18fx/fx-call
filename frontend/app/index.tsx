import { Redirect } from "expo-router";
import { useEffect, useState } from "react";

import { useAuth } from "@/src/auth";
import { Loading } from "@/src/components/ui";
import { getStartTab, type StartTab } from "@/src/generalPreferences";

export default function Index() {
  const { user, ready } = useAuth();
  const [startTab, setStartTabState] = useState<StartTab>("meetings");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void getStartTab().then((tab) => {
      if (active) setStartTabState(tab);
    }).finally(() => {
      if (active) setLoaded(true);
    });
    return () => { active = false; };
  }, []);

  if (!ready || (user && !loaded)) return <Loading label="Securing session" />;
  if (!user) return <Redirect href="/auth/login" />;

  return <Redirect href={startTab === "studio" ? "/(tabs)/studio" : "/(tabs)/meetings"} />;
}
