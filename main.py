import os
import json
import urllib.parse
import re  # 🔥 (추가됨) 강력한 글자 필터링을 위한 도구
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
from fastapi.staticfiles import StaticFiles

load_dotenv()
app = FastAPI(title="Smart Parenting Hub API")

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url="https://api.deepseek.com/v1")

class ChatRequest(BaseModel): message: str
class RecordRequest(BaseModel): audio_text: str 
class ShareRequest(BaseModel): target: str 
class StoryRequest(BaseModel): text: str 

@app.post("/api/record")
def process_voice_record(req: RecordRequest):
    raw_text = req.audio_text 
    try:
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": "육아 일기 요약 AI입니다. 다음 JSON 형식으로만 답변하세요. {\"transcript\": \"한 줄 요약\", \"tags\": [\"#태그1\", \"#태그2\"]}"},
                {"role": "user", "content": raw_text}
            ],
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        return {"transcript": f"요약 실패 (원본: {raw_text})", "tags": ["#오류"]}

@app.post("/api/chat")
def chat_with_ai(req: ChatRequest):
    try:
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": "따뜻하고 전문적인 육아 코치입니다. 발달 단계에 맞는 조언을 3문장 이내로 다정하게 제공하세요."},
                {"role": "user", "content": req.message}
            ]
        )
        return {"reply": response.choices[0].message.content}
    except Exception as e:
        return {"reply": "AI 코치가 잠시 자리를 비웠어요!"}

@app.post("/api/storybook")
def generate_storybook(req: StoryRequest):
    try:
        # 1. 딥시크에게 영어 프롬프트 요청
        prompt_response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": "Translate the user's Korean diary into a simple English phrase (under 10 words). ONLY use English alphabets and spaces. NO punctuation. Add 'watercolor children book illustration' at the end."},
                {"role": "user", "content": req.text}
            ]
        )
        raw_prompt = prompt_response.choices[0].message.content.strip()
        
        # 🔥 2. 파이썬 강제 필터링: 영어 알파벳과 띄어쓰기를 제외한 모든 특수문자, 따옴표, 줄바꿈 강제 삭제!
        clean_prompt = re.sub(r'[^a-zA-Z\s]', '', raw_prompt).strip()
        
        # 만약 필터링 후 내용이 비어있다면 기본 프롬프트 사용
        if not clean_prompt:
            clean_prompt = "cute asian boy watercolor children book illustration"

        # 3. 주소창에 들어갈 수 있게 안전하게 변환 (띄어쓰기를 %20 등으로 변환)
        safe_prompt = urllib.parse.quote(clean_prompt)
        
        # 4. 그림 서버 URL 조합
        image_url = f"https://image.pollinations.ai/prompt/{safe_prompt}?width=400&height=400&nologo=true"
        
        # 👀 컴퓨터 터미널(까만 창)에서 제대로 주소가 만들어졌는지 확인하기 위한 출력
        print(f"\n[성공] 만들어진 그림 주소: {image_url}\n")
        
        return {
            "image_url": image_url, 
            "story_text": f"오늘의 동화: {req.text}"
        }
    except Exception as e:
        print(f"\n[에러] 동화책 생성 중 문제 발생: {str(e)}\n")
        # 🔥 에러가 나거나 그림 서버가 다운되더라도 엑박 대신 띄워줄 예쁜 기본 대체 이미지
        return {
            "image_url": "https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=400&q=80", 
            "story_text": "그림 서버가 잠시 혼잡해요. 예쁜 밤하늘을 대신 보여드려요!"
        }

app.mount("/", StaticFiles(directory="web", html=True), name="web")