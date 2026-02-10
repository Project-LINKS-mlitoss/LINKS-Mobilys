from fastapi import APIRouter, UploadFile, Form, File, HTTPException, Query
from app.services.graph_builder import build_graph, delete_graph_dir
from app.services.router_manager import delete_router, launch_router, restart_router
from app.services.router_store import RouterStore
from app.services.pbf import get_pbf_bbox
from app.services.pbf import is_pbf_available
from app.services import paths

router = APIRouter()
router_store = RouterStore()


def _handle_router_after_build(scenario_id: str) -> str:
    router_map = router_store.load()
    if scenario_id in router_map:
        restart_router(scenario_id)
        return "updated"
    launch_router(scenario_id)
    return "created"


@router.post("/build_graph")
@router.post("/build_graph/")
async def build_graph_route(
    scenario_id: str = Form(...),
    prefecture: str = Form(...),
    graph_type: str = Form("osm"),
    gtfs_file: UploadFile = File(...),
):
    print(f"[Build Graph] Scenario {scenario_id}, prefecture {prefecture}")
    try:
        content = await gtfs_file.read()
        exit_code, _lines = build_graph(
            scenario_id,
            prefecture,
            gtfs_file.filename,
            content,
            graph_type=graph_type,
        )
        if exit_code != 0:
            raise HTTPException(status_code=500, detail="OTP build failed")
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    try:
        action = _handle_router_after_build(scenario_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Router operation failed: {exc}")

    return {"status": "success", "action": action}


@router.get("/pbf_exists")
@router.get("/pbf_exists/")
async def pbf_exists(
    prefecture: str = Query(..., description="Prefecture name (e.g., Tokyo)"),
    graph_type: str = Query("osm", description="Graph type: osm or drm"),
):
    normalized_graph_type = graph_type.strip().lower() or "osm"
    pbf_path = paths.pbf_path(prefecture, normalized_graph_type)
    return {
        "status": "success",
        "prefecture": prefecture,
        "graph_type": normalized_graph_type,
        "path": str(pbf_path),
        "available": is_pbf_available(prefecture, normalized_graph_type),
    }


@router.post("/delete_graph")
@router.post("/delete_graph/")
async def delete_graph_route(scenario_id: str = Form(...)):
    print(f"[Delete Graph] Starting delete for {scenario_id}")
    try:
        delete_graph_dir(scenario_id)
        delete_router(scenario_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting router instance: {e}")
    return {"status": "success"}


@router.get("/pbf_bbox")
@router.get("/pbf_bbox/")
async def pbf_bbox(prefecture: str):
    bbox = get_pbf_bbox(prefecture)
    if bbox is None:
        raise HTTPException(status_code=404, detail="PBF file not found")
    return {"status": "success", "bbox": bbox}
