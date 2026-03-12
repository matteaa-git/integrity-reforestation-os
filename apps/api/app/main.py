from fastapi import FastAPI

app = FastAPI(title="Instagram Growth OS API", version="0.0.1")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "igrowth-api"}
