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

    // Создаем Supabase клиент с более детальным логированием
    console.log('Creating Supabase client with URL:', process.env.SUPABASE_URL ? 'URL is set' : 'URL is MISSING');
    
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    console.log('=== USERDATA API CALL START ===');

    // Получаем пользователя из токена
    console.log('Step 1: Getting user from token...');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError) {
      console.error('❌ AUTH ERROR:', authError);
      return res.status(401).json({ error: 'Invalid token: ' + authError.message });
    }

    if (!user) {
      console.error('❌ NO USER FOUND IN TOKEN');
      return res.status(401).json({ error: 'No user found in token' });
    }

    console.log('✅ User from token:', {
      id: user.id,
      email: user.email,
      id_type: typeof user.id
    });

    // Запрос к profiles таблице
    console.log('Step 2: Querying profiles table...');
    console.log('Query: SELECT * FROM profiles WHERE id =', user.id);
    
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single(); // Используем .single() вместо массива

    console.log('Profile query result:', {
      data: profile,
      error: profileError,
      hasData: !!profile
    });

    if (profileError) {
      console.error('❌ PROFILE QUERY ERROR:', profileError);
      
      // Если ошибка "No rows found" - это нормально, создаем профиль
      if (profileError.code === 'PGRST116') {
        console.log('No profile found, creating new one...');
        
        const newProfileData = {
          id: user.id,
          email: user.email,
          balance: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        console.log('Inserting new profile:', newProfileData);
        
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert(newProfileData)
          .select()
          .single();

        if (insertError) {
          console.error('❌ PROFILE CREATION ERROR:', insertError);
          return res.status(500).json({ error: 'Failed to create profile: ' + insertError.message });
        }

        console.log('✅ NEW PROFILE CREATED:', newProfile);
        
        return res.status(200).json({
          id: user.id,
          email: user.email,
          created_at: user.created_at,
          balance: newProfile.balance,
          profile_created: true
        });
      }
      
      return res.status(500).json({ error: 'Database error: ' + profileError.message });
    }

    if (!profile) {
      console.error('❌ PROFILE IS NULL OR UNDEFINED');
      return res.status(404).json({ error: 'Profile not found' });
    }

    console.log('✅ PROFILE FOUND SUCCESSFULLY:', {
      id: profile.id,
      email: profile.email,
      balance: profile.balance,
      balance_type: typeof profile.balance
    });

    // Убедимся что баланс - число
    const balance = typeof profile.balance === 'number' ? profile.balance : parseFloat(profile.balance) || 0;

    const responseData = {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      balance: balance,
      profile_exists: true,
      raw_balance: profile.balance // Для отладки
    };

    console.log('=== FINAL RESPONSE ===', responseData);
    console.log('=== USERDATA API CALL END ===');

    return res.status(200).json(responseData);

  } catch (error) {
    console.error('💥 UNEXPECTED ERROR:', error);
    return res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
};
