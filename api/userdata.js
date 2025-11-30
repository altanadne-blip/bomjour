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

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    console.log('=== USERDATA API CALL ===');

    // Получаем пользователя из токена
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return res.status(401).json({ error: 'Invalid token' });
    }

    console.log('User from token:', {
      id: user.id,
      email: user.email
    });

    // Детальный запрос к profiles
    console.log('Querying profiles table for user_id:', user.id);
    
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id);

    console.log('Profiles query result:', {
      data: profiles,
      error: profilesError,
      count: profiles ? profiles.length : 0
    });

    // Проверим все записи в profiles для отладки
    const { data: allProfiles, error: allError } = await supabase
      .from('profiles')
      .select('*')
      .limit(10);

    if (!allError) {
      console.log('First 10 profiles in table:', allProfiles);
    } else {
      console.log('Error fetching all profiles:', allError);
    }

    let balance = 0;
    let profileExists = false;

    if (profilesError) {
      console.error('Error querying profiles:', profilesError);
    } else if (profiles && profiles.length > 0) {
      profileExists = true;
      balance = profiles[0].balance;
      console.log('Profile found! Balance:', balance, 'Type:', typeof balance);
      
      // Детальная информация о найденном профиле
      console.log('Full profile data:', profiles[0]);
    } else {
      console.log('No profile found for user:', user.id);
      
      // Создаем новый профиль
      console.log('Creating new profile...');
      const { data: newProfile, error: insertError } = await supabase
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
        console.error('Error creating profile:', insertError);
      } else {
        console.log('New profile created:', newProfile);
        balance = newProfile.balance || 0;
      }
    }

    // Преобразуем баланс в число на всякий случай
    balance = parseFloat(balance) || 0;

    const responseData = {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      balance: balance,
      profile_exists: profileExists
    };

    console.log('=== FINAL RESPONSE ===', responseData);

    return res.status(200).json(responseData);

  } catch (error) {
    console.error('User data error:', error);
    return res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
};
