<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/2ac5b83f-5c8f-4b63-b1c5-d8292563cdaa

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. **구글 시트 연동 (선택):**
   - 구글 시트(과제리뷰 시트)에서 Extensions > Apps Script에 [google-apps-script.js](google-apps-script.js) 코드 붙여넣기
   - Deploy > New deployment > Web App > Execute as: Me, Who has access: Anyone
   - 배포된 Web App URL을 `.env`의 `VITE_SHEET_API_URL`에 설정
   - **과제리뷰**: GET으로 조회 (A열=본부, C~G=임원 도출, H~N=참고 자료)
   - **작성내용**: POST로 웹에서 작성한 구체화 내용이 자동 저장됨 (시트 없으면 생성)
4. Run the app:
   `npm run dev`
