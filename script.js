// -------------------------------------------------------------------
//  CONFIG (Safe for Frontend)
// -------------------------------------------------------------------
const CONFIG = {
  REQUEST_TIMEOUT: 30000,
  YOUTUBE_API_ENDPOINT: '/api/youtube',
  AI_API_ENDPOINT: '/api/ai',
  MAX_CHAT_HISTORY: 50,
  AUTO_SCROLL_DELAY: 100
};

// -------------------------------------------------------------------
//  GLOBAL STATE
// -------------------------------------------------------------------
const AppState = {
  currentVideo: null,
  chatMode: 'hidden',
  chatHistory: [],
  isAITyping: false,
  videoTranscript: null,
  aiSummary: null
};

// -------------------------------------------------------------------
//  UTILITY FUNCTIONS
// -------------------------------------------------------------------
function getYouTubeVideoID(url) {
  const match = url.match(/(?:youtu\.be\/|watch\?v=|embed\/|shorts\/)([\w-]{11})/);
  return match ? match[1] : null;
}

function formatNumber(num) {
  if (!num) return 'N/A';
  return Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(num);
}

function formatDuration(duration) {
  if (!duration) return 'N/A';
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 'N/A';

  const hours = match[1] || 0;
  const minutes = match[2] || 0;
  const seconds = match[3] || 0;
  return hours > 0
    ? `${hours}:${minutes.padStart(2,'0')}:${seconds.padStart(2,'0')}`
    : `${minutes}:${seconds.padStart(2,'0')}`;
}

function showError(message) {
  alert(message);
}

function showSuccess(message) {
  console.log(message);
}

// -------------------------------------------------------------------
//  API REQUEST HELPERS
// -------------------------------------------------------------------
async function fetchWithTimeout(url, options, timeout = CONFIG.REQUEST_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// -------------------------------------------------------------------
//  BACKEND-API CALLS
// -------------------------------------------------------------------
async function getVideoDetails(videoId) {
  const res = await fetchWithTimeout(CONFIG.YOUTUBE_API_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoId })
  });

  if (!res.ok) throw new Error('Failed to fetch video data');
  return res.json();
}

async function callGeminiAPI(prompt, analysisType = 'chat') {
  const res = await fetchWithTimeout(CONFIG.AI_API_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: AppState.currentVideo?.video?.snippet?.title || '',
      description: AppState.currentVideo?.video?.snippet?.description || '',
      videoId: AppState.currentVideo?.video?.id || '',
      customPrompt: prompt,
      analysisType
    })
  });

  if (!res.ok) throw new Error('AI Service Error');
  const data = await res.json();
  return data.analysis || data.summary || 'No AI response';
}

// -------------------------------------------------------------------
//  VIDEO ANALYSIS
// -------------------------------------------------------------------
async function handleVideoAnalysis() {
  const urlInput = document.querySelector('.url-input');
  const url = urlInput.value.trim();
  const videoId = getYouTubeVideoID(url);

  if (!videoId) return showError('Invalid YouTube URL');

  AppState.chatHistory = [];
  AppState.aiSummary = null;

  try {
    const videoData = await getVideoDetails(videoId);
    AppState.currentVideo = videoData;
    displayVideo(videoData);
    generateAISummaryAsync(videoData);
  } catch (err) {
    showError(err.message);
  }
}

function displayVideo(videoData) {
  const snippet = videoData.video.snippet;
  const thumbnail = snippet.thumbnails.high?.url || '';

  const resultsContainer = document.querySelector('.results-container');
  if (!resultsContainer) return showError("Missing .results-container in HTML");

  // Create content safely
  resultsContainer.innerHTML = `
    <div class="video-hero">
      <img src="${thumbnail}" class="video-thumbnail" />
      <h2>${snippet.title}</h2>
      <p>${snippet.channelTitle}</p>
      <button onclick="setChatMode('embedded')">Ask AI</button>
    </div>
    <div id="aiSummaryContent">Generating AI summary...</div>
  `;

async function generateAISummaryAsync() {
  try {
    const response = await callGeminiAPI('', 'summary');
    document.getElementById('aiSummaryContent').innerHTML = response;
  } catch {
    document.getElementById('aiSummaryContent').innerHTML = 'Failed to generate summary';
  }
}

// -------------------------------------------------------------------
//  CHAT SYSTEM
// -------------------------------------------------------------------
async function handleChatMessage(message) {
  addMessage(message, 'user');
  showTyping();

  try {
    const aiResponse = await callGeminiAPI(message, 'chat');
    hideTyping();
    addMessage(aiResponse, 'ai');
  } catch {
    hideTyping();
    addMessage('Error getting AI response', 'ai');
  }
}

function addMessage(text, sender) {
  const chat = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = `message ${sender}`;
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function showTyping() {
  AppState.isAITyping = true;
}

function hideTyping() {
  AppState.isAITyping = false;
}

// -------------------------------------------------------------------
//  CHAT MODE
// -------------------------------------------------------------------
function setChatMode(mode) {
  const chat = document.getElementById('chatContainer');
  chat.className = mode;
  AppState.chatMode = mode;
}

// -------------------------------------------------------------------
//  EVENT BINDING
// -------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('.analyze-btn')
    .addEventListener('click', handleVideoAnalysis);

  document.getElementById('chatSendBtn')
    .addEventListener('click', () => {
      const input = document.getElementById('chatInput');
      handleChatMessage(input.value.trim());
      input.value = '';
    });
});




