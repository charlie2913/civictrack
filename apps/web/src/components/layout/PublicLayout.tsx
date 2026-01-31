import { Outlet } from "react-router-dom";
import Footer from "./Footer";
import Navbar from "./Navbar";

const PublicLayout = () => {
  return (
    <div className="relative flex min-h-screen flex-col bg-[var(--ct-bg)] text-[var(--ct-ink)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 right-[-8%] h-64 w-64 rounded-full bg-[var(--ct-warm)]/40 blur-3xl" />
        <div className="absolute top-40 left-[-6%] h-72 w-72 rounded-full bg-[var(--ct-accent-soft)] blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-48 w-48 rounded-full bg-[var(--ct-warm-strong)]/20 blur-3xl" />
      </div>
      <Navbar />
      <main className="relative mx-auto w-full max-w-6xl flex-1 px-6 py-12 lg:px-10">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default PublicLayout;
