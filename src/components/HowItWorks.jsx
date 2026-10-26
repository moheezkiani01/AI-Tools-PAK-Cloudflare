const steps = [
  ["01", "Choose Your Tool", "Browse the available products."],
  ["02", "Place Your Order", "Select your preferred product and submit your order."],
  ["03", "Complete Payment", "Pay using the available payment method."],
  ["04", "Receive Your Product", "Delivery/access information is provided through the designated channel."],
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-7xl px-5 py-8 lg:py-10">
      <p className="eyebrow">Simple process</p>
<h2 className="section-title">How It Works</h2>
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map(([number, title, text]) => (
          <div key={number} className="glass p-6">
            <span className="gradient-text text-3xl font-extrabold">{number}</span>
            <h3 className="mt-3 text-lg font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-slate-400">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
