from fastapi import FastAPI, Query, Request
from fastapi.templating import Jinja2Templates
from fastapi.responses import StreamingResponse, HTMLResponse
import asyncio
import json
import time
import random
import uvicorn
import uuid
from datetime import datetime
from app.controllers.llm_controller import router as llm_router
from app.views.main_view import router as main_view_router
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(main_view_router)
app.include_router(llm_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
