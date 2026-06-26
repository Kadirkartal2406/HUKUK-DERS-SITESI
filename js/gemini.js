/* js/gemini.js */

export function getApiKey() {
  return localStorage.getItem('gemini_api_key') || '';
}

export function setApiKey(key) {
  if (key) {
    localStorage.setItem('gemini_api_key', key.trim());
  } else {
    localStorage.removeItem('gemini_api_key');
  }
}

export function getApiModel() {
  let model = localStorage.getItem('gemini_api_model') || 'gemini-2.0-flash';
  if (model === 'gemini-1.5-flash' || model === 'gemini-1.5-flash-latest') {
    model = 'gemini-flash-latest';
  } else if (model === 'gemini-1.5-pro' || model === 'gemini-1.5-pro-latest') {
    model = 'gemini-pro-latest';
  }
  return model;
}

export function setApiModel(model) {
  if (model) {
    localStorage.setItem('gemini_api_model', model.trim());
  } else {
    localStorage.removeItem('gemini_api_model');
  }
}

export async function testApiKeyAndListModels(key) {
  if (!key) throw new Error('Önce bir API Anahtarı girin.');
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key.trim()}`;
  const response = await fetch(url);
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Bağlantı Hatası: ${response.status}`);
  }
  const data = await response.json();
  return data.models || [];
}

export function hasApiKey() {
  return !!getApiKey();
}

// All models in fallback order (preferred first, most reliable last)
const FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-flash-latest',
  'gemini-pro-latest',
  'gemini-3.5-flash',
];

function isQuotaOrDemandError(msg) {
  return (
    msg.includes('Quota exceeded') ||
    msg.includes('quota') ||
    msg.includes('limit: 0') ||
    msg.includes('billing') ||
    msg.includes('high demand') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('429')
  );
}

/**
 * Core single-model request (no fallback)
 */
async function callGeminiWithModel(modelName, contents, systemInstruction = '', jsonMode = false) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Lütfen önce sağ üst köşeden Gemini API Anahtarınızı girin.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const requestBody = {};

  if (systemInstruction) {
    requestBody.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  requestBody.contents = contents;

  if (jsonMode) {
    requestBody.generationConfig = {
      responseMimeType: 'application/json'
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const errMsg = errData.error?.message || `HTTP Hata: ${response.status}`;
    const err = new Error(errMsg);
    err.isQuota = isQuotaOrDemandError(errMsg);
    err.modelName = modelName;
    throw err;
  }

  const data = await response.json();
  const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!textResponse) {
    throw new Error('Yapay zekadan boş cevap döndü. API anahtarınızı veya girdiğiniz dökümanı kontrol edin.');
  }

  return textResponse;
}

/**
 * Common fetch wrapper with automatic model fallback on quota / high-demand errors
 */
async function callGemini(contents, systemInstruction = '', jsonMode = false) {
  // Build trial order: user's preferred model first, then fallbacks
  const preferred = getApiModel();
  const modelsToTry = [preferred, ...FALLBACK_MODELS.filter(m => m !== preferred)];

  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const result = await callGeminiWithModel(model, contents, systemInstruction, jsonMode);
      // If success with a fallback model, silently note it in console
      if (model !== preferred) {
        console.info(`[Gemini] Fallback başarılı: '${preferred}' yerine '${model}' kullanıldı.`);
      }
      return result;
    } catch (err) {
      lastError = err;
      if (err.isQuota) {
        // Quota / demand error → try next model
        console.warn(`[Gemini] Model '${model}' kota/yoğunluk hatası verdi, sıradaki model deneniyor...`);
        continue;
      }
      // Any other error (invalid key, bad payload, etc.) → stop immediately
      throw err;
    }
  }

  // All models exhausted
  throw new Error(
    `Tüm modeller kota veya yoğunluk hatası verdi.\n\n` +
    `Lütfen birkaç dakika bekleyip tekrar deneyin ya da farklı bir API anahtarı kullanın.\n\n` +
    `Son hata: ${lastError?.message || 'Bilinmiyor'}`
  );
}

