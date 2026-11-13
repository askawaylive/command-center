import { ContactBook } from "@/components/ContactBook";
import { getBusinesses } from "@/lib/businesses";
import { listContacts } from "@/lib/contacts";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const [businesses, contacts] = await Promise.all([getBusinesses(), listContacts()]);
  return <ContactBook initial={contacts} businesses={businesses} />;
}
