# EncargoAI Backend

### Installation

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Set `OPENAI_API_KEY` in your environment 

### Running the Server

```bash
uvicorn app.main:app --reload
```

By default the API will be available at `http://127.0.0.1:8000`.

Browse [`http://127.0.0.1:8000/docs`](http://127.0.0.1:8000/docs) for automatically generated OpenAPI/Swagger UI.

The service persists extracted data to a database. It defaults to SQLite at `./data.db`; override with `DATABASE_URL` (e.g. Render Postgres) if desired.


## API Endpoints

 need to fill this section out

**Example using `curl` (from project root):**

Set-Location -Path 'C:\Projects\EncargoAI'   # or wherever your clone is
>> curl.exe -F "file=@./Sales_020504_SO1041931.20251009-143613.pdf" http://127.0.0.1:8000/upload



## 📁 File Storage

Uploaded PDFs are written to the `backend/uploads/` directory.  Ensure that the service has write permissions.

