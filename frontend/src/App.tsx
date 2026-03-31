import React from "react";
import Home from "./Home";
import Edit from "./Edit";
import Header from "./Header";
import View from "./View";
import "./App.css";

function App() {
  const params = new URLSearchParams(window.location.search);
  const mode = (params.get("mode") || "").toLowerCase();
  const path = window.location.pathname.toLowerCase();

  const isEdit = mode === "edit" || path.includes("edit");
  const isView = mode === "view" || path.includes("view");

  const title = isEdit
    ? "Review and edit your extracted data"
    : isView
      ? "View extracted data"
      : "Document Library";

  const subtitle = isEdit
    ? "Review extracted fields, edit values, and mark records saved—all in one place."
    : isView
      ? "Read-only view of the extracted fields and line items with the latest saved values."
      : "Browse uploaded documents, view previews, check saved status, expand line items, upload new files, or delete records directly from the library without opening each one.";

  return (
    <>
      <Header />
      <main id="main-content">
        <div className="title-shell">
          <h1 className="page-title">{title}</h1>
          {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
        </div>
        {isEdit ? <Edit /> : isView ? <View /> : <Home />}
      </main>
    </>
  );
}

export default App;
