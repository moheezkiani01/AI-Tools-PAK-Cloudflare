import Icon from "./Icon";

const reasons = [["bolt", "Fast Delivery"], ["price", "Affordable Pricing"], ["lock", "Secure Ordering"], ["chat", "WhatsApp Support"], ["users", "Customer Assistance"], ["box", "Digital Delivery"]];
const colors = ["#3b82f6", "#0ea5e9", "#14b8a6", "#6366f1", "#10b981", "#f59e0b"];

export default function WhyChoose() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-8 lg:py-10">
      <p className="eyebrow">Why us</p>
<h2 className="section-title">Why Choose Us?</h2>
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-6">
        {reasons.map(([emoji, title], i) => (
          <div key={title} style={{ "--c": colors[i] }} className="glass card-hover p-5 text-center">
            <span className="tile mx-auto"><Icon name={emoji} /></span>
            <p className="mt-3 text-sm font-bold">{title}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
