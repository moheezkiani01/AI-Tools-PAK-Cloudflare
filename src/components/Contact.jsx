import { brand } from "../config";
import { whatsappLink } from "../utils/whatsapp";

const cards = [
  ["WhatsApp", `+${brand.whatsappNumber}`, whatsappLink("Hello, I have a question about your products."), "#14b8a6"],
  ["Email", brand.email, `mailto:${brand.email}`, "#3b82f6"],
  ["Business Hours", "24 hours", null, "#0ea5e9"],
];

export default function Contact() {
  return (
    <section id="contact" className="mx-auto max-w-7xl px-5 py-8 lg:py-10">
      <p className="eyebrow">Get in touch</p>
<h2 className="section-title">Contact Us</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {cards.map(([title, value, href, color]) => (
          <div key={title} style={{ "--c": color }} className="glass card-hover p-6">
            <p className="text-sm text-slate-400">{title}</p>
            {href ? <a href={href} target="_blank" rel="noreferrer" className="mt-1 block break-all font-bold underline-offset-4 hover:underline">{value}</a> : <p className="mt-1 font-bold">{value}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
