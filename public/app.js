const CONFIG = {
    API_BASE: window.location.origin,
    REQUEST_TIMEOUT: 30000,
    MAX_CHAT_HISTORY: 50,
    TYPING_DELAY: 1000,
    AUTO_SCROLL_DELAY: 100
};

// ----- Global State Management -----
const AppState = {
    currentVideo: null,
    chatMode: 'hidden',
    chatHistory: [],
    isAITyping: false,
    videoTranscript: null,
    aiSummary: null
};

// ----- Utility Functions -----
function getYouTubeVideoID(url) {
    const patterns = [
        /(?:youtu\.be\/)([\w-]{11})/,
        /(?:youtube\.com\/watch\?v=)([\w-]{11})/,
        /(?:youtube\.com\/embed\/)([\w-]{11})/,
        /(?:youtube\.com\/v\/)([\w-]{11})/,
        /(?:youtube\.com\/shorts\/)([\w-]{11})/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

function formatNumber(num) {
    if (!num) return 'N/A';
    const number = parseInt(num);
    if (number >= 1000000000) return (number / 1000000000).toFixed(1) + 'B';
    if (number >= 1000000) return (number / 1000000).toFixed(1) + 'M';
    if (number >= 1000) return (number / 1000).toFixed(1) + 'K';
    return number.toLocaleString();
}

function formatDuration(duration) {
    if (!duration) return 'N/A';
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 'N/A';
    
    const hours = match[1] ? parseInt(match[1]) : 0;
    const minutes = match[2] ? parseInt(match[2]) : 0;
    const seconds = match[3] ? parseInt(match[3]) : 0;
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 30) return `${diffDays} days ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
}

function detectContentType(title, description, tags = []) {
    const text = (title + ' ' + description + ' ' + tags.join(' ')).toLowerCase();
    
    const categories = {
        'Tutorial/Educational': ['tutorial', 'how to', 'guide', 'learn', 'education'],
        'Gaming': ['game', 'gaming', 'gameplay', 'walkthrough'],
        'Music': ['music', 'song', 'album', 'artist', 'concert'],
        'Technology': ['tech', 'review', 'unboxing', 'gadget'],
        'Entertainment': ['funny', 'comedy', 'entertainment', 'reaction'],
        'News': ['news', 'breaking', 'update', 'report'],
        'Sports': ['sport', 'football', 'basketball', 'soccer'],
        'Beauty/Fashion': ['makeup', 'beauty', 'fashion', 'style'],
        'Cooking/Food': ['recipe', 'cooking', 'food', 'kitchen']
    };
    
    for (const [category, keywords] of Object.entries(categories)) {
        if (keywords.some(keyword => text.includes(keyword))) {
            return category;
        }
    }
    return 'General';
}

function calculateEngagementRate(views, likes, comments) {
    if (!views || views === 0) return 'N/A';
    const totalEngagement = (parseInt(likes) || 0) + (parseInt(comments) || 0);
    const rate = (totalEngagement / parseInt(views)) * 100;
    return rate.toFixed(2) + '%';
}

function getPopularityLevel(views) {
    const viewCount = parseInt(views) || 0;
    if (viewCount > 10000000) return { level: 'Viral', color: '#e74c3c' };
    if (viewCount > 1000000) return { level: 'Very Popular', color: '#f39c12' };
    if (viewCount > 100000) return { level: 'Popular', color: '#27ae60' };
    if (viewCount > 10000) return { level: 'Moderate', color: '#3498db' };
    return { level: 'Growing', color: '#9b59b6' };
}

function showError(message) {
    const errorContainer = document.querySelector('.error-container') || createErrorContainer();
    errorContainer.innerHTML = `
        <div class="error-message">
            <div class="error-icon">⚠️</div>
            <div class="error-text">${message}</div>
            <button onclick="closeError()" class="close-error">×</button>
        </div>
    `;
    errorContainer.style.display = 'block';
    setTimeout(() => errorContainer.style.display = 'none', 5000);
}

function showSuccess(message) {
    const successContainer = document.querySelector('.success-container') || createSuccessContainer();
    successContainer.innerHTML = `
        <div class="success-message">
            <div class="success-icon">✅</div>
            <div class="success-text">${message}</div>
            <button onclick="closeSuccess()" class="close-success">×</button>
        </div>
    `;
    successContainer.style.display = 'block';
    setTimeout(() => successContainer.style.display = 'none', 3000);
}

function createErrorContainer() {
    const container = document.createElement('div');
    container.className = 'error-container';
    document.body.appendChild(container);
    return container;
}

function createSuccessContainer() {
    const container = document.createElement('div');
    container.className = 'success-container';
    document.body.appendChild(container);
    return container;
}

window.closeError = () => {
    const container = document.querySelector('.error-container');
    if (container) container.style.display = 'none';
};

window.closeSuccess = () => {
    const container = document.querySelector('.success-container');
    if (container) container.style.display = 'none';
};

// ----- API Functions -----
async function apiRequest(endpoint, options = {}) {
    try {
        const response = await fetch(`${CONFIG.API_BASE}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'API request failed');
        }

        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

