# chat_template

A simple React + Flask LLM chat template.

## Monorepo Structure

- `frontend/` — React + Vite frontend
  - `src/components/` — React components
  - `src/assets/` — Static assets
  - `public/` — Static files
  - `.env.sample` — Example environment variables
- `app/` — Flask backend (see app/README.md)
  - `controllers/`, `models/`, `views/`, `templates/`
- `main.py` — Backend entry point
- `.gitignore` — Ignores for Python, Node, and environment files

## Setup

### Backend (Flask)
1. Create a virtual environment and activate it:
   ```sh
   python3 -m venv venv
   source venv/bin/activate
   ```
2. Install dependencies:
   ```sh
   pip install -r requirements.txt
   ```
3. Run the backend:
   ```sh
   python main.py
   ```

### Frontend (React)
1. Copy `.env.sample` to `.env` and adjust as needed.
2. Install dependencies:
   ```sh
   cd frontend
   npm install
   ```
3. Run the frontend:
   ```sh
   npm run dev
   ```

## Notes
- See `frontend/README.md` and `app/README.md` for more details on each part.
