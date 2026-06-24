-- Main users table: children and admins, split by `role`.
CREATE TABLE user_main (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  f_name VARCHAR(50) NOT NULL,
  m_name VARCHAR(50),
  l_name VARCHAR(50) NOT NULL,
  login VARCHAR(50) UNIQUE NOT NULL,
  passwd VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'child' CHECK (role IN ('admin', 'child')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_user_main_updated_at
  BEFORE UPDATE ON user_main
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
