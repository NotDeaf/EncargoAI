import React, { useState } from "react";
import logo from "./assets/EncargoAILogo.png";

const headerStyles = `
  .site-header { position: sticky; top: 0; z-index: 50; width: 100%; backdrop-filter: blur(10px); background: hsl(var(--background, 0 0% 100%) / 0.98); border-bottom: 1px solid hsl(var(--border, 216 20% 90%)); box-shadow: 0 4px 14px -6px hsl(210 78% 15% / 0.15); }
  .site-header .shell { max-width: 1320px; margin: 0 auto; padding: 12px 18px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .site-header .brand-row { display: flex; align-items: center; gap: 12px; text-decoration: none; }
  .site-header .brand-row img { height: 48px; width: auto; transition: transform 0.2s ease; }
  .site-header .brand-row:hover img { transform: translateY(-2px); }
  .site-header .nav-links { display: flex; align-items: center; gap: 10px; font-weight: 700; }
  .site-header .nav-links a,
  .site-header .nav-links button { text-decoration: none; color: inherit; background: none; border: 1px solid transparent; padding: 8px 10px; border-radius: 12px; cursor: pointer; font-weight: 700; transition: background 0.15s ease, border-color 0.15s ease; }
  .site-header .nav-links a:hover,
  .site-header .nav-links button:hover { background: hsl(var(--secondary, 216 33% 98%)); border-color: hsl(var(--border, 216 20% 90%)); }
`;

export default function Header() {
  const [loggedIn, setLoggedIn] = useState(false);

  return (
    <header className="site-header" role="banner">
      <style>{headerStyles}</style>
      <div className="shell">
        <a className="brand-row" href="./home.html" aria-label="Go to library">
          <img src={logo} alt="Encargo" loading="eager" decoding="async" />
        </a>
        <nav className="nav-links" aria-label="Primary">
          <button type="button" onClick={() => setLoggedIn((prev) => !prev)} aria-label="Toggle login state">
            {loggedIn ? "Logout" : "Login"}
          </button>
          <button type="button" aria-label="Setup (coming soon)">
            Setup
          </button>
          <a href="./home.html" aria-label="Go to library">
            Library
          </a>
        </nav>
      </div>
    </header>
  );
}
