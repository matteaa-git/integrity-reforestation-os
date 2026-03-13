from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.assets import router as assets_router
from app.routes.drafts import router as drafts_router
from app.routes.ad_creatives import router as ad_creatives_router

app = FastAPI(title="Instagram Growth OS API", version="0.0.5")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(assets_router)
app.include_router(drafts_router)
app.include_router(ad_creatives_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "igrowth-api"}
