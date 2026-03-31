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
    ? "Review extracted fields, edit values, and mark records saved—all in one place."
    : "Browse uploaded documents, view previews, check saved status, expand line items, upload new files, or delete records directly from the library without opening each one.";

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
