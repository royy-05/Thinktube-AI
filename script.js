// ----- Configuration -----
const CONFIG = {
    REQUEST_TIMEOUT: 30000, // 30 second timeout
    
    // API Endpoints
   YOUTUBE_API_ENDPOINT: '/api/youtube',
   AI_API_ENDPOINT: '/api/ai',
    
    // Chat Settings
    MAX_CHAT_HISTORY: 50,
    TYPING_DELAY: 1000,
    AUTO_SCROLL_DELAY: 100
};

// ----- Global State Management -----
const AppState = {
    currentVideo: null,
    chatMode: 'hidden', // 'hidden' | 'embedded' | 'fullscreen'
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
    
    // Parse ISO 8601 duration (PT4M13S format)
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
        'Tutorial/Educational': ['tutorial', 'how to', 'guide', 'learn', 'education', 'course', 'lesson', 'teaching', 'explain'],
        'Gaming': ['game', 'gaming', 'gameplay', 'walkthrough', 'let\'s play', 'review', 'trailer', 'stream'],
        'Music': ['music', 'song', 'album', 'artist', 'concert', 'cover', 'remix', 'audio', 'lyrics'],
        'Technology': ['tech', 'review', 'unboxing', 'gadget', 'phone', 'computer', 'software', 'app'],
        'Entertainment': ['funny', 'comedy', 'entertainment', 'reaction', 'prank', 'challenge', 'vlog'],
        'News': ['news', 'breaking', 'update', 'report', 'politics', 'current', 'today'],
        'Sports': ['sport', 'football', 'basketball', 'soccer', 'match', 'game', 'highlights'],
        'Beauty/Fashion': ['makeup', 'beauty', 'fashion', 'style', 'outfit', 'skincare', 'hair'],
        'Cooking/Food': ['recipe', 'cooking', 'food', 'kitchen', 'chef', 'baking', 'restaurant']
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
    console.error(message);
    
    // Create a nice error display
    const errorContainer = document.querySelector('.error-container') || createErrorContainer();
    errorContainer.innerHTML = `
        <div class="error-message">
            <div class="error-icon">⚠️</div>
            <div class="error-text">${message}</div>
            <button onclick="closeError()" class="close-error">×</button>
        </div>
    `;
    errorContainer.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        if (errorContainer) {
            errorContainer.style.display = 'none';
        }
    }, 5000);
}

function showSuccess(message) {
    console.log(message);
    
    // Create a nice success display
    const successContainer = document.querySelector('.success-container') || createSuccessContainer();
    successContainer.innerHTML = `
        <div class="success-message">
            <div class="success-icon">✅</div>
            <div class="success-text">${message}</div>
            <button onclick="closeSuccess()" class="close-success">×</button>
        </div>
    `;
    successContainer.style.display = 'block';
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        if (successContainer) {
            successContainer.style.display = 'none';
        }
    }, 3000);
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

function closeError() {
    const errorContainer = document.querySelector('.error-container');
    if (errorContainer) {
        errorContainer.style.display = 'none';
    }
}

function closeSuccess() {
    const successContainer = document.querySelector('.success-container');
    if (successContainer) {
        successContainer.style.display = 'none';
    }
}

// ----- API Functions -----
async function fetchWithTimeout(url, options, timeout = CONFIG.REQUEST_TIMEOUT) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

// YouTube API Functions
async function getVideoDetails(videoId) {
    try {
        const response = await fetchWithTimeout(CONFIG.YOUTUBE_API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ videoId })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to fetch video data');
        }
        
        const data = await response.json();
        
        return {
            video: data.video,
            channel: data.channel
        };
        
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Request timed out - please try again');
        }
        
        if (error.message.includes('fetch')) {
            throw new Error('Network error - please check your internet connection');
        }
        
        throw error;
    }
}

