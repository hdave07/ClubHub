from fastapi import APIRouter

from app.models import FIXED_OUTCOMES
from app.schemas import RecommendRequest, RecommendResponse

router = APIRouter(tags=["recommend"])


@router.post("/recommend", response_model=RecommendResponse)
def recommend(request: RecommendRequest) -> RecommendResponse:
    """Blurb -> ranked clubs + graph.

    TODO:
      1. Embed request.blurb and query ChromaDB for the top ~20 clubs.
      2. Send those candidates + the blurb to Claude (Sonnet) to rerank to
         5-8, map to FIXED_OUTCOMES, and write a "why this fits" line each.
      3. Return the outcomes touched plus the ranked ClubMatch list.
    """
    return RecommendResponse(outcomes=FIXED_OUTCOMES[:3], clubs=[])
