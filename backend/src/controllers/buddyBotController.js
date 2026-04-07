const BuddyBotConversation = require('../models/BuddyBotConversation');
const axios = require('axios');
const Destination = require('../models/Destination');
const Budget = require('../models/Budget');

const MOOD_PROMPTS = {
  excited: 'Respond with energetic and uplifting tone, short actionable suggestions, and motivational language.',
  relaxed: 'Respond with calm and reassuring tone, avoid urgency, and keep suggestions gentle and simple.',
  stressed: 'Respond with empathetic, low-pressure tone, break plans into small easy steps, and reduce decision overload.',
  adventurous: 'Respond with bold, exploration-focused tone and include thrilling activity ideas with basic safety notes.',
  romantic: 'Respond with warm, thoughtful tone and suggest cozy, couple-friendly travel experiences.',
  family: 'Respond with practical, family-safe tone and include kid-friendly and elder-friendly recommendations.'
};

const LANGUAGE_PROMPTS = {
  easy_english: 'Respond in very easy, simple English. Use short sentences and basic vocabulary.',
  roman_english: 'Respond in Roman Urdu (Urdu written in English letters), simple and natural for Pakistani users.',
  urdu: 'Respond in clear, simple Urdu script.'
};

const getLanguageInstruction = (language) => {
  const normalizedLanguage = (language || '').toLowerCase().trim();
  return LANGUAGE_PROMPTS[normalizedLanguage] || LANGUAGE_PROMPTS.easy_english;
};

const detectMoodFromText = (text = '') => {
  const msg = text.toLowerCase();
  if (/(stressed|stress|anxious|tired|overwhelmed)/.test(msg)) return 'stressed';
  if (/(relaxed|calm|peaceful|chill)/.test(msg)) return 'relaxed';
  if (/(excited|happy|hyped|thrilled)/.test(msg)) return 'excited';
  if (/(adventure|adventurous|thrill|extreme)/.test(msg)) return 'adventurous';
  if (/(romantic|honeymoon|couple)/.test(msg)) return 'romantic';
  if (/(family|kids|children)/.test(msg)) return 'family';
  return null;
};

const getMoodInstruction = (mood) => {
  const normalizedMood = (mood || '').toLowerCase().trim();
  return MOOD_PROMPTS[normalizedMood] || null;
};