// Gemini AI Functions
async function generateAISummary(videoData, transcript) {
    try {
        const { video } = videoData;
        const snippet = video.snippet;
        
        const prompt = `Please provide a comprehensive summary of this YouTube video:

Title: ${snippet.title}
Channel: ${snippet.channelTitle}
Description: ${snippet.description ? snippet.description.substring(0, 500) : 'No description available'}
Duration: ${formatDuration(video.contentDetails?.duration)}
${transcript ? `\nTranscript: ${transcript.substring(0, 1000)}` : ''}

Please provide:
1. A brief overview (2-3 sentences)
2. Main topics covered (bullet points)
3. Key takeaways (3-5 points)
4. Target audience

Format the response in a clear, structured way.`;

        const response = await callGeminiAPI(prompt);
        return response;
        
    } catch (error) {
        console.error('AI Summary error:', error);
        throw new Error('Failed to generate AI summary');
    }
}

async function chatWithAI(message, context = null) {
    try {
        // The backend will handle context automatically using the video data
        const response = await callGeminiAPI(message, 'chat');
        return response;
        
    } catch (error) {
        console.error('AI Chat error:', error);
        throw new Error('Failed to get AI response');
    }
}

async function callGeminiAPI(prompt, analysisType = 'full') {
    try {
        const response = await fetchWithTimeout(CONFIG.AI_API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                title: AppState.currentVideo?.video?.snippet?.title || '',
                description: AppState.currentVideo?.video?.snippet?.description || '',
                videoId: AppState.currentVideo?.video?.id || '',
                analysisType: analysisType,
                customPrompt: prompt // For chat messages
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'AI service error');
        }
        
        const data = await response.json();
        
        // Handle structured analysis vs simple chat response
        if (data.analysis && typeof data.analysis === 'object' && data.analysis.rawAnalysis) {
            return data.analysis.rawAnalysis;
        } else if (data.analysis) {
            return typeof data.analysis === 'string' ? data.analysis : JSON.stringify(data.analysis, null, 2);
        }
        
        return 'No response from AI service';
        
    } catch (error) {
        console.error('AI API Error:', error);
        throw new Error('AI service error');
    }
}
// ----- Chat System Functions -----

function setChatMode(mode) {
    const chatContainer = document.getElementById('chatContainer');
    const chatToggleBtn = document.getElementById('chatToggleBtn');
    
    if (!chatContainer) return;
    
    // Remove all mode classes
    chatContainer.classList.remove('hidden', 'embedded', 'fullscreen');
    
    // Add new mode class
    chatContainer.classList.add(mode);
    
    // Update state
    AppState.chatMode = mode;
    
    // Show/hide toggle button
    if (chatToggleBtn) {
        chatToggleBtn.style.display = mode === 'hidden' ? 'flex' : 'none';
    }
    
    // Update control buttons visibility
    updateChatControls();
    
    console.log(`Chat mode changed to: ${mode}`);
}

