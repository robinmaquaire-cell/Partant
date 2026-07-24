import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TabBar } from "@/components/tab-bar";
import { Avatar } from "@/components/avatar";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Tant que Supabase n'est pas configuré, la page de connexion explique la situation.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    redirect("/connexion");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const { data: profile } = await supabase
    .from("profiles")
    .select("pseudo, avatar_url")
    .eq("id", user.id)
    .single();

  return (
    <div className="min-h-screen pb-24">
      <header className="px-5 pt-5 pb-3 flex items-center justify-between sticky top-0 z-10 bg-paper">
        <Link
          href="/"
          className="text-2xl font-extrabold tracking-tight font-display text-ink"
        >
          Partants<span className="text-signal"> ?</span>
        </Link>
        <Link href="/profil" aria-label="Mon profil">
          <Avatar
            pseudo={profile?.pseudo || user.email || "?"}
            url={profile?.avatar_url}
            size={36}
          />
        </Link>
      </header>
      <main className="px-5 max-w-lg mx-auto w-full">{children}</main>
      <TabBar />
    </div>
  );
}
