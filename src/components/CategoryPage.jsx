import { useEffect, useState } from "react";
import ProductGrid from "./ProductGrid";
import { allCategories } from "../data/categories";
import { brand } from "../config";

// One real page per category, plus /products for everything.
// Switching category keeps your place on the screen (see App.jsx), so the list simply changes where you are.
export default function CategoryPage({ slug, ratings, importedGroups = [], catalogGroups = [], catalogReady = true, catalogError = false }) {
  const [selected, setSelected] = useState(slug);
  useEffect(() => { setSelected(slug); }, [slug]);
  const all = slug === "all";
  const category = all ? { name: "All Products", tools: "" } : allCategories.find((c) => c.slug === slug);
  const heading = all ? "Explore AI Tool Collections in Pakistan" : `${category?.name || "Tools"} in Pakistan`;

  useEffect(() => {
    const oldTitle = document.title;
    document.title = `${heading} | ${brand.name}`;
    return () => { document.title = oldTitle; };
  }, [heading]);

  return (
    <>
      <header className="mx-auto max-w-7xl px-5 pt-10">
        <h1 className="text-4xl font-extrabold sm:text-5xl">{heading}</h1>
        <p className="mt-3 max-w-2xl text-slate-300">{category.tools ? `${category.tools}. ` : ""}Compare subscriptions by brand, available plans, price and duration. Confirm eligibility before ordering. {all && "All Products shows one card per tool across every category; open a tool to compare its plans."}</p>
      </header>
      <ProductGrid category={selected} setCategory={setSelected} importedGroups={importedGroups} catalogGroups={catalogGroups} catalogReady={catalogReady} catalogError={catalogError} ratings={ratings} showAll={!all} compactTop />
    </>
  );
}