function updateChatControls() {
    const expandBtn = document.getElementById('expandChatBtn');
    const minimizeBtn = document.getElementById('minimizeChatBtn');
    
    if (expandBtn && minimizeBtn) {
        // Show appropriate controls based on current mode
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
    
    // Handle message formatting
    if (sender === 'ai') {
        // Simple markdown-like formatting for AI messages
        message = message
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
    }
    
    messageElement.innerHTML = message;
    messagesContainer.appendChild(messageElement);
    
    // Add to chat history
    AppState.chatHistory.push({ message, sender, timestamp: Date.now() });
    
    // Limit chat history
    if (AppState.chatHistory.length > CONFIG.MAX_CHAT_HISTORY) {
        AppState.chatHistory = AppState.chatHistory.slice(-CONFIG.MAX_CHAT_HISTORY);
        // Remove old messages from DOM
        const messages = messagesContainer.children;
        if (messages.length > CONFIG.MAX_CHAT_HISTORY) {
            messages[0].remove();
        }
    }
    
    // Animate in
    if (animate) {
        setTimeout(() => {
            messageElement.style.transition = 'all 0.3s ease-out';
            messageElement.style.opacity = '1';
            messageElement.style.transform = 'translateY(0)';
        }, 50);
    }
    
    // Scroll to bottom
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
    if (typingElement) {
        typingElement.remove();
    }
    AppState.isAITyping = false;
}

function initializeChatWelcome() {
    if (AppState.currentVideo) {
        const { video } = AppState.currentVideo;
        const welcomeMessage = `👋 Hi! I'm your AI video assistant. I've analyzed **"${video.snippet.title}"** and I'm ready to answer any questions you have about this video. You can ask me to summarize it, explain specific topics, or anything else!`;
        
        addMessageToChat(welcomeMessage, 'ai', false);
    }
}

async function handleChatMessage(message) {
    if (!message.trim() || AppState.isAITyping) return;
    
    // Add user message
    addMessageToChat(message, 'user');
    
    // Clear input
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.value = '';
        chatInput.style.height = 'auto';
        updateSendButton();
    }
    
    // Show typing indicator
    showTypingIndicator();
    
    try {
        // Get AI response
        const aiResponse = await chatWithAI(message, AppState.currentVideo);
        
        // Hide typing indicator
        hideTypingIndicator();
        
        // Add AI response
        setTimeout(() => {
            addMessageToChat(aiResponse, 'ai');
        }, 500);
        
    } catch (error) {
        hideTypingIndicator();
        addMessageToChat(`Sorry, I encountered an error: ${error.message}`, 'ai');
        console.error('Chat error:', error);
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
    
    // Store current video data
    AppState.currentVideo = videoData;
    
    // Create or get results container
    let resultsContainer = document.querySelector('.results-container');
    if (!resultsContainer) {
        resultsContainer = document.createElement('div');
        resultsContainer.className = 'results-container';
        document.querySelector('.container').appendChild(resultsContainer);
    }
    
    // Get video thumbnail
    const thumbnail = snippet.thumbnails?.maxres?.url || 
                     snippet.thumbnails?.high?.url || 
                     snippet.thumbnails?.medium?.url || 
                     snippet.thumbnails?.default?.url;
    
    // Detect content type
    const contentType = detectContentType(snippet.title, snippet.description, snippet.tags);
    const popularity = getPopularityLevel(statistics?.viewCount);
    const engagementRate = calculateEngagementRate(
        statistics?.viewCount, 
        statistics?.likeCount, 
        statistics?.commentCount
    );
    
    resultsContainer.innerHTML = `
        <!-- Video Hero Section -->
        <div class="video-hero">
            ${thumbnail ? `<img src="${thumbnail}" alt="Video Thumbnail" class="video-thumbnail" onerror="this.style.display='none'">` : ''}
            <h2 class="video-title">${snippet.title || 'Untitled Video'}</h2>
            <div class="video-channel">
                <span>${snippet.channelTitle || 'Unknown Channel'}</span>
                ${channel?.statistics?.subscriberCount && parseInt(channel.statistics.subscriberCount) > 100000 ? 
                    '<span class="verification-badge">✓ Popular</span>' : ''}
            </div>
            <div class="video-meta">
                <span>Published ${formatDate(snippet.publishedAt)}</span> •
                <span style="color: ${popularity.color}">${popularity.level}</span> •
                <span>${contentType}</span>
            </div>
        </div>

        <!-- AI Summary Section -->
        <div class="ai-summary-section">
            <h3>🤖 AI Video Summary</h3>
            <div class="ai-summary-content" id="aiSummaryContent">
                <div class="ai-summary-loading">Generating AI summary...</div>
            </div>
            <button class="start-chat-btn" onclick="setChatMode('embedded')">Ask AI Questions</button>
        </div>

        <!-- Statistics Grid -->
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

        <!-- Content Analysis -->
        <div class="analysis-section">
            <h3>Content Analysis</h3>
            <div class="analysis-grid">
                <div class="analysis-item">
                    <strong>Content Type:</strong> ${contentType}
                </div>
                <div class="analysis-item">
                    <strong>Channel Videos:</strong> ${channel?.statistics?.videoCount ? 
                        `${formatNumber(channel.statistics.videoCount)} total videos` : 'Not available'}
                </div>
                <div class="analysis-item">
                    <strong>Performance:</strong> ${popularity.level} 
                    (${formatNumber(statistics?.viewCount)} views)
                </div>
                <div class="analysis-item">
                    <strong>Audience Engagement:</strong> 
                    ${statistics?.likeCount && statistics?.viewCount ? 
                        `${((parseInt(statistics.likeCount) / parseInt(statistics.viewCount)) * 100).toFixed(2)}% like rate` : 'N/A'}
                </div>
            </div>
        </div>

        <!-- Description -->
        <div class="description-section">
            <h3>Description</h3>
            <div class="description-content">
                ${snippet.description ? 
                    snippet.description.substring(0, 500).replace(/\n/g, '<br>') + 
                    (snippet.description.length > 500 ? '...' : '') : 
                    'No description available'}
            </div>
        </div>

        <!-- Tags -->
        ${snippet.tags && snippet.tags.length > 0 ? `
            <div class="tags-section">
                <h3>Tags</h3>
                <div class="tags-container">
                    ${snippet.tags.slice(0, 10).map(tag => `<span class="tag">#${tag}</span>`).join('')}
                    ${snippet.tags.length > 10 ? `<span class="tag">+${snippet.tags.length - 10} more</span>` : ''}
                </div>
            </div>
        ` : ''}

        <!-- Additional Info -->
        <div class="additional-info">
            <div class="info-item">
                <strong>Video ID:</strong> ${video.id}
            </div>
            <div class="info-item">
                <strong>Language:</strong> ${snippet.defaultLanguage || snippet.defaultAudioLanguage || 'Not specified'}
            </div>
            ${contentDetails?.definition ? `
                <div class="info-item">
                    <strong>Quality:</strong> ${contentDetails.definition.toUpperCase()}
                </div>
            ` : ''}
        </div>
    `;
    
    // Show results with animation
    resultsContainer.style.display = 'block';
    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    // Generate AI summary in background
    generateAISummaryAsync(videoData).then(summary => {
    const summaryContent = document.getElementById('aiSummaryContent');
    if (summaryContent) {
        summaryContent.innerHTML = `<div class="ai-summary-text">${summary}</div>`;
        AppState.aiSummary = summary;
    }
}).catch(error => {
    const summaryContent = document.getElementById('aiSummaryContent');
    if (summaryContent) {
        summaryContent.innerHTML = `<div class="ai-summary-error">Unable to generate AI summary: ${error.message}</div>`;
    }
});
}

async function generateAISummary(videoData, transcript) {
    try {
        const response = await callGeminiAPI('', 'summary'); // Use backend's summary analysis
        return response;
        
    } catch (error) {
        console.error('AI Summary error:', error);
        throw new Error('Failed to generate AI summary');
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
        showError('Please enter a valid YouTube URL (youtube.com, youtu.be, or shorts)');
        return;
    }

    // Reset chat state for new video
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

// ----- Chat Event Handlers -----
function initializeChatEventListeners() {
    // Chat toggle button
    const chatToggleBtn = document.getElementById('chatToggleBtn');
    if (chatToggleBtn) {
        chatToggleBtn.addEventListener('click', () => {
            setChatMode('embedded');
            if (AppState.chatHistory.length === 0) {
                initializeChatWelcome();
            }
        });
    }

    // Chat control buttons
    const expandBtn = document.getElementById('expandChatBtn');
    const minimizeBtn = document.getElementById('minimizeChatBtn');
    const closeBtn = document.getElementById('closeChatBtn');

    if (expandBtn) {
        expandBtn.addEventListener('click', () => setChatMode('fullscreen'));
    }

    if (minimizeBtn) {
        minimizeBtn.addEventListener('click', () => setChatMode('embedded'));
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => setChatMode('hidden'));
    }

    // Chat input
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
                if (message) {
                    handleChatMessage(message);
                }
            }
        });

        // Prevent form submission
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
            }
        });
    }

    // Send button
    const chatSendBtn = document.getElementById('chatSendBtn');
    if (chatSendBtn) {
        chatSendBtn.addEventListener('click', () => {
            const chatInput = document.getElementById('chatInput');
            const message = chatInput?.value.trim();
            if (message) {
                handleChatMessage(message);
            }
        });
    }

    // Quick action buttons
    const quickActions = document.getElementById('quickActions');
    if (quickActions) {
        quickActions.addEventListener('click', (e) => {
            if (e.target.classList.contains('quick-action-btn')) {
                const question = e.target.getAttribute('data-question');
                if (question) {
                    handleQuickAction(question);
                }
            }
        });
    }
}