async function getVideoDetails(videoId) {
    return await apiRequest(`/api/video/${videoId}`);
}

async function getVideoTranscript(videoId) {
    try {
        const data = await apiRequest(`/api/transcript/${videoId}`);
        return data.transcript;
    } catch (error) {
        console.warn('Could not fetch transcript:', error.message);
        return null;
    }
}

async function generateAISummary(videoData, transcript) {
    return await apiRequest('/api/ai/summary', {
        method: 'POST',
        body: JSON.stringify({ video: videoData.video, transcript })
    });
}

async function chatWithAI(message, context = null) {
    return await apiRequest('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ 
            message, 
            context: context ? {
                video: context.video,
                transcript: AppState.videoTranscript
            } : null
        })
    });
}

// ----- Chat System Functions -----
function setChatMode(mode) {
    const chatContainer = document.getElementById('chatContainer');
    const chatToggleBtn = document.getElementById('chatToggleBtn');
    
    if (!chatContainer) return;
    
    chatContainer.classList.remove('hidden', 'embedded', 'fullscreen');
    chatContainer.classList.add(mode);
    AppState.chatMode = mode;
    
    if (chatToggleBtn) {
        chatToggleBtn.style.display = mode === 'hidden' ? 'flex' : 'none';
    }
    
    updateChatControls();
}

function updateChatControls() {
    const expandBtn = document.getElementById('expandChatBtn');
    const minimizeBtn = document.getElementById('minimizeChatBtn');
    
    if (expandBtn && minimizeBtn) {
        expandBtn.style.display = AppState.chatMode === 'embedded' ? 'flex' : 'none';
        minimizeBtn.style.display = AppState.chatMode === 'fullscreen' ? 'flex' : 'none';
    }
}

function addMessageToChat(message, sender = 'user', animate = true) {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;
    
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', sender);
    
    if (animate) {
        messageElement.style.opacity = '0';
        messageElement.style.transform = 'translateY(20px)';
    }
    
    if (sender === 'ai') {
        message = message
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
    }
    
    messageElement.innerHTML = message;
    messagesContainer.appendChild(messageElement);
    
    AppState.chatHistory.push({ message, sender, timestamp: Date.now() });
    
    if (AppState.chatHistory.length > CONFIG.MAX_CHAT_HISTORY) {
        AppState.chatHistory = AppState.chatHistory.slice(-CONFIG.MAX_CHAT_HISTORY);
        const messages = messagesContainer.children;
        if (messages.length > CONFIG.MAX_CHAT_HISTORY) {
            messages[0].remove();
        }
    }
    
    if (animate) {
        setTimeout(() => {
            messageElement.style.transition = 'all 0.3s ease-out';
            messageElement.style.opacity = '1';
            messageElement.style.transform = 'translateY(0)';
        }, 50);
    }
    
    setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, CONFIG.AUTO_SCROLL_DELAY);
}

