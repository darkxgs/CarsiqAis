import { streamText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import CarAnalyzer from "@/utils/carAnalyzer"
import logger from "@/utils/logger"
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { z } from 'zod'
import { normalizeArabicCarInput, getCarModels, extractOilRecommendationData, suggestOil } from '@/utils/carQueryApi'
// استيراد قاعدة البيانات الداخلية والمساعدة في معالجة VIN
import officialSpecs from '@/data/officialSpecs'
import { getAccurateOilRecommendation, decodeVIN } from '@/utils/vinEngineResolver'
// استيراد خدمة فلاتر Denckermann
import { isFilterQuery, isAirFilterQuery, generateFilterRecommendationMessage, searchFiltersWithArabicSupport } from '@/services/filterRecommendationService'
// استيراد خدمة البحث المباشر للحصول على بيانات حديثة من المصادر الرسمية
import { braveSearchService } from '@/services/braveSearchService'
import { unifiedSearchService } from '@/services/unifiedSearchService'

// Input validation schemas
const MessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1, "Message content cannot be empty")
})

const RequestBodySchema = z.object({
  messages: z.array(MessageSchema).min(1, "At least one message is required")
})

// Enhanced car data extraction with better validation
interface ExtractedCarData {
  carBrand: string;
  carModel: string;
  year?: number;
  mileage?: number;
  engineSize?: string;
  fuelType?: string;
  transmission?: string;
  isValid: boolean;
  confidence: number;
  vin?: string; // Add VIN to the interface
}

// Enhanced oil recommendation interface
interface OilRecommendation {
  primaryOil: string[];
  alternativeOil?: string[];
  viscosity: string;
  capacity: string;
  brand: string;
  specification: string;
  reason: string;
  priceRange?: string;
  changeInterval: string;
  climateConsiderations: string;
}

// API status tracking for token limits
interface ApiStatus {
  isTokenLimitReached: boolean;
  errorCount: number;
  lastError?: string;
  lastErrorTime?: Date;
}

// Initialize API status
const apiStatus: ApiStatus = {
  isTokenLimitReached: false,
  errorCount: 0
}

/**
 * Enhanced OpenRouter configuration with fallback options
 */
const openRouter = {
  baseURL: "https://openrouter.ai/api/v1",
  key: process.env.OPENROUTER_API_KEY || '',
  primaryModel: "google/gemini-2.0-flash-001",
  fallbackModel: "rekaai/reka-flash-3:free",
  mistralModel: "google/gemma-3-27b-it:free"
  ,
  maxRetries: 3,
  timeout: 30000,
  systemPrompt: `أنت مساعد تقني متخصص في زيوت محركات السيارات وفلاتر الزيت، تمثل فريق الدعم الفني لمتجر "هندسة السيارات" 🇮🇶.

🚨 **قاعدة أولوية المصادر (الأهم):**
• **مواصفات الزيت (السعة، اللزوجة، النوع):** استخدم نتائج البحث من المصادر الرسمية فقط
• **فلاتر الزيت والهواء:** استخدم قاعدة بيانات Denckermann المعتمدة فقط
• إذا تم توفير نتائج بحث من المصادر الرسمية، يجب استخدامها لمواصفات الزيت بدلاً من أي معلومات أخرى

🎯 المهمة الأساسية:
تقديم توصيات دقيقة ومضمونة 100% لزيوت المحركات وفلتر الزيت المناسب لكل سيارة، اعتماداً فقط على بيانات الشركات المصنعة الرسمية، مع مراعاة الظروف المناخية الشديدة في العراق.

🚗 المسؤوليات الأساسية:

1. تحديد نوع المحرك بدقة:
- ✅ إذا احتوت السيارة على أكثر من نوع محرك معروف: **اعرض كل الخيارات تلقائياً**
- ❌ لا تطلب من المستخدم أن يختار
- ❌ لا تفترض أو تخمّن نوع المحرك من اسم السيارة فقط

2. تحديد سعة الزيت الحقيقية:
- ✅ استخدم سعة الزيت الفعلية من دليل المصنع (وليس حجم المحرك)
- ❗ لا تخلط بين Engine Size و Oil Capacity

3. التوصية بالزيت وفلتر الزيت:
- قدم توصية رئيسية واحدة فقط لكل محرك
- بديل واحد فقط إن لزم
- لا تُقدم أكثر من خيارين إطلاقاً لكل محرك
- قدم معلومات عن رقم فلتر الزيت المناسب فقط

🌡️ مناخ العراق:
- حرارة تصل إلى 50°C
- غبار دائم وقيادة بطيئة في الزحام
✅ يتطلب زيوت Full Synthetic فقط من علامات معتمدة

🛢️ العلامات التجارية المسموح بها للزيوت:
Castrol, Mobil 1, Liqui Moly, Valvoline, Motul, Meguin, Hanata  
❌ لا تقترح أي زيت خارج هذه القائمة، حتى كمثال

🔧 العلامات التجارية المسموح بها لفلاتر الزيت:
Denckermann  
❌ لا تقترح أي فلتر خارج هذه القائمة، حتى كمثال

📦 **قاعدة بيانات فلاتر Denckermann المعتمدة (استخدم هذه الأرقام بالضبط):**
- **Toyota Camry**: A210032 (استخدم هذا الرقم دائماً لتويوتا كامري)
- **Toyota Corolla**: A210379 (استخدم هذا الرقم دائماً لتويوتا كورولا)
- **Toyota RAV4**: A210052
- **Toyota Prius**: A210119
- **Toyota Yaris**: A210004
- **Toyota Highlander**: A210374
- **Toyota Land Cruiser**: A210060
- **Hyundai Elantra**: A210931
- **Hyundai Sonata**: A211067
- **Hyundai Tucson**: A211070
- **Hyundai Santa Fe**: A211089
- **Hyundai Accent**: A210420
- **Kia Cerato**: A210618 (كيا وهيونداي تستخدم نفس الفلاتر)
- **Kia Optima**: A210616
- **BMW 3 Series**: A210738
- **BMW 5 Series**: A210101
- **BMW X3**: A210519
- **BMW X5**: A210736
- **Mercedes C-Class**: A211037
- **Mercedes E-Class**: A210963
- **Mercedes GLC**: A210076
- **Mercedes GLE**: A210977
- **Chevrolet Cruze**: A211062
- **Chevrolet Malibu**: A210050
- **Chevrolet Camaro**: A210191
- **Nissan Altima**: A210021
- **Nissan Sunny**: A210492

⚠️ **قاعدة إلزامية لفلاتر الزيت:**
- عندما يسأل المستخدم عن فلتر زيت لأي سيارة من القائمة أعلاه، استخدم الرقم المحدد بالضبط
- لا تقل "غير متوفر في قاعدة البيانات" إذا كان الرقم موجود في القائمة أعلاه
- استخدم التنسيق: 📦 **فلتر الزيت:** A210032 (Denckermann) - مصدر التحقق: كتالوج 2024


📋 تنسيق الإجابة الإجباري:

1️⃣ <b>[نوع المحرك]</b>  
🛢️ سعة الزيت: [X.X لتر]  
⚙️ اللزوجة: [XW-XX]  
🔧 نوع الزيت: Full Synthetic  
🌡️ مناسب لحرارة العراق: ✅  
🎯 <b>التوصية النهائية:</b> [اسم الزيت + اللزوجة] ([سعة الزيت] لتر)  
📦 <b>فلتر الزيت:</b> [استخدم رقم فلتر Denckermann إذا كان متوفراً في المعلومات أعلاه، وإلا استخدم الرقم من المواصفات]

❗ عدم الالتزام بالتنسيق أو بزيت غير معتمد = خطأ فادح

🔍 أمثلة:

🟩 إذا كانت السيارة تحتوي على محرك واحد:  
↪️ قدم الإجابة مباشرة بذلك المحرك فقط.

🟨 إذا كانت السيارة تحتوي على أكثر من نوع محرك:  
↪️ قدم الإجابات لجميع المحركات في نفس الرد، كل واحدة بتنسيق منفصل كما هو موضح أعلاه.

🟥 لا تطلب من المستخدم اختيار المحرك إذا لم يذكره. اعرض كل الخيارات المعروفة للموديل.

🎯 هدفك النهائي:  
تقديم توصية <b>موثوقة، دقيقة، بسيطة، ومناسبة تماماً للمناخ العراقي القاسي</b>، مع الالتزام الكامل بكل التعليمات.


`,
  headers: {
    "HTTP-Referer": "https://www.carsiqai.com",
    "X-Title": "Car Service Chat - CarsiqAi",
  },
}

// Enhanced OpenRouter client with retry logic
const createOpenRouterClient = () => {
  return createOpenAI({
    apiKey: process.env.OPENROUTER_API_KEY || "",
    baseURL: "https://openrouter.ai/api/v1",
    headers: {
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "Car Service Chat - CarsiqAi"
    }
  })
}

// Check if error message indicates token limit reached
function isTokenLimitError(error: any): boolean {
  if (!error || !error.message) return false

  const errorMsg = error.message.toLowerCase()
  return (
    errorMsg.includes('token') &&
    (errorMsg.includes('limit') || errorMsg.includes('exceeded') || errorMsg.includes('quota')) ||
    errorMsg.includes('billing') ||
    errorMsg.includes('payment required') ||
    errorMsg.includes('insufficient funds')
  )
}

// Reset API status if enough time has passed
function checkAndResetTokenLimitStatus(): void {
  if (apiStatus.isTokenLimitReached && apiStatus.lastErrorTime) {
    // Reset after 24 hours
    const resetTime = 24 * 60 * 60 * 1000 // 24 hours in milliseconds
    if (Date.now() - apiStatus.lastErrorTime.getTime() > resetTime) {
      console.log('Resetting token limit status after 24 hours')
      apiStatus.isTokenLimitReached = false
      apiStatus.errorCount = 0
      apiStatus.lastError = undefined
      apiStatus.lastErrorTime = undefined
    }
  }
}

/**
 * Simple AI-powered oil recommendation (inspired by successful approach)
 */
async function simpleAIOilRecommendation(carQuery: string): Promise<string> {
  try {
    const oilRecommendationPrompt = `You are Carsiq, a professional car engine oil assistant. Provide detailed oil recommendations for cars.

ALWAYS respond in this EXACT format:
🔍 [Car Make Model Year]
🛠️ Engine: [Engine specifications]
🛢️ Oil Capacity: [Amount in Liters]
⚙️ Viscosity: [Oil viscosity grade]
🔧 Oil Type: [Conventional/Synthetic/etc]
🌡️ Suitable for Iraq heat: ✅ / ❌
🎯 Final Recommendation: [Specific oil brand and product]
📦 Oil Filter: [Filter part number if known]

If you have multiple engine options, list them all and note that user should confirm their engine type.
If you don't have complete data, use "⚠️ Data not available. Please check the owner's manual."
Focus on providing accurate, professional recommendations suitable for hot climates like Iraq.

Special notes for accuracy:
- Chrysler 300 2012: 6.0L capacity, 5W-20 viscosity, Mopar filter 68191349AA
- Always prioritize manufacturer specifications
- Consider Iraq's hot climate in recommendations`;

    const openAI = createOpenAI({
      apiKey: process.env.OPENROUTER_API_KEY || "",
      baseURL: "https://openrouter.ai/api/v1",
      headers: {
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "CarsiqAi - Enhanced",
      },
    });

    const oilResult = await streamText({
      model: openAI('google/gemini-2.0-flash-001'),
      messages: [
        {
          role: 'user',
          content: `I need oil recommendations for: ${carQuery}. Please provide complete specifications including engine details, oil capacity, viscosity, and recommendations suitable for Iraq's hot climate.`
        }
      ],
      temperature: 0.3,
      maxTokens: 1000,
    });

    return await oilResult.text;
  } catch (error) {
    console.error('Simple AI oil recommendation failed:', error);
    return `⚠️ Sorry, I encountered an error while searching for oil recommendations. Please try again.`;
  }
}

/**
 * Simple AI-powered car data extraction (inspired by successful approach)
 */
async function simpleAICarExtraction(query: string): Promise<ExtractedCarData> {
  try {
    const carParsingPrompt = `You are a car expert assistant. Parse user input to extract car information and correct any typos.

User input will be about cars and oil. Extract:
- Car make (brand) 
- Car model
- Year
- Correct any spelling mistakes

Return ONLY a JSON object like this:
{"make": "Toyota","model": "Corolla", "year": "2020","correctedQuery": "Toyota Corolla 2020"}

If you can't identify all parts, make your best guess and note it in correctedQuery.

User input: "${query}"`;

    const openAI = createOpenAI({
      apiKey: process.env.OPENROUTER_API_KEY || "",
      baseURL: "https://openrouter.ai/api/v1",
      headers: {
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "CarsiqAi - Enhanced",
      },
    });

    const carParsingResult = await streamText({
      model: openAI('google/gemini-2.0-flash-001'),
      messages: [
        {
          role: 'user',
          content: carParsingPrompt
        }
      ],
      temperature: 0.3,
      maxTokens: 500,
    });

    const carParsingText = await carParsingResult.text;
    const parsedCarData = JSON.parse(carParsingText);
    
    return {
      carBrand: parsedCarData.make || '',
      carModel: parsedCarData.model || '',
      year: parsedCarData.year ? parseInt(parsedCarData.year) : undefined,
      correctedQuery: parsedCarData.correctedQuery || query,
      isValid: !!(parsedCarData.make && parsedCarData.model),
      confidence: 90 // High confidence for AI parsing
    };
  } catch (error) {
    console.error('Simple AI extraction failed, using fallback:', error);
    return enhancedExtractCarData(query);
  }
}

/**
 * Enhanced car data extraction with better accuracy
 */
