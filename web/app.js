let currentRecords = []; 

// 🔥 앱 켤 때 핸드폰 창고(로컬 스토리지)에서 자동 불러오기
function loadFromLocal() {
    const saved = localStorage.getItem('diaryRecords');
    if (saved) currentRecords = JSON.parse(saved);
}

// 🔥 기록이 바뀔 때마다 핸드폰 창고에 자동 저장하기
function saveToLocal() {
    localStorage.setItem('diaryRecords', JSON.stringify(currentRecords));
}

function getFormattedTime(date) {
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

function renderRecords() {
    const historyContainer = document.getElementById('record-history');
    historyContainer.innerHTML = ''; 
    currentRecords.sort((a, b) => a.timestamp - b.timestamp);

    currentRecords.forEach((record, index) => {
        const recordEl = document.createElement('div');
        recordEl.className = 'record-result';
        recordEl.style.marginBottom = '10px';
        
        const viewMode = `
            <div id="view-${index}">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span style="font-size: 12px; color: #888;">${record.timeStr}</span>
                    <div>
                        <button onclick="editRecord(${index})" style="background:none; border:none; color:#2196F3; cursor:pointer; margin-right:8px;"><i class="fas fa-edit"></i></button>
                        <button onclick="deleteRecord(${index})" style="background:none; border:none; color:#e74c3c; cursor:pointer;"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <div style="font-size: 14px; margin-bottom: 8px;">${record.text}</div>
                <div class="tags">${record.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>
            </div>
        `;

        const editMode = `
            <div id="edit-${index}" style="display: none;">
                <textarea id="edit-text-${index}" style="width: 100%; padding: 8px; margin-bottom: 5px;">${record.text}</textarea>
                <input type="text" id="edit-tags-${index}" value="${record.tags.join(' ')}" style="width: 100%; padding: 8px; margin-bottom: 5px;">
                <button onclick="saveRecord(${index})" class="generate-btn" style="background-color: #2196F3; padding: 5px; width:100%;">저장</button>
            </div>
        `;
        recordEl.innerHTML = viewMode + editMode;
        historyContainer.appendChild(recordEl);
    });
    historyContainer.scrollTop = historyContainer.scrollHeight;
}

// 처음 켤 때 데이터 불러와서 화면에 그리기
loadFromLocal();
renderRecords();

window.editRecord = (index) => {
    document.getElementById(`view-${index}`).style.display = 'none';
    document.getElementById(`edit-${index}`).style.display = 'block';
};
window.saveRecord = (index) => {
    currentRecords[index].text = document.getElementById(`edit-text-${index}`).value.trim();
    currentRecords[index].tags = document.getElementById(`edit-tags-${index}`).value.trim().split(' ').filter(t => t.startsWith('#'));
    saveToLocal(); // 🔥 덮어쓰기
    renderRecords();
};
window.deleteRecord = (index) => {
    if(confirm("기록을 삭제할까요?")) { 
        currentRecords.splice(index, 1); 
        saveToLocal(); // 🔥 덮어쓰기
        renderRecords(); 
    }
};

// 🔥 예전처럼 깔끔한 텍스트 파일(.txt)로 내보내기
document.getElementById('download-btn').addEventListener('click', () => {
    if (currentRecords.length === 0) return alert("다운로드할 기록이 없습니다.");
    
    let textContent = "우리아이 성장 일기 백업\n=========================\n\n";
    currentRecords.forEach((record, index) => {
        textContent += `[${index + 1}번째 기록]\n`;
        textContent += `일시: ${record.timeStr}\n`;
        textContent += `내용: ${record.text}\n`;
        textContent += `태그: ${record.tags.join(' ')}\n`;
        textContent += `-------------------------\n\n`;
    });

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `육아일기_전체백업.txt`; 
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

// 마이크 음성 인식
document.getElementById('mic-btn').addEventListener('click', () => {
    const micBtn = document.getElementById('mic-btn');
    const micStatus = document.getElementById('mic-status');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR'; recognition.interimResults = false; 

    recognition.onstart = () => { micBtn.classList.add('recording'); micStatus.innerText = "듣고 있어요..."; };
    recognition.onresult = async (event) => {
        const transcript = event.results[0][0].transcript;
        micStatus.innerText = "AI 요약 중입니다...";
        try {
            const res = await fetch('/api/record', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ audio_text: transcript })
            });
            const result = await res.json();
            const now = new Date();
            
            // 새 기록 추가
            currentRecords.push({ timestamp: now.getTime(), timeStr: getFormattedTime(now), text: result.transcript, tags: result.tags });
            saveToLocal(); // 🔥 즉시 폰에 저장
            renderRecords(); 
            micStatus.innerText = "기록 완료!";
        } catch (error) { micStatus.innerText = "서버 오류!"; }
    };
    recognition.onend = () => micBtn.classList.remove('recording');
    recognition.start(); 
});

