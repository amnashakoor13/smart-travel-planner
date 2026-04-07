const Budget = require('../models/Budget');
const BudgetRule = require('../models/BudgetRule');
const Destination = require('../models/Destination');
const Hotel = require('../models/Hotel');
const Restaurant = require('../models/Restaurant');
const ApiKey = require('../models/ApiKey');
const axios = require('axios');

const normalizeSeason = (season) => {
  const s = String(season || '').toLowerCase().trim();
  if (['spring', 'summer', 'autumn', 'winter'].includes(s)) return s;
  if (s === 'peak') return 'summer';
  if (s === 'off-peak') return 'winter';
  if (s === 'shoulder') return 'spring';
  return 'summer';
};

const normalizeStatus = (status) => {
  const s = String(status || '').toLowerCase().trim();
  if (['pending', 'planned', 'confirmed', 'completed', 'cancelled'].includes(s)) return s;
  return 'pending';
};

// Resolve Gemini API key: env first, then .env file, then database (Admin Panel)
const resolveGeminiApiKey = async () => {
  let apiKey = process.env.AI_API_KEY?.trim();
  if (apiKey && apiKey !== 'your_ai_api_key_here' && apiKey !== '') return apiKey;

  try {
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(__dirname, '../../.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      for (const line of envContent.split('\n')) {
        if (line.startsWith('AI_API_KEY=')) {
          apiKey = line.split('=')[1]?.trim();
          if (apiKey && apiKey !== 'your_ai_api_key_here') {
            process.env.AI_API_KEY = apiKey;
            return apiKey;
          }
          break;
        }
      }
    }
  } catch (_) {}

  try {
    const doc = await ApiKey.findOne({ service: 'Gemini AI', isActive: true }).select('apiKey').lean();
    if (doc?.apiKey?.trim()) {
      apiKey = doc.apiKey.trim();
      process.env.AI_API_KEY = apiKey;
      return apiKey;
    }
  } catch (_) {}

  return null;
};