function initializeNavigation() {
    document.querySelectorAll('.btn-section li').forEach(item => {
        item.addEventListener('click', function() {
            document.querySelectorAll('.btn-section li').forEach(li => {
                li.style.color = 'rgba(255, 255, 255, 0.8)';
                li.classList.remove('active');
            });
            
            this.style.color = '#7c3aed';
            this.classList.add('active');
        });
    });
}

function initializeVideoAnalysis() {
    const analyzeBtn = document.querySelector('.analyze-btn');
    const urlInput = document.querySelector('.url-input');
    
    if (!analyzeBtn || !urlInput) {
        console.warn('Analyze button or URL input not found');
        return;
    }

    analyzeBtn.addEventListener('click', handleVideoAnalysis);
    
    urlInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleVideoAnalysis();
        }
    });

    // Add input validation
    urlInput.addEventListener('input', function() {
        const url = this.value.trim();
        const videoId = getYouTubeVideoID(url);
        
        if (url && !videoId) {
            this.style.borderColor = '#e74c3c';
        } else {
            this.style.borderColor = '';
        }
    });
}

function initializeParallaxEffect() {
    let ticking = false;
    
    function updateParallax() {
        const scrolled = window.pageYOffset;
        const shapes = document.querySelectorAll('.shape');

        shapes.forEach((shape, index) => {
            const speed = 0.5 + (index * 0.2);
            const translateY = scrolled * speed;
            const rotate = scrolled * 0.1;
            
            shape.style.transform = `translateY(${translateY}px) rotate(${rotate}deg)`;
        });
        
        ticking = false;
    }

    window.addEventListener('scroll', function() {
        if (!ticking) {
            requestAnimationFrame(updateParallax);
            ticking = true;
        }
    });
}

