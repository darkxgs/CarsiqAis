import { streamText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import CarAnalyzer from "@/utils/carAnalyzer"
import logger from "@/utils/logger"
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { z } from 'zod'
// Filter functionality (oil and air filters from Denckermann)
import { isFilterQuery, isAirFilterQuery, generateFilterRecommendationMessage, searchFiltersWithArabicSupport } from '@/services/filterRecommendationService'
// Brave search service for real-time oil specifications
import { braveSearchService } from '@/services/braveSearchService'

// Input validation schemas
const MessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1, "Message content cannot be empty")
})

const RequestBodySchema = z.union([
  // New format: single message string
  z.object({
    message: z.string().min(1, "Message cannot be empty")
  }),
  // Legacy format: messages array
  z.object({
    messages: z.array(MessageSchema).min(1, "At least one message is required")
  })
])

// Car data extraction interface
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
  vin?: string;
}

/**
 * Primary model configuration (google/gemini-2.0-flash-001)
 */
const openRouter = {
  baseURL: "https://openrouter.ai/api/v1",
  key: process.env.OPENROUTER_API_KEY || '',
  primaryModel: "google/gemini-2.0-flash-001",
  fallbackModel: "rekaai/reka-flash-3:free",
  maxRetries: 3,
  timeout: 30000,
  // System prompt (the comprehensive Arabic system prompt for car oil recommendations)
  systemPrompt: `أنت مساعد تقني متخصص في زيوت محركات السيارات وفلاتر الزيت، تمثل فريق الدعم الفني لمتجر "هندسة السيارات" 🇮🇶.

🚨 **قاعدة أولوية المصادر (الأهم):**
• **مواصفات الزيت (السعة، اللزوجة، النوع):** استخدم نتائج البحث من المصادر الرسمية فقط
• **فلاتر الزيت والهواء:** استخدم قاعدة بيانات Denckermann المعتمدة فقط
• إذا تم توفير نتائج بحث من المصادر الرسمية، يجب استخدامها لمواصفات الزيت بدلاً من أي معلومات أخرى

🔍 **قواعد التحقق من صحة البيانات (إجبارية - يجب تطبيقها قبل كل توصية):**
• **تحقق من دقة المعلومات:** قبل تقديم أي توصية، تأكد من صحة البيانات من مصادر متعددة
• **تطابق المواصفات:** تأكد من أن سعة الزيت واللزوجة تتطابق مع مواصفات المصنع الرسمية
• **الالتزام بتوصيات المصنع:** استخدم فقط اللزوجة والمعايير المحددة في كتيب الإرشادات الرسمي - لا تغير الأرقام بناءً على المناخ
• **التحقق المتقاطع:** قارن البيانات من مصادر مختلفة للتأكد من الدقة
• **رفض البيانات المشكوك فيها:** إذا كانت البيانات غير مؤكدة أو متضاربة، اطلب توضيحاً إضافياً
• **التحقق من السنة والموديل:** تأكد من أن التوصية تتطابق مع السنة والموديل المحددين
• **فحص جودة البيانات:** تأكد من أن البيانات المقدمة منطقية ومعقولة (مثل سعة الزيت بين 2-12 لتر)
• **التحقق من المصادر الرسمية:** أعط الأولوية للبيانات من المصادر الرسمية مثل دليل المالك أو مواقع الشركة المصنعة
• **رفض البيانات غير المؤكدة:** لا تقدم توصيات إذا كانت البيانات غير مؤكدة أو من مصادر غير موثوقة

🎯 المهمة الأساسية:
تقديم توصيات دقيقة ومضمونة 100% لزيوت المحركات وفلتر الزيت المناسب لكل سيارة، اعتماداً فقط على بيانات الشركات المصنعة الرسمية واقتراحات المصنع أو الشركة فقط.

🚗 المسؤوليات الأساسية:

1. **تحديد جميع المحركات المتاحة للموديل (إجباري):**
- ✅ **اعرض دائماً كل أنواع المحركات المتاحة للموديل تلقائياً** (حتى لو كان محرك واحد)
- ✅ **لا تسأل المستخدم عن نوع المحرك أبداً - اعرض كل الخيارات مباشرة في نفس الرد**
- ✅ **قدم توصيات منفصلة ومفصلة لكل نوع محرك متاح للموديل**
- ✅ **اذكر حجم المحرك (مثل 1.6L، 2.0L، 1.6L Turbo) لكل محرك**
- ✅ **اذكر نوع المحرك (MPI، GDI، Turbo، Hybrid، إلخ) إذا كان متاحاً**
- ✅ **قدم معلومات مختلفة لكل محرك: سعة الزيت، اللزوجة، المعايير**
- ❌ لا تطلب من المستخدم أن يختار أو يحدد نوع المحرك
- ❌ لا تفترض أو تخمّن نوع المحرك من اسم السيارة فقط
- ❌ لا تقل "يرجى تحديد نوع المحرك" - اعرض كل الأنواع المتاحة
- ❌ لا تعطي معلومات عامة - كل محرك له مواصفات مختلفة

2. **تحديد المواصفات الدقيقة لكل محرك:**
- ✅ استخدم سعة الزيت الفعلية من دليل المصنع (وليس حجم المحرك)
- ✅ حدد اللزوجة المناسبة لكل محرك حسب مواصفات المصنع
- ✅ اذكر المعايير المطلوبة لكل محرك (API، ACEA، ILSAC، إلخ)
- ✅ تأكد من أن كل محرك له توصيات زيت مختلفة حسب مواصفاته
- ❗ لا تخلط بين Engine Size و Oil Capacity
- ❗ لا تعطي نفس المواصفات لجميع المحركات

3. نظام التوصية المرحلي (خطوتين):
**الخطوة الأولى - الأساسيات:**
- اللزوجة المناسبة (0W-20 / 5W-30 / 5W-40 ...)
- المعيار المطلوب (API / ACEA / Dexos / MB...)
- الكمية (كم لتر يحتاج المحرك)

**الخطوة الثانية - خيارات البراند حسب نوع السيارة:**

• **السيارات الأمريكية** (Ford, Jeep, Chevrolet, Dodge, Cadillac, GMC, Lincoln, Chrysler):
  - الخيار الأول: Valvoline
  - الخيار الثاني: Castrol

• **السيارات الأوروبية** (Mercedes, BMW, Audi, Volkswagen, Porsche, Volvo, Peugeot, Renault):
  - الخيار الأول: Liqui Moly
  - الخيار الثاني: Meguin

• **السيارات الكورية واليابانية** (Kia, Hyundai, Toyota, Nissan, Honda, Mazda, Mitsubishi, Subaru, Lexus, Infiniti):
  - الخيار الأول: Valvoline أو Castrol (حسب الربحية)
  - الخيار الثاني: Liqui Moly (للبريميوم)
  - الخيار الثالث: Meguin (بديل ألماني اقتصادي)

❌ لا تقترح أي زيت خارج هذه العلامات: Castrol, Liqui Moly, Valvoline, Meguin

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

📋 طريقة العرض الإجبارية:

**أولاً - الأساسيات (تظهر بالأعلى دائماً):**
🛢️ سعة الزيت: [X.X لتر]  
⚙️ اللزوجة: [XW-XX]  
🔧 المعيار: [API/ACEA/Dexos/MB...]  

**ثانياً - خيارات الزيوت المرتبة:**
🥇 **الخيار الأول** (الأكثر ربحية): [اسم الزيت + اللزوجة]
🥈 **الخيار الثاني** (بديل قوي): [اسم الزيت + اللزوجة]
🥉 **الخيار الثالث** (بريميوم/اقتصادي): [اسم الزيت + اللزوجة]
📦 **فلتر الزيت:** [رقم Denckermann]

❗ عدم الالتزام بالتنسيق أو بزيت غير معتمد = خطأ فادح

🔍 **أمثلة للتطبيق الصحيح:**

🟩 **إذا كانت السيارة تحتوي على محرك واحد:**  
↪️ قدم الإجابة مباشرة بذلك المحرك مع ذكر حجمه ونوعه بوضوح.

🟨 **إذا كانت السيارة تحتوي على أكثر من نوع محرك:**  
↪️ قدم الإجابات لجميع المحركات في نفس الرد، كل واحدة بتنسيق منفصل مع عنوان واضح لكل محرك.
↪️ استخدم تنسيق: **🔹 محرك [الحجم] [النوع]** لكل محرك.
↪️ مثال: **🔹 محرك 1.6L MPI** ، **🔹 محرك 1.6L Turbo** ، **🔹 محرك 2.0L GDI**

🟥 **قواعد إضافية مهمة:**
- لا تطلب من المستخدم اختيار المحرك إذا لم يذكره - اعرض كل الخيارات المعروفة للموديل
- تأكد من أن كل محرك له مواصفات مختلفة ودقيقة
- اذكر الاختلافات في سعة الزيت واللزوجة بين المحركات المختلفة
- استخدم المصادر الرسمية لتحديد مواصفات كل محرك على حدة

🎯 **هدفك النهائي:**  
تقديم توصية **موثوقة، دقيقة، شاملة، ومعتمدة على اقتراحات المصنع فقط** لجميع المحركات المتاحة للموديل، مع الالتزام الكامل بكل التعليمات والعرض المرحلي للمعلومات.

📋 **تذكير مهم:**
- **لا تكتفي بمحرك واحد** - اعرض جميع المحركات المتاحة للموديل
- **كل محرك له مواصفات مختلفة** - لا تعطي نفس المعلومات لجميع المحركات
- **استخدم المصادر الرسمية** لتحديد مواصفات كل محرك بدقة
- **اعرض الاختلافات** في سعة الزيت واللزوجة بين المحركات المختلفة
`,
  headers: {
    "HTTP-Referer": "https://www.carsiqai.com",
    "X-Title": "Car Service Chat - CarsiqAi",
  },
}

