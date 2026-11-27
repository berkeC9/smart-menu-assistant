from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from src.backend.api.allergen_routes import router as allergen_router
from src.backend.config import settings

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"


def create_app() -> FastAPI:
    """Create and configure the FastAPI application instance."""
    application = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="Backend API for Smart Menu Assistant with allergen filtering and AI chat.",
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.include_router(allergen_router)

    @application.get("/api/health", tags=["system"])
    def health_check() -> dict[str, str]:
        """Return service status and current environment."""
        return {
            "status": "ok",
            "service": settings.app_name,
            "version": settings.app_version,
            "environment": settings.app_env,
        }

    index_file = FRONTEND_DIR / "index.html"
    if FRONTEND_DIR.exists():
        application.mount(
            "/css",
            StaticFiles(directory=str(FRONTEND_DIR / "css"), check_dir=False),
            name="css",
        )
        application.mount(
            "/js",
            StaticFiles(directory=str(FRONTEND_DIR / "js"), check_dir=False),
            name="js",
        )

        @application.get("/", include_in_schema=False)
        def serve_index():
            if index_file.exists():
                return FileResponse(str(index_file))
            return {"message": "Smart Menu Assistant API is running. Visit /docs for API schema."}

    return application


app = create_app()
