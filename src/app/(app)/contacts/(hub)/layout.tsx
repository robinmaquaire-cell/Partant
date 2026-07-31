import { ContactsSubNav } from "../sub-nav";

export default function ContactsHubLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div>
      <ContactsSubNav />
      {children}
    </div>
  );
}
