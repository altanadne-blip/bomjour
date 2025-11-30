-- Полный скрипт создания таблицы profiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  deposit_address TEXT UNIQUE NOT NULL,
  private_key TEXT, -- Новая колонка для приватного ключа
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Создание индексов
CREATE INDEX IF NOT EXISTS idx_profiles_deposit_address ON profiles(deposit_address);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- RLS политики
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own profile" 
ON profiles 
FOR INSERT 
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view own profile" 
ON profiles 
FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
ON profiles 
FOR UPDATE 
USING (auth.uid() = id);
