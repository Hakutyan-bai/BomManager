-- 允许 number 类型参数提供多个可选单位；为 NULL 表示固定单位（沿用 unit 字段）。
ALTER TABLE category_attributes ADD COLUMN unit_options TEXT;

-- 物料参数值可覆盖分类默认单位；空字符串表示沿用默认单位。
ALTER TABLE material_attributes ADD COLUMN unit TEXT NOT NULL DEFAULT '';

-- 为「电阻 · 阻值」「电容 · 容量」配置可选单位（默认单位仍为原 unit 字段值）。
UPDATE category_attributes SET unit_options = '["Ω","kΩ","MΩ"]' WHERE category_id = 1 AND name = '阻值';
UPDATE category_attributes SET unit_options = '["pF","nF","uF"]' WHERE category_id = 2 AND name = '容量';
