# Smart Menu Assistant

Smart Menu Assistant is a web application built for the SENG 461 (Web Programming with Python and Git) course. It helps restaurant guests explore dishes based on ingredients, allergens, calorie targets, and dietary preferences through an interactive menu interface and an AI-powered chat assistant.

## Problem Statement

People with food allergies (such as peanut, dairy, gluten, or seafood allergies) or specific dietary preferences (such as vegan, vegetarian, or low-calorie diets) often struggle to check every ingredient on a restaurant menu. Smart Menu Assistant combines deterministic allergen filtering with an AI conversational interface so users can ask questions in natural language (for example, "I have a peanut allergy and want something light, what can I eat?") and receive safe dish recommendations.

## Key Features

- **Ingredient and Allergen Filtering:** Filter menu items by excluding specific allergens (`peanut`, `tree_nut`, `dairy`, `gluten`, `egg`, `soy`, `seafood`, `sesame`) including cross-contamination warnings (`may_contain_traces`).
- **Dietary and Calorie Filters:** Browse dishes by category, vegan/vegetarian labels, gluten-free status, spice level, and calorie limits.
- **AI Chat Assistant:** Ask questions in natural language. The backend filters the menu for safety before sending the allowed dishes to the language model API, preventing unsafe food suggestions.
- **Interactive Dish Cards:** View full ingredient breakdowns, allergen badges, and nutrition facts both in the main menu grid and inside chat responses.

## Technology Stack

- **Backend:** Python, FastAPI, SQLAlchemy, SQLite, Pydantic
- **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6 modules), Bootstrap 5
- **AI Integration:** External LLM API (Google Gemini / OpenAI compatible REST client) with rule-based allergen pre-filtering
- **Testing:** Pytest

## Project Structure

```text
smart-menu-assistant/
├── .github/
│   ├── CODEOWNERS
│   └── pull_request_template.md
├── src/
│   ├── backend/
│   │   ├── api/            # FastAPI route handlers (menu, allergens, chat)
│   │   ├── models/         # Database models and Pydantic schemas
│   │   ├── services/       # Business logic, allergen guard, and AI client
│   │   └── data/           # Initial seed menu data
│   └── frontend/
│       ├── css/            # Stylesheets for layout and chat widget
│       └── js/             # Frontend modules (api, menu, filters, chat)
├── tests/                  # Automated unit and API tests
├── .env.example
├── .gitignore
├── requirements.txt
└── README.md
```

## Team Members (Group 6)

- **Berke Cinkol** (`@berkeC9`) - AI Assistant Service, Allergen Guard, and Chat API
- **Sevket Baran Aydogdu** - Database Models, Seed Data, and Menu API
- **Muhammed Fatih Erayman** - Frontend Menu Grid, Dish Modals, and Filter UI
- **Enes Safa Akca** - Frontend Chat Widget, API Client, and Test Suite

## Local Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/berkeC9/smart-menu-assistant.git
   cd smart-menu-assistant
   ```

2. Create and activate a virtual environment:
   ```bash
   python -m venv .venv
   # Windows PowerShell:
   .\.venv\Scripts\Activate.ps1
   # macOS / Linux:
   source .venv/bin/activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Copy `.env.example` to `.env` and add your API key:
   ```bash
   cp .env.example .env
   ```

5. Run the development server:
   ```bash
   uvicorn src.backend.main:app --reload
   ```

## Git Workflow

This project follows GitHub Flow:
- `main` is protected and always deployable.
- All work is done in short-lived branches (`feature/...`, `fix/...`, `docs/...`, `test/...`) created from `main`.
- Every change requires a Pull Request linked to an Issue and at least one review approval before merging.