/**
 * Smartly truncates text to maxLen by taking distributed samples
 * from the beginning, middle and end – giving the AI a balanced
 * view of the whole document rather than just the start.
 */
function smartTruncate(text, maxLen) {
  if (!text || text.length <= maxLen) return text || '';
  // Take 60% from start, 25% from middle, 15% from end
  const startLen  = Math.floor(maxLen * 0.60);
  const midLen    = Math.floor(maxLen * 0.25);
  const endLen    = maxLen - startLen - midLen;
  const midStart  = Math.floor((text.length - midLen) / 2);
  return (
    text.substring(0, startLen) +
    `\n\n[... dökümanın ortasından devam ...] \n\n` +
    text.substring(midStart, midStart + midLen) +
    `\n\n[... dökümanın sonundan devam ...] \n\n` +
    text.substring(text.length - endLen)
  );
}
/**
 * Generates quiz questions from provided text sources.
 * 
 * @param {string} sourceText The aggregated notes and PDF content.
 * @param {number} questionCount How many questions to generate (5, 10, 15).
 * @returns {Promise<Array>} Array of question objects.
 */
export async function generateQuizFromSources(sourceText, questionCount = 10) {
  const systemInstruction = `Sen Çukurova Hukuk Fakültesi düzeyinde hukuk sınavı hazırlayan profesyonel bir akademisyensin. 
Sana verilen kaynak ders notlarına ve dökümanlara dayanarak tamamen özgün, zorlayıcı ve öğretici ${questionCount} adet çoktan seçmeli hukuk sorusu hazırla.
Sorular kesinlikle verilen metne ve yasal mevzuata (Türk Kanunları, TBK, TMK, TCK vb.) dayanmalı, açıklamada ise ilgili kanun maddesi ve yasal gerekçe detaylıca belirtilmelidir.

ZORUNLU FORMAT (JSON):
JSON formatında bir liste döndürmelisin. Her bir soru objesi şu alanları içermelidir:
- "question": Soru metni
- "options": 4 adet şık içeren liste (A, B, C, D)
- "answerIndex": Doğru şıkkın indeksi (0-3 arası sayı: 0=A, 1=B, 2=C, 3=D)
- "explanation": Doğru cevabın yasal gerekçesi ve detaylı açıklaması.

Not: Metin dışında başka bir şey döndürme, direkt JSON listesini ver. Markdown blokları (\`\`\`json) içinde de gönderme, doğrudan ham JSON döndür.`;

  const prompt = `Aşağıdaki ders materyalini oku ve 4 seçenekli ${questionCount} adet test sorusu üret.

DERS MATERYALİ:
---
${smartTruncate(sourceText, 40000)}
---`;

  const contents = [
    {
      role: 'user',
      parts: [{ text: prompt }]
    }
  ];

  const jsonResponse = await callGemini(contents, systemInstruction, true);
  
  try {
    const cleaned = jsonResponse.trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('JSON parsing failed. Raw response:', jsonResponse);
    throw new Error('Yapay zeka geçerli bir sınav formatında yanıt üretemedi. Lütfen tekrar deneyin.');
  }
}

/**
 * Chat with Gemini using selected sources as grounding context (NotebookLM Simulation)
 * 
 * @param {Array} chatHistory Array of message objects {role: 'user'|'model', parts: [{text: string}]}
 * @param {string} sourceText The selected notes and PDF text
 * @returns {Promise<string>} Gemini response text.
 */
