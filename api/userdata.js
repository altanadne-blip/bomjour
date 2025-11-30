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

    console.log('User from token:');
    console.log('  ID:', user.id);
    console.log('  Email:', user.email);
    console.log('  ID Type:', typeof user.id);
    console.log('  ID Length:', user.id.length);

    // Детальный запрос к profiles
    console.log('Querying profiles table for user_id:', user.id);
    
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id);

    console.log('Profiles query result:');
    console.log('  Data:', profiles);
    console.log('  Error:', profilesError);
    console.log('  Count:', profiles ? profiles.length : 0);

    if (profilesError) {
      console.error('❌ PROFILE QUERY ERROR:', profilesError);
      console.log('Error details:', {
        message: profilesError.message,
        details: profilesError.details,
        hint: profilesError.hint,
        code: profilesError.code
      });
    }

    let balance = 0;
    let profileExists = false;

    if (profiles && profiles.length > 0) {
      profileExists = true;
      balance = profiles[0].balance;
      console.log('✅ PROFILE FOUND!');
      console.log('  Balance:', balance);
      console.log('  Balance type:', typeof balance);
      console.log('  Full profile data:', profiles[0]);
    } else {
      console.log('❌ NO PROFILE FOUND in query results');
      console.log('  User ID we searched for:', user.id);
      console.log('  User ID type:', typeof user.id);
    }

    // ПРЯМОЙ ЗАПРОС - попробуем найти любую запись в profiles
    console.log('=== CHECKING ALL PROFILES ===');
    const { data: allProfiles, error: allError } = await supabase
      .from('profiles')
      .select('*')
      .limit(10);

    if (!allError && allProfiles) {
      console.log(`📊 Found ${allProfiles.length} profiles in table:`);
      allProfiles.forEach((profile, index) => {
        console.log(`  ${index + 1}. ID: ${profile.id}`);
        console.log(`     Email: ${profile.email}`);
        console.log(`     Balance: ${profile.balance}`);
        console.log(`     ID Type: ${typeof profile.id}`);
        console.log(`     ID Length: ${profile.id.length}`);
        
        // Проверим совпадает ли ID
        const isMatch = profile.id === user.id;
        console.log(`     ID MATCH: ${isMatch}`);
        
        if (isMatch) {
          console.log(`     🎯 THIS IS OUR USER! Balance should be: ${profile.balance}`);
        }
      });
    } else {
      console.log('Error fetching all profiles:', allError);
    }

    // Если профиль не найден, но мы знаем что он существует - это проблема с запросом
    if (!profileExists) {
      console.log('🚨 PROFILE EXISTS BUT NOT FOUND BY QUERY!');
      console.log('This indicates a problem with the Supabase query or data types');
      
      // Попробуем альтернативный запрос
      console.log('=== TRYING ALTERNATIVE QUERY ===');
      const { data: altProfiles, error: altError } = await supabase
        .from('profiles')
        .select('*')
        .ilike('id', user.id); // Используем ilike вместо eq

      console.log('Alternative query result:', {
        data: altProfiles,
        error: altError,
        count: altProfiles ? altProfiles.length : 0
      });
    }

    const responseData = {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      balance: balance,
      profile_exists: profileExists,
      debug: {
        query_count: profiles ? profiles.length : 0,
        all_profiles_count: allProfiles ? allProfiles.length : 0,
        user_id: user.id
      }
    };

    console.log('=== FINAL RESPONSE ===', responseData);

    return res.status(200).json(responseData);

  } catch (error) {
    console.error('User data error:', error);
    return res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
};