/** Models that support generateContent — Google serves them on v1beta (v1 often 404s for same names). */
const fetchGeminiGenerateModelNames = async (apiKey) => {
  try {
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const response = await axios.get(listUrl, {
      timeout: 12000,
      validateStatus: (s) => s < 500
    });
    if (response.status !== 200 || !response.data?.models) return [];
    const names = response.data.models
      .filter(
        (m) =>
          m.supportedGenerationMethods &&
          m.supportedGenerationMethods.includes('generateContent')
      )
      .map((m) => m.name.replace(/^models\//, ''))
      .filter(
        (n) =>
          !/embedding|gemma|text-bison|chat-bison|imagen|aqa/i.test(n)
      );
    const score = (n) => {
      let s = 0;
      if (/gemini-2\./i.test(n)) s += 20;
      if (/flash/i.test(n)) s += 8;
      if (/1\.5.*flash/i.test(n)) s += 6;
      if (/1\.5.*pro/i.test(n)) s += 4;
      if (/pro/i.test(n)) s += 2;
      return s;
    };
    return [...names].sort((a, b) => score(b) - score(a)).slice(0, 20);
  } catch (_) {
    return [];
  }
};

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Pull destination, admin rules, and hotel price hints so Gemini grounds answers in your data */
const getBudgetGroundingContext = async (destinationQuery, numberOfMembers, days, season) => {
  const blocks = [];
  let dest = null;
  try {
    dest = await Destination.findOne({
      $or: [
        { name: { $regex: escapeRegex(destinationQuery), $options: 'i' } },
        { city: { $regex: escapeRegex(destinationQuery), $options: 'i' } }
      ]
    }).lean();
  } catch (_) {
    dest = null;
  }

  if (dest) {
    const desc = (dest.description || '').slice(0, 550);
    blocks.push(
      `DATABASE DESTINATION (prioritize these facts; trip is domestic Pakistan unless country is clearly not Pakistan):\n` +
        `- Name: ${dest.name}\n` +
        `- Location: ${dest.city}, ${dest.country}\n` +
        `- Category: ${dest.category || 'N/A'} | Region: ${dest.region || 'N/A'}\n` +
        `- Typical season: ${dest.bestSeason || 'N/A'}\n` +
        `- About: ${desc || 'N/A'}`
    );

    try {
      const rule = await BudgetRule.findOne({
        destination: { $regex: escapeRegex(dest.name), $options: 'i' },
        isActive: { $ne: false }
      }).lean();
      if (rule?.baseCosts) {
        const mult = rule.seasonalMultipliers?.[season] ?? 1;
        blocks.push(
          `ADMIN BUDGET RULES for this area (use as primary anchor; scale for ${numberOfMembers} people, ${days} days; season multiplier ~${mult}x):\n` +
            JSON.stringify(rule.baseCosts, null, 2) +
            `\nIf rules look in USD, convert mentally to PKR (use ~285 PKR per USD for hotel-scale amounts only when obviously USD).`
        );
      }
    } catch (_) {}

    try {
      const hotels = await Hotel.find({ destination: dest._id })
        .limit(20)
        .select('priceRange name')
        .lean();
      const nights = Math.max(1, Number(days) || 1);
      const rooms = Math.max(1, Math.ceil((Number(numberOfMembers) || 1) / 2));
      if (hotels.length) {
        const nightEstimates = [];
        for (const h of hotels) {
          const pr = h.priceRange;
          if (!pr || (pr.min == null && pr.max == null)) continue;
          const cur = String(pr.currency || 'USD').toUpperCase();
          const usdToPkr = 285;
          const toPkr = (n) => (cur === 'PKR' ? n : n * usdToPkr);
          const lo = pr.min != null ? toPkr(pr.min) : null;
          const hi = pr.max != null ? toPkr(pr.max) : lo;
          const mid = lo != null && hi != null ? (lo + hi) / 2 : lo ?? hi;
          if (mid != null) nightEstimates.push(mid);
        }
        if (nightEstimates.length) {
          const avgNight = Math.round(
            nightEstimates.reduce((a, b) => a + b, 0) / nightEstimates.length
          );
          const accHint = Math.round(avgNight * nights * rooms);
          blocks.push(
            `LOCAL HOTEL DATA (${hotels.length} listings): ~${avgNight} PKR/night/room (converted if stored as USD).\n` +
              `Rough accommodation floor from data: ~${accHint} PKR total for ${rooms} room(s) × ${nights} night(s) — stay within ±25% unless you justify in insights.`
          );
        }
      }
    } catch (_) {}
  } else {
    blocks.push(
      `No matching destination document for "${destinationQuery}". Assume a realistic Pakistan domestic trip with moderate PKR costs; northern/hilly areas: higher transport and lodging.`
    );
  }

  blocks.push(
    `RUBRIC (PKR only; whole trip for ${numberOfMembers} traveler(s), ${days} day(s)):\n` +
      `- Transportation: domestic (bus, shared van, fuel for car, train). Avoid quoting international flights unless the place is clearly abroad.\n` +
      `- Accommodation: nights × rooms (rooms ≈ ceil(${numberOfMembers}/2) for pairs).\n` +
      `- Food: ~3 meals/day/person, local mid-range unless destination is premium resort.\n` +
      `- Activities: entries, local guide, jeep/cable — match destination type.\n` +
      `- Miscellaneous: ~10–12% of (transportation+accommodation+food+activities) unless much lower is justified.\n` +
      `- Apply ${season} season logic to totals (peak/warmer tourist windows cost more).`
  );

  return blocks.join('\n\n---\n\n');
};

// AI Helper function to get budget estimate from Gemini
const getAIBudgetEstimate = async (destination, numberOfMembers, days, season) => {
  try {
    const apiKey = await resolveGeminiApiKey();

    if (!apiKey) {
      console.log('\nℹ️ Gemini API key not set. Using default budget calculation.');
      console.log('   To enable AI estimates: Admin Panel → API Configuration → Gemini AI API Key.\n');
      return null;
    }
    
    console.log(`\n🔑 Using Gemini API key for budget estimate: ${destination}`);

    // Convert season to readable format
    const seasonMap = {
      'peak': 'peak season (high demand, higher prices)',
      'off-peak': 'off-peak season (low demand, lower prices)',
      'shoulder': 'shoulder season (moderate demand, moderate prices)',
      'spring': 'spring season',
      'summer': 'summer season',
      'autumn': 'autumn season',
      'winter': 'winter season'
    };
    const seasonText = seasonMap[season] || season;

    const grounding = await getBudgetGroundingContext(destination, numberOfMembers, days, season);

    const prompt = `You are a Pakistan domestic travel budget calculator. Output ONE JSON object only.

TRIP: "${destination}" | Travelers: ${numberOfMembers} | Days: ${days} | Season context: ${seasonText}

GROUNDING DATA (follow closely; do not invent luxury foreign-trip budgets):
${grounding}

RULES:
- All currency fields must be realistic integers in PKR for the FULL trip (not per day unless you sum to full trip — here everything is TOTAL for the whole trip).
- transportation + accommodation + food + activities + miscellaneous MUST equal "total" (within 500 PKR; if needed adjust "miscellaneous" last to match).
- Numbers must look like Pakistan market rates in 2024–2026 (not US dollars labeled as PKR).
- recommendations: one short paragraph, practical Urdu/English mix OK.
- insights: one short paragraph referencing season and group size.

JSON shape (no markdown, no code fences, no commentary):
{"transportation":0,"accommodation":0,"food":0,"activities":0,"miscellaneous":0,"total":0,"recommendations":"","insights":""}`;

    const fromApi = await fetchGeminiGenerateModelNames(apiKey);
    const fallback = [
      'gemini-2.0-flash',
      'gemini-2.0-flash-001',
      'gemini-1.5-flash',
      'gemini-1.5-flash-002',
      'gemini-1.5-flash-8b',
      'gemini-1.5-pro',
      'gemini-1.5-pro-002',
      'gemini-pro'
    ];
    const models = [...new Set([...fromApi, ...fallback])];
    const endpointsToTry = ['v1beta', 'v1'];

    for (const endpoint of endpointsToTry) {
      for (const model of models) {
      try {
        const apiUrl = `https://generativelanguage.googleapis.com/${endpoint}/models/${model}:generateContent?key=${apiKey}`;
        console.log(`\n🔄 Trying ${endpoint} / ${model}`);
        
        const response = await axios.post(
          apiUrl,
          {
            contents: [{
              parts: [{
                text: prompt
              }]
            }],
            generationConfig: {
              temperature: 0.35,
              topP: 0.9,
              topK: 40,
              maxOutputTokens: 1024
            }
          },
          {
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 30000,
            validateStatus: function (status) {
              return status < 500; // Don't throw on 4xx errors, we'll handle them
            }
          }
        );
        
        // Check for API errors in response
        if (response.status !== 200) {
          const errorData = response.data?.error || {};
          throw {
            response: {
              status: response.status,
              data: {
                error: errorData
              }
            },
            message: errorData.message || `HTTP ${response.status}`
          };
        }

        if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          const aiText = response.data.candidates[0].content.parts[0].text.trim();
          
          // Extract JSON from response (handle markdown code blocks)
          let jsonText = aiText;
          if (jsonText.includes('```json')) {
            jsonText = jsonText.split('```json')[1].split('```')[0].trim();
          } else if (jsonText.includes('```')) {
            jsonText = jsonText.split('```')[1].split('```')[0].trim();
          }
          
          // Remove any leading/trailing non-JSON text
          const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            jsonText = jsonMatch[0];
          }

          const aiBudget = JSON.parse(jsonText);

          const transportation = Math.round(aiBudget.transportation || 0);
          const accommodation = Math.round(aiBudget.accommodation || 0);
          const food = Math.round(aiBudget.food || 0);
          const activities = Math.round(aiBudget.activities || 0);
          let miscellaneous = Math.round(aiBudget.miscellaneous || 0);
          const sumFive = transportation + accommodation + food + activities + miscellaneous;
          let total = Math.round(aiBudget.total || 0);
          if (!total || Math.abs(total - sumFive) > Math.max(500, sumFive * 0.05)) {
            total = sumFive;
            miscellaneous = Math.max(0, total - transportation - accommodation - food - activities);
          }
          
          console.log(`✅ Successfully got AI budget estimate from ${endpoint} / ${model}`);
          console.log(`   Total: PKR ${total}\n`);
          
          return {
            transportation,
            accommodation,
            food,
            activities,
            miscellaneous,
            total,
            recommendations: aiBudget.recommendations || '',
            insights: aiBudget.insights || ''
          };
        } else {
          console.log(`   ⚠️ No content in response from ${model}`);
        }
      } catch (modelError) {
        const errorMsg = modelError.response?.data?.error?.message || modelError.message;
        const errorCode = modelError.response?.data?.error?.code || modelError.response?.status;
        const fullError = modelError.response?.data?.error || {};
        
        // Log detailed error for debugging
        console.log(`❌ ${endpoint} / ${model} failed:`);
        console.log(`   Status Code: ${errorCode || 'N/A'}`);
        console.log(`   Error Message: ${errorMsg || 'Unknown error'}`);
        if (fullError.status) {
          console.log(`   Error Status: ${fullError.status}`);
        }
        if (modelError.response?.data) {
          console.log(`   Full Error Data:`, JSON.stringify(modelError.response.data, null, 2));
        }
        
        if (errorCode === 400 || errorCode === 401 || errorCode === 403) {
          console.log(`\n💡 This might be an invalid API key.`);
          console.log(`   Please check Admin Panel → API Configuration.`);
          console.log(`   Current API Key: ${apiKey ? apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 4) : 'NOT SET'}\n`);
        } else {
          console.log('');
        }
        continue;
      }
      }
    }

    console.log('\nℹ️ Gemini unavailable. Using default budget calculation (rule-based).');
    return null;
  } catch (error) {
    console.log('\nℹ️ AI budget estimate skipped:', error.message);
    return null;
  }
};