// Helper function to clean markdown formatting from AI response
const cleanResponse = (text) => {
  if (!text) return text;
  
  // Remove markdown bold (**text** or __text__)
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');
  
  // Remove markdown italic (*text* or _text_)
  text = text.replace(/\*([^*]+)\*/g, '$1');
  text = text.replace(/_([^_]+)_/g, '$1');
  
  // Remove markdown headers (# ## ###)
  text = text.replace(/^#{1,6}\s+/gm, '');
  
  // Remove markdown code blocks (```code```)
  text = text.replace(/```[\s\S]*?```/g, '');
  
  // Remove markdown inline code (`code`)
  text = text.replace(/`([^`]+)`/g, '$1');
  
  // Remove markdown links [text](url) -> text
  text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
  
  // Remove markdown lists (- * +)
  text = text.replace(/^[\s]*[-*+]\s+/gm, '• ');
  
  // Remove markdown numbered lists
  text = text.replace(/^\d+\.\s+/gm, '');
  
  // Clean up multiple spaces
  text = text.replace(/\s{2,}/g, ' ');
  
  // Clean up multiple newlines
  text = text.replace(/\n{3,}/g, '\n\n');
  
  return text.trim();
};

// Helper function to get available Gemini models
const getAvailableModels = async (apiKey) => {
  try {
    // Try v1beta first (more models available)
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const response = await axios.get(listUrl, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
    
    if (response.status === 200 && response.data && response.data.models) {
      // Filter models that support generateContent
      const availableModels = response.data.models
        .filter(model => 
          model.supportedGenerationMethods && 
          model.supportedGenerationMethods.includes('generateContent')
        )
        .map(model => ({
          name: model.name.replace('models/', ''),
          displayName: model.displayName
        }));
      
      console.log(`✅ Found ${availableModels.length} available Gemini models`);
      return availableModels;
    }
  } catch (error) {
    console.log(`⚠️ Could not fetch model list: ${error.message}`);
  }
  
  // Fallback to common model names
  return [
    { name: 'gemini-pro', displayName: 'Gemini Pro' },
    { name: 'gemini-1.5-pro', displayName: 'Gemini 1.5 Pro' },
    { name: 'gemini-1.5-flash', displayName: 'Gemini 1.5 Flash' }
  ];
};

const getAIResponse = async (userMessage, conversationHistory, userPreferences) => {
  const activeMood = userPreferences?.get ? userPreferences.get('mood') : null;
  const moodInstruction = getMoodInstruction(activeMood);
  const selectedLanguage = userPreferences?.get ? userPreferences.get('language') : 'easy_english';
  const languageInstruction = getLanguageInstruction(selectedLanguage);

  // Check if AI API key is set and valid
  if (process.env.AI_API_KEY && process.env.AI_API_KEY.trim() !== '' && process.env.AI_API_KEY !== 'your-ai-api-key-here') {
    const apiKey = process.env.AI_API_KEY.trim();
    
    // Build system prompt with travel context
    const systemPrompt = `You are TravelBuddy, an expert AI travel assistant specializing in Pakistan travel destinations and planning.

Your expertise includes:
- Destination recommendations (Hunza, Swat, Skardu, Fairy Meadows, etc.)
- Budget planning and cost estimation
- Weather information and travel tips
- Hotel and accommodation suggestions
- Travel requirements and documentation
- Local food recommendations
- Best time to visit different places
- Travel routes and transportation

Guidelines:
- Be friendly, helpful, and conversational
- Provide practical, actionable advice
- Use Pakistani Rupees (PKR) for budget discussions
- Mention specific destinations when relevant
- Keep responses concise but informative
- Always keep wording simple and easy to understand
- If asked about weather, suggest checking the Weather page
- If asked about hotels, suggest the Places to Stay section
- If asked about budget, suggest using the Budget Calculator

Always be enthusiastic about travel and help users plan amazing trips!`;

    const moodContext = moodInstruction
      ? `\n\nUser current mood: ${activeMood}\nTone adaptation instruction: ${moodInstruction}`
      : '';
    const languageContext = `\n\nUser preferred response language: ${selectedLanguage}\nLanguage instruction: ${languageInstruction}`;

    // Get user's past trips for context
    let pastTripsContext = '';
    if (userPreferences && userPreferences.get) {
      const pastTrips = await Budget.find({ userId: userPreferences.get('userId') }).limit(3);
      if (pastTrips.length > 0) {
        const destinations = pastTrips.map(t => t.destination).join(', ');
        pastTripsContext = `\n\nUser's past trip destinations: ${destinations}. Consider their travel preferences when making recommendations.`;
      }
    }

    // Build conversation context for Gemini
    let fullPrompt = systemPrompt + languageContext + moodContext + pastTripsContext + '\n\n';
    
    // Add conversation history
    conversationHistory.slice(-10).forEach(msg => {
      if (msg.role === 'user') {
        fullPrompt += `User: ${msg.content}\n\n`;
      } else if (msg.role === 'assistant') {
        fullPrompt += `Assistant: ${msg.content}\n\n`;
      }
    });
    
    // Add current user message
    fullPrompt += `User: ${userMessage}\n\nAssistant:`;

    // Get available models first
    console.log('🔍 Fetching available Gemini models...');
    const availableModels = await getAvailableModels(apiKey);
    
    // Try multiple API endpoints for each model
    const endpointsToTry = ['v1beta', 'v1'];
    
    for (const model of availableModels) {
      for (const endpoint of endpointsToTry) {
        const modelName = model.name;
        try {
          console.log(`🔄 Trying Gemini model: ${modelName} (${endpoint})`);
          console.log(`📝 API Key: ${apiKey ? 'Present (length: ' + apiKey.length + ')' : 'Missing'}`);
          
          // Try both v1 and v1beta endpoints
          const apiUrl = `https://generativelanguage.googleapis.com/${endpoint}/models/${modelName}:generateContent?key=${apiKey}`;
        
        const requestData = {
          contents: [{
            parts: [{
              text: fullPrompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1000,
            topP: 0.8,
            topK: 40
          }
        };
        
        const response = await axios.post(
          apiUrl,
          requestData,
          {
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 20000,
            validateStatus: function (status) {
              return status < 500; // Don't throw on 4xx errors
            }
          }
        );
        
        console.log(`📥 Response status: ${response.status}`);
        
        // Check for successful response
        if (response.status === 200 && response.data) {
          if (response.data.candidates && 
              response.data.candidates[0] && 
              response.data.candidates[0].content && 
              response.data.candidates[0].content.parts && 
              response.data.candidates[0].content.parts[0]) {
            let aiResponse = response.data.candidates[0].content.parts[0].text;
            // Clean markdown formatting from response
            aiResponse = cleanResponse(aiResponse);
            console.log(`✅ AI Response generated successfully using ${modelName} (${endpoint}) (${aiResponse.length} characters)`);
            return aiResponse;
          } else if (response.data.error) {
            console.error(`❌ API Error for ${modelName}:`, JSON.stringify(response.data.error, null, 2));
            // Try next model
            continue;
          } else {
            console.error(`❌ Unexpected response format for ${modelName}`);
            // Try next model
            continue;
          }
        } else if (response.status === 404) {
          console.log(`⚠️ Model ${modelName} (${endpoint}) not found, trying next...`);
          // Try next endpoint or model
          continue;
        } else if (response.status === 401 || response.status === 403) {
          console.error(`❌ API Key authentication failed for ${modelName} (${endpoint})`);
          console.error(`   Error details:`, response.data?.error || response.data);
          console.error('💡 Please verify your AI_API_KEY in backend/.env is a valid Gemini API key');
          console.error('💡 Get a free Gemini API key from: https://makersuite.google.com/app/apikey');
          console.error('💡 Make sure the API key is for Gemini API, NOT Google Maps API');
          // Don't try other models if auth fails
          return null; // Exit function
        } else if (response.status === 400) {
          console.error(`❌ Bad Request for ${modelName} (${endpoint}):`, response.data?.error?.message || 'Invalid request');
          console.error(`   Full error:`, JSON.stringify(response.data?.error || response.data, null, 2));
          // Try next model
          continue;
        } else {
          console.error(`❌ Unexpected status ${response.status} for ${modelName} (${endpoint})`);
          console.error(`   Response:`, JSON.stringify(response.data, null, 2).substring(0, 500));
          // Try next model
          continue;
        }
        } catch (error) {
          console.error(`❌ Error with model ${modelName} (${endpoint}):`, {
            message: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            error: error.response?.data?.error || error.response?.data,
            code: error.code
          });
          
          if (error.response?.status === 401 || error.response?.status === 403) {
            console.error('❌ API Key Error: Please verify your Gemini API key is correct and enabled.');
            console.error('💡 Get a free Gemini API key from: https://makersuite.google.com/app/apikey');
            console.error('💡 Make sure the API key is for Gemini API, not Google Maps API');
            return null; // Exit function
          } else if (error.response?.status === 404) {
            console.log(`⚠️ Model ${modelName} (${endpoint}) not found, trying next...`);
            // Try next endpoint or model
            continue;
          } else if (!error.response) {
            console.error(`❌ Network error: ${error.message}`);
            // Try next endpoint or model
            continue;
          } else {
            // Try next endpoint or model
            continue;
          }
        }
      }
    }
    
    // If all models failed, log and fall through to fallback
    console.log('⚠️ All Gemini models failed, using fallback responses');
    console.log('💡 The API key might be incorrect or not enabled for Gemini API');
    console.log('💡 Please verify: https://makersuite.google.com/app/apikey');
    
    // If all attempts failed, use fallback
    console.log('⚠️ Using fallback responses (AI API not available)');
  }

  const lowerMessage = userMessage.toLowerCase();
  const fallbackMoodPrefix = moodInstruction ? `I understand you're feeling ${activeMood}. ` : '';
  const fallbackLanguage = (selectedLanguage || 'easy_english').toLowerCase();
  const buildFallback = (easyEnglish, romanEnglish, urdu) => {
    if (fallbackLanguage === 'roman_english') return romanEnglish;
    if (fallbackLanguage === 'urdu') return urdu;
    return easyEnglish;
  };
  
  if (lowerMessage.includes('budget') || lowerMessage.includes('cost')) {
    return buildFallback(
      `${fallbackMoodPrefix}I can help you calculate your travel budget! Please provide: destination, number of members, days, and season. I will give you a clear cost breakdown.`,
      `Main aap ka travel budget calculate kar sakta hoon. Destination, members, days aur season bata dein. Main simple breakdown de dunga.`,
      `میں آپ کا ٹریول بجٹ کیلکولیٹ کر سکتا ہوں۔ منزل، افراد کی تعداد، دن اور سیزن بتائیں۔ میں آسان بریک ڈاؤن دے دوں گا۔`
    );
  }
  
  if (lowerMessage.includes('destination') || lowerMessage.includes('place')) {
    const destinations = await Destination.find({ isPopular: true }).limit(3);
    const names = destinations.map(d => d.name).join(', ');
    return buildFallback(
      `${fallbackMoodPrefix}Here are some popular destinations: ${names}. Do you want details for any one?`,
      `Yeh popular destinations hain: ${names}. Kya aap kisi ek ki detail chahte hain?`,
      `یہ مشہور مقامات ہیں: ${names}۔ کیا آپ کسی ایک کی تفصیل چاہتے ہیں؟`
    );
  }
  
  if (lowerMessage.includes('weather')) {
    return buildFallback(
      `${fallbackMoodPrefix}I can help with weather. Tell me your destination and I will share current weather and forecast.`,
      `Main weather mein help kar sakta hoon. Destination batain, main current weather aur forecast bata dunga.`,
      `میں موسم کے بارے میں مدد کر سکتا ہوں۔ اپنی منزل بتائیں، میں موجودہ موسم اور پیش گوئی بتا دوں گا۔`
    );
  }
  
  if (lowerMessage.includes('hotel') || lowerMessage.includes('accommodation')) {
    return buildFallback(
      `${fallbackMoodPrefix}I can help you find good hotels. Check 'Places to Stay'. I can also suggest options by your budget.`,
      `Main achay hotels dhoondhne mein help kar sakta hoon. 'Places to Stay' check karein. Budget ke mutabiq options bhi de sakta hoon.`,
      `میں اچھے ہوٹل ڈھونڈنے میں مدد کر سکتا ہوں۔ 'Places to Stay' دیکھیں۔ میں بجٹ کے مطابق آپشنز بھی دے سکتا ہوں۔`
    );
  }
  
  return buildFallback(
    `${fallbackMoodPrefix}I am here to help with your trip plan. Ask me about destinations, budget, weather, or hotels.`,
    `Main aap ki trip planning mein help ke liye yahan hoon. Destinations, budget, weather ya hotels ke bare mein pooch sakte hain.`,
    `میں آپ کی ٹرپ پلاننگ میں مدد کے لیے موجود ہوں۔ آپ منزل، بجٹ، موسم یا ہوٹل کے بارے میں پوچھ سکتے ہیں۔`
  );
};

exports.sendMessage = async (req, res) => {
  try {
    const { message, mood, language } = req.body;
    const userId = req.user._id;

    if (!message) {
      return res.status(400).json({ message: 'Message is required' });
    }

    let conversation = await BuddyBotConversation.findOne({ userId });
    
    if (!conversation) {
      conversation = new BuddyBotConversation({
        userId,
        messages: []
      });
    }

    conversation.messages.push({
      role: 'user',
      content: message
    });

    // Extract preferences from message
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('budget') || lowerMessage.includes('cheap') || lowerMessage.includes('expensive')) {
      if (lowerMessage.includes('cheap') || lowerMessage.includes('low')) {
        conversation.preferences.set('budget', 'low');
      } else if (lowerMessage.includes('expensive') || lowerMessage.includes('luxury') || lowerMessage.includes('high')) {
        conversation.preferences.set('budget', 'high');
      }
    }
    if (lowerMessage.includes('family')) {
      conversation.preferences.set('travelType', 'family');
    } else if (lowerMessage.includes('solo')) {
      conversation.preferences.set('travelType', 'solo');
    } else if (lowerMessage.includes('couple')) {
      conversation.preferences.set('travelType', 'couple');
    }

    const detectedMood = detectMoodFromText(message);
    const explicitMood = typeof mood === 'string' ? mood.toLowerCase().trim() : '';
    if (getMoodInstruction(explicitMood)) {
      conversation.preferences.set('mood', explicitMood);
    } else if (detectedMood) {
      conversation.preferences.set('mood', detectedMood);
    }
    if (typeof language === 'string' && getLanguageInstruction(language)) {
      conversation.preferences.set('language', language.toLowerCase().trim());
    }

    // Add userId to preferences for context
    conversation.preferences.set('userId', userId.toString());

    const aiResponse = await getAIResponse(
      message,
      conversation.messages.slice(0, -1),
      conversation.preferences
    );

    conversation.messages.push({
      role: 'assistant',
      content: aiResponse
    });

    await conversation.save();

    res.json({
      response: aiResponse,
      conversationId: conversation._id
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getConversation = async (req, res) => {
  try {
    const conversation = await BuddyBotConversation.findOne({ userId: req.user._id });
    
    if (!conversation) {
      return res.json({ messages: [] });
    }

    res.json({
      messages: conversation.messages,
      preferences: conversation.preferences
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.clearConversation = async (req, res) => {
  try {
    await BuddyBotConversation.findOneAndDelete({ userId: req.user._id });
    res.json({ message: 'Conversation cleared' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