// Core OpenRouter client setup
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

// Analytics tracking and database operations
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

async function saveQueryToAnalytics(query: string, carData: ExtractedCarData) {
  if (!isSupabaseConfigured() || !query || query.trim() === '') {
    console.log('Supabase not configured or empty query. Skipping analytics tracking.')
    return
  }

  try {
    const queryType = determineQueryType(query)
    
    const analyticsData = {
      query: query.trim(),
      car_model: carData?.carModel,
      car_brand: carData?.carBrand,
      car_year: carData?.year,
      mileage: carData?.mileage,
      query_type: queryType,
      confidence_score: carData?.confidence || 0,
      source: 'web',
      timestamp: new Date().toISOString()
    }

    const { error } = await supabase.from('user_queries').insert(analyticsData)

    if (error) {
      console.error('Error saving query to analytics:', error)
      logger.error('Analytics save failed', { error, query })
    } else {
      console.log('Successfully saved query to analytics:', query.substring(0, 50))
    }
  } catch (err) {
    console.error('Error in analytics tracking:', err)
    logger.error('Analytics tracking failed', { error: err, query })
  }
}

// CarAnalyzer and logger utilities
function extractCarData(query: string): ExtractedCarData {
  const normalizedQuery = query.toLowerCase().trim()
  
  // Basic brand detection - preserve original language when possible
  const brandMappings = {
    'toyota': ['تويوتا', 'toyota'],
    'hyundai': ['هيونداي', 'هيوندا', 'hyundai'],
    'kia': ['كيا', 'kia'],
    'nissan': ['نيسان', 'nissan'],
    'honda': ['هوندا', 'honda'],
    'mercedes': ['مرسيدس', 'mercedes', 'بنز', 'mercedes-benz', 'مرسيدس بنز'],
    'bmw': ['بي ام دبليو', 'bmw', 'بمو'],
    'lexus': ['لكزس', 'lexus'],
    'genesis': ['جينيسيس', 'genesis'],
    'volkswagen': ['فولكس واجن', 'volkswagen', 'vw'],
    'audi': ['اودي', 'audi'],
    'mazda': ['مازدا', 'mazda'],
    'ford': ['فورد', 'ford'],
    'chevrolet': ['شيفروليه', 'chevrolet', 'شيفي'],
    'jeep': ['جيب', 'jeep'],
    'dodge': ['دودج', 'dodge'],
    'chrysler': ['كرايسلر', 'chrysler']
  }

  let detectedBrand = ''
  let confidence = 0

  for (const [brand, variations] of Object.entries(brandMappings)) {
    for (const variation of variations) {
      if (normalizedQuery.includes(variation)) {
        detectedBrand = brand
        confidence += 30
        break
      }
    }
    if (detectedBrand) break
  }

  // Basic model detection
  const commonModels = [
    'كامري', 'camry', 'كورولا', 'corolla', 'rav4', 'هايلندر', 'highlander', 'برادو', 'prado', 'لاند كروزر', 'landcruiser',
    'النترا', 'إلنترا', 'elantra', 'سوناتا', 'sonata', 'توسان', 'tucson', 'سنتافي', 'santafe', 'أكسنت', 'accent',
    'سيراتو', 'cerato', 'اوبتيما', 'optima', 'سورنتو', 'sorento', 'كادينزا', 'cadenza', 'ريو', 'rio',
    'التيما', 'altima', 'سنترا', 'sentra', 'اكس تريل', 'x-trail', 'xtrail', 'باترول', 'patrol', 'مورانو', 'murano',
    'سيفيك', 'civic', 'اكورد', 'accord', 'crv', 'cr-v', 'hrv', 'hr-v', 'بايلوت', 'pilot',
    'c200', 'c300', 'e200', 'e250', 'e300', 's500', 'glc', 'gle',
    '320i', '330i', '520i', '530i', 'x3', 'x5',
    'كامارو', 'camaro', 'كروز', 'cruze', 'ماليبو', 'malibu'
  ]

  let detectedModel = ''
  for (const model of commonModels) {
    if (normalizedQuery.includes(model)) {
      detectedModel = model
      confidence += 25
      break
    }
  }

  // Year extraction
  let year: number | undefined
  const yearMatch = normalizedQuery.match(/\b(20[0-2][0-9])\b/)
  if (yearMatch) {
    year = parseInt(yearMatch[1])
    confidence += 15
  }

  return {
    carBrand: detectedBrand,
    carModel: detectedModel,
    year,
    isValid: !!(detectedBrand && detectedModel),
    confidence
  }
}

