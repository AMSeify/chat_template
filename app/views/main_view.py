from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse

router = APIRouter()

@router.get("/", response_class=HTMLResponse)
async def get_html(request: Request):
    with open("frontend/index.html", "r") as f:
        return HTMLResponse(content=f.read())
