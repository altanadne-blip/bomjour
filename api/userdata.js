const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);

    // Используем Service Role Key для обхода RLS
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY, // ЗАМЕНИТЕ на Service Role Key
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Получаем пользователя из токена
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Запрос к profiles таблице (с обходом RLS через Service Role)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      // Если профиль не найден - создаем его
      if (profileError.code === 'PGRST116') {
        const { data: newProfile, error: insertError } = await supabaseAdmin
          .from('profiles')
          .insert([{
            id: user.id,
            email: user.email,
            balance: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }])
          .select()
          .single();

        if (insertError) {
          return res.status(500).json({ error: 'Failed to create profile' });
        }

        return res.status(200).json({
          id: user.id,
          email: user.email,
          created_at: user.created_at,
          balance: newProfile.balance,
          profile_created: true
        });
      }
      return res.status(500).json({ error: 'Database error' });
    }

    // Возвращаем данные профиля
    return res.status(200).json({
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      balance: profile.balance || 0,
      profile_exists: true
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
