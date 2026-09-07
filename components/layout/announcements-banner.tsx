import { listAnnouncements } from "@/features/admin/operations";

export async function AnnouncementsBanner() {
  const announcements = await listAnnouncements();
  if (announcements.length === 0) return null;
  return <section aria-label="Service announcements" className="border-b border-info/20 bg-info-soft px-4 py-2 text-sm text-text-primary sm:px-6">
    <div className="mx-auto flex max-w-[1400px] flex-col gap-0.5">{announcements.slice(0, 2).map((item) => <p key={item.id}><span className="font-semibold">{item.title}: </span>{item.body}</p>)}</div>
  </section>;
}