function showTypingIndicator() {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;
    
    const typingElement = document.createElement('div');
    typingElement.classList.add('typing-indicator');
    typingElement.id = 'typingIndicator';
    typingElement.innerHTML = `
        <span>AI is typing</span>
        <div class="typing-dots">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        </div>
    `;
    
    messagesContainer.appendChild(typingElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    AppState.isAITyping = true;
}

function hideTypingIndicator() {
    const typingElement = document.getElementById('typingIndicator');
    if (typingElement) typingElement.remove();
    AppState.isAITyping = false;
}

function initializeChatWelcome() {
    if (AppState.currentVideo) {
        const { video } = AppState.currentVideo;
        const welcomeMessage = `👋 Hi! I'm your AI video assistant. I've analyzed **"${video.snippet.title}"** and I'm ready to answer any questions you have about this video!`;
        addMessageToChat(welcomeMessage, 'ai', false);
    }
}

async function handleChatMessage(message) {
    if (!message.trim() || AppState.isAITyping) return;
    
    addMessageToChat(message, 'user');
    
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.value = '';
        chatInput.style.height = 'auto';
        updateSendButton();
    }
    
    showTypingIndicator();
    
    try {
        const aiData = await chatWithAI(message, AppState.currentVideo);
        hideTypingIndicator();
        setTimeout(() => {
            addMessageToChat(aiData.response, 'ai');
        }, 500);
    } catch (error) {
        hideTypingIndicator();
        addMessageToChat(`Sorry, I encountered an error: ${error.message}`, 'ai');
    }
}

async function handleQuickAction(question) {
    await handleChatMessage(question);
}

function updateSendButton() {
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('chatSendBtn');
    
    if (chatInput && sendBtn) {
        const hasText = chatInput.value.trim().length > 0;
        sendBtn.disabled = !hasText || AppState.isAITyping;
    }
}

function autoResizeInput() {
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
    }
}

// ----- Video Analysis Functions -----
function updateAnalyzeButton(isAnalyzing) {
    const button = document.querySelector('.analyze-btn');
    if (!button) return;
    
    if (isAnalyzing) {
        button.textContent = 'Analyzing...';
        button.disabled = true;
        button.classList.add('loading');
    } else {
        button.textContent = 'Analyze Video';
        button.disabled = false;
        button.classList.remove('loading');
    }
}

async function displayVideoAnalysis(videoData) {
    const { video, channel } = videoData;
    const snippet = video.snippet;
    const statistics = video.statistics;
    const contentDetails = video.contentDetails;
    
    AppState.currentVideo = videoData;
    
    let resultsContainer = document.querySelector('.results-container');
    if (!resultsContainer) {
        resultsContainer = document.createElement('div');
        resultsContainer.className = 'results-container';
        document.querySelector('.container').appendChild(resultsContainer);
    }
    
    const thumbnail = snippet.thumbnails?.maxres?.url || 
                     snippet.thumbnails?.high?.url || 
                     snippet.thumbnails?.medium?.url;
    
    const contentType = detectContentType(snippet.title, snippet.description, snippet.tags);
    const popularity = getPopularityLevel(statistics?.viewCount);
    const engagementRate = calculateEngagementRate(
        statistics?.viewCount, 
        statistics?.likeCount, 
        statistics?.commentCount
    );
    
    resultsContainer.innerHTML = `
        <div class="video-hero">
            ${thumbnail ? `<img src="${thumbnail}" alt="Thumbnail" class="video-thumbnail">` : ''}
            <h2 class="video-title">${snippet.title}</h2>
            <div class="video-channel">
                <span>${snippet.channelTitle}</span>
                ${channel?.statistics?.subscriberCount && parseInt(channel.statistics.subscriberCount) > 100000 ? 
                    '<span class="verification-badge">✓ Popular</span>' : ''}
            </div>
            <div class="video-meta">
                <span>Published ${formatDate(snippet.publishedAt)}</span> •
                <span style="color: ${popularity.color}">${popularity.level}</span> •
                <span>${contentType}</span>
            </div>
        </div>

        <div class="ai-summary-section">
            <h3>🤖 AI Video Summary</h3>
            <div class="ai-summary-content" id="aiSummaryContent">
                <div class="ai-summary-loading">Generating AI summary...</div>
            </div>
            <button class="start-chat-btn" onclick="setChatMode('embedded')">Ask AI Questions</button>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${formatNumber(statistics?.viewCount)}</div>
                <div class="stat-label">Views</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${formatNumber(statistics?.likeCount)}</div>
                <div class="stat-label">Likes</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${formatNumber(statistics?.commentCount)}</div>
                <div class="stat-label">Comments</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${formatDuration(contentDetails?.duration)}</div>
                <div class="stat-label">Duration</div>
            </div>
            ${channel?.statistics?.subscriberCount ? `
                <div class="stat-card">
                    <div class="stat-value">${formatNumber(channel.statistics.subscriberCount)}</div>
                    <div class="stat-label">Channel Subscribers</div>
                </div>
            ` : ''}
            <div class="stat-card">
                <div class="stat-value">${engagementRate}</div>
                <div class="stat-label">Engagement Rate</div>
            </div>
        </div>

        <div class="description-section">
            <h3>Description</h3>
            <div class="description-content">
                ${snippet.description ? 
                    snippet.description.substring(0, 500).replace(/\n/g, '<br>') + 
                    (snippet.description.length > 500 ? '...' : '') : 
                    'No description available'}
            </div>
        </div>
    `;
    
    resultsContainer.style.display = 'block';
    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    generateAISummaryAsync(videoData);
}

