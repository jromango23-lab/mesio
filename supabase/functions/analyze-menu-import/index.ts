// supabase/functions/analyze-menu-import/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.42.0'
import { corsHeaders } from '../_shared/cors.ts'

interface AnalyzeRequest {
  type: 'url' | 'pdf';
  menuUrl?: string;
  pdfData?: string; // base64
  fileName?: string;
}

const fetchAndCleanHtml = async (url: string): Promise<string> => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    }
  });
  if (!response.ok) {
    throw new Error(`Error al descargar la página del menú: ${response.status} ${response.statusText}`);
  }
  let html = await response.text();
  
  // 1. Eliminar scripts y estilos antes de procesar
  html = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Eliminar scripts
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');   // Eliminar estilos

  // 2. Procesar etiquetas de imagen <img>
  const imgRegex = /<img\b([^>]*)>/gi;
  html = html.replace(imgRegex, (match, attrs) => {
    // Extraer atributos src, alt, class e id
    const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
    const altMatch = attrs.match(/alt=["']([^"']*)["']/i);
    const classMatch = attrs.match(/class=["']([^"']*)["']/i);
    const idMatch = attrs.match(/id=["']([^"']*)["']/i);

    const src = srcMatch ? srcMatch[1].trim() : '';
    const alt = altMatch ? altMatch[1].trim() : '';
    const className = classMatch ? classMatch[1].trim() : '';
    const id = idMatch ? idMatch[1].trim() : '';

    if (!src) return '';
    // Ignorar base64 o data:image y blob:
    if (src.startsWith('data:') || src.startsWith('blob:')) return '';

    // Filtrar logos, banners, redes sociales, etc.
    const forbiddenKeywords = [
      'logo', 'banner', 'header', 'footer', 'nav', 'icon', 'social', 
      'facebook', 'instagram', 'whatsapp', 'twitter', 'sprite', 
      'placeholder', 'avatar', 'bg-', 'background', 'spacer',
      '16x16', '32x32', '64x64'
    ];

    const targetString = `${src} ${alt} ${className} ${id}`.toLowerCase();
    const shouldIgnore = forbiddenKeywords.some(kw => targetString.includes(kw));
    if (shouldIgnore) return '';

    try {
      const absoluteUrl = new URL(src, url).href;
      return ` ![imagen_plato: ${alt || 'producto'}](${absoluteUrl}) `;
    } catch {
      return '';
    }
  });

  // 3. Eliminar el resto de etiquetas HTML
  let cleanText = html
    .replace(/<[^>]+>/g, ' ')                                           // Eliminar etiquetas HTML
    .replace(/\s+/g, ' ')                                               // Normalizar espacios
    .trim();

  // Limitar longitud para evitar sobrepasar límites del modelo
  if (cleanText.length > 50000) {
    cleanText = cleanText.substring(0, 50000) + '... [Texto Truncado]';
  }
  return cleanText;
};

const normalizeResult = (data: any) => {
  if (!data || typeof data !== 'object') {
    throw new Error('La estructura del JSON analizado no es válida.');
  }
  
  const rawCategories = data.categories || data.Categories || [];
  if (!Array.isArray(rawCategories)) {
    throw new Error('Las categorías analizadas no son una lista válida.');
  }
  
  const normalizedCategories = rawCategories.map((cat: any) => {
    const name = String(cat.name || cat.Name || 'Sin Categoría').trim();
    const rawItems = cat.items || cat.Items || cat.products || cat.Products || [];
    
    const items = Array.isArray(rawItems) ? rawItems.map((item: any) => {
      const pName = String(item.name || item.Name || 'Producto sin nombre').trim();
      const description = String(item.description !== undefined && item.description !== null ? item.description : '').trim();
      
      let price = null;
      const rawPrice = item.price !== undefined ? item.price : item.Price;
      if (rawPrice !== null && rawPrice !== undefined && String(rawPrice).trim() !== '') {
        const num = Number(rawPrice);
        price = isNaN(num) ? null : num;
      }

      // Procesar campos de imagen
      let imageUrl = null;
      const rawImageUrl = item.image_url !== undefined ? item.image_url : item.imageUrl;
      if (typeof rawImageUrl === 'string' && rawImageUrl.trim() !== '') {
        imageUrl = rawImageUrl.trim();
      }

      const imageHint = String(item.image_hint !== undefined && item.image_hint !== null ? item.image_hint : '').trim();

      let imageConfidence = 'none';
      const rawConfidence = String(item.image_confidence !== undefined && item.image_confidence !== null ? item.image_confidence : '').trim().toLowerCase();
      if (['high', 'medium', 'low', 'none'].includes(rawConfidence)) {
        imageConfidence = rawConfidence;
      }
      
      return {
        name: pName,
        description,
        price,
        image_url: imageUrl,
        image_hint: imageHint,
        image_confidence: imageConfidence
      };
    }) : [];
    
    return {
      name,
      items
    };
  });
  
  return {
    categories: normalizedCategories
  };
};