// Fetch real-time pricing from Google Places API
const getRealTimePricing = async (destinationName, lat, lng, numberOfMembers, days) => {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey === 'your-google-maps-api-key-here') {
      console.log('⚠️ Google Maps API key not configured');
      return null;
    }

    let accommodationTotal = 0;
    let foodTotal = 0;
    let transportationTotal = 0;
    let hasValidData = false;

    // Fetch hotels for accommodation pricing
    try {
      const hotelsResponse = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', {
        params: {
          query: `hotels in ${destinationName}, Pakistan`,
          key: apiKey,
          type: 'lodging',
          location: `${lat},${lng}`,
          radius: 50000
        },
        timeout: 10000
      }).catch((error) => {
        // Handle network/DNS errors
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
          console.log(`⚠️ Network error fetching hotels: ${error.message}`);
          throw error;
        }
        throw error;
      });

      if (hotelsResponse.data.status === 'OK' && hotelsResponse.data.results) {
        const hotels = hotelsResponse.data.results.slice(0, 5);
        let totalPrice = 0;
        let count = 0;

        for (const hotel of hotels) {
          try {
            const detailsResponse = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
              params: {
                place_id: hotel.place_id,
                key: apiKey,
                fields: 'price_level,rating,reviews'
              },
              timeout: 8000
            });

            if (detailsResponse.data.status === 'OK' && detailsResponse.data.result) {
              const priceLevel = detailsResponse.data.result.price_level || 2; // Default to medium
              // Convert price_level (1-4) to PKR per night
              // 1 = $, 2 = $$, 3 = $$$, 4 = $$$$
              const pricePerNight = priceLevel === 1 ? 3000 : priceLevel === 2 ? 6000 : priceLevel === 3 ? 12000 : 20000;
              totalPrice += pricePerNight;
              count++;
            }
          } catch (err) {
            continue;
          }
        }

        if (count > 0) {
          const avgPricePerNight = totalPrice / count;
          accommodationTotal = Math.round(avgPricePerNight * numberOfMembers * days);
          hasValidData = true;
        }
      }
    } catch (error) {
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        console.log(`⚠️ Network error fetching hotel pricing: ${error.code} - ${error.message}`);
        console.log('💡 This might be a network connectivity issue. Check your internet connection.');
      } else {
        console.log('Error fetching hotel pricing:', error.message);
      }
    }

    // Fetch restaurants for food pricing
    try {
      const restaurantsResponse = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', {
        params: {
          query: `restaurants in ${destinationName}, Pakistan`,
          key: apiKey,
          type: 'restaurant',
          location: `${lat},${lng}`,
          radius: 50000
        },
        timeout: 10000
      }).catch((error) => {
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
          console.log(`⚠️ Network error fetching restaurants: ${error.code} - ${error.message}`);
          throw error;
        }
        throw error;
      });

      if (restaurantsResponse.data.status === 'OK' && restaurantsResponse.data.results) {
        const restaurants = restaurantsResponse.data.results.slice(0, 5);
        let totalPrice = 0;
        let count = 0;

        for (const restaurant of restaurants) {
          try {
            const detailsResponse = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
              params: {
                place_id: restaurant.place_id,
                key: apiKey,
                fields: 'price_level,rating'
              },
              timeout: 8000
            });

            if (detailsResponse.data.status === 'OK' && detailsResponse.data.result) {
              const priceLevel = detailsResponse.data.result.price_level || 2;
              // Convert price_level to PKR per meal per person
              const pricePerMeal = priceLevel === 1 ? 500 : priceLevel === 2 ? 1000 : priceLevel === 3 ? 2000 : 3500;
              totalPrice += pricePerMeal;
              count++;
            }
          } catch (err) {
            continue;
          }
        }

        if (count > 0) {
          const avgPricePerMeal = totalPrice / count;
          // 3 meals per day
          foodTotal = Math.round(avgPricePerMeal * numberOfMembers * days * 3);
          hasValidData = true;
        }
      }
    } catch (error) {
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        console.log(`⚠️ Network error fetching restaurant pricing: ${error.code} - ${error.message}`);
      } else {
        console.log('Error fetching restaurant pricing:', error.message);
      }
    }

    // Estimate transportation (based on distance from major cities)
    // This is a rough estimate - can be improved with Directions API
    const baseTransportCost = 5000; // Base cost per person
    transportationTotal = Math.round(baseTransportCost * numberOfMembers);
    hasValidData = true; // Transportation is always estimated

    // If we have no valid data from APIs, return null to trigger fallback
    if (!hasValidData && accommodationTotal === 0 && foodTotal === 0) {
      console.log('⚠️ No valid pricing data from Google APIs, using fallback');
      return null;
    }

    // Provide fallback estimates if API calls failed but we have partial data
    if (accommodationTotal === 0) {
      // Fallback: Estimate accommodation based on destination type
      const estimatedPerNight = 5000; // PKR per person per night
      accommodationTotal = Math.round(estimatedPerNight * numberOfMembers * days);
      console.log('💡 Using estimated accommodation cost (Google API unavailable)');
    }

    if (foodTotal === 0) {
      // Fallback: Estimate food cost
      const estimatedPerMeal = 800; // PKR per meal per person
      foodTotal = Math.round(estimatedPerMeal * numberOfMembers * days * 3);
      console.log('💡 Using estimated food cost (Google API unavailable)');
    }

    return {
      accommodation: accommodationTotal,
      food: foodTotal,
      transportation: transportationTotal
    };
  } catch (error) {
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      console.error(`❌ Network error in real-time pricing: ${error.code} - ${error.message}`);
      console.error('💡 Check your internet connection and DNS settings');
    } else {
      console.error('Real-time pricing error:', error.message);
    }
    return null;
  }
};

