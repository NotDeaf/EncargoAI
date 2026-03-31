import React from "react";
import Home from "./Home";
import Edit from "./Edit";
import Header from "./Header";
import "./App.css";

function App() {
  const path = window.location.pathname.toLowerCase();
  const isEdit = path.includes("edit");

  const title = isEdit ? "Review and edit your extracted data" : "Document Library";
  const subtitle = isEdit
    ? ""
    : "Browse every document stored in the database. Use this home view to confirm uploads, see OCR status, and peek at extracted fields without opening each record individually.";

  return (
    <>
      <Header />
      <main id="main-content">
        <div className="title-shell">
          <h1 className="page-title">{title}</h1>
          {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
        </div>
        {isEdit ? <Edit /> : <Home />}
      </main>
    </>
  );
}

export default App;
