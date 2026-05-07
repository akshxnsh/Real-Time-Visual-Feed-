import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function ProtectedPage({ children }) {
  const session = await auth();
  if (!session) {
    redirect("/auth/signin");
  }
  // Only check cookie for onboarding (SSR)
  const cookieStore = await cookies();
  const onboarded = cookieStore.get("rtvf_onboarded")?.value === "1";
  if (!onboarded) {
    redirect("/onboard");
  }
  return children;
}
