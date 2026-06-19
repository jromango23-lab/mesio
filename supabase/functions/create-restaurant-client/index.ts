// supabase/functions/create-restaurant-client/index.ts

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
    const { email, password, name, slug, plan } = await req.json()
    if (!email || !password || !name || !slug || !plan) {
      return new Response(JSON.stringify({ error: 'Faltan campos obligatorios.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }
    const allowedPlans = ['free', 'basic', 'pro'];
    if (!allowedPlans.includes(plan)) {
      return new Response(JSON.stringify({ error: 'El plan seleccionado no es válido.' }), {
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

    // 3. CREAR CLIENTE Y RESTAURANTE USANDO SERVICE_ROLE
    // Solo si la validación de admin es exitosa, usamos la service_role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    let newUserId = null;

    // Crear el usuario en Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Lo auto-confirmamos
    })

    if (authError) {
      if (authError.message.includes("User already registered")) {
        return new Response(JSON.stringify({ error: 'El email ya está en uso.' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      throw new Error(`Error creando usuario en Auth: ${authError.message}`);
    }
    
    newUserId = authData.user.id;

    // Crear el restaurante en la tabla public.restaurants
    const { error: dbError } = await supabaseAdmin
      .from('restaurants')
      .insert({
        user_id: newUserId,
        name: name,
        slug: slug,
        plan: plan,
        is_active: true,
        primary_color: '#2563eb',
      })

    // 4. ROLLBACK SI LA CREACIÓN DEL RESTAURANTE FALLA
    if (dbError) {
      // Intentar eliminar el usuario recién creado para no dejar cuentas huérfanas
      await supabaseAdmin.auth.admin.deleteUser(newUserId);

      if (dbError.code === '23505') { // Error de constraint de unicidad (ej. slug)
         return new Response(JSON.stringify({ error: 'El slug del restaurante ya existe.' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      throw new Error(`Error creando restaurante en DB: ${dbError.message}`);
    }

    // 5. RESPUESTA DE ÉXITO
    return new Response(JSON.stringify({ message: 'Cliente y restaurante creados con éxito.' }), {
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
