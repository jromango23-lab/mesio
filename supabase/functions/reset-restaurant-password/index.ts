// supabase/functions/reset-restaurant-password/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.42.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  // Manejar la petición pre-vuelo (preflight) de CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. OBTENER DATOS Y VALIDAR ENTRADA
    const { user_id, new_password } = await req.json()
    if (!user_id || !new_password) {
      return new Response(JSON.stringify({ error: 'Se requiere user_id y new_password.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // 2. VALIDAR QUE EL LLAMANTE ES UN ADMINISTRADOR
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No se proporcionó cabecera de autenticación.')
    }
    // Crear un cliente con los permisos del usuario que hace la llamada
    const userSupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: userError } = await userSupabaseClient.auth.getUser()
    if (userError) throw userError
    
    const { data: admin, error: adminError } = await userSupabaseClient
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .single()

    if (adminError || !admin) {
      return new Response(JSON.stringify({ error: 'Usuario no autorizado para realizar esta acción.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    // 3. ACTUALIZAR CONTRASEÑA USANDO SERVICE_ROLE
    // Solo si la validación de admin es exitosa, usamos la service_role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user_id,
      { password: new_password }
    )

    if (updateError) {
      throw new Error(`Error al actualizar la contraseña: ${updateError.message}`)
    }

    // 4. RESPUESTA DE ÉXITO
    return new Response(JSON.stringify({ message: 'Contraseña actualizada correctamente.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (err) {
    console.error('Error inesperado en Edge Function reset-restaurant-password:', err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
