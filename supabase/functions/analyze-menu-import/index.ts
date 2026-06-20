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
  const html = await response.text();
  
  // Limpieza básica de HTML
  let cleanText = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Eliminar scripts
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')   // Eliminar estilos
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
      
      return {
        name: pName,
        description,
        price
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
3. No inventes platos ni categorías que no aparezcan en el texto o documento provisto.
4. Responde ÚNICAMENTE con el objeto JSON válido que cumpla la estructura solicitada.

Estructura JSON requerida:
{
  "categories": [
    {
      "name": "Entradas",
      "items": [
        {
          "name": "Nombre del producto",
          "description": "Descripción opcional",
          "price": 4990
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
