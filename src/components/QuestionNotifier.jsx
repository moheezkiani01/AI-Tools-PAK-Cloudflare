import { useEffect, useState } from "react";
import { getMine, markSeen, refreshMine } from "../utils/myQuestions";

// Pops up when one of this visitor's questions has been answered
export default function QuestionNotifier() {
  const [mine, setMine] = useState(getMine);

  useEffect(() => {
    const sync = () => setMine(getMine());
    const onVisible = () => document.visibilityState === "visible" && refreshMine();
    window.addEventListener("my-questions", sync);
    document.addEventListener("visibilitychange", onVisible);
    refreshMine();
    const timer = setInterval(refreshMine, 60000);
    return () => {
      window.removeEventListener("my-questions", sync);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, []);

  const unseen = mine.filter((q) => q.answer && !q.seen);
  if (!unseen.length) return null;

  return (
    <div role="status" className="glass pop-in fixed bottom-24 left-5 z-[66] max-w-sm p-4 shadow-xl sm:bottom-5">
      <p className="font-bold">{unseen.length === 1 ? "Your question was answered" : `${unseen.length} of your questions were answered`}</p>
      <p className="mt-1 truncate text-sm text-slate-400">{unseen[0].question}</p>
      <div className="mt-3 flex gap-2">
        <a href="/#faq" onClick={markSeen} className="btn-primary text-xs">View answer</a>
        <button onClick={markSeen} className="btn-ghost text-xs">Dismiss</button>
      </div>
    </div>
  );
}