function initializeChatButton() {
    const chatBtn = document.querySelector('.btn-start');
    if (chatBtn) {
        chatBtn.addEventListener('click', function() {
            showSuccess('Login feature - implement your authentication system here!');
        });
    }
}

// ----- Keyboard Shortcuts -----
function initializeKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Escape key to close chat
        if (e.key === 'Escape' && AppState.chatMode !== 'hidden') {
            setChatMode('hidden');
            return;
        }

        // Ctrl/Cmd + K to open chat
        if ((e.ctrlKey || e.metaKey) && e.key === 'k' && AppState.currentVideo) {
            e.preventDefault();
            if (AppState.chatMode === 'hidden') {
                setChatMode('embedded');
                if (AppState.chatHistory.length === 0) {
                    initializeChatWelcome();
                }
            }
            
            // Focus chat input
            const chatInput = document.getElementById('chatInput');
            if (chatInput) {
                setTimeout(() => chatInput.focus(), 100);
            }
        }

        // F11 to toggle fullscreen chat
        if (e.key === 'F11' && AppState.chatMode !== 'hidden') {
            e.preventDefault();
            setChatMode(AppState.chatMode === 'fullscreen' ? 'embedded' : 'fullscreen');
        }
    });
}

// ----- Cleanup Functions -----
let eventListenersInitialized = false;

function cleanup() {
    // Remove dynamic event listeners if needed
    console.log('Cleanup performed');
}

// ----- Enhanced Error Handling -----
window.addEventListener('unhandledrejection', event => {
    console.error('Unhandled promise rejection:', event.reason);
    showError('An unexpected error occurred. Please try again.');
    event.preventDefault();
});

window.addEventListener('error', event => {
    console.error('Unhandled error:', event.error);
    if (event.error.name === 'TypeError' && event.error.message.includes('API')) {
        showError('API configuration error. Please check your API keys.');
    }
});

