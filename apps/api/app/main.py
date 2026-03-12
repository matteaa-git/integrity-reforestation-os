from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.assets import router as assets_router

app = FastAPI(title="Instagram Growth OS API", version="0.0.2")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(assets_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "igrowth-api"}
