const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configuration
const CONFIG = {
    YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    YOUTUBE_API_BASE: 'https://www.googleapis.com/youtube/v3',
    GEMINI_API_BASE: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
};

// ===== API ROUTES =====

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok',
        youtube_api: !!CONFIG.YOUTUBE_API_KEY,
        gemini_api: !!CONFIG.GEMINI_API_KEY
    });
});

// Get video details
app.get('/api/video/:videoId', async (req, res) => {
    try {
        const { videoId } = req.params;
        
        if (!CONFIG.YOUTUBE_API_KEY) {
            return res.status(500).json({ error: 'YouTube API key not configured' });
        }

        // Fetch video data
        const videoUrl = `${CONFIG.YOUTUBE_API_BASE}/videos`;
        const videoResponse = await axios.get(videoUrl, {
            params: {
                part: 'snippet,statistics,contentDetails',
                id: videoId,
                key: CONFIG.YOUTUBE_API_KEY
            }
        });

        if (!videoResponse.data.items || videoResponse.data.items.length === 0) {
            return res.status(404).json({ error: 'Video not found or is private/unavailable' });
        }

        const video = videoResponse.data.items[0];
        const channelId = video.snippet.channelId;

        // Fetch channel data
        let channelData = null;
        if (channelId) {
            try {
                const channelUrl = `${CONFIG.YOUTUBE_API_BASE}/channels`;
                const channelResponse = await axios.get(channelUrl, {
                    params: {
                        part: 'statistics,snippet',
                        id: channelId,
                        key: CONFIG.YOUTUBE_API_KEY
                    }
                });

                if (channelResponse.data.items && channelResponse.data.items.length > 0) {
                    channelData = channelResponse.data.items[0];
                }
            } catch (err) {
                console.warn('Channel data fetch failed:', err.message);
            }
        }

        res.json({ video, channel: channelData });

    } catch (error) {
        console.error('Video fetch error:', error);
        
        if (error.response) {
            const status = error.response.status;
            if (status === 404) return res.status(404).json({ error: 'Video not found' });
            if (status === 403) return res.status(403).json({ error: 'API quota exceeded or invalid key' });
        }

        res.status(500).json({ error: error.message || 'Failed to fetch video data' });
    }
});

// Get video transcript (mock)
app.get('/api/transcript/:videoId', async (req, res) => {
    try {
        const { videoId } = req.params;
        const mockTranscript = `Mock transcript for video ${videoId}. This would contain actual captions in production.`;
        res.json({ transcript: mockTranscript });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch transcript' });
    }
});

// Generate AI summary
app.post('/api/ai/summary', async (req, res) => {
    try {
        const { video, transcript } = req.body;
        
        if (!CONFIG.GEMINI_API_KEY) {
            return res.status(500).json({ error: 'Gemini API key not configured' });
        }

        const snippet = video.snippet;
        const prompt = `Provide a comprehensive summary of this YouTube video:

Title: ${snippet.title}
Channel: ${snippet.channelTitle}
Description: ${snippet.description?.substring(0, 500) || 'No description'}
${transcript ? `\nTranscript: ${transcript.substring(0, 1000)}` : ''}

Provide:
1. Brief overview (2-3 sentences)
2. Main topics (bullet points)
3. Key takeaways (3-5 points)
4. Target audience`;

        const geminiUrl = `${CONFIG.GEMINI_API_BASE}?key=${CONFIG.GEMINI_API_KEY}`;
        
        const response = await axios.post(geminiUrl, {
            contents: [{ parts: [{ text: prompt }] }]
        });

        if (response.data.candidates?.[0]) {
            const summary = response.data.candidates[0].content.parts[0].text;
            res.json({ summary });
        } else {
            throw new Error('No valid response from AI');
        }

    } catch (error) {
        console.error('AI Summary error:', error);
        res.status(500).json({ 
            error: error.response?.data?.error?.message || 'Failed to generate AI summary' 
        });
    }
});

// Chat with AI
app.post('/api/ai/chat', async (req, res) => {
    try {
        const { message, context } = req.body;
        
        if (!CONFIG.GEMINI_API_KEY) {
            return res.status(500).json({ error: 'Gemini API key not configured' });
        }

        let prompt = message;

        if (context?.video) {
            const snippet = context.video.snippet;
            prompt = `Context: You are helping understand this YouTube video:
Title: "${snippet.title}"
Channel: ${snippet.channelTitle}
Description: ${snippet.description?.substring(0, 300) || 'No description'}
${context.transcript ? `\nTranscript: ${context.transcript.substring(0, 500)}` : ''}

User question: ${message}

Provide a helpful, accurate response based on the video context.`;
        }

        const geminiUrl = `${CONFIG.GEMINI_API_BASE}?key=${CONFIG.GEMINI_API_KEY}`;
        
        const response = await axios.post(geminiUrl, {
            contents: [{ parts: [{ text: prompt }] }]
        });

        if (response.data.candidates?.[0]) {
            const aiResponse = response.data.candidates[0].content.parts[0].text;
            res.json({ response: aiResponse });
        } else {
            throw new Error('No valid response from AI');
        }

    } catch (error) {
        console.error('AI Chat error:', error);
        res.status(500).json({ 
            error: error.response?.data?.error?.message || 'Failed to get AI response' 
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
// Local development only (works when running: node server.js)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Local server running on http://localhost:${PORT}`);
    });
}

// Export for Vercel serverless function
module.exports = app;