// ----- Debug Functions (for testing) -----
function debugAPI() {
    console.log('🔧 API Configuration:');
    console.log('YouTube API Key:', CONFIG.YOUTUBE_API_KEY ? 'Set ✓' : 'Missing ❌');
    console.log('Gemini API Key:', CONFIG.GEMINI_API_KEY ? 'Set ✓' : 'Missing ❌');
    console.log('Current video:', AppState.currentVideo ? 'Loaded ✓' : 'None ❌');
    console.log('Chat mode:', AppState.chatMode);
    console.log('Chat history length:', AppState.chatHistory.length);
}

function testGeminiAPI() {
    if (!CONFIG.GEMINI_API_KEY || CONFIG.GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
        console.error('❌ Gemini API key not configured');
        return;
    }
    
    console.log('🧪 Testing Gemini API...');
    callGeminiAPI('Hello! Please respond with "Gemini API is working correctly!"')
        .then(response => {
            console.log('✅ Gemini API Response:', response);
        })
        .catch(error => {
            console.error('❌ Gemini API Error:', error.message);
        });
}

function testYouTubeAPI() {
    if (!CONFIG.YOUTUBE_API_KEY || CONFIG.YOUTUBE_API_KEY === 'YOUR_YOUTUBE_API_KEY_HERE') {
        console.error('❌ YouTube API key not configured');
        return;
    }
    
    console.log('🧪 Testing YouTube API...');
    // Test with a popular video ID
    getVideoDetails('dQw4w9WgXcQ') // Rick Roll video ID
        .then(data => {
            console.log('✅ YouTube API Response:', data.video.snippet.title);
        })
        .catch(error => {
            console.error('❌ YouTube API Error:', error.message);
        });
}

// Make debug functions available globally for console testing
window.debugAPI = debugAPI;
window.testGeminiAPI = testGeminiAPI;
window.testYouTubeAPI = testYouTubeAPI;

// ----- Initialization -----
document.addEventListener('DOMContentLoaded', function() {
    try {
        initializeNavigation();
        initializeVideoAnalysis();
        initializeChatEventListeners();
        initializeParallaxEffect();
        initializeChatButton();
        initializeKeyboardShortcuts();
        
        eventListenersInitialized = true;
        
        console.log('🚀 YouTube Video Analyzer with AI Chat initialized successfully');
        console.log('💡 Debug commands available: debugAPI(), testGeminiAPI(), testYouTubeAPI()');
        console.log('⚠️  Remember to replace API keys in CONFIG before using!');
        
        // Initial setup
        setChatMode('hidden');
        
        // Check API configuration
        if (CONFIG.YOUTUBE_API_KEY === 'YOUR_YOUTUBE_API_KEY_HERE') {
            showError('Please configure your YouTube API key in the CONFIG section');
        }
        
        if (CONFIG.GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
            showError('Please configure your Gemini API key in the CONFIG section');
        }
        
    } catch (error) {
        console.error('Initialization error:', error);
        showError('Failed to initialize application');
    }
});

// ----- Service Worker Registration (Optional) -----
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Uncomment if you add a service worker later
        // navigator.serviceWorker.register('/sw.js')
        //     .then(registration => console.log('SW registered'))
        //     .catch(error => console.log('SW registration failed'));
    });
}

// ----- Enhanced CSS Styles (Previous Implementation) -----
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


async function generateAISummaryAsync(videoData) {
    try {
        const { video } = videoData;
        const snippet = video.snippet;

        const description = `Title: ${snippet.title}
Channel: ${snippet.channelTitle}
Description: ${snippet.description ? snippet.description.substring(0, 500) : 'No description available'}
Duration: ${formatDuration(video.contentDetails?.duration)}`;

        const response = await fetch('/api/ai', {   // correct for serverless
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                description: description,
                analysisType: 'summary',      // REQUIRED
                title: snippet.title,         // REQUIRED
                videoId: video.id             // RECOMMENDED
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `AI API error: ${response.status}`);
        }

        const data = await response.json();
        return data.summary || "No AI summary available.";
    } catch (error) {
        console.error("Error generating AI summary:", error);
        return "Failed to generate AI summary.";
    }
}



