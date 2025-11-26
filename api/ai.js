// api/ai.js - Enhanced serverless function for AI-powered video analysis

const rateLimitStore = new Map();


const CONFIG = {
    MAX_DESCRIPTION_LENGTH: 10000, // characters
    RATE_LIMIT_REQUESTS: 10, // requests per window
    RATE_LIMIT_WINDOW: 60 * 1000, // 1 minute in milliseconds
    GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    REQUEST_TIMEOUT: 30000, // 30 seconds
};

function generatePrompt(requestType, data) {
    if (requestType === 'summary') {
        return `Please provide a clear, concise summary of the following video description. Focus on the key points and main content. Keep the summary under 200 words:\n\n${data.description}`;
    } else if (requestType === 'chat') {
        if (data.customPrompt) {
            return `You are an AI assistant helping analyze a YouTube video. Here's the context:\n\nTitle: ${data.title}\n\nUser question: ${data.customPrompt}\n\nPlease provide a helpful response about this video.`;
        } else {
            return `Please provide a comprehensive analysis of this YouTube video:\n\n${data.description}\n\nProvide detailed insights, main topics, and key takeaways.`;
        }
    }
    return data.description;
} 
// Rate limiting function
function checkRateLimit(clientId) {
    const now = Date.now();
    const windowStart = now - CONFIG.RATE_LIMIT_WINDOW;
    
    // Clean old entries
    for (const [key, timestamps] of rateLimitStore.entries()) {
        const validTimestamps = timestamps.filter(t => t > windowStart);
        if (validTimestamps.length === 0) {
            rateLimitStore.delete(key);
        } else {
            rateLimitStore.set(key, validTimestamps);
        }
    }
    
    // Check current client
    const clientRequests = rateLimitStore.get(clientId) || [];
    const recentRequests = clientRequests.filter(t => t > windowStart);
    
    if (recentRequests.length >= CONFIG.RATE_LIMIT_REQUESTS) {
        return false;
    }
    
    // Add current request
    recentRequests.push(now);
    rateLimitStore.set(clientId, recentRequests);
    return true;
}

// Get client identifier for rate limiting
function getClientId(req) {
    return req.headers['x-forwarded-for']?.split(',')[0] || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress || 
           'unknown';
}


function validateInput(description) {
    if (!description) {
        return { isValid: false, error: 'Description is required' };
    }
    
    if (typeof description !== 'string') {
        return { isValid: false, error: 'Description must be a string' };
    }
    
    if (description.trim().length === 0) {
        return { isValid: false, error: 'Description cannot be empty' };
    }
    
    if (description.length > CONFIG.MAX_DESCRIPTION_LENGTH) {
        return { 
            isValid: false, 
            error: `Description too long. Maximum ${CONFIG.MAX_DESCRIPTION_LENGTH} characters allowed` 
        };
    }
    
    return { isValid: true, sanitized: description.trim() };
}


function logError(context, error, additionalInfo = {}) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        context,
        error: error.message || error,
        stack: error.stack,
        ...additionalInfo
    };
    console.error('API Error:', JSON.stringify(logEntry, null, 2));
}


function setCORSHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
}