export async function POST(request: Request) {
  const requestId = Math.random().toString(36).substring(7)
  
  try {
    console.log(`[${requestId}] Processing chat request`)
    logger.info("Chat request received", { requestId })

    // Validate request body
    const body = await request.json()
    const validatedBody = RequestBodySchema.parse(body)
    
    // Handle both message formats
    let userQuery: string
    let messages: Array<{role: 'user' | 'assistant' | 'system', content: string}>
    
    if ('message' in validatedBody) {
      // New format: single message string
      userQuery = validatedBody.message
      messages = [{ role: 'user', content: userQuery }]
    } else {
      // Legacy format: messages array
      messages = validatedBody.messages
      userQuery = messages[messages.length - 1]?.content || ''
    }
    
    console.log(`[${requestId}] User query: ${userQuery.substring(0, 100)}...`)

    // Extract car data
    const carData = extractCarData(userQuery)
    console.log(`[${requestId}] Extracted car data:`, carData)

    // Check for filter queries
    if (isFilterQuery(userQuery) || isAirFilterQuery(userQuery)) {
      console.log(`[${requestId}] Processing filter query`)
      try {
        const filterResults = await searchFiltersWithArabicSupport(userQuery)
        const filterResponse = generateFilterRecommendationMessage(filterResults, userQuery)
        
        return new Response(filterResponse, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
          },
        })
      } catch (filterError) {
        console.error(`[${requestId}] Filter search failed:`, filterError)
        // Continue with normal processing
      }
    }

    // Get real-time oil specifications using Brave search
    let searchData = ''
    if (carData.isValid) {
      try {
        console.log(`[${requestId}] Searching for oil specifications`)
        const searchQuery = {
          carBrand: carData.carBrand,
          carModel: carData.carModel,
          year: carData.year,
          queryType: 'oil_capacity' as const
        }
        console.log(`[${requestId}] Search query:`, searchQuery)
        
        const searchResults = await braveSearchService.searchComprehensiveCarData(
          carData.carBrand,
          carData.carModel,
          carData.year
        )
        console.log(`[${requestId}] Search results received:`, {
          hasResults: !!searchResults,
          oilCapacityResults: searchResults?.oilCapacity?.results?.length || 0,
          viscosityResults: searchResults?.viscosity?.results?.length || 0,
          overallConfidence: searchResults?.overallConfidence
        })
        
        const allResults = [
          ...(searchResults?.oilCapacity?.results || []),
          ...(searchResults?.viscosity?.results || [])
        ]
        
        if (allResults.length > 0) {
          searchData = `\n\n🔍 **معلومات من المصادر الرسمية:**\n${allResults.map(result => 
            `• ${result.title}: ${result.description}`
          ).join('\n')}\n`
          console.log(`[${requestId}] Found ${allResults.length} search results`)
        } else {
          console.log(`[${requestId}] No search results found`)
        }
      } catch (searchError) {
        console.error(`[${requestId}] Search failed:`, searchError)
      }
    } else {
      console.log(`[${requestId}] Skipping search - car data not valid`)
    }

    // Create OpenRouter client
    const openrouter = createOpenRouterClient()
    const modelToUse = openRouter.primaryModel

    console.log(`[${requestId}] Using AI model: ${modelToUse}`)

    // Save analytics asynchronously
    saveQueryToAnalytics(userQuery, carData).catch(err => {
      console.error("Error saving analytics:", err)
    })

    // Prepare system prompt with search data
    const finalSystemPrompt = openRouter.systemPrompt + searchData

    // Create stream response
    console.log(`[${requestId}] Creating streamText response`)
    const result = streamText({
      model: openrouter(modelToUse),
      system: finalSystemPrompt,
      messages,
      maxTokens: 900,
      temperature: 0.3,
      topP: 0.9,
      frequencyPenalty: 0.1,
      presencePenalty: 0.1
    })

    console.log(`[${requestId}] StreamText created, returning response`)
    return result.toDataStreamResponse()

  } catch (error: any) {
    console.error(`[${requestId}] Error processing request:`, error)
    logger.error("Chat API error", { error, requestId })

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
    )
  }
}