const calculateBudget = async (destination, numberOfMembers, days, season) => {
  // Try to get budget rules for destination
  let budgetRule = await BudgetRule.findOne({ destination: { $regex: destination, $options: 'i' } });
  
  // Default base costs if no rule exists
  const defaultBaseCosts = {
    transportation: { perPerson: 50, perDay: 20 },
    accommodation: { perPerson: 80, perDay: 0 },
    food: { perPerson: 30, perDay: 0 },
    activities: { perPerson: 40, perDay: 0 },
    miscellaneous: { perPerson: 20, perDay: 0 }
  };

  const baseCosts = budgetRule?.baseCosts || defaultBaseCosts;
  const seasonalMultiplier = budgetRule?.seasonalMultipliers?.[season] || 1.0;

  // Calculate costs
  const transportation = (baseCosts.transportation.perPerson * numberOfMembers + 
                         baseCosts.transportation.perDay * days) * seasonalMultiplier;
  
  const accommodation = (baseCosts.accommodation.perPerson * numberOfMembers * days) * seasonalMultiplier;
  
  const food = (baseCosts.food.perPerson * numberOfMembers * days) * seasonalMultiplier;
  
  const activities = (baseCosts.activities.perPerson * numberOfMembers * days) * seasonalMultiplier;
  
  const miscellaneous = (baseCosts.miscellaneous.perPerson * numberOfMembers * days) * seasonalMultiplier;

  const total = transportation + accommodation + food + activities + miscellaneous;

  return {
    transportation: Math.round(transportation),
    accommodation: Math.round(accommodation),
    food: Math.round(food),
    activities: Math.round(activities),
    miscellaneous: Math.round(miscellaneous),
    total: Math.round(total)
  };
};

