import Icon from "./Icon";
import { whatsappLink } from "../utils/whatsapp";

export default function CtaBand() {
  return (
    <section className="mx-auto mt-4 max-w-7xl px-5 sm:mt-6">
      <div className="cta-band flex flex-col items-start justify-between gap-6 rounded-3xl p-6 sm:flex-row sm:items-center sm:p-9">
        <div>
          <h2 className="text-3xl font-extrabold sm:text-4xl">Not sure which plan fits you?</h2>
          <p className="mt-2 max-w-xl text-blue-50">Message us on WhatsApp and we will help you pick the right tool.</p>
        </div>
        <a href={whatsappLink("Hello, I need help choosing a plan.")} target="_blank" rel="noreferrer" className="btn-light inline-flex shrink-0 items-center gap-2">
          <Icon name="chat" size={18} /> Chat on WhatsApp
        </a>
      </div>
    </section>
  );
}