async function generateAISummaryAsync(videoData) {
    try {
        AppState.videoTranscript = await getVideoTranscript(videoData.video.id);
        const summaryData = await generateAISummary(videoData, AppState.videoTranscript);
        AppState.aiSummary = summaryData.summary;
        
        const summaryContent = document.getElementById('aiSummaryContent');
        if (summaryContent) {
            summaryContent.innerHTML = AppState.aiSummary.replace(/\n/g, '<br>');
        }
    } catch (error) {
        console.error('AI Summary generation failed:', error);
        const summaryContent = document.getElementById('aiSummaryContent');
        if (summaryContent) {
            summaryContent.innerHTML = `
                <div style="color: rgba(255, 255, 255, 0.7);">
                    AI summary unavailable. ${error.message}
                </div>
            `;
        }
    }
}

// ----- Event Handlers -----
async function handleVideoAnalysis() {
    const urlInput = document.querySelector('.url-input');
    const url = urlInput?.value?.trim();

    if (!url) {
        showError('Please enter a YouTube video URL');
        return;
    }

    const videoId = getYouTubeVideoID(url);
    if (!videoId) {
        showError('Please enter a valid YouTube URL');
        return;
    }

    AppState.currentVideo = null;
    AppState.chatHistory = [];
    AppState.videoTranscript = null;
    AppState.aiSummary = null;
    setChatMode('hidden');

    updateAnalyzeButton(true);

    try {
        showSuccess('Fetching video data...');
        const videoData = await getVideoDetails(videoId);
        await displayVideoAnalysis(videoData);
        showSuccess('Video analysis completed successfully!');
    } catch (error) {
        showError(error.message);
    } finally {
        updateAnalyzeButton(false);
    }
}

// ----- Event Listeners -----
function initializeChatEventListeners() {
    const chatToggleBtn = document.getElementById('chatToggleBtn');
    if (chatToggleBtn) {
        chatToggleBtn.addEventListener('click', () => {
            setChatMode('embedded');
            if (AppState.chatHistory.length === 0) {
                initializeChatWelcome();
            }
        });
    }

    const expandBtn = document.getElementById('expandChatBtn');
    const minimizeBtn = document.getElementById('minimizeChatBtn');
    const closeBtn = document.getElementById('closeChatBtn');

    if (expandBtn) expandBtn.addEventListener('click', () => setChatMode('fullscreen'));
    if (minimizeBtn) minimizeBtn.addEventListener('click', () => setChatMode('embedded'));
    if (closeBtn) closeBtn.addEventListener('click', () => setChatMode('hidden'));

    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('input', () => {
            autoResizeInput();
            updateSendButton();
        });

        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const message = chatInput.value.trim();
                if (message) handleChatMessage(message);
            }
        });
    }

    const chatSendBtn = document.getElementById('chatSendBtn');
    if (chatSendBtn) {
        chatSendBtn.addEventListener('click', () => {
            const message = chatInput?.value.trim();
            if (message) handleChatMessage(message);
        });
    }

    const quickActions = document.getElementById('quickActions');
    if (quickActions) {
        quickActions.addEventListener('click', (e) => {
            if (e.target.classList.contains('quick-action-btn')) {
                const question = e.target.getAttribute('data-question');
                if (question) handleQuickAction(question);
            }
        });
    }
}

function initializeVideoAnalysis() {
    const analyzeBtn = document.querySelector('.analyze-btn');
    const urlInput = document.querySelector('.url-input');
    
    if (!analyzeBtn || !urlInput) return;

    analyzeBtn.addEventListener('click', handleVideoAnalysis);
    
    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleVideoAnalysis();
    });

    urlInput.addEventListener('input', function() {
        const url = this.value.trim();
        const videoId = getYouTubeVideoID(url);
        this.style.borderColor = url && !videoId ? '#e74c3c' : '';
    });
}