exports.calculateBudget = async (req, res) => {
  try {
    const { destination, numberOfMembers, days, season, useRealTimePricing = false } = req.body;

    if (!destination || !numberOfMembers || !days || !season) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    let breakdown;
    let aiRecommendations = '';
    let aiInsights = '';
    let usedAI = false;
    let usedRealTimePricing = false;

    // If real-time pricing is requested, fetch from Google Places API
    if (useRealTimePricing) {
      try {
        // Find destination to get coordinates
        const dest = await Destination.findOne({ 
          name: { $regex: destination, $options: 'i' } 
        });

        if (dest && dest.coordinates && dest.coordinates.lat) {
          const realTimePrices = await getRealTimePricing(
            destination,
            dest.coordinates.lat,
            dest.coordinates.lng,
            numberOfMembers,
            days
          );

          if (realTimePrices && (realTimePrices.accommodation > 0 || realTimePrices.food > 0 || realTimePrices.transportation > 0)) {
            // Use real-time pricing for accommodation, food, transportation
            // Estimate activities and miscellaneous
            const activities = Math.round((realTimePrices.accommodation + realTimePrices.food) * 0.3);
            const miscellaneous = Math.round((realTimePrices.accommodation + realTimePrices.food) * 0.15);

            breakdown = {
              transportation: realTimePrices.transportation,
              accommodation: realTimePrices.accommodation,
              food: realTimePrices.food,
              activities: activities,
              miscellaneous: miscellaneous,
              total: realTimePrices.transportation + realTimePrices.accommodation + realTimePrices.food + activities + miscellaneous
            };
            usedRealTimePricing = true;
            console.log('✅ Real-time Google pricing fetched successfully');
          } else {
            console.log('⚠️ Real-time pricing returned invalid/empty data, falling back to default calculation');
          }
        }
      } catch (error) {
        console.log('Real-time pricing failed, falling back:', error.message);
      }
    }

    // If real-time pricing not used or failed, try AI
    if (!usedRealTimePricing) {
      const aiBudget = await getAIBudgetEstimate(destination, numberOfMembers, days, season);
      
      if (aiBudget && aiBudget.total > 0) {
        breakdown = {
          transportation: aiBudget.transportation,
          accommodation: aiBudget.accommodation,
          food: aiBudget.food,
          activities: aiBudget.activities,
          miscellaneous: aiBudget.miscellaneous,
          total: aiBudget.total
        };
        aiRecommendations = aiBudget.recommendations || '';
        aiInsights = aiBudget.insights || '';
        usedAI = true;
        console.log('✅ AI budget calculation successful');
      } else {
        breakdown = await calculateBudget(destination, numberOfMembers, days, season);
        console.log('📊 Budget calculated using default (rule-based) method');
      }
    }

    res.json({
      destination,
      numberOfMembers,
      days,
      season,
      breakdown,
      currency: 'PKR',
      aiPowered: usedAI,
      realTimePricing: usedRealTimePricing,
      recommendations: aiRecommendations,
      insights: aiInsights
    });
  } catch (error) {
    console.error('Budget calculation error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.saveBudget = async (req, res) => {
  try {
    const { destination, numberOfMembers, days, season, breakdown, total, isManual, status, startDate } = req.body;

    const budget = new Budget({
      userId: req.user._id,
      destination,
      numberOfMembers,
      days,
      season: normalizeSeason(season),
      breakdown,
      total,
      isManual: isManual || false,
      status: normalizeStatus(status),
      startDate: startDate ? new Date(startDate) : undefined
    });

    await budget.save();
    res.status(201).json(budget);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