export default async function handler(req, res) {
    // Set CORS headers for all responses
    setCORSHeaders(res);
    
    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Only allow POST method
    if (req.method !== 'POST') {
        return res.status(405).json({ 
            error: 'Method not allowed',
            message: 'This endpoint only accepts POST requests'
        });
    }

    const clientId = getClientId(req);
    
    try {
        // Check rate limit
        if (!checkRateLimit(clientId)) {
            return res.status(429).json({ 
                error: 'Rate limit exceeded',
                message: `Maximum ${CONFIG.RATE_LIMIT_REQUESTS} requests per minute allowed`,
                retryAfter: 60
            });
        }

        if (!process.env.GEMINI_API_KEY) {
            logError('Configuration', new Error('Missing GEMINI_API_KEY'), { clientId });
            return res.status(500).json({ 
                error: 'Server configuration error',
                message: 'AI service is not properly configured'
            });
        }

        // Parse and validate request body
        let body;
        try {
            body = req.body;
        } catch (parseError) {
            return res.status(400).json({ 
                error: 'Invalid JSON',
                message: 'Request body must be valid JSON'
            });
        }

        // Detect request type and extract data
const { description, title, videoId, analysisType, customPrompt } = body;

let requestType, validatedData;

if (description && !title && !analysisType) {
    // Simple summary request from generateAISummaryAsync
    requestType = 'summary';
    const validation = validateInput(description);
    if (!validation.isValid) {
        return res.status(400).json({ 
            error: 'Validation failed',
            message: validation.error
        });
    }
    validatedData = { description: validation.sanitized };
} else if (title || analysisType || customPrompt) {
    // Complex request from callGeminiAPI
    requestType = 'chat';
    const fullDescription = customPrompt || `Title: ${title}\nDescription: ${description}\nVideoId: ${videoId}`;
    const validation = validateInput(fullDescription);
    if (!validation.isValid) {
        return res.status(400).json({ 
            error: 'Validation failed',
            message: validation.error
        });
    }
    validatedData = { 
        description: validation.sanitized, 
        analysisType, 
        title, 
        videoId,
        customPrompt 
    };
} else {
    return res.status(400).json({ 
        error: 'Invalid request format',
        message: 'Must provide either description (for summary) or title/analysisType (for chat)'
    });
}
     
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);

        const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/${CONFIG.GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'User-Agent': 'Video-Analysis-API/1.0'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: generatePrompt(requestType, validatedData)
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 300,
                    }
                }),
                signal: controller.signal
            }
        );

        clearTimeout(timeoutId);

        const data = await geminiResponse.json();

        if (!geminiResponse.ok) {
            const errorDetails = {
                status: geminiResponse.status,
                statusText: geminiResponse.statusText,
                response: data,
                clientId
            };
            
            logError('Gemini API Error', new Error('API request failed'), errorDetails);
            
            // Provide more specific error messages based on status
            let errorMessage = 'AI service temporarily unavailable';
            if (geminiResponse.status === 400) {
                errorMessage = 'Invalid request to AI service';
            } else if (geminiResponse.status === 401) {
                errorMessage = 'AI service authentication failed';
            } else if (geminiResponse.status === 403) {
                errorMessage = 'AI service access denied';
            } else if (geminiResponse.status === 429) {
                errorMessage = 'AI service rate limit exceeded';
            }
            
            return res.status(500).json({ 
                error: 'AI service error',
                message: errorMessage
            });
        }

        const summary = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!summary || typeof summary !== 'string' || summary.trim().length === 0) {
            logError('Response Parsing', new Error('Invalid AI response structure'), { 
                response: data,
                clientId 
            });
            return res.status(500).json({ 
                error: 'AI response error',
                message: 'Unable to generate summary from AI service'
            });
        }

        // Successful response
        // Successful response based on request type
if (requestType === 'summary') {
    res.status(200).json({ 
        summary: summary.trim(),
        metadata: {
            model: CONFIG.GEMINI_MODEL,
            timestamp: new Date().toISOString(),
            inputLength: validatedData.description.length,
            outputLength: summary.trim().length
        }
    });
} else {
    res.status(200).json({ 
        analysis: summary.trim(),
        metadata: {
            model: CONFIG.GEMINI_MODEL,
            timestamp: new Date().toISOString(),
            requestType: requestType,
            analysisType: validatedData.analysisType,
            inputLength: validatedData.description.length,
            outputLength: summary.trim().length
        }
    });
}

    } catch (error) {
        // Handle different types of errors
        let errorResponse = { 
            error: 'Internal server error',
            message: 'An unexpected error occurred'
        };
        
        if (error.name === 'AbortError') {
            errorResponse = {
                error: 'Request timeout',
                message: 'AI service request timed out'
            };
        } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            errorResponse = {
                error: 'Service unavailable',
                message: 'Unable to connect to AI service'
            };
        }
        
        logError('Server Error', error, { clientId, url: req.url });
        res.status(500).json(errorResponse);
    }

}