// ----- Initialization -----
document.addEventListener('DOMContentLoaded', () => {
    try {
        initializeVideoAnalysis();
        initializeChatEventListeners();
        setChatMode('hidden');
        
        console.log('🚀 YouTube Video Analyzer initialized');
    } catch (error) {
        console.error('Initialization error:', error);
        showError('Failed to initialize application');
    }
});
const enhancedCSS = `
<style>
.video-hero {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border-radius: 20px;
    padding: 30px;
    margin-bottom: 25px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    text-align: center;
}

.video-thumbnail {
    width: 100%;
    max-width: 480px;
    border-radius: 15px;
    margin-bottom: 20px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    transition: transform 0.3s ease;
}

.video-thumbnail:hover {
    transform: scale(1.05);
}

.video-title {
    color: white;
    font-size: 1.8rem;
    font-weight: 700;
    margin-bottom: 15px;
    line-height: 1.3;
}

.video-channel {
    color: rgba(255, 255, 255, 0.9);
    font-size: 1.2rem;
    margin-bottom: 15px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
}

.video-meta {
    color: rgba(255, 255, 255, 0.8);
    font-size: 1rem;
}

.verification-badge {
    background: #4CAF50;
    color: white;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 0.8rem;
    font-weight: 600;
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
    margin-bottom: 30px;
}

.stat-card {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border-radius: 15px;
    padding: 25px;
    text-align: center;
    border: 1px solid rgba(255, 255, 255, 0.2);
    transition: all 0.3s ease;
}

.stat-card:hover {
    transform: translateY(-5px);
    background: rgba(255, 255, 255, 0.15);
}

.stat-value {
    font-size: 2rem;
    font-weight: 700;
    color: white;
    margin-bottom: 8px;
}

.stat-label {
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.analysis-section, .description-section, .tags-section, .additional-info {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border-radius: 20px;
    padding: 30px;
    margin-bottom: 25px;
    border: 1px solid rgba(255, 255, 255, 0.2);
}

.analysis-section h3, .description-section h3, .tags-section h3 {
    color: white;
    font-size: 1.5rem;
    margin-bottom: 20px;
    font-weight: 600;
}

.analysis-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 15px;
}

.analysis-item, .info-item {
    color: rgba(255, 255, 255, 0.9);
    font-size: 1rem;
    line-height: 1.5;
    margin-bottom: 10px;
}

.description-content {
    color: rgba(255, 255, 255, 0.9);
    font-size: 1rem;
    line-height: 1.6;
}

.tags-container {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
}

.tag {
    background: rgba(255, 255, 255, 0.2);
    color: white;
    padding: 5px 12px;
    border-radius: 20px;
    font-size: 0.9rem;
    font-weight: 500;
    transition: background 0.3s ease;
}

.tag:hover {
    background: rgba(255, 255, 255, 0.3);
}

.results-container {
    animation: slideUp 0.5s ease-out;
}

.error-container, .success-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 1000;
    display: none;
    max-width: 400px;
}

.error-message, .success-message {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-radius: 15px;
    padding: 15px;
    display: flex;
    align-items: center;
    gap: 10px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.2);
}

.error-message {
    border-left: 4px solid #e74c3c;
}

.success-message {
    border-left: 4px solid #27ae60;
}

.error-icon, .success-icon {
    font-size: 1.2rem;
}

.error-text, .success-text {
    flex: 1;
    color: #333;
    font-weight: 500;
}

.close-error, .close-success {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #666;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.close-error:hover, .close-success:hover {
    color: #333;
}

.analyze-btn.loading {
    background: rgba(124, 58, 237, 0.5);
    cursor: not-allowed;
}

.url-input {
    transition: border-color 0.3s ease;
}

@keyframes slideUp {
    from {
        opacity: 0;
        transform: translateY(30px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@media (max-width: 768px) {
    .video-title {
        font-size: 1.4rem;
    }
    
    .video-channel {
        font-size: 1rem;
    }
    
    .stat-value {
        font-size: 1.5rem;
    }
    
    .stats-grid {
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    }
    
    .error-container, .success-container {
        left: 20px;
        right: 20px;
        max-width: none;
    }
}
</style>
`;

// Inject enhanced CSS
document.head.insertAdjacentHTML('beforeend', enhancedCSS);