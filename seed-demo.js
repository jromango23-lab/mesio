import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Intentar leer .env.local de forma manual
const envPath = resolve(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

const envConfig = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envConfig[match[1].trim()] = match[2].trim();
  }
});

const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Faltan variables de Supabase en .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log('Iniciando proceso de seed para Demo Mesio...');

  // 1. Crear usuario de demo
  const email = 'demo@mesio.com';
  const password = 'password123';
  
  let user;
  
  console.log('Intentando registrar/iniciar sesión con demo@mesio.com...');
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (signUpError && signUpError.message.includes('already registered')) {
    console.log('El usuario ya existe, iniciando sesión...');
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) throw signInError;
    user = signInData.user;
  } else if (signUpError) {
    throw signUpError;
  } else {
    user = signUpData.user;
  }

  console.log('Usuario de demo listo:', user.id);

  // 2. Crear restaurante "Demo Mesio"
  console.log('Verificando restaurante Demo Mesio...');
  let restaurant;
  const { data: existingRest, error: existingRestError } = await supabase
    .from('restaurants')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (existingRest) {
    restaurant = existingRest;
    console.log('Restaurante ya existía:', restaurant.id);
  } else {
    const { data: newRest, error: newRestError } = await supabase
      .from('restaurants')
      .insert([
        { user_id: user.id, name: 'Demo Mesio', slug: 'demo-mesio' }
      ])
      .select()
      .single();
      
    if (newRestError) throw newRestError;
    restaurant = newRest;
    console.log('Restaurante creado:', restaurant.id);
  }

  // 3. Crear Categorías
  const categorias = ['Bebidas', 'Platos principales', 'Postres'];
  const catMap = {}; // name -> id

  console.log('Creando categorías...');
  for (let i = 0; i < categorias.length; i++) {
    const catName = categorias[i];
    
    // Check if exists
    const { data: existingCat } = await supabase
      .from('categories')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .eq('name', catName)
      .single();

    if (existingCat) {
      catMap[catName] = existingCat.id;
    } else {
      const { data: newCat, error: catError } = await supabase
        .from('categories')
        .insert([{ restaurant_id: restaurant.id, name: catName, display_order: i }])
        .select()
        .single();
        
      if (catError) throw catError;
      catMap[catName] = newCat.id;
    }
  }
  console.log('Categorías listas.');

  // 4. Crear Productos
  const productosData = [
    { name: 'Coca-Cola', cat: 'Bebidas', price: 2.50, desc: 'Refresco de cola' },
    { name: 'Jugo natural', cat: 'Bebidas', price: 3.00, desc: 'Jugo de frutas de temporada' },
    { name: 'Hamburguesa clásica', cat: 'Platos principales', price: 8.50, desc: 'Carne de res, queso, lechuga y tomate' },
    { name: 'Papas fritas', cat: 'Platos principales', price: 3.50, desc: 'Porción de papas crujientes' },
    { name: 'Cheesecake', cat: 'Postres', price: 4.50, desc: 'Delicioso pastel de queso con frutos rojos' },
  ];

  console.log('Creando productos...');
  for (const prod of productosData) {
    const category_id = catMap[prod.cat];
    
    const { data: existingProd } = await supabase
      .from('products')
      .select('*')
      .eq('category_id', category_id)
      .eq('name', prod.name)
      .single();

    if (!existingProd) {
      const { error: prodError } = await supabase
        .from('products')
        .insert([{
          category_id,
          name: prod.name,
          description: prod.desc,
          price: prod.price
        }]);
      
      if (prodError) throw prodError;
    }
  }
  
  console.log('Productos listos.');
  console.log('=================================');
  console.log('Demo Mesio ha sido creado con éxito.');
  console.log(`URL del menú: /menu/${restaurant.slug}`);
  console.log(`Usuario (para login): ${email}`);
  console.log(`Contraseña: ${password}`);
  console.log('=================================');
}

seed().catch(console.error);