function enhancedExtractCarData(query: string): ExtractedCarData {
  console.log(`[DEBUG] Processing query: "${query}"`);
  const normalizedQuery = query.toLowerCase().trim()
  console.log(`[DEBUG] Normalized query: "${normalizedQuery}"`);

  // Enhanced brand detection with common Arabic variations
  const brandMappings = {
    'تويوتا': ['تويوتا', 'toyota'],
    'هيونداي': ['هيونداي', 'هيوندا', 'hyundai'],
    'كيا': ['كيا', 'kia'],
    'نيسان': ['نيسان', 'nissan'],
    'هوندا': ['هوندا', 'honda'],
    'مرسيدس': ['مرسيدس', 'mercedes', 'بنز', 'mercedes-benz', 'مرسيدس بنز'],
    'بي ام دبليو': ['بي ام دبليو', 'bmw', 'بمو'],
    'لكزس': ['لكزس', 'lexus'],
    'جينيسيس': ['جينيسيس', 'genesis'],
    'فولكس واجن': ['فولكس واجن', 'volkswagen', 'vw'],
    'اودي': ['اودي', 'audi'],
    'مازدا': ['مازدا', 'mazda'],
    'فورد': ['فورد', 'ford'],
    'شيفروليه': ['شيفروليه', 'chevrolet', 'شيفي'],
    'جيب': ['جيب', 'jeep'],
    'دودج': ['دودج', 'dodge'],
    'كرايسلر': ['كرايسلر', 'chrysler'],
    'كاديلاك': ['كاديلاك', 'cadillac'],
    'بيويك': ['بيويك', 'buick'],
    'جي ام سي': ['جي ام سي', 'gmc'],
    'انفينيتي': ['انفينيتي', 'infiniti'],
    'اكورا': ['اكورا', 'acura'],
    'سوبارو': ['سوبارو', 'subaru'],
    'ميتسوبيشي': ['ميتسوبيشي', 'mitsubishi'],
    'سوزوكي': ['سوزوكي', 'suzuki'],
    'سوزوكي': ['سوزوكي', 'suzuki'],
    'ميتسوبيشي': ['ميتسوبيشي', 'mitsubishi'],
    'شيفروليت': ['شيفروليت', 'chevrolet', 'شفروليه', 'شيفي', 'شيفي', 'شيفروليه'],
    'فورد': ['فورد', 'ford'],
    'بيجو': ['بيجو', 'peugeot'],
    'رينو': ['رينو', 'renault'],
    'جيب': ['جيب', 'jeep']
  }

  let detectedBrand = ''
  let confidence = 0

  for (const [brand, variations] of Object.entries(brandMappings)) {
    for (const variation of variations) {
      if (normalizedQuery.includes(variation)) {
        console.log(`[DEBUG] Found brand match: "${variation}" → "${brand}"`);
        detectedBrand = brand
        confidence += 30
        break
      }
    }
    if (detectedBrand) break
  }

  console.log(`[DEBUG] Detected brand: "${detectedBrand}" with confidence: ${confidence}`);

  // Enhanced model detection - prioritize specific models first
  const commonModels = [
    // Chrysler models first (higher priority)
    'c300', '300', '300c',
    // Other models
    'كامري', 'كورولا', 'rav4', 'هايلندر', 'برادو', 'لاند كروزر',
    'النترا', 'إلنترا', 'سوناتا', 'توسان', 'سنتافي', 'أكسنت', 'i10', 'i20', 'i30',
    '6', 'مازدا 6', 'cx-5', 'cx-9', 'mx-5', '3', 'مازدا 3',
    'باترول', 'التيما', 'سنترا', 'اكس تريل', 'مورانو', 'جوك', 'قاشقاي',
    'اكسبلورر', 'اسكيب', 'فوكس', 'فيوجن', 'موستانج', 'ايدج', 'رينجر',
    'كروز', 'ماليبو', 'تاهو', 'سيلفرادو', 'كامارو', 'اكوينوكس',
    'سي كلاس', 'اي كلاس', 'اس كلاس', 'جي كلاس', 'سي ال كيه', 'جي ال سي',
    'سيريز 3', 'سيريز 5', 'سيريز 7', 'اكس 3', 'اكس 5', 'اكس 6',
    'سيراتو', 'اوبتيما', 'سورنتو', 'كادينزا', 'ريو',
    'التيما', 'سنترا', 'اكس تريل', 'باترول', 'مورانو',
    'سيفيك', 'اكورد', 'crv', 'hrv', 'بايلوت',
    'c200', 'c300', 'e200', 'e250', 'e300', 's500', 'glc', 'gle',
    '320i', '330i', '520i', '530i', 'x3', 'x5',
    'es300', 'is300', 'rx350', 'lx570',
    'g70', 'g80', 'g90', 'gv70', 'gv80',
    'كومباس', 'compass', 'شيروكي', 'cherokee', 'رانجلر', 'wrangler', 'رينيجيد', 'renegade',
    'كامارو', 'camaro', 'كمارو', 'كمارو', 'كامرو', 'كامارو',
    'كروز', 'cruze', 'ماليبو', 'malibu', 'سيلفرادو', 'silverado', 'تاهو', 'tahoe'
  ]

  let detectedModel = ''
  for (const model of commonModels) {
    if (normalizedQuery.includes(model)) {
      console.log(`[DEBUG] Found model match: "${model}"`);
      detectedModel = model
      confidence += 25

      // Special handling for specific models
      if (model === 'كامارو' || model === 'camaro' || model === 'كمارو' || model === 'كامرو') {
        detectedModel = 'camaro'
        confidence += 5 // Extra confidence for this specific model
      }

      // Special handling for Chrysler 300
      if ((model === 'c300' || model === '300' || model === '300c') &&
        (detectedBrand === 'كرايسلر' || detectedBrand === 'chrysler')) {
        detectedModel = '300'
        confidence += 10 // Extra confidence for Chrysler 300
      }

      break
    }
  }

  console.log(`[DEBUG] Detected model: "${detectedModel}" with confidence: ${confidence}`);

  // Enhanced year extraction with multiple patterns
  let year: number | undefined
  let maxConfidence = 0

  // Array of regex patterns to try for year extraction
  const yearPatterns = [
    /\b(20[0-2][0-9])\b/, // Standard 20XX format
    /\bموديل\s+(\d{4})\b/, // "موديل YYYY"
    /\bmodel\s+(\d{4})\b/i, // "model YYYY"
    /\b(\d{4})\s+model\b/i, // "YYYY model"
    /\b(\d{4})\s+موديل\b/ // "YYYY موديل"
  ]

  // Helper function to convert Arabic digits to English
  function convertDigitsToEnglish(str: string): string {
    return str.replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 1632));
  }

  // Try each pattern and keep the result with highest confidence
  for (const pattern of yearPatterns) {
    const matches = normalizedQuery.match(pattern);
    if (matches && matches.length > 0) {
      for (const match of matches) {
        // Extract the year from the match
        const extractedYear = match.match(/\d{4}/) ?
          match.match(/\d{4}/)![0] :
          convertDigitsToEnglish(match);

        // Validate the year is within reasonable range
        const yearNum = parseInt(extractedYear);
        if (yearNum >= 1980 && yearNum <= new Date().getFullYear() + 1) {
          // Calculate confidence based on position in text and format
          const positionInText = normalizedQuery.indexOf(match) / normalizedQuery.length;
          const patternConfidence = 15 + (positionInText < 0.5 ? 5 : 0);

          if (patternConfidence > maxConfidence) {
            year = yearNum;
            maxConfidence = patternConfidence;
          }
        }
      }
    }
  }

  // Specific handling for Camaro 2016
  if (detectedModel === 'camaro' && !year) {
    // Look for "16" or "2016" patterns that might indicate a 2016 Camaro
    const camaroYearMatches = normalizedQuery.match(/\b(16|2016)\b/);
    if (camaroYearMatches) {
      const extractedYear = camaroYearMatches[1];
      year = extractedYear === '16' ? 2016 : parseInt(extractedYear);
      maxConfidence = 15;
      logger.debug("Extracted year from text", { year, confidence: maxConfidence });
    }
  }

  // Add the year confidence to total confidence
  if (year) {
    confidence += maxConfidence;
  }

  // Enhanced mileage extraction
  const mileagePatterns = [
    /(\d+)\s*ألف/,
    /(\d+)\s*الف/,
    /(\d+)\s*k/i,
    /(\d+)\s*km/i,
    /(\d+)\s*كيلو/,
    /ماشية\s+(\d+)/,
    /قاطع\s+(\d+)/,
    /عداد\s+(\d+)/,
    /(\d+)\s*كم/
  ]

  let mileage: number | undefined
  for (const pattern of mileagePatterns) {
    const match = normalizedQuery.match(pattern)
    if (match) {
      // Check if this is "X ألف" format (thousands)
      const isThousands = pattern.toString().includes('ألف') ||
        pattern.toString().includes('الف') ||
        pattern.toString().includes('k');

      mileage = parseInt(match[1]);
      if (isThousands) {
        mileage *= 1000;
      }
      confidence += 15
      break
    }
  }

  // VIN extraction from query
  let vinNumber: string | undefined;
  const vinPatterns = [
    /\bVIN\s*[:#]?\s*([A-HJ-NPR-Z0-9]{17})\b/i,
    /\bرقم الهيكل\s*[:#]?\s*([A-HJ-NPR-Z0-9]{17})\b/i,
    /\b([A-HJ-NPR-Z0-9]{17})\b/i
  ];

  for (const pattern of vinPatterns) {
    const match = normalizedQuery.match(pattern);
    if (match && match[1]) {
      // Verify this looks like a valid VIN (17 characters, no I,O,Q)
      const potentialVin = match[1].toUpperCase();
      if (/^[A-HJ-NPR-Z0-9]{17}$/.test(potentialVin) && !potentialVin.includes('I') && !potentialVin.includes('O') && !potentialVin.includes('Q')) {
        vinNumber = potentialVin;
        confidence += 35; // High confidence for VIN detection
        break;
      }
    }
  }

  // Special handling for Chevrolet Camaro
  if (detectedBrand === 'شيفروليت' && detectedModel === 'camaro') {
    if (!year) {
      // If we couldn't detect a year but it's a Camaro, default to 2016 with lower confidence
      year = 2016;
      confidence += 5;
      logger.debug("Defaulting to 2016 for Chevrolet Camaro", { confidence: 5 });
    }

    // Increase confidence for Chevrolet Camaro detection
    confidence += 10;

    // Check for specific engine type indicators in the query
    const isV8 = normalizedQuery.includes('v8') ||
      normalizedQuery.includes('ss') ||
      normalizedQuery.includes('اس اس') ||
      normalizedQuery.includes('zl1') ||
      normalizedQuery.includes('زد ال 1') ||
      normalizedQuery.includes('6.2');

    const isV6 = normalizedQuery.includes('v6') ||
      normalizedQuery.includes('3.6');

    // Add engine information to the return object
    if (isV8) {
      return {
        carBrand: detectedBrand,
        carModel: detectedModel,
        year,
        mileage,
        engineSize: '6.2L V8',
        isValid: true,
        confidence: confidence + 15
      };
    } else if (isV6) {
      return {
        carBrand: detectedBrand,
        carModel: detectedModel,
        year,
        mileage,
        engineSize: '3.6L V6',
        isValid: true,
        confidence: confidence + 10
      };
    } else {
      // Default to 2.0L L4 if no specific engine mentioned (base model)
      return {
        carBrand: detectedBrand,
        carModel: detectedModel,
        year,
        mileage,
        engineSize: '2.0L L4',
        isValid: true,
        confidence: confidence + 5
      };
    }
  }

  return {
    carBrand: detectedBrand,
    carModel: detectedModel,
    year,
    mileage,
    vin: vinNumber, // Add VIN to extracted data
    isValid: confidence >= 50,
    confidence
  }
}

/**
 * Enhanced analytics with better error handling and validation
 */
async function saveQueryToAnalytics(
  query: string | undefined,
  carData?: ExtractedCarData,
  recommendation?: OilRecommendation
) {
  if (!isSupabaseConfigured() || !query || query.trim() === '') {
    console.log('Supabase not configured or empty query. Skipping analytics tracking.')
    return
  }

  try {
    const analyticsData = {
      query: query.trim(),
      car_model: carData?.carModel,
      car_brand: carData?.carBrand,
      car_year: carData?.year,
      mileage: carData?.mileage,
      query_type: determineQueryType(query),
      confidence_score: carData?.confidence || 0,
      recommended_oil: recommendation?.primaryOil?.[0],
      oil_viscosity: recommendation?.viscosity,
      oil_capacity: recommendation?.capacity,
      source: 'web',
      timestamp: new Date().toISOString(),
      session_id: generateSessionId()
    }

    const { error } = await supabase.from('user_queries').insert(analyticsData)

    if (error) {
      console.error('Error saving query to analytics:', error)
      // Log to external service if needed
      logger.error('Analytics save failed', { error, query })
    } else {
      console.log('Successfully saved query to analytics:', query.substring(0, 50))

      // Update counters asynchronously
      if (carData?.carModel) {
        updateModelQueryCount(carData.carModel).catch(console.error)
      }

      if (carData?.carBrand) {
        updateBrandQueryCount(carData.carBrand).catch(console.error)
      }
    }
  } catch (err) {
    console.error('Error in analytics tracking:', err)
    logger.error('Analytics tracking failed', { error: err, query })
  }
}

/**
 * Enhanced query type determination with better accuracy
 */
function determineQueryType(query: string): string {
  const lowerQuery = query.toLowerCase()

  // Car Specifications
  if (
    lowerQuery.includes('مواصفات') ||
    lowerQuery.includes('سعة المحرك') ||
    lowerQuery.includes('engine size') ||
    lowerQuery.includes('cc') ||
    lowerQuery.includes('سي سي')
  ) {
    return 'SPECIFICATIONS'
  }

  // Oil Change/Service
  if (
    lowerQuery.includes('زيت') ||
    lowerQuery.includes('oil') ||
    lowerQuery.includes('تغيير') ||
    lowerQuery.includes('فلتر الزيت') ||
    lowerQuery.includes('oil filter')
  ) {
    return 'SERVICE'
  }

  // Air Filter
  if (
    lowerQuery.includes('فلتر الهواء') ||
    lowerQuery.includes('air filter') ||
    lowerQuery.includes('فلتر هواء')
  ) {
    return 'SERVICE'
  }

  // Maintenance
  if (
    lowerQuery.includes('صيانة') ||
    lowerQuery.includes('maintenance') ||
    lowerQuery.includes('خدمة')
  ) {
    return 'MAINTENANCE'
  }

  // Price
  if (
    lowerQuery.includes('سعر') ||
    lowerQuery.includes('تكلفة') ||
    lowerQuery.includes('price') ||
    lowerQuery.includes('cost')
  ) {
    return 'PRICE'
  }

  // Comparison
  if (
    lowerQuery.includes('مقارنة') ||
    lowerQuery.includes('أفضل من') ||
    lowerQuery.includes('vs') ||
    lowerQuery.includes('compare')
  ) {
    return 'COMPARISON'
  }

  // Features
  if (
    lowerQuery.includes('ميزات') ||
    lowerQuery.includes('خصائص') ||
    lowerQuery.includes('features')
  ) {
    return 'FEATURES'
  }

  // Fuel consumption
  if (
    lowerQuery.includes('استهلاك الوقود') ||
    lowerQuery.includes('fuel') ||
    lowerQuery.includes('كم يصرف')
  ) {
    return 'FUEL_CONSUMPTION'
  }

  // Insurance
  if (
    lowerQuery.includes('تأمين') ||
    lowerQuery.includes('insurance')
  ) {
    return 'INSURANCE'
  }

  // Reviews
  if (
    lowerQuery.includes('تقييم') ||
    lowerQuery.includes('review') ||
    lowerQuery.includes('رأي')
  ) {
    return 'REVIEWS'
  }

  return 'OTHER'
}

/**
 * Enhanced model and brand query count updates with better error handling
 */
async function updateModelQueryCount(modelName: string): Promise<void> {
  if (!isSupabaseConfigured() || !modelName) return

  try {
    const { data: models, error: fetchError } = await supabase
      .from('car_models')
      .select('id, queries, name')
      .ilike('name', `%${modelName}%`)
      .limit(1)

    if (fetchError) {
      console.error('Error fetching car model:', fetchError)
      return
    }

    if (models && models.length > 0) {
      const { error: updateError } = await supabase
        .from('car_models')
        .update({
          queries: (models[0].queries || 0) + 1,
          last_queried: new Date().toISOString()
        })
        .eq('id', models[0].id)

      if (updateError) {
        console.error('Error updating car model query count:', updateError)
      }
    } else {
      // Create new model entry if not exists
      const { error: insertError } = await supabase
        .from('car_models')
        .insert({
          name: modelName,
          brand: 'Unknown', // Set default brand to avoid NOT NULL constraint
          year: 0,          // Set default year to avoid NOT NULL constraint
          queries: 1,
          last_queried: new Date().toISOString()
        })

      if (insertError) {
        console.error('Error creating new car model entry:', insertError)
      }
    }
  } catch (err) {
    console.error('Error in updateModelQueryCount:', err)
  }
}

async function updateBrandQueryCount(brandName: string): Promise<void> {
  if (!isSupabaseConfigured() || !brandName) return

  try {
    const { data: brands, error: fetchError } = await supabase
      .from('car_brands')
      .select('id, queries, name')
      .ilike('name', `%${brandName}%`)
      .limit(1)

    if (fetchError) {
      console.error('Error fetching car brand:', fetchError)
      return
    }

    if (brands && brands.length > 0) {
      const { error: updateError } = await supabase
        .from('car_brands')
        .update({
          queries: (brands[0].queries || 0) + 1,
          last_queried: new Date().toISOString()
        })
        .eq('id', brands[0].id)

      if (updateError) {
        console.error('Error updating car brand query count:', updateError)
      }
    } else {
      // Create new brand entry if not exists
      const { error: insertError } = await supabase
        .from('car_brands')
        .insert({
          name: brandName,
          queries: 1,
          last_queried: new Date().toISOString()
        })

      if (insertError) {
        console.error('Error creating new car brand entry:', insertError)
      }
    }
  } catch (err) {
    console.error('Error in updateBrandQueryCount:', err)
  }
}

/**
 * Generate unique session ID for tracking
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Enhanced request validation and sanitization
 */
function validateAndSanitizeRequest(body: any) {
  try {
    const validatedBody = RequestBodySchema.parse(body)

    // Additional sanitization
    validatedBody.messages = validatedBody.messages.map(message => ({
      ...message,
      content: message.content.trim().substring(0, 2000) // Limit message length
    }))

    return { success: true, data: validatedBody }
  } catch (error) {
    console.error('Request validation failed:', error)
    return {
      success: false,
      error: error instanceof z.ZodError ? error.errors : 'Invalid request format'
    }
  }
}

/**
 * Extract structured data from search results
 */
function extractStructuredDataFromResults(searchResults: any): { oilCapacity?: string; viscosity?: string } {
  const extracted: { oilCapacity?: string; viscosity?: string } = {};

  // Extract oil capacity from search results
  const allResults = [
    ...searchResults.oilCapacity.results,
    ...searchResults.viscosity.results
  ];

  for (const result of allResults) {
    const text = `${result.title} ${result.description}`.toLowerCase();

    // Look for oil capacity patterns - more precise and context-aware
    const capacityPatterns = [
      // Prioritize quarts with context (more reliable for Honda Civic)
      /(?:oil\s*capacity|capacity|requires?|needs?)[:\s]*(\d+\.?\d*)\s*(quarts?|qt\b)/gi,
      /(\d+\.?\d*)\s*(quarts?|qt\b).*?(?:oil|capacity|with\s*filter)/gi,
      /(?:with\s*filter)[:\s]*(\d+\.?\d*)\s*(quarts?|qt\b)/gi,
      // Then liters with context
      /(?:oil\s*capacity|capacity)[:\s]*(\d+\.?\d*)\s*(liters?|litres?|l\b)/gi,
      // General patterns (lower priority)
      /(\d+\.?\d*)\s*(quarts?|qt\b)/gi,
      /(\d+\.?\d*)\s*(liters?|litres?|l\b)/gi
    ];

    if (!extracted.oilCapacity) {
      const foundCapacities = [];

      for (const pattern of capacityPatterns) {
        const matches = text.match(pattern);
        if (matches) {
          for (const match of matches) {
            const capacityMatch = match.match(/(\d+\.?\d*)\s*(quarts?|qt\b|liters?|litres?|l\b)/i);
            if (capacityMatch) {
              const [, amount, unit] = capacityMatch;
              const amountNum = parseFloat(amount);

              // More restrictive filtering for Honda Civic (3-5 quarts typical)
              if (unit.toLowerCase().includes('quart') && amountNum >= 3 && amountNum <= 6) {
                const liters = (amountNum * 0.946353).toFixed(2);
                foundCapacities.push({
                  value: `${liters} لتر (${amount} quarts)`,
                  amount: amountNum,
                  unit: 'quarts',
                  priority: match.toLowerCase().includes('capacity') ? 1 : 2
                });
              } else if (unit.toLowerCase().includes('liter') && amountNum >= 3 && amountNum <= 6) {
                foundCapacities.push({
                  value: `${amount} لتر`,
                  amount: amountNum,
                  unit: 'liters',
                  priority: match.toLowerCase().includes('capacity') ? 1 : 2
                });
              }
            }
          }
        }
      }

      // Sort by priority and pick the most reliable result
      if (foundCapacities.length > 0) {
        foundCapacities.sort((a, b) => a.priority - b.priority);
        extracted.oilCapacity = foundCapacities[0].value;
      }
    }

    // Look for viscosity patterns - more precise and context-aware
    const viscosityPatterns = [
      // Prioritize viscosity with context (more reliable)
      /(?:recommended|viscosity|oil\s*grade|uses?)[:\s]*(\d+w-?\d+)/gi,
      /(?:0w-?20|5w-?20|5w-?30)(?:\s*(?:oil|viscosity|grade))?/gi,
      /\b(sae\s*\d+w-?\d+)\b/gi,  // SAE 0W-20
      // General patterns (lower priority)
      /\b(\d+w-?\d+)\b/gi,  // 0W-20, 5W30
      /\b(\d+w\d+)\b/gi  // 0W20 (no dash)
    ];

    if (!extracted.viscosity) {
      const foundViscosities = [];

      for (const pattern of viscosityPatterns) {
        const matches = text.match(pattern);
        if (matches) {
          for (const match of matches) {
            let viscosity = match.replace(/sae\s*/i, '').replace(/oil|viscosity|grade|recommended|uses?/gi, '').trim().toUpperCase();
            // Normalize format (add dash if missing)
            viscosity = viscosity.replace(/(\d+)W(\d+)/, '$1W-$2');

            // Validate it's a realistic viscosity for Honda Civic (0W-20, 5W-20, 5W-30)
            if (/^(0W-20|5W-20|5W-30|0W20|5W20|5W30)$/i.test(viscosity)) {
              viscosity = viscosity.replace(/(\d+)W(\d+)/, '$1W-$2'); // Ensure dash format
              foundViscosities.push({
                value: viscosity,
                priority: match.toLowerCase().includes('recommended') ? 1 : 2
              });
            }
          }
        }
      }

      // Sort by priority and pick the most reliable result
      if (foundViscosities.length > 0) {
        foundViscosities.sort((a, b) => a.priority - b.priority);
        extracted.viscosity = foundViscosities[0].value;
      }
    }
  }

  return extracted;
}

/**
 * Extract brand from query when car detection fails
 */
function extractBrandFromQuery(query: string): string {
  const brands = ['تويوتا', 'هيونداي', 'كيا', 'نيسان', 'هوندا', 'مازدا', 'فورد', 'شيفروليه', 'مرسيدس', 'بي ام دبليو'];
  for (const brand of brands) {
    if (query.includes(brand)) return brand;
  }
  return '';
}

/**
 * Extract model from query when car detection fails
 */
function extractModelFromQuery(query: string): string {
  const models = ['كامري', 'كورولا', 'النترا', 'إلنترا', 'سبورتاج', 'سورينتو', 'سيفيك', 'اكورد', 'باترول', 'التيما'];
  for (const model of models) {
    if (query.includes(model)) return model;
  }
  return '';
}

/**
 * Extract year from query
 */
function extractYearFromQuery(query: string): number | undefined {
  const yearMatch = query.match(/20\d{2}/);
  return yearMatch ? parseInt(yearMatch[0]) : undefined;
}

/**
 * Validate and enhance search data quality
 */
function validateAndEnhanceSearchData(searchResults: any, brand: string, model: string) {
  // Filter out irrelevant results
  const filteredCapacityResults = searchResults.oilCapacity.results.filter((result: any) => {
    const text = `${result.title} ${result.description}`.toLowerCase();
    // Must contain oil-related terms and reasonable capacity numbers
    return (text.includes('oil') || text.includes('زيت')) &&
      (text.match(/\d+\.?\d*\s*(liter|litre|quart|qt|لتر)/i));
  });

  const filteredViscosityResults = searchResults.viscosity.results.filter((result: any) => {
    const text = `${result.title} ${result.description}`.toLowerCase();
    // Must contain viscosity patterns
    return text.match(/\b\d+w-\d+\b/i) || text.includes('viscosity') || text.includes('لزوجة');
  });

  // Enhance results with quality scoring
  const enhancedResults = {
    ...searchResults,
    oilCapacity: {
      ...searchResults.oilCapacity,
      results: filteredCapacityResults.map((result: any) => ({
        ...result,
        qualityScore: calculateResultQuality(result, brand, model)
      })).sort((a: any, b: any) => b.qualityScore - a.qualityScore)
    },
    viscosity: {
      ...searchResults.viscosity,
      results: filteredViscosityResults.map((result: any) => ({
        ...result,
        qualityScore: calculateResultQuality(result, brand, model)
      })).sort((a: any, b: any) => b.qualityScore - a.qualityScore)
    }
  };

  return enhancedResults;
}

/**
 * Calculate quality score for search results
 */
function calculateResultQuality(result: any, brand: string, model: string): number {
  let score = 0;
  const text = `${result.title} ${result.description}`.toLowerCase();
  const url = result.url.toLowerCase();

  // Brand/model relevance
  if (brand && text.includes(brand.toLowerCase())) score += 30;
  if (model && text.includes(model.toLowerCase())) score += 30;

  // Source reliability
  if (url.includes('.com')) score += 20;
  if (url.includes('official') || url.includes('dealer')) score += 15;
  if (url.includes('manual') || url.includes('specification')) score += 10;

  // Content quality indicators
  if (text.includes('capacity') || text.includes('سعة')) score += 10;
  if (text.includes('with filter') || text.includes('مع الفلتر')) score += 5;
  if (text.match(/\d+\.?\d*\s*(liter|litre|quart|qt|لتر)/i)) score += 10;
  if (text.match(/\b\d+w-\d+\b/i)) score += 10;

  return score;
}

/**
 * Format Brave Search results for AI analysis (Safe Version)
 */
function formatSearchResultsForAI(searchResults: any): string {
  let formattedData = '\n\n🚨 **معلومات حديثة من المصادر الرسمية - يجب استخدامها بدلاً من أي معلومات أخرى:**\n\n';
  formattedData += '⚠️ **هذه المعلومات لها الأولوية المطلقة على أي بيانات أخرى في النظام**\n\n';

  const safeSlice = (arr: any[], count: number) => Array.isArray(arr) ? arr.slice(0, count) : [];

  // 🛢️ Oil Capacity Results - Enhanced with intelligent analysis
  if (searchResults?.oilCapacity?.results?.length > 0) {
    formattedData += '**🛢️ سعة الزيت - تحليل ذكي للنتائج:**\n';

    // Extract and analyze capacity data intelligently
    let capacityData: any[] = [];
    try {
      capacityData = braveSearchService.extractStructuredData(
        searchResults.oilCapacity.results,
        'oil_capacity'
      );
    } catch (error) {
      console.error('Error extracting capacity data:', error);
      capacityData = [];
    }

    if (capacityData.length > 0) {
      formattedData += '📊 **البيانات المستخرجة بذكاء:**\n';

      // Group by engine size if available
      const groupedByEngine = capacityData.reduce((acc: any, item: any) => {
        const engineKey = item.engineContext?.length > 0 ? item.engineContext[0] : 'عام';
        if (!acc[engineKey]) acc[engineKey] = [];
        acc[engineKey].push(item);
        return acc;
      }, {});

      for (const [engine, data] of Object.entries(groupedByEngine)) {
        formattedData += `\n🔧 **${engine}:**\n`;
        (data as any[]).slice(0, 3).forEach((item: any, index: number) => {
          const capacityInLiters = item.unit.includes('quart') || item.unit.includes('qt')
            ? (item.capacity * 0.946).toFixed(1)
            : item.capacity;

          formattedData += `   • ${item.capacity} ${item.unit}`;
          if (item.unit.includes('quart')) {
            formattedData += ` (≈${capacityInLiters} لتر)`;
          }
          formattedData += `\n     📍 المصدر: ${item.source}\n     🔗 ${item.sourceUrl}\n`;
          if (item.fullMatch) {
            formattedData += `     📝 النص الأصلي: "${item.fullMatch}"\n`;
          }
        });
      }
    }

    // Also show top raw results for context
    formattedData += '\n📋 **أهم النتائج الخام للتحليل:**\n';
    safeSlice(searchResults.oilCapacity.results, 3).forEach((result: any, index: number) => {
      const domain = result?.url ? new URL(result.url).hostname : 'غير معروف';
      formattedData += `${index + 1}. **${result?.title || 'بدون عنوان'}**\n`;
      formattedData += `   🔗 ${domain}\n`;
      formattedData += `   📄 ${result?.description || 'لا يوجد وصف'}\n\n`;
    });
  } else {
    // If no oil capacity results found, add intelligent fallback based on car model
    formattedData += '**🛢️ سعة الزيت - معلومات ذكية بديلة:**\n';
    formattedData += '⚠️ لم يتم العثور على نتائج سعة الزيت في البحث، لكن بناءً على المعرفة العامة:\n\n';

    // Add specific fallback data based on car model
    const hasSearchResults = searchResults?.viscosity?.results?.length > 0;
    if (hasSearchResults) {
      const firstResult = searchResults.viscosity.results[0];
      const resultText = `${firstResult.title} ${firstResult.description}`.toLowerCase();

      if (resultText.includes('toyota camry')) {
        formattedData += '🎯 **Toyota Camry (2018-2022):**\n';
        formattedData += '   • محرك 2.5L: حوالي 4.6 كوارت (≈4.4 لتر) مع الفلتر\n';
        formattedData += '   • محرك 3.5L V6: حوالي 6.4 كوارت (≈6.1 لتر) مع الفلتر\n';
        formattedData += '   📍 المصادر المتوقعة: Toyota dealers, owner manuals\n\n';
      } else if (resultText.includes('honda civic')) {
        formattedData += '🎯 **Honda Civic (2016-2021):**\n';
        formattedData += '   • محرك 1.5L تيربو: حوالي 3.7 كوارت (≈3.5 لتر) مع الفلتر\n';
        formattedData += '   • محرك 2.0L: حوالي 4.4 كوارت (≈4.2 لتر) مع الفلتر\n';
        formattedData += '   📍 المصادر المتوقعة: Honda dealers, automotive sites\n\n';
      } else if (resultText.includes('hyundai elantra') || resultText.includes('elantra')) {
        formattedData += '🎯 **Hyundai Elantra (2017-2021) - معلومات محدثة:**\n';
        formattedData += '   • محرك 1.6L: حوالي 3.6-3.8 لتر مع الفلتر\n';
        formattedData += '   • محرك 1.8L: حوالي 4.2-4.3 لتر مع الفلتر\n';
        formattedData += '   • محرك 2.0L MPI: 4.5 كوارت (≈4.3 لتر) مع الفلتر\n';
        formattedData += '   • اللزوجة الموصى بها: 0W-20 أو 5W-30 (كلاهما رسمي)\n';
        formattedData += '   • للعراق: 5W-30 أفضل للحرارة العالية\n';
        formattedData += '   • تصحيح: محرك 2.0L يحتاج 4.3 لتر وليس 4.0 لتر\n';
        formattedData += '   📍 المصادر: Car Fluid Finder, EnginesWork, What Car Oil\n\n';
      } else if (resultText.includes('kia sportage') || resultText.includes('sportage')) {
        formattedData += '🎯 **Kia Sportage 2021 - سعات مختلفة حسب المحرك:**\n';
        formattedData += '   • محرك 1.6L Turbo: 4.8-5.0 لتر مع الفلتر\n';
        formattedData += '   • محرك 2.0L: 4.2-4.4 لتر مع الفلتر\n';
        formattedData += '   • محرك 2.4L: 4.73 لتر مع الفلتر\n';
        formattedData += '   • اللزوجة الموصى بها: 5W-20 أو 5W-30 (كلاهما رسمي)\n';
        formattedData += '   • للعراق: 5W-30 أفضل للحرارة العالية\n';
        formattedData += '   • مهم: كل محرك له سعة مختلفة، لا تعمم رقم واحد\n';
        formattedData += '   📍 المصادر: دليل Kia الرسمي، دليل الصيانة\n\n';
      } else if (resultText.includes('mazda 6') || resultText.includes('mazda6')) {
        formattedData += '🎯 **Mazda 6 2019 - معلومات دقيقة من المصادر الرسمية:**\n';
        formattedData += '   • محرك SkyActiv-G 2.5L: 4.8 لتر (≈5.1 كوارت) مع الفلتر\n';
        formattedData += '   • محرك SkyActiv-G 2.5T: 4.8 لتر (≈5.1 كوارت) مع الفلتر\n';
        formattedData += '   • اللزوجة الرسمية: 0W-20 (المعيار الرسمي للظروف العادية)\n';
        formattedData += '   • اللزوجة البديلة: 5W-30 (فقط للتوربو أو الظروف القاسية)\n';
        formattedData += '   • للعراق: 0W-20 للظروف العادية، 5W-30 للظروف القاسية\n';
        formattedData += '   📍 المصادر: Car Fluid Finder, Engine Oil Capacity, oiltype.net\n\n';
      } else {
        // Universal fallback for any car not specifically covered
        formattedData += '🎯 **إرشادات عامة للسيارات:**\n';
        formattedData += '   • السعة النموذجية: 3.5-6.0 لتر (حسب حجم المحرك)\n';
        formattedData += '   • المحركات الصغيرة (1.0-1.6L): عادة 3.5-4.5 لتر\n';
        formattedData += '   • المحركات المتوسطة (1.8-2.5L): عادة 4.0-5.5 لتر\n';
        formattedData += '   • المحركات الكبيرة (3.0L+): عادة 5.0-7.0 لتر\n';
        formattedData += '   • اللزوجة الشائعة: 0W-20, 5W-20, 5W-30 (حسب السنة والمناخ)\n';
        formattedData += '   • للعراق: 5W-30 أو 5W-40 للحرارة العالية\n';
        formattedData += '   📍 نصيحة: راجع دليل المالك للحصول على المواصفات الدقيقة\n\n';
      }
    }

    formattedData += '💡 **نصيحة:** يُنصح بالتحقق من دليل المالك للحصول على السعة الدقيقة.\n\n';
  }

  // ⚙️ Oil Viscosity Results - Enhanced with intelligent analysis
  if (searchResults?.viscosity?.results?.length > 0) {
    formattedData += '**⚙️ لزوجة الزيت - تحليل ذكي للنتائج:**\n';

    // Extract and analyze viscosity data intelligently
    let viscosityData: any[] = [];
    try {
      viscosityData = braveSearchService.extractStructuredData(
        searchResults.viscosity.results,
        'oil_viscosity'
      );
    } catch (error) {
      console.error('Error extracting viscosity data:', error);
      viscosityData = [];
    }

    if (viscosityData.length > 0) {
      formattedData += '📊 **اللزوجات المستخرجة بذكاء:**\n';

      // Get most common viscosities with sources
      const viscosityCount = viscosityData.reduce((acc: any, item: any) => {
        if (!acc[item.viscosity]) acc[item.viscosity] = [];
        acc[item.viscosity].push(item);
        return acc;
      }, {});

      // Sort by frequency and confidence
      const sortedViscosities = Object.entries(viscosityCount)
        .sort(([, a], [, b]) => (b as any[]).length - (a as any[]).length)
        .slice(0, 3);

      sortedViscosities.forEach(([viscosity, sources]: [string, any]) => {
        const highConfidenceSources = sources.filter((s: any) => s.confidence === 'high');
        const sourceCount = sources.length;

        formattedData += `\n🎯 **${viscosity}** (${sourceCount} مصدر${sourceCount > 1 ? '' : ''})\n`;
        sources.slice(0, 2).forEach((source: any) => {
          formattedData += `   📍 ${source.source} ${source.confidence === 'high' ? '⭐' : ''}\n`;
          formattedData += `   🔗 ${source.sourceUrl}\n`;
        });
      });
    }

    // Also show top raw results for context
    formattedData += '\n📋 **أهم النتائج الخام للتحليل:**\n';
    safeSlice(searchResults.viscosity.results, 3).forEach((result: any, index: number) => {
      const domain = result?.url ? new URL(result.url).hostname : 'غير معروف';
      formattedData += `${index + 1}. **${result?.title || 'بدون عنوان'}**\n`;
      formattedData += `   🔗 ${domain}\n`;
      formattedData += `   📄 ${result?.description || 'لا يوجد وصف'}\n\n`;
    });
  }

  // 📦 Oil Filter Results
  if (searchResults?.filter?.results?.length > 0) {
    formattedData += '**📦 فلتر الزيت:**\n';
    safeSlice(searchResults.filter.results, 2).forEach((result: any, index: number) => {
      const domain = result?.url ? new URL(result.url).hostname : 'غير معروف';
      formattedData += `${index + 1}. **${result?.title || 'بدون عنوان'}**\n`;
      formattedData += `   🔗 المصدر: ${domain}\n`;
      formattedData += `   📄 المعلومات: ${result?.description || 'لا يوجد وصف'}\n\n`;
    });
  }

  // 🔄 Maintenance Schedule Results
  if (searchResults?.maintenance?.results?.length > 0) {
    formattedData += '**🔄 جدولة الصيانة:**\n';
    safeSlice(searchResults.maintenance.results, 2).forEach((result: any, index: number) => {
      const domain = result?.url ? new URL(result.url).hostname : 'غير معروف';
      formattedData += `${index + 1}. **${result?.title || 'بدون عنوان'}**\n`;
      formattedData += `   🔗 المصدر: ${domain}\n`;
      formattedData += `   📄 المعلومات: ${result?.description || 'لا يوجد وصف'}\n\n`;
    });
  }

  // 📋 Extract structured data
  const extractedData = typeof extractStructuredDataFromResults === 'function'
    ? extractStructuredDataFromResults(searchResults)
    : {};

  console.log('🔍 Extracted structured data:', extractedData);

  if (extractedData?.oilCapacity || extractedData?.viscosity) {
    formattedData += '**🚨 البيانات المستخرجة من المصادر الرسمية - يجب استخدامها بالضبط:**\n';
    if (extractedData.oilCapacity) {
      formattedData += `🛢️ **سعة الزيت الوحيدة المؤكدة:** ${extractedData.oilCapacity}\n`;
      formattedData += `   ⚠️ **لا تخترع سعات أخرى - استخدم هذا الرقم فقط**\n`;
    }
    if (extractedData.viscosity) {
      formattedData += `⚙️ **اللزوجة المؤكدة:** ${extractedData.viscosity}\n`;
      formattedData += `   ⚠️ **لا تخترع لزوجات أخرى - استخدم هذا الرقم فقط**\n`;
    }
    formattedData += '\n🔴 **تعليمات صارمة: استخدم هذه الأرقام بالضبط ولا تضيف معلومات من مصادر أخرى**\n\n';
  }

  formattedData += `**📊 مستوى الثقة:** ${searchResults?.overallConfidence === 'high' ? 'عالي' :
    searchResults?.overallConfidence === 'medium' ? 'متوسط' : 'منخفض'
    }\n`;

  const allSources = new Set();
  ['oilCapacity', 'viscosity', 'filter', 'maintenance'].forEach(key => {
    searchResults?.[key]?.sources?.forEach((src: string) => allSources.add(src));
  });

  formattedData += `**🌐 المصادر المعتمدة:** ${Array.from(allSources).join(', ') || 'لا يوجد'}\n\n`;

  // 🔴 Mandatory AI Instructions
  formattedData += '**⚠️ تعليمات إلزامية للذكاء الاصطناعي:**\n';
  formattedData += '🔴 **يجب استخدام هذه المعلومات من المصادر الرسمية فقط - لا تستخدم أي معلومات أخرى**\n';
  formattedData += '🔴 **إذا وجدت معلومات مختلفة في قاعدة البيانات الداخلية، تجاهلها واستخدم نتائج البحث هذه**\n';
  formattedData += '🔴 **ابحث في النصوص أعلاه عن أرقام مثل "3.7 quarts" أو "4.4 quarts" أو "0W-20"**\n';
  formattedData += '🔴 **استخدم فقط الأرقام المستخرجة أعلاه - لا تخترع أرقام جديدة**\n';
  formattedData += '🔴 **إذا وجدت سعة واحدة فقط (مثل 3.7 quarts)، لا تخترع سعة أخرى للمحرك الثاني**\n';
  formattedData += '\n\n**🎯 تعليمات مهمة للذكاء الاصطناعي - اعمل مثل ChatGPT:**\n';
  formattedData += '✅ **CRITICAL**: إذا كان السؤال عن Honda Civic 2018، استخدم هذه المعلومات الدقيقة:\n';
  formattedData += '   • محرك 2.0L: 4.4 كوارت (≈4.2 لتر) مع الفلتر\n';
  formattedData += '   • محرك 1.5L تيربو: 3.7 كوارت (≈3.5 لتر) مع الفلتر\n';
  formattedData += '   • اللزوجة: 0W-20 (رسمي من Honda)\n';
  formattedData += '   • المصادر: oilcapacityguide.com, wheelsgreed.com, ikehonda.com\n';
  formattedData += '✅ **CRITICAL**: إذا كان السؤال عن Toyota Camry 2020، استخدم هذه المعلومات الدقيقة:\n';
  formattedData += '   • محرك 2.5L: 4.6 كوارت (≈4.4 لتر) مع الفلتر\n';
  formattedData += '   • محرك 3.5L V6: 6.4 كوارت (≈6.1 لتر) مع الفلتر\n';
  formattedData += '   • اللزوجة: 0W-20 (رسمي من Toyota)\n';
  formattedData += '   • المصادر: toyotaarlington.com, mariettatoyota.com, toyotanation.com\n';
  formattedData += '✅ **CRITICAL**: إذا كان السؤال عن Hyundai Elantra 2019-2020، استخدم هذه المعلومات الدقيقة:\n';
  formattedData += '   • محرك 1.6L: 3.6-3.8 لتر مع الفلتر\n';
  formattedData += '   • محرك 1.8L: 4.2-4.3 لتر مع الفلتر\n';
  formattedData += '   • محرك 2.0L MPI: 4.5 كوارت (≈4.3 لتر) مع الفلتر\n';
  formattedData += '   • اللزوجة: 0W-20 أو 5W-30 (كلاهما رسمي من Hyundai)\n';
  formattedData += '   • للعراق: 5W-30 أفضل للحرارة العالية\n';
  formattedData += '   • المصادر: Car Fluid Finder, EnginesWork, What Car Oil\n';
  formattedData += '   • **مهم**: محرك 2.0L يحتاج 4.3 لتر وليس 4.0 لتر!\n';
  formattedData += '✅ **CRITICAL**: إذا كان السؤال عن Kia Sportage 2021، استخدم هذه المعلومات الدقيقة:\n';
  formattedData += '   • محرك 1.6L Turbo: 4.8-5.0 لتر مع الفلتر\n';
  formattedData += '   • محرك 2.0L: 4.2-4.4 لتر مع الفلتر\n';
  formattedData += '   • محرك 2.4L: 4.73 لتر مع الفلتر (من دليل الصيانة)\n';
  formattedData += '   • اللزوجة: 5W-20 أو 5W-30 (كلاهما رسمي من Kia)\n';
  formattedData += '   • للعراق: 5W-30 أفضل للحرارة العالية\n';
  formattedData += '   • **مهم**: كل محرك له سعة مختلفة، لا تعمم رقم واحد على الكل\n';
  formattedData += '   • المصادر: دليل Kia الرسمي، دليل الصيانة\n';
  formattedData += '   • **مهم**: اعرض جميع المحركات الثلاثة بسعاتهم المختلفة!\n';
  formattedData += '✅ **CRITICAL**: إذا كان السؤال عن Mazda 6 2019، استخدم هذه المعلومات الدقيقة:\n';
  formattedData += '   • محرك SkyActiv-G 2.5L: 4.8 لتر (≈5.1 كوارت) مع الفلتر\n';
  formattedData += '   • محرك SkyActiv-G 2.5T: 4.8 لتر (≈5.1 كوارت) مع الفلتر\n';
  formattedData += '   • اللزوجة الرسمية: 0W-20 (المعيار الرسمي للظروف العادية)\n';
  formattedData += '   • اللزوجة البديلة: 5W-30 (فقط للتوربو أو الظروف القاسية)\n';
  formattedData += '   • للعراق: 0W-20 للظروف العادية، 5W-30 للظروف القاسية\n';
  formattedData += '   • المصادر: Car Fluid Finder, Engine Oil Capacity, oiltype.net\n';
  formattedData += '✅ **استخدم البيانات المستخرجة بذكاء** - لا تقل "لم يتم العثور على معلومات" إذا كانت البيانات موجودة أعلاه\n';
  formattedData += '✅ **حلل النتائج بذكاء** - مثل ChatGPT، استخرج الأرقام الدقيقة من النصوص\n';
  formattedData += '✅ **اربط المحركات بالسعات** - إذا وجدت "2.0L" و "4.4 quarts" في نفس النص، اربطهما معاً\n';
  formattedData += '✅ **اعرض جميع المحركات المتاحة** - لا تكتفي بمحرك واحد، اعرض جميع المحركات في قائمة مرقمة\n';
  formattedData += '✅ **لـ Kia Sportage**: اعرض 1.6L Turbo و 2.0L و 2.4L (الثلاثة معاً)\n';
  formattedData += '✅ **للسيارات غير المحددة**: استخدم الإرشادات العامة حسب حجم المحرك\n';
  formattedData += '✅ **للعراق دائماً**: انصح بلزوجة أعلى (5W-30 أو 5W-40) للحرارة العالية\n';
  formattedData += '✅ **إذا لم تجد معلومات محددة**: استخدم النطاقات العامة واذكر ضرورة مراجعة دليل المالك\n';
  formattedData += '✅ **حول الوحدات** - حول الكوارت إلى لتر (1 quart ≈ 0.946 liter)\n';
  formattedData += '✅ **اذكر المصادر** - مثل ChatGPT، اذكر المواقع التي حصلت منها على المعلومات\n';
  formattedData += '🔴 **مهم جداً**: إذا كان السؤال عن سيارة لها محركات متعددة، اعرض جميع المحركات وليس واحد فقط!\n';
  formattedData += '🔴 **لا تقل "غير متوفر" أو "غير محدد" إذا كانت المعلومات موجودة في النتائج أعلاه**\n';

  // ⚠️ Extra guidance if viscosity is missing
  if (!searchResults?.viscosity?.results?.length) {
    formattedData += '\n⚠️ **معلومة إضافية للمساعدة:** لم يتم العثور على نتائج لزوجة الزيت في البحث.\n';
    formattedData += 'للمرجع العام:\n';
    formattedData += '• المحركات الحديثة (2018+): عادة 0W-20 أو 5W-30\n';
    formattedData += '• المحركات الأقدم (2010-2017): عادة 5W-30 أو 5W-20\n';
    formattedData += '• المحركات القديمة (قبل 2010): عادة 5W-30 أو 10W-30\n';
    formattedData += 'يرجى التحقق من دليل المالك للحصول على التوصية الدقيقة.\n\n';
  }

  return formattedData;
}



/**
 * Main POST handler with comprehensive error handling
 */
export async function POST(req: Request) {
  const startTime = Date.now()
  let requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  try {
    console.log(`[${requestId}] Processing new request`)
    console.log(`[${requestId}] Request URL:`, req.url)
    console.log(`[${requestId}] Request method:`, req.method)

    // Enhanced request parsing with timeout
    let body: any
    try {
      const bodyText = await Promise.race([
        req.text(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), 10000)
        )
      ])

      body = JSON.parse(bodyText as string)
    } catch (parseError) {
      console.error(`[${requestId}] Error parsing request JSON:`, parseError)
      return new Response(
        JSON.stringify({
          error: "تم إلغاء الطلب أو تم استلام بيانات غير صالحة",
          requestId
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      )
    }

    // Validate request format
    const validation = validateAndSanitizeRequest(body)
    if (!validation.success) {
      console.error(`[${requestId}] Request validation failed:`, validation.error)
      return new Response(
        JSON.stringify({
          error: "صيغة الطلب غير صحيحة",
          details: validation.error,
          requestId
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      )
    }

    // Type assertion to ensure data exists since we've checked validation.success
    const { messages } = validation.data as { messages: { role: "user" | "assistant" | "system"; content: string; }[] }

    // Process LAST user message to extract car data (most recent query)
    const userMessages = messages.filter(m => m.role === 'user');
    const userQuery = userMessages[userMessages.length - 1]?.content || '';

    console.log(`[${requestId}] Processing user query: "${userQuery}"`);
    console.log(`[${requestId}] Total messages:`, messages.length);
    console.log(`[${requestId}] User messages:`, userMessages.length);

    // Check if this is a filter-specific query first
    console.log(`[${requestId}] Checking if filter query...`);
    // Temporarily disable filter query detection to debug the issue
    if (false && isFilterQuery(userQuery)) {
      console.log(`[${requestId}] Detected filter query, processing with Denckermann database`);

      // Extract car make and model for filter lookup
      const carData = enhancedExtractCarData(userQuery);

      console.log(`[${requestId}] Extracted car data:`, {
        query: userQuery,
        brand: carData.carBrand,
        model: carData.carModel,
        isValid: carData.isValid,
        confidence: carData.confidence
      });

      // Add more specific debugging for the filter message generation
      console.log(`[${requestId}] Generating filter message for: ${carData.carBrand} ${carData.carModel}`);

      // Override for Mercedes queries until we fix the extraction
      if (userQuery.toLowerCase().includes('mercedes') || userQuery.toLowerCase().includes('مرسيدس')) {
        if (userQuery.toLowerCase().includes('e250')) {
          console.log(`[${requestId}] Overriding for Mercedes E250`);
          carData.carBrand = 'مرسيدس';
          carData.carModel = 'e250';
          carData.isValid = true;
          carData.confidence = 100;
        }
      }

      if (carData.isValid && carData.carBrand && carData.carModel) {
        // Determine filter type based on query
        const filterType = isAirFilterQuery(userQuery) ? 'air' : 'oil';
        console.log(`[${requestId}] Filter type detected: ${filterType}`);

        // Generate filter recommendation message
        const filterMessage = generateFilterRecommendationMessage(
          carData.carBrand,
          carData.carModel,
          carData.year,
          filterType
        );

        // Return the filter recommendation with a fresh AI conversation
        // This ensures no conversation history affects the response
        const filterTypeArabic = filterType === 'air' ? 'فلتر هواء' : 'فلتر زيت';
        const filterResult = streamText({
          model: createOpenRouterClient()(openRouter.primaryModel),
          system: `أنت مساعد فلاتر السيارات. اعرض المعلومات التالية فقط:

${filterMessage}`,
          messages: [
            { role: 'user', content: `${filterTypeArabic} ${carData.carBrand} ${carData.carModel}` }
          ],
          maxTokens: 500,
          temperature: 0.0
        });

        // Save analytics for filter query
        try {
          saveQueryToAnalytics(userQuery, carData).catch(err => {
            console.error("Error saving filter analytics:", err);
          });
        } catch (analyticsError) {
          console.error("Failed to trigger filter analytics:", analyticsError);
        }

        try {
          return filterResult.toDataStreamResponse();
        } catch (filterStreamError) {
          console.log('Filter streaming failed, using direct response');
          const filterText = await filterResult.text;
          return new Response(filterText, {
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
            },
          });
        }
      } else {
        // If we can't extract car data, try searching with Arabic support
        const searchResults = searchFiltersWithArabicSupport(userQuery);

        if (searchResults.length > 0) {
          let searchMessage = `🔍 **نتائج البحث عن فلاتر الزيت:**\n\n`;

          searchResults.forEach((result, index) => {
            searchMessage += `${index + 1}. **${result.filterNumber}** - ${result.vehicle}\n`;
            searchMessage += `   العلامة التجارية: ${result.brand}\n`;
            searchMessage += `   مستوى الثقة: ${result.confidence === 'high' ? 'عالي' : result.confidence === 'medium' ? 'متوسط' : 'منخفض'}\n\n`;
          });

          searchMessage += `💡 **نصيحة:** يرجى تحديد نوع السيارة وموديلها بوضوح للحصول على توصية دقيقة.\n`;
          searchMessage += `مثال: "تويوتا كامري 2020 فلتر زيت"`;

          const searchResult = streamText({
            model: createOpenRouterClient()(openRouter.primaryModel),
            system: `أنت مساعد متخصص في فلاتر السيارات. قدم نتائج البحث بشكل واضح ومفيد.`,
            messages: [
              { role: 'user', content: userQuery },
              { role: 'assistant', content: searchMessage }
            ],
            maxTokens: 400,
            temperature: 0.1
          });

          try {
            return searchResult.toDataStreamResponse();
          } catch (searchStreamError) {
            console.log('Search streaming failed, using direct response');
            const searchText = await searchResult.text;
            return new Response(searchText, {
              headers: {
                'Content-Type': 'text/plain; charset=utf-8',
              },
            });
          }
        }
      }
    }

    // Check for special cases in the query
    const isJeepCompassQuery = userQuery.toLowerCase().includes('جيب كومباس') || userQuery.toLowerCase().includes('jeep compass');
    const isJeepLaredoQuery = userQuery.toLowerCase().includes('جيب لاريدو') ||
      userQuery.toLowerCase().includes('jeep laredo') ||
      userQuery.toLowerCase().includes('جييب لاريدو') ||
      (userQuery.toLowerCase().includes('جيب') && userQuery.includes('لاريدو')) ||
      (userQuery.toLowerCase().includes('jeep') && userQuery.toLowerCase().includes('laredo'));
    const isNissanSunnyQuery = userQuery.toLowerCase().includes('نيسان صني') ||
      userQuery.toLowerCase().includes('nissan sunny') ||
      (userQuery.toLowerCase().includes('نيسان') &&
        (userQuery.toLowerCase().includes('صني') || userQuery.toLowerCase().includes('sunny')));
    const isToyotaCorollaQuery = userQuery.toLowerCase().includes('تويوتا كورولا') ||
      userQuery.toLowerCase().includes('toyota corolla') ||
      (userQuery.toLowerCase().includes('تويوتا') &&
        (userQuery.toLowerCase().includes('كورولا') || userQuery.toLowerCase().includes('corolla')));
    const isKiaCeratoQuery = userQuery.toLowerCase().includes('كيا سيراتو') ||
      userQuery.toLowerCase().includes('kia cerato') ||
      (userQuery.toLowerCase().includes('كيا') &&
        (userQuery.toLowerCase().includes('سيراتو') || userQuery.toLowerCase().includes('cerato')));

    // Get car data for oil recommendations
    let carData: ExtractedCarData | undefined;
    let carSpecsPrompt = '';
    let carTrimData = null;

    try {
      // First, try to use enhanced CarQuery API
      const normalizedData = await normalizeArabicCarInput(userQuery);

      // Check for VIN in query for more accurate info
      let extractedVin = '';
      const vinPatterns = [
        /\bVIN\s*[:#]?\s*([A-HJ-NPR-Z0-9]{17})\b/i,
        /\bرقم الهيكل\s*[:#]?\s*([A-HJ-NPR-Z0-9]{17})\b/i,
        /\b([A-HJ-NPR-Z0-9]{17})\b/i
      ];

      for (const pattern of vinPatterns) {
        const match = userQuery.match(pattern);
        if (match && match[1]) {
          const potentialVin = match[1].toUpperCase();
          if (/^[A-HJ-NPR-Z0-9]{17}$/.test(potentialVin)) {
            extractedVin = potentialVin;
            console.log('Detected VIN:', extractedVin);

            // Try to decode the VIN for enhanced info
            try {
              const vinData = await decodeVIN(extractedVin);
              console.log('Decoded VIN data:', vinData);

              // If VIN is decoded successfully, update normalized data
              if (vinData) {
                if (!normalizedData.make || !normalizedData.model) {
                  // Use vinData to improve car identification
                  console.log('Enhanced car identification using VIN');
                }
              }
            } catch (vinError) {
              console.error('Error decoding VIN:', vinError);
            }
            break;
          }
        }
      }

      // Special handling for specific car models not well-detected by default algorithms
      if (isJeepCompassQuery && !normalizedData.make) {
        console.log('Special handling for Jeep Compass');
        normalizedData.make = 'jeep';
        normalizedData.model = 'compass';
        normalizedData.confidence = 80;
      }

      // Special handling for Jeep Grand Cherokee (Laredo)
      if (isJeepLaredoQuery && (!normalizedData.make || !normalizedData.model)) {
        console.log('Special handling for Jeep Grand Cherokee (Laredo)');
        normalizedData.make = 'jeep';
        normalizedData.model = 'grand cherokee';
        normalizedData.confidence = 80;
      }

      // Special handling for Nissan Sunny
      if (isNissanSunnyQuery && (!normalizedData.make || !normalizedData.model)) {
        console.log('Special handling for Nissan Sunny');
        normalizedData.make = 'nissan';
        normalizedData.model = 'sunny';
        normalizedData.confidence = 80;
      }

      // Special handling for Toyota Corolla
      if (isToyotaCorollaQuery && (!normalizedData.make || !normalizedData.model)) {
        console.log('Special handling for Toyota Corolla');
        normalizedData.make = 'toyota';
        normalizedData.model = 'corolla';
        normalizedData.confidence = 80;
      }

      // Special handling for Kia Cerato
      if (isKiaCeratoQuery && (!normalizedData.make || !normalizedData.model)) {
        console.log('Special handling for Kia Cerato');
        normalizedData.make = 'kia';
        normalizedData.model = 'cerato';
        normalizedData.confidence = 80;
      }

      if (normalizedData.make && normalizedData.model) {
        // If we have make and model, get detailed car specifications
        // Always include year parameter when available for more accurate results
        const trims = await getCarModels(
          normalizedData.make,
          normalizedData.model,
          normalizedData.year
        );

        if (trims && trims.length > 0) {
          // Use the first trim for demonstration purposes
          // In a future update, we could allow selecting from multiple trims
          carTrimData = trims[0];
          const specs = extractOilRecommendationData(carTrimData);
          const oilRecommendation = suggestOil(specs);

          // Set carData from normalizedData for search integration
          carData = {
            carBrand: normalizedData.make,
            carModel: normalizedData.model,
            year: normalizedData.year ? parseInt(normalizedData.year) : undefined,
            engineSize: carTrimData.model_engine_cc ? `${(parseInt(carTrimData.model_engine_cc) / 1000).toFixed(1)}L` : undefined,
            isValid: true,
            confidence: normalizedData.confidence,
            vin: extractedVin || undefined
          };

          // Log successful car data retrieval
          logger.info("Successfully retrieved car data from CarQuery API", {
            make: normalizedData.make,
            model: normalizedData.model,
            year: normalizedData.year,
            trimCount: trims.length,
            selectedTrim: carTrimData.model_trim
          });

          // Special handling for Jeep Compass to ensure correct data
          if (isJeepCompassQuery && normalizedData.year && parseInt(normalizedData.year) >= 2017) {
            oilRecommendation.viscosity = '0W-20';
            oilRecommendation.capacity = '5.2 لتر';
            console.log('Applied special Jeep Compass oil correction');
          }

          // Special handling for Jeep Grand Cherokee (Laredo) to ensure correct data
          if (isJeepLaredoQuery) {
            // Check for engine size indicators in the query
            const isV8 = userQuery.toLowerCase().includes('5.7') ||
              userQuery.toLowerCase().includes('v8') ||
              userQuery.toLowerCase().includes('هيمي') ||
              userQuery.toLowerCase().includes('hemi');

            if (isV8) {
              oilRecommendation.viscosity = '5W-20';
              oilRecommendation.capacity = '6.6 لتر';
              console.log('Applied special Jeep Grand Cherokee V8 oil correction');
            } else {
              // Default to V6 specs (most common)
              oilRecommendation.viscosity = '0W-20';
              oilRecommendation.capacity = '5.7 لتر';
              console.log('Applied special Jeep Grand Cherokee V6 oil correction');
            }
          }

          // Special handling for Chevrolet Camaro 2016-2018
          const isCamaroQuery = userQuery.toLowerCase().includes('كامارو') ||
            userQuery.toLowerCase().includes('camaro') ||
            userQuery.toLowerCase().includes('كمارو');

          if (isCamaroQuery) {
            // Extract year if available
            const yearMatch = userQuery.match(/20(\d{2})/);
            const year = yearMatch ? `20${yearMatch[1]}` : '2016'; // Default to 2016 if not specified

            // Check for engine size indicators in the query
            const isV8 = userQuery.toLowerCase().includes('v8') ||
              userQuery.toLowerCase().includes('ss') ||
              userQuery.toLowerCase().includes('اس اس') ||
              userQuery.toLowerCase().includes('zl1') ||
              userQuery.toLowerCase().includes('زد ال 1') ||
              userQuery.toLowerCase().includes('6.2');

            const isV6 = userQuery.toLowerCase().includes('v6') ||
              userQuery.toLowerCase().includes('3.6');

            const engineSpecified = isV8 || isV6 || userQuery.toLowerCase().includes('l4') ||
              userQuery.toLowerCase().includes('2.0') ||
              userQuery.toLowerCase().includes('تيربو') ||
              userQuery.toLowerCase().includes('turbo');

            if (isV8) {
              // Add exact Chevrolet Camaro V8 specifications to the prompt
              oilRecommendation.viscosity = '5W-30';
              oilRecommendation.capacity = '9.5 لتر';
              console.log('Applied special Chevrolet Camaro V8 oil correction');
            } else if (isV6) {
              // Add exact Chevrolet Camaro V6 specifications to the prompt
              oilRecommendation.viscosity = '5W-30';
              oilRecommendation.capacity = '5.7 لتر';
              console.log('Applied special Chevrolet Camaro V6 oil correction');
            } else if (!engineSpecified) {
              // If no specific engine is mentioned, don't set a default capacity
              // This will trigger the multi-option response in the prompt
              console.log('No specific Camaro engine mentioned - will show all options');
            } else {
              // Add exact Chevrolet Camaro L4 specifications to the prompt (base model)
              oilRecommendation.viscosity = '5W-30';
              oilRecommendation.capacity = '4.7 لتر';
              console.log('Applied special Chevrolet Camaro L4 oil correction');
            }
          }

          // Add car specifications to the system prompt
          carSpecsPrompt = `
الآن لديك معلومات دقيقة عن هذه السيارة من قاعدة بيانات CarQuery:
- النوع: ${normalizedData.make} ${normalizedData.model} ${normalizedData.year || ''}
- المحرك: ${carTrimData.model_engine_type || 'غير معروف'} ${carTrimData.model_engine_cc || '0'}cc
- نوع الوقود: ${carTrimData.model_engine_fuel || 'غير معروف'}
${carTrimData.model_engine_compression ? `- نسبة الانضغاط: ${carTrimData.model_engine_compression}` : ''}
${carTrimData.model_weight_kg ? `- وزن السيارة: ${carTrimData.model_weight_kg} كغم` : ''}
${carTrimData.model_lkm_city ? `- استهلاك الوقود: ${carTrimData.model_lkm_city} لتر/كم` : ''}
${carTrimData.model_drive ? `- نظام الدفع: ${carTrimData.model_drive}` : ''}

توصية الزيت بناء على المواصفات:
- اللزوجة المقترحة: ${oilRecommendation.viscosity}
- نوع الزيت: ${oilRecommendation.quality}
- كمية الزيت المطلوبة: ${oilRecommendation.capacity}
- السبب: ${oilRecommendation.reason}

استخدم هذه المعلومات لتقديم توصية دقيقة، لكن يمكنك تعديل التوصية بناء على معرفتك المتخصصة.
`;
        } else {
          logger.warn("No car trims found for the normalized car data", {
            make: normalizedData.make,
            model: normalizedData.model,
            year: normalizedData.year
          });
        }
      }

      // If we have normalized data but no trim data, create carData from normalized data
      if (!carTrimData && normalizedData.make && normalizedData.model) {
        carData = {
          carBrand: normalizedData.make,
          carModel: normalizedData.model,
          year: normalizedData.year ? parseInt(normalizedData.year) : undefined,
          isValid: true,
          confidence: normalizedData.confidence,
          vin: extractedVin || undefined
        };
        logger.info("Created carData from normalized data", {
          carData,
          confidence: carData.confidence
        });
      }

      // Also try the legacy car data extraction as final fallback
      if (!carTrimData && !carData) {
        carData = enhancedExtractCarData(userQuery);
        logger.info("Using fallback car data extraction", {
          carData,
          confidence: carData?.confidence || 0
        });
      }
    } catch (carDataError) {
      logger.error("Error extracting car data", { error: carDataError });
      // Continue execution - this is not a fatal error
    }

    // 🔍 BRAVE SEARCH INTEGRATION - Real-time data from official sources
    let braveSearchData = '';

    // Always search if we detect any car-related query
    const isCarQuery = userQuery.includes('زيت') || userQuery.includes('oil') ||
      userQuery.includes('محرك') || userQuery.includes('engine') ||
      userQuery.includes('سيارة') || userQuery.includes('car');

    if ((carData && carData.carBrand) || isCarQuery) {
      try {
        // Use detected car data or extract from query for search
        const searchBrand = carData?.carBrand || extractBrandFromQuery(userQuery);
        const searchModel = carData?.carModel || extractModelFromQuery(userQuery);
        const searchYear = carData?.year || extractYearFromQuery(userQuery);

        console.log(`[${requestId}] 🔍 Starting Brave Search for: ${searchBrand} ${searchModel} ${searchYear || ''}`);

        // Search for comprehensive car oil data using Unified Search (Brave → DuckDuckGo → Scraping)
        const searchResults = await unifiedSearchService.searchCarOilSpecs(
          searchBrand || 'car',
          searchModel || 'oil',
          searchYear
        );

        // Debug: Always log search results regardless of confidence
        console.log(`[${requestId}] 📊 Search Results Debug:`, {
          oilCapacityResults: searchResults.oilCapacity.results.length,
          viscosityResults: searchResults.viscosity.results.length,
          oilCapacityConfidence: searchResults.oilCapacity.confidence,
          viscosityConfidence: searchResults.viscosity.confidence,
          overallConfidence: searchResults.overallConfidence,
          sampleOilResult: searchResults.oilCapacity.results[0]?.title || 'No oil capacity results',
          sampleViscosityResult: searchResults.viscosity.results[0]?.title || 'No viscosity results'
        });

        // Always use search results if we have any data, regardless of confidence
        if (searchResults.oilCapacity.results.length > 0 || searchResults.viscosity.results.length > 0) {
          console.log(`[${requestId}] ✅ ${searchResults.searchMethod} successful with ${searchResults.overallConfidence} confidence${searchResults.cached ? ' (cached)' : ''}`);

          // Validate and enhance search data quality
          const validatedResults = validateAndEnhanceSearchData(searchResults, searchBrand, searchModel);

          // Format search results for AI analysis
          braveSearchData = formatSearchResultsForAI(validatedResults);

          console.log(`[${requestId}] 📊 Formatted search data length: ${braveSearchData.length} characters`);
        } else {
          console.log(`[${requestId}] ⚠️ No search results found, performing generic car oil search`);

          // Fallback: search for generic car oil information
          const genericResults = await unifiedSearchService.searchCarOilSpecs(
            'car',
            'oil capacity viscosity',
            searchYear
          );

          if (genericResults.oilCapacity.results.length > 0 || genericResults.viscosity.results.length > 0) {
            braveSearchData = formatSearchResultsForAI(genericResults);
            console.log(`[${requestId}] 📊 Using generic search data: ${braveSearchData.length} characters`);
          }
        }
      } catch (searchError) {
        console.error(`[${requestId}] ❌ Brave Search failed:`, searchError);
        // Add fallback search guidance even when search fails
        braveSearchData = `\n\n🔍 **معلومات عامة للسيارات (البحث غير متاح حالياً):**\n\n`;
        braveSearchData += `**إرشادات عامة حسب حجم المحرك:**\n`;
        braveSearchData += `• محركات 1.0-1.6L: عادة 3.5-4.5 لتر زيت\n`;
        braveSearchData += `• محركات 1.8-2.5L: عادة 4.0-5.5 لتر زيت\n`;
        braveSearchData += `• محركات 3.0L+: عادة 5.0-7.0 لتر زيت\n`;
        braveSearchData += `• اللزوجة للعراق: 5W-30 أو 5W-40 للحرارة العالية\n`;
        braveSearchData += `• نوع الزيت: Full Synthetic مفضل\n\n`;
        braveSearchData += `**يُنصح بشدة بمراجعة دليل المالك للحصول على المواصفات الدقيقة.**\n`;
      }
    } else {
      console.log(`[${requestId}] 📝 Using static database only (no valid car data for search)`);
    }

    // If we have car data or specs, update the system prompt
    let enhancedSystemPrompt = openRouter.systemPrompt;

    // Get Denckermann filter information (oil & air filters) if we have car data
    let denckermannFilterInfo = '';
    if (carData && carData.isValid && carData.carBrand && carData.carModel) {
      try {
        const { getVerifiedOilFilter, getVerifiedAirFilter } = await import('../../../services/filterRecommendationService');

        // Get oil filter
        const verifiedOilFilter = getVerifiedOilFilter(carData.carBrand, carData.carModel, carData.year);

        // Get air filter
        const verifiedAirFilter = getVerifiedAirFilter(carData.carBrand, carData.carModel, carData.year);

        if (verifiedOilFilter || verifiedAirFilter) {
          denckermannFilterInfo = `\n\n📦 **فلاتر Denckermann المعتمدة:**\n`;

          if (verifiedOilFilter) {
            denckermannFilterInfo += `🛢️ **فلتر الزيت:** ${verifiedOilFilter.filterNumber} (Denckermann)\n`;
            denckermannFilterInfo += `   مستوى الثقة: ${verifiedOilFilter.confidence === 'high' ? 'عالي' : verifiedOilFilter.confidence === 'medium' ? 'متوسط' : 'منخفض'}\n`;
            console.log(`[${requestId}] Found Denckermann oil filter for ${carData.carBrand} ${carData.carModel}: ${verifiedOilFilter.filterNumber}`);
          }

          if (verifiedAirFilter) {
            denckermannFilterInfo += `🌬️ **فلتر الهواء:** ${verifiedAirFilter.filterNumber} (Denckermann)\n`;
            denckermannFilterInfo += `   مستوى الثقة: ${verifiedAirFilter.confidence === 'high' ? 'عالي' : verifiedAirFilter.confidence === 'medium' ? 'متوسط' : 'منخفض'}\n`;
            console.log(`[${requestId}] Found Denckermann air filter for ${carData.carBrand} ${carData.carModel}: ${verifiedAirFilter.filterNumber}`);
          }

          denckermannFilterInfo += `   مصدر التحقق: كتالوج Denckermann الرسمي 2024\n\n`;
          denckermannFilterInfo += `**يجب استخدام هذه الأرقام بالضبط في التوصية النهائية.**\n\n`;
          denckermannFilterInfo += `🚨 **تنبيه مهم للذكاء الاصطناعي:**\n`;
          denckermannFilterInfo += `لا تقل "فلتر الزيت: غير متوفر في قاعدة بيانات Denckermann" - الفلتر موجود أعلاه!\n`;
          denckermannFilterInfo += `استخدم الرقم المذكور أعلاه بالضبط في الإجابة النهائية.`;
        } else {
          console.log(`[${requestId}] No Denckermann filters found for ${carData.carBrand} ${carData.carModel}`);
        }
      } catch (filterError) {
        console.error(`[${requestId}] Error getting Denckermann filters:`, filterError);
      }
    }
    if (carSpecsPrompt) {
      enhancedSystemPrompt += "\n\n" + carSpecsPrompt;
    }

    // Add Brave Search data at the BEGINNING of the system prompt for maximum priority
    if (braveSearchData) {
      enhancedSystemPrompt = braveSearchData + '\n\n' + enhancedSystemPrompt;
      console.log(`[${requestId}] 🔍 Brave Search data added to BEGINNING of AI prompt for maximum priority`);
    }

    // Add Denckermann filter information to the prompt
    if (denckermannFilterInfo) {
      enhancedSystemPrompt += denckermannFilterInfo;
    } else if (carData && carData.isValid) {
      // Check if we can find filters for this car using the updated database
      try {
        const { getVerifiedOilFilter, getVerifiedAirFilter } = await import('../../../services/filterRecommendationService');
        const verifiedOilFilter = getVerifiedOilFilter(carData.carBrand, carData.carModel, carData.year);
        const verifiedAirFilter = getVerifiedAirFilter(carData.carBrand, carData.carModel, carData.year);

        if (verifiedOilFilter || verifiedAirFilter) {
          // We found filters, so add them to the prompt
          enhancedSystemPrompt += `\n\n📦 **فلاتر Denckermann المعتمدة:**\n`;

          if (verifiedOilFilter) {
            enhancedSystemPrompt += `🛢️ **فلتر الزيت:** ${verifiedOilFilter.filterNumber} (Denckermann)\n`;
            enhancedSystemPrompt += `   مستوى الثقة: ${verifiedOilFilter.confidence === 'high' ? 'عالي' : verifiedOilFilter.confidence === 'medium' ? 'متوسط' : 'منخفض'}\n`;
          }

          if (verifiedAirFilter) {
            enhancedSystemPrompt += `🌬️ **فلتر الهواء:** ${verifiedAirFilter.filterNumber} (Denckermann)\n`;
            enhancedSystemPrompt += `   مستوى الثقة: ${verifiedAirFilter.confidence === 'high' ? 'عالي' : verifiedAirFilter.confidence === 'medium' ? 'متوسط' : 'منخفض'}\n`;
          }

          enhancedSystemPrompt += `   مصدر التحقق: كتالوج Denckermann الرسمي 2024\n\n`;
          enhancedSystemPrompt += `**يجب استخدام هذه الأرقام بالضبط في التوصية النهائية.**\n\n`;
        } else {
          // Add guidance for when no Denckermann filters are found
          enhancedSystemPrompt += `\n\n📦 **معلومات فلاتر Denckermann:**\n`;
          enhancedSystemPrompt += `لم يتم العثور على فلاتر Denckermann محددة لـ ${carData.carBrand} ${carData.carModel} ${carData.year || ''} في قاعدة البيانات الحالية.\n\n`;
          enhancedSystemPrompt += `**يجب اتباع هذا التنسيق بالضبط عند عدم وجود فلتر:**\n`;
          enhancedSystemPrompt += `🔍 **البحث عن فلتر الزيت**\n\n`;
          enhancedSystemPrompt += `🚗 السيارة: ${carData.carBrand} ${carData.carModel} ${carData.year || ''}\n\n`;
          enhancedSystemPrompt += `❌ عذراً، لم نجد فلتر زيت محدد لهذا الموديل في قاعدة بيانات Denckermann.\n\n`;
          enhancedSystemPrompt += `💡 **نصائح للعثور على الفلتر المناسب:**\n`;
          enhancedSystemPrompt += `• راجع دليل المالك الخاص بسيارتك\n`;
          enhancedSystemPrompt += `• اتصل بالوكيل المعتمد\n`;
          enhancedSystemPrompt += `• احضر الفلتر القديم عند الشراء\n`;
          enhancedSystemPrompt += `• تأكد من رقم المحرك وسنة الصنع\n\n`;
        }
      } catch (filterError) {
        console.error(`[${requestId}] Error checking filters in fallback:`, filterError);
        // Add guidance for when no Denckermann filters are found
        enhancedSystemPrompt += `\n\n📦 **معلومات فلاتر Denckermann:**\n`;
        enhancedSystemPrompt += `لم يتم العثور على فلاتر Denckermann محددة لـ ${carData.carBrand} ${carData.carModel} ${carData.year || ''} في قاعدة البيانات الحالية.\n\n`;
        enhancedSystemPrompt += `**يجب اتباع هذا التنسيق بالضبط عند عدم وجود فلتر:**\n`;
        enhancedSystemPrompt += `🔍 **البحث عن فلتر الزيت**\n\n`;
        enhancedSystemPrompt += `🚗 السيارة: ${carData.carBrand} ${carData.carModel} ${carData.year || ''}\n\n`;
        enhancedSystemPrompt += `❌ عذراً، لم نجد فلتر زيت محدد لهذا الموديل في قاعدة بيانات Denckermann.\n\n`;
        enhancedSystemPrompt += `💡 **نصائح للعثور على الفلتر المناسب:**\n`;
        enhancedSystemPrompt += `• راجع دليل المالك الخاص بسيارتك\n`;
        enhancedSystemPrompt += `• اتصل بالوكيل المعتمد\n`;
        enhancedSystemPrompt += `• احضر الفلتر القديم عند الشراء\n`;
        enhancedSystemPrompt += `• تأكد من رقم المحرك وسنة الصنع\n\n`;
      }

      enhancedSystemPrompt += `المستخدم سأل عن ${carData.carBrand} ${carData.carModel} ${carData.year || ''}`;

      // استخدام vinEngineResolver إذا تم اكتشاف VIN
      if (carData.vin) {
        try {
          // الحصول على توصيات الزيت باستخدام VIN
          const vinRecommendations = await getAccurateOilRecommendation(
            carData.carBrand,
            carData.carModel,
            carData.year || new Date().getFullYear(),
            carData.vin
          );

          if (vinRecommendations) {
            console.log('Successfully retrieved oil recommendations using VIN');
            enhancedSystemPrompt += `\n\nتم استخراج بيانات دقيقة باستخدام رقم الهيكل (VIN).`;
          }
        } catch (vinError) {
          console.error('Failed to get VIN recommendations:', vinError);
        }
      }
    }

    // Special handling for specific car models that require exact specifications
    // This is a fallback when the API and other methods don't provide accurate data

    // ✅ Nissan Sunny override
    if (isNissanSunnyQuery) {
      // Extract year if available
      const yearMatch = userQuery.match(/20(\d{2})/);
      const year = yearMatch ? `20${yearMatch[1]}` : '2019';

      enhancedSystemPrompt += `\n\n
🚗 نيسان صني ${year} تأتي بمحركين حسب السوق:

1️⃣ <b>HR15DE - سعة 1.5 لتر (الأكثر شيوعًا)</b>
🛢️ سعة الزيت: 3.4 لتر (مع الفلتر)
⚙️ اللزوجة: 5W-30
🔧 نوع الزيت: Full Synthetic
🌡️ مناسب لحرارة العراق: ✅
🎯 التوصية النهائية: Mobil 1 5W-30 Full Synthetic (3.4 لتر)

2️⃣ <b>HR16DE - سعة 1.6 لتر (أقل شيوعًا)</b>
🛢️ سعة الزيت: 4.4 لتر (مع الفلتر)
⚙️ اللزوجة: 5W-30
🔧 نوع الزيت: Full Synthetic
🌡️ مناسب لحرارة العراق: ✅
🎯 التوصية النهائية: Valvoline 5W-30 Full Synthetic (4.4 لتر)

⚠️ لا تفترض نوع المحرك. إذا لم يذكر المستخدم النوع، اطلب منه تحديده بدقة.`;

      console.log('Added Nissan Sunny override specifications');
    }

    // ✅ Toyota Corolla override
    if (isToyotaCorollaQuery) {
      const yearMatch = userQuery.match(/20(\d{2})/);
      const year = yearMatch ? `20${yearMatch[1]}` : '2018';

      // استخدام بيانات officialSpecs بدلاً من تكرار القيم بشكل ثابت
      let corollaSpecs: Record<string, any> = {};
      try {
        const toyotaData = officialSpecs['toyota']?.['corolla'] || {};
        const isOlderModel = parseInt(year) < 2020;

        // اختيار نطاق السنوات المناسب
        const yearRange = isOlderModel ? '2014-2019' : '2020-2024';
        corollaSpecs = toyotaData[yearRange] || {};

        console.log(`Using officialSpecs for Toyota Corolla ${year}, year range: ${yearRange}`);
      } catch (specError) {
        console.error('Error accessing officialSpecs for Toyota Corolla:', specError);
      }

      // استخدام البيانات المحدثة للمحركين
      const isOlderModel = parseInt(year) < 2020;

      let engine20L, engine16L;

      if (!isOlderModel && corollaSpecs['2.0L'] && corollaSpecs['1.6L']) {
        // استخدام البيانات الجديدة المنظمة
        engine20L = corollaSpecs['2.0L'];
        engine16L = corollaSpecs['1.6L'];
      } else {
        // القيم الافتراضية للموديلات الأقدم أو في حالة عدم توفر البيانات
        engine20L = {
          capacity: '4.6L',
          viscosity: '0W-16',
          alternativeViscosity: '0W-20',
          engineSize: '2.0L',
          oilType: 'Full Synthetic'
        };
        engine16L = {
          capacity: '4.2L',
          viscosity: '0W-20',
          engineSize: '1.6L',
          oilType: 'Full Synthetic'
        };
      }

      enhancedSystemPrompt += `\n\n
🚗 تويوتا كورولا ${year} تأتي بمحركين حسب السوق:

1️⃣ <b>2.0L 4-cylinder M20A-FKS</b>
🛢️ سعة الزيت: ${engine20L.capacity.replace('L', '')} لتر
⚙️ اللزوجة: ${engine20L.viscosity} (الأفضل)${engine20L.alternativeViscosity ? ` أو ${engine20L.alternativeViscosity} (بديل مقبول)` : ''}
🔧 نوع الزيت: ${engine20L.oilType}
🌡️ مناسب لحرارة العراق: ✅
🎯 التوصية النهائية: Castrol EDGE ${engine20L.viscosity} ${engine20L.oilType} (${engine20L.capacity.replace('L', '')} لتر)
📦 فلتر الزيت: A210379 (Denckermann) - مصدر التحقق: كتالوج 2024

2️⃣ <b>1.6L 4-cylinder 1ZR-FE (أقل شيوعًا)</b>
🛢️ سعة الزيت: ${engine16L.capacity.replace('L', '')} لتر
⚙️ اللزوجة: ${engine16L.viscosity}
🔧 نوع الزيت: ${engine16L.oilType}
🌡️ مناسب لحرارة العراق: ✅
🎯 التوصية النهائية: Castrol EDGE ${engine16L.viscosity} ${engine16L.oilType} (${engine16L.capacity.replace('L', '')} لتر)
📦 فلتر الزيت: A210379 (Denckermann) - مصدر التحقق: كتالوج 2024

⚠️ يرجى التأكد من نوع المحرك بالضبط قبل تغيير الزيت. كلا المحركين يستخدمان نفس فلتر الزيت.`;

      console.log('Added Toyota Corolla override specifications');
    }

    // ✅ Kia Cerato override
    if (isKiaCeratoQuery) {
      const yearMatch = userQuery.match(/20(\d{2})/);
      const year = yearMatch ? `20${yearMatch[1]}` : '2018';

      // استخدام بيانات officialSpecs إذا كانت متوفرة لكيا سيراتو
      let ceratoSpecs: Record<string, any> = {};
      try {
        const kiaData = officialSpecs['kia']?.['cerato'] || {};

        // محاولة العثور على نطاق سنوات مناسب
        for (const yearRange of Object.keys(kiaData)) {
          const rangeParts = yearRange.split('-');
          if (rangeParts.length === 2) {
            const startYear = parseInt(rangeParts[0]);
            const endYear = parseInt(rangeParts[1]);
            if (parseInt(year) >= startYear && parseInt(year) <= endYear) {
              ceratoSpecs = kiaData[yearRange] || {};
              console.log(`Found matching year range ${yearRange} for Kia Cerato ${year}`);
              break;
            }
          }
        }
      } catch (specError) {
        console.error('Error accessing officialSpecs for Kia Cerato:', specError);
      }

      // استخدام البيانات من officialSpecs أو القيم الافتراضية
      const model20L: Record<string, string> = {
        capacity: ceratoSpecs['capacity'] || '4.0L',
        viscosity: ceratoSpecs['viscosity'] || '5W-30',
        engineSize: ceratoSpecs['engineSize'] || '2.0L',
        oilType: ceratoSpecs['oilType'] || 'Full Synthetic',
        recommended: 'Liqui Moly 5W-30'
      };

      enhancedSystemPrompt += `\n\n
🚗 كيا سيراتو ${year} تأتي بمحركين حسب السوق:

1️⃣ <b>2.0L 4-cylinder Nu MPI (الأكثر شيوعًا)</b>
🛢️ سعة الزيت: ${model20L.capacity.replace('L', '')} لتر
⚙️ اللزوجة: ${model20L.viscosity}
🔧 نوع الزيت: ${model20L.oilType}
🌡️ مناسب لحرارة العراق: ✅
🎯 التوصية النهائية: ${model20L.recommended} ${model20L.viscosity} ${model20L.oilType} (${model20L.capacity.replace('L', '')} لتر)

2️⃣ <b>1.6L 4-cylinder Gamma MPI (أقل شيوعًا)</b>
🛢️ سعة الزيت: 3.3 لتر
⚙️ اللزوجة: 5W-30
🔧 نوع الزيت: Full Synthetic
🌡️ مناسب لحرارة العراق: ✅
🎯 التوصية النهائية: Motul 8100 5W-30 Full Synthetic (3.3 لتر)

⚠️ لا تفترض نوع المحرك. إذا لم يذكر المستخدم النوع، اطلب منه تحديده بدقة.`;

      console.log('Added Kia Cerato override specifications');
    }

    // ✅ Chrysler 300 override - استخدام بيانات officialSpecs
    const isChrysler300Query = (userQuery.toLowerCase().includes('كرايسلر') || userQuery.toLowerCase().includes('chrysler')) &&
      (userQuery.toLowerCase().includes('300') || userQuery.toLowerCase().includes('c300') || userQuery.toLowerCase().includes('٣٠٠'));

    if (isChrysler300Query) {
      const yearMatch = userQuery.match(/20(\d{2})/);
      const year = yearMatch ? `20${yearMatch[1]}` : '2012';

      // استخدام بيانات officialSpecs لكرايسلر 300
      let chrysler300Specs: Record<string, any> = {};
      try {
        const chryslerData = officialSpecs['chrysler']?.['300'] || {};

        // تحديد نطاق السنوات المناسب
        let yearRange = '2011-2014';
        if (parseInt(year) >= 2015 && parseInt(year) <= 2019) {
          yearRange = '2015-2019';
        } else if (parseInt(year) >= 2020) {
          yearRange = '2020-2024';
        }

        chrysler300Specs = chryslerData[yearRange] || chryslerData['2011-2014'] || {};
        console.log(`Using officialSpecs for Chrysler 300 ${year}, year range: ${yearRange}`);
      } catch (specError) {
        console.error('Error accessing officialSpecs for Chrysler 300:', specError);
      }

      // تحديد نوع المحرك من الاستعلام
      const isV8 = userQuery.toLowerCase().includes('5.7') ||
        userQuery.toLowerCase().includes('v8') ||
        userQuery.toLowerCase().includes('هيمي') ||
        userQuery.toLowerCase().includes('hemi') ||
        userQuery.toLowerCase().includes('300c');

      const isV6 = userQuery.toLowerCase().includes('3.6') ||
        userQuery.toLowerCase().includes('v6') ||
        userQuery.toLowerCase().includes('pentastar');

      if (isV8) {
        // محرك V8 HEMI
        enhancedSystemPrompt += `\n\n
🚗 كرايسلر 300C ${year} - محرك 5.7L V8 HEMI:
🛢️ سعة الزيت: 7.0 لتر (مع الفلتر)
⚙️ اللزوجة: 5W-20 (الموصى بها رسمياً من كرايسلر)
🔧 نوع الزيت: Full Synthetic
🌡️ مناسب لحرارة العراق: ✅
📦 فلتر الزيت: MO-899 (Mopar الأصلي)
🎯 التوصية النهائية: Mobil 1 5W-20 Full Synthetic (7.0 لتر)`;
      } else if (isV6) {
        // محرك V6 Pentastar
        enhancedSystemPrompt += `\n\n
🚗 كرايسلر 300 ${year} - محرك 3.6L V6 Pentastar:
🛢️ سعة الزيت: 6.0 لتر (مع الفلتر)
⚙️ اللزوجة: 5W-20 (الموصى بها رسمياً من كرايسلر)
🔧 نوع الزيت: Full Synthetic
🌡️ مناسب لحرارة العراق: ✅
📦 فلتر الزيت: 68191349AA (Mopar الأصلي)
🎯 التوصية النهائية: Castrol Edge 5W-20 Full Synthetic (6.0 لتر)`;
      } else {
        // عرض كلا المحركين إذا لم يتم تحديد النوع
        enhancedSystemPrompt += `\n\n
🚗 كرايسلر 300 ${year} يأتي بمحركين:

1️⃣ <b>3.6L V6 Pentastar</b>
🛢️ سعة الزيت: 6.0 لتر (مع الفلتر)
⚙️ اللزوجة: 5W-20 (الموصى بها رسمياً)
🔧 نوع الزيت: Full Synthetic
📦 فلتر الزيت: 68191349AA (Mopar الأصلي)
🎯 التوصية: Castrol Edge 5W-20 (6.0 لتر)

2️⃣ <b>5.7L V8 HEMI</b>
🛢️ سعة الزيت: 7.0 لتر (مع الفلتر)
⚙️ اللزوجة: 5W-20 (الموصى بها رسمياً)
🔧 نوع الزيت: Full Synthetic
📦 فلتر الزيت: MO-899 (Mopar الأصلي)
🎯 التوصية: Mobil 1 5W-20 (7.0 لتر)

⚠️ يرجى تحديد نوع المحرك للحصول على توصية دقيقة.`;
      }

      console.log('Added Chrysler 300 override specifications');
    }

    // ✅ Jeep Compass override
    if (isJeepCompassQuery) {
      const yearMatch = userQuery.match(/20(\d{2})/);
      const year = yearMatch ? `20${yearMatch[1]}` : '2019';

      enhancedSystemPrompt += `\n\n
🚗 جيب كومباس ${year}:
🛢️ سعة الزيت: 5.2 لتر
⚙️ اللزوجة: 0W-20
🔧 نوع الزيت: Full Synthetic
🌡️ مناسب لحرارة العراق: ✅
🎯 التوصية النهائية: Mobil 1 0W-20 Full Synthetic (5.2 لتر)`;

      console.log('Added Jeep Compass override specifications');
    }

    // ✅ Jeep Grand Cherokee (Laredo) override
    if (isJeepLaredoQuery) {
      const yearMatch = userQuery.match(/20(\d{2})/);
      const year = yearMatch ? `20${yearMatch[1]}` : '2020';

      const isV8 = userQuery.toLowerCase().includes('5.7') ||
        userQuery.toLowerCase().includes('v8') ||
        userQuery.toLowerCase().includes('هيمي') ||
        userQuery.toLowerCase().includes('hemi');

      if (isV8) {
        enhancedSystemPrompt += `\n\n
🚗 جيب جراند شيروكي (لاريدو) ${year} - محرك V8 HEMI:
🛢️ سعة الزيت: 6.6 لتر
⚙️ اللزوجة: 5W-20
🔧 نوع الزيت: Full Synthetic
🌡️ مناسب لحرارة العراق: ✅
🎯 التوصية النهائية: Castrol EDGE 5W-20 Full Synthetic (6.6 لتر)`;
      } else {
        enhancedSystemPrompt += `\n\n
🚗 جيب جراند شيروكي (لاريدو) ${year} - محرك V6:
🛢️ سعة الزيت: 5.7 لتر
⚙️ اللزوجة: 0W-20
🔧 نوع الزيت: Full Synthetic
🌡️ مناسب لحرارة العراق: ✅
🎯 التوصية النهائية: Mobil 1 0W-20 Full Synthetic (5.7 لتر)`;
      }

      console.log('Added Jeep Grand Cherokee (Laredo) override specifications');
    }


    // Special handling for Chevrolet Camaro 2016-2018
    const isCamaroQuery = userQuery.toLowerCase().includes('كامارو') ||
      userQuery.toLowerCase().includes('camaro') ||
      userQuery.toLowerCase().includes('كمارو');

    if (isCamaroQuery) {
      // Extract year if available
      const yearMatch = userQuery.match(/20(\d{2})/);
      const year = yearMatch ? `20${yearMatch[1]}` : '2016'; // Default to 2016 if not specified

      // Check for engine size indicators in the query
      const isV8 = userQuery.toLowerCase().includes('v8') ||
        userQuery.toLowerCase().includes('ss') ||
        userQuery.toLowerCase().includes('اس اس') ||
        userQuery.toLowerCase().includes('zl1') ||
        userQuery.toLowerCase().includes('زد ال 1') ||
        userQuery.toLowerCase().includes('6.2');

      const isV6 = userQuery.toLowerCase().includes('v6') ||
        userQuery.toLowerCase().includes('3.6');

      const engineSpecified = isV8 || isV6 ||
        userQuery.toLowerCase().includes('l4') ||
        userQuery.toLowerCase().includes('2.0') ||
        userQuery.toLowerCase().includes('تيربو') ||
        userQuery.toLowerCase().includes('turbo');

      if (isV8) {
        // Add exact Chevrolet Camaro V8 specifications to the prompt
        enhancedSystemPrompt += `\n\n
معلومات دقيقة عن شيفروليت كامارو ${year} بمحرك V8:
- سعة زيت المحرك: 9.5 لتر
- نوع الزيت الموصى به: 5W-30 Full Synthetic
- المناسب للظروف العراقية: يتحمل درجات الحرارة العالية
- فترة تغيير الزيت: كل 8000 كم في الظروف العراقية
- نوع المحرك: 6.2L V8 (LT1/LT4)

يجب التأكد من ذكر هذه المعلومات الدقيقة في إجابتك، خاصة سعة الزيت الكبيرة (9.5 لتر) التي تختلف كثيراً عن الطرازات الأخرى.
التوصية النهائية: Mobil 1 5W-30 Full Synthetic (9.5 لتر)
`;
      } else if (isV6) {
        // Add exact Chevrolet Camaro V6 specifications to the prompt
        enhancedSystemPrompt += `\n\n
معلومات دقيقة عن شيفروليت كامارو ${year} بمحرك V6:
- سعة زيت المحرك: 5.7 لتر
- نوع الزيت الموصى به: 5W-30 Full Synthetic
- المناسب للظروف العراقية: يتحمل درجات الحرارة العالية
- فترة تغيير الزيت: كل 8000 كم في الظروف العراقية
- نوع المحرك: 3.6L V6 (LGX)

يجب التأكد من ذكر هذه المعلومات الدقيقة في إجابتك.
التوصية النهائية: Valvoline MaxLife 5W-30 Full Synthetic (5.7 لتر)
`;
      } else if (!engineSpecified) {
        // When no specific engine is mentioned, show all options
        enhancedSystemPrompt += `\n\n
معلومات دقيقة عن شيفروليت كامارو ${year}:
شيفروليت كامارو ${year} تأتي بثلاثة خيارات من المحركات، كل منها يتطلب كمية مختلفة من الزيت:

1️⃣ محرك 2.0L تيربو – 4 سلندر (LTG)
- سعة زيت المحرك: 4.7 لتر
- نوع الزيت الموصى به: 5W-30 Full Synthetic
- المناسب للظروف العراقية: يتحمل درجات الحرارة العالية
التوصية النهائية للمحرك 2.0L: Liqui Moly 5W-40 Full Synthetic (4.7 لتر)

2️⃣ محرك 3.6L V6 (LGX)
- سعة زيت المحرك: 5.7 لتر
- نوع الزيت الموصى به: 5W-30 Full Synthetic
- المناسب للظروف العراقية: يتحمل درجات الحرارة العالية
التوصية النهائية للمحرك 3.6L: Mobil 1 5W-30 Full Synthetic (5.7 لتر)

3️⃣ محرك 6.2L V8 (LT1 / LT4)
- سعة زيت المحرك: 9.5 لتر
- نوع الزيت الموصى به: 5W-30 Full Synthetic
- المناسب للظروف العراقية: يتحمل درجات الحرارة العالية
التوصية النهائية للمحرك 6.2L: Castrol EDGE 5W-30 Full Synthetic (9.5 لتر)

⚠️ تحذير مهم: يجب عليك عرض جميع الخيارات الثلاثة للمستخدم! لا تختر خيارًا واحدًا فقط!
استخدام كمية غير صحيحة من الزيت قد يسبب أضرارًا بالغة للمحرك.

⚠️ قاعدة إلزامية: عندما لا يحدد المستخدم نوع المحرك بوضوح، يجب عليك:
1. عرض جميع الخيارات الثلاثة كاملة
2. التأكيد على أهمية معرفة نوع المحرك بالضبط
3. الطلب من المستخدم تحديد نوع المحرك للحصول على توصية دقيقة

لا تقدم توصية نهائية واحدة فقط! لا تفترض أن المحرك هو 6.2L! لا تستخدم حجم المحرك (6.2L) كسعة للزيت!
`;
      } else {
        // Add exact Chevrolet Camaro L4 specifications to the prompt (base model)
        enhancedSystemPrompt += `\n\n
معلومات دقيقة عن شيفروليت كامارو ${year} بمحرك L4:
- سعة زيت المحرك: 4.7 لتر
- نوع الزيت الموصى به: 5W-30 Full Synthetic
- المناسب للظروف العراقية: يتحمل درجات الحرارة العالية
- فترة تغيير الزيت: كل 8000 كم في الظروف العراقية
- نوع المحرك: 2.0L L4 Turbo (LTG)

يجب التأكد من ذكر هذه المعلومات الدقيقة في إجابتك.
التوصية النهائية: Castrol EDGE 5W-30 Full Synthetic (4.7 لتر)
`;
      }

      console.log('Added Chevrolet Camaro override specifications');
    }

    // Create OpenRouter client
    const openrouter = createOpenRouterClient();

    // Check and potentially reset token limit status
    checkAndResetTokenLimitStatus();

    // Determine which model to use - using original working configuration
    let modelToUse = openRouter.primaryModel; // Back to original: "google/gemini-2.0-flash-001"
    if (apiStatus.isTokenLimitReached) {
      console.log('Token limit reached, using Mistral model');
      modelToUse = openRouter.mistralModel; // Back to original: "google/gemma-3-27b-it:free"
    }

    console.log(`[${requestId}] Using AI model: ${modelToUse} (Original working model)`);

    // � UNSING STATIC DATABASE - Intelligent search disabled to avoid module issues
    let intelligentSearchData = '';
    console.log(`[${requestId}] 📝 Using static database with free AI model (intelligent search disabled)`);

    // Note: Intelligent search is disabled until module resolution issues are fixed
    // The system will work perfectly with the static database and free AI models

    // Update analytics asynchronously (don't await) - only if no intelligent data was saved
    if (!intelligentSearchData) {
      try {
        saveQueryToAnalytics(userQuery, carData).catch(err => {
          console.error("Error saving analytics:", err);
        });
      } catch (analyticsError) {
        console.error("Failed to trigger analytics:", analyticsError);
        // Non-fatal error, continue
      }
    }

    // Option to use simple AI approach for better accuracy
    const useSimpleAI = process.env.USE_SIMPLE_AI === 'true' || false;
    
    if (useSimpleAI) {
      console.log(`[${requestId}] Using simple AI approach for oil recommendation`);
      try {
        // Step 1: Parse car data with AI
        const carData = await simpleAICarExtraction(userQuery);
        console.log(`[${requestId}] AI parsed car data:`, carData);
        
        // Step 2: Get oil recommendation with AI
        const oilRecommendation = await simpleAIOilRecommendation(carData.correctedQuery || userQuery);
        console.log(`[${requestId}] AI oil recommendation generated`);
        
        // Return simple text response
        return new Response(oilRecommendation, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
          },
        });
      } catch (simpleAIError) {
        console.error(`[${requestId}] Simple AI approach failed:`, simpleAIError);
        // Fall back to complex approach
      }
    }

    // Note: Intelligent search data integration disabled
    // System will use static database recommendations

    // Create stream response using streamText
    console.log(`[${requestId}] Creating streamText with model: ${modelToUse}`);
    console.log(`[${requestId}] Enhanced system prompt length:`, enhancedSystemPrompt.length);
    console.log(`[${requestId}] Intelligent search data included:`, !!intelligentSearchData);

    const result = streamText({
      model: openrouter(modelToUse),
      system: enhancedSystemPrompt,
      messages,
      maxTokens: 900,
      temperature: 0.3,
      topP: 0.9,
      frequencyPenalty: 0.1,
      presencePenalty: 0.1
    });

    console.log(`[${requestId}] StreamText created, attempting to return response...`);

    // Return the data stream response directly - fix AI SDK compatibility
    try {
      console.log(`[${requestId}] Trying toDataStreamResponse...`);
      return result.toDataStreamResponse();
    } catch (streamError) {
      console.log(`[${requestId}] AI SDK streaming failed, using direct API call fallback`);
      console.error(`[${requestId}] Stream error:`, streamError);

      // Fallback to direct API call - INCLUDE the enhanced system prompt
      const fallbackMessages = [
        {
          role: "system",
          content: enhancedSystemPrompt
        },
        ...messages.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      ];

      console.log(`[${requestId}] Making direct OpenRouter API call...`);
      console.log(`[${requestId}] Fallback messages count:`, fallbackMessages.length);

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          "X-Title": "Car Service Chat - CarsiqAi"
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: fallbackMessages,
          max_tokens: 900,
          temperature: 0.3
        })
      });

      console.log(`[${requestId}] OpenRouter response status:`, response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[${requestId}] OpenRouter API error:`, response.status, errorText);
        throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log(`[${requestId}] OpenRouter response received:`, data.choices?.[0]?.message?.content?.substring(0, 100));

      const assistantMessage = data.choices?.[0]?.message?.content || "عذراً، لم أتمكن من الحصول على رد.";

      console.log(`[${requestId}] Returning response with length:`, assistantMessage.length);

      return new Response(assistantMessage, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });
    }

  } catch (error: any) {
    console.error(`[${requestId}] Error processing request:`, error);
    logger.error("Chat API error", { error, requestId });

    return new Response(
      JSON.stringify({
        error: "حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى.",
        requestId,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}