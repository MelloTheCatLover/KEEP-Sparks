-- Parents of a child. One-to-many: one or two rows per child.
CREATE TABLE user_parents_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_main(id) ON DELETE CASCADE,
  f_name VARCHAR(50) NOT NULL,
  m_name VARCHAR(50),
  l_name VARCHAR(50) NOT NULL,
  phone_number_1 VARCHAR(50) NOT NULL,
  phone_number_2 VARCHAR(50)
);

CREATE INDEX idx_user_parents_info_user_id ON user_parents_info(user_id);
