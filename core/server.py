from fastapi import FastAPI, HTTPException, Body
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Dict, Any, Optional
import sys
import os
import uuid

# Import the generator classes
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from generate_daily_report_pdf import DailyReportGenerator, create_sample_data as create_daily_sample
from generate_final_result_pdf import FinalResultPDFGenerator, create_sample_data as create_final_sample

from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Urawa Cup Core API", description="PDF Generation Service", version="1.0.0")

# Mount current directory for static files (html, css, js)
app.mount("/static", StaticFiles(directory="."), name="static")

@app.get("/", summary="フロントエンド画面")
async def read_root():
    return FileResponse('index.html')

@app.get("/schedule", summary="最終日組み合わせ画面")
async def read_schedule():
    return FileResponse('final_day_schedule.html')

class ReportConfig(BaseModel):
    recipient: Optional[str] = None
    sender: Optional[str] = None
    contact: Optional[str] = None

class DailyReportRequest(BaseModel):
    day: int
    dateStr: str
    reportConfig: Optional[ReportConfig] = None
    matchData: Dict[str, Any]

class FinalResultRequest(BaseModel):
    date: str
    reportConfig: Optional[ReportConfig] = None
    ranking: list
    tournament: list
    players: list
    training: list

@app.post("/daily-report", summary="日次報告書PDF生成")
async def generate_daily_report(
    data: Dict[str, Any] = Body(..., example=create_daily_sample())
):
    try:
        generator = DailyReportGenerator()
        filename = f"daily_report_{uuid.uuid4()}.pdf"
        output_path = os.path.join(os.getcwd(), filename)
        
        generator.generate(data, output_path)
        
        return FileResponse(
            path=output_path, 
            filename="daily_report.pdf", 
            media_type='application/pdf'
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/daily-report/sample", summary="日次報告書サンプルPDF生成")
async def generate_daily_report_sample():
    try:
        data = create_daily_sample()
        generator = DailyReportGenerator()
        filename = f"sample_daily_report_{uuid.uuid4()}.pdf"
        output_path = os.path.join(os.getcwd(), filename)
        
        generator.generate(data, output_path)
        
        return FileResponse(
            path=output_path, 
            filename="sample_daily_report.pdf", 
            media_type='application/pdf'
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/final-results", summary="最終結果報告書PDF生成")
async def generate_final_results(
    data: Dict[str, Any] = Body(..., example=create_final_sample())
):
    try:
        generator = FinalResultPDFGenerator()
        filename = f"final_results_{uuid.uuid4()}.pdf"
        output_path = os.path.join(os.getcwd(), filename)
        
        generator.generate(data, output_path)
        
        return FileResponse(
            path=output_path, 
            filename="final_results.pdf", 
            media_type='application/pdf'
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/final-results/sample", summary="最終結果報告書サンプルPDF生成")
async def generate_final_results_sample():
    try:
        data = create_final_sample()
        generator = FinalResultPDFGenerator()
        filename = f"sample_final_results_{uuid.uuid4()}.pdf"
        output_path = os.path.join(os.getcwd(), filename)
        
        generator.generate(data, output_path)
        
        return FileResponse(
            path=output_path, 
            filename="sample_final_results.pdf", 
            media_type='application/pdf'
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