serve(async (req) => {
  // Manejar preflight de CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. VALIDAR QUE EL LLAMANTE ES UN ADMINISTRADOR
    const authHeader = req.headers.get('Authorization')
    console.log('[Auth] Validando cabecera Authorization...');
    if (!authHeader) {
      console.log('[Auth] Error: No se recibió cabecera Authorization.');
      return new Response(JSON.stringify({ error: 'No se recibió token de autorización.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const userSupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    console.log('[Auth] Consultando auth.getUser()...');
    const { data: { user }, error: userError } = await userSupabaseClient.auth.getUser()
    if (userError || !user) {
      console.log('[Auth] Error al obtener usuario:', userError?.message || 'Usuario nulo');
      return new Response(JSON.stringify({ error: 'Token inválido o sesión expirada.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }
    
    console.log('[Auth] Usuario autenticado con ID:', user.id);

    console.log('[Auth] Consultando tabla public.admin_users...');
    const { data: admin, error: adminError } = await userSupabaseClient
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .single()

    if (adminError) {
      console.log('[Auth] Error al consultar admin_users:', adminError.message);
      return new Response(JSON.stringify({ error: 'Usuario no autorizado como administrador.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    if (!admin) {
      console.log('[Auth] Usuario no encontrado en admin_users.');
      return new Response(JSON.stringify({ error: 'Usuario no autorizado como administrador.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    console.log('[Auth] Usuario autorizado como administrador.');

    // 2. PARSEAR CUERPO DE PETICIÓN
    const { type, menuUrl, pdfData }: AnalyzeRequest = await req.json()
    if (!type || (type === 'url' && !menuUrl) || (type === 'pdf' && !pdfData)) {
      return new Response(JSON.stringify({ error: 'Faltan parámetros obligatorios en la petición.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // 3. OBTENER CLAVE API DE GEMINI
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) {
      return new Response(JSON.stringify({ error: 'La clave secreta GEMINI_API_KEY no está configurada en Supabase.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    // 4. PREPARAR CONTENIDOS PARA GEMINI
    const prompt = `Analiza el siguiente contenido extraído de una carta/menú de restaurante y estructúralo en un objeto JSON que contenga las categorías y los platos/productos identificados.
Sigue estas reglas estrictamente:
1. Divide el menú en categorías lógicas (ej: Entradas, Ensaladas, Platos Principales, Postres, Bebidas, etc.).
2. Para cada categoría, extrae la lista de productos con su nombre, descripción (si existe, de lo contrario deja "") y precio (si existe y es un número de valor monetario válido, de lo contrario usa null).
3. Para cada plato, analiza e intenta asociar una imagen de la siguiente manera:
   - Para URLs: Si encuentras una imagen en formato Markdown ![alt](url) cercana al nombre del plato o en el mismo bloque, colócala en "image_url". Si es de alta certeza que corresponde a ese plato, pon "image_confidence": "high". Si es de mediana certeza, pon "image_confidence": "medium". Si es de baja certeza, pon "image_confidence": "low". De lo contrario, pon "image_url": null e "image_confidence": "none".
   - Para PDFs: Como no hay URLs en el documento, pon siempre "image_url": null. Si ves una imagen visualmente ligada a un plato en el documento PDF, pon una breve descripción de lo que se ve en la imagen en "image_hint" (ej: "Hamburguesa con papas fritas") y define "image_confidence" ("high", "medium", "low" o "none").
   - Para "image_hint": Coloca una descripción de la imagen detectada si corresponde, de lo contrario deja "".
4. No inventes platos, categorías ni URLs de imágenes. Si no hay relación clara, "image_url" debe ser null e "image_confidence" debe ser "none".
5. Responde ÚNICAMENTE con el objeto JSON válido que cumpla la estructura solicitada.

Estructura JSON requerida:
{
  "categories": [
    {
      "name": "Entradas",
      "items": [
        {
          "name": "Nombre del producto",
          "description": "Descripción opcional",
          "price": 4990,
          "image_url": null,
          "image_hint": "",
          "image_confidence": "none"
        }
      ]
    }
  ]
}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
    let contents: any[] = [];

    if (type === 'url') {
      const cleanText = await fetchAndCleanHtml(menuUrl!);
      contents = [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { text: `Aquí está el texto extraído del sitio web para analizar:\n\n${cleanText}` }
          ]
        }
      ];
    } else {
      contents = [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: pdfData!
              }
            }
          ]
        }
      ];
    }

    // 5. INVOCAR API DE GEMINI
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          responseMimeType: 'application/json'
        }
      })
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      return new Response(JSON.stringify({ error: `Fallo en la comunicación con la IA: ${geminiResponse.status} - ${errorText}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 502,
      })
    }

    const geminiData = await geminiResponse.json();
    const textResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textResponse) {
      return new Response(JSON.stringify({ error: 'La IA no retornó ninguna respuesta válida para estructurar.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    // 6. NORMALIZAR Y RETORNAR RESULTADOS
    let parsedJson;
    try {
      parsedJson = JSON.parse(textResponse.trim());
    } catch (e) {
      console.error('Error parseando JSON de Gemini:', textResponse);
      return new Response(JSON.stringify({ error: 'La respuesta de la IA no se pudo estructurar correctamente en formato JSON.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    const cleanResult = normalizeResult(parsedJson);

    return new Response(JSON.stringify(cleanResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (err) {
    console.error('Error inesperado en Edge Function:', err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