export async function chatWithSources(chatHistory, sourceText) {
  const systemInstruction = `Sen Neslihan'ın özel hukuk dersi çalışma asistanısın. 
Aşağıda sağlanan ders notları ve PDF dökümanları (KAYNAKLAR) senin birincil bilgi kaynağındır.
Gelen soruları bu kaynaklara sadık kalarak, akademik ve anlaşılır bir hukuk diliyle cevaplamalısın. 

KURALLAR:
1. Öncelikli olarak KAYNAKLAR kısmındaki bilgileri temel al.
2. Eğer sorulan soru kaynaklarda yer almıyorsa veya kaynaklar yetersizse, soruyu cevaplamak için kendi geniş Türk Hukuku bilgini (TMK, TBK, TCK vb. ilgili kanun maddelerini belirterek) kullanabilirsin. Ancak bunu yaparken "Bu bilgi sağladığınız kaynaklarda bulunmamaktadır, genel hukuk bilgisine göre açıklıyorum:" şeklinde tatlı bir uyarıyla Neslihan'a belirt.
3. Neslihan'a hitap ederken saygılı ama samimi ol (Örn: "Neslihan, Medeni Kanun madde 28'e göre...").
4. Cevapları okunabilir kılmak için başlıklar, kalın yazılar (bold) ve listeler kullan.

KAYNAKLAR:
---
${smartTruncate(sourceText, 60000)}
---`;

  // We should prepare the contents payload matching the history format
  // Gemini expect: [{role: "user", parts: [{text: "..."}]}, {role: "model", parts: [{text: "..."}]}]
  const contents = chatHistory.map(msg => ({
    role: msg.role === 'ai' ? 'model' : 'user',
    parts: [{ text: msg.text }]
  }));

  return await callGemini(contents, systemInstruction, false);
}

/**
 * Converts a questions-oriented PDF text to structured solvable JSON.
 * 
 * @param {string} pdfText Extracted text content from the questions PDF.
 * @returns {Promise<Array>} List of parsed question objects.
 */
export async function convertQuestionPdfToQuiz(pdfText) {
  const systemInstruction = `Sen profesyonel bir hukuk hocasısın. Sana verilen döküman, içerisinde çoktan seçmeli hukuk soruları barındıran bir sınav kağıdıdır.
Görevin, dökümandaki soruları ve şıklarını hiçbir şekilde bozmadan veya içeriğini değiştirmeden okumak ve bunları yapılandırılmış JSON formatına dönüştürmektir.

ÖNEMLİ KURALLAR:
1. Metindeki tüm soruları sırasıyla ayıkla. Soru metnini ve şıklarını dökümandaki haliyle aynen koru.
2. Doğru cevap dökümanda belirtilmişse (örn: "Cevap: A" veya "Doğru şık B şıkkıdır" gibi bir ibare varsa) o indeksi kullan.
3. Eğer dökümanda doğru cevap belirtilmemişse, soruyu hukuk bilgine göre kendin çöz ve doğru şıkkın indeksini (0-3 arası) belirle.
4. Her soru için yasal gerekçeleri (kanun maddesiyle birlikte) açıklayan detaylı bir açıklama (explanation) oluştur veya dökümandaki açıklamayı genişlet.

ZORUNLU FORMAT (JSON):
JSON formatında bir liste döndürmelisin. Her bir soru objesi şu alanları içermelidir:
- "question": Soru metni
- "options": 4 adet şık içeren liste (A, B, C, D)
- "answerIndex": Doğru şıkkın indeksi (0-3 arası sayı: 0=A, 1=B, 2=C, 3=D)
- "explanation": Doğru cevabın yasal gerekçesi ve detaylı açıklaması.

Not: Metin dışında başka bir şey döndürme, direkt JSON listesini ver. Markdown blokları (\`\`\`json) içinde de gönderme, doğrudan ham JSON döndür.`;

  const prompt = `Aşağıdaki sınav dökümanını oku, soruları çöz/ayıkla ve çoktan seçmeli interaktif bir test formatında JSON olarak döndür.

SINAV DÖKÜMANI:
---
${smartTruncate(pdfText, 60000)}
---`;

  const contents = [
    {
      role: 'user',
      parts: [{ text: prompt }]
    }
  ];

  const jsonResponse = await callGemini(contents, systemInstruction, true);
  
  try {
    const cleaned = jsonResponse.trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('JSON parsing failed. Raw response:', jsonResponse);
    throw new Error('Yapay zeka dökümandaki soruları interaktif formata dönüştüremedi. Lütfen dökümanın okunabilir soru şablonları içerdiğinden emin olun.');
  }
}