// 🌟 스와이프 및 하단 네비게이션 로직 🌟
const wrapper = document.getElementById('swipe-wrapper');
const navButtons = document.querySelectorAll('.nav-item');
let currentIndex = 0;

function goToTab(index) {
    currentIndex = index;
    wrapper.style.transform = `translateX(-${index * 100}%)`; 
    navButtons.forEach((btn, i) => btn.classList.toggle('active', i === index));
    document.getElementById('header-title').innerText = navButtons[index].getAttribute('data-title');
}

navButtons.forEach((btn, index) => {
    btn.addEventListener('click', () => goToTab(index));
});

let startX = 0;
let startY = 0;
let isDragging = false;
const swipeContainer = document.getElementById('swipe-container');

swipeContainer.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    isDragging = true;
});

swipeContainer.addEventListener('touchend', (e) => {
    if (!isDragging) return;
    isDragging = false;
    let endX = e.changedTouches[0].clientX;
    let endY = e.changedTouches[0].clientY;
    
    let diffX = startX - endX;
    let diffY = startY - endY;

    if (Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX > 50 && currentIndex < 4) goToTab(currentIndex + 1); 
        else if (diffX < -50 && currentIndex > 0) goToTab(currentIndex - 1); 
    }
});

// AI 챗봇
const chatBox = document.getElementById('chat-box');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');

function appendChat(text, sender) {
    const div = document.createElement('div');
    div.className = `message ${sender}`; div.innerText = text;
    chatBox.appendChild(div); chatBox.scrollTop = chatBox.scrollHeight;
    return div;
}

async function sendChat() {
    const text = chatInput.value.trim(); if(!text) return;
    appendChat(text, 'user'); chatInput.value = '';
    const loading = appendChat("코치가 답변을 쓰는 중...", 'ai');
    try {
        const res = await fetch('/api/chat', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
        });
        const data = await res.json();
        chatBox.removeChild(loading); appendChat(data.reply, 'ai');
    } catch (e) { chatBox.removeChild(loading); appendChat("서버 오류", 'ai'); }
}
sendBtn.addEventListener('click', sendChat);
chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChat(); });

// 동화책 생성
document.querySelector('#tab-storybook .generate-btn').addEventListener('click', async () => {
    const imgArea = document.querySelector('.book-image');
    const textArea = document.querySelector('.book-text');
    
    if (currentRecords.length === 0) return alert("먼저 기록 탭에서 일상을 녹음해주세요!");
    
    imgArea.innerHTML = "🎨 AI가 열심히 그림을 그리고 있어요... (약 10초 소요)";
    textArea.innerText = "잠시만 기다려주세요!";
    
    const latestRecordText = currentRecords[currentRecords.length - 1].text;

    try {
        const res = await fetch('/api/storybook', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: latestRecordText })
        });
        const data = await res.json();
        
        imgArea.innerHTML = `<img src="${data.image_url}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;" onerror="this.onerror=null; this.parentElement.innerHTML='그림을 불러오지 못했습니다. 다시 시도해주세요.';"/>`;
        textArea.innerText = data.story_text;
    } catch (error) {
        imgArea.innerHTML = "그림 생성 통신 실패 😢";
    }
});