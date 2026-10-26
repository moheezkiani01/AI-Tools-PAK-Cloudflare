import { brand } from "../config";

// General-purpose text written for this site. Have it checked by a lawyer before you rely on it.
const updated = "October 2026";
const contact = `You can reach us on WhatsApp (24 hours) at +${brand.whatsappNumber} or by email at ${brand.email}.`;

const pages = {
  terms: { title: "Terms & Conditions", sections: [
    ["About these terms", [`These terms apply when you use ${brand.name} and place an order with us. By ordering, you agree to them.`]],
    ["Our products", ["We sell AI tools, software subscriptions and other digital services. Each product page shows the plan, duration and price. All prices are in Pakistani Rupees (PKR)."]],
    ["Provider terms", ["Many products are services run by other companies (the provider). Availability, account eligibility, features, limits and terms depend on the provider and can change at any time. You agree to use each product in line with the provider's terms.", `${brand.name} is an independent business. We are not owned by, affiliated with or an official partner of any provider unless we say so.`]],
    ["Placing an order", ["You can order on this website or on WhatsApp. An order is confirmed when we receive your payment. We may decline an order, for example if a product is out of stock or the details are wrong, and we will tell you."]],
    ["Payment", ["We accept JazzCash, UBL bank transfer and Binance. We share the payment details after you order. Please pay only to the accounts we give you, and send your payment proof on WhatsApp with your order number.", "If anyone else asks you to pay on our behalf, please contact us first."]],
    ["Delivery", ["Delivery is digital. We deliver within 10 minutes after your payment is confirmed. Access details are sent through WhatsApp or email, and we confirm on WhatsApp how your access will be delivered before you pay.", "If there is a delay, we will keep you updated on WhatsApp."]],
    ["Your responsibilities", ["Please give correct contact details so we can reach you, keep your access details private, and use each product in line with the provider's terms."]],
    ["Support", [contact]],
    ["Reviews and questions", ["Reviews need a purchase number that we gave you. Answers to customer questions remain private until the customer chooses to publish them by name or anonymously in Customer FAQs. We may remove reviews or questions that are abusive, false or off-topic."]],
    ["Limits of our responsibility", ["We work to keep this website accurate and available. Products are run by their providers, and we cannot control changes or outages on their side. To the extent the law allows, we are not responsible for losses caused by things outside our control."]],
    ["Changes and law", ["We may update these terms. The date at the top shows the latest version. These terms are governed by the laws of Pakistan."]],
  ] },
  "privacy-policy": { title: "Privacy Policy", sections: [
    ["What we collect", ["When you order: your name, email, WhatsApp number, order notes and the products you chose.", "When you ask a question: your name, your question and, if you add them, your email and WhatsApp number.", "When you leave a review: your name, rating, comment and the purchase number you used."]],
    ["How we use it", ["To process and deliver your order, to contact you on WhatsApp or email about it, to answer your questions, to tell you when a question is answered, and to stop fake reviews and misuse of the website."]],
    ["Your browser", ["Your cart, your light or dark mode choice and your own questions and answers are stored in your browser so the site can remember them. We do not use advertising cookies or third-party analytics at the moment.", "The Total Orders chart uses website checkout submissions and completed sales recorded by the store. WhatsApp button enquiries are not counted as confirmed orders."]],
    ["Sharing", ["When you choose to publish your answered question, the question, answer and selected public name (your name or Anonymous) appear in Customer FAQs. Contact details are not published automatically.", "We do not sell your information. Chats on WhatsApp are handled by WhatsApp under its own privacy terms, and payments are handled by JazzCash, UBL or Binance under theirs. We may share information if the law requires it."]],
    ["How long we keep it", ["We keep order records for as long as we need them to support you and for our business records. You can ask us to delete your information at any time, unless we must keep it by law."]],
    ["Your choices", [`To see, correct or delete your information, contact us. ${contact}`]],
    ["Security", ["We take reasonable steps to protect your information, but no website or service can be 100% secure."]],
    ["Changes", ["We may update this policy. The date at the top shows the latest version."]],
  ] },
};

export default function LegalPage({ slug }) {
  const page = pages[slug];
  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="text-4xl font-extrabold">{page.title}</h1>
      <p className="mt-2 text-sm text-slate-400">Last updated: {updated}</p>
      <div className="mt-8 space-y-8">
        {page.sections.map(([heading, paragraphs]) => (
          <div key={heading}>
            <h2 className="text-xl font-bold">{heading}</h2>
            <div className="mt-2 space-y-3 text-slate-300">{paragraphs.map((text) => <p key={text}>{text}</p>)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
